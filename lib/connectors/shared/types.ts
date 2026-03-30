import {
  DevelopmentStage,
  PermitClassification,
  ReadinessToContact,
  SignalType,
  SourceStrength
} from "@/types/domain";

export type SourceConnectorType = "document" | "search" | "portal" | "gis_planning";

export interface ConnectorContext {
  sourceId: string;
  sourceSlug: string;
  organizationId: string;
  runId: string;
  signal?: AbortSignal;
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
  signalType?: SignalType | null;
  developmentStage?: DevelopmentStage | null;
  sourceStrength?: SourceStrength | null;
  readinessToContact?: ReadinessToContact | null;
  clusterId?: string | null;
  subdivisionId?: string | null;
  rawIdentityNames?: string[] | null;
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
  connectorType: SourceConnectorType;
  fetch(context: ConnectorContext): Promise<FetchedRecord[]>;
  parse(records: FetchedRecord[], context: ConnectorContext): Promise<Record<string, unknown>[]>;
  normalize(rows: Record<string, unknown>[], context: ConnectorContext): Promise<NormalizedPermitInput[]>;
  deduplicate(records: NormalizedPermitInput[], context: ConnectorContext): Promise<NormalizedPermitInput[]>;
  calculateSourceReliability(records: NormalizedPermitInput[]): number;
  run(context: ConnectorContext): Promise<ConnectorRunResult>;
}
