"""Read-only checks for the explicitly approved Supabase enrichment migration.

Prints schema permission booleans only, never connection settings or user data.
"""
# ruff: noqa: E402
import json
import sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'apps/api'))
from app.config import get_settings
from app.db.pool import Database

database=Database(get_settings())
try:
    database.open()
    with database.transaction() as c:
        row=c.execute('''SELECT to_regclass('public.feature_cache') IS NOT NULL AS cache_exists,
            has_schema_privilege('authenticated','extensions','USAGE') AS vector_schema_usage,
            (SELECT relrowsecurity FROM pg_class WHERE oid='public.feature_cache'::regclass) AS cache_rls,
            has_table_privilege('authenticated','public.feature_cache','SELECT') AS scoped_cache_select,
            NOT has_table_privilege('authenticated','public.feature_cache','INSERT,UPDATE,DELETE') AS browser_writes_denied,
            EXISTS(SELECT 1 FROM public.schema_migrations WHERE version='202610180006_enrichment_cache.sql') AS migration_recorded''').fetchone()
    passed=bool(row and all(row.values()))
    report={'scope':'Read-only actual configured Supabase schema/permission verification after explicit migration approval',
        'checks':row,'passed':passed,'user_data_read':False,'published':False}
    (ROOT/'evals/reports/supabase-enrichment-schema.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report))
    if not passed:
        raise SystemExit(1)
except Exception as error:
    print('Schema verification unavailable (' + type(error).__name__ + '); private configuration suppressed.')
    raise SystemExit(1) from None
finally:
    database.close()
