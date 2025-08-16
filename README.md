### Tracil — Developer Quickstart (Monorepo)

Next.js frontend + Python AI backend in a single repository. See `DESIGN.md` and `backend/AI_DEV_GUIDE.md` for details.

### Prerequisites
- Node 18+ and npm (for frontend)
- Python 3.9+ and pip (for backend)
- Optional: Vercel CLI for frontend deploys

### Quick Start

**Frontend Development:**
```bash
# Install and run frontend
npm install
npm run frontend:dev
# open http://localhost:3000
```

**Backend Development (AI Developer):**
```bash
# Set up Python backend
cd backend
# Follow backend/AI_DEV_GUIDE.md for setup
# AI Developer has complete freedom over backend implementation
```

### Monorepo Structure
```
/
├── frontend/           # Next.js Application
│   ├── app/           # App Router pages
│   ├── components/    # Shared UI primitives  
│   ├── features/      # UI-only vertical modules
│   └── ...
├── backend/           # Python AI Backend (AI Developer's Domain)
│   ├── AI_DEV_GUIDE.md # Complete guide for AI developer
│   └── .env.example   # Backend environment template
├── .env.example       # Root environment template
└── DESIGN.md         # Complete architecture documentation
```

### Environment Setup

**Copy environment templates:**
```bash
# Frontend environment
cp frontend/.env.example frontend/.env.local

# Backend environment (AI Developer)
cp backend/.env.example backend/.env
```

### Team Roles

**Frontend Developer:**
- Owns `frontend/` folder completely
- Builds UI with mock API responses initially
- Later connects to Python backend via API calls

**AI Developer:**
- Owns `backend/` folder completely
- Complete freedom over Python code organization
- Only requirement: expose 2 API endpoints (see `backend/AI_DEV_GUIDE.md`)

### Development Scripts
```bash
# Frontend
npm run frontend:dev    # Start Next.js dev server
npm run frontend:build  # Build frontend
npm run frontend:test   # Run frontend tests

# Backend (AI Developer sets up their own scripts)
npm run backend:dev     # Placeholder - AI Developer implements
```

### Integration
- Phase 1: Both teams develop independently
- Phase 2: Connect via HTTP API calls (no Docker needed)
- Phase 3: Optional Docker setup for production

### Deploy
- Frontend: Vercel (environment variables in project settings)
- Backend: AI Developer's choice of Python deployment platform
