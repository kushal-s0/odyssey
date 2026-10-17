from uuid import uuid4

from app.auth.access import ActorView, CohortAccess, require_actor
from test_submissions import workspace
from product_helpers import save_assessment


def test_queue_review_and_correction_preserve_cohort_scope_and_history(database, tmp_path):
    with workspace(database, tmp_path) as (client, data, app):
        submission, revision = data['submissions'][0], data['revisions'][0]
        save_assessment(database, submission, revision)
        assert client.get('/v1/review-queue').status_code == 403
        body = {'expected_revision_id': str(revision), 'outcome': 'reviewed', 'reason': 'Offer checked against the original.'}
        path = f'/v1/submissions/{submission}/reviews'
        assert client.post(path, json=body, headers={'Idempotency-Key': str(uuid4())}).status_code == 403
        app.dependency_overrides[require_actor] = lambda: ActorView(id=data['people'][2], role='assessor',
            cohorts=[CohortAccess(id=data['cohorts'][0], name='Synthetic', role='assessor')])
        page = client.get('/v1/review-queue').json()
        assert page['total'] == 1 and page['items'][0]['id'] == str(submission)
        assert client.get('/v1/review-queue?cohort_id=' + str(data['cohorts'][1])).json()['total'] == 0
        key = {'Idempotency-Key': str(uuid4())}
        first = client.post(path, json=body, headers=key)
        assert first.status_code == 201, first.text
        assert client.post(path, json=body, headers=key).json() == first.json()
        assert client.get('/v1/review-queue?unreviewed=true').json()['total'] == 0
        body['correction_text'] = 'The original says Tea for office workers. Verify the supplied offer.'
        corrected = client.post(path, json=body, headers={'Idempotency-Key': str(uuid4())})
        assert corrected.status_code == 201, corrected.text
        assert corrected.json()['correction_revision_id']
        assert client.post(path, json=body, headers={'Idempotency-Key': str(uuid4())}).status_code == 409
        assert len(client.get(path).json()) == 2
        assert len(client.get(f'/v1/submissions/{submission}/history').json()) == 2
        assert client.get(f'/v1/submissions/{submission}/assessment').status_code == 404
        app.dependency_overrides[require_actor] = lambda: ActorView(id=data['people'][3], role='assessor', cohorts=[])
        assert client.get(path).status_code == 404


def test_only_trusted_reviewer_can_replace_a_verified_transcript(database,tmp_path):
    with workspace(database,tmp_path) as (client,data,app):
        submission,revision = data['submissions'][0],data['revisions'][0]
        save_assessment(database,submission,revision)
        app.dependency_overrides[require_actor] = lambda: ActorView(id=data['people'][2],role='assessor',
            cohorts=[CohortAccess(id=data['cohorts'][0],name='Synthetic',role='assessor')])
        path = f'/v1/submissions/{submission}/reviews'
        body = {'expected_revision_id':str(revision),'outcome':'reviewed','reason':'Complete source checked against original.',
                'correction_text':'Tea for office workers. The corrected unit price is INR 12 per cup.',
                'replace_transcript':True}
        assert client.post(path,json=body,headers={'Idempotency-Key':str(uuid4())}).status_code == 422
        body['source_verified'] = True
        result = client.post(path,json=body,headers={'Idempotency-Key':str(uuid4())})
        assert result.status_code == 201,result.text
        with database.transaction() as c:
            changed = c.execute('SELECT source_text FROM public.submission_versions WHERE id=%s',
                                (result.json()['correction_revision_id'],)).fetchone()
            assert 'Synthetic DB test' not in changed['source_text']
            assert body['correction_text'] in changed['source_text']
            event = c.execute("SELECT safe_metadata FROM public.audit_events WHERE resource_id=%s AND event_type='source_transcript_verified'",
                              (revision,)).fetchone()
            assert event['safe_metadata']['correction_revision_id'] == result.json()['correction_revision_id']
