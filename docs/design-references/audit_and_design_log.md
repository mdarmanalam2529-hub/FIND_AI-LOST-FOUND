# FindAI — Architectural Audit & Design Decision Log

**Project:** FindAI University Lost-and-Found Platform  
**Date:** November 1, 2026  
**Status:** Phase 1 Complete / Phase 3 Visual Reference Generation  
**Role:** Principal UI/UX Architect & Senior React Engineer  

---

## 1. Comprehensive Repository Audit

### 1.1 Architecture & Entry Points
- **Frontend Framework:** React 19 with Vite 8.3.4, React Router DOM v7.
- **Backend Framework:** Node.js with Express 5, Supabase JS Client (`@supabase/supabase-js`), `@xenova/transformers` (MiniLM text embeddings and CLIP ViT-B/32 visual embeddings).
- **Styling Architecture:** Plain CSS with modern CSS Custom Properties (`src/index.css`, `src/App.css`), Lucide React icons (`lucide-react`).
- **Database & Storage:** PostgreSQL with Supabase RLS policies and private storage bucket `item-images` with presigned URLs.

### 1.2 Route & Page Inventory
| Route Path | Component | Protected / Role | Purpose / Status |
| :--- | :--- | :--- | :--- |
| `/` | `Home.jsx` | Public | Public flagship landing page, features, how it works, FAQ, trust principles |
| `/report-lost` | `ReportLost.jsx` | Public / Student | Multi-step form for reporting lost belongings |
| `/report-found` | `ReportFound.jsx` | Public / Student | Multi-step form for reporting found belongings with photo upload |
| `/login` | `Login.jsx` | Public | Student & Staff authentication with rate limiting |
| `/signup` | `SignUp.jsx` | Public | University student registration & enrollment verification |
| `/forgot-password` | `ForgotPassword.jsx` | Public | Password reset request |
| `/reset-password` | `ResetPassword.jsx` | Public | Password reset token completion |
| `/dashboard` | `Dashboard.jsx` | Protected (Student) | Central workspace: Overview, My Reports, AI Matches, Claims, Handovers |
| `/community` | `Community.jsx` | Protected (Student) | Campus Community Feed with live stats, search, filtering, and abuse reporting |
| `/change-password` | `ChangePassword.jsx` | Protected | In-app authenticated password change |
| `/admin/dashboard` | `Dashboard.jsx` | Admin / Staff | Admin overview with operational metrics |
| `/admin/reports` | `AdminReports.jsx` | Admin / Staff | Full report review queue, AI candidate inspection, moderation actions, community flags |
| `/admin/claims` | `AdminClaims.jsx` | Admin / Staff | Claims management, dispute resolution, ownership proof review |
| `/admin/handovers` | `AdminHandovers.jsx` | Admin / Staff | Handover operations, campus pickup desks, completion logs |
| `/admin/incidents` | `AdminIncidents.jsx` | Admin / Staff | Security incidents, failed attempts, audit investigations |
| `/admin/students` | `AdminStudentManagement.jsx`| Primary Admin | Student registry inspection and activation management |
| `/admin/import-students`| `AdminImportStudents.jsx`| Primary Admin | CSV student registry batch import |
| `/admin/users` | `AdminUserManagement.jsx` | Primary Admin | Staff role assignments and permissions |

### 1.3 Backend API Contracts Preserved
1. `POST /api/matches`: Semantic MiniLM text + CLIP visual matching with weight normalizations.
2. `GET /api/claims`, `POST /api/claims`, `PATCH /api/claims/:id`: Two-party claim submission, approval, rejection, and dispute tracking.
3. `POST /api/handovers/:id/confirm`: Dual-confirmation return workflow requiring both finder and claimant confirmation.
4. `GET /api/community/items`, `POST /api/community/items/:id/report`: Filtered public community listings with PII sanitization and student abuse reporting.
5. `GET /api/admin/*`: Protected admin queues for reports, claims, handovers, incidents, and audit logs.

### 1.4 Existing UI Weaknesses & Audit Findings
1. **Monolithic Dashboard:** `src/pages/Dashboard.jsx` currently stretches to 1,586 lines, combining student overview, reports, AI matches, claims, handovers, and admin stats into a single file with complex nested ternary conditionals.
2. **Missing Action-Oriented Dashboard View:** The student dashboard needs a dedicated landing overview featuring time-based greetings, live statistic cards, quick action shortcuts, chronological recent activity, and an "Action Required" urgent panel.
3. **Sidebar Grouping Inconsistencies:** The workspace sidebar currently uses informal grouping. It must follow the master specification:
   - **MAIN:** Dashboard, Community
   - **MY ACTIVITY:** My Reports, AI Matches, My Claims, Handovers
   - **ACCOUNT:** Notifications, Identity Verification, Profile & Settings
4. **Navbar Global Search & Notifications:** Currently, global search is distributed across pages. A unified 420px global command search (`Ctrl+K`) with categorized results and an accessible notifications drawer is needed.
5. **Brand Polish & Uniformity:** Ensure strict adherence to the permanent university SaaS palette: `#F5F7FB` background, `#FFFFFF` cards, `#2563EB` primary blue, `#6366F1` indigo, and Fira Sans typography.

---

## 2. Design System Tokens & Typography Scale

### 2.1 Design Tokens
```css
:root {
  --bg-app: #F5F7FB;                  /* Permanent light canvas */
  --bg-surface: #FFFFFF;              /* Crisp card surface */
  --bg-subtle: #F8FAFC;               /* Secondary muted surface */
  --bg-nav-active: #EFF6FF;           /* Active navigation item background */
  
  --primary: #2563EB;                 /* Electric university blue */
  --primary-hover: #1D4ED8;
  --primary-subtle: rgba(37, 99, 235, 0.08);
  --primary-border: rgba(37, 99, 235, 0.2);
  
  --indigo: #6366F1;                  /* Brand indigo accent */
  --indigo-subtle: rgba(99, 102, 241, 0.08);
  
  --found-accent: #10B981;            /* Emerald green for Found items */
  --found-subtle: rgba(16, 185, 129, 0.08);
  
  --lost-accent: #EF4444;             /* Coral red for Lost items / Urgent */
  --lost-subtle: rgba(239, 68, 68, 0.08);
  
  --warning-accent: #F59E0B;          /* Amber for Claims / Important */
  --warning-subtle: rgba(245, 158, 11, 0.08);
  
  --text-main: #0F172A;               /* Dark neutral slate text */
  --text-secondary: #475569;          /* Medium body text */
  --text-muted: #64748B;              /* Secondary description text */
  --text-dim: #94A3B8;                /* Inactive labels / timestamps */
  
  --border-subtle: #E2E8F0;           /* Subtle card border */
  --border-muted: #CBD5E1;
  
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 12px;                  /* Standard card radius (~12px) */
  --radius-xl: 16px;
  --radius-full: 9999px;
  
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.04);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.03);
  --shadow-lg: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
}
```

### 2.2 Typography Scale (Fira Sans)
- **Page Titles:** 28px / 1.2 line-height, 800 bold.
- **Section Headings:** 18px / 1.3 line-height, 600 semibold.
- **Card Headings:** 16px / 1.4 line-height, 600 medium.
- **Body Text:** 14–16px / 1.5 line-height, 400 regular / 500 medium.
- **Supporting / Captions:** 12–13px / 1.4 line-height, 500 medium.
- **Metric Numbers:** 24–28px / 1.1 line-height, 800 bold.
- **Buttons & Tags:** 14px / 1.0 line-height, 600 semibold.

---

## 3. Student Dashboard Modular Frontend Architecture

To replace the monolithic 1,586-line file cleanly without altering any backend dependencies, the Student Dashboard will be organized modularly:

```text
src/
  pages/
    Dashboard.jsx                      <-- Clean orchestrator page component
  components/
    dashboard/
      DashboardWelcome.jsx             <-- Time-based greeting, date, summary
      DashboardStats.jsx               <-- 4 KPI cards (Reports, Matches, Claims, Handovers)
      QuickActions.jsx                 <-- Report Lost / Report Found cards
      RecentActivity.jsx               <-- 4-category vertical event timeline
      ActionRequired.jsx               <-- Urgent / Important action cards with direct actions
      DashboardSkeleton.jsx            <-- Precision layout-matching loading skeletons
      DashboardError.jsx               <-- Section-level error boundaries with retry
      GlobalSearchModal.jsx            <-- Command palette (Ctrl+K) with categorized results
    ui/
      AppSidebar.jsx                   <-- 250px/72px responsive grouped navigation
      Navbar.jsx                       <-- 64px sticky navbar with 420px search & notifications
```

---

## 4. Visual References Directory Map
- `design-references/student-dashboard/desktop/student_dashboard_desktop.png` (Desktop 1440x900)
- `design-references/student-dashboard/tablet/student_dashboard_tablet.png` (Tablet 1024x768)
- `design-references/student-dashboard/mobile/student_dashboard_mobile.png` (Mobile 390x844)
- `design-references/student-dashboard/interaction-states/global_search_modal.png` (Ctrl+K Command Palette)

---
*Signed by FindAI Principal UI/UX Architect.*

