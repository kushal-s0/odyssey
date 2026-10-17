import json
from uuid import uuid4

import httpx

from app.auth.access import ActorView, require_actor
from app.config import Settings
from app.providers.groq import ExplanationUnavailable, generate_explanation
from product_helpers import save_assessment
from test_contracts import assessment
from test_submissions import workspace


def test_explanation_cache_fallback_scope_and_stale_assessment(database, tmp_path):
    with workspace(database, tmp_path) as (client, data, app):
        value = save_assessment(database, data['submissions'][0], data['revisions'][0])
        path = f'/v1/submissions/{value.submission_id}/explanation'
        result = client.get(path)
        assert result.status_code == 200, result.text
        assert result.json()['provider'] == 'rule_based' and result.json()['status'] == 'not_configured'
        assert client.post(path, json={'expected_assessment_id': str(value.id)}).json()['status'] == 'not_configured'
        assert client.post(path, json={'expected_assessment_id': str(uuid4())}).status_code == 409
        app.dependency_overrides[require_actor] = lambda: ActorView(id=data['people'][1], role='applicant', cohorts=[])
        assert client.get(path).status_code == 404


def test_groq_uses_server_key_and_validates_citations_numbers_and_quota(monkeypatch):
    value = assessment()
    draft = {'summary': 'This offer has a defined customer group; validate demand before making decisions.',
        'domain_notes': [{'domain': d.domain.value, 'explanation': 'The supplied offer supports a provisional interpretation.',
                          'evidence_fields': ['offer']} for d in value.domains],
        'next_steps': [{'action': 'Ask potential customers about demand.', 'evidence_fields': ['market_research']}]}
    seen = []
    def post(self, url, **kwargs):
        seen.append(kwargs)
        return httpx.Response(200, json={'choices': [{'finish_reason': 'stop', 'message': {'content': json.dumps(draft)}}]})
    monkeypatch.setattr(httpx.Client, 'post', post)
    config = Settings(_env_file=None, groq_api_key='synthetic-key')
    result = generate_explanation(value, config, 'en')
    assert result.provider == 'groq' and result.assessment_id == value.id
    assert seen[0]['headers']['Authorization'] == 'Bearer synthetic-key'
    assert 'original_text' not in seen[0]['json']['messages'][1]['content']
    draft['domain_notes'][0]['evidence_fields'] = ['investment']
    import pytest
    with pytest.raises(ExplanationUnavailable):
        generate_explanation(value, config, 'en')
    draft['domain_notes'][0]['evidence_fields'] = ['offer']
    draft['summary'] = 'Guaranteed revenue 99999999'
    with pytest.raises(ExplanationUnavailable):
        generate_explanation(value, config, 'en')
    monkeypatch.setattr(httpx.Client, 'post', lambda *a, **kw: httpx.Response(429))
    with pytest.raises(ExplanationUnavailable) as error:
        generate_explanation(value, config, 'en')
    assert error.value.quota


def test_explanation_provider_result_is_cached_and_scores_unchanged(database, tmp_path, monkeypatch):
    from app.routes.explanations import fallback
    calls = []
    def generate(value, settings, language):
        calls.append(language)
        return fallback(value, 'ready').model_copy(update={'provider': 'groq', 'model': settings.groq_model})
    monkeypatch.setattr('app.routes.explanations.generate_explanation', generate)
    with workspace(database, tmp_path, groq_api_key='synthetic-key') as (client, data, app):
        value = save_assessment(database, data['submissions'][0], data['revisions'][0])
        path = f'/v1/submissions/{value.submission_id}/explanation'
        first = client.post(path, json={'expected_assessment_id': str(value.id)})
        assert first.status_code == 200, first.text
        assert client.post(path, json={'expected_assessment_id': str(value.id)}).json() == first.json()
        assert calls == ['en']
        saved = client.get(f'/v1/submissions/{value.submission_id}/assessment').json()
        assert saved['scores'] == value.scores.model_dump(mode='json')
