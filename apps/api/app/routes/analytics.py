from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Request
import hashlib
import json

from ..auth.access import ActorDep, DatabaseDep
from ..auth.scope import submission_scope
from ..contracts.analytics import Analytics, ComparisonGroup, ComparisonView
from ..contracts.models import Trade
from ..services.comparison_cache import ComparisonMemo

router = APIRouter(tags=['comparisons'])
BASE = '''WITH current AS MATERIALIZED (
    SELECT a.potential,a.completeness_percent,a.evidence_coverage,a.ranking_eligible,a.trade,
        jsonb_build_object('domains',a.payload->'domains') AS payload,s.cohort_id,coalesce(c.name,'Personal ideas') AS cohort_name,
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
def analytics(request: Request, actor: ActorDep, database: DatabaseDep, cohort_id: UUID | None = None,
              trade: Trade | None = None,
              sector: Literal['agriculture','food_beverage','retail','services','manufacturing','other','unknown'] | None = None,
              include_synthetic: bool = False) -> Analytics:
    scope,params=submission_scope(actor)
    with database.transaction(actor.id,read_scoped=True) as c:
        fingerprint=c.execute(f"""SELECT count(*) AS count,max(s.updated_at) AS revision_time,
            max(a.created_at) AS assessment_time,count(*) FILTER(WHERE a.ranking_eligible) AS eligible,
            sum(a.completeness_percent) AS completeness,sum(a.evidence_coverage) AS coverage,
            count(*) FILTER(WHERE s.synthetic) AS synthetic
            FROM public.assessments a JOIN public.submissions s ON s.current_revision_id=a.input_revision_id
            WHERE s.deleted_at IS NULL AND a.rubric_version='rubric-v1' AND {scope}""",params).fetchone()
    key=hashlib.sha256(json.dumps({'actor':actor.model_dump(mode='json'),'cohort':str(cohort_id),
        'trade':trade,'sector':sector,'synthetic':include_synthetic,'fingerprint':fingerprint},
        sort_keys=True,default=str).encode()).hexdigest()
    memo: ComparisonMemo=request.app.state.comparison_cache
    return memo.get(key,lambda: calculate_analytics(
        actor,database,cohort_id,trade,sector,include_synthetic))


def calculate_analytics(actor: ActorDep, database: DatabaseDep, cohort_id: UUID | None,
                        trade: Trade | None, sector: str | None, include_synthetic: bool) -> Analytics:
    scope,scope_params=submission_scope(actor)
    params = (*scope_params,cohort_id,cohort_id,trade.value if trade else None,trade.value if trade else None,
              sector,sector,include_synthetic)
    base=BASE.replace('WHERE s.deleted_at IS NULL',f'WHERE s.deleted_at IS NULL AND {scope}')
    groups=[]
    groupings=[('trade','trade','trade','trade'),
        ('cohort',"coalesce(cohort_id::text,'personal')",'cohort_name','NULL::text'),
        ('across_cohort',"coalesce(cohort_id::text,'personal')||':'||trade","cohort_name||' / '||replace(trade,'_',' ')",'trade')]
    for dimension,key,label,trade_column in groupings:
        groups.append(f"""'{dimension}',coalesce((SELECT jsonb_agg(to_jsonb(g)) FROM (
            SELECT {key} AS key,{label} AS label,{trade_column} AS trade,bool_or(synthetic) AS synthetic,
                count(*) AS count,count(*) FILTER(WHERE ranking_eligible) AS rated_count,
                (avg(potential) FILTER(WHERE ranking_eligible))::text AS mean_score,
                avg(completeness_percent)::text AS mean_completeness,(avg(evidence_coverage)*100)::text AS mean_coverage
            FROM records GROUP BY 1,2,3 ORDER BY 2 LIMIT 200) g),'[]'::jsonb)""")
    query=base+"""SELECT
        (SELECT jsonb_build_object('assessed_count',count(*),'eligible_count',count(*) FILTER(WHERE ranking_eligible),
            'excluded_synthetic',(SELECT count(*) FROM current WHERE synthetic AND NOT %s),
            'excluded_repeated_family',(SELECT count(*) FROM current WHERE family_rank>1 AND (%s OR NOT synthetic))) FROM records) AS summary,
        coalesce((SELECT jsonb_agg(to_jsonb(d)) FROM (
            SELECT d->>'domain' AS key,d->>'domain' AS label,bool_or(synthetic) AS synthetic,
                count(*) AS count,count(d->>'rating') AS rated_count,
                avg((d->>'rating')::numeric*25)::text AS mean_score,
                avg(completeness_percent)::text AS mean_completeness,(avg(evidence_coverage)*100)::text AS mean_coverage
            FROM records CROSS JOIN LATERAL jsonb_array_elements(payload->'domains') d
            GROUP BY d->>'domain' ORDER BY d->>'domain') d),'[]'::jsonb) AS domains,
        jsonb_build_object("""+','.join(groups)+') AS groups'
    with database.transaction(actor.id,read_scoped=True) as c:
        row=c.execute(query,(*params,include_synthetic,include_synthetic)).fetchone()
    assert row
    views=[ComparisonView(dimension='domain',groups=[ComparisonGroup(**item,small_sample=item['rated_count']<5) for item in row['domains']])]
    for dimension in ('trade','cohort','across_cohort'):
        views.append(ComparisonView.model_validate({'dimension':dimension,'groups':[
            {**item,'small_sample':item['rated_count']<5} for item in row['groups'][dimension]]}))
    return Analytics(**row['summary'],include_synthetic=include_synthetic,views=views)
