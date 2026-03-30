import { MockSourceConnector } from "@/lib/connectors/mock/mock-source";
import { CedarRapidsRealConnector } from "@/lib/connectors/real/cedar-rapids-connector";
import { CoralvillePermitConnector } from "@/lib/connectors/real/coralville-permit-connector";
import { JohnsonCountyDevelopmentConnector } from "@/lib/connectors/real/johnson-county-development-connector";
import { LinnCountyAgendaConnector } from "@/lib/connectors/real/linn-county-agenda-connector";
import { TiffinPermitConnector } from "@/lib/connectors/real/tiffin-permit-connector";
import { SourceConnector } from "@/lib/connectors/shared/types";

const registry = new Map<string, SourceConnector>([
  ["mock-structured", new MockSourceConnector()],
  ["real-civic-source", new CedarRapidsRealConnector()],
  ["cedar-rapids-monthly-reports", new CedarRapidsRealConnector()],
  ["tiffin-permit-portal", new TiffinPermitConnector()],
  ["coralville-permit-portal", new CoralvillePermitConnector()],
  ["johnson-county-current-applications", new JohnsonCountyDevelopmentConnector()],
  ["linn-county-planning-agenda", new LinnCountyAgendaConnector()]
]);

export function getConnector(parserType: string) {
  const connector = registry.get(parserType);

  if (!connector) {
    throw new Error(`No connector registered for parser type "${parserType}".`);
  }

  return connector;
}

export function listConnectors() {
  return [...registry.values()];
}
