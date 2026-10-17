from uuid import UUID

from fastapi import APIRouter

from ..auth.access import ActorDep, DatabaseDep, submission_access
from ..contracts.models import Assessment
from ..contracts.similar import SimilarIdea, SimilarResults
from ..domain.similarity import PREPROCESSING, summary_hash
from ..worker.manifest import MANIFEST

router = APIRouter(tags=['similar ideas'])


@router.get('/v1/submissions/{submission_id}/similar', response_model=SimilarResults)
def similar(submission_id: UUID, actor: ActorDep, database: DatabaseDep) -> SimilarResults:
    submission = submission_access(database, actor, submission_id)
    artifact = MANIFEST['embedding']
    with database.transaction(actor.id, read_scoped=True) as c:
        source = c.execute('''SELECT e.summary_hash,a.payload FROM public.idea_embeddings e
            JOIN public.assessments a ON a.input_revision_id=e.input_revision_id
            WHERE e.submission_id=%s AND e.input_revision_id=%s AND e.model_revision=%s
            AND e.preprocessing_version=%s''',
            (submission_id, submission['current_revision_id'], artifact['revision'], PREPROCESSING)).fetchone()
        if not source or summary_hash(Assessment.model_validate(source['payload']).business) != source['summary_hash']:
            return SimilarResults(status='not_indexed', model=artifact['id'], preprocessing=PREPROCESSING, items=[])
        # RLS scopes both embeddings and assessments BEFORE ordering/limiting.
        # At most one representative per scenario family, never the source family.
        rows = c.execute('''WITH candidates AS (
            SELECT s.id,s.synthetic,s.family_id,a.payload,1-(e.vector <=> origin.vector) AS similarity,
                row_number() OVER(PARTITION BY coalesce(s.family_id,s.id::text)
                    ORDER BY e.vector <=> origin.vector,s.id) AS family_rank
            FROM public.idea_embeddings e JOIN public.submissions s ON s.id=e.submission_id
            JOIN public.assessments a ON a.input_revision_id=e.input_revision_id
            JOIN public.idea_embeddings origin ON origin.submission_id=%s
                AND origin.model_revision=%s AND origin.preprocessing_version=%s
            JOIN public.submissions source ON source.id=origin.submission_id
            WHERE e.model_revision=origin.model_revision AND e.preprocessing_version=origin.preprocessing_version
                AND e.input_revision_id=s.current_revision_id AND s.deleted_at IS NULL AND s.id<>origin.submission_id
                AND (source.family_id IS NULL OR s.family_id IS DISTINCT FROM source.family_id)
        ) SELECT * FROM candidates WHERE family_rank=1 ORDER BY similarity DESC,id LIMIT 5''',
            (submission_id, artifact['revision'], PREPROCESSING)).fetchall()
    business = Assessment.model_validate(source['payload']).business
    items = []
    for row in rows:
        candidate = Assessment.model_validate(row['payload']).business
        shared, differences = [], []
        if candidate.trade == business.trade and business.trade not in {'unknown', 'other'}:
            shared.append('Same trade: ' + business.trade.value.replace('_', ' '))
        if candidate.sector == business.sector and business.sector != 'unknown':
            shared.append('Same sector: ' + business.sector.replace('_', ' '))
        for name, label in [('offer', 'Offer'), ('target_customers', 'Customers'), ('problem', 'Customer need')]:
            left, right = getattr(business, name).value, getattr(candidate, name).value
            if left and right:
                if str(left).casefold() == str(right).casefold():
                    shared.append(label + ': ' + str(right))
                else:
                    differences.append(label + ' in this idea: ' + str(right))
        items.append(SimilarIdea(submission_id=row['id'], title=candidate.offer.value or 'Related idea',
            customers=candidate.target_customers.value, trade=candidate.trade,
            cosine_similarity=round(float(row['similarity']), 4), shared_traits=shared,
            differences=differences, synthetic=row['synthetic']))
    return SimilarResults(status='ready', model=artifact['id'], preprocessing=PREPROCESSING, items=items)
