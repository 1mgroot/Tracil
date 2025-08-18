import type { 
  SourceAgnosticProcessFilesResponse, 
  Variable
} from '@/types/variables'

// ADSL Variables (Subject-Level Analysis Dataset) - reuse from existing mocks
const adslVariables: readonly Variable[] = [
  {
    name: "USUBJID",
    label: "Unique Subject Identifier",
    type: "character",
    length: 20,
    role: "identifier",
    mandatory: true
  },
  {
    name: "SUBJID",
    label: "Subject Identifier for the Study",
    type: "character",
    length: 8,
    role: "identifier",
    mandatory: true
  },
  {
    name: "AGE",
    label: "Age at Baseline",
    type: "numeric",
    role: "covariate",
    format: "3."
  },
  {
    name: "AGEGR1",
    label: "Pooled Age Group 1",
    type: "character",
    length: 10,
    role: "covariate",
    codelist: "AGEGR1"
  },
  {
    name: "SEX",
    label: "Sex",
    type: "character",
    length: 1,
    role: "covariate",
    mandatory: true,
    codelist: "SEX"
  },
  {
    name: "RACE",
    label: "Race",
    type: "character",
    length: 40,
    role: "covariate",
    codelist: "RACE"
  },
  {
    name: "ARM",
    label: "Description of Planned Arm",
    type: "character",
    length: 40,
    role: "covariate",
    mandatory: true
  },
  {
    name: "ACTARM",
    label: "Description of Actual Arm",
    type: "character",
    length: 40,
    role: "covariate"
  },
  {
    name: "COUNTRY",
    label: "Country",
    type: "character",
    length: 3,
    role: "covariate",
    codelist: "COUNTRY"
  },
  {
    name: "SAFFL",
    label: "Safety Population Flag",
    type: "character",
    length: 1,
    role: "record_qualifier",
    codelist: "NY"
  }
] as const

// ADAE Variables (abbreviated for demo)
const adaeVariables: readonly Variable[] = [
  {
    name: "USUBJID",
    label: "Unique Subject Identifier",
    type: "character",
    length: 20,
    role: "identifier",
    mandatory: true
  },
  {
    name: "AESEQ",
    label: "Sequence Number",
    type: "numeric",
    role: "identifier",
    mandatory: true,
    format: "8."
  },
  {
    name: "AEDECOD",
    label: "Dictionary-Derived Term",
    type: "character",
    length: 200,
    role: "topic",
    codelist: "MEDDRA"
  },
  {
    name: "AEBODSYS",
    label: "Body System or Organ Class",
    type: "character",
    length: 200,
    role: "qualifier",
    codelist: "MEDDRA"
  },
  {
    name: "AESEV",
    label: "Severity/Intensity",
    type: "character",
    length: 20,
    role: "qualifier",
    codelist: "AESEV"
  }
] as const

// DM Variables (Demographics SDTM Domain)
const dmVariables: readonly Variable[] = [
  {
    name: "STUDYID",
    label: "Study Identifier",
    type: "character",
    length: 12,
    role: "identifier",
    mandatory: true
  },
  {
    name: "DOMAIN",
    label: "Domain Abbreviation",
    type: "character",
    length: 2,
    role: "identifier",
    mandatory: true
  },
  {
    name: "USUBJID",
    label: "Unique Subject Identifier",
    type: "character",
    length: 20,
    role: "identifier",
    mandatory: true
  },
  {
    name: "SUBJID",
    label: "Subject Identifier for the Study",
    type: "character",
    length: 8,
    role: "identifier",
    mandatory: true
  },
  {
    name: "AGE",
    label: "Age",
    type: "numeric",
    role: "topic",
    format: "3."
  },
  {
    name: "SEX",
    label: "Sex",
    type: "character",
    length: 1,
    role: "topic",
    mandatory: true,
    codelist: "SEX"
  },
  {
    name: "RACE",
    label: "Race",
    type: "character",
    length: 40,
    role: "topic",
    codelist: "RACE"
  }
] as const

// LB Variables (Laboratory SDTM Domain) - abbreviated
const lbVariables: readonly Variable[] = [
  {
    name: "STUDYID",
    label: "Study Identifier",
    type: "character",
    length: 12,
    role: "identifier",
    mandatory: true
  },
  {
    name: "DOMAIN",
    label: "Domain Abbreviation",
    type: "character",
    length: 2,
    role: "identifier",
    mandatory: true
  },
  {
    name: "USUBJID",
    label: "Unique Subject Identifier",
    type: "character",
    length: 20,
    role: "identifier",
    mandatory: true
  },
  {
    name: "LBSEQ",
    label: "Sequence Number",
    type: "numeric",
    role: "identifier",
    mandatory: true,
    format: "8."
  },
  {
    name: "LBTESTCD",
    label: "Lab Test or Examination Short Name",
    type: "character",
    length: 8,
    role: "topic",
    mandatory: true
  },
  {
    name: "LBTEST",
    label: "Lab Test or Examination Name",
    type: "character",
    length: 200,
    role: "topic",
    mandatory: true
  }
] as const

// CRF Variables (example)
const crfAeVariables: readonly Variable[] = [
  {
    name: "AE_TERM",
    label: "Adverse Event Term",
    type: "character",
    length: 200,
    role: "topic"
  },
  {
    name: "AE_START_DATE",
    label: "Adverse Event Start Date",
    type: "date",
    role: "timing"
  },
  {
    name: "AE_SEVERITY",
    label: "Severity Assessment",
    type: "character",
    length: 20,
    role: "qualifier"
  }
] as const

// Source-Agnostic Mock Response
export const mockSourceAgnosticResponse: SourceAgnosticProcessFilesResponse = {
  standards: {
    SDTM: {
      type: "SDTM",
      label: "Study Data Tabulation Model",
      datasetEntities: {
        DM: {
          name: "DM",
          label: "Demographics",
          type: "domain",
          variables: dmVariables,
          sourceFiles: [
            {
              fileId: "define_sdtm_v1.xml",
              role: "primary",
              extractedData: ["metadata", "variables", "codelists"]
            },
            {
              fileId: "dm.xpt",
              role: "supplementary", 
              extractedData: ["data_validation", "actual_values"]
            }
          ],
          metadata: {
            records: 100,
            structure: "One record per subject",
            version: "1.0",
            lastModified: "2024-01-15",
            validationStatus: "compliant"
          }
        },
        LB: {
          name: "LB",
          label: "Laboratory Test Results",
          type: "domain",
          variables: lbVariables,
          sourceFiles: [
            {
              fileId: "define_sdtm_v1.xml",
              role: "primary",
              extractedData: ["metadata", "variables", "codelists"]
            }
          ],
          metadata: {
            records: 540,
            structure: "One record per laboratory measurement",
            version: "1.0",
            lastModified: "2024-01-15",
            validationStatus: "compliant"
          }
        }
      },
      metadata: {
        version: "1.0",
        lastModified: "2024-01-15",
        totalEntities: 2
      }
    },
    ADaM: {
      type: "ADaM",
      label: "Analysis Data Model",
      datasetEntities: {
        ADSL: {
          name: "ADSL",
          label: "Subject-Level Analysis Dataset",
          type: "analysis_dataset",
          variables: adslVariables,
          sourceFiles: [
            {
              fileId: "adam_spec_v2.xlsx",
              role: "primary",
              extractedData: ["metadata", "variables", "derivation_logic"]
            }
          ],
          metadata: {
            records: 100,
            structure: "One record per subject",
            version: "2.0",
            lastModified: "2024-01-16",
            validationStatus: "compliant"
          }
        },
        ADAE: {
          name: "ADAE",
          label: "Adverse Events Analysis Dataset",
          type: "analysis_dataset",
          variables: adaeVariables,
          sourceFiles: [
            {
              fileId: "adam_spec_v2.xlsx",
              role: "primary",
              extractedData: ["metadata", "variables"]
            },
            {
              fileId: "adae.xpt",
              role: "supplementary",
              extractedData: ["data_validation"]
            }
          ],
          metadata: {
            records: 230,
            structure: "One record per adverse event occurrence",
            version: "2.0",
            lastModified: "2024-01-16",
            validationStatus: "compliant"
          }
        }
      },
      metadata: {
        version: "2.0",
        lastModified: "2024-01-16",
        totalEntities: 2
      }
    },
    CRF: {
      type: "CRF",
      label: "Case Report Form",
      datasetEntities: {
        CRF_AE: {
          name: "CRF_AE",
          label: "Adverse Events Form",
          type: "crf_form",
          variables: crfAeVariables,
          sourceFiles: [
            {
              fileId: "acrf_v1.0.pdf",
              role: "primary",
              extractedData: ["form_structure", "field_definitions"]
            }
          ],
          metadata: {
            structure: "Electronic case report form",
            version: "1.0",
            lastModified: "2024-01-10",
            validationStatus: "compliant"
          }
        }
      },
      metadata: {
        version: "1.0",
        lastModified: "2024-01-10",
        totalEntities: 1
      }
    },
    TLF: {
      type: "TLF",
      label: "Tables, Listings, and Figures",
      datasetEntities: {
        "T-14-3-01": {
          name: "T-14-3-01",
          label: "Demographics and Baseline Characteristics",
          type: "tlf_item",
          variables: [], // TLF items typically don't have variables in the same way
          sourceFiles: [
            {
              fileId: "demographics_table.rtf",
              role: "primary",
              extractedData: ["table_structure", "variable_references"]
            }
          ],
          metadata: {
            structure: "Summary table",
            version: "1.0",
            lastModified: "2024-01-12",
            validationStatus: "unknown"
          }
        }
      },
      metadata: {
        version: "1.0",
        lastModified: "2024-01-12",
        totalEntities: 1
      }
    }
  },
  metadata: {
    processedAt: "2024-01-16T10:30:00Z",
    totalVariables: adslVariables.length + adaeVariables.length + dmVariables.length + lbVariables.length + crfAeVariables.length,
    sourceFiles: [
      {
        id: "define_sdtm_v1.xml",
        filename: "define_sdtm_v1.xml",
        type: "define_xml",
        uploadedAt: "2024-01-15T09:00:00Z",
        sizeKB: 45,
        processingStatus: "completed"
      },
      {
        id: "adam_spec_v2.xlsx",
        filename: "adam_spec_v2.xlsx", 
        type: "spec_xlsx",
        uploadedAt: "2024-01-16T08:30:00Z",
        sizeKB: 120,
        processingStatus: "completed"
      },
      {
        id: "dm.xpt",
        filename: "dm.xpt",
        type: "dataset_xpt",
        uploadedAt: "2024-01-15T10:00:00Z",
        sizeKB: 20,
        processingStatus: "completed"
      },
      {
        id: "adae.xpt",
        filename: "adae.xpt",
        type: "dataset_xpt",
        uploadedAt: "2024-01-16T09:15:00Z",
        sizeKB: 84,
        processingStatus: "completed"
      },
      {
        id: "acrf_v1.0.pdf",
        filename: "acrf_v1.0.pdf",
        type: "acrf_pdf",
        uploadedAt: "2024-01-10T14:00:00Z",
        sizeKB: 1024,
        processingStatus: "completed"
      },
      {
        id: "demographics_table.rtf",
        filename: "demographics_table.rtf",
        type: "tlf_rtf",
        uploadedAt: "2024-01-12T11:00:00Z",
        sizeKB: 80,
        processingStatus: "completed"
      }
    ]
  }
} as const
