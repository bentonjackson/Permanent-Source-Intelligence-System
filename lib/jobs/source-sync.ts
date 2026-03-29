import { getConnector } from "@/lib/connectors/registry";
import { sources } from "@/lib/sample-data";

export async function runScheduledSync(sourceId: string) {
  const source = sources.find((item) => item.id === sourceId);

  if (!source) {
    throw new Error(`Unknown source: ${sourceId}`);
  }

  const connector = getConnector(source.parserType);
  const result = await connector.run({
    sourceId: source.id,
    sourceSlug: source.slug,
    organizationId: "org-demo",
    runId: `run-${Date.now()}`
  });

  return {
    source,
    result,
    summary: {
      fetched: result.fetched.length,
      normalized: result.normalized.length,
      logs: result.logs.length,
      reliabilityScore: result.reliabilityScore
    }
  };
}
