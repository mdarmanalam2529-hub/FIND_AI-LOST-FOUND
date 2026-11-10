# FindAI • University Lost & Found Platform

An intelligent, AI-powered university lost-and-found matching platform featuring local multimodal embeddings (text via `all-MiniLM-L6-v2` and vision via `CLIP ViT-B/32`), student registry verification, secure claim verification with dual-party confirmation, and comprehensive administrative moderation.

---

## Architecture Overview

```text
               ┌─────────────────────────────────────────┐
               │         Vercel (Frontend SPA)           │
               │         React 19 + Vite + Tailwind      │
               └────────────────────┬────────────────────┘
                                    │
               ┌────────────────────┴────────────────────┐
               │                                         │
        (Direct HTTPS)                         (Auth & Realtime)
               ▼                                         ▼
┌───────────────────────────────┐        ┌───────────────────────────────┐
│     Render (Backend API)      │        │       Supabase Cloud          │
│   Node.js 20+ Express Engine  │───────▶│     PostgreSQL + Auth + RLS   │
│   • Local MiniLM-L6-v2 Text   │        │     • student_registry & auth │
│   • Local CLIP ViT-B/32 Vision│        │     • private item-images     │
│   • Dual-Party Handover Engine│        │     • audit logs & incidents  │
└───────────────────────────────┘        └───────────────────────────────┘
```

---

## Project Structure

```text
FindAI/
│
├── frontend/                     # Modern React 19 + Vite Frontend SPA
│   ├── public/                   # Static assets & icons
│   ├── src/
│   │   ├── assets/               # Visual media & branding assets
│   │   ├── components/           # Reusable UI components & modals
│   │   │   └── ui/               # Core design system primitives (StatusBadge, Modal)
│   │   ├── context/              # React Context providers (AuthContext, ThemeContext)
│   │   ├── hooks/                # Custom hooks (useDebounce, useAutoRefresh)
│   │   ├── layouts/              # View layouts (AdminLayout, StudentLayout, PublicLayout)
│   │   ├── lib/                  # Client utility libraries (apiConfig.js, supabase.js)
│   │   ├── pages/                # Application views (Student, Admin, Community, Auth)
│   │   ├── services/             # Frontend API service layer (claims, reports, incidents)
│   │   └── styles/               # Global styling (App.css, index.css)
│   ├── .env.example              # Frontend environment variable template
│   ├── index.html                # Frontend HTML entry point
│   ├── package.json              # Frontend package configuration
│   ├── vercel.json               # Vercel SPA rewrite configuration
│   └── vite.config.js            # Vite configuration with security credential guard
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
│   ├── .env.example              # Backend environment variable template
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
├── render.yaml                   # Render Blueprint deployment specification
├── vercel.json                   # Root Vercel SPA route rewrite fallback
├── .gitignore                    # Protected rules (*.csv, .env*, dist, node_modules)
├── package.json                  # Root npm workspace configuration & orchestration scripts
└── README.md                     # Project documentation
```

---

## Production Deployment Guide

### A. Backend Deployment on Render

Deploy the Node.js Express & AI Matching Engine on Render using either the web dashboard or Blueprints.

#### 1. Recommended Hardware / Sizing
* **Full Multimodal AI (MiniLM Text + CLIP Vision)**: Requires **Starter Plan (2GB RAM, 1 CPU)** or higher.
  * `all-MiniLM-L6-v2` consumes ~80MB RAM.
  * `CLIP ViT-B/32` consumes ~350MB RAM.
* **Low-Resource / Free Tier (512MB RAM)**: If deploying on Render's 512MB free tier, set `DISABLE_CLIP_IMAGE_MATCHER=true` in Render environment variables. The server will automatically use semantic text matching and metadata fusion while disabling vision embedding to avoid Out-Of-Memory (OOM) errors.

#### 2. Manual Web Service Configuration on Render
1. In the **Render Dashboard**, click **New +** $\to$ **Web Service**.
2. Connect your GitHub repository.
3. Configure the service settings:
   * **Name**: `findai-backend` (or your chosen name)
   * **Root Directory**: `backend`
   * **Environment**: `Node`
   * **Build Command**: `npm install`
   * **Start Command**: `npm start`
   * **Health Check Path**: `/api/health`
4. Add the following **Environment Variables** in the Render Dashboard:

| Variable | Description | Example / Required Value |
| :--- | :--- | :--- |
| `NODE_ENV` | Production execution mode | `production` |
| `PORT` | Listening port (assigned by Render) | `10000` |
| `SUPABASE_URL` | Supabase Project URL | `https://your-project.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase Anon Public Key | `your-supabase-anon-key` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Secret Key | `your-service-role-secret-key` |
| `ADMIN_EMAILS` | Comma-separated admin accounts | `admin@university.edu,security@university.edu` |
| `CORS_ALLOWED_ORIGINS` | Allowed frontend origin(s) | `https://your-app.vercel.app` |
| `FRONTEND_URL` | Primary frontend web address | `https://your-app.vercel.app` |
| `DISABLE_CLIP_IMAGE_MATCHER` | Disable vision on $\le$ 512MB RAM | `false` (or `true` if on free tier) |

5. Click **Deploy Web Service**.
6. Once deployed, copy your Render service URL: `https://<service-name>.onrender.com`.

---

### B. Frontend Deployment on Vercel

Deploy the React 19 + Vite frontend application on Vercel.

#### 1. Vercel Project Setup
1. In the **Vercel Dashboard**, click **Add New...** $\to$ **Project**.
2. Import your GitHub repository.
3. In **Project Settings**:
   * **Framework Preset**: `Vite`
   * **Root Directory**: click **Edit** and select `frontend`
   * **Build Command**: `npm run build` (or `vite build`)
   * **Output Directory**: `dist`
4. Add the following **Environment Variables** in Vercel:

| Variable | Description | Value |
| :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | Supabase Project URL | `https://your-project.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase Public Anon Key | `your-supabase-anon-key` |
| `VITE_SUPABASE_PUBLISHABLE_KEY`| Supabase Public Anon Key (alias) | `your-supabase-anon-key` |
| `VITE_API_URL` | Render Backend API URL | `https://findai-backend.onrender.com` |

> **Security Warning**: NEVER add `SUPABASE_SERVICE_ROLE_KEY` to Vercel environment variables. The Vite build system includes an automated security gate that aborts the build if any service-role key is detected in frontend variables.

5. Click **Deploy**.
6. After Vercel completes deployment, copy the frontend URL and add it to `CORS_ALLOWED_ORIGINS` in your Render backend settings.

---

### C. Supabase Configuration Checklist

Ensure your Supabase project settings match the production deployment:

1. **Authentication $\to$ URL Configuration**:
   * **Site URL**: `https://your-app.vercel.app`
   * **Redirect URLs**:
     * `https://your-app.vercel.app/**`
     * `http://localhost:5173/**` (for local development)
     * `http://localhost:5174/**` (for local development)
2. **Storage Bucket**:
   * Verify the `item-images` private storage bucket exists.
   * Access is secured by Row-Level Security policies defined in `supabase/migrations/20261018110000_create_item_images_storage.sql`.
3. **Database Migrations**:
   * Ensure migrations `20261018100000` through `20261026100000` have been executed in your Supabase SQL editor.
   * Never apply non-active draft files located in `supabase/drafts/`.

---

## Local Development & Testing

### 1. Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0

### 2. Environment Setup
Copy the development environment template:
```bash
cp .env.local.example .env.local
```
Provide your local development Supabase credentials in `.env.local`:
```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

### 3. Running Locally

| Command | Action |
| :--- | :--- |
| `npm start` or `npm run dev:all` | Runs backend API (Port 3001) and frontend (Port 5173/5174) concurrently |
| `npm run dev` | Runs the Vite frontend development server with HMR |
| `npm run server` | Starts the Express AI matching backend |
| `npm run build` | Builds the frontend for production into `frontend/dist` |
| `npm run start:prod` | Builds the frontend and starts the backend in production mode |
| `npm test` | Runs all 17 automated backend, security, and AI test suites |
| `npm run evaluate:ai` | Runs the comparative AI matching benchmark harness |
| `npm run lint` | Runs the fast Oxlint code verification on `frontend/src` |

---

## Common Deployment Troubleshooting

### 1. CORS Errors in Browser
* **Symptom**: `Access to fetch at 'https://...' has been blocked by CORS policy`
* **Resolution**: In your Render Dashboard, add your Vercel deployment URL to `CORS_ALLOWED_ORIGINS` (e.g. `https://findai.vercel.app`). Wildcards for Vercel preview branches (`https://.*\.vercel\.app`) are supported automatically.

### 2. Render Deployment Out-Of-Memory (OOM)
* **Symptom**: Service crashes with `Exit status 137` during model loading.
* **Resolution**: If using Render's 512MB free tier, add `DISABLE_CLIP_IMAGE_MATCHER=true` to Render environment variables. For full multimodal vision + text embeddings, upgrade to Render Starter (2GB RAM).

### 3. Vercel 404 on Page Refresh
* **Symptom**: Navigating directly to `/student/dashboard` or `/admin/reports` gives 404.
* **Resolution**: Handled automatically by `frontend/vercel.json` SPA rewrites. Ensure Vercel Root Directory is set to `frontend`.

### 4. Build Aborted: Service-Role Key Detected
* **Symptom**: `[Security Fatal] Privileged credential detected in client variable`
* **Resolution**: Remove any secret keys from `VITE_` variables. `SUPABASE_SERVICE_ROLE_KEY` must only exist in backend environment settings.
