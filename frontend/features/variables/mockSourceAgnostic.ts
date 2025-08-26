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
        CRF_DEMO: {
          name: "CRF_DEMO",
          label: "CRF Demographics",
          type: "crf_form",
          variables: [
            { name: "SEX", label: "Sex (CRF)", type: "character", length: 1 }
          ],
          sourceFiles: [
            {
              fileId: "acrf_v1.0.pdf",
              role: "primary",
              extractedData: ["form_structure", "field_definitions"]
            }
          ],
          metadata: {
            structure: "CRF Form: Demographics",
            version: "1.0",
            lastModified: "2024-01-10",
            validationStatus: "compliant"
          }
        },
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
        totalEntities: 2
      }
    },
    TLF: {
      type: "TLF",
      label: "Tables, Listings, and Figures",
      datasetEntities: {
        "TLF_combined_tlf": {
          name: "TLF_combined_tlf",
          label: "TLF Document (combined_tlf.pdf)",
          type: "tlf_document",
          variables: [], // TLF documents don't have variables
          sourceFiles: [
            {
              fileId: "combined_tlf.pdf",
              role: "primary",
              extractedData: ["document", "titles"]
            }
          ],
          metadata: {
            structure: "document",
            validationStatus: "not_applicable",
            titles: [
              {
                id: "Table 14-1.01",
                title: "Summary of Populations"
              },
              {
                id: "Table 14-1.02",
                title: "Summary of End of Study Data"
              },
              {
                id: "Table 14-1.03",
                title: "Summary of Number of Subjects By Site"
              },
              {
                id: "Table 14-2.01",
                title: "Summary of Demographic and Baseline Characteristics"
              },
              {
                id: "Table 14-3.01",
                title: "Primary Endpoint Analysis: ADAS Cog (11) - Change from Baseline to Week 24 - LOCF"
              },
              {
                id: "Table 14-3.02",
                title: "Primary Endpoint Analysis: CIBIC+ - Summary at Week 24 - LOCF"
              },
              {
                id: "Table 14-3.03",
                title: "ADAS Cog (11) - Change from Baseline to Week 8 - LOCF"
              },
              {
                id: "Table 14-3.04",
                title: "CIBIC+ - Summary at Week 8 - LOCF"
              },
              {
                id: "Table 14-3.05",
                title: "ADAS Cog (11) - Change from Baseline to Week 16 - LOCF"
              },
              {
                id: "Table 14-3.06",
                title: "CIBIC+ - Summary at Week 16 - LOCF"
              },
              {
                id: "Table 14-3.07",
                title: "ADAS Cog (11) - Change from Baseline to Week 24 - Completers at Wk 24-Observed Cases-Windowed"
              },
              {
                id: "Table 14-3.08",
                title: "ADAS Cog (11) - Change from Baseline to Week 24 in Male Subjects - LOCF"
              },
              {
                id: "Table 14-3.09",
                title: "ADAS Cog (11) - Change from Baseline to Week 24 in Female Subjects - LOCF"
              },
              {
                id: "Table 14-3.10",
                title: "ADAS Cog (11) - Mean and Mean Change from Baseline over Time"
              },
              {
                id: "Table 14-3.11",
                title: "ADAS Cog (11) - Repeated Measures Analysis of Change from Baseline to Week 24"
              },
              {
                id: "Table 14-3.12",
                title: "Mean NPI-X Total Score from Week 4 through Week 24 - Windowed"
              },
              {
                id: "Table 14-3.13",
                title: "CIBIC+ - Categorical Analysis - LOCF"
              },
              {
                id: "Table 14-4.01",
                title: "Summary of Planned Exposure to Study Drug, as of End of Study"
              },
              {
                id: "Table 14-5.01",
                title: "Incidence of Treatment Emergent Adverse Events by Treatment Group"
              },
              {
                id: "Table 14-6.01",
                title: "Summary Statistics for Continuous Laboratory Values"
              },
              {
                id: "Table 14-6.02",
                title: "Frequency of Normal and Abnormal (Beyond Normal Range) Laboratory Values During Treatment"
              },
              {
                id: "Table 14-6.03",
                title: "Frequency of Normal and Abnormal (Clinically Significant Change from Previous Visit) Laboratory Values"
              },
              {
                id: "Table 14-6.04",
                title: "Shifts of Laboratory Values During Treatment, Categorized Based on Threshold Ranges, by Visit"
              },
              {
                id: "Table 14-6.05",
                title: "Shifts of Laboratory Values During Treatment, Categorized Based on Threshold Ranges"
              },
              {
                id: "Table 14-6.06",
                title: "Shifts of Hy's Law Values During Treatment"
              },
              {
                id: "Table 14-7.01",
                title: "Summary of Vital Signs at Baseline and End of Treatment"
              },
              {
                id: "Table 14-7.02",
                title: "Summary of Vital Signs Change from Baseline at End of Treatment"
              },
              {
                id: "Table 14-7.03",
                title: "Summary of Weight Change from Baseline at End of Treatment"
              },
              {
                id: "Table 14-7.04",
                title: "Summary of Concomitant Medications (Number of Subjects)"
              },
              {
                id: "Figure 14-1",
                title: "Time to Dermatologic Event by Treatment Group"
              }
            ],
            titleCount: 30
          }
        }
      },
      metadata: {
        version: "1.0",
        lastModified: "2024-01-12",
        totalEntities: 1
      }
    },
    Protocol: {
      type: "Protocol",
      label: "Clinical Study Protocol",
      datasetEntities: {
        "Protocol": {
          name: "Protocol",
          label: "Clinical Study Protocol",
          type: "protocol_document",
          variables: [], // Protocol documents don't have variables
          sourceFiles: [
            {
              fileId: "protocol.pdf",
              role: "primary",
              extractedData: ["document", "text"]
            }
          ],
          metadata: {
            structure: "document",
            validationStatus: "not_applicable",
            textFile: "protocol_protocol.txt",
            textChars: 115516
          }
        }
      },
      metadata: {
        version: "1.0",
        lastModified: "2024-01-15",
        totalEntities: 1
      }
    }
  },
  metadata: {
    processedAt: "2024-01-16T10:30:00Z",
    totalVariables: adslVariables.length + adaeVariables.length + dmVariables.length + lbVariables.length + crfAeVariables.length + 0, // +0 for protocol (no variables)
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
      },
      {
        id: "protocol.pdf",
        filename: "protocol.pdf",
        type: "protocol_pdf",
        uploadedAt: "2024-01-15T14:00:00Z",
        sizeKB: 1352,
        processingStatus: "completed"
      },
      {
        id: "protocol_protocol.txt",
        filename: "protocol_protocol.txt",
        type: "protocol_txt",
        uploadedAt: "2024-01-15T14:05:00Z",
        sizeKB: 113,
        processingStatus: "completed"
      }
    ]
  }
} as const
