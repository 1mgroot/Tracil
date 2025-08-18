### AI Developer Guide — Tracil (Python Backend)

Purpose: Complete freedom in Python backend development. Only API endpoint contracts matter for frontend integration.

---

#### 1) Your Domain: Complete Freedom in `backend/` Folder

**You have COMPLETE AUTONOMY over the entire `backend/` folder:**
```
backend/                           # YOUR DOMAIN - organize however you want
├─ main.py                        # FastAPI entry point (required)
├─ requirements.txt               # Your Python dependencies
├─ .env.example                   # Your environment template
│
└─ [ORGANIZE HOWEVER YOU PREFER]
   # Examples of what you can do:
   # - Any folder structure (services/, core/, utils/, etc.)
   # - Any Python libraries (pandas, numpy, scikit-learn, etc.)
   # - Any design patterns (MVC, clean architecture, etc.)
   # - Any additional files/configs you need
```

**Only constraints:**
- Expose these 2 API endpoints in your FastAPI app
- Return JSON in the agreed format

---

#### 2) Required API Endpoints (Your FastAPI App)

**Important: Source-Agnostic Structure**
The frontend now uses a CDISC-first, source-agnostic data structure. This means:
- Organize data by CDISC standards (SDTM, ADaM, CRF, TLF) rather than source files
- Same structure works whether data comes from define.xml, spec sheets, raw datasets, or documents
- Clear traceability: each dataset entity links to its source files
- Flexible: supports any combination of source file types
- Future-proof: easy to extend for new standards or sources

**Endpoint 1: `POST /process-files`**
- **Purpose**: Process uploaded files and return source-agnostic CDISC structure
- **Input**: Multipart form with files (aCRF, SDTM metadata, ADaM metadata, TLF documents)
- **Output JSON (Source-Agnostic Structure)**:
```json
{
  "standards": {
    "SDTM": {
      "type": "SDTM",
      "label": "Study Data Tabulation Model",
      "datasetEntities": {
        "DM": {
          "name": "DM",
          "label": "Demographics",
          "type": "domain",
          "variables": [
            {
              "name": "USUBJID",
              "label": "Unique Subject Identifier",
              "type": "character",
              "length": 20,
              "role": "identifier",
              "mandatory": true
            }
          ],
          "sourceFiles": [
            {
              "fileId": "define_sdtm_v1.xml",
              "role": "primary",
              "extractedData": ["metadata", "variables", "codelists"]
            }
          ],
          "metadata": {
            "records": 100,
            "structure": "One record per subject",
            "validationStatus": "compliant"
          }
        }
      },
      "metadata": {
        "totalEntities": 1
      }
    },
    "ADaM": {
      "type": "ADaM",
      "label": "Analysis Data Model",
      "datasetEntities": {
        "ADSL": {
          "name": "ADSL",
          "label": "Subject-Level Analysis Dataset",
          "type": "analysis_dataset",
          "variables": [...],
          "sourceFiles": [...],
          "metadata": {...}
        }
      },
      "metadata": {
        "totalEntities": 1
      }
    }
  },
  "metadata": {
    "processedAt": "2024-01-16T10:30:00Z",
    "totalVariables": 150,
    "sourceFiles": [
      {
        "id": "define_sdtm_v1.xml",
        "filename": "define_sdtm_v1.xml",
        "type": "define_xml",
        "uploadedAt": "2024-01-15T09:00:00Z",
        "sizeKB": 45,
        "processingStatus": "completed"
      }
    ]
  }
}
```

**Endpoint 2: `POST /analyze-variable`**
- **Purpose**: Generate lineage for a specific variable
- **Input JSON**:
```json
{
  "variable": "AEDECOD",
  "dataset": "ADAE",
  "files": [...] // Previously processed files context
}
```
- **Output JSON**:
```json
{
  "variable": "AEDECOD",
  "dataset": "ADAE", 
  "lineage": {
    "nodes": [
      {"id": "aCRF.AE_TERM", "type": "source", "file": "aCRF"},
      {"id": "SDTM.AE.AETERM", "type": "intermediate", "file": "ae.xpt"},
      {"id": "ADaM.ADAE.AEDECOD", "type": "target", "file": "adae.xpt"}
    ],
    "edges": [
      {"from": "aCRF.AE_TERM", "to": "SDTM.AE.AETERM", "confidence": 0.95}
    ],
    "gaps": ["Missing transformation logic documentation"]
  }
}
```

---

#### 3) How Frontend Integrates with Your Python Backend

**Development Phase 1 (Now):**
- Frontend has mock API responses in Next.js API routes
- You develop Python backend independently 
- Run your FastAPI with: `uvicorn main:app --reload --port 8000`

**Development Phase 2 (Soon):**
- Frontend Next.js API routes proxy to your Python backend
- Simple CORS setup: `ALLOWED_ORIGINS=http://localhost:3000`
- Test end-to-end integration

**Development Phase 3 (Later):**
- Docker deployment and production setup

---

#### 4) API Testing with Postman

**Yes, your FastAPI backend can be fully tested with Postman!** This is highly recommended for independent development and debugging.

**Setup:**
1. Run your FastAPI: `uvicorn main:app --reload --port 8000`
2. Visit `http://localhost:8000/docs` for auto-generated API documentation
3. Use Postman to test the endpoints below

**Test 1: `POST /process-files` (File Upload)**
```
URL: http://localhost:8000/process-files
Method: POST
Headers: (none needed - Postman handles multipart automatically)
Body: form-data
├─ Key: "files" | Type: File | Value: [Upload your test files]
   # Upload sample files like:
   # - define.xml (ADaM metadata)
   # - define.xml (SDTM metadata) 
   # - sample.xpt (SDTM dataset)
   # - aCRF.pdf or aCRF.xlsx
```

**Expected Response (Source-Agnostic Structure):**
```json
{
  "standards": {
    "ADaM": {
      "type": "ADaM",
      "label": "Analysis Data Model",
      "datasetEntities": {
        "ADSL": {
          "name": "ADSL",
          "label": "Subject-Level Analysis Dataset",
          "type": "analysis_dataset",
          "variables": [
            {
              "name": "USUBJID",
              "label": "Unique Subject Identifier",
              "type": "character",
              "length": 20,
              "role": "identifier",
              "mandatory": true
            },
            {
              "name": "AGE",
              "label": "Age at Baseline",
              "type": "numeric",
              "role": "covariate",
              "format": "3."
            }
          ],
          "sourceFiles": [
            {
              "fileId": "define.xml",
              "role": "primary",
              "extractedData": ["metadata", "variables"]
            }
          ],
          "metadata": {
            "records": 100,
            "structure": "One record per subject",
            "validationStatus": "compliant"
          }
        }
      },
      "metadata": {
        "totalEntities": 1
      }
    }
  },
  "metadata": {
    "processedAt": "2024-01-16T10:30:00Z",
    "totalVariables": 10,
    "sourceFiles": [
      {
        "id": "define.xml",
        "filename": "define.xml",
        "type": "define_xml",
        "uploadedAt": "2024-01-16T10:00:00Z",
        "sizeKB": 45,
        "processingStatus": "completed"
      }
    ]
  }
}
```

**Test 2: `POST /analyze-variable` (Lineage Analysis)**
```
URL: http://localhost:8000/analyze-variable
Method: POST
Headers: Content-Type: application/json
Body: raw (JSON)
```

**Request Body:**
```json
{
  "variable": "AEDECOD",
  "dataset": "ADAE",
  "context": {
    "standards": {
      "ADaM": {
        "datasetEntities": {
          "ADAE": {
            "variables": [...],
            "sourceFiles": [...]
          }
        }
      },
      "SDTM": {
        "datasetEntities": {
          "AE": {
            "variables": [...],
            "sourceFiles": [...]
          }
        }
      }
    }
  }
}
```

**Expected Response:**
```json
{
  "variable": "AEDECOD",
  "dataset": "ADAE",
  "lineage": {
    "nodes": [
      {"id": "aCRF.AE_TERM", "type": "source", "file": "aCRF"},
      {"id": "SDTM.AE.AETERM", "type": "intermediate", "file": "ae.xpt"},
      {"id": "ADaM.ADAE.AEDECOD", "type": "target", "file": "adae.xpt"}
    ],
    "edges": [
      {"from": "aCRF.AE_TERM", "to": "SDTM.AE.AETERM", "confidence": 0.95},
      {"from": "SDTM.AE.AETERM", "to": "ADaM.ADAE.AEDECOD", "confidence": 0.87}
    ],
    "gaps": ["Missing transformation logic documentation"]
  }
}
```

**What to Test:**
- ✅ File upload handling (various formats: XPT, XLSX, PDF, DOCX, RTF)
- ✅ Source-agnostic parsing (same structure regardless of source file type)
- ✅ CDISC standards organization (SDTM, ADaM, CRF, TLF grouping)
- ✅ Source file traceability (sourceFiles array with roles and extractedData)
- ✅ JSON response format matches source-agnostic contract
- ✅ Mixed source scenarios (e.g., define.xml + spec sheet + raw dataset)
- ✅ Variable lineage analysis with confidence scores
- ✅ Gap detection in lineage chains
- ✅ Error handling (invalid files, large files, missing files)
- ✅ CORS headers for frontend integration
- ✅ Performance with realistic file sizes

**Postman Collection Tips:**
- Save requests as a collection for easy re-testing
- Use environment variables for base URL (`{{baseUrl}}`)
- Test with various file types and sizes
- Verify response schemas match the contract
- Test error scenarios (malformed JSON, missing fields)

---

#### 5) Source-Agnostic Benefits for AI Development

**Why This Structure Helps You:**
- **Unified Processing**: Same parsing logic works for any source file combination
- **CDISC Native**: Structure matches how clinical data professionals think
- **Flexible Input**: Users can upload define.xml OR spec sheets OR raw datasets
- **Clear Traceability**: Always know which file contributed what data
- **Extensible**: Easy to add support for new file types or standards
- **Validation Ready**: Built-in structure for CDISC compliance checking

**Example Scenarios You Can Handle:**
1. **Define.xml Only**: Extract full metadata from define.xml files
2. **Spec Sheets Only**: Parse Excel/Word specification documents  
3. **Mixed Sources**: Combine define.xml metadata with raw .xpt validation
4. **Raw Datasets**: Infer structure from SAS/XPT files directly
5. **Document Analysis**: Extract variable definitions from PDF/Word docs

**Processing Strategy:**
```python
# Pseudo-code for source-agnostic processing
def process_files(uploaded_files):
    standards = {"SDTM": {}, "ADaM": {}, "CRF": {}, "TLF": {}}
    
    for file in uploaded_files:
        if file.type == "define.xml":
            # Extract comprehensive metadata
            extract_define_xml_metadata(file, standards)
        elif file.type == "spec.xlsx":
            # Parse specification sheets
            extract_spec_sheet_data(file, standards)
        elif file.type == "dataset.xpt":
            # Validate against existing metadata or infer structure
            validate_or_infer_from_dataset(file, standards)
        elif file.type == "acrf.pdf":
            # Extract CRF form structure
            extract_crf_structure(file, standards)
    
    return build_source_agnostic_response(standards)
```

---

#### 6) Your Complete Freedom

**What you control entirely:**
- All Python code organization in `backend/`
- Choice of Python libraries (pandas, numpy, scikit-learn, spacy, etc.)
- File parsing approach (python-xport, pandas, openpyxl, etc.)
- LLM integration (openai, anthropic, google-generativeai, etc.)
- Database/storage (if any - remember ephemeral processing)
- Logging, error handling, validation
- Additional endpoints for your own needs
- Environment variables and configuration

**What frontend provides:**
- File uploads via multipart form
- JSON requests for variable analysis
- Error handling for your HTTP responses

**Your only constraints:**
- Expose the 2 required endpoints
- Return JSON in the agreed format
- Handle CORS for frontend integration


