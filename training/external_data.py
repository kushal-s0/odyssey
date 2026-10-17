"""Download and prepare public auxiliary data. No model training or inference."""
import argparse
import collections
import hashlib
import json
import re
import urllib.request
from pathlib import Path

DATASET = 'SetFit/qnli'
REVISION = 'e08ed8239c319cf7f2d2ab393d1b90e276c39570'
BASE = f'https://huggingface.co/datasets/{DATASET}/resolve/{REVISION}'
HASHES = {
    'train': '9dc5d6276c1f71b43817377d8eb9dc3e751dd9e881b1189442c09646e554140b',
    'validation': '0a1d85bc1de1fe1fec345600a02d3329af2e3e8827c1536a6d08002463a7958d',
}
BUSINESS = re.compile(r'\b(business|entrepreneur\w*|customer\w*|market\w*|profit\w*|revenue|finance|financial|banking|loan\w*|income|expense\w*|investment\w*|economy|economic\w*|sales|retail|commerce|company|companies|industry|manufactur\w*|costs?|prices?)\b', re.I)

def normalized(text):
    return ' '.join(text.casefold().split())

def download(split, cache):
    path = cache / f'qnli-{REVISION}-{split}.jsonl'
    if not path.exists() or hashlib.sha256(path.read_bytes()).hexdigest() != HASHES[split]:
        request = urllib.request.Request(f'{BASE}/{split}.jsonl', headers={'User-Agent':'STRIVE-research-dataset-preparation/1.0'})
        temporary = path.with_suffix('.download')
        try:
            with urllib.request.urlopen(request, timeout=90) as response, temporary.open('wb') as output:
                while chunk := response.read(1024 * 1024):
                    output.write(chunk)
            if hashlib.sha256(temporary.read_bytes()).hexdigest() != HASHES[split]:
                raise ValueError(f'Unexpected {split} checksum. Dataset download was not accepted.')
            temporary.replace(path)
        finally:
            temporary.unlink(missing_ok=True)
    return [json.loads(line) for line in path.read_text(encoding='utf-8').splitlines() if line.strip()]

def convert(rows, split):
    selected = []
    seen = set()
    for row in rows:
        if row.get('label') not in (0, 1) or type(row.get('label')) is not int:
            continue
        question, answer = str(row.get('text1', '')).strip(), str(row.get('text2', '')).strip()
        if not BUSINESS.search(question) or not answer or len(answer) > 3500:
            continue
        source_label = 'entailment' if row['label'] == 0 else 'not entailment'
        if row.get('label_text') != source_label:
            raise ValueError('The pinned dataset label mapping changed. Stop and review it.')
        signature = (normalized(question), normalized(answer))
        if signature in seen:
            continue
        seen.add(signature)
        selected.append({'businessContext':'Business/economics question-answer relevance; no applicant facts.',
                         'question':question, 'answer':answer, 'label':row['label'], 'language':'en-IN',
                         'sourceDataset':DATASET, 'sourceRevision':REVISION, 'sourceSplit':split,
                         'sourceIndex':row['idx'], 'sourceLabel':row['label'], 'sourceLabelText':source_label,
                         'weakAuxiliary':True, 'sourceLicense':'Upstream SQuAD CC BY-SA 4.0',
                         'domainTerms':sorted(set(match.group(0).lower() for match in BUSINESS.finditer(question)))})
    # Questions OR answers shared by records belong to one component, even after sampling.
    parents = list(range(len(selected)))
    def root(i):
        while parents[i] != i:
            parents[i] = parents[parents[i]]
            i = parents[i]
        return i
    keys = {}
    for i, row in enumerate(selected):
        for prefix, key in [('q', row['question']), ('a', row['answer'])]:
            identity = (prefix, normalized(key))
            if identity in keys:
                parents[root(i)] = root(keys[identity])
            keys[identity] = i
    components = collections.defaultdict(list)
    for i, row in enumerate(selected):
        components[root(i)].append(hashlib.sha256((normalized(row['question'])+'\n'+normalized(row['answer'])).encode()).hexdigest())
    for i, row in enumerate(selected):
        row['groupId'] = f'qnli-{split}-' + min(components[root(i)])[:16]
    return selected

def balanced_sample(rows, maximum):
    selected = []
    per_class = min(maximum // 2, *(sum(row['label'] == label for row in rows) for label in (0, 1)))
    if per_class < 5:
        raise ValueError('Too few real labelled auxiliary examples; no fabricated pairs were substituted.')
    for label in (0, 1):
        candidates = [row for row in rows if row['label'] == label]
        candidates.sort(key=lambda row: hashlib.sha256((row['question']+'\n'+row['answer']).encode()).hexdigest())
        selected.extend(candidates[:per_class])
    return selected

def remove_overlap(rows, reference):
    questions = {normalized(row['question']) for row in reference}
    answers = {normalized(row['answer']) for row in reference}
    return [row for row in rows if normalized(row['question']) not in questions and normalized(row['answer']) not in answers]

def prepare(output='data/training', maximum=600, validation_maximum=120):
    if not 20 <= maximum <= 3000 or not 10 <= validation_maximum <= 1000:
        raise ValueError('Use 20–3000 auxiliary training rows and 10–1000 validation rows.')
    output = Path(output)
    cache = output / 'external-cache'
    cache.mkdir(parents=True, exist_ok=True)
    training_candidates = convert(download('train', cache), 'train')
    validation_candidates = convert(download('validation', cache), 'validation')
    training = balanced_sample(training_candidates, maximum)
    validation = balanced_sample(remove_overlap(validation_candidates, training_candidates), validation_maximum)
    manifest = {'dataset':DATASET, 'revision':REVISION, 'upstreamLicense':'CC BY-SA 4.0 (SQuAD)',
                'datasetCard':f'https://huggingface.co/datasets/{DATASET}/blob/{REVISION}/README.md',
                'upstreamLicenseSource':'https://rajpurkar.github.io/SQuAD-explorer/',
                'taskSource':'https://huggingface.co/datasets/nyu-mll/glue#qnli',
                'labelMeaning':{'0':'contains an answer','1':'does not contain an answer; not necessarily unrelated'},
                'auxiliaryOnly':True, 'notEntrepreneurOutcomeData':True,
                'selection':'Question-only business/economics keyword filter, deterministic balanced sample; no generated negative pairs.',
                'modifications':'Filtered, sampled, converted field names and added provenance and connected-component groups for STRIVE; 2026-10-18.',
                'files':{}}
    for split, rows, candidates in [('train',training,training_candidates),('validation',validation,validation_candidates)]:
        path = output / f'external-qnli-{split}.jsonl'
        content = ''.join(json.dumps(row,ensure_ascii=False)+'\n' for row in rows)
        path.write_bytes(content.encode('utf-8'))
        manifest['files'][split] = {'path':path.as_posix(), 'rows':len(rows), 'filteredCandidates':len(candidates),
                                   'groups':len({row['groupId'] for row in rows}), 'classCounts':dict(collections.Counter(row['label'] for row in rows)),
                                   'sourceSha256':HASHES[split], 'preparedSha256':hashlib.sha256(content.encode()).hexdigest()}
    (output/'external-data-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(manifest,indent=2))
    return training, validation, manifest

if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',default='data/training')
    parser.add_argument('--max-train',type=int,default=600)
    parser.add_argument('--max-validation',type=int,default=120)
    args=parser.parse_args()
    prepare(args.output,args.max_train,args.max_validation)
