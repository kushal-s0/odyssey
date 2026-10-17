"""Test only data validation. Never import or execute model training locally."""
import ast
import collections
import contextlib
import hashlib
import io
import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / 'training/train_cloud.py'
tree = ast.parse(SCRIPT.read_text(encoding='utf-8'))
functions = [node for node in tree.body if isinstance(node, ast.FunctionDef)
             and node.name in {'features', 'training_readiness', 'check_training_file'}]
namespace = {'collections': collections, 'hashlib': hashlib, 'json': json, 'Path': Path}
exec(compile(ast.Module(body=functions, type_ignores=[]), str(SCRIPT), 'exec'), namespace)


def rows():
    return [{'businessContext': f'Test family {i % 4}', 'question': f'Test question {i}',
             'answer': f'Validation fixture answer {i}', 'label': i % 2,
             'groupId': f'family-{i % 4}', 'language': 'en-IN'} for i in range(20)]


class PreflightTests(unittest.TestCase):
    def check(self, values):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / 'reviewed-answers.jsonl'
            path.write_text('\n'.join(json.dumps(row) for row in values), encoding='utf-8')
            with contextlib.redirect_stdout(io.StringIO()):
                return namespace['check_training_file'](path)

    def test_exact_shortfall_for_the_reported_failure(self):
        summary = namespace['training_readiness'](rows()[:1])
        self.assertFalse(summary['ready'])
        self.assertEqual([check['remaining'] for check in summary['checks']], [19, 3, 4, 5])
        with self.assertRaisesRegex(ValueError, '19 more reviewed answers'):
            self.check(rows()[:1])

    def test_valid_minimum_passes_without_any_model_execution(self):
        self.assertEqual(len(self.check(rows())), 20)

    def test_repeated_answers_do_not_count_as_independent_data(self):
        values = rows()
        values[-1] = dict(values[0])
        with self.assertRaisesRegex(ValueError, 'Duplicate question/answer'):
            self.check(values)

    def test_duplicate_features_cannot_cross_business_groups(self):
        values = rows()
        values[-1] = {**values[0], 'groupId': 'different-family'}
        with self.assertRaisesRegex(ValueError, 'crosses business groups'):
            self.check(values)

    def test_boolean_is_not_a_reviewed_class_label(self):
        values = rows()
        values[0]['label'] = True
        with self.assertRaisesRegex(ValueError, 'label 0/1'):
            self.check(values)

    def test_interface_examples_remain_excluded(self):
        values = rows()
        values[0]['example'] = True
        with self.assertRaisesRegex(ValueError, 'Synthetic interface examples'):
            self.check(values)

    def test_notebook_contains_the_current_validation_and_training_code(self):
        notebook = json.loads((ROOT / 'training/cloud_training.ipynb').read_text(encoding='utf-8'))
        self.assertEqual(''.join(notebook['cells'][2]['source']), SCRIPT.read_text(encoding='utf-8'))
        self.assertIn('check_training_file(paths[0])', ''.join(notebook['cells'][3]['source']))
        self.assertNotIn('getpass(', ''.join(notebook['cells'][1]['source']))


if __name__ == '__main__':
    unittest.main()
