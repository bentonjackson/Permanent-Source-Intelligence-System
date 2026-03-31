# Live Permit and Lead Data Validation

## Core objective

BuildSignal must prove that:

- displayed permits originate from real external sources
- the app can distinguish source issue dates from scrape/check timestamps
- refreshes and re-fetches do not silently serve stale or duplicated data as if it were live
- raw changes propagate into normalized permit, contractor, and lead intelligence records
- derived fields and scores stay aligned with the latest stored source data

## Automated validation inventory

### Source freshness and origin

- `inferSourceDataOrigin`: classifies `live`, `manual`, `mock`, `unknown`
- `evaluateSourceFreshness`: derives `fresh`, `aging`, `stale`, `failed`, `unknown`
- `computeLiveDataConfidence`: combines freshness, run quality, completeness, duplicates, and origin

### Run integrity

- `summarizeRawRecordChanges`: counts `NEW`, `UPDATED`, `UNCHANGED`, `ERROR` records per latest run
- source registry UI exposes:
  - last successful sync
  - last health check
  - freshness state + detail
  - fetched / normalized counts
  - new / updated / unchanged / error counts
  - duplicates
  - live data confidence

### Transformation consistency

- `validateOpportunityTransformation`: recomputes lead intelligence + score for stored opportunities
- diagnostics samples opportunities and reports mismatches between stored and recomputed:
  - `leadType`
  - `jobFit`
  - `projectStageStatus`
  - `opportunityReason`
  - `recencyBucket`
  - `marketCluster`
  - `opportunityScore`

## Key use cases

### Live permit retrieval

1. User opens the app and sees live-source permits with source URL and timestamps.
2. User refreshes with no source change and sees stable counts with no duplicates.
3. Source adds a new permit and the next sync surfaces it as a new record.
4. Source updates a permit and the app updates the stored record in place.

### Contractor intelligence

1. Contractor names tie back to underlying permits.
2. Contractor totals and rankings change when new permits arrive.
3. Name normalization merges true duplicates without collapsing unrelated companies.

### Lead scoring and derived data

1. New permits auto-populate lead type, job fit, opportunity reason, and recency.
2. Score updates when valuation, contractor identity, or permit stage changes.
3. Keyword-driven priority shifts move records into the right working views.

### Workflow and exports

1. Filtered queue views reflect current DB-backed lead conditions.
2. Search results update after refresh/sync.
3. CSV exports match the current filtered data set.

## Negative and failure cases

- source unreachable or timed out
- parser returns empty/partial results
- source HTML or document structure drifts
- duplicate re-fetch of the same batch
- stale data not refreshed inside expected window
- mock/manual source accidentally treated as fully live
- recomputed score no longer matches stored score

## Manual validation checklist

For a sampled live record, compare BuildSignal against the source page:

- permit ID
- address
- issue date
- contractor/builder
- valuation
- source URL

Then confirm BuildSignal recomputed values still make sense:

- lead type
- job fit
- recency bucket
- opportunity reason
- score explanation
- next action

## Acceptance criteria

The system should only be considered healthy when:

- live sources are marked `fresh` or `aging`, not silently stale
- duplicate counts stay controlled
- transformation mismatch count is low
- contractor totals reconcile to underlying permits
- exports match visible filtered data
- failures are visible in diagnostics and source health, not silent
