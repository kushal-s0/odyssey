"""Ensure evaluation cannot turn unreviewed data or family leakage into accuracy."""
import importlib.util
from pathlib import Path

import pytest

spec = importlib.util.spec_from_file_location('corpus_evaluation', Path(__file__).resolve().parents[2] / 'evals/run.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def test_missing_reference_has_no_accuracy_and_reviewed_metrics_use_real_denominators():
    inventory = {'records': [{'id': 'a', 'format': 'ogg', 'declared_folder_language': 'hi'},
                              {'id': 'b', 'format': 'pdf', 'declared_folder_language': 'en'}]}
    result = module.evaluate(inventory, [], [{'id': 'a', 'transcript': 'tea'}])
    assert result['inputs_accounted_for'] == 2
    assert result['per_language']['hi']['wer'] is None
    assert not result['population_accuracy_validated']
    label = {'id': 'a', 'language': 'hi', 'reviewed': True, 'reviewer': 'test-human',
             'reference': 'one cup tea', 'family_id': 'tea', 'split': 'test',
             'fields': {'price': '10'}, 'relevant_ids': ['b']}
    predicted = {'id': 'a', 'transcript': 'one tea', 'fields': {'price': '100'}, 'retrieved_ids': ['b']}
    result = module.evaluate(inventory, [label], [predicted])
    hi = result['per_language']['hi']
    assert hi['word_errors'] == 1 and hi['reference_words'] == 3
    assert hi['wer'] == pytest.approx(1 / 3)
    assert hi['numeric_exact_match'] == 0 and hi['recall_at_5'] == 1
    assert result['per_language']['en']['measured_test_inputs'] == 0
    assert not result['release_quality_gate_passed']


def test_family_leakage_unavailable_reviewers_and_duplicate_ids_are_rejected():
    inventory = {'records': [{'id': k, 'format': 'pdf', 'declared_folder_language': 'en'} for k in ('a', 'b')]}
    first = {'id': 'a', 'language': 'en', 'reviewed': True, 'reviewer': 'human',
             'reference': 'tea', 'family_id': 'same-business', 'split': 'train'}
    second = {**first, 'id': 'b', 'split': 'test'}
    with pytest.raises(ValueError, match='leaks'):
        module.evaluate(inventory, [first, second], [])
    with pytest.raises(ValueError, match='reviewer coverage'):
        module.evaluate(inventory, [{**first, 'language': 'or'}], [])
    with pytest.raises(ValueError, match='duplicate'):
        module.evaluate(inventory, [], [{'id': 'a'}, {'id': 'a'}])
    with pytest.raises(ValueError, match='budget'):
        module.distance(list('a' * 3000), list('a' * 3000))
