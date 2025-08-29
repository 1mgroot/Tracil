import { shouldDisplayNodeId, getNodeDisplayText, capitalizeWords } from '@/lib/utils'

describe('Node Display Utilities', () => {
  describe('shouldDisplayNodeId', () => {
    it('should return true for ADaM datasets', () => {
      expect(shouldDisplayNodeId({ dataset: 'ADSL' })).toBe(true)
      expect(shouldDisplayNodeId({ dataset: 'ADAE' })).toBe(true)
      expect(shouldDisplayNodeId({ dataset: 'ADLB' })).toBe(true)
    })

    it('should return true for SDTM datasets', () => {
      expect(shouldDisplayNodeId({ dataset: 'DM' })).toBe(true)
      expect(shouldDisplayNodeId({ dataset: 'AE' })).toBe(true)
      expect(shouldDisplayNodeId({ dataset: 'LB' })).toBe(true)
    })

    it('should return false for other dataset types', () => {
      expect(shouldDisplayNodeId({ dataset: 'CRF' })).toBe(false)
      expect(shouldDisplayNodeId({ dataset: 'TLF' })).toBe(false)
      expect(shouldDisplayNodeId({ dataset: 'Protocol' })).toBe(false)
    })

    it('should return false when dataset is undefined', () => {
      expect(shouldDisplayNodeId({})).toBe(false)
      expect(shouldDisplayNodeId({ dataset: undefined })).toBe(false)
    })
  })

  describe('capitalizeWords', () => {
    it('should capitalize first letter of each word', () => {
      expect(capitalizeWords('protocol section')).toBe('Protocol Section')
      expect(capitalizeWords('tlf display 14')).toBe('TLF Display 14')
      expect(capitalizeWords('demographics form')).toBe('Demographics Form')
      expect(capitalizeWords('summary table')).toBe('Summary Table')
    })

    it('should preserve existing capitalization in middle of words', () => {
      expect(capitalizeWords('DeMoGrApHiCs foRm')).toBe('DeMoGrApHiCs FoRm')
      expect(capitalizeWords('TLF display')).toBe('TLF Display')
      expect(capitalizeWords('CRF form_001')).toBe('CRF Form_001')
    })

    it('should handle special characters and numbers', () => {
      expect(capitalizeWords('form-001')).toBe('Form-001')
      expect(capitalizeWords('table_2024')).toBe('Table_2024')
      expect(capitalizeWords('data (version 2)')).toBe('Data (Version 2)')
      expect(capitalizeWords('section 1.2')).toBe('Section 1.2')
    })

    it('should handle TLF abbreviation correctly', () => {
      expect(capitalizeWords('tlf display')).toBe('TLF Display')
      expect(capitalizeWords('tlf table 14')).toBe('TLF Table 14')
      expect(capitalizeWords('tlf listing')).toBe('TLF Listing')
      expect(capitalizeWords('tlf figure 3')).toBe('TLF Figure 3')
      expect(capitalizeWords('mixed tlf content')).toBe('Mixed TLF Content')
    })

    it('should handle edge cases', () => {
      expect(capitalizeWords('')).toBe('')
      expect(capitalizeWords('   ')).toBe('   ')
      expect(capitalizeWords('a')).toBe('A')
      expect(capitalizeWords('A')).toBe('A')
      expect(capitalizeWords('  hello  world  ')).toBe('  Hello  World  ')
    })

    it('should handle non-string inputs gracefully', () => {
      expect(capitalizeWords(null as any)).toBe(null)
      expect(capitalizeWords(undefined as any)).toBe(undefined)
      expect(capitalizeWords(123 as any)).toBe(123)
    })
  })

  describe('getNodeDisplayText', () => {
    it('should return ID for ADaM/SDTM datasets when ID exists', () => {
      const adslNode = { id: 'ADaM.ADSL.USUBJID', title: 'Subject ID', dataset: 'ADSL' }
      expect(getNodeDisplayText(adslNode)).toBe('ADaM.ADSL.USUBJID')

      const dmNode = { id: 'SDTM.DM.SEX', title: 'Sex', dataset: 'DM' }
      expect(getNodeDisplayText(dmNode)).toBe('SDTM.DM.SEX')
    })

    it('should fallback to title for ADaM/SDTM datasets when ID is missing', () => {
      const adslNode = { title: 'Subject ID', dataset: 'ADSL' }
      expect(getNodeDisplayText(adslNode)).toBe('Subject ID')

      const dmNode = { title: 'Sex', dataset: 'DM' }
      expect(getNodeDisplayText(dmNode)).toBe('Sex')
    })

    it('should return capitalized title for non-ADaM/SDTM datasets', () => {
      const crfNode = { id: 'CRF.001', title: 'demographics form', dataset: 'CRF' }
      expect(getNodeDisplayText(crfNode)).toBe('Demographics Form')

      const tlfNode = { id: 'TLF.001', title: 'tlf display 14', dataset: 'TLF' }
      expect(getNodeDisplayText(tlfNode)).toBe('TLF Display 14')
    })

    it('should fallback to label when title is missing', () => {
      const node = { label: 'alternative label', dataset: 'CRF' }
      expect(getNodeDisplayText(node)).toBe('Alternative Label')
    })

    it('should fallback to ID when title and label are missing', () => {
      const node = { id: 'fallback.001', dataset: 'CRF' }
      expect(getNodeDisplayText(node)).toBe('Fallback.001')
    })

    it('should return "Unknown" when all fields are missing', () => {
      const node = { dataset: 'CRF' }
      expect(getNodeDisplayText(node)).toBe('Unknown')
    })
  })
})
