import type { ProcessFilesResponse, Variable } from '@/types/variables'

// ADSL Variables (Subject-Level Analysis Dataset)
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
    name: "ETHNIC",
    label: "Ethnicity",
    type: "character",
    length: 40,
    role: "covariate",
    codelist: "ETHNIC"
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
    name: "SITEID",
    label: "Study Site Identifier",
    type: "character",
    length: 8,
    role: "identifier"
  },
  {
    name: "RFSTDTC",
    label: "Subject Reference Start Date/Time",
    type: "character",
    length: 19,
    role: "timing",
    format: "DATETIME19."
  },
  {
    name: "RFENDTC",
    label: "Subject Reference End Date/Time",
    type: "character",
    length: 19,
    role: "timing",
    format: "DATETIME19."
  },
  {
    name: "DTHFL",
    label: "Subject Death Flag",
    type: "character",
    length: 1,
    role: "record_qualifier",
    codelist: "NY"
  },
  {
    name: "DTHDTC",
    label: "Date/Time of Death",
    type: "character",
    length: 19,
    role: "timing",
    format: "DATETIME19."
  },
  {
    name: "DTHADY",
    label: "Relative Day of Death",
    type: "numeric",
    role: "timing",
    format: "8."
  },
  {
    name: "SAFFL",
    label: "Safety Population Flag",
    type: "character",
    length: 1,
    role: "record_qualifier",
    codelist: "NY"
  },
  {
    name: "ITTFL",
    label: "Intent-To-Treat Population Flag",
    type: "character",
    length: 1,
    role: "record_qualifier",
    codelist: "NY"
  }
] as const

// ADAE Variables (Adverse Events Analysis Dataset)
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
  },
  {
    name: "AESER",
    label: "Serious Event",
    type: "character",
    length: 1,
    role: "qualifier",
    codelist: "NY"
  },
  {
    name: "AEREL",
    label: "Causality",
    type: "character",
    length: 40,
    role: "qualifier",
    codelist: "AEREL"
  },
  {
    name: "AESTDTC",
    label: "Start Date/Time of Adverse Event",
    type: "character",
    length: 19,
    role: "timing",
    format: "DATETIME19."
  },
  {
    name: "AEENDTC",
    label: "End Date/Time of Adverse Event",
    type: "character",
    length: 19,
    role: "timing",
    format: "DATETIME19."
  },
  {
    name: "AESTDY",
    label: "Study Day of Start of Adverse Event",
    type: "numeric",
    role: "timing",
    format: "8."
  },
  {
    name: "AEENDY",
    label: "Study Day of End of Adverse Event",
    type: "numeric",
    role: "timing",
    format: "8."
  },
  {
    name: "AEDUR",
    label: "Duration of Adverse Event",
    type: "numeric",
    role: "timing",
    format: "8."
  },
  {
    name: "AEOUT",
    label: "Outcome of Adverse Event",
    type: "character",
    length: 40,
    role: "qualifier",
    codelist: "AEOUT"
  },
  {
    name: "AEACN",
    label: "Action Taken with Study Treatment",
    type: "character",
    length: 40,
    role: "qualifier",
    codelist: "AEACN"
  },
  {
    name: "AETOXGR",
    label: "Standard Toxicity Grade",
    type: "character",
    length: 2,
    role: "qualifier",
    codelist: "AETOXGR"
  },
  {
    name: "TRTEMFL",
    label: "Treatment Emergent Analysis Flag",
    type: "character",
    length: 1,
    role: "record_qualifier",
    codelist: "NY"
  },
  {
    name: "SAFFL",
    label: "Safety Population Flag",
    type: "character",
    length: 1,
    role: "record_qualifier",
    codelist: "NY"
  },
  {
    name: "AETERM",
    label: "Reported Term for the Adverse Event",
    type: "character",
    length: 200,
    role: "topic"
  },
  {
    name: "AELLT",
    label: "Lowest Level Term",
    type: "character",
    length: 200,
    role: "qualifier",
    codelist: "MEDDRA"
  },
  {
    name: "AELLTCD",
    label: "Lowest Level Term Code",
    type: "numeric",
    role: "qualifier",
    format: "8.",
    codelist: "MEDDRA"
  },
  {
    name: "AEPTCD",
    label: "Preferred Term Code",
    type: "numeric",
    role: "qualifier",
    format: "8.",
    codelist: "MEDDRA"
  },
  {
    name: "AEHLTCD",
    label: "High Level Term Code",
    type: "numeric",
    role: "qualifier",
    format: "8.",
    codelist: "MEDDRA"
  },
  {
    name: "AEHLT",
    label: "High Level Term",
    type: "character",
    length: 200,
    role: "qualifier",
    codelist: "MEDDRA"
  },
  {
    name: "AEHLGTCD",
    label: "High Level Group Term Code",
    type: "numeric",
    role: "qualifier",
    format: "8.",
    codelist: "MEDDRA"
  },
  {
    name: "AEHLGT",
    label: "High Level Group Term",
    type: "character",
    length: 200,
    role: "qualifier",
    codelist: "MEDDRA"
  },
  {
    name: "AESOCCD",
    label: "Primary System Organ Class Code",
    type: "numeric",
    role: "qualifier",
    format: "8.",
    codelist: "MEDDRA"
  },
  {
    name: "AESOC",
    label: "Primary System Organ Class",
    type: "character",
    length: 200,
    role: "qualifier",
    codelist: "MEDDRA"
  },
  {
    name: "AECONTRT",
    label: "Concomitant or Additional Treatment Given",
    type: "character",
    length: 200,
    role: "qualifier"
  }
] as const

// ADLB Variables (Laboratory Analysis Dataset)
const adlbVariables: readonly Variable[] = [
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
    name: "PARAM",
    label: "Parameter",
    type: "character",
    length: 200,
    role: "topic"
  },
  {
    name: "PARAMCD",
    label: "Parameter Code",
    type: "character",
    length: 8,
    role: "topic"
  },
  {
    name: "AVAL",
    label: "Analysis Value",
    type: "numeric",
    role: "topic",
    format: "8.4"
  },
  {
    name: "AVALC",
    label: "Analysis Value (C)",
    type: "character",
    length: 200,
    role: "topic"
  },
  {
    name: "BASE",
    label: "Baseline Value",
    type: "numeric",
    role: "covariate",
    format: "8.4"
  },
  {
    name: "BASEC",
    label: "Baseline Value (C)",
    type: "character",
    length: 200,
    role: "covariate"
  },
  {
    name: "CHG",
    label: "Change from Baseline",
    type: "numeric",
    role: "topic",
    format: "8.4"
  },
  {
    name: "PCHG",
    label: "Percent Change from Baseline",
    type: "numeric",
    role: "topic",
    format: "8.2"
  },
  {
    name: "ANRIND",
    label: "Analysis Reference Range Indicator",
    type: "character",
    length: 8,
    role: "qualifier",
    codelist: "ANRIND"
  },
  {
    name: "ANRLO",
    label: "Analysis Reference Range Lower Limit",
    type: "numeric",
    role: "qualifier",
    format: "8.4"
  },
  {
    name: "ANRHI",
    label: "Analysis Reference Range Upper Limit",
    type: "numeric",
    role: "qualifier",
    format: "8.4"
  },
  {
    name: "ADT",
    label: "Analysis Date",
    type: "numeric",
    role: "timing",
    format: "DATE9."
  },
  {
    name: "ADTM",
    label: "Analysis DateTime",
    type: "numeric",
    role: "timing",
    format: "DATETIME19."
  },
  {
    name: "ADY",
    label: "Analysis Relative Day",
    type: "numeric",
    role: "timing",
    format: "8."
  },
  {
    name: "AVISIT",
    label: "Analysis Visit",
    type: "character",
    length: 40,
    role: "timing"
  },
  {
    name: "AVISITN",
    label: "Analysis Visit (N)",
    type: "numeric",
    role: "timing",
    format: "8."
  },
  {
    name: "LBCAT",
    label: "Category for Lab Test",
    type: "character",
    length: 40,
    role: "qualifier"
  },
  {
    name: "LBSCAT",
    label: "Subcategory for Lab Test",
    type: "character",
    length: 40,
    role: "qualifier"
  },
  {
    name: "LBTEST",
    label: "Lab Test or Examination Name",
    type: "character",
    length: 200,
    role: "topic"
  },
  {
    name: "LBTESTCD",
    label: "Lab Test or Examination Short Name",
    type: "character",
    length: 8,
    role: "topic"
  },
  {
    name: "LBORRES",
    label: "Result or Finding in Original Units",
    type: "character",
    length: 200,
    role: "topic"
  },
  {
    name: "LBSTRESU",
    label: "Standard Units",
    type: "character",
    length: 40,
    role: "qualifier"
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
    name: "RFSTDTC",
    label: "Subject Reference Start Date/Time",
    type: "character",
    length: 19,
    role: "timing",
    format: "DATETIME19."
  },
  {
    name: "RFENDTC",
    label: "Subject Reference End Date/Time",
    type: "character",
    length: 19,
    role: "timing",
    format: "DATETIME19."
  },
  {
    name: "SITEID",
    label: "Study Site Identifier",
    type: "character",
    length: 8,
    role: "identifier"
  },
  {
    name: "AGE",
    label: "Age",
    type: "numeric",
    role: "topic",
    format: "3."
  },
  {
    name: "AGEU",
    label: "Age Units",
    type: "character",
    length: 8,
    role: "qualifier",
    codelist: "AGEU"
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
  },
  {
    name: "ETHNIC",
    label: "Ethnicity",
    type: "character",
    length: 40,
    role: "topic",
    codelist: "ETHNIC"
  },
  {
    name: "ARMCD",
    label: "Planned Arm Code",
    type: "character",
    length: 20,
    role: "topic"
  },
  {
    name: "ARM",
    label: "Description of Planned Arm",
    type: "character",
    length: 40,
    role: "topic"
  },
  {
    name: "COUNTRY",
    label: "Country",
    type: "character",
    length: 3,
    role: "qualifier",
    codelist: "COUNTRY"
  }
] as const

// LB Variables (Laboratory SDTM Domain)
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
  },
  {
    name: "LBCAT",
    label: "Category for Lab Test",
    type: "character",
    length: 40,
    role: "qualifier"
  },
  {
    name: "LBSCAT",
    label: "Subcategory for Lab Test",
    type: "character",
    length: 40,
    role: "qualifier"
  },
  {
    name: "LBORRES",
    label: "Result or Finding in Original Units",
    type: "character",
    length: 200,
    role: "topic"
  },
  {
    name: "LBORRESU",
    label: "Original Units",
    type: "character",
    length: 40,
    role: "qualifier"
  },
  {
    name: "LBORNRLO",
    label: "Reference Range Lower Limit in Orig Unit",
    type: "character",
    length: 200,
    role: "qualifier"
  },
  {
    name: "LBORNRHI",
    label: "Reference Range Upper Limit in Orig Unit",
    type: "character",
    length: 200,
    role: "qualifier"
  },
  {
    name: "LBSTRESC",
    label: "Character Result/Finding in Std Format",
    type: "character",
    length: 200,
    role: "topic"
  },
  {
    name: "LBSTRESN",
    label: "Numeric Result/Finding in Standard Units",
    type: "numeric",
    role: "topic",
    format: "8.4"
  },
  {
    name: "LBSTRESU",
    label: "Standard Units",
    type: "character",
    length: 40,
    role: "qualifier"
  },
  {
    name: "LBSTNRLO",
    label: "Reference Range Lower Limit-Std Units",
    type: "numeric",
    role: "qualifier",
    format: "8.4"
  },
  {
    name: "LBSTNRHI",
    label: "Reference Range Upper Limit-Std Units",
    type: "numeric",
    role: "qualifier",
    format: "8.4"
  },
  {
    name: "LBNRIND",
    label: "Reference Range Indicator",
    type: "character",
    length: 8,
    role: "qualifier",
    codelist: "NRIND"
  },
  {
    name: "LBDTC",
    label: "Date/Time of Specimen Collection",
    type: "character",
    length: 19,
    role: "timing",
    format: "DATETIME19."
  },
  {
    name: "LBDY",
    label: "Study Day of Specimen Collection",
    type: "numeric",
    role: "timing",
    format: "8."
  }
] as const

// AE Variables (Adverse Events SDTM Domain)
const aeVariables: readonly Variable[] = [
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
    name: "AESEQ",
    label: "Sequence Number",
    type: "numeric",
    role: "identifier",
    mandatory: true,
    format: "8."
  },
  {
    name: "AETERM",
    label: "Reported Term for the Adverse Event",
    type: "character",
    length: 200,
    role: "topic",
    mandatory: true
  },
  {
    name: "AEDECOD",
    label: "Dictionary-Derived Term",
    type: "character",
    length: 200,
    role: "qualifier",
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
  },
  {
    name: "AESER",
    label: "Serious Event",
    type: "character",
    length: 1,
    role: "qualifier",
    codelist: "NY"
  },
  {
    name: "AEREL",
    label: "Causality",
    type: "character",
    length: 40,
    role: "qualifier",
    codelist: "AEREL"
  },
  {
    name: "AEACN",
    label: "Action Taken with Study Treatment",
    type: "character",
    length: 40,
    role: "qualifier",
    codelist: "AEACN"
  },
  {
    name: "AEOUT",
    label: "Outcome of Adverse Event",
    type: "character",
    length: 40,
    role: "qualifier",
    codelist: "AEOUT"
  },
  {
    name: "AESTDTC",
    label: "Start Date/Time of Adverse Event",
    type: "character",
    length: 19,
    role: "timing",
    format: "DATETIME19."
  },
  {
    name: "AEENDTC",
    label: "End Date/Time of Adverse Event",
    type: "character",
    length: 19,
    role: "timing",
    format: "DATETIME19."
  },
  {
    name: "AESTDY",
    label: "Study Day of Start of Adverse Event",
    type: "numeric",
    role: "timing",
    format: "8."
  },
  {
    name: "AEENDY",
    label: "Study Day of End of Adverse Event",
    type: "numeric",
    role: "timing",
    format: "8."
  },
  {
    name: "AEDUR",
    label: "Duration of Adverse Event",
    type: "numeric",
    role: "timing",
    format: "8."
  },
  {
    name: "AELLT",
    label: "Lowest Level Term",
    type: "character",
    length: 200,
    role: "qualifier",
    codelist: "MEDDRA"
  },
  {
    name: "AELLTCD",
    label: "Lowest Level Term Code",
    type: "numeric",
    role: "qualifier",
    format: "8.",
    codelist: "MEDDRA"
  },
  {
    name: "AEPTCD",
    label: "Preferred Term Code",
    type: "numeric",
    role: "qualifier",
    format: "8.",
    codelist: "MEDDRA"
  },
  {
    name: "AEHLTCD",
    label: "High Level Term Code",
    type: "numeric",
    role: "qualifier",
    format: "8.",
    codelist: "MEDDRA"
  },
  {
    name: "AESOCCD",
    label: "Primary System Organ Class Code",
    type: "numeric",
    role: "qualifier",
    format: "8.",
    codelist: "MEDDRA"
  }
] as const

// VS Variables (Vital Signs SDTM Domain)
const vsVariables: readonly Variable[] = [
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
    name: "VSSEQ",
    label: "Sequence Number",
    type: "numeric",
    role: "identifier",
    mandatory: true,
    format: "8."
  },
  {
    name: "VSTESTCD",
    label: "Vital Signs Test Short Name",
    type: "character",
    length: 8,
    role: "topic",
    mandatory: true
  },
  {
    name: "VSTEST",
    label: "Vital Signs Test Name",
    type: "character",
    length: 200,
    role: "topic",
    mandatory: true
  },
  {
    name: "VSCAT",
    label: "Category for Vital Signs",
    type: "character",
    length: 40,
    role: "qualifier"
  },
  {
    name: "VSORRES",
    label: "Result or Finding in Original Units",
    type: "character",
    length: 200,
    role: "topic"
  },
  {
    name: "VSORRESU",
    label: "Original Units",
    type: "character",
    length: 40,
    role: "qualifier"
  },
  {
    name: "VSSTRESC",
    label: "Character Result/Finding in Std Format",
    type: "character",
    length: 200,
    role: "topic"
  },
  {
    name: "VSSTRESN",
    label: "Numeric Result/Finding in Standard Units",
    type: "numeric",
    role: "topic",
    format: "8.4"
  },
  {
    name: "VSSTRESU",
    label: "Standard Units",
    type: "character",
    length: 40,
    role: "qualifier"
  },
  {
    name: "VSSTAT",
    label: "Completion Status",
    type: "character",
    length: 40,
    role: "record_qualifier",
    codelist: "ND"
  },
  {
    name: "VSREASND",
    label: "Reason Not Done",
    type: "character",
    length: 200,
    role: "record_qualifier"
  },
  {
    name: "VSPOS",
    label: "Vital Signs Position of Subject",
    type: "character",
    length: 40,
    role: "qualifier",
    codelist: "POSITION"
  },
  {
    name: "VSDTC",
    label: "Date/Time of Measurements",
    type: "character",
    length: 19,
    role: "timing",
    format: "DATETIME19."
  },
  {
    name: "VSDY",
    label: "Study Day of Vital Signs",
    type: "numeric",
    role: "timing",
    format: "8."
  },
  {
    name: "VISITNUM",
    label: "Visit Number",
    type: "numeric",
    role: "timing",
    format: "8."
  }
] as const

// Mock data that mirrors Python backend response
export const mockProcessFilesResponse: ProcessFilesResponse = {
  files: [
    {
      filename: "define_adam.xml",
      type: "adam_metadata",
      datasets: [
        {
          name: "ADSL",
          label: "Subject-Level Analysis Dataset",
          variables: adslVariables,
          metadata: {
            records: 100,
            structure: "One record per subject",
            version: "1.0",
            lastModified: "2024-01-15"
          }
        },
        {
          name: "ADAE",
          label: "Adverse Events Analysis Dataset",
          variables: adaeVariables,
          metadata: {
            records: 230,
            structure: "One record per adverse event occurrence",
            version: "1.0",
            lastModified: "2024-01-15"
          }
        },
        {
          name: "ADLB",
          label: "Laboratory Analysis Dataset",
          variables: adlbVariables,
          metadata: {
            records: 320,
            structure: "One record per laboratory measurement",
            version: "1.0",
            lastModified: "2024-01-15"
          }
        }
      ]
    },
    {
      filename: "define_sdtm.xml",
      type: "sdtm_metadata",
      datasets: [
        {
          name: "DM",
          label: "Demographics",
          variables: dmVariables,
          metadata: {
            records: 100,
            structure: "One record per subject",
            version: "1.0",
            lastModified: "2024-01-15"
          }
        },
        {
          name: "LB",
          label: "Laboratory Test Results",
          variables: lbVariables,
          metadata: {
            records: 540,
            structure: "One record per laboratory measurement",
            version: "1.0",
            lastModified: "2024-01-15"
          }
        },
        {
          name: "AE",
          label: "Adverse Events",
          variables: aeVariables,
          metadata: {
            records: 410,
            structure: "One record per adverse event",
            version: "1.0",
            lastModified: "2024-01-15"
          }
        },
        {
          name: "VS",
          label: "Vital Signs",
          variables: vsVariables,
          metadata: {
            records: 260,
            structure: "One record per vital sign measurement",
            version: "1.0",
            lastModified: "2024-01-15"
          }
        }
      ]
    },
    {
      filename: "acrf_v1.0.pdf",
      type: "acrf_document",
      datasets: []
    },
    {
      filename: "demographics_table.rtf",
      type: "tlf_document",
      datasets: []
    }
  ]
} as const
