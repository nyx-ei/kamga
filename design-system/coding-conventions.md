# Kamga — Coding Conventions

**Version:** 1.0
**Date:** July 2026
**Scope:** All application code in the Kamga monorepo (Next.js 14 App Router, TypeScript, Supabase).
**Companion to:** *Kamga — Roadmap* (tech stack) and *Kamga — Lookup Layer: Features & Business Rules*.
**Status:** Baseline convention, pre-build.

---

## 1. How to read this document

This document defines *how we write code* for Kamga. It is prescriptive, not aspirational: a rule stated here is expected to hold in every merged pull request.

- **Rule IDs** (`CV-XX-nn`) are stable references. Use them in code review comments, PR descriptions, and lint-rule justifications (e.g. "blocked by `CV-SEC-03`").
- Rules marked **(proposed)** carry a tunable value — a default to confirm during setup, not a fixed fact.
- Anything not stated here defaults to the stricter, more explicit, more privacy-preserving choice. When two conventions could apply, the security/privacy rule wins.
- Kamga handles personal and financial data under **PIPEDA, Québec Law 25, and OSFI B-13**. Several rules below exist to satisfy those obligations and are non-negotiable regardless of convenience.

---

## 2. Guiding principles

1. **Boring, explicit, and typed.** Prefer the obvious solution a new contributor can read. No cleverness that needs a comment to survive.
2. **Server by default.** Data, secrets, and authorization live on the server. The client renders and collects input; it never holds a service key or trusts its own state for access decisions.
3. **Privacy is a correctness property.** Leaking a SIN, an uploaded ID, or a private contact field is a defect of the same severity as a crash — not a "nice to fix."
4. **The database is the last line of defense.** Row Level Security enforces access even if application code is wrong. Application checks are a UX convenience layered on top, never the sole gate.
5. **Bilingual is not an afterthought.** Every user-facing string ships in EN and FR from the first commit that introduces it.

---

## 3. Language & TypeScript — `CV-TS`

- **CV-TS-01** TypeScript runs in `strict` mode. `noUncheckedIndexedAccess`, `noImplicitOverride`, and `noFallthroughCasesInSwitch` are enabled. These are not relaxed to make a build pass.
- **CV-TS-02** `any` is prohibited in committed code. Use `unknown` at boundaries and narrow with a type guard or a Zod parse. A genuinely unavoidable `any` requires an inline `// eslint-disable-next-line` with a one-line justification.
- **CV-TS-03** No non-null assertions (`!`) to silence the compiler. Narrow the value, provide a default, or throw with a clear message. `!` is acceptable only where a value is provably present and re-checking is noise (document why).
- **CV-TS-04** Type external and cross-boundary data at the edge. Anything from `fetch`, `request.json()`, a webhook, `searchParams`, or `FormData` is `unknown` until validated by a Zod schema (`CV-VL`). Never cast untrusted input with `as`.
- **CV-TS-05** Prefer `type` for unions and object shapes; use `interface` only when declaration merging is genuinely needed. Be consistent within a file.
- **CV-TS-06** Model illegal states as unrepresentable. Use discriminated unions over optional-flag soup (`{ status: 'declined'; reason: string } | { status: 'active' }`, not `{ declined?: boolean; reason?: string }`).
- **CV-TS-07** Enumerated domain values (member status, verification status, roles) are defined once as a `const` union or a shared enum and imported everywhere; never re-typed as bare string literals at call sites.
- **CV-TS-08** No default exports for modules that export logic (components, hooks, utilities). Named exports only — they refactor and grep cleanly. Next.js special files (`page.tsx`, `layout.tsx`, `route.ts`, `middleware.ts`) are the sole exception, as the framework requires them.
- **CV-TS-09** Prefer `async/await` over raw `.then()` chains. Every `await` that can reject is inside a `try/catch` or is deliberately allowed to propagate to a boundary handler (`CV-ER`).

---

## 4. Project structure & file organization — `CV-FS`

- **CV-FS-01** App Router lives under `src/app`. Route groups organize by audience, mirroring the middleware zones in the roadmap: `(public)`, `(dashboard)`, `(admin)`.
- **CV-FS-02** Non-route code is grouped by domain feature, not by technical type. Prefer `src/features/membership/…` over a global `components/`, `hooks/`, `utils/` split. Cross-cutting primitives live in `src/lib` (framework/infra) and `src/components/ui` (design-system primitives).
- **CV-FS-03** One primary export per file; the file is named after it. A file named after a React component uses `PascalCase.tsx`; everything else uses `kebab-case.ts` (`CV-NM-01`).
- **CV-FS-04** A feature folder may expose a barrel `index.ts` for its public surface. Do not barrel across feature boundaries — import from a feature's `index`, never deep-reach into its internals.
- **CV-FS-05** Co-locate tests, styles, and stories with the unit they cover (`x.ts` beside `x.test.ts`). Co-locate a `README.md` in any feature folder whose rules are non-obvious.
- **CV-FS-06** Server-only modules (anything importing a service-role client, a secret, or Node built-ins) start with `import 'server-only'` so an accidental client import fails the build (`CV-SEC-02`).
- **CV-FS-07** Import ordering: external packages, then `@/` absolute aliases, then relative — separated by blank lines, enforced by the import-sort lint rule. Use the `@/` path alias; no `../../../` climbs past one level.
- **CV-FS-08** Generated artifacts (Supabase types, i18n type maps) live in a clearly named `*.generated.ts` and are never hand-edited.

---

## 5. Next.js App Router — `CV-NX`

- **CV-NX-01** Components are **Server Components by default**. Add `'use client'` only when the component needs state, effects, event handlers, or browser-only APIs — and push it to the smallest leaf that needs it.
- **CV-NX-02** Never fetch data in a Client Component via `useEffect` when a Server Component can fetch it directly. Fetch on the server, pass data down as props.
- **CV-NX-03** All mutations go through **Server Actions** (or Route Handlers for webhooks/third-party callbacks). Every action re-validates its input with Zod (`CV-VL`) and re-checks authorization on the server (`CV-SEC-05`) — the client is never trusted.
- **CV-NX-04** Route Handlers (`route.ts`) are reserved for webhooks (Stripe, Supabase) and machine-to-machine endpoints. Verify signatures before doing any work (`CV-SEC-08`).
- **CV-NX-05** Set `export const runtime` and caching (`revalidate` / `dynamic`) explicitly on any route where the default is wrong. Never cache a response that contains per-user or private data.
- **CV-NX-06** `loading.tsx` and `error.tsx` are provided for every route segment that fetches data. Users see a skeleton or a recoverable error, never a blank screen or an unhandled throw.
- **CV-NX-07** After a successful mutation, call `revalidatePath`/`revalidateTag` rather than manually mutating client caches. Redirects use `redirect()` from `next/navigation`.
- **CV-NX-08** `middleware.ts` handles auth-zone gating (public / authenticated / admin per the roadmap) and locale negotiation only. It does not perform data access or heavy logic.
- **CV-NX-09** Environment variables: only values safe for the browser carry the `NEXT_PUBLIC_` prefix. A secret must never wear that prefix (`CV-SEC-01`). Access env through a single typed, Zod-validated `env.ts` module — never `process.env.X` scattered across the codebase.

---

## 6. Naming — `CV-NM`

- **CV-NM-01** Files: `PascalCase.tsx` for components, `kebab-case.ts` for everything else. Folders: `kebab-case`.
- **CV-NM-02** Types, interfaces, and React components: `PascalCase`. Variables, functions, and hooks: `camelCase` (hooks start with `use`). Constants that are true compile-time constants: `SCREAMING_SNAKE_CASE`.
- **CV-NM-03** Database identifiers (tables, columns) are `snake_case` — matching the roadmap's `sin_tokens`, `association_id`, `verification_status`. Map to `camelCase` at the application boundary, not ad hoc in components.
- **CV-NM-04** Booleans read as predicates: `isVerified`, `hasOptedIn`, `canClaim`. Event handlers are `handleX`; the props that receive them are `onX`.
- **CV-NM-05** Server Actions are verbs describing the effect: `registerMember`, `approveMembership`, `destroyEvidence`. Async functions returning data read as nouns/queries: `getAssociation`, `listActiveLevees`.
- **CV-NM-06** No abbreviations that aren't domain terms. Domain acronyms from the spec are kept verbatim: `RPN`, `SIN`, `NEQ`, `REQ`, `levee`. Do not invent new short forms.
- **CV-NM-07** Name by intent, not implementation. `memberContribution`, not `data2`; `pendingReviewQueue`, not `arr`.

---

## 7. Data layer & Supabase — `CV-DB`

- **CV-DB-01** **Row Level Security is enabled on every table with no exceptions.** A table without an RLS policy is a bug, and a migration that creates a table without one does not merge.
- **CV-DB-02** RLS policies are the authoritative access control (`CV-SEC-05`), aligned to the role model `platform_admin` / `association_admin` / `member`. Application-layer checks improve UX but never substitute for a policy.
- **CV-DB-03** All schema change is by **migration file**, committed and reviewed. No manual changes in the Supabase dashboard against any shared environment. Migrations are forward-only and never edited after they have run on a shared environment.
- **CV-DB-04** Two client factories, and only two: a **request-scoped client** carrying the user's session (used almost everywhere, subject to RLS) and a **service-role client** that bypasses RLS. The service-role client is server-only (`CV-FS-06`), used solely for genuine system operations (cron cleanup, webhook processing), and every use is justified in a comment.
- **CV-DB-05** Database row types are generated from the schema (`CV-FS-08`) and imported — never hand-typed. Regenerate after every migration.
- **CV-DB-06** Queries select explicit columns; no `select('*')` in application code, so private columns are never fetched by accident (`CV-SEC-06`).
- **CV-DB-07** Multi-step writes that must be atomic use a Postgres transaction or an RPC function, not sequential client calls. The referral-token consume and the SIN-token destruction are examples that must be atomic.
- **CV-DB-08** Every `.from().select()/insert()/update()` result has its `error` checked and handled before its `data` is used. No unchecked Supabase result reaches business logic.
- **CV-DB-09** Realtime subscriptions are cleaned up on unmount and are scoped to the minimum channel/row set the view needs.

---

## 8. Validation & forms — `CV-VL`

- **CV-VL-01** Zod is the single source of truth for input shape. Every Server Action, Route Handler, and form parses its input against a schema before use. Parse, then use the typed result — never read raw `FormData` fields directly into logic.
- **CV-VL-02** A schema is defined once and shared between client (progressive-enhancement / UX validation) and server (authoritative validation). The server always re-validates; client validation is never trusted (`CV-NX-03`).
- **CV-VL-03** Validate at the boundary, keep the interior typed. Once data has been parsed, downstream functions receive the inferred type, not `unknown`.
- **CV-VL-04** Validation failures return structured, field-level errors that the UI can render in the user's locale (`CV-IL`). They never surface a raw Zod message or stack trace to the user.
- **CV-VL-05** Sanitize any admin-authored rich text (decline explanations, per the roadmap) with `sanitize-html` on the server before storage and before render. Never render untrusted HTML with `dangerouslySetInnerHTML` around unsanitized input.
- **CV-VL-06** Format-validate reply channels and contact fields (email, phone) at the schema level, matching business rules such as `BR-RC-02`.

---

## 9. Security & privacy — `CV-SEC`

*These rules implement PIPEDA / Québec Law 25 / OSFI B-13 obligations and the roadmap's data-protection design. They override any convenience.*

- **CV-SEC-01** **No secret ever reaches the client.** Service-role keys, Stripe secret keys, Resend keys, and the SIN encryption key live only in server environment and server-only modules (`CV-FS-06`). None carries `NEXT_PUBLIC_`. Secrets are never committed — `.env*` is git-ignored and an example file documents the names only.
- **CV-SEC-02** Server-only modules are marked with `import 'server-only'` so a leak into a client bundle fails at build time, not in production.
- **CV-SEC-03** **PII and secrets are never logged.** SIN, government-ID contents, uploaded documents, exact addresses, full contact details, and access tokens must not appear in logs, error messages, analytics, breadcrumbs, or exception payloads. Redact before logging; log identifiers (a `membership_id`), never the sensitive value.
- **CV-SEC-04** **SIN handling follows the roadmap exactly and admits no shortcut:** collected in-form, encrypted AES-256-GCM, held only in the transient `sin_tokens` table, revealed to the reviewing admin masked-with-timed-reveal, and destroyed with the evidence on any terminal decision. SIN is never persisted to a durable table, never sent to a third party, never logged (`CV-SEC-03`), never included in an email.
- **CV-SEC-05** **Every mutation and every private-data read re-checks authorization on the server**, against the authenticated session and role — never against a client-supplied role, id, or hidden field. RLS (`CV-DB-02`) backs this at the database.
- **CV-SEC-06** Private fields are never sent to a client that is not entitled to them. Public views select only the publicly exposable fields (per `BR-PE-01`/`BR-PE-02`); the server shapes the DTO — the client never receives private columns and hides them in CSS.
- **CV-SEC-07** Uploaded evidence lives in a **private** bucket, is served only through the server-side signed-URL proxy (view-not-download, short-lived URLs) described in the roadmap, and is auto-destroyed on terminal review. No public URLs, no long-lived signed URLs.
- **CV-SEC-08** Webhooks verify their signature (Stripe signing secret, Supabase webhook secret) before any processing, and are idempotent against replay.
- **CV-SEC-09** Rate-limit and bot-protect public write endpoints (connect requests, registration) per the business rules (e.g. `BR-RC-05`). Enforce server-side.
- **CV-SEC-10** Consent, opt-in, withdrawal, and destruction events are timestamped and recorded to the audit trail (`BR-PC-02`, roadmap audit log). Erasure requests (`BR-PC-05`) are honoured through a defined, audited path.
- **CV-SEC-11** Dependencies are kept patched; CI fails on high-severity advisories. New dependencies that touch PII or payments are reviewed before adoption (`CV-DEP`).
- **CV-SEC-12** If sensitive data (a real SIN, ID image, credential, or token) is ever found committed, pasted into an issue, or logged, treat it as an incident: remove it, notify the Privacy & Compliance Officer and the IT Security & Operations Director, do not reproduce the value, and rotate any exposed secret.

---

## 10. Styling & design system — `CV-ST`

*Grounded in the token system already defined in `Kamga Dashboard.html`.*

**The core rule: style by semantic role, never by appearance.** A component declares *what an element is* — body text, a page surface, the brand action, a danger state — and lets the design system decide how that looks. It never names a colour, a pixel value, or a specific palette shade. This is what makes theming, rebrands, and light/dark "just work," and it is enforced strictly: appearance-level values are a review-blocking defect in component code.

There is a three-tier hierarchy, and components only ever touch the top tier:

1. **Semantic role tokens** — what components use (`text-body`, `bg-page`, `border-default`, `brand`, `text-on-brand`, `danger`, `success`). Express intent.
2. **Palette / scale tokens** — the raw material roles are built from (`--blue-400`, `--red-500`, `--space-4`). Not referenced in components.
3. **Raw values** — hex codes, `13px`, `#C43D3D`. Never referenced anywhere but the token definitions.

- **CV-ST-01** Tailwind CSS is the styling mechanism. Style with utility classes in markup; do not write parallel `.css` files for component styling except the single global stylesheet that declares tokens and base layers.
- **CV-ST-02** **Components reference semantic role tokens only.** Never a raw value (`#C43D3D`, `[13px]`, arbitrary hex), and never a palette/scale token (`blue-400`, `red-500`) directly. If an element needs a look that has no role yet, the fix is to *define the role* in the token layer — not to reach past it. A palette or raw value appearing in a component is a defect, not a shortcut.
- **CV-ST-03** **State and feedback are roles, not colours.** Verification, success, warning, danger, and info are expressed as `success` / `warning` / `danger` / `info` roles — never as "green," "amber," or "red." What "danger" resolves to is the token layer's decision; the component only declares the meaning. This keeps status colour consistent across the app and correct in both themes and for colour-vision needs (`CV-AY-04`).
- **CV-ST-04** Spacing, radii, typography, shadows, and motion follow the same rule: use the semantic/scale tokens (`--space-*`, `--radius-*`, `--text-*`, `--shadow-*`, `--duration-*`, IBM Plex Sans/Mono), never off-scale pixel values. Prefer a role where one exists (e.g. `shadow-card`, `radius-md`) over reconstructing the look from primitives.
- **CV-ST-05** A missing role is a design-system gap, not a component problem. When no existing role fits, add the role (and its light/dark mapping) in the token layer, get it named meaningfully, and use it — do not inline a one-off value "just this once." One-offs are how a token system rots.
- **CV-ST-06** Light and dark themes are both first-class. Because components only name roles and roles carry both mappings, a correctly-styled component themes for free — never branch on theme in component logic, and never assume a background colour.
- **CV-ST-07** Compose class lists with the project's `cn()`/`clsx`+`tailwind-merge` helper so conditional and overriding classes merge predictably. No string concatenation of class names.
- **CV-ST-08** Reusable visual primitives (Button, Card, Badge, Pill, Input) live in `src/components/ui` and are the only place variant logic lives. Variants are named by role (`variant="danger"`, `tone="brand"`), never by colour (`variant="red"`). Feature code composes these primitives; it does not re-implement a button or reach for a colour.
- **CV-ST-09** Icons come from Lucide, sized via tokens, and always carry an accessible label when interactive (`CV-AY`).
- **CV-ST-10** Honour `prefers-reduced-motion`; animations use the token durations/easings and degrade to no motion when requested.

---

## 11. Internationalization — `CV-IL`

- **CV-IL-01** `next-intl` is the i18n layer. **No user-facing string is hard-coded** in a component — every label, message, error, and email subject is a translation key present in both `en` and `fr` message catalogs.
- **CV-IL-02** A PR that adds an EN string without its FR counterpart (or vice versa) does not merge; the message catalogs stay in sync, enforced in CI where practical.
- **CV-IL-03** Locale-format all dates, numbers, and currency through the i18n formatters — never manual string building. Currency is CAD; amounts display per locale (`fr-CA` / `en-CA`).
- **CV-IL-04** Translation keys are namespaced by feature (`membership.review.declineReason`), not flat. Keys are descriptive, not the English text.
- **CV-IL-05** Use ICU message syntax for plurals and interpolation; never concatenate translated fragments (word order differs between FR and EN).
- **CV-IL-06** System emails, privacy/consent notices, and confirmation flows are bilingual per the business rules (`BR-PC-06`); the email layer selects the association's language.
- **CV-IL-07** Distinguish *UI language* from record `primary_language` (`BR-LC-03`) — they are separate concerns and are never conflated in code.

---

## 12. Error handling & logging — `CV-ER`

**The error boundary is a code contract, not copy.** The back-end never sends a display string; it returns a **stable error code** from a shared taxonomy, plus optional structured params. The front-end owns the message: it maps the code to a localized (EN/FR) string and renders it *with the code visible* to the user. This keeps message copy in one place (the i18n catalog, not scattered per-flow), lets support and future teams identify precisely what happened from the code a user reports, and guarantees the back-end can never leak internal detail into the UI (`CV-SEC-03`).

- **CV-ER-01** Errors are typed and handled at a boundary (Server Action result, Route Handler, `error.tsx`). Business logic throws or returns typed failures; it does not swallow errors silently.
- **CV-ER-02** **The back-end returns an error *code*, never a user-facing message.** A failed result carries `{ code, params?, correlationId }` — a taxonomy code (`CV-ER-07`), optional structured params for interpolation (counts, field names — never PII or internal detail), and a correlation id for log lookup. Stack traces, DB errors, and internal strings stay server-side (`CV-SEC-03`) and never cross the boundary.
- **CV-ER-03** **The front-end maps code → message.** A single localized catalog resolves each code to its EN/FR copy (`CV-IL`) via `next-intl`, interpolating `params`. Message copy is defined once there — never inlined per flow, never hard-coded at a call site. UI logic branches on the **code**, never on a message string.
- **CV-ER-04** **The code is always shown to the user alongside the message** (e.g. *"We couldn't process your payment. (KMG-PAY-002)"*). The code is safe to display by design — it identifies a class of error, not an instance or any secret — and gives the user something exact to quote to support. The per-instance `correlationId` is *not* shown but is logged, so support can pivot from the reported code to the exact log entry.
- **CV-ER-05** Prefer a result type (`{ ok: true; data } | { ok: false; code; params?; correlationId }`) for expected, recoverable failures (validation, not-found, permission-denied). Reserve `throw` for the genuinely exceptional; the top-level boundary converts an uncaught throw into a generic `KMG-SYS-000` result rather than exposing it.
- **CV-ER-06** No empty `catch` blocks. If an error is intentionally ignored, comment why. Re-throw or convert to a taxonomy code; never discard.

### Error taxonomy — `CV-ER` (codes)

- **CV-ER-07** Codes live in **one registry** (`src/lib/errors`), the single source of truth, shaped `KMG-<DOMAIN>-<nnn>`. `DOMAIN` reuses the business-rule domains where possible (`AUTH`, `VAL`, `RC`, `RG`, `CL`, `VF`, `PAY`, `SYS`, …) so an error code traces back to the rule it enforces. Each entry declares its domain, whether it is user-recoverable, its log severity, and its EN/FR message keys.
- **CV-ER-08** Codes are **stable and append-only**. Once shipped, a code's meaning never changes and a retired code is never reused — a user or support ticket referencing `KMG-RC-005` must mean the same thing forever. New failure modes get new codes.
- **CV-ER-09** Every returnable code has **both EN and FR** messages present (`CV-IL-02`); a code without complete copy does not merge. An unknown or unmapped code falls back to a generic message but **still displays the raw code**, so nothing is ever untraceable.
- **CV-ER-10** Validation failures (`CV-VL-04`) map each field error to a taxonomy code too, so field-level messages come from the same catalog rather than raw Zod strings. Third-party failures (Stripe, Resend, Supabase, registry lookups) are translated at their adapter seam into Kamga codes — a Stripe decline becomes a `KMG-PAY-*` code, never a raw provider message forwarded to the client.
- **CV-ER-11** Log with structured context (the `correlationId`, the error `code`, the actor's role, the affected record id) so events are traceable for the audit trail — never with the sensitive value itself (`CV-SEC-03`). Log severity follows the code's declared level; user-recoverable codes (validation, rate limit) are not logged as system errors.

---

## 13. Testing — `CV-QA`

- **CV-QA-01** Business rules with IDs (`BR-*`) that carry logic — search banding, radius, duplicate control, rate limits, verification transitions, opt-in scheduling — have unit tests that reference the rule ID in the test name.
- **CV-QA-02** Security- and privacy-critical paths have explicit tests: RLS denies cross-tenant reads, private fields never appear in public DTOs, SIN/evidence is destroyed on terminal decision, secrets absent from client bundles. These are required, not optional.
- **CV-QA-03** Pure logic (validation schemas, calculators like per-share amount, ranking, geocoding adapters) is unit-tested in isolation. Prefer many small pure functions that are trivially testable.
- **CV-QA-04** Critical flows (registration, claim, payment, review decision) have at least one end-to-end test covering the happy path and the primary failure.
- **CV-QA-05** Tests are deterministic — no reliance on wall-clock, network, or real third parties. Inject clocks; mock Stripe/Resend/registry lookups at a seam.
- **CV-QA-06** A test asserts behaviour a user or rule cares about, not implementation detail. A test that must change every refactor is testing the wrong thing.
- **CV-QA-07** Bug fixes land with a regression test that fails before the fix.

---

## 14. Accessibility — `CV-AY`

- **CV-AY-01** Use semantic HTML first (`button`, `nav`, `label`, `table`); reach for ARIA only to fill a genuine gap. A clickable `div` is a bug when a `button` fits.
- **CV-AY-02** Every input has an associated label; every interactive icon-only control has an accessible name (`CV-ST-09`).
- **CV-AY-03** Every flow is fully keyboard-operable, with a visible focus indicator using the focus-ring token. Focus is managed on route change, dialog open, and error.
- **CV-AY-04** Colour is never the sole carrier of meaning (verification, status, errors also carry text or icon). Contrast meets WCAG AA in both themes.
- **CV-AY-05** Images and evidence previews have appropriate alternatives; decorative images are `alt=""`.

---

## 15. Git, commits & pull requests — `CV-GIT`

- **CV-GIT-01** `main` is protected and always deployable. Work happens on branches named `feature/…`, `fix/…`, or `chore/…`.
- **CV-GIT-02** Commit messages are imperative and scoped: a concise subject line, a body explaining *why* when the change is non-obvious. Reference feature/rule IDs where relevant (`F-08`, `BR-CL-03`, `CV-SEC-04`).
- **CV-GIT-03** Commits are focused. Unrelated changes go in separate commits/PRs. No "wip"/"fix2" noise in merged history.
- **CV-GIT-04** PRs are small enough to review meaningfully, describe what and why, link the roadmap item or rule, and note any privacy/security impact explicitly.
- **CV-GIT-05** CI (lint, typecheck, build, tests) must be green before merge. Merging over red CI is not permitted. Never bypass hooks (`--no-verify`) or skip checks to force a merge.
- **CV-GIT-06** No secret, `.env`, real PII, or generated build artifact is ever committed. A secret that lands in history is an incident (`CV-SEC-12`) and requires rotation, not just a follow-up commit.
- **CV-GIT-07** Prefer merge via PR with at least one review. Security-, payments-, or PII-touching changes warrant a reviewer familiar with those constraints.

---

## 16. Comments, documentation & dependencies — `CV-DOC`

- **CV-DOC-01** Comments explain *why*, not *what* — the code says what. Delete commented-out code; git remembers it.
- **CV-DOC-02** Non-obvious business logic links the rule it implements (`// BR-SR-04: identity band ranks before location band`).
- **CV-DOC-03** Public functions with non-trivial contracts carry a short doc comment (params, returns, throws, side effects). Server-only and security-sensitive functions state their trust assumptions.
- **CV-DOC-04** A feature folder with non-obvious rules carries a short `README.md` (`CV-FS-05`).
- **CV-DOC-05** New dependencies are justified: prefer the standard-library or existing-dependency solution; weigh maintenance, bundle size, and licence. Anything touching PII, payments, or auth is reviewed before adoption (`CV-SEC-11`).
- **CV-DOC-06** Keep dependencies current and pinned via lockfile; the lockfile is committed and updated deliberately, not regenerated incidentally.

---

## 17. Definition of done

A change is done when:

1. It satisfies the relevant feature (`F-*`) and business rules (`BR-*`).
2. It obeys these conventions; any deliberate deviation is justified in review against its rule ID.
3. Types pass in `strict`, lint is clean, tests (including security/privacy tests where applicable) pass, and CI is green.
4. All new user-facing strings exist in EN and FR.
5. No secret or PII is logged, committed, or sent to the client.
6. It is legible to the next contributor without a walkthrough.

---

*End of document.*
