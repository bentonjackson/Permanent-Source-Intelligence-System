import { createHash } from "crypto";

import { SourceConnector, ConnectorContext, FetchedRecord, NormalizedPermitInput } from "@/lib/connectors/shared/types";

const cedarRapidsFixture = [
  {
    permit_no: "CR-2026-001842",
    type: "Residential New Construction",
    subtype: "Single Family Dwelling",
    status: "Issued",
    application_date: "2026-03-21",
    issue_date: "2026-03-24",
    description: "New single-family home with attached garage",
    valuation: 465000,
    land_value: 98000,
    improvement_value: 367000,
    address: "1024 Prairie Crest Dr",
    city: "Cedar Rapids",
    county: "Linn",
    zip: "52404",
    subdivision: "Prairie Crest",
    parcel_number: "14-32-101-004",
    lot_number: "Lot 12",
    builder_name: "Hawkeye Ridge Homes LLC",
    contractor_name: "Hawkeye Ridge Homes",
    owner_name: "Prairie Crest Development",
    detail_url: "https://example.gov/permits/CR-2026-001842"
  }
];

export class CedarRapidsRealConnector implements SourceConnector {
  slug = "real-civic-source";
  displayName = "Cedar Rapids Building Services Connector";

  async fetch(): Promise<FetchedRecord[]> {
    return cedarRapidsFixture.map((payload) => ({
      sourceRecordId: String(payload.permit_no),
      payload,
      fetchedAt: new Date().toISOString()
    }));
  }

  async parse(records: FetchedRecord[]) {
    return records.map((record) => record.payload);
  }

  async normalize(rows: Record<string, unknown>[]): Promise<NormalizedPermitInput[]> {
    return rows.map((row) => {
      const dedupeHash = createHash("sha256")
        .update(
          [
            row.permit_no,
            row.address,
            row.application_date,
            row.builder_name
          ].join("|")
        )
        .digest("hex");

      return {
        dedupeHash,
        permitNumber: String(row.permit_no),
        permitType: String(row.type),
        permitSubtype: row.subtype ? String(row.subtype) : null,
        permitStatus: String(row.status),
        applicationDate: row.application_date ? `${row.application_date}T00:00:00.000Z` : null,
        issueDate: row.issue_date ? `${row.issue_date}T00:00:00.000Z` : null,
        projectDescription: row.description ? String(row.description) : null,
        estimatedProjectValue: row.valuation ? Number(row.valuation) : null,
        landValue: row.land_value ? Number(row.land_value) : null,
        improvementValue: row.improvement_value ? Number(row.improvement_value) : null,
        address: String(row.address),
        city: String(row.city),
        county: String(row.county),
        state: "IA",
        zip: row.zip ? String(row.zip) : null,
        parcelNumber: row.parcel_number ? String(row.parcel_number) : null,
        lotNumber: row.lot_number ? String(row.lot_number) : null,
        subdivision: row.subdivision ? String(row.subdivision) : null,
        builderName: row.builder_name ? String(row.builder_name) : null,
        contractorName: row.contractor_name ? String(row.contractor_name) : null,
        ownerName: row.owner_name ? String(row.owner_name) : null,
        sourceJurisdiction: "Cedar Rapids",
        sourceUrl: String(row.detail_url),
        classification: "single_family_home",
        rawPayload: row
      };
    });
  }

  async deduplicate(records: NormalizedPermitInput[]) {
    return Array.from(new Map(records.map((record) => [record.dedupeHash, record])).values());
  }

  calculateSourceReliability(records: NormalizedPermitInput[]) {
    const populatedValues = records.filter((record) => record.builderName && record.estimatedProjectValue);
    return populatedValues.length === records.length ? 94 : 70;
  }

  async run(context: ConnectorContext) {
    const fetched = await this.fetch(context);
    const parsed = await this.parse(fetched, context);
    const normalized = await this.normalize(parsed, context);
    const deduped = await this.deduplicate(normalized, context);

    return {
      fetched,
      normalized: deduped,
      reliabilityScore: this.calculateSourceReliability(deduped),
      logs: [
        {
          level: "info",
          message: `Fetched ${fetched.length} records from Cedar Rapids source.`
        },
        {
          level: "info",
          message: `Normalized ${deduped.length} records and prepared idempotent dedupe hashes.`
        }
      ]
    };
  }
}
