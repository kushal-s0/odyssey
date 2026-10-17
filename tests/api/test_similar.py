from app.auth.access import ActorView, require_actor
from app.domain.similarity import PREPROCESSING, summary_hash
from app.worker.manifest import MANIFEST
from product_helpers import save_assessment
from test_submissions import workspace


def index(database, value, vector):
    with database.transaction() as c:
        c.execute('''INSERT INTO public.idea_embeddings(submission_id,input_revision_id,model_revision,
            preprocessing_version,vector,summary_hash) VALUES(%s,%s,%s,%s,%s::vector,%s)''',
            (value.submission_id, value.input_revision_id, MANIFEST['embedding']['revision'],
             PREPROCESSING, str(vector), summary_hash(value.business)))


def test_similarity_is_scoped_current_and_never_includes_itself(database, tmp_path):
    with workspace(database, tmp_path) as (client, data, app):
        a = save_assessment(database, data['submissions'][0], data['revisions'][0])
        b = save_assessment(database, data['submissions'][1], data['revisions'][1])
        path = f'/v1/submissions/{a.submission_id}/similar'
        assert client.get(path).json()['status'] == 'not_indexed'
        index(database, a, [1.] + [0.] * 383)
        index(database, b, [1.] + [0.] * 383)
        assert client.get(path).json()['items'] == []  # unauthorized candidate never disclosed
        with database.transaction() as c:
            c.execute("UPDATE public.profiles SET role='admin' WHERE id=%s", (data['people'][2],))
        app.dependency_overrides[require_actor] = lambda: ActorView(id=data['people'][2], role='admin', cohorts=[])
        result = client.get(path)
        assert result.status_code == 200, result.text
        items = result.json()['items']
        assert len(items) == 1 and items[0]['submission_id'] == str(b.submission_id)
        assert items[0]['cosine_similarity'] == 1
        assert 'Same trade: tea stall' in items[0]['shared_traits']
        with database.transaction() as c:
            c.execute("UPDATE public.submissions SET family_id='shared-family' WHERE id=ANY(%s)", (data['submissions'],))
        assert client.get(path).json()['items'] == []
        with database.transaction() as c:
            c.execute("UPDATE public.idea_embeddings SET summary_hash=%s WHERE submission_id=%s", ('b' * 64, a.submission_id))
        assert client.get(path).json()['status'] == 'not_indexed'
