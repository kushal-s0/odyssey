import hashlib
from copy import deepcopy
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

from app.contracts.models import BusinessRecord, Domain, DomainRating, LanguageResult, PdfEvidence
from app.contracts.pipeline import EvidenceBundle
from app.contracts.worker import StagePublish, WorkerRequest
from app.domain.scoring import summarize
from app.pipeline.pdf import handler, suspect_text
from app.services.jobs import Jobs
from app.worker.capabilities import Capabilities
from app.worker.manifest import MANIFEST_HASH
from test_submissions import init_upload, submit
from test_worker_http import worker_workspace


def text_pdf(path, pages=2):
    writer=PdfWriter()
    for i in range(pages):
        page=writer.add_blank_page(width=595,height=842)
        font=DictionaryObject({NameObject('/Type'):NameObject('/Font'),NameObject('/Subtype'):NameObject('/Type1'),
                               NameObject('/BaseFont'):NameObject('/Helvetica')})
        page[NameObject('/Resources')]=DictionaryObject({NameObject('/Font'):DictionaryObject({NameObject('/F1'):font})})
        stream=DecodedStreamObject()
        stream.set_data(f'BT /F1 12 Tf 50 700 Td (Tea for office workers. Page {i+1}. Price INR 10 per cup.) Tj ET'.encode())
        page[NameObject('/Contents')]=writer._add_object(stream)
    writer.write(path)
    return path.read_bytes()


def pdf_context(path,pages=2):
    return {'work':{'pipeline_version':'screening-v1'},'source_path':str(path),'input':{
        'submission_id':str(uuid4()),'input_revision_id':str(uuid4()),'input_kind':'pdf',
        'source_hash':hashlib.sha256(path.read_bytes()).hexdigest(),'source_text':None,'preferred_language':'en',
        'attachment_id':str(uuid4()),'media_type':'application/pdf','bytes':path.stat().st_size,
        'pages':pages,'duration_seconds':None,'previous_outputs':{}}}


def test_digital_pages_resume_without_losing_originals_or_using_vision(tmp_path,monkeypatch):
    path=tmp_path/'synthetic.pdf'
    text_pdf(path)
    context=pdf_context(path)
    monkeypatch.setattr('app.pipeline.pdf.LanguageIdentifier',lambda: lambda text,preferred:
        LanguageResult(code='en',provenance='declared'))
    events=handler(context)
    first=next(events)['checkpoint']
    assert first['next_page']==1
    events.close()  # Simulates model-process interruption after an acknowledged page.
    context['input']['checkpoint']=first
    resumed=list(handler(context))
    bundle=EvidenceBundle.model_validate(resumed[-1]['publish'])
    assert {s.page for s in bundle.evidence}=={1,2}
    assert len({s.id for s in bundle.evidence})==len(bundle.evidence)
    assert all(s.kind=='pdf' and s.extraction_method=='text_layer' and not s.extraction_uncertain for s in bundle.evidence)
    assert any('INR 10' in s.original_text for s in bundle.evidence)
    assert [s.model_dump(mode='json') for s in bundle.evidence if s.page==1]==first['bundle']['evidence']
    context['input']['checkpoint']['source_hash']='0'*64
    assert list(handler(context))[-1]=={'failure':{'code':'needs_review'}}


def test_corrupt_font_maps_are_suspect_but_normal_mixed_scripts_are_not():
    assert suspect_text('Some PDF text contains \ufffd broken characters and words.')
    assert suspect_text('Answer with \ue123private glyphs and enough readable words.')
    assert suspect_text('Broken map gives \u0430\u0431\u0432 and many ordinary English words.')
    assert not suspect_text('Tea costs INR 10 per cup. Customers are office workers. \u091a\u093e\u092f \u0915\u093e \u0935\u094d\u092f\u093e\u092a\u093e\u0930')


def test_pdf_publication_enforces_private_attachment_page_and_ocr_uncertainty(database,tmp_path):
    path=tmp_path/'source.pdf'
    content=text_pdf(path,1)
    with worker_workspace(database,tmp_path/'storage') as (client,_,app,worker):
        upload=init_upload(client,content)
        assert client.put(upload['upload_path'],content=content,headers={'Content-Type':'application/pdf'}).status_code==200
        created=submit(client,{'attachment_ids':[upload['attachment_id']]}).json()
        jobs=Jobs(app.state.database,app.state.settings)
        work=jobs.claim(WorkerRequest(worker_id=worker,supported_stages=['extract:pdf'],manifest_hash=MANIFEST_HASH))
        claims=Capabilities(app.state.settings.stage_capability_signing_key).verify(work.capability,work.stage_id)
        evidence=PdfEvidence(id=uuid4(),submission_id=UUID(created['submission_id']),
            input_revision_id=UUID(created['revision_id']),attachment_id=UUID(upload['attachment_id']),
            page=1,original_text='Tea for office workers.',language=LanguageResult(code='en',provenance='declared'))
        payload=EvidenceBundle(evidence=[evidence]).model_dump(mode='json')
        for invalid in ('page','attachment','ocr','modality'):
            bad=deepcopy(payload)
            if invalid=='page':
                bad['evidence'][0]['page']=2
            if invalid=='attachment':
                bad['evidence'][0]['attachment_id']=str(uuid4())
            if invalid=='ocr':
                bad['evidence'][0]['extraction_method']='vision_ocr'
            if invalid=='modality':
                bad['evidence'][0]['kind']='audio'
            with pytest.raises(HTTPException):
                jobs.publish(claims,StagePublish(model_manifest_hash=MANIFEST_HASH,payload=bad))
        assert jobs.publish(claims,StagePublish(model_manifest_hash=MANIFEST_HASH,payload=payload))['published']


def test_unreviewed_source_never_gets_a_headline_or_ranking():
    reference=uuid4()
    business=BusinessRecord(offer={'value':'tea','status':'present','source_segment_ids':[reference]},
                            target_customers={'value':'workers','status':'present','source_segment_ids':[reference]})
    ratings=[DomainRating(domain=d,rating=3,reason='Synthetic supported policy fixture.',basis='self_reported',
                          source_segment_ids=[reference]) for d in Domain]
    scores=summarize(ratings,business,source_review_required=True)
    assert scores.provisional_potential==75
    assert scores.headline_potential is None and not scores.ranking_eligible
    assert scores.withheld_reason=='source_requires_review'
