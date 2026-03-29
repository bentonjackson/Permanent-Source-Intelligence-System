import { PermitClassification } from "@/types/domain";

export interface ConnectorContext {
  sourceId: string;
  sourceSlug: string;
  organizationId: string;
  runId: string;
}

export interface FetchedRecord {
  sourceRecordId: string;
  payload: Record<string, unknown>;
  fetchedAt: string;
}

export interface NormalizedPermitInput {
  dedupeHash: string;
  permitNumber: string;
  permitType: string;
  permitSubtype?: string | null;
  permitStatus: string;
  applicationDate?: string | null;
  issueDate?: string | null;
  projectDescription?: string | null;
  estimatedProjectValue?: number | null;
  landValue?: number | null;
  improvementValue?: number | null;
  address: string;
  city: string;
  county: string;
  state: string;
  zip?: string | null;
  parcelNumber?: string | null;
  lotNumber?: string | null;
  subdivision?: string | null;
  builderName?: string | null;
  contractorName?: string | null;
  ownerName?: string | null;
  developerName?: string | null;
  sourceJurisdiction: string;
  sourceUrl: string;
  classification: PermitClassification;
  rawPayload: Record<string, unknown>;
}

export interface ConnectorLog {
  level: "info" | "warning" | "error";
  message: string;
  metadata?: Record<string, unknown>;
}

export interface ConnectorRunResult {
  fetched: FetchedRecord[];
  normalized: NormalizedPermitInput[];
  logs: ConnectorLog[];
  reliabilityScore: number;
}

export interface SourceConnector {
  slug: string;
  displayName: string;
  fetch(context: ConnectorContext): Promise<FetchedRecord[]>;
  parse(records: FetchedRecord[], context: ConnectorContext): Promise<Record<string, unknown>[]>;
  normalize(rows: Record<string, unknown>[], context: ConnectorContext): Promise<NormalizedPermitInput[]>;
  deduplicate(records: NormalizedPermitInput[], context: ConnectorContext): Promise<NormalizedPermitInput[]>;
  calculateSourceReliability(records: NormalizedPermitInput[]): number;
  run(context: ConnectorContext): Promise<ConnectorRunResult>;
}
