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

### Accessibility Support

Tracil is built with **accessibility-first** principles, ensuring the platform is usable by everyone, including users with disabilities.

**WCAG 2.2 AA Compliance:**
- ✅ Full keyboard navigation support
- ✅ Screen reader compatibility (ARIA labels, roles, properties)
- ✅ High contrast color schemes (OKLCH color space)
- ✅ Focus management and visual indicators
- ✅ Semantic HTML structure
- ✅ Alternative text for images and icons

**Accessibility Features:**
- **Keyboard Navigation**: Complete interface control without mouse
  - Tab/Shift+Tab for navigation
  - Enter/Space for activation
  - Arrow keys for lists and grids
  - Escape to close modals/dropdowns
- **Screen Reader Support**: Comprehensive ARIA implementation
  - Descriptive labels for all interactive elements
  - Live regions for dynamic content updates
  - Proper heading hierarchy (h1-h6)
  - Table headers and captions for data
- **Visual Accessibility**: 
  - 4.5:1 minimum contrast ratio (AAA level)
  - Scalable text up to 200% without horizontal scrolling
  - No reliance on color alone for information
  - Reduced motion support for vestibular disorders
- **Cognitive Accessibility**:
  - Clear, consistent navigation patterns
  - Descriptive error messages and validation
  - Timeout warnings and extensions
  - Help text and tooltips for complex interactions

**Testing & Validation:**
- Automated accessibility testing with axe-core
- Manual keyboard navigation testing
- Screen reader testing (NVDA, JAWS, VoiceOver)
- Color contrast validation
- 122 accessibility tests in the test suite

**Keyboard Shortcuts:**
- `Cmd/Ctrl + B`: Toggle sidebar
- `Tab`: Navigate forward through interactive elements
- `Shift + Tab`: Navigate backward
- `Enter/Space`: Activate buttons and links
- `Escape`: Close modals and dropdowns
- `Arrow Keys`: Navigate within data grids and lists

For accessibility feedback or support requests, please open an issue with the `accessibility` label.

### Deploy
- Frontend: Vercel (environment variables in project settings)
- Backend: AI Developer's choice of Python deployment platform
