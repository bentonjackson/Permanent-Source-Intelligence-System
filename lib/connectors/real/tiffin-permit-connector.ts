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
  parseCurrency,
  parseDateToIso
} from "@/lib/connectors/shared/normalization";

const baseUrl = "https://portal.iworq.net/TIFFIN/permits/600";

const requestHeaders = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
};

export interface TiffinPermitRow extends Record<string, unknown> {
  permitNumber: string;
  permitDate: string | null;
  address: string;
  detailUrl: string;
  externalId: string;
}

export interface TiffinPermitDetail extends Record<string, unknown> {
  permitNumber: string;
  permitDate: string | null;
  permitType: string;
  permitSubtype: string | null;
  applicantType: string | null;
  applicantName: string | null;
  permitIssuedDate: string | null;
  constructionValue: number | null;
  status: string;
  contractorName: string | null;
  parcelNumber: string | null;
  address: string;
  city: string;
  state: string;
  zip: string | null;
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
  return normalizeWhitespace(decodeHtml(value).replace(/<[^>]+>/g, " "));
}

function resolveUrl(path: string) {
  return new URL(path, baseUrl).toString();
}

export function extractTiffinPageUrls(html: string) {
  const pageUrls = Array.from(html.matchAll(/href="([^"]+?\/permits\/600\?page=\d+)"/gi)).map((match) =>
    resolveUrl(match[1])
  );

  return [baseUrl, ...pageUrls].filter((value, index, array) => array.indexOf(value) === index).slice(0, 3);
}

export function extractTiffinPermitRows(html: string) {
  const rowPattern =
    /<tr>[\s\S]*?data-route="([^"]+\/permit\/600\/(\d+))"[\s\S]*?<a href="[^"]+">([^<]+)<\/a>[\s\S]*?data-label="Date"[^>]*>([\s\S]*?)<\/td>[\s\S]*?data-label="Parcel Address"[^>]*>([\s\S]*?)<\/td>[\s\S]*?<\/tr>/gi;

  const rows: TiffinPermitRow[] = [];

  for (const match of html.matchAll(rowPattern)) {
    const detailUrl = resolveUrl(match[1]);
    const externalId = match[2];
    const permitNumber = stripTags(match[3]);
    const permitDate = stripTags(match[4]) || null;
    const address = stripTags(match[5]);

    if (!permitNumber || !address) {
      continue;
    }

    rows.push({
      permitNumber,
      permitDate,
      address,
      detailUrl,
      externalId
    });
  }

  return Array.from(new Map(rows.map((row) => [row.detailUrl, row])).values());
}

function extractContractorName(html: string) {
  const contractorSection = html.match(/<h2>Contractors<\/h2>([\s\S]*?)(?:<h2>|$)/i)?.[1] ?? "";
  const contractorBlocks = Array.from(
    contractorSection.matchAll(/<div[^>]*class="contractor[^"]*"[^>]*>[\s\S]*?<div>\s*([\s\S]*?)<\/div>/gi)
  ).map((match) => stripTags(match[1]));

  for (const block of contractorBlocks) {
    const [name] = block.split(" - ").map((part) => normalizeWhitespace(part));

    if (name && !/^self$/i.test(name)) {
      return name;
    }
  }

  return null;
}

function extractPropertyInfo(html: string) {
  const propertySection = html.match(/<h2>Property Information<\/h2>([\s\S]*?)(?:<h2>|$)/i)?.[1] ?? "";
  const lines = Array.from(propertySection.matchAll(/<div>([\s\S]*?)<\/div>/gi)).map((match) => stripTags(match[1]));
  const parcelNumber = lines[0]?.replace(/^Parcel #:\s*/i, "") || null;
  const address = lines[1] ?? "";
  const location = lines[2] ?? "";
  const locationMatch = location.match(/^([^,]+),\s*([A-Z]{2})\s*(\d{5})?$/i);

  return {
    parcelNumber,
    address,
    city: normalizeWhitespace(locationMatch?.[1] ?? "Tiffin"),
    state: normalizeWhitespace(locationMatch?.[2] ?? "IA"),
    zip: locationMatch?.[3] ?? null
  };
}

export function extractTiffinPermitDetail(html: string) {
  const rows = Array.from(
    html.matchAll(
      /<div class="row">\s*<div class="col">\s*([^:<]+):\s*<\/div>\s*<div class="col">\s*([\s\S]*?)\s*<\/div>\s*<\/div>/gi
    )
  );

  const values = new Map<string, string>();

  for (const row of rows) {
    values.set(stripTags(row[1]).toLowerCase(), stripTags(row[2]));
  }

  const property = extractPropertyInfo(html);
  const contractorName = extractContractorName(html);

  return {
    permitNumber: values.get("permit number") ?? "",
    permitDate: values.get("permit date") ?? null,
    permitType: values.get("permit type") ?? "Permit",
    permitSubtype: values.get("permit sub-type") ?? null,
    applicantType: values.get("applicant type") ?? null,
    applicantName: values.get("applicant") ?? null,
    permitIssuedDate: values.get("permit issued date") ?? null,
    constructionValue: parseCurrency(values.get("construction value") ?? null),
    status: values.get("status") ?? "Needs Review",
    contractorName,
    parcelNumber: property.parcelNumber,
    address: property.address,
    city: property.city,
    state: property.state,
    zip: property.zip
  } satisfies TiffinPermitDetail;
}

export class TiffinPermitConnector implements SourceConnector {
  slug = "tiffin-permit-portal";
  displayName = "Tiffin Permit Portal";
  connectorType = "portal" as const;

  async fetch(context: ConnectorContext): Promise<FetchedRecord[]> {
    const firstPageHtml = await fetchTextWithTimeout(
      baseUrl,
      {
        headers: requestHeaders,
        cache: "no-store"
      },
      {
        signal: context.signal
      }
    );
    const pageUrls = extractTiffinPageUrls(firstPageHtml);
    const pageHtmls = await Promise.all(
      pageUrls.map(async (url, index) => ({
        sourceRecordId: `tiffin-permit-page-${index + 1}`,
        payload: {
          url,
          html:
            url === baseUrl
              ? firstPageHtml
              : await fetchTextWithTimeout(
                  url,
                  {
                    headers: requestHeaders,
                    cache: "no-store"
                  },
                  {
                    signal: context.signal
                  }
                )
        },
        fetchedAt: new Date().toISOString()
      }))
    );

    return pageHtmls;
  }

  async parse(records: FetchedRecord[], context: ConnectorContext): Promise<Record<string, unknown>[]> {
    const listingRows = records.flatMap((record) => extractTiffinPermitRows(String(record.payload.html ?? "")));
    const uniqueRows = Array.from(new Map(listingRows.map((row) => [row.detailUrl, row])).values()).slice(0, 30);
    const detailRows = await Promise.all(
      uniqueRows.map(async (row) => {
        const html = await fetchTextWithTimeout(
          row.detailUrl,
          {
            headers: requestHeaders,
            cache: "no-store"
          },
          {
            signal: context.signal
          }
        );
        return {
          ...row,
          detail: extractTiffinPermitDetail(html)
        };
      })
    );

    return detailRows;
  }

  async normalize(rows: Record<string, unknown>[], _context: ConnectorContext): Promise<NormalizedPermitInput[]> {
    return rows
      .map((rawRow) => {
        const row = rawRow as TiffinPermitRow & { detail: TiffinPermitDetail };
        const detail = row.detail;
        const builderName =
          detail.contractorName && !/^self$/i.test(detail.contractorName)
            ? detail.contractorName
            : detail.applicantType?.toLowerCase().includes("contractor")
              ? detail.applicantName
              : null;
        const ownerName = detail.applicantType?.toLowerCase().includes("owner") ? detail.applicantName : null;
        const classification = inferClassification([
          detail.permitType,
          detail.permitSubtype,
          builderName,
          ownerName
        ]);

        return {
          dedupeHash: buildDedupeHash([row.permitNumber, detail.parcelNumber, detail.address, row.detailUrl]),
          permitNumber: row.permitNumber,
          permitType: detail.permitType,
          permitSubtype: detail.permitSubtype,
          permitStatus: detail.status,
          applicationDate: parseDateToIso(detail.permitDate),
          issueDate: parseDateToIso(detail.permitIssuedDate ?? detail.permitDate),
          projectDescription: detail.permitSubtype,
          estimatedProjectValue: detail.constructionValue,
          landValue: null,
          improvementValue: detail.constructionValue,
          address: detail.address || row.address,
          city: detail.city || "Tiffin",
          county: "Johnson",
          state: detail.state || "IA",
          zip: detail.zip,
          parcelNumber: detail.parcelNumber,
          lotNumber: null,
          subdivision: null,
          builderName,
          contractorName: detail.contractorName,
          ownerName,
          developerName: null,
          sourceJurisdiction: "Tiffin",
          sourceUrl: row.detailUrl,
          classification,
          rawPayload: row
        } satisfies NormalizedPermitInput;
      })
      .filter((record) => Boolean(record.permitNumber && record.address));
  }

  async deduplicate(records: NormalizedPermitInput[], _context: ConnectorContext) {
    return Array.from(new Map(records.map((record) => [record.dedupeHash, record])).values());
  }

  calculateSourceReliability(records: NormalizedPermitInput[]) {
    if (!records.length) {
      return 55;
    }

    const withParcel = records.filter((record) => record.parcelNumber).length;
    const withValue = records.filter((record) => record.estimatedProjectValue != null).length;
    const withBuilder = records.filter((record) => record.builderName || record.contractorName).length;

    return Math.round(70 + (withParcel / records.length) * 12 + (withValue / records.length) * 8 + (withBuilder / records.length) * 6);
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
          message: `Fetched ${fetched.length} public Tiffin permit listing page(s) from the official portal.`
        },
        {
          level: deduped.length ? ("info" as const) : ("warning" as const),
          message: deduped.length
            ? `Normalized ${deduped.length} Tiffin permit records from the public iWorQ portal.`
            : "The official Tiffin permit portal responded, but no records normalized from the current listing pages."
        }
      ]
    };
  }
}
