from datetime import datetime, timezone
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from psycopg.types.json import Jsonb

from ..auth.access import ActorDep, DatabaseDep
from ..contracts.explanations import DomainExplanation, Explanation, ExplanationRequest, NextStep
from ..contracts.models import Assessment
from ..domain.questions import questions
from ..providers.groq import POLICY, ExplanationUnavailable, generate_explanation
from ..services.limits import take_limit
from .assessments import assessment

router = APIRouter(tags=['explanations'])


def fallback(value: Assessment, status: Literal['ready','not_configured','unavailable','quota_limited']) -> Explanation:
    summary = ('This idea needs clarification before a headline potential score can be used. ' if value.scores.needs_clarification
               else 'This is a provisional first-level assessment of the supplied business idea. ')
    summary += 'Potential reflects the assessed business dimensions. Completeness measures supplied details; evidence coverage measures which dimensions can be assessed. These are separate measures.'
    prompts = questions(value.business, value.input_revision_id,
        excluded_fields=frozenset(value.scores.excluded_fields))
    return Explanation(assessment_id=value.id, provider='rule_based', status=status, generated_at=datetime.now(timezone.utc),
        summary=summary, domain_notes=[DomainExplanation(domain=d.domain, explanation=d.reason) for d in value.domains],
        next_steps=[NextStep.model_validate({'action':q.question, 'evidence_fields':[q.field]}) for q in prompts] or [NextStep(action='Review the original evidence with your assessor and validate the demand and cost assumptions.')],
        note='Explanation from saved assessment rules. Optional Groq generation is ' + ('available on request.' if status == 'ready' else
            'not configured.' if status == 'not_configured' else 'rate limited; saved results remain available.' if status == 'quota_limited' else 'temporarily unavailable; saved results remain available.'))


@router.get('/v1/submissions/{submission_id}/explanation', response_model=Explanation)
def explanation(submission_id: UUID, request: Request, actor: ActorDep, database: DatabaseDep,
                language: Literal['en','hi'] = 'en') -> Explanation:
    value = assessment(submission_id, actor, database)
    settings = request.app.state.settings
    variant = f'{POLICY}:{settings.groq_model}:{language}'
    with database.transaction(actor.id, read_scoped=True) as c:
        cached = c.execute('''SELECT payload FROM public.feature_cache WHERE assessment_id=%s
            AND feature='explanation' AND variant=%s AND status='ready' AND expires_at>now()''', (value.id, variant)).fetchone()
    if cached:
        return Explanation.model_validate(cached['payload'])
    configured = settings.groq_enabled and settings.groq_api_key and settings.groq_api_key.get_secret_value()
    return fallback(value, 'ready' if configured else 'not_configured')


@router.post('/v1/submissions/{submission_id}/explanation', response_model=Explanation)
def explain(submission_id: UUID, payload: ExplanationRequest, request: Request, actor: ActorDep, database: DatabaseDep) -> Explanation:
    value = assessment(submission_id, actor, database)
    if value.id != payload.expected_assessment_id:
        raise HTTPException(409, 'A newer assessment is available. Refresh before requesting an explanation.')
    existing = explanation(submission_id, request, actor, database, payload.language)
    if existing.provider == 'groq' or existing.status == 'not_configured':
        return existing
    settings = request.app.state.settings
    variant = f'{POLICY}:{settings.groq_model}:{payload.language}'
    with database.transaction() as c:
        reserved = c.execute('''INSERT INTO public.feature_cache(assessment_id,submission_id,feature,variant,status,expires_at)
            VALUES(%s,%s,'explanation',%s,'pending',now()+interval '30 seconds')
            ON CONFLICT(assessment_id,feature,variant) DO UPDATE SET status='pending',payload=NULL,
                expires_at=now()+interval '30 seconds' WHERE feature_cache.expires_at<=now()
            RETURNING assessment_id''', (value.id, submission_id, variant)).fetchone()
    if not reserved:
        raise HTTPException(409, 'An explanation is already being prepared. Retry shortly.')
    try:
        take_limit(database, 'groq:user:' + str(actor.id), settings.groq_daily_requests_per_user, 86400)
        take_limit(database, 'groq:global', 20, 60)
        result = generate_explanation(value, settings, payload.language)
    except HTTPException:
        result = fallback(value, 'quota_limited')
    except ExplanationUnavailable as error:
        result = fallback(value, 'quota_limited' if error.quota else 'unavailable')
    with database.transaction() as c:
        c.execute('''UPDATE public.feature_cache SET status='ready',payload=%s,
            expires_at=now()+make_interval(secs=>%s) WHERE assessment_id=%s AND feature='explanation' AND variant=%s''',
            (Jsonb(result.model_dump(mode='json')), 604800 if result.provider == 'groq' else 30, value.id, variant))
    return result
