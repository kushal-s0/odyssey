"""Resume only prior owner/admin-requested deletions. Dry-run unless --apply is supplied."""
# ruff: noqa: E402
import argparse
import sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'apps/api'))
from app.config import get_settings
from app.db.pool import Database
from app.services.deletion import finish_deletion


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply',action='store_true')
    parser.add_argument('--limit',type=int,default=10)
    args=parser.parse_args()
    if not 1<=args.limit<=100:
        raise SystemExit('Limit must be 1–100')
    settings=get_settings();database=Database(settings)
    try:
        database.open()
        with database.transaction() as c:
            rows=c.execute('SELECT id FROM public.submissions WHERE deleted_at IS NOT NULL ORDER BY deleted_at LIMIT %s',
                           (args.limit,)).fetchall()
        print('Previously requested pending deletions:',len(rows))
        if args.apply:
            completed=sum(finish_deletion(database,settings,row['id']) for row in rows)
            print('Completed:',completed,'; remaining batches can be retried')
    except Exception as error:
        print('Cleanup could not complete ('+type(error).__name__+'); configuration/source details suppressed.')
        raise SystemExit(1) from None
    finally:
        database.close()


if __name__=='__main__':
    main()
