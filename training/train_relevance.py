"""Frozen pinned MiniLM + bounded logistic experiment; never serves this candidate."""
from __future__ import annotations

import hashlib
import importlib.metadata
import json
import os
import sys
from collections import Counter
from pathlib import Path

os.environ['HF_HUB_OFFLINE']='1'
os.environ['TRANSFORMERS_OFFLINE']='1'
import numpy as np
import sklearn
import torch
from sklearn.linear_model import LogisticRegression
from transformers import AutoModel, AutoTokenizer

sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_pairs import PRIVATE, ROOT
from evaluate_relevance import metrics

SEED=20261017
REV='1110a243fdf4706b3f48f1d95db1a4f5529b4d41'


def baseline(question,answer,cosine):
    if not answer.strip():
        return -1
    # Advisory overlap only. Never labels an answer irrelevant on magnitude or
    # similarity alone; low similarity abstains, including short valid answers.
    return 0 if cosine>=.35 else -1


def main():
    torch.set_num_threads(2)
    torch.manual_seed(SEED)
    np.random.seed(SEED)
    raw=(PRIVATE/'pairs.json').read_bytes()
    data=json.loads(raw)
    pairs=data['pairs']
    cache=ROOT/'.cache/huggingface/hub/models--sentence-transformers--all-MiniLM-L6-v2/snapshots'/REV
    tokenizer=AutoTokenizer.from_pretrained(str(cache),local_files_only=True)
    model=AutoModel.from_pretrained(str(cache),local_files_only=True).eval()

    def embed(texts):
        batches=[]
        for start in range(0,len(texts),16):
            tokens=tokenizer(texts[start:start+16],return_tensors='pt',padding=True,truncation=True,max_length=256)
            with torch.inference_mode():
                hidden=model(**tokens).last_hidden_state
                mask=tokens['attention_mask'].unsqueeze(-1)
                pooled=(hidden*mask).sum(1)/mask.sum(1).clamp(min=1)
                batches.append(torch.nn.functional.normalize(pooled,p=2,dim=1).numpy())
        return np.concatenate(batches)

    q=embed([p['question'] for p in pairs])
    a=embed([p['answer'] for p in pairs])
    cosine=(q*a).sum(1)
    features=np.concatenate([q,a,abs(q-a),cosine[:,None]],axis=1)
    labels=np.array([int(p['label']=='irrelevant') for p in pairs])
    groups=sorted({p['family_id'] for p in pairs},key=lambda g:hashlib.sha256((str(SEED)+g).encode()).hexdigest())
    audit={g:dict(Counter(p['label'] for p in pairs if p['family_id']==g)) for g in groups}
    # Class-aware group split, specified before fitting: retain the sole
    # minority-class family for training. One-class holdouts cannot establish
    # negative-class generalization and are explicitly reported as insufficient.
    positive_only=[g for g in groups if not audit[g].get('irrelevant')]
    holdout=positive_only[:2]
    splits={'train':[g for g in groups if g not in holdout],
            'validation':holdout[1:2],'test':holdout[:1]}
    indices={name:np.array([i for i,p in enumerate(pairs) if p['family_id'] in values],dtype=int) for name,values in splits.items()}
    candidate=None
    train=indices['train']
    if len(set(labels[train].tolist()))==2:
        classifier=LogisticRegression(C=1,solver='liblinear',random_state=SEED,max_iter=300)
        classifier.fit(features[train],labels[train])
        candidate={'coef':classifier.coef_.tolist(),'intercept':classifier.intercept_.tolist(),
                   'classes':classifier.classes_.tolist()}
        probability=classifier.predict_proba(features)[:,1]
        # Fixed abstention thresholds, not optimized against held-out data.
        predicted=np.where(probability>=.7,1,np.where(probability<=.3,0,-1))
    else:
        predicted=np.full(len(pairs),-1)
    base=np.array([baseline(p['question'],p['answer'],float(cosine[i])) for i,p in enumerate(pairs)])
    report={'seed':SEED,'data_sha256':hashlib.sha256(raw).hexdigest(),'embedding_revision':REV,
        'pypdf':importlib.metadata.version('pypdf'),'torch':torch.__version__,
        'feature_contract':'minilm-mean-l2-256-qa-abs-cosine-v1','sklearn':sklearn.__version__,
        'groups':audit,'split_groups':splits,'split_policy':'hash-order class-aware groups; minority-only family retained in train; no test tuning',
        'independently_reviewed_pairs':0,
        'source_count':len(data['sources']),'pair_count':len(pairs),'fitted':candidate is not None,
        'decision':'reject','serving':'rules-cosine-baseline-v1',
        'reason':'No independently reviewed labels/families; machine extraction and labels are experimental only.',
        'metrics':{name:{'candidate':metrics(labels[ix],predicted[ix]),'baseline':metrics(labels[ix],base[ix])} for name,ix in indices.items()}}
    artifact={'schema_version':1,'id':'udyam-answer-relevance-v1','status':'experimental_rejected',
              'manifest':{key:report[key] for key in ('seed','data_sha256','embedding_revision','feature_contract','sklearn')},
              'parameters':candidate,'thresholds':{'irrelevant':.7,'relevant':.3},'label_order':['relevant','irrelevant']}
    output=ROOT/'models/relevance'
    output.mkdir(parents=True,exist_ok=True)
    encoded=json.dumps(artifact,sort_keys=True,indent=2).encode()
    (output/'candidate.json').write_bytes(encoded+b'\n')
    report['artifact_sha256']=hashlib.sha256(encoded+b'\n').hexdigest()
    reportpath=ROOT/'evals/reports/relevance.json'
    reportpath.write_text(json.dumps(report,sort_keys=True,indent=2)+'\n',encoding='utf-8')
    np.savez(PRIVATE/'features.npz',features=features,labels=labels,predicted=predicted)
    print(json.dumps({'pairs':len(pairs),'groups':len(groups),'fitted':candidate is not None,'decision':'reject','artifact_sha256':report['artifact_sha256']}))


if __name__=='__main__':
    main()
