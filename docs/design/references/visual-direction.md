# FindAI Design Reference & Visual Direction

## 1. Executive Summary & Design Vision
FindAI is an institutional and enterprise-grade lost-and-found intelligence platform engineered for modern universities, corporate campuses, and large-scale public institutions. The redesign transforms FindAI from a casual college project into a high-trust, mission-critical SaaS operations platform on par with industry benchmarks like **Linear**, **Stripe Dashboard**, and **Vercel**.

---

## 2. Flagship Generated Mockup Anchors
The following flagship UI mockups have been generated and saved to `design/mockups/`:

| Screen # | Mockup File | Pillar | Key Features |
|---|---|---|---|
| **Screen 1** | `design/mockups/01-landing-page-desktop.png` | **Public Gateway** | Deep navy (#101828) base, electric indigo (#635BFF) and soft violet (#8B5CF6) accents, exact headline *"Lost Something on Campus? Let AI Help You Find It."*, floating interactive AI match preview cards, category filter pills, verified institutional trust badges. |
| **Screen 7** | `design/mockups/07-student-dashboard.png` | **Student Workspace** | Linear/Stripe hybrid layout, clean left sidebar navigation, top header with profile and notifications, 5 KPI metric cards (Total Lost, Total Found, Potential AI Matches, Active Claims, Pending Handovers), recent activity timeline, recommended action cards. |
| **Screen 18** | `design/mockups/18-admin-dashboard.png` | **Administrative Console** | Enterprise command center with dark-accented sidebar, 7 executive KPI metric cards, Quick Triage Queue with AI match confidence ratings, incident status flags, and real-time audit stream. |

---

## 3. Brand Identity & Psychological Pillars
1. **Institutional Trust & Discretion**: Lost personal belongings carry high emotional and financial value. The interface avoids frivolous gamification or noisy gradients in favor of crisp typography, deliberate white space, and verified credential markers.
2. **Transparent AI Assistance**: Multimodal AI embeddings (text + vision) suggest candidate matches with explicit percentage confidence and multi-attribute breakdown (semantic text similarity, visual vector alignment, spatiotemporal proximity) while upholding the principle that humans always verify ownership.
3. **Dual-Confirmation Security**: Two-party cryptographic handovers with status timelines and strict abuse-prevention safeguards.

---

## 4. Theme Architecture: Light & Dark Modes
The platform supports a native, system-aware Light and Dark mode toggle:
- **Light Theme**: High-clarity `#F8FAFC` background with pure `#FFFFFF` elevated card surfaces, subtle slate borders (`#E2E8F0`), and dark navy navigation headers.
- **Dark Theme**: Deep institutional slate-navy (`#0B0F19`) background with `#111827` surface cards, subtle translucent borders (`rgba(255, 255, 255, 0.08)`), and glowing electric indigo accents (`#635BFF`).

---

## 5. Screen-by-Screen Layout Specifications

### Public Screens
- **Landing Page**: Desktop (1440px) & Mobile (390px). Clear institutional value proposition, floating AI match cards, step-by-step verified workflow, security commitments, and quick entry points.
- **Lost and Found Discovery**: Fast search bar with category pills, segmented Lost/Found switch, campus zone filters, and responsive item card grid with image thumbnail, status badge, and location tag.
- **Auth (Login / Signup)**: Institutional single-sign-on (SSO) and official student registration number verification with privacy safeguards.

### Student Workspace
- **Dashboard**: High-level personal overview with real-time statistics, pending handovers, recent activity, and quick reporting shortcuts.
- **Report Lost & Found**: 8-section structured reporting flow with drag-and-drop image upload, instant image preview, category classification, and private identification notes.
- **AI Matching Engine**: Side-by-side candidate comparison, similarity meters, explainability tags, and algorithmic disclaimer.
- **Claims & Handover**: Two-party handover timeline (Claim Approved -> Meeting Scheduled -> Finder Confirmed -> Claimant Confirmed -> Returned) with campus security safe zones.

### Admin Operations Console
- **Moderation Table**: High-density table with quick approvals, takedowns, flag toggles, and item inspection.
- **Claims & Handovers**: Dispute resolution, suspicious timeout alerts, and emergency administrative overrides.
- **Security Incidents**: Anomaly triage with severity badges (`Low`, `Medium`, `High`, `Critical`), attempt counters, and audit trail.
- **Registry & User Management**: CSV student roster import preview with validation summaries, student search, and granular role assignments.
