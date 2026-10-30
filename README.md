# FindAI • Intelligent Lost & Found Matcher

An AI-powered Lost and Found platform built with React, Vite, Supabase PostgreSQL, and local semantic text embeddings (`all-MiniLM-L6-v2`).

---

## Architecture Overview

```text
[Frontend: React + Vite]  (Port 5173)
           │
           │  (Vite Proxy: /api/* -> http://localhost:3001)
           ▼
[Backend: Node.js Express] (Port 3001)
           ├── Bearer Token Verification via Supabase Auth
           ├── PostgreSQL queries scoped to user RLS (public.items)
           ├── Local all-MiniLM-L6-v2 Semantic Embeddings
           └── Multi-Factor Fusion Ranking (Text, Category, Color, Date, Location)
```

---

## Required Environment Variables

Create a local `.env` file in the project root (never commit to Git; see `.env.example`):

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
```

> **Security Note:** Never add `service_role` keys, database passwords, or privileged secrets to frontend or environment files. The backend verifies identities and queries Postgres using user-scoped Bearer tokens.

---

## Installation & Setup

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Database Migrations:**
   Run the migration scripts in your **Supabase Dashboard -> SQL Editor** in sequential order:
   - `supabase/migrations/20261018100000_create_items_table.sql` (Items schema & base RLS)
   - `supabase/migrations/20261018110000_create_item_images_storage.sql` (Private storage bucket)
   - `supabase/migrations/20261019100000_create_hybrid_claims_system.sql` (Claims & handovers)
   - `supabase/migrations/20261019110000_add_admin_and_update_policies.sql` (Admin policies)
   - `supabase/migrations/20261023100000_harden_claim_and_admin_authorization.sql` (Authorization hardening)
   - `supabase/migrations/20261025100000_harden_foreign_key_preservation.sql` (FK preservation)
   - `supabase/migrations/20261025110000_create_student_registry_and_profiles.sql` (Student registry & profiles)
   - `supabase/migrations/20261025120000_create_account_recovery_and_audit_logs.sql` (Account recovery & audit)
   - `supabase/migrations/20261026100000_create_handover_incidents_and_verification.sql` (Handover holds & incidents)

---

## Running the Application

### 1. Combined Run (Backend + Frontend together)
Run both the AI Express API and the Vite React frontend concurrently with a single command:
```bash
npm start
# or: npm run dev:all
```
* **Frontend**: `http://localhost:5173` (with Vite HMR)
* **Backend API**: `http://localhost:3001` (with `/api` proxied from `http://localhost:5173/api`)

---

### Separate Services (Optional)
If you prefer running them in separate terminals:

1. **Start the AI Matching Service (Backend):**
   ```bash
   npm run server
   ```
2. **Start the Frontend (Vite):**
   ```bash
   npm run dev
   ```

---

## Running Automated Tests

Run the full AI Matching and API test suite:

```bash
# 1. Run AI Semantic Matcher unit & scoring logic tests:
node server/testAiMatcher.js

# 2. Run HTTP API security & endpoint verification tests:
node server/testApiEndpoints.js
```

---

## API Endpoints

### `GET /api/health`
Checks backend and model readiness.
* **Response:**
  ```json
  {
    "status": "ok",
    "service": "FindAI Semantic Matching API",
    "model": "Xenova/all-MiniLM-L6-v2"
  }
  ```

### `POST /api/matches`
Finds, scores, and ranks candidate matches.
* **Headers:** `Authorization: Bearer <supabase_access_token>`
* **Body:**
  ```json
  {
    "targetItemId": "uuid-of-target-report",
    "limit": 10
  }
  ```
* **Response:** Ranked candidates with similarity score percentages, itemized breakdowns (`textSimilarityPct`, `categoryMatch`, `colorScorePct`, `dateProximityPct`, `locationSimilarityPct`), sanitized locations, and proof-of-ownership disclaimers.
