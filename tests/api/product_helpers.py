from datetime import datetime, timezone
from uuid import uuid4

from psycopg.types.json import Jsonb

from app.contracts.models import Assessment, Domain, DomainRating, LanguageResult
from app.contracts.pipeline import ExtractionDraft
from app.domain.scoring import summarize
from app.pipeline.normalize import normalize_text
from app.pipeline.structure import assemble
from app.worker.manifest import MANIFEST_HASH


def save_assessment(database, submission, revision, text='Tea for office workers.', version=1):
    source = normalize_text(text, submission, revision, 'en',
                            lambda *_: LanguageResult(code='en', provenance='declared', needs_confirmation=False))
    for segment in source.evidence:
        segment.english_text = segment.original_text
    structured = assemble(source, [ExtractionDraft(facts=[
        {'field': 'offer', 'segment': 0, 'quote': 'Tea'},
        {'field': 'target_customers', 'segment': 0, 'quote': 'office workers'},
    ], trade='tea_stall', sector='food_beverage')])
    domains = [DomainRating(domain=d, rating=2 if d == Domain.clarity else None,
                reason='Offer and customers are supplied.' if d == Domain.clarity else 'Insufficient evidence.',
                basis='self_reported' if d == Domain.clarity else 'insufficient',
                source_segment_ids=structured.business.offer.source_segment_ids if d == Domain.clarity else []) for d in Domain]
    value = Assessment(id=uuid4(), submission_id=submission, input_revision_id=revision,
        version=version, created_at=datetime.now(timezone.utc), pipeline_version='screening-v1',
        model_manifest_hash=MANIFEST_HASH, business=structured.business, evidence=source.evidence,
        domains=domains, scores=summarize(domains, structured.business))
    with database.transaction() as c:
        c.execute('''INSERT INTO public.assessments(id,submission_id,input_revision_id,pipeline_version,version,
            rubric_version,model_manifest_hash,payload,potential,evidence_coverage,completeness_percent,
            ranking_eligible,trade,sector) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)''',
            (value.id, submission, revision, value.pipeline_version, version, value.scores.rubric_version,
             MANIFEST_HASH, Jsonb(value.model_dump(mode='json')), value.scores.headline_potential,
             value.scores.evidence_coverage, value.scores.completeness_percent, value.scores.ranking_eligible,
             value.business.trade, value.business.sector))
    return value
