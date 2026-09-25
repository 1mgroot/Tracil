"""Synthetic guards for thin ARS projection; no study data or network."""
import unittest
from run_ars import project
from run_define import grade

class ArsAdapterTests(unittest.TestCase):
    def test_same_analysis_id_stays_scoped_to_source(self):
        parsed = {'ars_lb':{'methods':{'An_89':{'dataset':'wrong','variable':'X'}}},
                  'ars_vs':{'methods':{'An_89':{'dataset':'right','variable':'Y'}}}}
        checks = grade(project('DET-JSON-010',parsed),{'dataset':'right','variable':'Y'})
        self.assertFalse(any(c['pass'] for c in checks))
        self.assertEqual(checks[0]['actual'],'wrong')

    def test_missing_is_distinct_from_explicit_null(self):
        ref = {'analysis':{'dataset':None,'variable':None}}
        self.assertFalse(any(c['pass'] for c in grade(project('DET-JSON-018',{}),ref)))
        parsed = {'ars_vs':{'methods':{'An_105':{'dataset':None,'variable':None}}}}
        self.assertTrue(all(c['pass'] for c in grade(project('DET-JSON-018',parsed),ref)))

    def test_nested_name_keeps_exact_whitespace_and_excludes_unsupported_fields(self):
        parsed = {'ars_vs':{'methods':{'An_105':{'name':' label ','dataset':'D','variable':'V','operationId':'M'}}}}
        checks = project('DET-JSON-020',parsed)
        self.assertEqual([c['field'] for c in checks],['name','dataset','variable'])
        self.assertEqual(checks[0]['actual'],' label ')
        graded = grade(checks,{'analysis':{'name':'label','dataset':'D','variable':'V'}})
        self.assertFalse(graded[0]['pass'])
        self.assertTrue(all(c['pass'] for c in graded[1:]))
