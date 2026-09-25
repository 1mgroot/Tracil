import unittest
from langsmith_lineage import score_edges

class LineageScores(unittest.TestCase):
    def scores(self,edges,required):
        result=score_edges({'response':{'lineage':{'edges':edges}}},{'required_edges':required})
        return {r['key']:r['score'] for r in result}

    def test_wrong_direction_does_not_pass(self):
        s=self.scores([{'from':'B','to':'A'}],[['A','B']])
        self.assertEqual(s['required_edge_recall'],0)
        self.assertEqual(s['extra_edges_for_review'],1)

    def test_duplicate_edges_do_not_inflate_recall(self):
        s=self.scores([{'from':'A','to':'B'}]*2,[['A','B'],['C','B']])
        self.assertEqual(s['required_edges_matched'],1)
        self.assertEqual(s['required_edge_recall'],0.5)

    def test_missing_output_is_zero_not_pass(self):
        scores={r['key']:r['score'] for r in score_edges(None,{'required_edges':[['A','B']]})}
        self.assertEqual(scores['required_edge_recall'],0)
