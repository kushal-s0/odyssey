from uuid import UUID, uuid4

from app.auth.access import ActorView, require_actor
from test_submissions import submit, workspace
from product_helpers import save_assessment


def test_clarification_revision_idempotency_staleness_and_owner_scope(database, tmp_path):
    with workspace(database, tmp_path) as (client, data, app):
        created = submit(client, {'text': 'Tea for office workers.'}).json()
        save_assessment(database, UUID(created['submission_id']), UUID(created['revision_id']))
        with database.transaction() as c:
            c.execute("UPDATE public.processing_jobs SET status='completed' WHERE id=%s", (created['job_id'],))
        path = '/v1/submissions/' + created['submission_id']
        questions = client.get(path + '/questions').json()
        assert 'offer' not in [q['field'] for q in questions]
        assert 'investment' in [q['field'] for q in questions]
        assert len(questions) == 3
        assert [q['field'] for q in questions] == ['location', 'investment', 'unit_price']
        body = {'expected_revision_id': created['revision_id'], 'answers': {'investment': 'INR 20000 once'}}
        key = {'Idempotency-Key': str(uuid4())}
        first = client.post(path + '/clarifications', json=body, headers=key)
        assert first.status_code == 202, first.text
        assert client.post(path + '/clarifications', json=body, headers=key).json() == first.json()
        assert client.post(path + '/clarifications', json=body, headers={'Idempotency-Key': str(uuid4())}).status_code == 409
        revisions = client.get(path + '/history').json()
        assert [r['revision_number'] for r in revisions] == [2, 1]
        assert revisions[0]['parent_revision_id'] == created['revision_id']
        assert client.get(path + '/assessment').status_code == 404
        with database.transaction() as c:
            original = c.execute('SELECT source_text FROM public.submission_versions WHERE id=%s', (created['revision_id'],)).fetchone()
            assert original['source_text'] == 'Tea for office workers.'
        app.dependency_overrides[require_actor] = lambda: ActorView(id=data['people'][1], role='applicant', cohorts=[])
        assert client.get(path + '/questions').status_code == 404
        assert client.get(path + '/history').status_code == 404
        assert client.post(path + '/clarifications', json=body, headers=key).status_code == 404
