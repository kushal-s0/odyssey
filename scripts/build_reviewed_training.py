"""Build JSONL from explicit source-review decisions; never trains or calls an AI API."""
import argparse
import collections
import hashlib
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def normalize(value):
    return re.sub(r'\s+', ' ', value).strip()


def build(decisions_path):
    decisions = json.loads(decisions_path.read_text(encoding='utf-8'))
    manifest = json.loads((ROOT / 'data/manifest.json').read_text(encoding='utf-8'))
    sources = {row['id']: row for row in manifest['records']}
    output = []
    seen = set()
    for reviewed in decisions['sources']:
        source = sources[reviewed['datasetId']]
        path = (ROOT / source['path']).resolve()
        if not path.is_relative_to((ROOT / 'data/extracted').resolve()):
            raise ValueError('Source must remain under data/extracted.')
        if hashlib.sha256(path.read_bytes()).hexdigest() != source['sha256']:
            raise ValueError('Source hash does not match the dataset manifest.')
        raw = subprocess.run(['pdftotext', '-raw', '-enc', 'UTF-8', str(path), '-'],
                             capture_output=True, check=True).stdout.decode('utf-8')
        pages = [normalize(page) for page in raw.split('\f') if page.strip()]
        context = normalize(reviewed['businessContext'])
        if context and not all(normalize(quote) in normalize(raw) for quote in reviewed['contextQuotes']):
            raise ValueError('Business context quotations do not match the source.')
        for decision in reviewed['answers']:
            page = pages[decision['page'] - 1]
            answer = normalize(decision['answer'])
            question = normalize(decision['questionOriginal'])
            if not answer or answer not in page or question not in page:
                raise ValueError(f"Question/answer quote failed source matching: {source['id']} / {decision['field']}")
            if type(decision['label']) is not int or decision['label'] not in (0, 1):
                raise ValueError('Every answer needs an explicit reviewed label.')
            if not decision['reason'].strip():
                raise ValueError('Every decision needs its source-review rationale.')
            if re.search(r'[\w.+-]+@[\w.-]+\.[A-Za-z]+|\b\d{10,}\b', context + ' ' + answer):
                raise ValueError('Remove contact details before using an answer for training.')
            signature = (context.lower(), decision['question'].lower(), answer.lower())
            if signature in seen:
                raise ValueError('Duplicate features must not be counted as independent answers.')
            seen.add(signature)
            output.append({
                'id': f"dataset-{source['id']}-{decision['field']}",
                'submissionId': f"dataset-{source['id']}",
                'field': decision['field'],
                'businessContext': context,
                'question': decision['question'],
                'answer': answer,
                'label': decision['label'],
                'groupId': reviewed['groupId'],
                'language': 'en-IN',
                'reviewerType': 'assistant',
                'source': {
                    'datasetId': source['id'], 'sha256': source['sha256'],
                    'page': decision['page'], 'questionQuote': question,
                    'answerQuote': answer, 'reviewReason': decision['reason'],
                },
            })
    counts = collections.Counter(row['label'] for row in output)
    grouped = {}
    for row in output:
        group = grouped.setdefault(row['groupId'], {'relevant': 0, 'offTopic': 0})
        group['offTopic' if row['label'] else 'relevant'] += 1
    if len(output) < 20 or len(grouped) < 4 or min(counts.get(0, 0), counts.get(1, 0)) < 5:
        raise ValueError('Reviewed source decisions do not meet the training minimums.')
    if any(len({row['groupId'] for row in output if row['label'] == label}) < 2 for label in (0, 1)):
        raise ValueError('Each class must span at least two source families for grouped evaluation.')
    destination = ROOT / 'data/training/reviewed-answers.jsonl'
    destination.parent.mkdir(parents=True, exist_ok=True)
    content = '\n'.join(json.dumps(row, ensure_ascii=False) for row in output) + '\n'
    destination.write_text(content, encoding='utf-8')
    summary = {
        'rows': len(output), 'groups': len(grouped), 'relevant': counts[0], 'offTopic': counts[1],
        'groupCounts': grouped, 'sourcePdfCount': len(decisions['sources']),
        'sourceQuotesChecked': True, 'externalUploads': False, 'trainingExecuted': False,
        'reviewerType': 'assistant', 'independentExpertValidation': False,
        'trainingFileSha256': hashlib.sha256(content.encode()).hexdigest(),
        'limitations': decisions['limitations'],
    }
    (ROOT / '.planning/reviewed-training-audit.json').write_text(json.dumps(summary, indent=2), encoding='utf-8')
    print(json.dumps(summary, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--decisions', type=Path, default=ROOT / '.planning/assistant-reviewed-decisions.json')
    build(parser.parse_args().decisions)
