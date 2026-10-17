from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import HTTPException
from psycopg import Connection
from psycopg.rows import DictRow
from psycopg.types.json import Jsonb

from ..contracts.models import Assessment
from ..contracts.pipeline import AssessmentBundle, StructuredBundle
from ..domain.relevance import baseline_label
from ..domain.scoring import summarize
from ..repositories.idempotency import canonical_hash
from ..worker.manifest import MANIFEST, MANIFEST_HASH
from .assessment_rules import domain_facts, validate_ratings


def persist_assessment_stage(c: Connection[DictRow],stage: DictRow,job: DictRow,payload: dict[str,Any]) -> None:
    if job['pipeline_version']!='screening-v1' or stage['stage_key']!='assess':
        return
    try:
        output=AssessmentBundle.model_validate(payload)
        if (output.model_id,output.model_revision)!=(MANIFEST['qwen']['id'],MANIFEST['qwen']['revision']):
            raise ValueError('Incompatible rating model')
        prior=c.execute('''SELECT p.payload,p.model_manifest_hash FROM public.stage_publications p
            JOIN public.job_stages st ON st.id=p.stage_id WHERE st.job_id=%s AND st.stage_key='structure' ''',(job['id'],)).fetchone()
        if not prior or prior['model_manifest_hash']!=MANIFEST_HASH:
            raise ValueError('No compatible structured publication')
        bundle=StructuredBundle.model_validate(prior['payload'])
        record=c.execute('''SELECT payload FROM public.business_records
            WHERE input_revision_id=%s AND pipeline_version=%s AND model_manifest_hash=%s''',
            (job['input_revision_id'],job['pipeline_version'],MANIFEST_HASH)).fetchone()
        if not record or canonical_hash(record['payload'])!=canonical_hash(bundle.business.model_dump(mode='json')):
            raise ValueError('Stored business version differs')
        validate_ratings(bundle,output.domains)
        if [r.domain for r in output.relevance]!=[r.domain for r in output.domains]:
            raise ValueError('Advisory domains differ')
        for check in output.relevance:
            rating=next(r for r in output.domains if r.domain==check.domain)
            facts,_=domain_facts(bundle,check.domain)
            if bool(facts)==(check.result=='missing'):
                raise ValueError('Advisory missing status differs from usable facts')
            if check.result!='missing' and check.result!=baseline_label('business facts',check.cosine_similarity):
                raise ValueError('Advisory baseline output differs')
            if check.result=='missing' and (rating.rating is not None or check.cosine_similarity is not None):
                raise ValueError('Missing advisory with nonmissing judgment')
        # Job guard already locks the current revision. Serialize assessment
        # version allocation against future revision/review writers as well.
        c.execute('SELECT id FROM public.submissions WHERE id=%s FOR UPDATE',(job['submission_id'],))
        version=c.execute('SELECT coalesce(max(version),0)+1 AS n FROM public.assessments WHERE submission_id=%s',
                          (job['submission_id'],)).fetchone()
        assert version is not None
        source_review=any(s.kind=='pdf' and s.extraction_uncertain for s in bundle.evidence) or any(
            warning.startswith(('pdf_ocr_', 'pdf_page_', 'pdf_corrupt_')) for warning in bundle.warnings)
        scores=summarize(output.domains,bundle.business,source_review_required=source_review)
        assessment=Assessment(id=uuid4(),submission_id=job['submission_id'],input_revision_id=job['input_revision_id'],
            version=version['n'],created_at=datetime.now(timezone.utc),pipeline_version=job['pipeline_version'],
            model_manifest_hash=MANIFEST_HASH,business=bundle.business,evidence=bundle.evidence,
            domains=output.domains,scores=scores,relevance=output.relevance,
            strengths=[r.reason for r in output.domains if r.rating is not None and r.rating>=3],
            gaps=[r.domain.value+': '+r.reason for r in output.domains if r.rating is None or r.rating<=1],
            risks=['Self-reported proposal; source claims and model judgments require human verification.',
                   'Relevance baseline is advisory and has not been independently validated.']+
                  (['Source extraction/language uncertainty requires human review.'] if bundle.warnings else [])+
                  (['Scan transcriptions are unverified; inspect original pages before using these suggestions.'] if source_review else []))
        c.execute('''INSERT INTO public.assessments(id,submission_id,input_revision_id,pipeline_version,version,
            rubric_version,model_manifest_hash,payload,potential,evidence_coverage,completeness_percent,
            ranking_eligible,trade,sector,created_at) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)''',
            (assessment.id,assessment.submission_id,assessment.input_revision_id,assessment.pipeline_version,
             assessment.version,scores.rubric_version,MANIFEST_HASH,Jsonb(assessment.model_dump(mode='json')),
             scores.headline_potential,scores.evidence_coverage,scores.completeness_percent,scores.ranking_eligible,
             bundle.business.trade,bundle.business.sector,assessment.created_at))
        for rating in assessment.domains:
            c.execute('''INSERT INTO public.domain_ratings(assessment_id,domain,rating,reason,source_segment_ids)
                VALUES(%s,%s,%s,%s,%s)''',(assessment.id,rating.domain,rating.rating,rating.reason,rating.source_segment_ids))
    except (ValueError,KeyError,TypeError):
        raise HTTPException(422,'Assessment validation failed; review evidence and pipeline version') from None
