"""Synthetic tests for projection and scoring boundaries, not clinical correctness."""
import unittest
from define_adapter import project, PROJECTIONS, UNSUPPORTED
from run_define import grade


class DefineAdapterTests(unittest.TestCase):
    def test_all_twenty_cases_classified_without_overlap(self):
        absent = {f'DET-DEFINE-{n:03}' for n in UNSUPPORTED}
        self.assertFalse(set(PROJECTIONS) & absent)
        self.assertEqual(set(PROJECTIONS) | absent, {f'DET-DEFINE-{i:03}' for i in range(1,21)})

    def test_actual_wrong_label_is_not_replaced_with_reference(self):
        parsed = {'ADVS':{'variables':[{'name':'CHG','label':'wrong'}]}}
        projected = project('DET-DEFINE-005', parsed)
        results = grade(projected, {'label':'expected'})
        self.assertEqual(results[0]['actual'], 'wrong')
        self.assertFalse(results[0]['pass'])
        self.assertNotIn('expected', projected[0])

    def test_missing_and_ambiguous_variables_fail_without_guessing(self):
        for variables in [[], [{'name':'CHG','label':'x'}]*2]:
            projected = project('DET-DEFINE-005', {'ADVS':{'variables':variables}})
            self.assertFalse(projected[0]['present'])
            self.assertNotIn('actual', projected[0])
            self.assertFalse(grade(projected, {'label':None})[0]['pass'])

    def test_no_reverse_mapping_of_normalized_attributes(self):
        projected = project('DET-DEFINE-004', {'ADVS':{'variables':[
            {'name':'CHG','type':'numeric','mandatory':False}]}})
        self.assertEqual([c['field'] for c in projected], ['name'])
        self.assertTrue(grade(projected, {'name':'CHG'})[0]['pass'])
        self.assertEqual(project('DET-DEFINE-010', {}), [])

    def test_labels_from_two_datasets_remain_separate(self):
        parsed = {ds:{'variables':[{'name':'CHG','label':label}]} for ds,label in
                  [('ADQSADAS','first'),('ADVS','second')]}
        checks = grade(project('DET-DEFINE-019',parsed), [{'label':'first'},{'label':'second'}])
        self.assertTrue(all(c['pass'] for c in checks))
        swapped = grade(project('DET-DEFINE-019',parsed), [{'label':'second'},{'label':'first'}])
        self.assertFalse(any(c['pass'] for c in swapped))
