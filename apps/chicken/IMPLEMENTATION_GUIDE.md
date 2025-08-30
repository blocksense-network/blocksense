# Chicken Farm Demo — Development Plan

## Phase 1: Foundations (Core Backend + Database)

**Goal:** Minimal working backend with in-memory DB, then upgrade to SQLite.

### Tasks


2. **Domain & Schema**

   - Implement `EggsUpdateBody` and `EggsReadResponse` schemas with `@effect/schema`.
   - Add pure domain logic for versioning, validation.

3. **HTTP Server**

   - Boot Effect HTTP server.
   - Add `GET /v1/eggs` returning hardcoded values.
   - Add `POST /v1/eggs` accepting schema, echo back.

4. **Database Integration**

   - Add SQLite via `@effect/sql`.
   - Create migrations folder, write `001_init.sql`.
   - Wire repository layer (`EggsRepo`) with `getCurrent` + `update`.

5. **End-to-End Happy Path**

   - Post a new price/supply → read returns updated value.

---

## Phase 2: Basic Frontend (Dashboard)

**Goal:** UI to view and update eggs.

### Tasks

1. **Frontend setup**

   - Vite + React app in `apps/web`.
   - Configure Tailwind.

2. **Read flow**

   - Call `GET /v1/eggs`.
   - Display price, supply, last update.

3. **Write flow**

   - Form with price + supply fields.
   - Submit to `POST /v1/eggs` (use hardcoded admin token for demo).
   - Show success or error message.

---

## Phase 3: Testing Infrastructure

**Goal:** Reliable test suite with Vitest.

### Tasks

1. **Unit tests**

   - Schema validation tests.
   - Domain logic tests.

2. **Integration tests**

   - Spin up in-memory SQLite.
   - Test GET/POST roundtrip.
   - Test auth failures, bad input, version conflict.

3. **End-to-end scenario**

   - Post → Read → Assert equal.

---

## Phase 4: Security & Observability (Demo-Ready)

**Goal:** Make demo realistic enough for bootcamp.

### Tasks

1. **Auth**

   - Add Bearer token check to POST.
   - Token from env var.

2. **Validation**

   - Enforce schema at route boundaries.
   - Return structured errors.

3. **Logs**

   - Add structured logging Layer.
   - Log per request: method, path, status.

4. **Health endpoint**

   - `GET /v1/healthz`.

---

## Phase 5: Demo Polish (Optional)

**Goal:** Nice presentation for bootcamp.

### Tasks

1. **Frontend polish**

   - Refresh after update.
   - Add optimistic concurrency support with `expectedVersion`.
   - Error handling UI.

2. **Docs**

   - README with setup steps and curl examples.
   - Architecture diagram (high level).
   - Short narrative: “Farmer posts egg supply to oracle.”

---

## Deferred (Future Phases)

These are **explicitly out of first milestone**:

- **CI Pipeline** (GitHub Actions, coverage, lint).
- **Performance & Reliability** (load tests, SLOs, metrics).
- **Deployment** (Docker, Compose, hosting).
- **Oracle Publisher Module** (off-chain → on-chain).
- **Advanced security** (rate limit, CSP, CORS hardening).

---

## Milestone Timeline (Estimates)

- **Day 1–2**: Phase 1 backend foundations.
- **Day 3–4**: Phase 2 frontend dashboard.
- **Day 5**: Phase 3 testing infra + happy path tests.
- **Day 6**: Phase 4 security + observability.
- **Day 7**: Phase 5 polish + demo rehearsal.
