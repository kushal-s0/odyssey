from __future__ import annotations

import json
import time
from threading import Lock
from uuid import UUID

import httpx
import jwt

from ..config import Settings


class AuthenticationUnavailable(Exception):
    pass


class InvalidIdentity(Exception):
    pass


class TokenVerifier:
    """Only the configured JWKS is trusted; token-provided URLs are never fetched."""

    def __init__(self, settings: Settings, transport: httpx.BaseTransport | None = None) -> None:
        self.settings = settings
        self.transport = transport
        self._keys: dict[str, jwt.PyJWK] = {}
        self._expires = 0.0
        self._last_refresh = float('-inf')
        self._lock = Lock()

    def _key(self, kid: str) -> jwt.PyJWK:
        with self._lock:
            now = time.monotonic()
            if now >= self._expires or kid not in self._keys:
                # Bound unknown-kid refreshes, including when the provider is unavailable.
                if now - self._last_refresh < 30:
                    if now >= self._expires:
                        raise AuthenticationUnavailable()
                else:
                    self._last_refresh = now
                    try:
                        with httpx.Client(timeout=5, follow_redirects=False, transport=self.transport) as client:
                            with client.stream('GET', self.settings.auth_jwks_url or '') as response:
                                response.raise_for_status()
                                raw = bytearray()
                                for chunk in response.iter_bytes(4096):
                                    raw.extend(chunk)
                                    if len(raw) > 65_536:
                                        raise ValueError('JWKS too large')
                        payload = json.loads(raw)
                        if not isinstance(payload, dict):
                            raise ValueError('Invalid JWKS')
                        keys = payload['keys']
                        if not isinstance(keys, list) or len(keys) > 20:
                            raise ValueError('Invalid JWKS')
                        parsed = {}
                        for item in keys:
                            if not isinstance(item, dict):
                                raise ValueError('Invalid key')
                            if item.get('alg') in {'RS256', 'ES256'} and item.get('use', 'sig') == 'sig':
                                key = jwt.PyJWK.from_dict(item)
                                if isinstance(key.key_id, str) and key.key_id not in parsed:
                                    parsed[key.key_id] = key
                                else:
                                    raise ValueError('Invalid key ID')
                        self._keys = parsed
                        self._expires = now + 600
                    except (httpx.HTTPError, ValueError, KeyError, TypeError, jwt.PyJWTError) as error:
                        raise AuthenticationUnavailable() from error
            selected = self._keys.get(kid)
            if selected is None:
                raise InvalidIdentity()
            return selected

    def verify(self, token: str) -> UUID:
        if not self.settings.auth_issuer or not self.settings.auth_jwks_url:
            raise AuthenticationUnavailable()
        try:
            if len(token) > 16_384 or len(token.split('.')) != 3:
                raise InvalidIdentity()
            header = jwt.get_unverified_header(token)
            if header.get('alg') not in {'RS256', 'ES256'} or header.get('crit'):
                raise InvalidIdentity()
            kid = header.get('kid')
            if not isinstance(kid, str) or not 1 <= len(kid) <= 200:
                raise InvalidIdentity()
            key = self._key(kid)
            if key.algorithm_name != header['alg']:
                raise InvalidIdentity()
            claims = jwt.decode(token, key, algorithms=['RS256', 'ES256'],
                                audience=self.settings.auth_audience, issuer=self.settings.auth_issuer,
                                options={'require': ['exp', 'iat', 'iss', 'aud', 'sub'], 'strict_aud': True})
            if any(type(claims[name]) is not int for name in ('exp', 'iat')):
                raise InvalidIdentity()
            if claims['exp'] <= claims['iat'] or claims.get('role') != 'authenticated':
                raise InvalidIdentity()
            return UUID(claims['sub'])
        except (jwt.PyJWTError, ValueError, TypeError, KeyError) as error:
            raise InvalidIdentity() from error
