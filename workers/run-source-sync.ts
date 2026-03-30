import { runBuilderEnrichment } from "@/lib/enrichment/builder-enrichment";
import { runScheduledSync } from "@/lib/jobs/source-sync";
import { officialSourceDefinitions } from "@/lib/sources/official-sources";

async function main() {
  let failed = false;
  const results = [];

  for (const source of officialSourceDefinitions.filter((item) => item.active)) {
    console.log(`Starting ${source.name}...`);

    try {
      const result = await runScheduledSync(source.id);
      results.push(result);
      console.log(
        `${result.source.name}: fetched=${result.summary.fetched} normalized=${result.summary.normalized} deduped=${result.summary.deduped}`
      );
    } catch (error) {
      failed = true;
      const message = error instanceof Error ? error.message : "Unknown source sync failure.";
      results.push({
        source,
        summary: {
          fetched: 0,
          normalized: 0,
          deduped: 0,
          reliabilityScore: 0
        },
        error: message
      });
      console.error(`${source.name}: FAILED ${message}`);
    }
  }

  console.log("Starting builder enrichment...");
  const enrichmentResult = await runBuilderEnrichment();
  console.log(`Builder enrichment processed=${enrichmentResult.processed}`);

  for (const result of results) {
    if ("error" in result) {
      continue;
    }
  }

  if (failed) {
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
