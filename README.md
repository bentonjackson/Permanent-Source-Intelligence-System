# Permanent Source Intelligence System

Permanent Source Intelligence System is a Cedar Rapids-centered plot-first lead discovery platform for an insulation sales team operating across Eastern Iowa. It is designed to continuously monitor public construction-permit and development sources, surface empty lots and early new-build signals, connect them to likely builders, and help reps ask for the insulation bid before the job is locked up.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui-style component primitives
- PostgreSQL
- Prisma
- Playwright-ready worker architecture
- Leaflet / OpenStreetMap

## MVP scope

- Multi-tenant SaaS-ready data model
- Clerk-ready auth boundary for admins and sales reps
- Plot-first opportunity queue
- Builder/company grouping as supporting context
- Single-family residential prioritization
- Source registry with mock connectors, manual CSV/XLSX import, and one real production-grade connector
- Sync jobs, logs, idempotent reruns, and raw-record provenance
- Plot queue, builder view, opportunity detail, and source registry screens

## Project structure

```text
app/
  (dashboard)/
  api/
components/
  builders/
  dashboard/
  layout/
  leads/
  map/
  records/
  sources/
  ui/
lib/
  auth/
  connectors/
  entities/
  geo/
  imports/
  jobs/
  sample-data/
  scoring/
prisma/
  migrations/
  schema.prisma
  seed.ts
```

## Local setup

1. Install Node.js 20+ and npm.
2. Copy `.env.example` to `.env` and provide PostgreSQL and Clerk keys.
3. Install dependencies:

```bash
npm install
```

4. Generate the Prisma client and run migrations:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

5. Start the app:

```bash
npm run dev
```

## Connector architecture

Every source connector implements:

- `fetch`
- `parse`
- `normalize`
- `deduplicate`
- `calculateSourceReliability`
- `run`

Milestone-one ingestion is only complete when all three are working:

- mock connectors for local development
- manual CSV/XLSX import for operational fallback
- one real production-grade connector proving the end-to-end architecture

The included real connector scaffold is `lib/connectors/real/cedar-rapids-connector.ts`. It demonstrates scheduled sync compatibility, dedupe hashing, normalized raw record handling, and idempotent reruns.

## API surface

- `GET /api/dashboard`
- `GET /api/builders`
- `GET /api/leads`
- `GET /api/opportunities`
- `GET /api/sources`
- `POST /api/imports`
- `POST /api/jobs/run-source`

## Roadmap

### Phase 1.5

- Replace seeded sample data with Prisma-backed query services
- Add Clerk middleware, organization-aware access control, and protected routes
- Persist manual imports, sync runs, logs, raw records, and plot opportunities to PostgreSQL
- Wire the Cedar Rapids real connector into the worker runtime and cron scheduler

### Phase 2

- Expand connector coverage for Iowa City, Coralville, Waterloo, Cedar Falls, Johnson County, Benton County, Buchanan County, and Black Hawk County
- Add richer entity resolution and alias-merging heuristics for builder/company normalization
- Add enrichment providers for business registry and contractor registration data
- Add optional map overlays for subdivision clusters and corridor views
- Add notification delivery for follow-up reminders and watchlists
- Add export jobs, audit tools, and rep-specific saved territory modes

## Notes

This workspace was scaffolded without a preinstalled Node/npm toolchain, so the codebase has been created directly but not executed in this environment yet.
