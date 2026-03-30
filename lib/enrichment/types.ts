import {
  ContactQualityBand,
  ContactQualityTier,
  EntityRoleType,
  RegistrationStatus
} from "@/types/domain";

export interface NameCandidate {
  rawName: string;
  matchedField: "builder" | "general_contractor" | "developer" | "owner" | "unknown";
  sourceLabel: string;
  sourceUrl?: string | null;
  occurrenceCount: number;
  countyCount: number;
  cityCount: number;
  propertyCount: number;
  score: number;
}

export interface EnrichmentFieldCandidate {
  fieldName: string;
  fieldValue: string | null;
  confidence: number;
  sourceLabel: string;
  sourceUrl?: string | null;
  rationale: string;
  payload?: Record<string, unknown>;
  lastVerifiedAt?: Date | null;
}

export interface EnrichmentMatchCandidate {
  rawSourceName: string;
  normalizedEntityName: string;
  preferredSalesName: string | null;
  fingerprint: string;
  roleType: EntityRoleType;
  roleConfidenceScore: number;
  matchScore: number;
  matchStrategy: string;
  sourceLabel: string;
  sourceUrl?: string | null;
  rationale: string;
  payload?: Record<string, unknown>;
  isPrimary?: boolean;
}

export interface BuilderEnrichmentInput {
  organizationId: string;
  builder: {
    id: string;
    normalizedName: string;
    name: string;
    rawSourceName: string | null;
    preferredSalesName: string | null;
    roleType: EntityRoleType;
    confidenceScore: number;
    phone: string | null;
    email: string | null;
    website: string | null;
    mailingAddress: string | null;
    cityState: string | null;
    company: {
      id: string | null;
      legalName: string | null;
      rawSourceName: string | null;
      preferredSalesName: string | null;
      phone: string | null;
      email: string | null;
      website: string | null;
      mailingAddress: string | null;
      cityState: string | null;
    };
    contacts: Array<{
      id: string;
      fullName: string | null;
      phone: string | null;
      email: string | null;
      roleTitle: string | null;
      sourceLabel: string | null;
      sourceUrl: string | null;
      isPrimary: boolean;
    }>;
    aliases: Array<{
      rawName: string;
      normalizedName: string | null;
      fingerprint: string | null;
      sourceLabel: string | null;
      sourceUrl: string | null;
    }>;
    opportunities: Array<{
      id: string;
      address: string | null;
      city: string | null;
      county: string | null;
      parcelNumber: string | null;
      signalDate: Date;
      rawSourceName: string | null;
      builderName: string | null;
      likelyCompanyName: string | null;
      legalEntityName: string | null;
      phone: string | null;
      email: string | null;
      website: string | null;
      permit: {
        ownerName: string | null;
        contractorName: string | null;
        developerName: string | null;
        estimatedProjectValue: number | null;
      } | null;
      source: {
        name: string | null;
        sourceUrl: string | null;
      } | null;
    }>;
  };
  primaryCandidate: NameCandidate | null;
  allCandidates: NameCandidate[];
}

export interface BuilderEnrichmentContribution {
  provider: string;
  fieldCandidates?: EnrichmentFieldCandidate[];
  matchCandidates?: EnrichmentMatchCandidate[];
  aliases?: string[];
  preferredSalesName?: string | null;
  legalEntityName?: string | null;
  roleType?: EntityRoleType;
  roleConfidenceDelta?: number;
  entityConfidenceDelta?: number;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  mailingAddress?: string | null;
  cityState?: string | null;
  contractorRegistrationNumber?: string | null;
  contractorRegistrationStatus?: RegistrationStatus;
  businessEntityNumber?: string | null;
  businessEntityStatus?: RegistrationStatus;
  nextBestActionHint?: string | null;
}

export interface BuilderEnrichmentProvider {
  key: string;
  label: string;
  enrich(input: BuilderEnrichmentInput): Promise<BuilderEnrichmentContribution>;
}

export interface BuilderEnrichmentSummary {
  rawSourceName: string | null;
  normalizedEntityName: string | null;
  preferredSalesName: string | null;
  legalEntityName: string | null;
  roleType: EntityRoleType;
  entityConfidenceScore: number;
  roleConfidenceScore: number;
  contactQualityTier: ContactQualityTier;
  contactQualityBand: ContactQualityBand;
  contactQualityScore: number;
  preferredContactTarget: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  mailingAddress: string | null;
  cityState: string | null;
  contractorRegistrationNumber: string | null;
  contractorRegistrationStatus: RegistrationStatus;
  businessEntityNumber: string | null;
  businessEntityStatus: RegistrationStatus;
  builderHeatScore: number;
  nextBestAction: string;
  aliases: string[];
  fieldCandidates: EnrichmentFieldCandidate[];
  matchCandidates: EnrichmentMatchCandidate[];
}
