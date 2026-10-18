from app.auth.access import ActorView, require_actor
from product_helpers import save_assessment
from test_submissions import workspace
from app.domain.scoring import summarize
from psycopg.types.json import Jsonb
from uuid import uuid4


def test_four_views_distinguish_partial_scores_families_and_scope(database, tmp_path):
    with workspace(database, tmp_path) as (client, data, app):
        save_assessment(database, data['submissions'][0], data['revisions'][0])
        save_assessment(database, data['submissions'][1], data['revisions'][1])
        assert client.get('/v1/analytics').json()['assessed_count'] == 0  # fixtures are synthetic
        result = client.get('/v1/analytics?include_synthetic=true')
        assert result.status_code == 200, result.text
        result = result.json()
        assert result['assessed_count'] == 1 and result['eligible_count'] == 0
        assert [v['dimension'] for v in result['views']] == ['domain','trade','cohort','across_cohort']
        domains = {g['key']: g for g in result['views'][0]['groups']}
        assert domains['clarity']['mean_score'] == 50
        assert domains['competition']['mean_score'] is None and domains['competition']['rated_count'] == 0
        assert result['views'][1]['groups'][0]['mean_score'] is None
        assert result['views'][1]['groups'][0]['small_sample']
        with database.transaction() as c:
            c.execute("UPDATE public.profiles SET role='admin' WHERE id=%s", (data['people'][2],))
            c.execute("UPDATE public.submissions SET family_id='duplicate' WHERE id=ANY(%s)", (data['submissions'],))
        app.dependency_overrides[require_actor] = lambda: ActorView(id=data['people'][2], role='admin', cohorts=[])
        result = client.get('/v1/analytics?include_synthetic=true').json()
        assert result['assessed_count'] == 1 and result['excluded_repeated_family'] == 1
        assert client.get('/v1/analytics?include_synthetic=true&trade=tailoring').json()['assessed_count'] == 0
        assert client.get('/v1/analytics?cohort_id=' + str(data['cohorts'][0]) + '&include_synthetic=true').json()['assessed_count'] == 1


def test_eligible_means_and_rubric_version_filter(database, tmp_path):
    with workspace(database,tmp_path) as (client,data,app):
        value = save_assessment(database,data['submissions'][0],data['revisions'][0])
        for domain in value.domains:
            domain.rating = 2
            domain.basis = 'self_reported'
            domain.source_segment_ids = [value.evidence[0].id]
        value.scores = summarize(value.domains,value.business)
        assert value.scores.ranking_eligible
        with database.transaction() as c:
            c.execute('UPDATE public.assessments SET payload=%s,ranking_eligible=true,potential=50,evidence_coverage=1 WHERE id=%s',
                (Jsonb(value.model_dump(mode='json')),value.id))
        result = client.get('/v1/analytics?include_synthetic=true').json()
        assert result['eligible_count'] == 1
        assert result['views'][1]['groups'][0]['mean_score'] == 50
        assert result['views'][1]['groups'][0]['rated_count'] == 1
        with database.transaction() as c:
            c.execute("UPDATE public.assessments SET rubric_version='different-rubric' WHERE id=%s",(value.id,))
        assert client.get('/v1/analytics?include_synthetic=true').json()['assessed_count'] == 0


def test_small_sample_uses_scored_denominator_not_total_records(database, tmp_path):
    with workspace(database, tmp_path) as (client, data, app):
        save_assessment(database, data['submissions'][0], data['revisions'][0])
        for _ in range(4):
            submission, revision = uuid4(), uuid4()
            data['submissions'].append(submission)  # existing fixture owns cleanup
            with database.transaction() as c:
                c.execute('''INSERT INTO public.submissions(id,owner_id,cohort_id,synthetic)
                    VALUES(%s,%s,%s,true)''', (submission, data['people'][0], data['cohorts'][0]))
                c.execute('''INSERT INTO public.submission_versions(id,submission_id,revision_number,
                    input_kind,source_text,input_hash,preferred_language,created_by)
                    VALUES(%s,%s,1,'text','Synthetic sparse record',%s,'en',%s)''',
                    (revision, submission, 'a'*64, data['people'][0]))
                c.execute('UPDATE public.submissions SET current_revision_id=%s WHERE id=%s', (revision, submission))
            value = save_assessment(database, submission, revision)
            for domain in value.domains:
                domain.rating, domain.basis, domain.source_segment_ids = None, 'insufficient', []
            value.scores = summarize(value.domains, value.business)
            with database.transaction() as c:
                c.execute('UPDATE public.assessments SET payload=%s,evidence_coverage=0 WHERE id=%s',
                    (Jsonb(value.model_dump(mode='json')), value.id))
        result = client.get('/v1/analytics?include_synthetic=true').json()
        clarity = next(group for group in result['views'][0]['groups'] if group['key'] == 'clarity')
        assert clarity['count'] == 5 and clarity['rated_count'] == 1
        assert clarity['mean_score'] == 50 and clarity['small_sample']
        assert all(group['small_sample'] for view in result['views'] for group in view['groups'])
