"""Trusted operator cleanup of unattached originals older than 24 hours."""
import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'apps/api'))

from app.config import Settings
from app.db.pool import Database
from app.services.storage import configured_storage
from app.services.upload_cleanup import cleanup_abandoned


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--execute', action='store_true', help='Delete only eligible unattached objects and retire their metadata')
    args = parser.parse_args()
    if not args.execute:
        parser.error('Review the configured project and provide --execute to perform the bounded cleanup')
    settings = Settings()
    database = Database(settings)
    try:
        database.open()
        count = cleanup_abandoned(database, configured_storage(settings))
        print(f'Retired {count} abandoned uploads; attached originals were excluded.')
    except Exception as error:
        print(f'Cleanup failed ({type(error).__name__}); no provider error details printed. Retry after checking private configuration.')
        raise SystemExit(1) from None
    finally:
        database.close()


if __name__ == '__main__':
    main()
