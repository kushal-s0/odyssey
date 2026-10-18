from copy import deepcopy
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException

from app.auth.access import ActorView, require_actor
from app.contracts.models import Domain, DomainRating, RelevanceCheck
from app.contracts.pipeline import AssessmentBundle, ExtractionDraft
from app.contracts.worker import StagePublish, WorkerRequest
from app.pipeline.assessment_rules import domain_facts, validate_ratings
from app.pipeline.assess import grounded_judgment
from app.pipeline.structure import assemble
from app.providers.local_models import MANIFEST
from app.services.jobs import Jobs
from app.worker.capabilities import Capabilities
from app.worker.manifest import MANIFEST_HASH
from test_submissions import submit
from test_text_pipeline import bundle, english
from app.pipeline.normalize import normalize_text
from test_worker_http import worker_workspace


def judgments(structured):
    refs=structured.business.offer.source_segment_ids
    return [DomainRating(domain=d,rating=2 if d==Domain.clarity else None,
        reason='Offer and customers are supplied.' if d==Domain.clarity else 'Insufficient usable evidence.',
        basis='self_reported' if d==Domain.clarity else 'insufficient',
        source_segment_ids=refs if d==Domain.clarity else []) for d in Domain]


def structured_fixture():
    source=bundle('Tea for office workers.')
    return assemble(source,[ExtractionDraft(facts=[{'field':'offer','segment':0,'quote':'Tea'},
        {'field':'target_customers','segment':0,'quote':'office workers'}])])


@pytest.mark.parametrize('payload', [
    {'rating': 2, 'reason': 'Offer is supplied.', 'segments': [199]},
    {'rating': 2, 'reason': 'Offer is supplied.', 'segments': []},
    {'rating': 4, 'reason': 'Offer is supplied.', 'segments': [0]},
    {'rating': 2, 'reason': 'There are 999 customers.', 'segments': [0]},
])
def test_judgment_retry_validator_rejects_schema_citation_and_numeric_invention(payload):
    structured = structured_fixture()
    with pytest.raises(ValueError):
        grounded_judgment(structured, Domain.clarity, payload, {0: structured.evidence[0].id})


def test_valid_and_null_judgments_preserve_grounding():
    structured = structured_fixture()
    rating = grounded_judgment(structured, Domain.clarity,
        {'rating': 2, 'reason': 'Offer and customers are supplied.', 'segments': [0]},
        {0: structured.evidence[0].id})
    assert rating.rating == 2 and rating.source_segment_ids == [structured.evidence[0].id]
    rating = grounded_judgment(structured, Domain.clarity,
        {'rating': None, 'reason': 'Human review is required.', 'segments': []},
        {0: structured.evidence[0].id})
    assert rating.rating is None and rating.basis == 'insufficient'


@pytest.mark.parametrize('change',['unrelated','verified','maximum','invented_number','missing_domain'])
def test_grounding_rejects_unrelated_evidence_verification_and_invented_numbers(change):
    structured=structured_fixture()
    ratings=judgments(structured)
    if change=='unrelated':
        ratings[0].source_segment_ids=[uuid4()]
    elif change=='verified':
        ratings[0].basis='reviewer_verified'
    elif change=='maximum':
        ratings[0].rating=4
    elif change=='invented_number':
        ratings[0].reason='Customers ordered INR 999999 of tea.'
    else:
        ratings[-1]=ratings[0]
    with pytest.raises(ValueError):
        validate_ratings(structured,ratings)


def test_conflict_and_identity_do_not_become_ratings():
    structured=structured_fixture()
    assert not domain_facts(structured,Domain.competition)[0]
    structured.business.offer.status='ambiguous'
    structured.business.offer.value=None
    structured.business.offer.note='Needs clarification'
    assert not domain_facts(structured,Domain.clarity)[0]
    structured=structured_fixture()
    structured.business.offer.value='My name is Example'
    with pytest.raises(ValueError):
        domain_facts(structured,Domain.clarity)


def test_explicit_unknown_costs_never_become_present_customer_need():
    source=bundle('My costs and profit are not known yet.')
    structured=assemble(source,[ExtractionDraft(facts=[{'field':'problem','segment':0,
        'quote':'My costs and profit are not known yet.'}])])
    assert structured.business.problem.status=='missing'
    assert domain_facts(structured,Domain.customer_need)==({},set())


def test_final_publication_is_atomic_scoped_idempotent_and_server_calculated(database,tmp_path):
    with worker_workspace(database,tmp_path) as (client,data,app,worker):
        accepted=submit(client,{'text':'Tea for office workers.'}).json()
        jobs=Jobs(database,app.state.settings)
        request=WorkerRequest(worker_id=worker,supported_stages=['extract:text','translate','structure','assess'],manifest_hash=MANIFEST_HASH)
        def claim():
            work=jobs.claim(request)
            assert work is not None
            return Capabilities(app.state.settings.stage_capability_signing_key).verify(work.capability,work.stage_id)
        def publish(claims,payload):
            return jobs.publish(claims,StagePublish(model_manifest_hash=MANIFEST_HASH,payload=payload))
        claims=claim()
        source=normalize_text('Tea for office workers.',UUID(accepted['submission_id']),UUID(accepted['revision_id']),'en',english)
        publish(claims,source.model_dump(mode='json'))
        claims=claim()
        for segment in source.evidence:
            segment.english_text=segment.original_text
        publish(claims,source.model_dump(mode='json'))
        claims=claim()
        structured=assemble(source,[ExtractionDraft(facts=[{'field':'offer','segment':0,'quote':'Tea'},
            {'field':'target_customers','segment':0,'quote':'office workers'}])])
        publish(claims,structured.model_dump(mode='json'))
        claims=claim()
        artifact=MANIFEST['qwen']
        output=AssessmentBundle(model_id=artifact['id'],model_revision=artifact['revision'],domains=judgments(structured),
            relevance=[RelevanceCheck(domain=d,result='uncertain' if d==Domain.clarity else 'missing') for d in Domain])
        bad=deepcopy(output.model_dump(mode='json'))
        bad['domains'][0]['source_segment_ids']=[str(uuid4())]
        with pytest.raises(HTTPException):
            publish(claims,bad)
        with database.transaction() as c:
            assert c.execute('SELECT count(*) AS n FROM public.assessments WHERE input_revision_id=%s',(accepted['revision_id'],)).fetchone()['n']==0
        # Worker cannot choose totals, exclusions or assessment identity.
        bad=output.model_dump(mode='json')|{'scores':{'headline_potential':100}}
        with pytest.raises(HTTPException):
            publish(claims,bad)
        assert publish(claims,output.model_dump(mode='json'))['status']=='completed'
        assert publish(claims,output.model_dump(mode='json'))['published'] is False
        path='/v1/submissions/'+accepted['submission_id']+'/assessment'
        evidence_path='/v1/evidence/'+str(source.evidence[0].id)
        stored=client.get(path)
        assert stored.status_code==200
        assessment=stored.json()
        assert assessment['scores']['provisional_potential']=='50.00'
        assert assessment['scores']['headline_potential'] is None
        assert assessment['scores']['evidence_coverage']=='0.15'
        assert assessment['scores']['completeness_percent']=='11.11'
        assert not assessment['scores']['ranking_eligible']
        assert assessment['relevance_model']=='rules-cosine-baseline-v1'
        assert client.get(evidence_path).json()['original_text']=='Tea for office workers.'
        with database.transaction() as c:
            assert c.execute('SELECT count(*) AS n FROM public.domain_ratings WHERE assessment_id=%s',(assessment['id'],)).fetchone()['n']==6
        app.dependency_overrides[require_actor]=lambda: ActorView(id=data['people'][1],role='applicant',cohorts=[])
        assert client.get(path).status_code==404
        assert client.get(evidence_path).status_code==404
        app.dependency_overrides[require_actor]=lambda: ActorView(id=data['people'][2],role='assessor',cohorts=[])
        # This new submission was unassigned; cohort assessor cannot read it.
        assert client.get(path).status_code==404
