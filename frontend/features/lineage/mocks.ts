import type { LineageGraph } from '@/types/lineage'

export const mockLineage: Record<string, LineageGraph> = {
  'ADSL.SEX': {
    summary: 'SEX is captured on CRF, standardized in SDTM DM.SEX, and retained as ADSL.SEX.',
    nodes: [
      { id: 'aCRF.DEMO.SEX', title: 'CRF: Sex', group: 'aCRF', kind: 'source', meta: { file: 'acrf_v1.0.pdf' } },
      { id: 'SDTM.DM.SEX', title: 'DM.SEX', group: 'SDTM', kind: 'intermediate', dataset: 'DM', variable: 'SEX' },
      { id: 'ADaM.ADSL.SEX', title: 'ADSL.SEX', group: 'ADaM', kind: 'target', dataset: 'ADSL', variable: 'SEX' },
    ],
    edges: [
      { from: 'aCRF.DEMO.SEX', to: 'SDTM.DM.SEX', confidence: 0.95, label: 'CRF capture → SDTM standardize' },
      { from: 'SDTM.DM.SEX', to: 'ADaM.ADSL.SEX', confidence: 0.98, label: 'retain' },
    ],
    gaps: { notes: ['Confirm SDTM → ADaM retention rule in spec.'] },
  },
  'AE.AEBODSYS': {
    summary: 'AEBODSYS is derived via MedDRA coding in SDTM AE and retained for ADAE.',
    nodes: [
      { id: 'aCRF.AE.TERM', title: 'CRF: AE Term', group: 'aCRF', kind: 'source', meta: { file: 'acrf_v1.0.pdf' } },
      { id: 'SDTM.AE.AETERM', title: 'AE.AETERM', group: 'SDTM', kind: 'intermediate', dataset: 'AE', variable: 'AETERM' },
      { id: 'SDTM.AE.AEBODSYS', title: 'AE.AEBODSYS', group: 'SDTM', kind: 'intermediate', dataset: 'AE', variable: 'AEBODSYS' },
      { id: 'ADaM.ADAE.AEBODSYS', title: 'ADAE.AEBODSYS', group: 'ADaM', kind: 'target', dataset: 'ADAE', variable: 'AEBODSYS' },
    ],
    edges: [
      { from: 'aCRF.AE.TERM', to: 'SDTM.AE.AETERM', confidence: 0.90, label: 'CRF capture' },
      { from: 'SDTM.AE.AETERM', to: 'SDTM.AE.AEBODSYS', confidence: 0.85, label: 'MedDRA map' },
      { from: 'SDTM.AE.AEBODSYS', to: 'ADaM.ADAE.AEBODSYS', confidence: 0.95, label: 'retain' },
    ],
    gaps: { notes: ['Document MedDRA version and mapping rules.'] },
  },
}
