"""Private, conservative QA extraction. Labels/groups are machine proposals, not review."""
from __future__ import annotations

import hashlib
import io
import json
import re
import zipfile
from pathlib import Path

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
PRIVATE = ROOT / 'evals/private/relevance'
QUESTION = re.compile(r'(?m)^\s*(?:\d{1,2}[\s.)]+)?((?:What|Who|Have|Is|Do|Where|Which|How)\b[\s\S]{5,240}?\?)')
IDENTITY = re.compile(r'\b(?:my name|applicant|aadhaar|my wife|my husband|my brother|my children|two children|government school)\b', re.I)
IRRELEVANT = re.compile(r'\b(?:cricket|wickets|movie|songs|bike|weather|rain|football|match last|match by)\b', re.I)
FAMILIES = [('tea',r'\btea\b'),('tailoring',r'\bstitch|\btailor'),('dairy',r'\bdairy|\bmilk|\bcattle'),
            ('poultry',r'\bpoultry|\bchicks|\bchicken'),('beauty',r'\bparlou?r|\bcosmetics|\bfacial'),
            ('solar',r'\bsolar'),('water',r'\bpackaged water'),('bags',r'\bbag manufactur')]


def build() -> dict:
    pairs, sources = [], []
    for archive in sorted(next(ROOT.glob('AI solution*')).rglob('*.zip')):
        with zipfile.ZipFile(archive) as bundle:
            for item in sorted(bundle.namelist()):
                if not item.lower().endswith('.pdf') or '/english/' not in ('/'+item.lower()):
                    continue
                raw = bundle.read(item)
                source = hashlib.sha256(raw).hexdigest()
                text = '\n'.join(page.extract_text() or '' for page in PdfReader(io.BytesIO(raw)).pages)
                # Coarse union by business family prevents variants/translations
                # becoming independent groups. Uncertain files are pooled together.
                family = next((name for name,pattern in FAMILIES if re.search(pattern,text,re.I)), 'unreviewed-pooled')
                if family in {'tea','unreviewed-pooled'}:
                    family='tea-and-unresolved-pooled'
                sources.append({'id':source,'sha256':source,'family':family,'family_reviewed':False})
                matches = list(QUESTION.finditer(text))
                for index,match in enumerate(matches):
                    question = ' '.join(match[1].split())
                    answer = text[match.end():matches[index+1].start() if index+1<len(matches) else len(text)]
                    answer = re.sub(r'\s+',' ',answer).strip()
                    answer = re.split(r'\b(?:Name|Signature|Mobile|Phone|Beneficiary)\s*:',answer,flags=re.I)[0].strip()
                    if (not 1<=len(answer)<=700 or IDENTITY.search(question+' '+answer)
                            or re.search(r'\b(?:name|age|caste|education|gender)\b',question,re.I)
                            or '@' in answer or re.search(r'\b\d{10,12}\b',answer)):
                        continue
                    # No automatic financial-plausibility -> relevance mapping.
                    label = 'irrelevant' if IRRELEVANT.search(answer) else 'relevant'
                    pairs.append({'id':hashlib.sha256((source+str(index)).encode()).hexdigest(),
                        'source_id':source,'family_id':family,'language':'en-folder-unvalidated',
                        'question':question,'answer':answer,'label':label,
                        'label_provenance':'machine_heuristic_unreviewed','independent_review':False})
    result = {'schema_version':1,'extractor':'qa-regex-v1','group_policy':'coarse-business-family-v1',
              'sources':sources,'pairs':sorted(pairs,key=lambda p:p['id'])}
    PRIVATE.mkdir(parents=True,exist_ok=True)
    (PRIVATE/'pairs.json').write_text(json.dumps(result,ensure_ascii=False,sort_keys=True,indent=2),encoding='utf-8')
    return result


if __name__ == '__main__':
    data=build()
    print(json.dumps({'sources':len(data['sources']),'pairs':len(data['pairs']),
        'groups':len({p['family_id'] for p in data['pairs']}),'independently_reviewed':0}))
