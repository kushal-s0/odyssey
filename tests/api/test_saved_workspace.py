from uuid import UUID, uuid4

from app.auth.access import ActorView, require_actor
from app.services.jobs import Jobs
from product_helpers import save_assessment
from test_submissions import submit, workspace


def test_saved_workspace_is_scoped_current_revision_snapshot_without_model_work(database, tmp_path, monkeypatch):
    with workspace(database, tmp_path) as (client, data, app):
        created = submit(client, {'text': 'Tea for office workers.'}).json()
        value = save_assessment(database, UUID(created['submission_id']), UUID(created['revision_id']))
        with database.transaction() as connection:
            connection.execute("UPDATE public.processing_jobs SET status='completed' WHERE id=%s", (created['job_id'],))
        path = '/v1/submissions/' + created['submission_id']
        def forbidden_reconcile(*_):
            raise AssertionError('Opening saved data must not dispatch or reconcile model jobs')
        monkeypatch.setattr(Jobs, 'reconcile', forbidden_reconcile)
        snapshot = client.get(path + '/workspace')
        assert snapshot.status_code == 200, snapshot.text
        assert snapshot.json()['submission']['revision_id'] == str(value.input_revision_id)
        assert snapshot.json()['assessment'] == value.model_dump(mode='json')
        app.dependency_overrides[require_actor] = lambda: ActorView(id=data['people'][1], role='applicant', cohorts=[])
        assert client.get(path + '/workspace').status_code == 404
        app.dependency_overrides.pop(require_actor)
        assert client.get(path + '/workspace').status_code == 401


def test_new_revision_never_inherits_previous_assessment_as_current(database, tmp_path):
    with workspace(database, tmp_path) as (client, _, _):
        created = submit(client, {'text': 'Tea for office workers.'}).json()
        save_assessment(database, UUID(created['submission_id']), UUID(created['revision_id']))
        with database.transaction() as connection:
            connection.execute("UPDATE public.processing_jobs SET status='completed' WHERE id=%s", (created['job_id'],))
        path = '/v1/submissions/' + created['submission_id']
        updated = client.post(path + '/clarifications', json={
            'expected_revision_id': created['revision_id'], 'answers': {'investment': 'Unknown'}},
            headers={'Idempotency-Key': str(uuid4())})
        assert updated.status_code == 202, updated.text
        snapshot = client.get(path + '/workspace').json()
        assert snapshot['submission']['revision_id'] == updated.json()['revision_id']
        assert snapshot['assessment'] is None
        assert client.get(path + '/assessment?version=1').status_code == 200
