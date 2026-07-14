# KAMGA - Roadmap

**Version**: 0.2

---

## Tech Stack


| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router, TypeScript) |
| Database | PostgreSQL via Supabase (RLS policies) |
| Auth | Supabase Auth (magic link passwordless, Google OAuth, Facebook OAuth) |
| Realtime | Supabase Realtime (contribution tracking) |
| Payments | Stripe (contribution collection) |
| Email | Resend (call-to-contribute alerts, fiscal slips) |
| i18n | next-intl (EN/FR) |
| UI | Tailwind CSS + Lucide icons |
| Hosting | Vercel (auto-deploy, preview deploys) |
| CI/CD | GitHub Actions (lint, typecheck, build) |
| PWA | Service worker + manifest (mobile-first) |

---

## Stakeholders

| Role | Description |
|---|---|
| **Association admin** | Operates between RPN board and their members: registers the association, verifies identity documents, relays calls-to-contribute, collects and remits funds |
| **Aspiring member** | Not yet in any RPN association, looking to find one and register |
| **RPN member** | Registered with an RPN ID, associates relatives (shares = total associated people, not just the registrant), contributes when called, needs fiscal slips |

---

## Feature Modules

### Foundation

Project scaffolding + core data model for associations and members.

1. **Project setup**
   - Initialize Next.js 14 (App Router, TypeScript, Tailwind, Lucide)
   - Supabase project: database, auth, storage bucket (for documents)
   - Additional deps: `zod` (form validation), `nanoid` (referral tokens), `sanitize-html` (admin rich text), `resend` (emails)
   - Vercel deployment + GitHub Actions CI (lint, typecheck, build)
   - next-intl setup (EN/FR)
   - PWA manifest + service worker shell

2. **Authentication & roles**
   - Supabase Auth (magic link passwordless, Google OAuth, Facebook OAuth)
   - Role model: `platform_admin`, `association_admin`, `member`
   - RLS policies per role
   - Protected routes & middleware (public: `/register`, `/auth/*`; authenticated: `/dashboard/*`; admin-only: `/admin/*`)

3. **Association onboarding**
   - Association registration form (name, city, contact, RPN affiliation proof)
   - Platform admin manual review & approval workflow (v1)
   - Future: API-based verification to confirm association legitimacy automatically (replaces manual review)
   - Association profile page (public info, admin contact)

4. **RPN member registration (referral-only, v1)**

   **Referral system**
   - Admins generate unique referral links tied to their association
   - Members can also generate referral links if the association admin enables it (per-association toggle)
   - Referral link encodes: referrer ID, association ID, unique token (nanoid); expires after 30 days
   - Any association can re-invite a previously declined applicant, including the same one that declined

   **Registration flow**
   - Aspiring member receives referral link via email or direct share
   - Clicks link → token validated (exists, not expired, not used, association active) → registration form rendered with association info
   - Registration form collects: first name, last name, email, phone, date of arrival in Canada
   - SIN (Social Insurance Number): collected in the form but **never stored in the database** — encrypted (AES-256-GCM) and held in a transient `sin_tokens` table, visible to the reviewing admin only, destroyed alongside evidence on terminal decision
   - Evidence uploads: government-issued ID, proof of immigration status (PR card, work permit, etc.)
   - Consent checkbox: member is informed that documents will be viewed by the association admin and destroyed after verification
   - On submit: user creates an account (magic link, Google OAuth, or Facebook OAuth), then registration data is persisted server-side
   - Referral token consumed atomically (prevents double-use)

   **Post-registration**
   - Account created with `pending` status
   - User receives "application under review" email (Resend)
   - User can log in anytime to check application status on their dashboard

   **Admin review**
   - Admin sees: who referred this applicant, applicant personal info, uploaded evidence
   - Evidence viewer: admin can **view** documents inline (images via `<img>`, PDFs via `<iframe>`) but **cannot download** — served through a server-side proxy with short-lived signed URLs, right-click prevention, and watermark overlay
   - SIN displayed masked (`***-***-***`) with a reveal button (shown for 30 seconds, then re-masked)
   - Three review outcomes:
     - **Accepted**: member status → `active`, evidence + SIN destroyed, approval email sent
     - **Declined**: admin provides mandatory explanation in rich HTML format, evidence + SIN destroyed, decline email sent with the explanation
     - **Need more evidence**: admin selects which documents are still needed (government ID, immigration proof), user receives email with a link to a simple upload form

   **Evidence lifecycle**
   - Documents stored temporarily in Supabase Storage (private bucket, path: `{association_id}/{membership_id}/{type}_{timestamp}.{ext}`)
   - **Auto-destroyed on terminal review decision** (accepted or declined) — no personal documents retained
   - Periodic cleanup cron sweeps for any evidence marked `destroyed` that still has storage objects

   **Post-decision outcomes**
   - If accepted: user status changes to `active`, full access to their RPN member dashboard
   - If declined: user receives the explanation, can close their account or keep it — they may receive a new referral from any association (including the one that declined)
   - If more evidence needed: user receives upload link, submits documents, review resumes

   **Member status tracking**: `pending` → `active` | `declined` | `suspended`

5. **Relative association (share management)**
   - Add/remove dependents per member (name, relationship, ID if applicable)
   - Auto-compute share count (registrant + all associated relatives)
   - Per-association share total (sum of all member shares)
   - Share count visible to admin and member

---

### Call-to-Contribute

End-to-end levee lifecycle, from death event to fund remittance.

1. **Levee initiation**
   - Platform admin creates a levee (deceased info, target amount, deadline)
   - Pool size calculation (total shares across all associations)
   - Per-share amount = target / pool size

2. **Association-level dispatch**
   - Each association receives its call: number of shares x per-share amount
   - Admin dashboard shows incoming call with amount owed and deadline
   - Association-level status tracking (pending, in-progress, completed)

3. **Member-level collection**
   - Admin relays call to members (each member sees: shares x per-share amount)
   - Member contribution status (unpaid, partial, paid)
   - Admin can record offline/cash payments manually
   - Real-time progress tracker (Supabase Realtime: collected vs. target per association)

4. **Payment collection**
   - Stripe integration for online payments
   - Member pays their share amount via the platform
   - Payment confirmation & receipt
   - Handling partial payments and overpayments

5. **Fund remittance**
   - Association-level collection summary (total collected, outstanding)
   - Mark association as remitted once funds are sent to RPN board
   - Levee-level dashboard: all associations' progress, total collected vs. target
   - Levee closure once target is met or deadline passes

---

### Member Experience

Self-service for members and discoverability for aspiring members.

1. **Association directory**
   - Public searchable list of RPN associations (by city, name)
   - Association detail page (description, member count, contact)
   - "Request to join" flow (aspiring member submits application)
   - Admin receives and processes join requests

2. **Member dashboard**
   - Contribution history (all levees, amounts paid, dates)
   - Associated relatives management (add/edit/remove)
   - Current share count and status
   - Active levees with payment status

3. **Financial settings**
   - Save payment method (Stripe customer portal)
   - Payment preferences (auto-pay on call, manual)
   - Contribution receipt download (per payment)

4. **Fiscal slip generation**
   - Annual tax receipt (sum of all contributions for the fiscal year)
   - PDF generation with required fields (association name, RPN ID, amounts, dates)
   - Download & email delivery (via Resend)

5. **Notification system**
   - Email notifications via Resend: new call-to-contribute, payment reminders, payment confirmation, join request status
   - In-app notification center (unread/read)
   - Admin notifications: new join requests, levee dispatched, collection milestones

---

### Operations & Tooling

1. **Admin fees tracking & payout**
   - Admin fee model (per-member or per-levee)
   - Track accrued fees per association admin
   - Payout mechanism (Stripe Connect or manual)
   - Fee transparency for members

2. **Reporting & audit trail**
   - Levee reports: collection rate, timeline, per-association breakdown
   - Member reports: contribution history, fiscal summary
   - Admin reports: member roster, share counts, fee earnings
   - Full audit log (who did what, when) for transparency

3. **Mobile optimization**
   - PWA enhancements (offline contribution view, push notifications)
   - Responsive design audit across all flows
   - Performance optimization (bundle size, image loading)
