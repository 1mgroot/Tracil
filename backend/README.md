# Tracil Backend

FastAPI backend for processing clinical data files and AI-powered lineage analysis.

## Quick Start

1. **Setup environment:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # macOS/Linux
   # or venv\Scripts\activate  # Windows
   ```

2. **Install dependencies:**
   ```bash
   pip install pip-tools
   pip install -r requirements.txt
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env and add your OpenAI API key
   ```

4. **Start server:**
   ```bash
   uvicorn main:app --reload --port 8000
   ```

5. **Test:**
   ```bash
   curl http://localhost:8000/health
   ```

## What It Does

- **File Processing**: define.xml, SAS datasets, PDFs, DOCX, RTF
- **CDISC Standards**: SDTM, ADaM, CRF, TLF organization
- **AI Integration**: OpenAI-powered variable lineage analysis

## API Endpoints

- `GET /health` - Server health check
- `POST /process-files` - Process uploaded clinical data files
- `POST /analyze-variable` - Generate AI-powered lineage analysis

## Environment Variables

- `OPENAI_API_KEY` - Required for AI lineage analysis
- `ALLOWED_ORIGINS` - CORS origins (default: http://localhost:3000)

## File Support

- **Metadata**: define.xml, specification sheets
- **Datasets**: SAS XPT (.xpt), SAS7BDAT, JSON
- **Documents**: PDF, DOCX, RTF (CRF, Protocol, TLF)

## Development

- **Interactive API Docs**: http://localhost:8000/docs
- **Auto-reload**: Server restarts on code changes
- **Modular Services**: Separate modules for different file types

## Dependencies

- **Core**: FastAPI, uvicorn, pydantic
- **Data**: pandas, numpy, pyreadstat
- **AI**: openai
- **Files**: PyMuPDF, python-docx, striprtf

## Architecture

- **FastAPI**: Modern web framework
- **Ephemeral**: No server-side file persistence
- **CDISC-First**: Data organized by clinical standards