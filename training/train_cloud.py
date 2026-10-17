"""Run in Google Colab. No training is permitted in a local runtime."""
import importlib.util
if importlib.util.find_spec('google.colab') is None:
    raise RuntimeError('Open cloud_training.ipynb in Google Colab and use a hosted runtime. Local training is disabled.')

import collections, datetime, hashlib, json, os, time
from pathlib import Path
import numpy as np
import requests
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, confusion_matrix, f1_score, recall_score
from sklearn.model_selection import StratifiedGroupKFold

FEATURE_VERSION = 'context-question-answer-v1'
EMBEDDING_MODEL = os.environ.get('GEMINI_EMBEDDING_MODEL', 'gemini-embedding-001')
DIMENSION = 768

def features(row):
    return f"Business: {row['businessContext']}\nQuestion: {row['question']}\nAnswer: {row['answer']}"[:7000]

def embedding(text, key):
    url = f'https://generativelanguage.googleapis.com/v1beta/models/{EMBEDDING_MODEL}:embedContent'
    payload = {'model': f'models/{EMBEDDING_MODEL}', 'content': {'parts': [{'text': text}]}, 'embedContentConfig': {'taskType': 'CLASSIFICATION', 'outputDimensionality': DIMENSION}}
    for attempt in range(5):
        response = requests.post(url, headers={'x-goog-api-key': key}, json=payload, timeout=60)
        if response.status_code == 429 or response.status_code >= 500:
            time.sleep(min(60, 5 * 2**attempt))
            continue
        response.raise_for_status()
        vector = np.asarray(response.json()['embedding']['values'], dtype=float)
        if len(vector) != DIMENSION or not np.isfinite(vector).all() or np.linalg.norm(vector) == 0:
            raise ValueError('Invalid embedding returned; training stopped.')
        return vector / np.linalg.norm(vector)
    raise RuntimeError('Embedding quota or provider availability prevented training. Retry later; no fake data was substituted.')

def train(path, api_key):
    rows = [json.loads(line) for line in Path(path).read_text(encoding='utf-8').splitlines() if line.strip()]
    required = ['businessContext', 'question', 'answer', 'label', 'groupId', 'language']
    for row in rows:
        if not all(key in row for key in required) or row['label'] not in [0, 1] or not str(row['groupId']).strip():
            raise ValueError('Every reviewed row needs context, question, answer, label 0/1, language, and groupId.')
        if row.get('example') or str(row.get('submissionId', '')).startswith('example-'):
            raise ValueError('Synthetic interface examples cannot be used as training evidence.')
    counts = collections.Counter(row['label'] for row in rows)
    groups = np.array([row['groupId'] for row in rows])
    if len(rows) < 20 or len(set(groups)) < 4 or min(counts.get(0, 0), counts.get(1, 0)) < 5:
        raise ValueError('Need at least 20 reviewed answers, four independent business families, and five answers in each class. Add reviewed data rather than duplicating examples.')
    seen = {}
    for row in rows:
        signature = hashlib.sha256(features(row).strip().lower().encode()).hexdigest()
        if signature in seen and seen[signature] != row['groupId']:
            raise ValueError('An identical feature record crosses business groups. Fix group assignments before training.')
        seen[signature] = row['groupId']
    data_hash = hashlib.sha256(json.dumps(rows, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    cache = Path('embedding_cache.json')
    saved = json.loads(cache.read_text()) if cache.exists() else {}
    vectors = []
    for index, row in enumerate(rows):
        key = hashlib.sha256((EMBEDDING_MODEL + FEATURE_VERSION + features(row)).encode()).hexdigest()
        if key not in saved:
            saved[key] = embedding(features(row), api_key).tolist()
            cache.write_text(json.dumps(saved))
        vectors.append(saved[key])
        if (index+1) % 10 == 0:
            print(f'Embedded {index+1}/{len(rows)} reviewed answers')
    X, y = np.asarray(vectors), np.array([row['label'] for row in rows])
    splitter = StratifiedGroupKFold(n_splits=min(5, len(set(groups))), shuffle=True, random_state=42)
    oof = np.full(len(rows), np.nan)
    folds = []
    for fold, (train_ids, test_ids) in enumerate(splitter.split(X, y, groups)):
        if len(set(y[train_ids])) < 2:
            folds.append({'fold': fold, 'skipped': 'Training partition contains only one class.'})
            continue
        assert not set(groups[train_ids]) & set(groups[test_ids])
        model = LogisticRegression(C=1.0, class_weight='balanced', max_iter=2000, random_state=42)
        model.fit(X[train_ids], y[train_ids])
        oof[test_ids] = model.predict_proba(X[test_ids])[:, 1]
        folds.append({'fold': fold, 'trainRows': len(train_ids), 'testRows': len(test_ids), 'testGroups': sorted(set(groups[test_ids]))})
    valid = np.isfinite(oof)
    if not valid.any():
        raise ValueError('No valid grouped evaluation folds. Review the label distribution across groups.')
    predicted = (oof[valid] >= 0.5).astype(int)
    metrics = {'evaluation': 'grouped out-of-fold; fixed C=1; not an independent external test', 'rows': len(rows), 'groups': len(set(groups)), 'classCounts': dict(counts), 'evaluatedRows': int(valid.sum()), 'evaluationCoverage': float(valid.mean()), 'macroF1': float(f1_score(y[valid], predicted, average='macro', zero_division=0)), 'offTopicRecall': float(recall_score(y[valid], predicted, pos_label=1, zero_division=0)), 'confusionMatrix': confusion_matrix(y[valid], predicted, labels=[0, 1]).tolist(), 'report': classification_report(y[valid], predicted, labels=[0, 1], target_names=['relevant', 'off_topic'], output_dict=True, zero_division=0), 'advisoryThreshold': 0.75, 'flagCoverage': float(np.mean(oof[valid] >= 0.75)), 'abstentionRate': float(np.mean((oof[valid] > 0.25) & (oof[valid] < 0.75))), 'folds': folds, 'languages': {}}
    for language in sorted(set(row['language'] for row in rows)):
        mask = valid & np.array([row['language'] == language for row in rows])
        metrics['languages'][language] = {'rows': int(mask.sum()), 'macroF1': float(f1_score(y[mask], (oof[mask]>=0.5).astype(int), average='macro', zero_division=0)) if mask.sum() >= 5 and len(set(y[mask])) == 2 else None}
    final = LogisticRegression(C=1.0, class_weight='balanced', max_iter=2000, random_state=42).fit(X, y)
    artifact = {'format': 'strive-relevance-v1', 'modelVersion': f'relevance-{data_hash[:12]}', 'featureVersion': FEATURE_VERSION, 'embeddingModel': EMBEDDING_MODEL, 'dimension': DIMENSION, 'coefficients': final.coef_[0].tolist(), 'intercept': float(final.intercept_[0]), 'classes': [0, 1], 'trainingDataHash': data_hash, 'trainedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'metrics': metrics, 'advisoryOnly': True}
    logits = X[:5] @ final.coef_[0] + final.intercept_[0]
    probs = 1 / (1 + np.exp(-logits))
    assert np.allclose(probs, final.predict_proba(X[:5])[:, 1])
    Path('model.json').write_text(json.dumps(artifact, indent=2), encoding='utf-8')
    Path('evaluation.json').write_text(json.dumps(metrics, indent=2), encoding='utf-8')
    Path('parity-vectors.json').write_text(json.dumps({'vectors': X[:5].tolist(), 'expectedOffTopicScores': probs.tolist()}), encoding='utf-8')
    print(json.dumps({k: metrics[k] for k in ['rows','groups','macroF1','offTopicRecall','evaluationCoverage','abstentionRate']}, indent=2))
    print('Saved actual trained model, evaluation results, and inference parity vectors. Small-data results are experimental.')
    return artifact
