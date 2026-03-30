import { SourceConnector, ConnectorContext, FetchedRecord, NormalizedPermitInput } from "@/lib/connectors/shared/types";

const mockPayload = [
  {
    permitNumber: "MOCK-1001",
    permitType: "Residential New Construction",
    permitSubtype: "Single Family Dwelling",
    permitStatus: "Issued",
    address: "1103 Elm Ridge Dr",
    city: "Cedar Rapids",
    county: "Linn",
    builderName: "Hawkeye Ridge Homes",
    estimatedProjectValue: 452000
  }
];

export class MockSourceConnector implements SourceConnector {
  slug = "mock-structured";
  displayName = "Mock Structured Connector";
  connectorType = "portal" as const;

  async fetch(_context: ConnectorContext): Promise<FetchedRecord[]> {
    return mockPayload.map((payload, index) => ({
      sourceRecordId: `mock-${index}`,
      payload,
      fetchedAt: new Date().toISOString()
    }));
  }

  async parse(records: FetchedRecord[], _context: ConnectorContext) {
    return records.map((record) => record.payload);
  }

  async normalize(rows: Record<string, unknown>[], _context: ConnectorContext): Promise<NormalizedPermitInput[]> {
    return rows.map((row) => ({
      dedupeHash: `mock:${String(row.permitNumber)}`,
      permitNumber: String(row.permitNumber),
      permitType: String(row.permitType),
      permitSubtype: String(row.permitSubtype),
      permitStatus: String(row.permitStatus),
      estimatedProjectValue: Number(row.estimatedProjectValue),
      address: String(row.address),
      city: String(row.city),
      county: String(row.county),
      state: "IA",
      builderName: String(row.builderName),
      sourceJurisdiction: String(row.city),
      sourceUrl: "mock://waterloo-demo",
      classification: "single_family_home",
      rawPayload: row
    }));
  }

  async deduplicate(records: NormalizedPermitInput[], _context: ConnectorContext) {
    return Array.from(new Map(records.map((record) => [record.dedupeHash, record])).values());
  }

  calculateSourceReliability(records: NormalizedPermitInput[]) {
    return records.length ? 82 : 20;
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
          level: "info" as const,
          message: `Mock connector processed ${deduped.length} permit rows.`
        }
      ]
    };
  }
}
