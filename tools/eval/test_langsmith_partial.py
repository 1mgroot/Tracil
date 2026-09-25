import unittest
from langsmith_partial import evaluate_fields, CASE_IDS, specs

class PartialEvaluatorTests(unittest.TestCase):
    def test_eight_cases_fifteen_checks(self):
        self.assertEqual(len(CASE_IDS),8)
        self.assertEqual(sum(len(specs(cid)) for cid in CASE_IDS),15)

    def test_missing_and_extra_fields_do_not_inflate_score(self):
        scores=evaluate_fields({'fields':{'a':{'present':True,'value':'x'},'extra':{'present':True,'value':'y'}}},{'fields':{'a':'x','b':None}})
        self.assertEqual({s['key']:s['score'] for s in scores}, {'partial_field_accuracy':0.5,'partial_fields_passed':1,'partial_fields_total':2,'all_selected_fields_match':0})

    def test_type_and_presence_are_not_coerced(self):
        scores=evaluate_fields({'fields':{'a':{'present':True,'value':1},'b':{'present':False,'value':None}}},{'fields':{'a':True,'b':None}})
        self.assertEqual(scores[1]['score'],0)
