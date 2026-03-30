import {
  ConnectorContext,
  FetchedRecord,
  NormalizedPermitInput,
  SourceConnector
} from "@/lib/connectors/shared/types";
import { fetchTextWithTimeout } from "@/lib/connectors/shared/http";
import {
  buildDedupeHash,
  inferClassification,
  normalizeWhitespace,
  parseDateToIso
} from "@/lib/connectors/shared/normalization";
import { PermitClassification } from "@/types/domain";

const sourceUrl = "https://www.johnsoncountyiowa.gov/apps";

const requestHeaders = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
};

type JohnsonStatusBucket = "active" | "on_file" | "deferred" | "site_plan" | "final_plat";

export interface JohnsonCountyApplicationRow extends Record<string, unknown> {
  caseNumber: string;
  caseType: string;
  board: string;
  statusBucket: JohnsonStatusBucket;
  projectName: string | null;
  address: string;
  ownerName: string | null;
  filedDate: string | null;
  detailUrl: string;
  summaryText: string;
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(value: string) {
  return decodeHtml(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function extractBodyHtml(html: string) {
  const match = html.match(/<div property="schema:text"[^>]*>([\s\S]*?)<h1 class="title">/i);
  return match?.[1] ?? "";
}

function inferJohnsonCaseType(caseNumber: string, summaryText: string) {
  const prefix = caseNumber.match(/^[A-Z]{2,4}/)?.[0] ?? "";
  const haystack = normalizeWhitespace(summaryText).toLowerCase();

  if (/(conditional use|special exception)/.test(haystack) || prefix === "CUP") {
    return "Conditional Use";
  }

  if (/(rezone|rezoning)/.test(haystack) || prefix === "REZ" || prefix === "PR") {
    return "Rezoning";
  }

  if (/land use map amendment/.test(haystack) || prefix === "PA") {
    return "Land Use Map Amendment";
  }

  if (/site plan/.test(haystack)) {
    return "Site Plan";
  }

  if (/final plat/.test(haystack) || prefix === "PF") {
    return "Final Plat";
  }

  if (/(parcel split|split)/.test(haystack) || prefix === "PPS") {
    return "Residential Parcel Split";
  }

  if (/(preliminary plat)/.test(haystack) || prefix === "PP") {
    return "Preliminary Plat";
  }

  if (/(subdivision|addition)/.test(haystack) || prefix === "SD" || prefix === "PZC") {
    return "Subdivision";
  }

  return "Development Application";
}

function inferJohnsonClassification(caseType: string, summaryText: string): PermitClassification {
  const haystack = `${caseType} ${summaryText}`.toLowerCase();

  if (/(parcel split|subdivision|addition|plat|single[\s-]?family|residential)/.test(haystack)) {
    if (/multi[\s-]?family|townhome|duplex|apartment/.test(haystack)) {
      return "multi_family";
    }

    return /parcel split/.test(haystack) ? "single_family_home" : "new_residential_construction";
  }

  if (/(tower|commercial|industrial|site plan|warehouse|retail|office)/.test(haystack)) {
    return "commercial";
  }

  if (/(rezone|rezoning|land use map amendment|conditional use)/.test(haystack)) {
    return inferClassification([caseType, summaryText]);
  }

  return inferClassification([caseType, summaryText]);
}

function inferJohnsonPermitStatus(bucket: JohnsonStatusBucket, board: string) {
  switch (bucket) {
    case "active":
      return `${board} hearing scheduled`;
    case "on_file":
      return "Application on file";
    case "deferred":
      return "Deferred application";
    case "site_plan":
      return "Site plan under review";
    case "final_plat":
      return "Final plat under review";
    default:
      return "Planning review";
  }
}

function parseFiledDate(summaryText: string) {
  const match = summaryText.match(/\(Filed\s+([0-9./-]+)\)/i);
  return match?.[1] ?? null;
}

function parseOwnerName(summaryText: string) {
  const owners = Array.from(summaryText.matchAll(/\(([^()]+)\)/g))
    .map((match) => normalizeWhitespace(match[1]))
    .filter((value) => value && !/^filed\b/i.test(value));

  return owners.length ? owners.join(", ") : null;
}

function parseProjectNameAndAddress(summaryText: string) {
  const withoutTrailingFile = normalizeWhitespace(summaryText.replace(/\(Filed\s+[0-9./-]+\)/gi, ""));
  const withoutOwnerChunks = normalizeWhitespace(withoutTrailingFile.replace(/\(([^()]+)\)/g, ""));
  const remainderMatch = withoutOwnerChunks.match(/^[A-Z]{2,4}-?\d{2}-\d{4,6}\s+(.+)$/i);
  const remainder = remainderMatch?.[1] ?? withoutOwnerChunks;
  const onMatch = remainder.match(/(.+?)\s+\bon\b\s+(.+)$/i);

  if (onMatch) {
    return {
      projectName: normalizeWhitespace(onMatch[1]) || null,
      address: normalizeWhitespace(onMatch[2])
    };
  }

  return {
    projectName: null,
    address: normalizeWhitespace(remainder)
  };
}

function normalizeAnchorText(anchorHtml: string) {
  return stripTags(anchorHtml).replace(/\.pdf$/i, "").trim();
}

export function extractJohnsonCountyApplicationRows(html: string) {
  const bodyHtml = extractBodyHtml(html);

  if (!bodyHtml) {
    return [];
  }

  let board = "Johnson County Planning, Development and Sustainability";
  let statusBucket: JohnsonStatusBucket = "on_file";
  const rows: JohnsonCountyApplicationRow[] = [];

  const blockPattern = /<h3[^>]*>([\s\S]*?)<\/h3>|<p[^>]*>([\s\S]*?)<\/p>/gi;

  for (const match of bodyHtml.matchAll(blockPattern)) {
    if (match[1]) {
      board = stripTags(match[1]) || board;
      continue;
    }

    const paragraphHtml = match[2] ?? "";
    const paragraphText = stripTags(paragraphHtml);

    if (!paragraphText) {
      continue;
    }

    if (/active applications to be heard/i.test(paragraphText)) {
      statusBucket = "active";
      continue;
    }

    if (/applications currently on file/i.test(paragraphText)) {
      statusBucket = "on_file";
      continue;
    }

    if (/deferred applications/i.test(paragraphText)) {
      statusBucket = "deferred";
      continue;
    }

    if (/site plan applications/i.test(paragraphText)) {
      statusBucket = "site_plan";
      continue;
    }

    if (/final plat applications/i.test(paragraphText)) {
      statusBucket = "final_plat";
      continue;
    }

    for (const anchor of paragraphHtml.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
      const detailUrl = new URL(anchor[1], sourceUrl).toString();
      const summaryText = normalizeAnchorText(anchor[2]);
      const caseMatch = summaryText.match(/^([A-Z]{2,4}-?\d{2}-\d{4,6})\s+(.+)$/i);

      if (!caseMatch) {
        continue;
      }

      const caseNumber = caseMatch[1];
      const caseType = inferJohnsonCaseType(caseNumber, summaryText);
      const location = parseProjectNameAndAddress(summaryText);

      if (!location.address) {
        continue;
      }

      rows.push({
        caseNumber,
        caseType,
        board,
        statusBucket,
        projectName: location.projectName,
        address: location.address,
        ownerName: parseOwnerName(summaryText),
        filedDate: parseFiledDate(summaryText),
        detailUrl,
        summaryText
      });
    }
  }

  return Array.from(new Map(rows.map((row) => [`${row.caseNumber}:${row.detailUrl}`, row])).values());
}

export class JohnsonCountyDevelopmentConnector implements SourceConnector {
  slug = "johnson-county-current-applications";
  displayName = "Johnson County Current Development Applications";
  connectorType = "gis_planning" as const;

  async fetch(context: ConnectorContext): Promise<FetchedRecord[]> {
    const html = await fetchTextWithTimeout(
      sourceUrl,
      {
        headers: requestHeaders,
        cache: "no-store"
      },
      {
        signal: context.signal
      }
    );

    return [
      {
        sourceRecordId: "johnson-county-current-development-applications",
        payload: {
          url: sourceUrl,
          html
        },
        fetchedAt: new Date().toISOString()
      }
    ];
  }

  async parse(records: FetchedRecord[], _context: ConnectorContext): Promise<Record<string, unknown>[]> {
    const html = String(records[0]?.payload.html ?? "");
    return extractJohnsonCountyApplicationRows(html);
  }

  async normalize(rows: Record<string, unknown>[], _context: ConnectorContext): Promise<NormalizedPermitInput[]> {
    const normalized: NormalizedPermitInput[] = [];

    for (const rawRow of rows) {
      const row = rawRow as unknown as JohnsonCountyApplicationRow;
      const classification = inferJohnsonClassification(row.caseType, row.summaryText);
      const filedDate = parseDateToIso(row.filedDate);
      const cityMatch = row.address.match(/,\s*([^,]+),\s*(?:Iowa|IA)\b/i);
      const city = cityMatch ? normalizeWhitespace(cityMatch[1]) : "Unincorporated";
      const sourceJurisdiction =
        row.board === "Board of Supervisors"
          ? "Johnson County Board of Supervisors"
          : row.board === "Zoning Board of Adjustment"
            ? "Johnson County Board of Adjustment"
            : "Johnson County PDS";

      normalized.push({
        dedupeHash: buildDedupeHash([row.caseNumber, row.address, row.detailUrl]),
        permitNumber: row.caseNumber,
        permitType: row.caseType,
        permitSubtype: row.projectName,
        permitStatus: inferJohnsonPermitStatus(row.statusBucket, row.board),
        applicationDate: filedDate,
        issueDate: null,
        projectDescription: row.summaryText,
        estimatedProjectValue: null,
        landValue: null,
        improvementValue: null,
        address: row.address,
        city,
        county: "Johnson",
        state: "IA",
        zip: null,
        parcelNumber: null,
        lotNumber: null,
        subdivision: row.projectName,
        builderName: row.ownerName,
        contractorName: row.ownerName,
        ownerName: row.ownerName,
        developerName: null,
        sourceJurisdiction,
        sourceUrl: row.detailUrl,
        classification,
        rawPayload: row as unknown as Record<string, unknown>
      });
    }

    return normalized;
  }

  async deduplicate(records: NormalizedPermitInput[], _context: ConnectorContext) {
    return Array.from(new Map(records.map((record) => [record.dedupeHash, record])).values());
  }

  calculateSourceReliability(records: NormalizedPermitInput[]) {
    if (!records.length) {
      return 55;
    }

    const withAddress = records.filter((record) => record.address && record.address !== "Unincorporated").length;
    const withBuilder = records.filter((record) => record.builderName).length;

    return Math.round(72 + (withAddress / records.length) * 12 + (withBuilder / records.length) * 10);
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
          message: `Scraped ${parsed.length} Johnson County current-development application rows from the raw county website.`
        },
        {
          level: deduped.length ? ("info" as const) : ("warning" as const),
          message: deduped.length
            ? `Normalized ${deduped.length} Johnson County development opportunities from live county application listings.`
            : "Johnson County current-development applications page loaded, but no case rows were normalized."
        }
      ]
    };
  }
}
