# Kamga — Lookup Layer: Features & Business Rules

**Version:** 1.0
**Date:** July 2026
**Scope:** Layer 1 — the lookup layer only (public directory, association self-service, admin entry)
**Companion to:** *Kamga — Lookup System Specification (Layer 1) v1.0*
**Status:** Design spec, pre-build

---

## 1. How to read this document

The companion specification describes *what the system is* — personas, data model, flows, funnels. This document describes *how it must behave* — the features it exposes and the business rules that govern them.

- **Feature IDs** (`F-xx`) and **business-rule IDs** (`BR-XX-nn`) are stable references. Use them in tickets, test cases, and future revisions.
- Rules are statements the system must enforce. Where a rule carries a numeric value that is a judgement call rather than a hard requirement, it is marked **(proposed)** — a tunable default for you to confirm, not a fixed fact.
- Anything not stated here defaults to the most conservative, privacy-preserving behaviour.

---

## 2. Feature inventory

| ID | Feature | Primary persona | Description |
|---|---|---|---|
| F-01 | Unified search | User | One query, matched by location (postal code, address, city, device) or by association name/alias |
| F-02 | Results list + map | User | List-first results; map with clustered pins available via a "view map" toggle |
| F-03 | Association detail (public) | User | Public-only view of a single association |
| F-04 | Request to connect | User | Send a mediated first-contact message, no account |
| F-05 | Verification badge | User (display) | Visual trust signal on verified records |
| F-06 | Recruit CTA | User → Association | "Ask them to register" on empty/thin results |
| F-07 | Claim CTA | User → Association | "Is this your association? Claim it" on unclaimed records |
| F-08 | Self-registration | Association | Create a new listing; triggers verification |
| F-09 | Claim listing | Association | Take ownership of an existing admin-entered record |
| F-10 | Manage own record | Association | Edit own fields, set public precision, opt in contact |
| F-11 | Registry verification pipeline | System | Auto-check registry number against REQ / Corporations Canada |
| F-12 | Admin form entry | Admin | Rapid single-record entry ("save & add next") |
| F-13 | CSV import | Admin | Bulk load using the same schema |
| F-14 | Admin record management | Admin | Edit/verify/merge/resolve any record |
| F-15 | Geocoding | System | Derive coordinates from postal code + street |
| F-16 | Bilingual UI (FR/EN) | All | Full French and English interface |

---

## 3. Business rules by domain

### 3.1 Search & results — `BR-SR`
- **BR-SR-01** A single query term is matched against two resolvers: **location** (postal code, street address, city name, or device geolocation) and **association identity** (official name plus public aliases). No private or personal field — including admin/officer names — is ever part of the search scope.
- **BR-SR-02** A search executes when the term resolves to a location, matches one or more identities, or both. An ambiguous city (multiple location matches) prompts disambiguation before the location results return; identity matches are unaffected.
- **BR-SR-03** For location matches, distance is computed from the resolved search point to each record's geocoded point and shown as a distance pill. **Identity matches never carry a location/distance pill** — a name hit is not ranked by proximity — even when an origin point is available; they show only the `Name match` pill (`BR-SR-05`).
- **BR-SR-04** Results return as **one list in two ranked bands**. **Identity matches rank first** — an identity hit reflects what the user was looking for — ordered by text relevance. **Location matches follow**, ordered by ascending distance. Within each band, ties break by verified-first, then alphabetical name. A record matching on both identity and location appears **once**, in the identity band.
- **BR-SR-05** Each result carries a **reason pill** stating why it was retrieved: a distance value (e.g. `3.2 km`) for a location match, or a neutral `Name match` for an identity match. The pill states the *fact* of a match, never the private value that matched (see `BR-PE-02`).
- **BR-SR-06** Default search radius is **10 km**. If fewer than **3** location matches fall inside it, the UI offers "search wider." The radius bounds the **location band only** — identity matches are never constrained by distance.
- **BR-SR-07** Results paginate at **10 per page** in a fixed-size grid.
- **BR-SR-08** Both verified and unverified records are returned (soft verification — see `BR-VF`).
- **BR-SR-09** A record with no geocode never appears in search or on the map, even as an identity match (see `BR-GC-02`).
- **BR-SR-10** "No results" means **zero identity matches and zero location matches** within the maximum radius; only this state triggers the recruit CTA (`BR-FN-01`).
- **BR-SR-11** The searched term is never stored against an identity. It may be logged in anonymized, aggregate form for metrics only.
- **BR-SR-12** When a pure name search returns **no identity matches**, the system falls back to location-band discovery: if an origin point is available (typically device geolocation), it shows nearby records with distance pills; if no origin is available, the no-results state and recruit CTA apply (`BR-SR-10`).

### 3.2 Public listing & field exposure — `BR-PE`
- **BR-PE-01** Publicly visible fields are limited to: name (common or official), neighbourhood/city, province, primary language, distance, and verification badge.
- **BR-PE-02** Always private, never rendered publicly: exact address, all contact fields, source, internal notes, registry number.
- **BR-PE-03** `public_precision` defaults to `neighbourhood`. `exact` requires association opt-in, or an admin override for a genuinely public venue (logged).
- **BR-PE-04** Contact is reachable only through Request to Connect (`BR-RC`); contact values are never displayed, even when present.
- **BR-PE-05** A claimed association may expose a specific contact field publicly only if it explicitly marks that field public.

### 3.3 Verification — `BR-VF`
- **BR-VF-01** Verification is **soft**: it never hides, blocks, or down-ranks a listing beyond the tie-break in `BR-SR-04`.
- **BR-VF-02** `verified` requires a confirmed registry match — the `registry_number` resolves to an active entity in the correct registry (NEQ → REQ; federal number → Corporations Canada) and the registered name reasonably matches the record.
- **BR-VF-03** In the association flow, the pipeline runs the check automatically at registration and sets `verification_status` to `verified`, `unverified`, or `needs_review`.
- **BR-VF-04** An admin may set `verified` manually after checking a registry, or flag `needs_review`.
- **BR-VF-05** `needs_review` is an internal state; publicly such a record shows simply as unverified (no badge).
- **BR-VF-06** If a later registry refresh no longer matches (e.g. dissolved entity), status reverts to `needs_review`, the badge is removed, and the record is queued for admin attention.
- **BR-VF-07** Only `verified` records display a badge. Unverified records display no marker — there is no negative badge.
- **BR-VF-08** Whenever `verification_status` changes in **either direction** (e.g. unverified → verified, or verified → `needs_review` per `BR-VF-06`), the system emails the association at the contact address on its own record, **provided that address carries a notification opt-in** (`BR-PC-07`). No opted-in email → no notification. This is first-party operational contact to the record owner about its own listing; it does not reuse connect-request channels (`BR-PC-04`).
- **BR-VF-09** The notification is bilingual (`BR-PC-06`), states the **outcome** (badge granted, or badge removed with the action needed), and never exposes internal-only labels beyond what the association needs to act — `needs_review` is surfaced to the association as "verification lapsed, please review," not as the raw internal state (`BR-VF-05`).

### 3.4 Registration & duplicate control — `BR-RG`
- **BR-RG-01** Any association may self-register regardless of whether a registry match is found (soft verification).
- **BR-RG-02** A new self-registration is created with `source = Self-registered`, `claim_status = claimed`, and `verification_status` set by the pipeline.
- **BR-RG-03** Required to register: official name, city + postal code (for geocoding), primary language. Registry number is strongly encouraged but not required.
- **BR-RG-04** Before creating a record, the system runs a duplicate check: (a) exact `registry_number` match, or (b) fuzzy name match within **2 km** of an existing record.
- **BR-RG-05** An exact registry-number match to an existing *unclaimed* record routes the association into the Claim flow (`BR-CL`) instead of creating a duplicate.
- **BR-RG-06** A strong name-plus-proximity match surfaces a "this may already be listed — claim it?" suggestion but does not hard-block; unresolved cases go to admin review.
- **BR-RG-07** Default privacy (`BR-PE-03`, contact private) is applied to every new record.

### 3.5 Claim — `BR-CL`
- **BR-CL-01** Only records with `claim_status = unclaimed` are claimable (typically admin-entered).
- **BR-CL-02** A record supports one active claim. On success, `claim_status` becomes `claimed` and the claimant becomes the record's editor.
- **BR-CL-03** Claiming requires proof of control — registry-number match plus a contact-confirmation challenge (email or phone).
- **BR-CL-04** Competing or suspicious claims send the record to an admin review queue and lock it from further claims until resolved.
- **BR-CL-05** A claimed record lets the association edit its own fields, set public precision, and opt contact in/out — but never edit its own verification status (system/admin only).

### 3.6 Request to connect — `BR-RC`
- **BR-RC-01** No account is required to send a connect request.
- **BR-RC-02** The requester must supply a reply channel (name plus email or phone), format-validated, so the association can respond.
- **BR-RC-03** Routing: if the record is claimed, the message goes to the association's private contact; if unclaimed, it is queued for admin brokering.
- **BR-RC-04** No raw contact detail is ever returned to the requester, in either routing case.
- **BR-RC-05** Anti-abuse: **5 requests/hour per IP and per reply-channel**, plus lightweight bot protection. A stronger challenge is added only if abuse is observed.
- **BR-RC-06** The requester is told, before sending, that their message and reply channel will be shared with the association.
- **BR-RC-07** Every connect request increments a per-association demand counter (feeds `BR-FN-04`).

### 3.7 Admin entry & import — `BR-AD`
- **BR-AD-01** Admin actions require internal authentication and carry full read/write across all records and private fields.
- **BR-AD-02** The entry form enforces required fields (official name, city + postal code) and preserves the session on "save & add next."
- **BR-AD-03** Postal code auto-geocodes; latitude/longitude are never hand-entered.
- **BR-AD-04** CSV import uses the same schema with per-row validation. Rows that fail required-field or geocode checks are reported; valid rows still commit (partial success).
- **BR-AD-05** Duplicate control (`BR-RG-04`) applies to imported rows.
- **BR-AD-06** An admin may override `public_precision` to `exact` for a public venue; the override is logged.
- **BR-AD-07** Every record — entered or imported — must carry a `source` tag.

### 3.8 Geocoding — `BR-GC`
- **BR-GC-01** Every publicly listed record must have coordinates.
- **BR-GC-02** A record that fails to geocode is flagged `needs_review` and excluded from the public map and search until resolved.
- **BR-GC-03** Coordinates derive from postal code (plus street when available) and are never entered by hand.
- **BR-GC-04** Public display of location honours `public_precision` regardless of the precision stored internally.

### 3.9 Permissions — `BR-PM`
- **BR-PM-01** User: read public fields only; may send a connect request; no edit rights.
- **BR-PM-02** Association: read public fields; write its **own** record after registration or claim; cannot set verification; cannot access any other record's private data.
- **BR-PM-03** Admin: read and write all records including private fields; set verification; resolve reviews and merges; import.

### 3.10 Privacy & compliance — `BR-PC`
- **BR-PC-01** Contact information is published only with the association's explicit, per-field consent (post-claim opt-in).
- **BR-PC-02** Consent is timestamped and recorded.
- **BR-PC-03** REQ open data is used within its licence: attribution respected, no implication of official registry status, anonymized fields never re-exposed.
- **BR-PC-04** Connect-request reply channels are retained only as long as needed to broker the contact plus a short window, then purged; metrics are kept only in anonymized aggregate. (Aligns with PIPEDA / Québec Law 25.)
- **BR-PC-05** An association may request removal of its record or contact details; the admin processes the request (right to erasure).
- **BR-PC-06** Privacy notice and consent language are presented in both French and English.
- **BR-PC-07** A record's contact email may be used for system notifications only once it is **confirmed opt-in (double opt-in)**. Supplying an email — whether by the association in self-registration (`BR-RG`) or by an admin in entry / import (`BR-AD`) — sets it to `pending`, **not** opted-in. The system then sends a confirmation request to that address (bilingual, `BR-PC-06`; resent per `BR-PC-10`); the opt-in takes effect, timestamped and recorded (`BR-PC-02`), only when the association follows the confirmation. An admin never opts an association in on its behalf.
- **BR-PC-08** While an email is `pending`, the **only** message the system may send to it is the confirmation request itself — no verification-status or other notifications are sent until the address is confirmed. This notification opt-in governs *use of the email to reach the association* and is distinct from the per-field consent to *publish* contact data (`BR-PC-01`); confirming the opt-in never renders the address public.
- **BR-PC-09** An association may withdraw the opt-in at any time; withdrawal is timestamped and stops all system notifications to that address. Every notification email carries the means to withdraw.
- **BR-PC-10** A `pending` email that is not confirmed is sent the confirmation request again automatically, on a **Fibonacci-spaced schedule** measured from the first request on day 0: **day 1, day 3, day 6, and day 11** (the final request) — five sends over 11 days, the gaps following the Fibonacci sequence (+1, +2, +3, +5). After the day-11 request goes unanswered, no further requests are sent automatically; the address stays `pending` (never used for notifications) until an admin re-initiates the flow or the association re-submits its email. Every request in the sequence is bilingual (`BR-PC-06`).

### 3.11 Funnels — `BR-FN`
- **BR-FN-01** The recruit CTA ("ask them to register") appears when results fall below the no-results threshold (`BR-SR-10`).
- **BR-FN-02** The claim CTA ("is this your association?") appears on every unclaimed public record.
- **BR-FN-03** A verify nudge appears to claimed-but-unverified associations inside their management view.
- **BR-FN-04** Per-association connect-request demand is aggregated; crossing **50 requests** marks the association as a priority lead for Layer 2 outreach.

### 3.12 Localization — `BR-LC`
- **BR-LC-01** The interface is available in French and English; the default follows the browser/device, is user-switchable, and the choice persists via cookie (no account).
- **BR-LC-02** Record content displays in the requested UI language where both are provided, falling back to the available language with a label.
- **BR-LC-03** A record's `primary_language` (the language the association operates in) is shown on the card and is independent of the UI language.

### 3.13 Map & clustering — `BR-MP`
- **BR-MP-01** The map plots the **full location-band result set** — every geocoded match within the current radius, not just the records on the visible grid page. Grid pagination (`BR-SR-07`) is a display convenience only and never filters what the map shows.
- **BR-MP-02** Identity (name-match) results are **never plotted**; they appear only in the list with their `Name match` pill (`BR-SR-03`). The map is a proximity tool showing the distance band only.
- **BR-MP-03** Nearby markers collapse into a **numbered cluster** whose label shows the count of records it contains. Zooming in splits a cluster into smaller clusters or individual markers; zooming out merges them.
- **BR-MP-04** *(Precision floor.)* Clustering and zoom never override `public_precision` (`BR-PE-03`, `BR-GC-04`). A `neighbourhood`-precision record may collapse into a cluster but **never resolves to a precise pinpoint at any zoom** — at maximum zoom it renders as a neighbourhood-area marker or stays grouped. Only `exact`-precision records (opt-in or admin-overridden public venues) render as a precise point.
- **BR-MP-05** Records that share the same public coordinates (e.g. a common neighbourhood centroid) remain a single **"N in this area"** group even at maximum zoom; they never spiderfy into fake-distinct points. Opening the group lists those records.
- **BR-MP-06** Clicking a cluster zooms to its extent; when it cannot split further (precision floor or shared centroid, `BR-MP-04`/`-05`), it opens the list of contained records instead.
- **BR-MP-07** Selecting a map marker highlights the matching record and navigates the grid to the page that contains it (`BR-SR-07`).

---

## 4. Edge cases & conflict resolution

- **Duplicate records for one association** (admin-entered and self-registered): merge under admin review, preserving verified/claimed state and the earliest `source`.
- **Association active in multiple cities:** **one record per physical location.**
- **Dissolved or inactive entity still listed:** registry refresh sets `needs_review` (`BR-VF-06`); once the admin confirms the entity is dissolved or inactive, the record is **delisted** (not kept as historical).
- **Search in an uncovered area:** recruit CTA, plus an optional future "notify me when one registers here."
- **Requester abuse of connect:** rate limits (`BR-RC-05`) apply first; persistent abuse escalates to a stronger challenge, never a hard account requirement for legitimate users.

---

## 5. Explicitly out of scope for the lookup layer

The lookup layer's job ends at discovery, listing, the verification signal, and routing a first contact. It does **not** handle:

- Membership, payments, or levée processing.
- Individual member accounts or identity verification of persons.
- Association member-roster management.
- Any capability that requires a user account.

All of the above belong to Layer 2 and are drawn forward from the seed dataset and warm-lead list this layer produces.

---

*End of document.*
