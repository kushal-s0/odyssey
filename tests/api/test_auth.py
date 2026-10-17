import json
import time
from contextlib import contextmanager
from uuid import uuid4

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec, rsa
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.auth.access import ActorView, resource_access, submission_access
from app.auth.jwt import AuthenticationUnavailable, InvalidIdentity, TokenVerifier
from app.config import Settings
from app.main import create_app
from test_database import ROOT, seeded


@pytest.fixture(params=['RS256', 'ES256'])
def signing(request):
    algorithm = request.param
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048) if algorithm == 'RS256' else ec.generate_private_key(ec.SECP256R1())
    implementation = jwt.algorithms.RSAAlgorithm if algorithm == 'RS256' else jwt.algorithms.ECAlgorithm
    public = json.loads(implementation.to_jwk(key.public_key()))
    public.update(kid='test-key', alg=algorithm, use='sig')
    settings = Settings(_env_file=None, app_env='test', auth_issuer='https://identity.example.test/auth/v1',
                        auth_jwks_url='https://identity.example.test/auth/v1/.well-known/jwks.json')
    calls = []
    def respond(request):
        calls.append(str(request.url))
        return httpx.Response(200, json={'keys': [public]})
    verifier = TokenVerifier(settings, httpx.MockTransport(respond))
    def token(subject=None, overrides=None, **headers):
        claims = dict(sub=str(subject or uuid4()), iss=settings.auth_issuer, aud='authenticated',
                      exp=int(time.time())+300, iat=int(time.time())-1, role='authenticated')
        claims.update(overrides or {})
        return jwt.encode(claims, key, algorithm=algorithm, headers={'kid': 'test-key', **headers})
    return settings, verifier, token, calls


def test_real_signature_and_configured_jwks_only(signing):
    _, verifier, token, calls = signing
    subject = uuid4()
    signed = token(subject, jku='https://attacker.example/keys', x5u='https://attacker.example/cert')
    assert verifier.verify(signed) == subject
    assert verifier.verify(signed) == subject
    assert calls == ['https://identity.example.test/auth/v1/.well-known/jwks.json']


@pytest.mark.parametrize('overrides', [dict(exp=1), dict(iss='https://attacker.example'),
    dict(aud='other'), dict(sub='not-a-uuid'), dict(role='service_role'), dict(exp='9999999999'),
    dict(iat=int(time.time())+300), dict(aud=['authenticated']), dict(exp=True)])
def test_invalid_signed_claims_are_rejected(signing, overrides):
    _, verifier, token, _ = signing
    with pytest.raises(InvalidIdentity):
        verifier.verify(token(overrides=overrides))


def test_tampering_and_unsigned_or_symmetric_tokens_rejected(signing):
    _, verifier, token, _ = signing
    signed = token()
    header, body, signature = signed.split('.')
    changed = f'{header}.{body}.{"A" if signature[0] != "A" else "B"}{signature[1:]}'
    for bad in [changed, jwt.encode({'sub': str(uuid4())}, '', algorithm='none'),
                jwt.encode({'sub': str(uuid4())}, 'x'*32, algorithm='HS256', headers={'kid': 'test-key'}), 'a'*17000]:
        with pytest.raises(InvalidIdentity):
            verifier.verify(bad)


def test_random_key_ids_cannot_force_unbounded_jwks_fetches(signing):
    _, verifier, token, calls = signing
    verifier.verify(token())
    for _ in range(20):
        with pytest.raises(InvalidIdentity):
            verifier.verify(token(kid=str(uuid4())))
    assert len(calls) == 1


def test_missing_or_failed_identity_provider_fails_closed(signing):
    settings, _, token, _ = signing
    with pytest.raises(AuthenticationUnavailable):
        TokenVerifier(Settings(_env_file=None)).verify(token())
    verifier = TokenVerifier(settings, httpx.MockTransport(lambda _: httpx.Response(503)))
    with pytest.raises(AuthenticationUnavailable):
        verifier.verify(token())


@contextmanager
def authenticated_client(database, signing):
    settings, verifier, token, _ = signing
    settings = Settings(**settings.model_dump(exclude={'database_url'}),
                        database_url=(ROOT / '.local/test-database-url').read_text().strip(), _env_file=None)
    app = create_app(settings)
    app.state.token_verifier = verifier
    with TestClient(app) as client:
        yield client, token


def test_api_trusts_database_role_and_two_cohort_resource_scopes(database, signing):
    with seeded(database) as data, authenticated_client(database, signing) as (client, token):
        for index, person in enumerate(data['people']):
            response = client.get('/v1/me', headers={'Authorization': 'Bearer '+token(person,
                overrides={'user_metadata': {'role': 'admin'}, 'app_metadata': {'role': 'admin'}})})
            assert response.status_code == 200
            actor = ActorView.model_validate(response.json())
            assert actor.role == ('applicant' if index < 2 else 'assessor')
            assert len(actor.cohorts) == 1
            allowed = index if index < 2 else index-2
            assert submission_access(database, actor, data['submissions'][allowed])['id'] == data['submissions'][allowed]
            with pytest.raises(HTTPException) as denied:
                submission_access(database, actor, data['submissions'][1-allowed])
            assert denied.value.status_code == 404
            if index in {0, 2}:
                assert resource_access(database, actor, 'processing_jobs', data['job'])['id'] == data['job']
            else:
                with pytest.raises(HTTPException):
                    resource_access(database, actor, 'attachments', data['attachment'])
            if index < 2:
                with pytest.raises(HTTPException):
                    submission_access(database, actor, data['submissions'][allowed], action='review')
            else:
                submission_access(database, actor, data['submissions'][allowed], action='review')
        assert client.get('/v1/me').status_code == 401
        expired = token(data['people'][0], overrides={'exp': 1})
        assert client.get('/v1/me', headers={'Authorization': 'Bearer '+expired}).status_code == 401
        assert client.get('/v1/me', headers={'Authorization': 'Bearer '+token()}).status_code == 403


def test_safe_environment_placeholders_and_production_auth_urls():
    assert Settings(_env_file=None, allow_paid_services='false').allow_paid_services is False
    for url in ['http://public.example/keys', 'https://a:b@example/keys', 'https://example/keys?secret=value']:
        with pytest.raises(ValueError):
            Settings(_env_file=None, auth_jwks_url=url)
