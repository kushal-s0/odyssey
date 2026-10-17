"""Measure actual owned translation/speech; private audio transcripts stay ignored.

Run with .venv-model Python. No public dataset/provider load tests or uploads.
"""
# ruff: noqa: E402
import argparse
import hashlib
import json
import os
import sys
import time
import zipfile
from pathlib import Path
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'apps/api'))
os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['TRANSFORMERS_OFFLINE'] = '1'
from app.providers.translation import LocalTranslator
from app.providers.speech import LocalSpeech
from app.pipeline.audio import decode, audio_chunks
from app.pipeline.normalize import numeric_tokens
from app.worker.manifest import MANIFEST


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--case',choices=['translation','speech','speech_odia','audio-fixtures'],required=True)
    args = parser.parse_args()
    directory = ROOT/'.local'/('language-model-check-' + uuid4().hex)
    directory.mkdir(parents=True)
    report = {'scope':'Actual owned local model inference; no population accuracy or human validation claim',
              'case':args.case,'human_validated':False,'deployed':False}
    started = time.perf_counter()
    try:
        import numpy as np
        if args.case == 'translation':
            source = 'मैं कार्यालय के कर्मचारियों को चाय बेचता हूँ। एक कप चाय की कीमत 10 रुपये है।'
            model = LocalTranslator()
            translated = model.translate(source,'hi')
            report.update(model=MANIFEST['translation'],synthetic_source=source,english=translated,
                numbers_preserved=sorted(numeric_tokens(source))==sorted(numeric_tokens(translated)),
                smoke_terms_present=all(term in translated.lower() for term in ['tea','10']))
            assert report['numbers_preserved'] and report['smoke_terms_present']
        elif args.case == 'audio-fixtures':
            samples = np.zeros(16000*65,dtype=np.float32)
            parts = list(audio_chunks(samples))
            assert parts[0][0] == 0 and parts[-1][1] == len(samples)
            assert all(a[1] == b[0] for a,b in zip(parts,parts[1:]))
            assert all(0 < stop-start <= 28*16000 for start,stop in parts)
            report.update(chunks=len(parts),contiguous=True,nonoverlapping=True)
        else:
            preferred='or' if args.case=='speech_odia' else 'hi'
            inventory = json.loads((ROOT/'.local/inventory-repeat.private.json').read_text(encoding='utf-8'))
            records = [r for r in inventory['records'] if (r.get('declared_folder_language')==preferred or
                       (any(term in r['entry_path'].lower() for term in ('odia', 'oriya', 'odiya')) if preferred=='or' else '/hindi ' in r['entry_path'].lower()))
                       and r['entry_path'].lower().endswith(('.mp4','.ogg','.wav','.mp3'))]
            if not records:
                raise ValueError('No private audio sample found for the selected language')
            record = min(records,key=lambda r:r.get('bytes',10**12))
            with zipfile.ZipFile(ROOT/record['archive_path']) as archive:
                content = archive.read(record['entry_path'])
            source = directory/'private-audio'
            source.write_bytes(content)
            samples = decode(source)
            start,stop = next(audio_chunks(samples, 10 if preferred == 'or' else 28))
            model = LocalSpeech(preferred)
            transcript,language = model.transcribe(samples[start:stop],preferred)
            assert transcript.strip()
            if preferred=='or':
                assert any('\u0b00' <= char <= '\u0b7f' for char in transcript)
            (directory/f'transcript-{preferred}.private.txt').write_text(transcript,encoding='utf-8')
            report.update(model=MANIFEST['speech_odia'] if preferred=='or' else MANIFEST['speech'],original_sha256=hashlib.sha256(content).hexdigest(),
                sample_start_seconds=start/16000,sample_end_seconds=stop/16000,
                transcript_characters=len(transcript),language=language.model_dump(mode='json'),
                transcript_review='Private transcript retained under .local; no human reference/WER measured')
        import torch
        report.update(status='passed',seconds=round(time.perf_counter()-started,3),
            gpu=torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
            peak_vram_bytes=torch.cuda.max_memory_allocated() if torch.cuda.is_available() else 0)
    except Exception as error:
        import traceback
        (directory/'error.private.txt').write_text(traceback.format_exc(),encoding='utf-8')
        report.update(status='failed',error_type=type(error).__name__,seconds=round(time.perf_counter()-started,3))
    target = ROOT/'evals/reports'/('owned-' + args.case + '.json')
    target.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({k:v for k,v in report.items() if k not in {'synthetic_source','english','original_sha256'}},ensure_ascii=True))
    if report['status'] != 'passed':
        raise SystemExit(1)


if __name__ == '__main__':
    main()
