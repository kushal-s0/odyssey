"""Read-only hosted verification of the specifically approved migration 007."""
# ruff: noqa: E402
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'apps/api'))
from app.config import get_settings
from app.db.pool import Database

database = Database(get_settings())
try:
    database.open()
    names = re.findall(r'CREATE INDEX IF NOT EXISTS (\w+)',
                       (ROOT / 'supabase/migrations/202610180007_revision_cleanup_indexes.sql').read_text())
    with database.transaction() as connection:
        recorded = connection.execute("SELECT version FROM public.schema_migrations WHERE version IN (%s,%s)",
            ('202610180007_revision_cleanup_indexes.sql', '202610180008_set_based_read_policies.sql')).fetchall()
        indexes = connection.execute('SELECT indexname FROM pg_indexes WHERE schemaname=%s AND indexname=ANY(%s)',
                                     ('public', names)).fetchall()
    versions = {row['version'] for row in recorded}
    present = {row['indexname'] for row in indexes}
    report = {'scope': 'Read-only configured Supabase schema; no applicant rows read',
              'migration_007_recorded': '202610180007_revision_cleanup_indexes.sql' in versions,
              'expected_indexes': len(names), 'verified_indexes': len(present),
              'migration_008_recorded': '202610180008_set_based_read_policies.sql' in versions,
              'passed': len(present) == len(names) == 12 and '202610180007_revision_cleanup_indexes.sql' in versions,
              'published': False}
    (ROOT / 'evals/reports/supabase-index-schema.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report))
    if not report['passed']:
        raise SystemExit(1)
except Exception as error:
    print('Index verification unavailable (' + type(error).__name__ + '); private settings suppressed.')
    raise SystemExit(1) from None
finally:
    database.close()
