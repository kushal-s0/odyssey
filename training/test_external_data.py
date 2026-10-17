"""Only dataset, notebook and promotion-rule validation. Never run model code locally."""
import ast
import hashlib
import json
import unittest
from pathlib import Path
from external_data import convert, balanced_sample, remove_overlap
from sharktank_data import convert_pitches
ROOT=Path(__file__).resolve().parents[1]
tree=ast.parse((ROOT/'training/cloud_train_external.py').read_text(encoding='utf-8'))
namespace={}
functions=[node for node in tree.body if isinstance(node,ast.FunctionDef) and node.name=='promotion_decision']
exec(compile(ast.Module(body=functions,type_ignores=[]),'promotion-validation','exec'),namespace)

class ExternalDataTests(unittest.TestCase):
    def test_qnli_source_labels_are_not_flipped_or_declared_reviewed(self):
        values=convert([{'idx':1,'text1':'What are business expenses?','text2':'Expenses are business costs.','label':0,'label_text':'entailment'},
                        {'idx':2,'text1':'What are business expenses?','text2':'The business opened yesterday.','label':1,'label_text':'not entailment'}],'train')
        self.assertEqual([row['label'] for row in values],[0,1])
        self.assertTrue(all(row['weakAuxiliary'] for row in values))
        self.assertEqual(values[0]['groupId'],values[1]['groupId'])
    def test_shared_answers_connect_question_groups(self):
        rows=[{'idx':i,'text1':q,'text2':a,'label':0,'label_text':'entailment'} for i,(q,a) in enumerate([('What are business costs?','Operating expenses.'),('What are company expenses?','Operating expenses.'),('What are company expenses?','Rent and utilities.')])]
        self.assertEqual(len({row['groupId'] for row in convert(rows,'train')}),1)
    def test_no_fake_negatives_are_created_to_balance_small_data(self):
        with self.assertRaises(ValueError):balanced_sample([{'label':0,'question':'Business?','answer':'A real answer.'}],20)
    def test_external_holdout_rejects_shared_questions_or_answers(self):
        reference=[{'question':'BUSINESS costs?','answer':'A known answer'}]
        candidates=[{'question':'business costs?','answer':'Other'}, {'question':'Other','answer':'a known answer'}, {'question':'Unseen','answer':'New'}]
        self.assertEqual(remove_overlap(candidates,reference),[candidates[-1]])
    def test_sharktank_uses_real_fields_and_does_not_invent_off_topic_or_outcome_labels(self):
        rows=[{'id':'test-fixture','input':{'company_name':'Fixture business','initial_offer':{'amount':'$100000'},'product_solution':{'product_category':'Reusable cups','key_differentiator':'Repairable handles'},'problem_story':{'persona':'Commuters','core_problem':'Disposable cups create waste'}},'output':'A separate transcript.'}]
        pairs,companies=convert_pitches(rows,'train',30)
        self.assertEqual(len(pairs),4);self.assertEqual({row['label'] for row in pairs},{0})
        self.assertTrue(all(not row['humanReviewed'] and not row['transcriptQuoteMatched'] for row in pairs))
        self.assertTrue(all(row['answer']==row['sourceStructuredValue'] for row in pairs))
        self.assertFalse(any('100000' in row['answer'] for row in pairs))
        self.assertEqual(convert_pitches(rows,'test',10,companies)[0],[])
    def test_promotion_requires_measured_gain_and_usable_flags(self):
        baseline={'evaluationCoverage':1,'macroF1':.65,'offTopicRecall':.4,'offTopicPrecision':.6,'flaggedRows':0,'flagPrecision':None}
        improved={**baseline,'macroF1':.75,'offTopicRecall':.7,'offTopicPrecision':.8,'flaggedRows':5,'flagPrecision':1}
        decide=namespace['promotion_decision']
        self.assertTrue(decide(baseline,improved)['recommendCandidate'])
        for changes in [{'macroF1':.66},{'offTopicRecall':.3},{'flaggedRows':0},{'evaluationCoverage':.8},{'flagPrecision':.6}]:
            self.assertFalse(decide(baseline,{**improved,**changes})['recommendCandidate'])
    def test_notebook_embeds_current_sources_without_credentials_or_execution(self):
        notebook=json.loads((ROOT/'training/external_cloud_training.ipynb').read_text(encoding='utf-8'))
        source=''.join(notebook['cells'][2]['source'])
        assignment=next(node for node in ast.parse(source).body if isinstance(node,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='SOURCES' for t in node.targets))
        sources=ast.literal_eval(assignment.value)
        for name,content in sources.items():self.assertEqual(content,(ROOT/'training'/name).read_text(encoding='utf-8'))
        self.assertIn('google.colab',''.join(notebook['cells'][1]['source']))
        self.assertFalse(any(cell.get('outputs') for cell in notebook['cells']))
    def test_actual_prepared_data_keeps_sources_and_heldout_companies_separate(self):
        directory=ROOT/'data/training'
        files=['external-qnli-train.jsonl','external-qnli-validation.jsonl','external-sharktank-train.jsonl','external-sharktank-test.jsonl']
        if not all((directory/name).exists() for name in files):self.skipTest('External dataset preparation has not run.')
        train,validation,shark_train,shark_test=[[json.loads(line) for line in (directory/name).read_text(encoding='utf-8').splitlines()] for name in files]
        self.assertEqual(len(train),600);self.assertEqual(len(validation),120)
        self.assertFalse(set(row['groupId'] for row in shark_train)&set(row['groupId'] for row in shark_test))
        self.assertEqual(len(remove_overlap(validation,train)),len(validation))
        self.assertTrue(all(row['weakAuxiliary'] for row in train+validation+shark_train+shark_test))
        for filename in ['external-data-manifest.json','sharktank-data-manifest.json']:
            manifest=json.loads((directory/filename).read_text(encoding='utf-8'))
            for entry in manifest['files'].values():
                self.assertEqual(hashlib.sha256((ROOT/entry['path']).read_bytes()).hexdigest(),entry['preparedSha256'])

if __name__=='__main__':unittest.main()
