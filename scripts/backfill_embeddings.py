"""Index existing current assessments with the pinned owned CPU MiniLM model.

Dry-run by default. No raw source, applicant identity or service credential is
sent to a model host. New assessments are indexed by their normal worker.
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'apps/api'))

from app.config import get_settings
from app.contracts.models import Assessment
from app.db.pool import Database
from app.domain.similarity import PREPROCESSING, similarity_text, summary_hash
from app.providers.local_models import SentenceEncoder
from app.worker.manifest import MANIFEST


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--limit', type=int, default=100)
    args = parser.parse_args()
    if not 1 <= args.limit <= 1000:
        parser.error('limit must be between 1 and 1000')
    database = Database(get_settings())
    database.open()
    try:
        with database.transaction() as c:
            rows = c.execute('''SELECT a.payload FROM public.assessments a
                JOIN public.submissions s ON s.current_revision_id=a.input_revision_id
                WHERE s.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM public.idea_embeddings e
                    WHERE e.submission_id=s.id AND e.input_revision_id=a.input_revision_id
                    AND e.model_revision=%s AND e.preprocessing_version=%s) ORDER BY a.created_at LIMIT %s''',
                (MANIFEST['embedding']['revision'], PREPROCESSING, args.limit)).fetchall()
        print(f'Current assessments needing an index: {len(rows)}; apply={args.apply}')
        if not args.apply or not rows:
            return
        encoder = SentenceEncoder()
        done = 0
        for row in rows:
            value = Assessment.model_validate(row['payload'])
            text = similarity_text(value.business)
            if not text:
                continue
            vector = encoder.embed(text)
            with database.transaction() as c:
                current = c.execute('SELECT current_revision_id FROM public.submissions WHERE id=%s FOR UPDATE', (value.submission_id,)).fetchone()
                if not current or current['current_revision_id'] != value.input_revision_id:
                    continue
                c.execute('''INSERT INTO public.idea_embeddings(submission_id,input_revision_id,model_revision,
                    preprocessing_version,vector,summary_hash) VALUES(%s,%s,%s,%s,%s::vector,%s)
                    ON CONFLICT(submission_id,model_revision,preprocessing_version) DO UPDATE SET
                    input_revision_id=EXCLUDED.input_revision_id,vector=EXCLUDED.vector,
                    summary_hash=EXCLUDED.summary_hash,created_at=now()''',
                    (value.submission_id, value.input_revision_id, MANIFEST['embedding']['revision'],
                     PREPROCESSING, str(vector), summary_hash(value.business)))
                done += 1
        print(f'Indexed {done} current assessments; no source text printed.')
    finally:
        database.close()


if __name__ == '__main__':
    main()
