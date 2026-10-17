"""Run only in a hosted Google Colab runtime; no local model training."""
import importlib.util
if importlib.util.find_spec('google.colab') is None:
    raise RuntimeError('Run external_cloud_training.ipynb in hosted Google Colab. Local training is disabled.')

import collections
import datetime
import hashlib
import json
import time
from pathlib import Path
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, confusion_matrix
from sklearn.model_selection import StratifiedGroupKFold
from train_cloud import check_training_file, features, embedding, EMBEDDING_MODEL, DIMENSION, FEATURE_VERSION
from external_data import prepare, remove_overlap

def evaluate_labels(labels, probabilities):
    labels, probabilities = np.asarray(labels), np.asarray(probabilities)
    valid = np.isfinite(probabilities)
    truth, scores = labels[valid], probabilities[valid]
    if not len(truth):
        raise ValueError('No valid held-out predictions; model promotion is disabled.')
    predicted, flags = (scores >= .5).astype(int), scores >= .75
    return {'rows':len(labels), 'evaluatedRows':int(valid.sum()), 'evaluationCoverage':float(valid.mean()),
            'accuracy':float(accuracy_score(truth,predicted)), 'macroF1':float(f1_score(truth,predicted,labels=[0,1],average='macro',zero_division=0)),
            'offTopicRecall':float(recall_score(truth,predicted,zero_division=0)),
            'offTopicPrecision':float(precision_score(truth,predicted,zero_division=0)),
            'confusionMatrix':confusion_matrix(truth,predicted,labels=[0,1]).tolist(),
            'flaggedRows':int(flags.sum()), 'flagCoverage':float(flags.mean()),
            'flagPrecision':float(truth[flags].mean()) if flags.any() else None,
            'abstentionRate':float(((scores>.25)&(scores<.75)).mean())}

def promotion_decision(baseline, candidate):
    checks = {
        'completeGroupedEvaluation':baseline['evaluationCoverage']==1 and candidate['evaluationCoverage']==1,
        'macroF1ImprovedByAtLeastTwoPoints':candidate['macroF1'] >= baseline['macroF1']+.02,
        'offTopicRecallNotWorse':candidate['offTopicRecall'] >= baseline['offTopicRecall'],
        'offTopicPrecisionNotWorse':candidate['offTopicPrecision'] >= baseline['offTopicPrecision'],
        'usefulHighThresholdFlags':candidate['flaggedRows'] >= 3 and (candidate['flagPrecision'] or 0) >= .8,
    }
    return {'recommendCandidate':all(checks.values()),'checks':checks,
            'scope':'Experimental grouped-CV recommendation. A fresh expert-reviewed target test set is still needed.'}

def fit_model(target_x, target_y, external_x=None, external_y=None):
    model=LogisticRegression(C=1.0,class_weight='balanced',max_iter=3000,random_state=42)
    if external_x is None:
        return model.fit(target_x,target_y)
    # Bound the aggregate influence of auxiliary labels, regardless of their row count.
    target_counts=collections.Counter(target_y)
    external_counts=collections.Counter(external_y)
    weights=np.concatenate([[len(target_y)/(2*target_counts[label]) for label in target_y],
                            [.5*len(target_y)/(2*external_counts[label]) for label in external_y]])
    model.set_params(class_weight=None)
    return model.fit(np.concatenate([target_x,external_x]),np.concatenate([target_y,external_y]),sample_weight=weights)

def cached_vectors(rows, api_key, cache):
    saved=json.loads(cache.read_text(encoding='utf-8')) if cache.exists() else {}
    vectors=[]
    for index,row in enumerate(rows):
        cache_key=hashlib.sha256((EMBEDDING_MODEL+FEATURE_VERSION+features(row)).encode()).hexdigest()
        if cache_key not in saved:
            saved[cache_key]=embedding(features(row),api_key).tolist()
            temporary=cache.with_suffix('.tmp')
            temporary.write_text(json.dumps(saved),encoding='utf-8')
            temporary.replace(cache)
            time.sleep(.75)
        vector=np.asarray(saved[cache_key],dtype=float)
        if vector.shape != (DIMENSION,) or not np.isfinite(vector).all() or not np.isclose(np.linalg.norm(vector),1,atol=1e-5):
            raise ValueError('Cached embedding is invalid. Remove that cache entry; no fake vector was substituted.')
        vectors.append(vector)
        if (index+1)%50==0: print(f'Hosted embeddings ready: {index+1}/{len(rows)}')
    return np.asarray(vectors)

def artifact(model, rows, metrics, suffix):
    data_hash=hashlib.sha256(json.dumps(rows,sort_keys=True,ensure_ascii=False).encode()).hexdigest()
    return {'format':'strive-relevance-v1','modelVersion':f'relevance-{data_hash[:12]}-{suffix}',
            'featureVersion':FEATURE_VERSION,'embeddingModel':EMBEDDING_MODEL,'dimension':DIMENSION,
            'coefficients':model.coef_[0].tolist(),'intercept':float(model.intercept_[0]),'classes':[0,1],
            'trainingDataHash':data_hash,'trainedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
            'metrics':metrics,'advisoryOnly':True}

def train_with_external(path, api_key, maximum_external=600):
    target=check_training_file(path)
    if any(row.get('weakAuxiliary') or row.get('sourceDataset')=='SetFit/qnli' for row in target):
        raise ValueError('Upload the reviewed target answers separately. External rows must never be counted as reviewed business evidence.')
    external, validation, manifest=prepare('external-data',maximum_external,120)
    external=remove_overlap(external,target)
    validation=remove_overlap(validation,target+external)
    counts=collections.Counter(row['label'] for row in external)
    if min(counts.get(0,0),counts.get(1,0))<5:
        raise ValueError('Too few external examples remain after removing overlap.')
    all_rows=target+external+validation
    print(f'Using {len(target)} reviewed target answers, {len(external)} auxiliary training pairs, and {len(validation)} separate auxiliary validation pairs.')
    print('QNLI negatives mean does-not-answer, not necessarily off-topic. Target metrics stay separate.')
    matrix=cached_vectors(all_rows,api_key,Path('embedding_cache.json'))
    target_x=matrix[:len(target)]; external_x=matrix[len(target):len(target)+len(external)]; validation_x=matrix[len(target)+len(external):]
    target_y=np.array([row['label'] for row in target]); external_y=np.array([row['label'] for row in external])
    groups=np.array([row['groupId'] for row in target])
    predictions={name:np.full(len(target),np.nan) for name in ['baseline','externalCandidate']}
    folds=[]
    splitter=StratifiedGroupKFold(n_splits=min(5,len(set(groups))),shuffle=True,random_state=42)
    for fold,(train_ids,test_ids) in enumerate(splitter.split(target_x,target_y,groups)):
        if len(set(target_y[train_ids]))<2:
            folds.append({'fold':fold,'skipped':'Target training partition has only one class.'});continue
        assert not set(groups[train_ids]) & set(groups[test_ids])
        baseline=fit_model(target_x[train_ids],target_y[train_ids])
        candidate=fit_model(target_x[train_ids],target_y[train_ids],external_x,external_y)
        predictions['baseline'][test_ids]=baseline.predict_proba(target_x[test_ids])[:,1]
        predictions['externalCandidate'][test_ids]=candidate.predict_proba(target_x[test_ids])[:,1]
        folds.append({'fold':fold,'trainRows':len(train_ids),'testRows':len(test_ids),'testGroups':sorted(set(groups[test_ids]))})
    baseline_metrics=evaluate_labels(target_y,predictions['baseline'])
    candidate_metrics=evaluate_labels(target_y,predictions['externalCandidate'])
    decision=promotion_decision(baseline_metrics,candidate_metrics)
    comparison={'evaluation':'Same held-out business-family folds for target-only baseline and auxiliary-data candidate; development selection, not an independent final test.',
                'baseline':baseline_metrics,'externalCandidate':candidate_metrics,'promotion':decision,'folds':folds,
                'targetRows':len(target),'targetGroups':len(set(groups)), 'auxiliaryTrainingRows':len(external),
                'auxiliaryValidationRows':len(validation),'externalData':manifest,
                'limitations':['Only five target families in the supplied prepared file; uncertainty is high.','Assistant-reviewed target labels are not independent expert ground truth.','English auxiliary data does not establish regional-language accuracy.','No model predicts business success or certifies factual truth.']}
    baseline_final=fit_model(target_x,target_y)
    candidate_final=fit_model(target_x,target_y,external_x,external_y)
    comparison['auxiliaryValidation']={name:evaluate_labels([r['label'] for r in validation],model.predict_proba(validation_x)[:,1]) for name,model in [('baseline',baseline_final),('externalCandidate',candidate_final)]}
    for name,metrics in [('baseline',baseline_metrics),('externalCandidate',candidate_metrics)]:
        metrics.update({'evaluation':comparison['evaluation'],'groups':len(set(groups)),'advisoryThreshold':.75,
                        'classCounts':dict(collections.Counter(row['label'] for row in target)),
                        'externalRows':0 if name=='baseline' else len(external),'selection':decision,'languages':{}})
    baseline_artifact=artifact(baseline_final,target,baseline_metrics,'baseline')
    candidate_artifact=artifact(candidate_final,target+external,candidate_metrics,'external')
    selected=candidate_artifact if decision['recommendCandidate'] else baseline_artifact
    selected_model=candidate_final if decision['recommendCandidate'] else baseline_final
    for name,value in [('baseline-model.json',baseline_artifact),('candidate-model.json',candidate_artifact),('model.json',selected),('evaluation.json',selected['metrics']),('comparison.json',comparison)]:
        Path(name).write_text(json.dumps(value,indent=2),encoding='utf-8')
    parity={'vectors':target_x[:5].tolist(),'expectedOffTopicScores':selected_model.predict_proba(target_x[:5])[:,1].tolist()}
    Path('parity-vectors.json').write_text(json.dumps(parity,indent=2),encoding='utf-8')
    print(json.dumps({'targetBaseline':baseline_metrics,'targetCandidate':candidate_metrics,'recommendation':decision},indent=2))
    print('Saved model.json for the selected model. candidate-model.json remains experimental unless all promotion checks pass. No deployment was performed.')
    return comparison
