"""Check grouped isolation and exported JSON predictions against the fitted run."""
import hashlib
import json

import numpy as np

from build_pairs import PRIVATE, ROOT

report=json.loads((ROOT/'evals/reports/relevance.json').read_text())
raw=(PRIVATE/'pairs.json').read_bytes()
data=json.loads(raw)
artifact_raw=(ROOT/'models/relevance/candidate.json').read_bytes()
artifact=json.loads(artifact_raw)
assert hashlib.sha256(raw).hexdigest()==report['data_sha256']
assert hashlib.sha256(artifact_raw).hexdigest()==report['artifact_sha256']
splits=[set(value) for value in report['split_groups'].values()]
assert all(not left.intersection(right) for i,left in enumerate(splits) for right in splits[i+1:])
assert set.union(*splits)=={p['family_id'] for p in data['pairs']}
assert len({p['id'] for p in data['pairs']})==len(data['pairs'])
sources={p['source_id']:p['family_id'] for p in data['pairs']}
assert all(sources[p['source_id']]==p['family_id'] for p in data['pairs'])
values=np.load(PRIVATE/'features.npz',allow_pickle=False)
assert values['features'].shape==(len(data['pairs']),1153)
parameters=artifact['parameters']
assert parameters is not None
logits=values['features']@np.asarray(parameters['coef'])[0]+parameters['intercept'][0]
probability=1/(1+np.exp(-logits))
predicted=np.where(probability>=.7,1,np.where(probability<=.3,0,-1))
assert np.array_equal(predicted,values['predicted'])
assert report['decision']=='reject' and report['independently_reviewed_pairs']==0
assert not json.loads((ROOT/'models/relevance/serving.json').read_text())['promoted']
print('PASS: disjoint groups, stable data/artifact digests, safe JSON prediction parity, rejected serving')
