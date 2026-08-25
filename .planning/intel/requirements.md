# Requirements — Synthesized Intel

Source: GSD doc synthesizer (merge mode, 2026-08-25)
Precedence: ADR > SPEC > PRD > DOC

---

## Ingest Set — Extracted Requirements: NONE (no PRDs ingested)

No PRDs were classified in this ingest set (2 docs, both SPEC). No REQ-{slug} entries derived from ingested docs directly.

Ingested SPECs do imply requirements but duplicates of the existing REQUIREMENTS.md (38 v1 requirements) and the MVP Design §13 Definition of Done. They are recorded as constraints (see constraints.md), not as new requirements, to avoid double-counting.

- source: C:\Users\DTA_WorkStation\Documents\camermove\docs\superpowers\plans\2026-08-24-camermove-lot0-lot1.md — type: SPEC — cross_refs: []
- source: C:\Users\DTA_WorkStation\Documents\camermove\docs\superpowers\specs\2026-08-24-camermove-web-mvp-design.md — type: SPEC — cross_refs: []

## Implied Requirements from Ingested SPECs (for downstream roadmapper traceability)

These are NOT new REQ IDs — they map to existing REQUIREMENTS.md entries. Listed for traceability only:

- Implied REQ: Search Yaounde-Douala with filters/sort/pagination/groupBy/bulk — source: C:\Users\DTA_WorkStation\Documents\camermove\docs\superpowers\plans\2026-08-24-camermove-lot0-lot1.md + C:\Users\DTA_WorkStation\Documents\camermove\docs\superpowers\specs\2026-08-24-camermove-web-mvp-design.md — maps to: SEARCH-01..07, API-01 in REQUIREMENTS.md
- Implied REQ: Auth (register/login/refresh/me + JWT + RBAC + Google OAuth SocialAccount) — source: both SPECs — maps to: AUTH-01..05, SEC-01 in REQUIREMENTS.md
- Implied REQ: Atomic seat availability with SELECT FOR UPDATE — source: C:\Users\DTA_WorkStation\Documents\camermove\docs\superpowers\plans\2026-08-24-camermove-lot0-lot1.md Task 0.5 — maps to: BOOK-01, BOOK-02 in REQUIREMENTS.md
- Implied REQ: Kafka event backbone + BullMQ delayed jobs — source: both SPECs — maps to: BOOK-02, NOTIF-01..03, OBS-01
- Implied REQ: Payment via NotchPay with webhook verification — source: both SPECs §7 — maps to: PAY-01..04
- Implied REQ: Media presigned uploads (MinIO) — source: both SPECs — maps to: TRANS-01, TRANS-02
- Implied REQ: Observability (OTel + Prometheus /metrics + Grafana + Sentry) — source: both SPECs — maps to: OBS-01, API-03..05

## Existing REQUIREMENTS.md

Canonical requirements remain in:

- source: C:\Users\DTA_WorkStation\Documents\camermove\.planning\REQUIREMENTS.md — 38 v1 requirements (SEARCH-01..07, AUTH-01..05, BOOK-01..05, PAY-01..04, TICK-01..02, TRANS-01..03, ADMIN-01..03, NOTIF-01..03, API-01..05, OBS-01, SEC-01) + 4 v2 + out-of-scope

No competing acceptance variants detected — no PRD-vs-PRD overlap in ingest set.
