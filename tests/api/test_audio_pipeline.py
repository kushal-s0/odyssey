from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException

from app.contracts.models import AudioEvidence, LanguageResult
from app.contracts.pipeline import EvidenceBundle
from app.contracts.worker import StagePublish, WorkerRequest
from app.services.jobs import Jobs
from app.worker.capabilities import Capabilities
from app.worker.manifest import MANIFEST_HASH
from test_submissions import init_upload, submit, wav
from test_worker_http import worker_workspace


def test_audio_publication_bounds_identity_and_transcription_review(database, tmp_path):
    with worker_workspace(database,tmp_path) as (client, data, app, worker):
        content = wav(2)
        upload = init_upload(client,content,'audio/wav')
        assert client.put(upload['upload_path'],content=content,headers={'Content-Type':'audio/wav'}).status_code == 200
        created = submit(client,{'attachment_ids':[upload['attachment_id']],'preferred_language':'hi'}).json()
        jobs = Jobs(database,app.state.settings)
        work = jobs.claim(WorkerRequest(worker_id=worker,supported_stages=['extract:audio'],manifest_hash=MANIFEST_HASH))
        assert work is not None
        claims = Capabilities(app.state.settings.stage_capability_signing_key).verify(work.capability,work.stage_id)
        segment = AudioEvidence(id=uuid4(),submission_id=UUID(created['submission_id']),input_revision_id=UUID(created['revision_id']),
            attachment_id=UUID(upload['attachment_id']),start_seconds=0,end_seconds=2,
            original_text='Synthetic transcript fixture, not a model quality claim.',
            language=LanguageResult(code='hi',provenance='declared'),transcription_uncertain=True)
        def publish():
            return jobs.publish(claims,StagePublish(model_manifest_hash=MANIFEST_HASH,payload=EvidenceBundle(evidence=[segment]).model_dump(mode='json')))
        segment.end_seconds = 10
        with pytest.raises(HTTPException):
            publish()
        segment.end_seconds = 2
        segment.transcription_uncertain = False
        with pytest.raises(HTTPException):
            publish()
        segment.transcription_uncertain = True
        segment.attachment_id = uuid4()
        with pytest.raises(HTTPException):
            publish()
        segment.attachment_id = UUID(upload['attachment_id'])
        assert publish()['published']
        assert not publish()['published']
