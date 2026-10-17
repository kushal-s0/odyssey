"""Metrics never turn one-class/unreviewed holdouts into real accuracy claims."""
from __future__ import annotations

import numpy as np
from sklearn.metrics import confusion_matrix, f1_score, precision_score, recall_score


def metrics(labels, predicted):
    labels=np.asarray(labels)
    predicted=np.asarray(predicted)
    covered=predicted!=-1
    two_classes=len(set(labels.tolist()))==2 and bool(covered.any())
    return {'count':len(labels),'class_counts':{str(i):int((labels==i).sum()) for i in (0,1)},
        'confusion_matrix_relevant_irrelevant':confusion_matrix(labels[covered],predicted[covered],labels=[0,1]).tolist() if covered.any() else [[0,0],[0,0]],
        'abstention_rate':float(1-covered.mean()) if len(labels) else None,
        'macro_f1':float(f1_score(labels[covered],predicted[covered],labels=[0,1],average='macro',zero_division=0)) if two_classes else None,
        'irrelevant_precision':float(precision_score(labels[covered],predicted[covered],pos_label=1,zero_division=0)) if two_classes else None,
        'irrelevant_recall':float(recall_score(labels[covered],predicted[covered],pos_label=1,zero_division=0)) if two_classes else None,
        'quality_claim_eligible':False}
