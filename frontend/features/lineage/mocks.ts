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
      { from: 'aCRF.DEMO.SEX', to: 'SDTM.DM.SEX', label: 'CRF capture → SDTM standardize', explanation: 'Demographic data captured on CRF and standardized according to SDTM guidelines' },
      { from: 'SDTM.DM.SEX', to: 'ADaM.ADSL.SEX', label: 'retain', explanation: 'Variable retained without modification from SDTM to ADaM' },
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
      { from: 'aCRF.AE.TERM', to: 'SDTM.AE.AETERM', label: 'CRF capture', explanation: 'Adverse event term captured directly from CRF' },
      { from: 'SDTM.AE.AETERM', to: 'SDTM.AE.AEBODSYS', label: 'MedDRA map', explanation: 'Body system derived from MedDRA coding of AE term' },
      { from: 'SDTM.AE.AEBODSYS', to: 'ADaM.ADAE.AEBODSYS', label: 'retain', explanation: 'Body system variable retained for analysis dataset' },
    ],
    gaps: { notes: ['Document MedDRA version and mapping rules.'] },
  },
  'ADAE.AESCAN': {
    summary: 'Lineage analysis for ADAE.AESCAN',
    nodes: [
      {
        id: 'ADAE.AESCAN',
        title: 'AESCAN',
        dataset: 'ADAE',
        variable: 'AESCAN',
        group: 'ADaM',
        kind: 'target',
        meta: {
          notes: 'Adverse Event Scan'
        }
      },
      {
        id: 'AE.AESCAN',
        title: 'AESCAN',
        dataset: 'ADAE',
        variable: 'AESCAN',
        group: 'ADaM',
        kind: 'target',
        meta: {
          notes: 'Adverse Event Scan'
        }
      },
      {
        id: 'CRF.Page.121',
        title: 'CRF Page 121',
        dataset: 'ADAE',
        variable: 'AESCAN',
        group: 'aCRF',
        kind: 'target',
        meta: {
          file: 'blankcrf.pdf',
          notes: 'CRF page for AE data'
        }
      },
      {
        id: 'CRF.Page.122',
        title: 'CRF Page 122',
        dataset: 'ADAE',
        variable: 'AESCAN',
        group: 'aCRF',
        kind: 'target',
        meta: {
          file: 'blankcrf.pdf',
          notes: 'CRF page for AE data'
        }
      },
      {
        id: 'CRF.Page.123',
        title: 'CRF Page 123',
        dataset: 'ADAE',
        variable: 'AESCAN',
        group: 'aCRF',
        kind: 'target',
        meta: {
          file: 'blankcrf.pdf',
          notes: 'CRF page for AE data'
        }
      },
      {
        id: 'Protocol.Section.11.2',
        title: 'Protocol Section 11.2',
        dataset: 'ADAE',
        variable: 'AESCAN',
        group: 'TLF',
        kind: 'target',
        meta: {
          file: 'SAP_SEC_11.2',
          notes: 'Protocol section for AE analysis'
        }
      },
      {
        id: 'Table_14-5.02',
        title: 'Table 14-5.02',
        dataset: 'ADAE',
        variable: 'AESCAN',
        group: 'ADaM',
        kind: 'target',
        meta: {
          notes: 'Incidence of Treatment Emergent Serious Adverse Events by Treatment Group'
        }
      },
      {
        id: 'ADaM.ADAE.AESCAN',
        title: 'AESCAN',
        dataset: 'ADAE',
        variable: 'AESCAN',
        group: 'ADaM',
        kind: 'target',
        meta: {
          file: 'define',
          notes: 'define'
        }
      }
    ],
    edges: [
      {
        from: 'ADAE.AESCAN',
        to: 'AE.AESCAN',
        label: 'Derived from'
      },
      {
        from: 'AE.AESCAN',
        to: 'CRF.Page.121',
        label: 'Collected on'
      },
      {
        from: 'AE.AESCAN',
        to: 'CRF.Page.122',
        label: 'Collected on'
      },
      {
        from: 'AE.AESCAN',
        to: 'CRF.Page.123',
        label: 'Collected on'
      },
      {
        from: 'Protocol.Section.11.2',
        to: 'ADAE.AESCAN',
        label: 'Described in'
      },
      {
        from: 'ADAE.AESCAN',
        to: 'Table_14-5.02',
        label: 'Used in'
      }
    ],
    gaps: {
      notes: []
    }
  }
}
