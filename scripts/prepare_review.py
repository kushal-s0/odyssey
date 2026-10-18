"""Prepare a private offline source-review screen for all inventoried inputs."""
from __future__ import annotations

import hashlib
import json
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    public = json.loads((ROOT / 'evals/manifests/dataset.json').read_text(encoding='utf-8'))
    private = json.loads((ROOT / '.local/dataset-manifest.private.json').read_text(encoding='utf-8'))
    index = {row['id']: row for row in private['records']}
    output = ROOT / '.local/review'
    assets = output / 'sources'
    assets.mkdir(parents=True, exist_ok=True)
    rows = []
    for record in public['records']:
        original = index[record['id']]
        archive_path = (ROOT / original['archive_path']).resolve()
        if not archive_path.is_relative_to(ROOT):
            raise ValueError('Source archive must stay inside this workspace')
        with zipfile.ZipFile(archive_path) as archive:
            content = archive.read(original['entry_path'])
        if hashlib.sha256(content).hexdigest() != record['id']:
            raise ValueError('Original source checksum does not match inventory')
        filename = record['id'] + '.' + record['format']
        (assets / filename).write_bytes(content)
        rows.append({'id': record['id'], 'source': 'sources/' + filename,
                     'format': record['format'], 'folder_language_hint': record['declared_folder_language'],
                     'family_hint': record['family_hint'], 'language': '', 'family_id': '',
                     'split': 'test', 'reference': '', 'fields': {}, 'relevant_ids': [],
                     'reviewer': '', 'reviewed': False, 'notes': ''})
    # Escape script delimiters even though source text/names are deliberately absent.
    payload = json.dumps(rows, ensure_ascii=True).replace('<', '\\u003c')
    template = (ROOT / 'evals/review.html').read_text(encoding='utf-8')
    (output / 'index.html').write_text(template.replace('__ROWS__', payload), encoding='utf-8')
    (output / 'review-template.private.json').write_text(json.dumps({'schema_version': 1, 'records': rows}, indent=2) + '\n')
    print(json.dumps({'inputs': len(rows), 'checksum_verified': len(rows),
                      'review_screen': '.local/review/index.html', 'published': False}))


if __name__ == '__main__':
    main()
