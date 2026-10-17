from typing import Literal
from uuid import UUID

from fastapi import APIRouter

from ..auth.access import ActorDep, DatabaseDep
from ..contracts.analytics import Analytics, ComparisonGroup, ComparisonView
from ..contracts.models import Trade

router = APIRouter(tags=['comparisons'])
BASE = '''WITH current AS (
    SELECT a.*,s.cohort_id,coalesce(c.name,'Personal ideas') AS cohort_name,
        (s.synthetic OR coalesce(c.synthetic,false)) AS synthetic,
        row_number() OVER(PARTITION BY coalesce(s.family_id,s.id::text)
            ORDER BY (s.synthetic OR coalesce(c.synthetic,false)),a.created_at,s.id) AS family_rank
    FROM public.assessments a JOIN public.submissions s ON s.current_revision_id=a.input_revision_id
    LEFT JOIN public.cohorts c ON c.id=s.cohort_id
    WHERE s.deleted_at IS NULL AND a.rubric_version='rubric-v1'
        AND (%s::uuid IS NULL OR s.cohort_id=%s::uuid)
        AND (%s::text IS NULL OR a.trade=%s::text)
        AND (%s::text IS NULL OR a.sector=%s::text)
), records AS (SELECT * FROM current WHERE (%s OR NOT synthetic) AND family_rank=1) '''


@router.get('/v1/analytics', response_model=Analytics)
def analytics(actor: ActorDep, database: DatabaseDep, cohort_id: UUID | None = None,
              trade: Trade | None = None,
              sector: Literal['agriculture','food_beverage','retail','services','manufacturing','other','unknown'] | None = None,
              include_synthetic: bool = False) -> Analytics:
    params = (cohort_id, cohort_id, trade.value if trade else None, trade.value if trade else None,
              sector, sector, include_synthetic)
    views = []
    with database.transaction(actor.id, read_scoped=True) as c:
        summary = c.execute(BASE + '''SELECT count(*) AS assessed_count,
            count(*) FILTER(WHERE ranking_eligible) AS eligible_count,
            (SELECT count(*) FROM current WHERE synthetic AND NOT %s) AS excluded_synthetic,
            (SELECT count(*) FROM current WHERE family_rank>1 AND (%s OR NOT synthetic)) AS excluded_repeated_family
            FROM records''', (*params, include_synthetic, include_synthetic)).fetchone()
        domain_rows = c.execute(BASE + '''SELECT d->>'domain' AS key,d->>'domain' AS label,
            bool_or(synthetic) AS synthetic,count(*) AS count,count(d->>'rating') AS rated_count,
            avg((d->>'rating')::numeric*25) AS mean_score,
            avg(completeness_percent) AS mean_completeness,avg(evidence_coverage)*100 AS mean_coverage
            FROM records CROSS JOIN LATERAL jsonb_array_elements(payload->'domains') d
            GROUP BY d->>'domain' ORDER BY d->>'domain' ''', params).fetchall()
        views.append(ComparisonView(dimension='domain', groups=[ComparisonGroup(**row, small_sample=row['count'] < 5) for row in domain_rows]))
        groupings = [('trade', 'trade', 'trade', 'trade'),
                     ('cohort', "coalesce(cohort_id::text,'personal')", 'cohort_name', 'NULL::text'),
                     ('across_cohort', "coalesce(cohort_id::text,'personal')||':'||trade", "cohort_name||' · '||replace(trade,'_',' ')", 'trade')]
        for dimension, key, label, trade_column in groupings:
            # All interpolated identifiers are fixed server constants above.
            rows = c.execute(BASE + f'''SELECT {key} AS key,{label} AS label,{trade_column} AS trade,
                bool_or(synthetic) AS synthetic,count(*) AS count,
                count(*) FILTER(WHERE ranking_eligible) AS rated_count,
                avg(potential) FILTER(WHERE ranking_eligible) AS mean_score,
                avg(completeness_percent) AS mean_completeness,avg(evidence_coverage)*100 AS mean_coverage
                FROM records GROUP BY 1,2,3 ORDER BY 2 LIMIT 200''', params).fetchall()
            views.append(ComparisonView.model_validate({'dimension': dimension,
                'groups': [ComparisonGroup(**row, small_sample=row['count'] < 5) for row in rows]}))
    return Analytics(**(summary or {}), include_synthetic=include_synthetic, views=views)
