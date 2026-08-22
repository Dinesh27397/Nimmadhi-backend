# Nimmadhi Backend Agent Instructions

- This repository is the NestJS/PostgreSQL backend.
- Treat user ownership, monetary accuracy, idempotency and auditability as release-critical.
- All reads and writes for user-owned records must include the authenticated user identifier.
- Use decimal-safe monetary handling and database transactions for multi-step financial updates.
- Never log secrets, tokens, OTPs, bank details, or full financial payloads.
- Preserve API contracts unless a coordinated mobile/backend change is explicitly approved.
- Run lint, type-checking, unit tests, integration tests and Prisma validation after changes.
- Do not commit, push, migrate production data, or deploy unless explicitly instructed.
