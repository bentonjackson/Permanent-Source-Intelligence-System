import { BuilderRecord } from "@/types/domain";

export interface GroupedLead {
  id: string;
  displayName: string;
  activeProperties: number;
  counties: string[];
  openOpportunities: number;
  lastSeenLocation: string;
  permits: number;
}

export function normalizeBuilderName(name: string) {
  return name
    .toLowerCase()
    .replace(/\b(llc|inc|co|company|homes)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function groupBuilders(builders: BuilderRecord[]): GroupedLead[] {
  return builders.map((builder) => ({
    id: builder.id,
    displayName: builder.name,
    activeProperties: builder.activeProperties,
    counties: builder.counties,
    openOpportunities: builder.openOpportunities,
    lastSeenLocation: builder.lastSeenLocation,
    permits: builder.properties.reduce((total, property) => total + property.permits.length, 0)
  }));
}
