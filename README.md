# FindAI • University Lost & Found Platform

An intelligent, AI-powered university lost-and-found matching platform featuring local multimodal embeddings (text via `all-MiniLM-L6-v2` and vision via `CLIP ViT-B/32`), student registry verification, secure claim verification with dual-party confirmation, and comprehensive administrative moderation.

---

## Project Structure

The project is organized into clean, dedicated directories:

```text
FindAI/
│
├── frontend/                     # Modern React 19 + Vite Frontend SPA
│   ├── public/                   # Static assets & icons
│   ├── src/
│   │   ├── assets/               # Visual media & branding assets
│   │   ├── components/           # Reusable UI components (Modals, Dropdowns, Badges)
│   │   │   └── ui/               # Core atomic design system primitives
│   │   ├── context/              # React Context providers (AuthContext)
│   │   ├── hooks/                # Custom hooks (useDebounce, useAutoRefresh)
│   │   ├── layouts/              # Dashboard & navigation layouts (AdminLayout, StudentLayout)
│   │   ├── lib/                  # Client utility libraries & Supabase client
│   │   ├── pages/                # Application views (Student, Admin, Community, Auth)
│   │   ├── services/             # Frontend API service layer (claims, reports, incidents)
│   │   └── styles/               # Global styling & Tailwind directives (App.css, index.css)
│   ├── index.html                # Frontend HTML entry point
│   ├── package.json              # Frontend package configuration
│   └── vite.config.js            # Vite configuration with proxy and credential protection
│
├── backend/                      # Node.js Express API & AI Matching Engine
│   ├── ai/                       # Multimodal AI matching subsystem
│   │   ├── textMatcher/          # Semantic text embeddings & multi-factor fusion
│   │   ├── imageMatcher/         # CLIP ViT-B/32 visual embeddings & cosine similarity
│   │   ├── metrics.js            # Information retrieval metrics (P@K, R@K, MRR)
│   │   ├── evaluate.js           # Comparative evaluation benchmark harness
│   │   └── benchmarkDataset.js   # Controlled evaluation dataset
│   ├── src/
│   │   ├── config/               # Environment validation & hardening (envConfig.js)
│   │   ├── middleware/           # Authentication, role verification, & rate limiting
│   │   ├── routes/               # API route definitions (admin, student, claims, community)
│   │   └── services/             # Core business logic (claims, validation, handovers)
│   ├── tests/                    # 17 automated test suites (zero regressions)
│   ├── index.js                  # Express backend entry point
│   └── package.json              # Backend package configuration
│
├── supabase/                     # Supabase database & infrastructure
│   ├── migrations/               # Chronological PostgreSQL schema migrations
│   ├── drafts/                   # Archived draft migrations
│   └── config.toml               # Local Supabase configuration
│
├── scripts/                      # Operational administration & data maintenance scripts
│   ├── activateRegisteredStudents.js
│   ├── inspectStudents.js
│   └── updateAdminUserRole.js
│
├── docs/                         # Project documentation, designs, & specifications
│   ├── design/                   # UI design review & architecture specifications
│   └── design-references/        # Wireframes and high-fidelity mockups
│
├── .gitignore                    # Git ignore rules (protecting .env, credentials, student CSVs)
├── package.json                  # Root npm workspace configuration & orchestration scripts
└── README.md                     # Project documentation
```

---

## Quick Start & Development

### 1. Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0

### 2. Environment Setup
Copy the development environment template:
```bash
cp .env.local.example .env.local
```
Provide your local/development Supabase credentials in `.env.local`:
```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

> **Security Note:** Service-role keys and database secrets are strictly backend-only. The frontend Vite configuration and runtime guards explicitly block any `VITE_` variables containing service keys.

### 3. Install Dependencies
Install all workspace dependencies from root:
```bash
npm install
```

### 4. Running the Application

| Command | Description |
| :--- | :--- |
| `npm start` or `npm run dev:all` | Runs backend API (Port 3001) and frontend (Port 5173) concurrently |
| `npm run dev` | Runs the Vite frontend development server with HMR |
| `npm run server` | Starts the Express AI matching backend |
| `npm run build` | Builds the frontend for production into `frontend/dist` |
| `npm run start:prod` | Builds the frontend and starts the backend in production mode |
| `npm test` | Runs all 17 automated backend, security, and AI test suites |
| `npm run evaluate:ai` | Runs the comparative AI matching benchmark suite |
| `npm run lint` | Runs the fast Oxlint code verification on `frontend/src` |

---

## Security & Verification Architecture

1. **Student Verification & RLS**: Authenticated access requires valid university student registry enrollment. Ordinary students cannot modify admin records or bypass verification.
2. **Dual-Party Handover**: Resolving a claim requires mutual confirmation from both the verified finder and claimant. Suspicious velocity triggers automatic temporary handover holds.
3. **Multimodal AI Matching**: Multi-factor scoring combines semantic text embeddings (`all-MiniLM-L6-v2`), CLIP visual similarity (`ViT-B/32`), category matching, color distance, temporal proximity, and location token overlap.
4. **Zero Frontend Secret Leaks**: Strict validation prevents service-role credentials from being bundled into client builds.
