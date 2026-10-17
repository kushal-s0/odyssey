"""Two real optional Groq requests with synthetic business data; no database access."""
# ruff: noqa: E402
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'apps/api'))
from app.config import get_settings
from app.contracts.models import Assessment, BusinessRecord, Domain, DomainRating, EvidenceField, TextEvidence
from app.domain.scoring import summarize
from app.providers.groq import ExplanationUnavailable, generate_explanation


def main():
    settings = get_settings()
    if not settings.groq_enabled or not settings.groq_api_key:
        raise SystemExit('Optional Groq is not configured; no request sent.')
    submission, revision, segment = uuid4(), uuid4(), uuid4()
    business = BusinessRecord(
        offer=EvidenceField[str](value='Tea', status='present', source_segment_ids=[segment]),
        target_customers=EvidenceField[str](value='Office workers', status='present', source_segment_ids=[segment]))
    domains = [DomainRating(domain=d, rating=2 if d == Domain.clarity else None,
        reason='Offer and customers supplied.' if d == Domain.clarity else 'Insufficient evidence.',
        basis='self_reported' if d == Domain.clarity else 'insufficient',
        source_segment_ids=[segment] if d == Domain.clarity else []) for d in Domain]
    value = Assessment(id=uuid4(), submission_id=submission, input_revision_id=revision, version=1,
        created_at=datetime.now(timezone.utc), pipeline_version='synthetic-provider-check', model_manifest_hash='a'*64,
        business=business, domains=domains, scores=summarize(domains,business), evidence=[TextEvidence(
            id=segment,submission_id=submission,input_revision_id=revision,original_text='Tea for office workers.',
            start_character=0,end_character=23)])
    before = value.model_dump_json()
    results = []
    for language in ('en','hi'):
        started = time.perf_counter()
        try:
            result = generate_explanation(value, settings, language)
            assert len(result.domain_notes) == 6
            assert value.model_dump_json() == before
            if language == 'hi':
                assert any('\u0900' <= c <= '\u097f' for c in result.summary)
            results.append({'language':language,'passed':True,'seconds':round(time.perf_counter()-started,3),
                'summary':result.summary,'domain_count':len(result.domain_notes),'scores_unchanged':True})
        except (ExplanationUnavailable, AssertionError) as error:
            results.append({'language':language,'passed':False,'seconds':round(time.perf_counter()-started,3),
                'error_type':type(error).__name__,'reason':getattr(error,'reason','unknown'),
                'quota_limited':getattr(error,'quota',False)})
    report={'scope':'Actual configured Groq provider; synthetic business data only; no applicant/DB records sent',
        'model':settings.groq_model,'results':results,'human_validated':False,'deployed':False,
        'passed':all(r['passed'] for r in results)}
    (ROOT/'evals/reports/groq-live-synthetic.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({**report,'results':[{k:v for k,v in r.items() if k != 'summary'} for r in results]}))
    raise SystemExit(0 if report['passed'] else 1)


if __name__ == '__main__':
    main()
