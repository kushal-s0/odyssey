from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.contracts.models import LanguageResult
from app.contracts.pipeline import EvidenceBundle, ExtractionDraft
from app.contracts.worker import StagePublish, WorkerRequest
from app.pipeline.normalize import normalize_text, numeric_tokens
from app.pipeline.structure import assemble, quoted_money
from app.pipeline.text import translated
from app.services.jobs import Jobs
from app.worker.capabilities import Capabilities
from app.worker.manifest import MANIFEST_HASH
from test_submissions import submit
from test_worker_http import worker_workspace


def english(text,preferred):
    return LanguageResult(code='en',provenance='detected',model_id='synthetic-test-detector',needs_confirmation=False)


def bundle(text='Tea costs INR 12.50 per cup. Investment is INR 30000.'):
    value=normalize_text(text,uuid4(),uuid4(),'en',english)
    for segment in value.evidence:
        segment.english_text=segment.original_text
    return value


def test_decimal_segmentation_retains_exact_offsets_and_stable_evidence():
    text='चाय का व्यापार। Tea costs INR 12.50 per cup.\nCustomers are office workers.'
    value=normalize_text(text,uuid4(),uuid4(),'hi',english,max_chars=100)
    assert any('12.50' in segment.original_text for segment in value.evidence)
    for segment in value.evidence:
        assert text[segment.start_character:segment.end_character]==segment.original_text
    repeat=normalize_text(text,value.evidence[0].submission_id,value.evidence[0].input_revision_id,'hi',english,max_chars=100)
    assert [s.id for s in repeat.evidence]==[s.id for s in value.evidence]


def test_supplied_numbers_preserved_and_unknown_money_stays_null():
    value=bundle()
    draft=ExtractionDraft(facts=[{'field':'unit_price','segment':0,'quote':'INR 12.50 per cup'},
                                 {'field':'investment','segment':1,'quote':'INR 30000'}])
    result=assemble(value,[draft]).business
    assert str(result.unit_price.value.amount)=='12.50'
    assert result.profit.value is None and result.profit.status=='missing'
    assert numeric_tokens('₹१२,००० and 12.50')==['12000','12.50']


def test_conflicting_quotes_and_unrelated_answers_are_reviewable():
    value=bundle('Investment INR 10000. Investment INR 20000. Research answer: I like cricket.')
    draft=ExtractionDraft(facts=[{'field':'investment','segment':0,'quote':'INR 10000'},
        {'field':'investment','segment':1,'quote':'INR 20000'},
        {'field':'market_research','segment':2,'quote':'I like cricket','status':'irrelevant'}])
    result=assemble(value,[draft]).business
    assert result.investment.value is None and result.investment.status=='ambiguous'
    assert len(result.investment.alternatives)==2
    assert result.market_research.status=='irrelevant'


@pytest.mark.parametrize('fact',[{'field':'profit','segment':0,'quote':'INR 999999'},
    {'field':'offer','segment':5,'quote':'Tea'}, {'field':'summary','segment':0,'quote':'My name is Example'}])
def test_fabricated_quotes_and_unknown_citations_are_rejected(fact):
    with pytest.raises(ValueError):
        assemble(bundle(),[ExtractionDraft(facts=[fact])])


def test_translation_that_changes_numbers_is_preserved_but_marked_uncertain():
    value=bundle('चाय की कीमत १० रुपये है।')
    value.evidence[0].language=LanguageResult(code='hi',provenance='declared')
    class Translator:
        def translate(self,text,source):
            return 'Tea costs 100 rupees.'
    outputs=list(translated(value,Translator()))
    assert outputs[-1][1].evidence[0].translation_uncertain
    assert outputs[-1][1].evidence[0].original_text=='चाय की कीमत १० रुपये है।'


def test_api_persists_validated_sources_and_business_atomically(database,tmp_path):
    with worker_workspace(database,tmp_path) as (client,_,app,worker):
        accepted=submit(client,{'text':'Tea for office workers. Price INR 10 per cup.'}).json()
        jobs=Jobs(database,app.state.settings)
        request=WorkerRequest(worker_id=worker,supported_stages=['extract:text','translate','structure'],manifest_hash=MANIFEST_HASH)
        first=jobs.claim(request)
        original=jobs.input(Capabilities(app.state.settings.stage_capability_signing_key).verify(first.capability,first.stage_id))
        normalized=normalize_text(original.source_text,original.submission_id,original.input_revision_id,'en',english)
        def publish(work,payload):
            claims=Capabilities(app.state.settings.stage_capability_signing_key).verify(work.capability,work.stage_id)
            return jobs.publish(claims,StagePublish(model_manifest_hash=MANIFEST_HASH,payload=payload))
        publish(first,normalized.model_dump(mode='json'))
        second=jobs.claim(request)
        for segment in normalized.evidence:
            segment.english_text=segment.original_text
        bad=normalized.model_dump(mode='json')
        bad['evidence'][0]['original_text']='Changed source'
        with pytest.raises(HTTPException):
            publish(second,bad)
        with database.transaction() as c:
            assert c.execute('SELECT count(*) AS n FROM public.source_segments WHERE input_revision_id=%s',
                             (accepted['revision_id'],)).fetchone()['n']==0
        publish(second,normalized.model_dump(mode='json'))
        third=jobs.claim(request)
        draft=ExtractionDraft(facts=[{'field':'offer','segment':0,'quote':'Tea'},
            {'field':'target_customers','segment':0,'quote':'office workers'}],trade='tea_stall',sector='food_beverage')
        structured=assemble(normalized,[draft])
        publish(third,structured.model_dump(mode='json'))
        with database.transaction() as c:
            assert c.execute('SELECT count(*) AS n FROM public.source_segments WHERE input_revision_id=%s',
                             (accepted['revision_id'],)).fetchone()['n']==2
            assert c.execute('SELECT payload FROM public.business_records WHERE input_revision_id=%s',
                             (accepted['revision_id'],)).fetchone()['payload']['offer']['value']=='Tea'


def test_bundle_does_not_accept_unknown_schema_fields():
    with pytest.raises(ValueError):
        EvidenceBundle.model_validate({'evidence':[],'pretend_verified':True})


@pytest.mark.parametrize('text',['loss INR -1000','profit 20%','INR 12,50'])
def test_negative_percentage_and_invalid_grouping_never_become_positive_cash(text):
    assert quoted_money(text) is None
