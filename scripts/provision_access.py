"""Trusted operator setup AFTER creating the password account in Supabase Auth.

No password or service key is accepted as a command-line argument. This command
does not create accounts, send email, deploy, or enable self-registration.
"""
import argparse
import sys
from pathlib import Path
from uuid import UUID

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'apps/api'))

from app.config import Settings
from app.db.pool import Database


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--user-id', required=True, type=UUID)
    parser.add_argument('--role', required=True, choices=['applicant', 'assessor', 'admin'])
    parser.add_argument('--cohort-id', type=UUID)
    args = parser.parse_args()
    database = Database(Settings())
    try:
        database.open()
        with database.transaction() as connection:
            if not connection.execute('SELECT id FROM auth.users WHERE id=%s', (args.user_id,)).fetchone():
                raise ValueError('Create the Auth account through trusted setup first')
            connection.execute('''INSERT INTO public.profiles(id,role) VALUES(%s,%s)
                ON CONFLICT(id) DO UPDATE SET role=EXCLUDED.role''', (args.user_id, args.role))
            if args.cohort_id:
                connection.execute('''INSERT INTO public.cohort_memberships(user_id,cohort_id,role)
                    VALUES(%s,%s,%s) ON CONFLICT(user_id,cohort_id) DO UPDATE SET role=EXCLUDED.role''',
                    (args.user_id, args.cohort_id, 'assessor' if args.role == 'admin' else args.role))
            connection.execute('''INSERT INTO public.audit_events(resource_id,event_type,safe_metadata)
                VALUES(%s,'operator_access_provisioned',jsonb_build_object('role',%s::text))''',
                (args.user_id, args.role))
        print('Trusted workspace access provisioned. No credentials were printed.')
    except Exception as error:
        # Provider/DB exception messages can include connection details.
        print(f'Provisioning failed ({type(error).__name__}); verify private configuration and account/cohort IDs.')
        raise SystemExit(1) from None
    finally:
        database.close()


if __name__ == '__main__':
    main()
