"""Private organizer files through real local routes/storage, never public services."""
import hashlib
import json
import zipfile
from collections import Counter
from uuid import uuid4

import pytest

from test_database import ROOT
from test_submissions import init_upload, submit, workspace


def test_private_corpus_intact_through_upload_submission_and_authorized_download(database, tmp_path):
    sources = list(ROOT.glob('AI solution*'))
    if not sources:
        pytest.skip('Private organizer corpus absent; this is not passed corpus acceptance')
    archives = sorted(sources[0].rglob('*.zip'))
    assert len(archives) == 3
    before = {p:hashlib.sha256(p.read_bytes()).hexdigest() for p in archives}
    counts, pages, records = Counter(), 0, []
    with workspace(database, tmp_path) as (client, _, _):
        for archive in archives:
            with zipfile.ZipFile(archive) as bundle:
                for entry in bundle.infolist():
                    if entry.is_dir():
                        continue
                    content = bundle.read(entry)
                    suffix = entry.filename.rsplit('.', 1)[-1].lower()
                    mime = {'pdf':'application/pdf','mp4':'video/mp4','ogg':'audio/ogg'}[suffix]
                    initiated = init_upload(client, content, mime)
                    completed = client.put(initiated['upload_path'], content=content, headers={'Content-Type':mime})
                    assert completed.status_code == 200, {'id':hashlib.sha256(content).hexdigest(), 'status':completed.status_code}
                    accepted = submit(client, {'attachment_ids':[initiated['attachment_id']]}, str(uuid4()))
                    assert accepted.status_code == 202
                    original = client.get('/v1/uploads/'+initiated['attachment_id']+'/content')
                    assert original.status_code == 200 and original.content == content
                    with database.transaction() as connection:
                        connection.execute("UPDATE public.processing_jobs SET status='completed' WHERE id=%s", (accepted.json()['job_id'],))
                    counts[suffix] += 1
                    pages += completed.json()['pages'] or 0
                    records.append({'sha256':hashlib.sha256(content).hexdigest(), 'format':suffix,
                                    'pages':completed.json()['pages'], 'intact':True})
    assert counts == {'pdf':42, 'mp4':11, 'ogg':2}
    assert pages == 109 and sum(r['pages']==11 for r in records) == 4
    assert before == {p:hashlib.sha256(p.read_bytes()).hexdigest() for p in archives}
    report = {'environment':'local_postgres_explicit_private_disk_adapter', 'hosted_storage_verified':False,
              'files':55,'formats':dict(counts),'pdf_pages':pages,'eleven_page_scans':4,
              'archive_hashes_unchanged':True,'all_authorized_downloads_byte_identical':True,
              'parser_versions':{'pypdf':'6.21.1','av':'16.0.1'},'records':sorted(records,key=lambda r:r['sha256'])}
    output=ROOT/'evals/reports/uploads-corpus.json'
    output.write_text(json.dumps(report,indent=2)+'\n')
