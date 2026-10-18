import hashlib
import io
import wave
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from uuid import uuid4

import av
import pytest
import psycopg
from fastapi.testclient import TestClient
from pypdf import PdfWriter

from app.auth.access import ActorView, require_actor
from app.config import Settings
from app.main import create_app
from app.services.storage import LocalPrivateStorage
from app.services.upload_cleanup import cleanup_abandoned
from test_database import ROOT, seeded


def pdf(pages=11, encrypted=False):
    writer = PdfWriter()
    for _ in range(pages):
        writer.add_blank_page(width=595, height=842)
    if encrypted:
        writer.encrypt('synthetic-private-password')
    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()


def wav(seconds=1):
    output = io.BytesIO()
    with wave.open(output, 'wb') as target:
        target.setnchannels(1)
        target.setsampwidth(2)
        target.setframerate(16000)
        target.writeframes(b'\0\0'*(16000*seconds))
    return output.getvalue()


def encoded_audio(format, codec):
    output = io.BytesIO()
    with av.open(output, 'w', format=format) as container:
        stream = container.add_stream(codec, rate=48000)
        stream.layout = 'mono'
        frame = av.AudioFrame(format='fltp', layout='mono', samples=48000)
        frame.sample_rate = 48000
        for plane in frame.planes:
            plane.update(b'\0'*plane.buffer_size)
        for packet in stream.encode(frame):
            container.mux(packet)
        for packet in stream.encode(None):
            container.mux(packet)
    return output.getvalue()


@contextmanager
def workspace(database, tmp_path, **options):
    settings = Settings(_env_file=None, app_env='test', storage_backend='local', local_storage_dir=tmp_path,
                        database_url=(ROOT/'.local/test-database-url').read_text().strip(), **options)
    app = create_app(settings)
    with seeded(database) as data:
        with database.transaction() as connection:
            connection.execute("UPDATE public.processing_jobs SET status='completed' WHERE id=%s", (data['job'],))
        def actor():
            return ActorView(id=data['people'][0], role='applicant', cohorts=[])
        app.dependency_overrides[require_actor] = actor
        try:
            with TestClient(app) as client:
                yield client, data, app
        finally:
            with database.transaction() as connection:
                # New submissions belong to these synthetic users, not organizer records.
                connection.execute('DELETE FROM public.submissions WHERE owner_id=ANY(%s)', (data['people'],))
                connection.execute('DELETE FROM public.attachments WHERE owner_id=ANY(%s) AND submission_id IS NULL',
                                   (data['people'],))


def init_upload(client, data, mime='application/pdf'):
    response = client.post('/v1/uploads', json={'filename': 'synthetic', 'media_type': mime, 'bytes': len(data)},
                           headers={'Idempotency-Key': str(uuid4())})
    assert response.status_code == 201, response.json()
    return response.json()


def submit(client, payload, key=None):
    return client.post('/v1/submissions', json={'consent': True, **payload},
                       headers={'Idempotency-Key': key or str(uuid4())})


def test_text_acceptance_is_atomic_private_and_idempotent(database, tmp_path):
    with workspace(database, tmp_path) as (client, data, _):
        key = str(uuid4())
        payload = {'text': 'I will sell tea at ten rupees a cup.', 'cohort_id': str(data['cohorts'][0])}
        accepted = submit(client, payload, key)
        assert accepted.status_code == 202
        assert submit(client, payload, key).json() == accepted.json()
        assert submit(client, {'text': 'Different input'}, key).status_code == 409
        view = client.get('/v1/submissions/'+accepted.json()['submission_id'])
        assert view.status_code == 200 and view.json()['source_text'] == payload['text']
        assert client.get('/v1/submissions/'+str(data['submissions'][1])).status_code == 404
        with database.transaction() as connection:
            row = connection.execute('''SELECT j.id,v.source_text,s.input_hash FROM public.processing_jobs j
                JOIN public.submission_versions v ON v.id=j.input_revision_id
                JOIN public.job_stages s ON s.job_id=j.id WHERE j.id=%s''', (accepted.json()['job_id'],)).fetchone()
            assert row['source_text'] == payload['text']
            assert row['input_hash'] == hashlib.sha256(payload['text'].encode()).hexdigest()


def test_rehearsal_metadata_is_explicit_owner_namespaced_and_idempotent(database, tmp_path):
    with workspace(database, tmp_path) as (client, data, _):
        assert submit(client, {'text': 'A real idea', 'scenario_family': 'tea-001'}).status_code == 422
        assert submit(client, {'text': 'An example', 'synthetic': True, 'scenario_family': '../real'}).status_code == 422
        key = str(uuid4())
        payload = {'text': 'Synthetic tea example', 'synthetic': True, 'scenario_family': 'tea-001'}
        first = submit(client, payload, key)
        assert first.status_code == 202, first.text
        assert submit(client, payload, key).json() == first.json()
        assert submit(client, {**payload, 'synthetic': False, 'scenario_family': None}, key).status_code == 409
        with database.transaction() as c:
            row = c.execute('SELECT synthetic,family_id FROM public.submissions WHERE id=%s',
                (first.json()['submission_id'],)).fetchone()
        assert row['synthetic'] and row['family_id'] == f"demo:{data['people'][0]}:tea-001"


@pytest.mark.parametrize('kind,mime', [('pdf','application/pdf'),('wav','audio/wav'),
    ('ogg','audio/ogg'),('mp4','video/mp4'),('webm','audio/webm'),('mp3','audio/mpeg')])
def test_real_formats_preserve_exact_bytes_and_accept_eleven_pages(database, tmp_path, kind, mime):
    content = pdf() if kind == 'pdf' else wav() if kind == 'wav' else encoded_audio(
        {'ogg':'ogg','mp4':'mp4','webm':'webm','mp3':'mp3'}[kind],
        {'ogg':'libopus','mp4':'aac','webm':'libopus','mp3':'libmp3lame'}[kind])
    with workspace(database, tmp_path) as (client, _, _):
        initiated = init_upload(client, content, mime)
        response = client.put(initiated['upload_path'], content=content, headers={'Content-Type': mime})
        assert response.status_code == 200, response.json()
        if kind == 'pdf':
            assert response.json()['pages'] == 11
        else:
            assert 0 < response.json()['duration_seconds'] < 2
        assert client.put(initiated['upload_path'], content=content, headers={'Content-Type': mime}).json() == response.json()
        accepted = submit(client, {'attachment_ids': [initiated['attachment_id']]})
        assert accepted.status_code == 202, accepted.json()
        original = client.get('/v1/uploads/'+initiated['attachment_id']+'/content')
        assert original.status_code == 200 and original.content == content
        assert original.headers['cache-control'] == 'no-store'
        assert submit(client, {'attachment_ids': [initiated['attachment_id']]}).status_code == 404


@pytest.mark.parametrize('content', [b'<html>not a PDF</html>', pdf(21), pdf(1, encrypted=True), b'%PDF-1.7\ntruncated'],
                         ids=['spoofed', 'page-limit', 'encrypted', 'truncated'])
def test_spoofed_encrypted_oversize_page_and_truncated_files_are_rejected(database, tmp_path, content):
    with workspace(database, tmp_path) as (client, _, _):
        initiated = init_upload(client, content)
        assert client.put(initiated['upload_path'], content=content,
                          headers={'Content-Type':'application/pdf'}).status_code == 422


def test_limits_ownership_and_no_cross_user_attachment_consumption(database, tmp_path):
    with workspace(database, tmp_path, max_upload_mb=1, max_audio_seconds=1) as (client, data, _):
        assert client.post('/v1/uploads', json={'filename':'../unsafe', 'media_type':'application/pdf','bytes':5},
                           headers={'Idempotency-Key':str(uuid4())}).status_code == 422
        assert client.post('/v1/uploads', json={'filename':'large.pdf','media_type':'application/pdf','bytes':2**20+1},
                           headers={'Idempotency-Key':str(uuid4())}).status_code == 413
        initiated = init_upload(client, wav(2), 'audio/wav')
        assert client.put(initiated['upload_path'], content=wav(2), headers={'Content-Type':'audio/wav'}).status_code == 422
        assert submit(client, {'text':'Synthetic', 'cohort_id':str(data['cohorts'][1])}).status_code == 403
        assert client.get('/v1/uploads/'+str(uuid4())+'/content').status_code == 404
        with database.transaction() as connection:
            connection.execute("UPDATE public.attachments SET owner_id=%s,status='uploaded',sha256=%s WHERE id=%s",
                               (data['people'][1], 'b'*64, initiated['attachment_id']))
        assert submit(client, {'attachment_ids':[initiated['attachment_id']]}).status_code == 404
        assert client.put(initiated['upload_path'], content=wav(2), headers={'Content-Type':'audio/wav'}).status_code == 404


def test_upload_body_lengths_and_duplicate_content_conflicts(database, tmp_path):
    with workspace(database, tmp_path) as (client, _, _):
        content = pdf(1)
        initiated = init_upload(client, content)
        assert client.put(initiated['upload_path'], content=content+b'x', headers={'Content-Type':'application/pdf'}).status_code == 413
        assert client.put(initiated['upload_path'], content=content, headers={'Content-Type':'audio/ogg'}).status_code == 415
        assert client.put(initiated['upload_path'], content=content, headers={'Content-Type':'application/pdf'}).status_code == 200
        different = content.replace(b'595', b'594')
        assert client.put(initiated['upload_path'], content=different, headers={'Content-Type':'application/pdf'}).status_code == 409


def test_concurrent_duplicate_submission_creates_one_job(database, tmp_path):
    with workspace(database, tmp_path) as (client, _, _):
        key = str(uuid4())
        with ThreadPoolExecutor(max_workers=2) as pool:
            responses = list(pool.map(lambda _: submit(client, {'text':'Synthetic duplicate request'}, key), range(2)))
        assert [r.status_code for r in responses] == [202,202]
        assert responses[0].json() == responses[1].json()


def test_abandoned_cleanup_keeps_attached_original_and_is_retryable(database, tmp_path):
    with workspace(database, tmp_path) as (client, data, _):
        content = pdf(1)
        initiated = init_upload(client, content)
        assert client.put(initiated['upload_path'], content=content, headers={'Content-Type':'application/pdf'}).status_code == 200
        with database.transaction() as connection:
            connection.execute("UPDATE public.attachments SET created_at=now()-interval '25 hours' WHERE id=%s", (initiated['attachment_id'],))
            path = connection.execute('SELECT object_path FROM public.attachments WHERE id=%s', (initiated['attachment_id'],)).fetchone()['object_path']
        assert cleanup_abandoned(database, LocalPrivateStorage(tmp_path)) == 1
        assert not LocalPrivateStorage(tmp_path).path(path).exists()
        assert cleanup_abandoned(database, LocalPrivateStorage(tmp_path)) == 0
        with database.transaction() as connection:
            assert connection.execute('SELECT status FROM public.attachments WHERE id=%s', (data['attachment'],)).fetchone()['status'] == 'attached'


def test_upload_cancellation_does_not_remove_attached_evidence(database, tmp_path):
    with workspace(database, tmp_path) as (client, _, _):
        original = pdf(1)
        pending = init_upload(client, original)
        assert client.delete('/v1/uploads/'+pending['attachment_id']).status_code == 204
        assert client.put(pending['upload_path'],content=original,headers={'Content-Type':'application/pdf'}).status_code == 404
        ready = init_upload(client, original)
        assert client.put(ready['upload_path'],content=original,headers={'Content-Type':'application/pdf'}).status_code == 200
        assert submit(client, {'attachment_ids':[ready['attachment_id']]}).status_code == 202
        assert client.delete('/v1/uploads/'+ready['attachment_id']).status_code == 409


def test_queue_and_pending_upload_admission_are_bounded(database, tmp_path):
    with workspace(database, tmp_path, max_active_jobs_per_user=1) as (client, _, _):
        assert submit(client, {'text':'First synthetic idea'}).status_code == 202
        assert submit(client, {'text':'Second synthetic idea'}).status_code == 429
        for _ in range(5):
            init_upload(client, pdf(1))
        sixth = client.post('/v1/uploads',json={'filename':'synthetic','media_type':'application/pdf','bytes':10},
                            headers={'Idempotency-Key':str(uuid4())})
        assert sixth.status_code == 429


def test_idempotency_is_owner_scoped_and_upload_request_mismatch_is_rejected(database, tmp_path):
    with workspace(database, tmp_path) as (client, data, app):
        key = str(uuid4())
        payload = {'filename':'synthetic.pdf','media_type':'application/pdf','bytes':len(pdf(1))}
        first = client.post('/v1/uploads',json=payload,headers={'Idempotency-Key':key})
        assert first.status_code == 201
        assert client.post('/v1/uploads',json=payload,headers={'Idempotency-Key':key}).json() == first.json()
        assert client.post('/v1/uploads',json={**payload,'bytes':123},headers={'Idempotency-Key':key}).status_code == 409
        submission = submit(client, {'text':'Synthetic ownership check'}, key)
        assert submission.status_code == 202
        app.dependency_overrides[require_actor] = lambda: ActorView(id=data['people'][1],role='applicant',cohorts=[])
        second = submit(client, {'text':'Synthetic ownership check'}, key)
        assert second.status_code == 202 and second.json()['submission_id'] != submission.json()['submission_id']
        assert client.get('/v1/submissions/'+submission.json()['submission_id']).status_code == 404
        assert client.get('/v1/uploads/'+first.json()['attachment_id']+'/content').status_code == 404


def test_job_insert_failure_rolls_back_submission_revision_and_attachment(database, tmp_path, monkeypatch):
    with workspace(database, tmp_path) as (client, data, app):
        with database.transaction() as connection:
            before = connection.execute('SELECT count(*) AS n FROM public.submissions WHERE owner_id=%s', (data['people'][0],)).fetchone()['n']
        # Inject an invalid backend after validated setup; PostgreSQL fails after revision creation.
        monkeypatch.setattr(app.state.settings, 'model_runtime', 'injected-invalid-backend')
        with pytest.raises(psycopg.errors.CheckViolation):
            submit(client, {'text':'This transaction must roll back completely'})
        with database.transaction() as connection:
            after = connection.execute('SELECT count(*) AS n FROM public.submissions WHERE owner_id=%s', (data['people'][0],)).fetchone()['n']
            assert after == before
