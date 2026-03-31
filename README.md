# Permanent Source Intelligence System

Permanent Source Intelligence System is a database-first lead intelligence and workflow platform for an Eastern Iowa insulation sales team. It stores public construction signals, groups them under builders and properties, and gives reps a simple daily workflow:

`Plot Queue -> Contacted -> Closed`

The application is centered on Cedar Rapids and seeded for the corridor counties that matter most to the team.

## What It Does

- Scrapes official public construction sources in background sync jobs
- Writes every sync into PostgreSQL as:
  - `sources`
  - `source_sync_runs`
  - `raw_records`
  - `permits`
  - `properties`
  - `builders`
  - `plot_opportunities`
  - `opportunity_contact_snapshots`
  - `opportunity_stage_history`
  - `contacts`
  - `activities`
  - `source_health_checks`
  - `review_queue_items`
- Reads the UI only from the database
- Groups multiple properties under one builder
- Tracks outreach, follow-up, won/lost outcomes, and notes
- Supports manual CSV/XLSX import through the same deduplicated pipeline
- Stores reviewable source-health and weak-identity diagnostics instead of silently dropping low-confidence records
- Uses stable identity keys for permits, properties, builders, and opportunities so repeated syncs update records in place
- Blocks malformed normalized records before they become active opportunities and routes them to review instead
- Tracks source-change versions, fingerprints, and change summaries for permits and opportunities
- Scores source health with completeness, blocked-record, duplicate, and drift-aware warning signals

## Current Live Connectors

- Cedar Rapids permit reports
  - [cedar-rapids.org permit reports](https://www.cedar-rapids.org/local_government/departments_a_-_f/building_services/building_and_trades/permit_reports.php)
- Linn County planning agenda
  - [gis.linncountyiowa.gov planning agenda PDF](https://gis.linncountyiowa.gov/web-data/planning/committee-documentation/agenda.pdf)
- Johnson County current development applications
  - [johnsoncountyiowa.gov/apps](https://www.johnsoncountyiowa.gov/apps)
- Tiffin permit portal
  - [portal.iworq.net/TIFFIN/permits/600](https://portal.iworq.net/TIFFIN/permits/600)

Registered but not yet active:

- Linn County assessor building data
- Cedar Rapids residential assessor data
- Cedar Rapids permit viewer
- Cedar Falls EnerGov search
- Waterloo EnerGov search
- Johnson / Black Hawk / Benton / Buchanan assessor searches
- Cedar Rapids, Linn, Johnson, Black Hawk, Benton, and Buchanan planning / GIS support sources

## Main Screens

- `Dashboard`
  - top opportunities
  - hottest builders
  - active counties
  - follow-ups due
- `Plot Queue`
  - grouped by county
  - grouped again by builder inside each county
  - parcel-level actions to move to contacted, mark not a fit, and assign rep
- `Contacted`
  - fully database-backed daily sales workspace
  - primary contact, last contact, next follow-up, activity history, notes
  - quick actions for call, email, follow-up, interested/not interested, won/lost
- `Closed`
  - won and lost jobs
- `Builders`
  - grouped builder rollups with total value, counties, and last activity
- `Sources`
  - source registry
  - source health snapshots
  - review queue for weak identities and parse issues
  - diagnostics trigger
  - background sync trigger
  - manual import panel

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Prisma
- PostgreSQL / Neon
- Vitest
- Playwright-ready connector/worker architecture

## Project Layout

```text
app/
  (dashboard)/
  api/
components/
  builders/
  dashboard/
  layout/
  opportunities/
  sources/
  ui/
lib/
  app/
  connectors/
  db/
  diagnostics/
  enrichment/
  geo/
  imports/
  jobs/
  opportunities/
  review/
  scoring/
  sources/
prisma/
  migrations/
  schema.prisma
  seed.ts
workers/
  run-source-sync.ts
```

## Local Setup

1. Install dependencies.

```bash
npm install
```

2. Copy `.env.example` to `.env` and set `DATABASE_URL`.

3. Generate Prisma, apply migrations, and seed metadata.

```bash
npm run db:generate
npx prisma migrate deploy
npm run db:seed
```

4. Run the background sync to load live records into the database.

```bash
npm run worker:sync
```

5. Start the app.

```bash
npm run dev
```

## Useful Commands

```bash
npm run typecheck
npm test
npm run build
npm run diagnostics
npm run worker:sync
npm run worker:enrich
```

## API Endpoints

- `GET /api/dashboard`
- `GET /api/builders`
- `GET /api/leads`
- `GET /api/opportunities`
- `GET /api/sources`
- `PATCH /api/opportunities/[opportunityId]`
- `GET /api/contacted`
- `GET /api/contacted/[opportunityId]`
- `POST /api/opportunities/[opportunityId]/move-to-contacted`
- `PATCH /api/opportunities/[opportunityId]/workflow`
- `POST /api/opportunities/[opportunityId]/contacts`
- `POST /api/opportunities/[opportunityId]/activities`
- `PATCH /api/contacts/[contactId]`
- `DELETE /api/contacts/[contactId]`
- `POST /api/imports`
- `POST /api/jobs/run-source`
- `POST /api/jobs/run-diagnostics`

## Important Architecture Notes

- The database is the source of truth.
- The UI does not scrape during page load.
- Connectors run in background jobs and persist results.
- Manual import uses the same normalization and deduplication path as connectors.
- Moving a lead from Plot Queue to Contacted writes the stage change, timestamps, and initial `status_changed` activity to Postgres immediately.
- The Contacted page reads only from normalized database tables. It does not depend on browser-local or in-memory workflow state.
- Contact records are stored in Postgres at the opportunity level and can also stay linked to the builder/company for reuse.
- Every opportunity now also stores a database-backed contact snapshot so the best-known sales identity and primary contact stay attached through Plot Queue, Contacted, Quote, and Closed states.
- Stage changes are written to `opportunity_stage_history` so lifecycle movement is auditable.
- Activity rows store calls, emails, notes, follow-ups, and status changes with timestamps so follow-up history survives refreshes, redeploys, and repeat syncs.
- Source sync preserves manual sales data. Re-ingestion can refresh source-derived fields, but it does not wipe rep assignment, contact records, notes, or activity history.
- Sync runs now write health checks and open review items for parse failures, weak identities, missing fields, ambiguous matches, and missing contact channels.
- Sync runs now also store per-run change counts (`new`, `updated`, `unchanged`, `error`), blocked-record counts, completeness scores, and drift scores.
- Connector runs retry once on transient failure and preserve prior good data if a source degrades.
- Source drift detection warns when normalized output drops sharply, completeness collapses, or parse error rates spike compared to the previous healthy run.
- Opportunities and contacts now store normalized identity/contact fields plus duplicate-risk and review-required signals for safer long-term re-sync behavior.
- Local auth middleware is currently in demo-pass-through mode so the app can run without Clerk keys. The project remains Clerk-ready.

## Verification In This Workspace

The following checks passed after the DB-first refactor:

- `npm run db:generate`
- `npx prisma db push`
- `npm run db:seed`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run worker:enrich`

Runtime smoke test also passed locally against Next dev:

- `/api/opportunities` returned `30` stored opportunities
- `/api/builders` returned `21` builders
- `/api/sources` returned the persisted source registry with active live connectors

## Phase 2 Roadmap

- Activate Linn County assessor parser
- Activate Cedar Rapids residential assessor parser
- Add Waterloo / Cedar Falls city and county connectors
- Add richer builder alias resolution and contact enrichment
- Add territory-aware notifications and rep-specific saved views
- Add protected auth flows and production role management
