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

**Endpoint 1: `POST /process-files`**
- **Purpose**: Process uploaded files and return dataset/variable structure
- **Input**: Multipart form with files (aCRF, SDTM metadata, ADaM metadata)
- **Output JSON**:
```json
{
  "files": [
    {
      "filename": "define.xml",
      "type": "adam_metadata",
      "datasets": [
        {
          "name": "ADSL", 
          "variables": [
            {
              "name": "USUBJID",
              "label": "Unique Subject Identifier", 
              "type": "character",
              "length": 20,
              "role": "identifier"
            }
          ],
          "metadata": {...}
        }
      ]
    }
  ]
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

**Expected Response:**
```json
{
  "files": [
    {
      "filename": "define.xml",
      "type": "adam_metadata",
      "datasets": [
        {
          "name": "ADSL",
          "variables": [
            {
              "name": "USUBJID",
              "label": "Unique Subject Identifier",
              "type": "character", 
              "length": 20,
              "role": "identifier"
            },
            {
              "name": "AGE",
              "label": "Age at Baseline",
              "type": "numeric",
              "role": "covariate"
            }
          ],
          "metadata": {...}
        }
      ]
    }
  ]
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
  "files": [
    {
      "filename": "define.xml",
      "type": "adam_metadata",
      "datasets": [...]
    }
  ]
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
- ✅ File parsing accuracy (extract correct datasets/variables)
- ✅ JSON response format matches contract
- ✅ Error handling (invalid files, large files, missing files)
- ✅ Variable lineage analysis with confidence scores
- ✅ Gap detection in lineage chains
- ✅ CORS headers for frontend integration
- ✅ Performance with realistic file sizes

**Postman Collection Tips:**
- Save requests as a collection for easy re-testing
- Use environment variables for base URL (`{{baseUrl}}`)
- Test with various file types and sizes
- Verify response schemas match the contract
- Test error scenarios (malformed JSON, missing fields)

---

#### 5) Your Complete Freedom

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


