import { PDFParse } from "pdf-parse";

import {
  ConnectorContext,
  FetchedRecord,
  NormalizedPermitInput,
  SourceConnector
} from "@/lib/connectors/shared/types";
import { fetchBufferWithTimeout } from "@/lib/connectors/shared/http";
import {
  buildDedupeHash,
  inferClassification,
  normalizeWhitespace,
  parseDateToIso
} from "@/lib/connectors/shared/normalization";
import { PermitClassification } from "@/types/domain";

const agendaPdfUrl = "https://gis.linncountyiowa.gov/web-data/planning/committee-documentation/agenda.pdf";

const requestHeaders = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
};

export interface LinnCountyAgendaCase extends Record<string, unknown> {
  caseNumber: string;
  committee: string;
  agendaDate: string | null;
  caseType: string;
  projectName: string | null;
  address: string;
  ownerName: string | null;
  description: string;
}

function inferLinnCaseType(caseNumber: string, description: string) {
  const prefix = caseNumber.match(/^[A-Z]{2,4}/)?.[0] ?? "";
  const haystack = normalizeWhitespace(description).toLowerCase();

  if (/preliminary plat/.test(haystack) || prefix === "PP") {
    return "Preliminary Plat";
  }

  if (/final plat/.test(haystack) || prefix === "PF") {
    return "Final Plat";
  }

  if (/parcel split/.test(haystack) || prefix === "PPS") {
    return "Residential Parcel Split";
  }

  if (/rezoning/.test(haystack) || prefix === "PR") {
    return "Rezoning";
  }

  if (/land use map amendment/.test(haystack) || prefix === "PA") {
    return "Land Use Map Amendment";
  }

  return "Planning Case";
}

function inferLinnClassification(caseType: string, description: string): PermitClassification {
  const haystack = `${caseType} ${description}`.toLowerCase();

  if (/(preliminary plat|final plat|parcel split|addition|subdivision|residential)/.test(haystack)) {
    if (/multi[\s-]?family|townhome|apartment|duplex/.test(haystack)) {
      return "multi_family";
    }

    return /parcel split/.test(haystack) ? "single_family_home" : "new_residential_construction";
  }

  if (/(commercial|office|warehouse|retail|industrial|major site plan)/.test(haystack)) {
    return "commercial";
  }

  return inferClassification([caseType, description]);
}

function parseAgendaDate(text: string) {
  const match = text.match(/MEETING AGENDA\s+([A-Za-z]+,\s+[A-Za-z]+\s+\d{1,2},\s+\d{4})/i);
  return match?.[1] ?? null;
}

function parseCommittee(text: string) {
  const trimmed = text.trimStart();
  const match = trimmed.match(/^LINN COUNTY\s+(.+?)\s+MEETING AGENDA/im);
  return normalizeWhitespace(match?.[1] ?? "Planning & Development");
}

function parseOwnerName(description: string) {
  const match = description.match(/\.\s+(.+?),\s+owners?\b/i);
  return normalizeWhitespace(match?.[1] ?? "") || null;
}

function parseAddress(description: string) {
  const match = description.match(
    /(?:located at|located in| at)\s+(.+?)(?=,\s+from\b|(?:\.\s+.+?,\s+owners?\b)|(?:\.\s+.+?,\s+owner\b)|\.|$)/i
  );
  return normalizeWhitespace(match?.[1] ?? "");
}

function parseProjectName(description: string, caseType: string) {
  const locatedAtIndex = description.search(/,\s+located (?:at|in)\b/i);

  if (locatedAtIndex === -1) {
    return null;
  }

  const beforeLocation = normalizeWhitespace(description.slice(0, locatedAtIndex));
  const afterFor = normalizeWhitespace(beforeLocation.replace(/^.*?\bfor\b\s+/i, ""));

  if (!afterFor) {
    return null;
  }

  const explicitTypePattern = new RegExp(`^(?:a|an)\\s+${caseType.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*,\\s*(.+)$`, "i");
  const explicitTypeMatch = afterFor.match(explicitTypePattern);

  if (explicitTypeMatch) {
    return normalizeWhitespace(explicitTypeMatch[1]) || null;
  }

  if (/^(a|an)\s+/i.test(afterFor)) {
    return null;
  }

  return afterFor;
}

export function extractLinnCountyAgendaCases(text: string) {
  const normalizedText = text.replace(/\r/g, "").replace(/\u00a0/g, " ");
  const committee = parseCommittee(normalizedText);
  const agendaDate = parseAgendaDate(normalizedText);
  const casePattern =
    /([A-Z]{2,4}\d{2}-\d{4,})\.\s+([\s\S]*?)(?=(?:[A-Z]{2,4}\d{2}-\d{4,})\.|Other Business|Adjournment|Commission Comments|-- \d+ of \d+ --|$)/g;
  const rows: LinnCountyAgendaCase[] = [];

  for (const match of normalizedText.matchAll(casePattern)) {
    const caseNumber = match[1];
    const description = normalizeWhitespace(match[2]);
    const caseType = inferLinnCaseType(caseNumber, description);
    const address = parseAddress(description);

    if (!address) {
      continue;
    }

    rows.push({
      caseNumber,
      committee,
      agendaDate,
      caseType,
      projectName: parseProjectName(description, caseType),
      address,
      ownerName: parseOwnerName(description),
      description
    });
  }

  return Array.from(new Map(rows.map((row) => [`${row.caseNumber}:${row.address}`, row])).values());
}

async function fetchAgendaText(signal?: AbortSignal) {
  const buffer = await fetchBufferWithTimeout(
    agendaPdfUrl,
    {
      headers: requestHeaders,
      cache: "no-store"
    },
    {
      signal,
      timeoutMs: 20000
    }
  );
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  await parser.destroy();
  return result.text;
}

async function fetchHeadMetadata(signal?: AbortSignal) {
  const response = await fetch(agendaPdfUrl, {
    method: "HEAD",
    headers: requestHeaders,
    cache: "no-store",
    signal
  });

  if (!response.ok) {
    throw new Error(`Failed request ${response.status} for ${agendaPdfUrl}`);
  }

  return {
    lastModified: response.headers.get("last-modified"),
    contentLength: response.headers.get("content-length")
  };
}

export class LinnCountyAgendaConnector implements SourceConnector {
  slug = "linn-county-planning-agenda";
  displayName = "Linn County Planning Agenda PDF";
  connectorType = "document" as const;

  async fetch(context: ConnectorContext): Promise<FetchedRecord[]> {
    const metadata = await fetchHeadMetadata(context.signal);

    return [
      {
        sourceRecordId: "linn-county-planning-agenda-pdf",
        payload: {
          url: agendaPdfUrl,
          lastModified: metadata.lastModified,
          contentLength: metadata.contentLength
        },
        fetchedAt: new Date().toISOString()
      }
    ];
  }

  async parse(records: FetchedRecord[], context: ConnectorContext): Promise<Record<string, unknown>[]> {
    const text = await fetchAgendaText(context.signal);
    const rows = extractLinnCountyAgendaCases(text);
    const lastModified = String(records[0]?.payload.lastModified ?? "");

    return rows.map((row) => ({
      ...row,
      __sourceUrl: agendaPdfUrl,
      __lastModified: lastModified || null
    }));
  }

  async normalize(rows: Record<string, unknown>[], _context: ConnectorContext): Promise<NormalizedPermitInput[]> {
    const normalized: NormalizedPermitInput[] = [];

    for (const rawRow of rows) {
      const row = rawRow as unknown as LinnCountyAgendaCase & {
        __sourceUrl: string;
        __lastModified: string | null;
      };
      const classification = inferLinnClassification(row.caseType, row.description);
      const agendaDate = parseDateToIso(row.agendaDate);
      const lastModified = parseDateToIso(row.__lastModified);
      const cityMatch = row.address.match(/,\s*([^,]+),\s*(?:Iowa|IA)\b/i);
      const city = cityMatch ? normalizeWhitespace(cityMatch[1]) : "Unincorporated";

      normalized.push({
        dedupeHash: buildDedupeHash([row.caseNumber, row.address, row.__sourceUrl]),
        permitNumber: row.caseNumber,
        permitType: row.caseType,
        permitSubtype: row.projectName,
        permitStatus: `${row.committee} agenda review`,
        applicationDate: agendaDate,
        issueDate: lastModified ?? agendaDate,
        projectDescription: row.description,
        estimatedProjectValue: null,
        landValue: null,
        improvementValue: null,
        address: row.address,
        city,
        county: "Linn",
        state: "IA",
        zip: row.address.match(/\b(\d{5})\b/)?.[1] ?? null,
        parcelNumber: null,
        lotNumber: null,
        subdivision: row.projectName,
        builderName: row.ownerName,
        contractorName: row.ownerName,
        ownerName: row.ownerName,
        developerName: null,
        sourceJurisdiction: `Linn County ${row.committee}`,
        sourceUrl: row.__sourceUrl,
        classification,
        rawPayload: rawRow
      });
    }

    return normalized;
  }

  async deduplicate(records: NormalizedPermitInput[], _context: ConnectorContext) {
    return Array.from(new Map(records.map((record) => [record.dedupeHash, record])).values());
  }

  calculateSourceReliability(records: NormalizedPermitInput[]) {
    if (!records.length) {
      return 58;
    }

    const withAddress = records.filter((record) => record.address).length;
    const withBuilder = records.filter((record) => record.builderName).length;

    return Math.round(76 + (withAddress / records.length) * 10 + (withBuilder / records.length) * 8);
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
          message: `Scraped ${parsed.length} Linn County planning cases from the raw county agenda PDF.`
        },
        {
          level: deduped.length ? ("info" as const) : ("warning" as const),
          message: deduped.length
            ? `Normalized ${deduped.length} Linn County agenda cases from the county GIS planning agenda PDF.`
            : "Linn County agenda PDF loaded, but no agenda cases were normalized."
        }
      ]
    };
  }
}
