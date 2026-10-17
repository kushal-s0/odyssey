from uuid import UUID, uuid4

from psycopg.types.json import Jsonb

from app.auth.access import ActorView, require_actor
from product_helpers import save_assessment
from test_submissions import workspace


def test_versioned_reports_escape_source_and_preserve_history_and_access(database, tmp_path):
    with workspace(database, tmp_path) as (client, data, app):
        value = save_assessment(database, data['submissions'][0], data['revisions'][0])
        value.evidence[0].original_text = '<script>alert("private")</script> Tea for office workers.'
        with database.transaction() as c:
            c.execute('UPDATE public.assessments SET payload=%s WHERE id=%s', (Jsonb(value.model_dump(mode='json')), value.id))
        path = f'/v1/submissions/{value.submission_id}'
        first = client.get(path + '/report?version=1')
        assert first.status_code == 200, first.text
        assert '&lt;script&gt;' in first.text and '<script>' not in first.text
        assert 'Revenue versus operating surplus' in first.text
        assert 'No sourced local-business snapshot' in first.text
        assert "default-src 'none'" in first.headers['content-security-policy']
        changed = client.post(path + '/clarifications', json={'expected_revision_id': str(value.input_revision_id),
            'answers': {'investment': 'INR 20000 once'}}, headers={'Idempotency-Key': str(uuid4())})
        assert changed.status_code == 202, changed.text
        second = save_assessment(database, value.submission_id, UUID(changed.json()['revision_id']), version=2)
        assert client.get(path + '/assessment?version=1').json()['id'] == str(value.id)
        assert client.get(path + '/assessment?version=2').json()['id'] == str(second.id)
        assert 'Assessment version 1' in client.get(path + '/report?version=1').text
        assert 'Assessment version 2' in client.get(path + '/report?version=2').text
        assert client.get(path + '/report?version=99').status_code == 404
        app.dependency_overrides[require_actor] = lambda: ActorView(id=data['people'][1], role='applicant', cohorts=[])
        assert client.get(path + '/report?version=1').status_code == 404
        assert client.get(path + '/assessment?version=1').status_code == 404
