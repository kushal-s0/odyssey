"""One private local configuration file; never print secret values."""
from __future__ import annotations

import argparse
import secrets
from pathlib import Path

from dotenv import dotenv_values, set_key

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = ('DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY',
            'AUTH_ISSUER', 'AUTH_JWKS_URL', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY')


def configure() -> dict[str, str | None]:
    target = ROOT / '.env.local'
    if not target.exists():
        target.write_text((ROOT / '.env.example').read_text(encoding='utf-8'), encoding='utf-8')
    values = dict(dotenv_values(target, interpolate=False))
    legacy = ROOT / 'apps/web/.env.local'
    old = dict(dotenv_values(legacy, interpolate=False)) if legacy.exists() else {}
    # Preserve configured values; migrate legacy browser settings to the canonical file.
    for key, value in old.items():
        if value and not values.get(key):
            set_key(str(target), key, value)
            values[key] = value
    defaults = {'VITE_API_BASE_URL': 'http://127.0.0.1:8000',
                'WORKER_API_URL': 'http://127.0.0.1:8000', 'WORKER_ID': 'owned-laptop'}
    project = values.get('SUPABASE_URL') or values.get('VITE_SUPABASE_URL')
    if project:
        defaults.update(SUPABASE_URL=project, VITE_SUPABASE_URL=project,
                        AUTH_ISSUER=project.rstrip('/')+'/auth/v1',
                        AUTH_JWKS_URL=project.rstrip('/')+'/auth/v1/.well-known/jwks.json')
    public_key = values.get('SUPABASE_PUBLISHABLE_KEY') or values.get('VITE_SUPABASE_PUBLISHABLE_KEY')
    if public_key:
        defaults.update(SUPABASE_PUBLISHABLE_KEY=public_key, VITE_SUPABASE_PUBLISHABLE_KEY=public_key)
    for key in ('WORKER_CREDENTIAL', 'STAGE_CAPABILITY_SIGNING_KEY'):
        if not values.get(key):
            defaults[key] = secrets.token_urlsafe(48)
    for key, value in defaults.items():
        if not values.get(key):
            set_key(str(target), key, value)
            values[key] = value
    if legacy.exists():
        current = dotenv_values(target, interpolate=False)
        # Remove the old file only when every existing nonempty value was preserved.
        if all(not value or current.get(key) == value for key, value in old.items()):
            legacy.unlink()
    return values


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Read only; list missing names, never values')
    args = parser.parse_args()
    values = dict(dotenv_values(ROOT/'.env.local', interpolate=False)) if args.check else configure()
    missing = [name for name in REQUIRED if not values.get(name)]
    print('Local configuration: root .env.local. Existing values remain private.')
    if missing:
        print('Still needed: '+', '.join(missing))
        raise SystemExit(1)
    print('Required setting names are filled; connection/account verification is separate.')


if __name__ == '__main__':
    main()
