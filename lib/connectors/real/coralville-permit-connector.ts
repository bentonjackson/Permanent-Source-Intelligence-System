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

const searchUrl = "https://permitportal.coralville.org/Search";

const requestHeaders = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
};

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

export interface CoralvilleSearchRow {
  permitNumber: string;
  status: string;
  permitType: string;
  address: string;
  appliedDate: string | null;
  issuedDate: string | null;
  expiresDate: string | null;
  detailUrl: string;
}

export interface CoralvillePermitDetail {
  permitNumber: string | null;
  status: string | null;
  permitType: string | null;
  applicationDate: string | null;
  issueDate: string | null;
  address: string | null;
  parcelNumber: string | null;
  ownerName: string | null;
  ownerAddress: string | null;
  ownerCityStateZip: string | null;
  applicantName: string | null;
  projectDescription: string | null;
  buildingType: string | null;
  buildingCategory: string | null;
  valuation: string | null;
  contractorName: string | null;
  contractorFunction: string | null;
}

export function extractCoralvilleSearchRows(html: string) {
  const tableMatch = html.match(/<table[^>]+id="MainContent_gvResults"[\s\S]*?<\/table>/i);
  if (!tableMatch) {
    return [];
  }

  const rows = Array.from(tableMatch[0].matchAll(/<tr[\s\S]*?<\/tr>/gi));

  return rows
    .map((match) => {
      const rowHtml = match[0];
      const detailHref = rowHtml.match(/href="([^"]*Permits\/Permit[^"]*)"/i)?.[1];
      const cells = Array.from(rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)).map((cell) => stripTags(cell[1]));

      if (!detailHref || cells.length < 7) {
        return null;
      }

      return {
        detailUrl: new URL(detailHref, "https://permitportal.coralville.org/").toString(),
        permitNumber: stripTags(rowHtml.match(/<a[^>]*>([^<]+)<\/a>/i)?.[1] ?? ""),
        status: cells[1] ?? "",
        permitType: cells[2] ?? "",
        address: cells[3] ?? "",
        appliedDate: cells[4] || null,
        issuedDate: cells[5] || null,
        expiresDate: cells[6] || null
      } satisfies CoralvilleSearchRow;
    })
    .filter((row): row is CoralvilleSearchRow => Boolean(row));
}

function extractSpanById(html: string, id: string) {
  const match = html.match(new RegExp(`id="${id}"[^>]*>([\\s\\S]*?)<\\/span>`, "i"));
  return match ? stripTags(match[1]) || null : null;
}

export function extractCoralvillePermitDetail(html: string): CoralvillePermitDetail {
  const contractorTable = html.match(/<table[^>]+id="MainContent_gvContractors"[\s\S]*?<\/table>/i)?.[0] ?? "";
  const contractorRows = Array.from(contractorTable.matchAll(/<tr>\s*<td>\s*([\s\S]*?)<\/td><td>\s*([\s\S]*?)<\/td>\s*<\/tr>/gi))
    .map((match) => ({
      name: stripTags(match[1]),
      role: stripTags(match[2])
    }))
    .filter((entry) => entry.name && entry.name.toLowerCase() !== "name");
  const generalContractor = contractorRows.find((entry) => /general/i.test(entry.role)) ?? contractorRows[0];

  const propertyBlock = html.match(/<h6><span id="MainContent_lblPropertyLabel">PROPERTY<\/span><\/h6>[\s\S]*?<h6 class="mb-0">([\s\S]*?)<\/h6>[\s\S]*?<div class="row">\s*<div class="col-12">\s*([^<]+)\s*<\/div>\s*<\/div>/i);

  return {
    permitNumber: extractSpanById(html, "MainContent_lblPermitNumber"),
    status: extractSpanById(html, "MainContent_lblStatus"),
    permitType: extractSpanById(html, "MainContent_lblPermitType"),
    applicationDate: extractSpanById(html, "MainContent_lblApplicationDate"),
    issueDate: extractSpanById(html, "MainContent_lblIssueDate"),
    address: propertyBlock ? stripTags(propertyBlock[1]) : null,
    parcelNumber: propertyBlock ? stripTags(propertyBlock[2]) : null,
    ownerName: extractSpanById(html, "MainContent_lblOwnerName"),
    ownerAddress: extractSpanById(html, "MainContent_lblOwnerAddress1"),
    ownerCityStateZip: extractSpanById(html, "MainContent_lblOwnerCityStateZip"),
    applicantName: extractSpanById(html, "MainContent_lblApplicantName"),
    projectDescription: extractSpanById(html, "MainContent_lblWorkDescription"),
    buildingType: extractSpanById(html, "MainContent_lblBuildingType"),
    buildingCategory: extractSpanById(html, "MainContent_lblBuildingCategory"),
    valuation: extractSpanById(html, "MainContent_lblValuation"),
    contractorName: generalContractor?.name ?? null,
    contractorFunction: generalContractor?.role ?? null
  };
}

export class CoralvillePermitConnector implements SourceConnector {
  slug = "coralville-permit-portal";
  displayName = "Johnson County Area / Coralville Permit Portal";
  connectorType = "portal" as const;

  async fetch(context: ConnectorContext): Promise<FetchedRecord[]> {
    const html = await fetchTextWithTimeout(
      searchUrl,
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
        sourceRecordId: "coralville-search",
        payload: {
          url: searchUrl,
          html
        },
        fetchedAt: new Date().toISOString()
      }
    ];
  }

  async parse(records: FetchedRecord[], context: ConnectorContext): Promise<Record<string, unknown>[]> {
    const html = String(records[0]?.payload.html ?? "");
    const searchRows = extractCoralvilleSearchRows(html)
      .filter((row) => row.permitType.toLowerCase().includes("building"))
      .slice(0, 12);

    const detailedRows = await Promise.all(
      searchRows.map(async (row) => {
        try {
          const detailHtml = await fetchTextWithTimeout(
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
            detailUrl: row.detailUrl,
            detail: extractCoralvillePermitDetail(detailHtml)
          };
        } catch {
          return {
            ...row,
            detailUrl: row.detailUrl,
            detail: null
          };
        }
      })
    );

    return detailedRows;
  }

  async normalize(rows: Record<string, unknown>[], _context: ConnectorContext): Promise<NormalizedPermitInput[]> {
    const normalized: NormalizedPermitInput[] = [];

    for (const row of rows) {
        const detail = (row.detail as CoralvillePermitDetail | null) ?? null;
        const permitNumber = normalizeWhitespace(detail?.permitNumber ?? String(row.permitNumber ?? ""));
        const address = normalizeWhitespace(detail?.address ?? String(row.address ?? ""));
        const permitType = normalizeWhitespace(detail?.permitType ?? String(row.permitType ?? "Building"));
        const permitStatus = normalizeWhitespace(detail?.status ?? String(row.status ?? "Application"));
        const buildingType = detail?.buildingType;
        const buildingCategory = detail?.buildingCategory;
        const projectDescription = detail?.projectDescription;
        const builderName = detail?.contractorName ?? detail?.applicantName ?? detail?.ownerName ?? null;
        const ownerName = detail?.ownerName ?? null;

        if (!permitNumber || !address) {
          continue;
        }

        const classification = inferClassification([
          permitType,
          buildingType,
          buildingCategory,
          projectDescription
        ]);

        normalized.push({
          dedupeHash: buildDedupeHash([
            permitNumber,
            address,
            row.appliedDate ? String(row.appliedDate) : null,
            builderName
          ]),
          permitNumber,
          permitType,
          permitSubtype: buildingType ?? buildingCategory ?? null,
          permitStatus,
          applicationDate: parseDateToIso(detail?.applicationDate ?? row.appliedDate),
          issueDate: parseDateToIso(detail?.issueDate ?? row.issuedDate),
          projectDescription: projectDescription ?? null,
          estimatedProjectValue: parseCurrency(detail?.valuation),
          landValue: null,
          improvementValue: null,
          address,
          city: "Coralville",
          county: "Johnson",
          state: "IA",
          zip: detail?.ownerCityStateZip?.match(/(\d{5})$/)?.[1] ?? null,
          parcelNumber: detail?.parcelNumber ?? null,
          lotNumber: null,
          subdivision: null,
          builderName,
          contractorName: detail?.contractorName ?? null,
          ownerName,
          developerName: null,
          sourceJurisdiction: "Coralville",
          sourceUrl: String(row.detailUrl ?? searchUrl),
          classification,
          rawPayload: {
            searchRow: row,
            detail
          }
        });
    }

    return normalized;
  }

  async deduplicate(records: NormalizedPermitInput[], _context: ConnectorContext) {
    return Array.from(new Map(records.map((record) => [record.dedupeHash, record])).values());
  }

  calculateSourceReliability(records: NormalizedPermitInput[]) {
    if (!records.length) {
      return 52;
    }

    const withBuilder = records.filter((record) => record.builderName).length;
    const withParcel = records.filter((record) => record.parcelNumber).length;
    return Math.round(70 + (withBuilder / records.length) * 16 + (withParcel / records.length) * 8);
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
          message: `Fetched Coralville public search and parsed ${parsed.length} official building permit rows.`
        },
        {
          level: "info" as const,
          message: `Normalized ${deduped.length} Johnson County-area permit records from the Coralville portal.`
        }
      ]
    };
  }
}
