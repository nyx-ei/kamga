# CHIFOR FUNDRAIZER - Roadmap

**Version**: 0.2
**Date**: April 2026

---

## Tech Stack

Same as [ActiveBoard](https://github.com/nyx-ei/activeboard) — minimal monthly footprint.

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

## Projections

| Year | Adoption | Associations | Members (avg) | Revenue | Net Profit |
|---|---|---|---|---|---|
| 1 | 0.5% | 100 | 4,000 | $144K | $134K |
| 2 | 1% | 200 | 8,000 | $293K | $283K |
| 3 | 2% | 400 | 16,000 | $586K | $574K |
| 4 | 3.5% | 700 | 28,000 | $1.02M | $1.01M |
| 5 | 5% | 1,000 | 40,000 | $1.46M | $1.44M |

5-year cumulative profit: **$3.44M** on $7.5K bootstrap.

---

## Stakeholders

| Role | Description |
|---|---|
| **Association admin** | Operates between RPN board and their members: registers the association, verifies identity documents, relays calls-to-contribute, collects and remits funds |
| **Aspiring member** | Not yet in any RPN association, looking to find one and register |
| **RPN member** | Registered with an RPN ID, associates relatives (shares = total associated people, not just the registrant), contributes when called, needs fiscal slips |

---

## MVP Roadmap

### Phase 1 - Foundation (Month 1-2)

**Goal**: Project scaffolding + core data model for associations and members.

1. **Project setup**
   - Initialize Next.js 14 (App Router, TypeScript, Tailwind, Lucide)
   - Supabase project: database, auth, storage bucket (for documents)
   - Vercel deployment + GitHub Actions CI (lint, typecheck, build)
   - next-intl setup (EN/FR)
   - PWA manifest + service worker shell

2. **Authentication & roles**
   - Supabase Auth (magic link passwordless, Google OAuth, Facebook OAuth)
   - Role model: `platform_admin`, `association_admin`, `member`
   - RLS policies per role
   - Protected routes & middleware

3. **Association onboarding**
   - Association registration form (name, city, contact, RPN affiliation proof)
   - Platform admin review & approval workflow
   - Association profile page (public info, admin contact)

4. **RPN member registration**
   - Registration form (personal info, ID document upload)
   - Distinction from association membership (separate RPN ID)
   - Admin verification workflow: admin views uploaded evidence (ID, proof of status), approves or rejects
   - Evidence lifecycle: documents stored temporarily in Supabase Storage, **auto-deleted once the admin makes a decision** (approve or reject) — no personal documents retained on the platform
   - Consent notice: member is informed that their documents will be viewed by the association admin and destroyed after verification
   - Member status tracking (pending, verified, active, suspended)

5. **Relative association (share management)**
   - Add/remove dependents per member (name, relationship, ID if applicable)
   - Auto-compute share count (registrant + all associated relatives)
   - Per-association share total (sum of all member shares)
   - Share count visible to admin and member

---

### Phase 2 - Call-to-Contribute (Month 3-4)

**Goal**: End-to-end levee lifecycle, from death event to fund remittance.

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

### Phase 3 - Member Experience (Month 5-6)

**Goal**: Self-service for members and discoverability for aspiring members.

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

### Phase 4 - Launch & Growth (Month 7-12)

**Goal**: Real-world validation, admin compensation, and operational tooling.

1. **Pilot program**
   - Onboard 3-5 pilot associations
   - Guided setup & data migration support
   - Feedback collection & iteration loop

2. **Admin fees tracking & payout**
   - Define admin fee model (per-member or per-levee)
   - Track accrued fees per association admin
   - Payout mechanism (Stripe Connect or manual)
   - Fee transparency for members

3. **Reporting & audit trail**
   - Levee reports: collection rate, timeline, per-association breakdown
   - Member reports: contribution history, fiscal summary
   - Admin reports: member roster, share counts, fee earnings
   - Full audit log (who did what, when) for transparency

4. **RPN-wide rollout**
   - Marketing site / landing page
   - Onboarding documentation for associations
   - Support channel setup
   - Scalability review (Supabase plan, Vercel limits)

5. **Mobile optimization**
   - PWA enhancements (offline contribution view, push notifications)
   - Responsive design audit across all flows
   - Performance optimization (bundle size, image loading)

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Low adoption | Revenue below projections | RPN endorsement, pilot proof points |
| Member churn | Shrinking user base | Natural recruitment > churn in active associations |
| Levee volume overestimated | Commission revenue lower | Membership fees carry the business regardless |
| Competition | Market share loss | First-mover + switching costs + network effects |

Worst case (0.1% adoption, 20 associations): still profitable at ~$19K net.

---

## Next Steps

1. Secure $10-15K bootstrap (founder + grant)
2. Finalize RPN partnership & pilot associations (3-5)
3. Start MVP development
4. Launch pilot at Month 5
5. Measure: adoption rate, MRR, churn
6. Decide: scale organically or raise seed

---

*Status: Ready for execution. Bootstrap: $7.5-15K. Timeline: 6 months to launch.*
