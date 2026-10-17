"""Inventory supplied archives; optionally extract safely. Does not train models or upload data."""
from pathlib import Path
import argparse, hashlib, json, re, zipfile

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--extract', action='store_true')
args = parser.parse_args()
source = root / 'AI solution for business solutions'
destination = root / 'data' / 'extracted'
records = []
for archive in sorted(source.glob('*.zip')):
    with zipfile.ZipFile(archive) as z:
        for info in z.infolist():
            if info.is_dir():
                continue
            path = Path(info.filename)
            if path.suffix.lower() not in {'.pdf', '.mp4', '.ogg', '.wav', '.mp3', '.m4a'}:
                continue
            data = z.read(info)
            digest = hashlib.sha256(data).hexdigest()
            language = info.filename.split('/')[1].strip().replace('Telegu', 'Telugu')
            target = destination / f'{digest[:16]}{path.suffix.lower()}'
            if args.extract:
                destination.mkdir(parents=True, exist_ok=True)
                target.write_bytes(data)
            records.append({'id': digest[:16], 'archive': archive.name, 'sourcePath': info.filename, 'path': str(target.relative_to(root)).replace('\\', '/'), 'language': language, 'inputType': 'pdf' if path.suffix.lower()=='.pdf' else 'audio', 'bytes': len(data), 'sha256': digest, 'sourceFamily': None, 'groupReviewed': False, 'label': None})
(root / 'data').mkdir(exist_ok=True)
(root / 'data' / 'manifest.json').write_text(json.dumps({'description':'Supplied files only. Filenames are not training labels. Review scenario families before evaluation.', 'records':records}, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'files':len(records), 'pdfs':sum(r['inputType']=='pdf' for r in records), 'recordings':sum(r['inputType']=='audio' for r in records), 'extracted':args.extract, 'manifest':'data/manifest.json'}))
