import { MockSourceConnector } from "@/lib/connectors/mock/mock-source";
import { CedarRapidsRealConnector } from "@/lib/connectors/real/cedar-rapids-connector";
import { SourceConnector } from "@/lib/connectors/shared/types";

const registry = new Map<string, SourceConnector>([
  ["mock-structured", new MockSourceConnector()],
  ["real-civic-source", new CedarRapidsRealConnector()]
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
