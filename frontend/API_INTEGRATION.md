# Frontend-Backend API Integration

This document explains how the frontend is now connected to the Python backend following the best practices outlined in DESIGN.md.

## Architecture Overview

```
Frontend (Next.js) ←→ Next.js API Routes ←→ Python Backend (FastAPI)
```

- **Frontend**: React components that consume data from Next.js API routes
- **Next.js API Routes**: Proxy requests to Python backend and handle frontend-specific logic
- **Python Backend**: Processes files and performs AI analysis

## API Endpoints

### 1. Process Files (`/api/ai/process-files`)

**Purpose**: Get CDISC-organized data structure from processed files

**Current Status**: ✅ **FULLY CONNECTED** - Returns real data from Python backend
**Implementation**: Next.js API route fetches data from Python backend's GET `/process-files` endpoint

**Response**: `SourceAgnosticProcessFilesResponse` with:
- **SDTM**: 22 domains (TA, TE, TI, TS, TV, DM, SE, SV, CM, EX, AE, DS, MH, LB, QS, SC, VS, RELREC, SUPPAE, SUPPDM, SUPPDS, SUPPLB)
- **ADaM**: 10 datasets (ADSL, ADAE, ADLBC, ADLBH, ADLBHY, ADQSADAS, ADQSCIBC, ADQSNPIX, ADTTE, ADVS)
- **CRF**: CRF with 1088 variables
- **TLF**: Combined TLF with 109 tables/figures
- **Total**: 371 variables processed

**Usage**: Frontend calls this endpoint to get the latest processed data from uploaded files

### 2. Analyze Variable (`/api/ai/analyze-variable`)

**Purpose**: Analyze variable lineage and traceability

**Current Status**: ✅ **FULLY CONNECTED** - Proxies to Python backend
**Implementation**: Next.js API route forwards requests to Python backend's POST `/analyze-variable` endpoint

**Request**: `AnalyzeVariableRequest` with variable name and dataset
**Response**: `AnalyzeVariableResponse` with lineage analysis

## Data Flow

### 1. File Upload (Current: Manual to Backend)
```
User → curl POST /process-files → Python Backend → Session Storage
```

### 2. Data Retrieval (Current: Automatic)
```
Frontend → GET /api/ai/process-files → Next.js API → GET /process-files → Python Backend → Session Data
```

### 3. Variable Analysis (Current: On-Demand)
```
Frontend → POST /api/ai/analyze-variable → Next.js API → POST /analyze-variable → Python Backend → AI Analysis
```

## Current Status

✅ **Frontend-Backend Connection**: Fully operational
✅ **Real Data Display**: Frontend shows actual data from uploaded files
✅ **API Proxy**: Next.js routes successfully proxy to Python backend
✅ **Error Handling**: Graceful fallbacks when backend is unavailable
✅ **Health Checks**: Built-in health monitoring for backend status

## Testing

### Backend Health Check
```bash
curl "http://localhost:3000/api/ai/process-files?health=true"
```

### Get Processed Data
```bash
curl http://localhost:3000/api/ai/process-files
```

### Analyze Variable
```bash
curl -X POST http://localhost:3000/api/ai/analyze-variable \
  -H "Content-Type: application/json" \
  -d '{"variable":"AGE","dataset":"ADSL"}'
```

## Future Enhancements

### 1. File Upload from Frontend
- Implement drag-and-drop file upload in frontend
- Forward files to Python backend through Next.js API
- Real-time progress updates

### 2. Enhanced Error Handling
- Better error messages for specific failure modes
- Retry logic for transient failures
- Offline mode with cached data

### 3. Real-time Updates
- WebSocket connection for live data updates
- Push notifications for processing completion
- Collaborative editing capabilities

## Troubleshooting

### Common Issues

1. **Backend Unavailable**
   - Check if Python backend is running on port 8000
   - Verify CORS configuration in backend
   - Check backend logs for errors

2. **No Data Displayed**
   - Ensure files have been uploaded to backend
   - Check browser console for API errors
   - Verify Next.js API route is working

3. **CORS Errors**
   - Backend CORS is configured for `http://localhost:3000`
   - Frontend uses Next.js API routes to avoid cross-origin issues

### Debug Commands

```bash
# Check backend status
curl http://localhost:8000/health

# Check frontend API
curl http://localhost:3000/api/ai/process-files

# Check backend data directly
curl http://localhost:8000/process-files
```

## Architecture Benefits

1. **Separation of Concerns**: Frontend handles UI, backend handles AI processing
2. **Scalability**: Can easily add more backend instances behind load balancer
3. **Security**: API keys and sensitive operations isolated in Python backend
4. **Maintainability**: Clear API contracts between frontend and backend
5. **Testing**: Can test frontend with mock API responses, backend independently
