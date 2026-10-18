"""Evaluate human-reviewed private references without publishing source or predictions.

Predictions: {"records":[{"id":"source sha256","transcript":"...","fields":{},"retrieved_ids":[]}]}
Only explicitly reviewed English/Hindi labels are eligible until reviewer coverage changes.
"""
from __future__ import annotations

import argparse
from collections import Counter
from decimal import Decimal, InvalidOperation
import json
from pathlib import Path
import unicodedata

ROOT = Path(__file__).resolve().parents[1]


def distance(left: list[str], right: list[str]) -> int:
    if len(left) * len(right) > 4000000:
        raise ValueError('Alignment budget exceeded; evaluate reviewed page/chunk pairs separately')
    previous = list(range(len(right) + 1))
    for i, a in enumerate(left, 1):
        current = [i]
        for j, b in enumerate(right, 1):
            current.append(min(current[-1] + 1, previous[j] + 1, previous[j - 1] + (a != b)))
        previous = current
    return previous[-1]


def normalized(value: str) -> str:
    return ' '.join(unicodedata.normalize('NFC', value).casefold().split())


def numeric(value: object) -> Decimal | None:
    if not isinstance(value, (str, int, float)) or isinstance(value, bool):
        return None
    try:
        result = Decimal(str(value))
        return result if result.is_finite() else None
    except InvalidOperation:
        return None


def by_id(rows: list[dict], allowed: set[str]) -> dict[str, dict]:
    result = {}
    for row in rows:
        identity = row['id']
        if identity not in allowed or identity in result:
            raise ValueError('Unknown or duplicate source ID')
        result[identity] = row
    return result


def evaluate(inventory: dict, labels: list[dict], predictions: list[dict]) -> dict:
    sources = inventory['records']
    allowed = {row['id'] for row in sources}
    annotations = by_id(labels, allowed)
    outputs = by_id(predictions, allowed)
    reviewed = []
    families: dict[str, str] = {}
    for row in annotations.values():
        if not row.get('reviewed'):
            continue
        if row.get('language') not in {'en', 'hi'}:
            raise ValueError('Reviewed language has no confirmed human reviewer coverage')
        if not all(isinstance(row.get(k), str) and row[k].strip() for k in ('reviewer', 'family_id', 'reference')):
            raise ValueError('Reviewed labels require reviewer, family and full reference')
        split = row.get('split')
        if split not in {'train', 'validation', 'test'}:
            raise ValueError('Reviewed labels need an explicit valid split')
        family = row['family_id']
        if family in families and families[family] != split:
            raise ValueError('Business family leaks across evaluation splits')
        families[family] = split
        if len(row['reference']) > 100000:
            raise ValueError('Reference exceeds evaluation budget')
        reviewed.append(row)
    measured = [r for r in reviewed if r['split'] == 'test' and r['id'] in outputs]
    statistics = {}
    for language in ('en', 'hi', 'mr', 'te', 'bn', 'or'):
        group = [r for r in measured if r['language'] == language]
        word_errors = word_count = char_errors = char_count = exact = field_count = numeric_exact = numeric_count = 0
        retrieved = relevant = transcript_count = 0
        for row in group:
            output = outputs[row['id']]
            if 'transcript' in output:
                reference = normalized(row['reference'])
                transcript = normalized(output['transcript'])
                if len(transcript) > 100000:
                    raise ValueError('Prediction exceeds evaluation budget')
                word_errors += distance(reference.split(), transcript.split())
                word_count += len(reference.split())
                char_errors += distance(list(reference), list(transcript))
                char_count += len(reference)
                transcript_count += 1
            for key, expected in row.get('fields', {}).items():
                actual = output.get('fields', {}).get(key)
                field_count += 1
                exact += actual == expected
                number = numeric(expected)
                if number is not None:
                    numeric_count += 1
                    numeric_exact += number == numeric(actual)
            positives = set(row.get('relevant_ids', []))
            if not positives.issubset(allowed - {row['id']}):
                raise ValueError('Relevant IDs must identify other known sources')
            if positives and 'retrieved_ids' in output:
                candidates = output['retrieved_ids'][:5]
                if len(candidates) != len(set(candidates)) or not set(candidates).issubset(allowed - {row['id']}):
                    raise ValueError('Invalid retrieval candidates')
                relevant += len(positives)
                retrieved += len(positives.intersection(candidates))
        statistics[language] = {
            'folder_hint_inputs': sum(r['declared_folder_language'] == language for r in sources),
            'reviewed_inputs': sum(r['language'] == language for r in reviewed),
            'measured_test_inputs': len(group), 'transcript_pairs': transcript_count,
            'word_errors': word_errors, 'reference_words': word_count,
            'wer': word_errors / word_count if word_count else None,
            'character_errors': char_errors, 'reference_characters': char_count,
            'cer': char_errors / char_count if char_count else None,
            'exact_fields': exact, 'labelled_fields': field_count,
            'field_exact_match': exact / field_count if field_count else None,
            'exact_numeric_fields': numeric_exact, 'labelled_numeric_fields': numeric_count,
            'numeric_exact_match': numeric_exact / numeric_count if numeric_count else None,
            'retrieved_relevant_at_5': retrieved, 'labelled_relevant': relevant,
            'recall_at_5': retrieved / relevant if relevant else None}
    return {'scope': 'Private original corpus, human-reviewed test labels only; no source text in this report',
            'inputs_accounted_for': len(sources), 'by_format': dict(Counter(r['format'] for r in sources)),
            'human_reviewer_languages': ['en', 'hi'], 'reviewed_inputs': len(reviewed),
            'family_split_verified': bool(reviewed), 'measured_test_inputs': len(measured),
            'per_language': statistics, 'population_accuracy_validated': False,
            'release_quality_gate_passed': False,
            'limitations': ['Folder language/family hints are not ground truth.',
                'No quality threshold is inferred from smoke checks or empty denominators.',
                'Ratings, evidence citations and equivalent-language fairness still require reviewed specialist labels.'],
            'deployed': False}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--annotations', type=Path, default=ROOT / '.local/review/annotations.private.json')
    parser.add_argument('--predictions', type=Path)
    args = parser.parse_args()
    inventory = json.loads((ROOT / 'evals/manifests/dataset.json').read_text(encoding='utf-8'))
    labels = json.loads(args.annotations.read_text(encoding='utf-8'))['records'] if args.annotations.exists() else []
    outputs = json.loads(args.predictions.read_text(encoding='utf-8'))['records'] if args.predictions else []
    report = evaluate(inventory, labels, outputs)
    (ROOT / 'evals/reports/corpus-evaluation.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'inputs': report['inputs_accounted_for'], 'reviewed': report['reviewed_inputs'],
                      'measured': report['measured_test_inputs'], 'quality_gate_passed': False}))


if __name__ == '__main__':
    main()
