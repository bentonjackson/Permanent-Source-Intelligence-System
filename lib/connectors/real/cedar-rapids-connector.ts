import { read, utils } from "xlsx";

import {
  ConnectorContext,
  FetchedRecord,
  NormalizedPermitInput,
  SourceConnector
} from "@/lib/connectors/shared/types";
import {
  fetchBufferWithTimeout,
  fetchTextWithTimeout
} from "@/lib/connectors/shared/http";
import {
  buildDedupeHash,
  inferClassification,
  normalizeWhitespace,
  parseCurrency,
  parseDateToIso,
  rowFromAliasMap
} from "@/lib/connectors/shared/normalization";

const reportIndexUrl =
  "https://www.cedar-rapids.org/local_government/departments_a_-_f/building_services/building_and_trades/permit_reports.php";

const requestHeaders = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
};

function resolveCedarRapidsUrl(path: string) {
  return new URL(path, "https://www.cedar-rapids.org/local_government/departments_a_-_f/building_services/building_and_trades/").toString();
}

export function extractCedarRapidsWorkbookLinks(html: string) {
  const matches = Array.from(
    html.matchAll(/href="([^"]+?\.xls(?:x)?\?t=\d+)"/gi)
  );

  return matches
    .map((match) => resolveCedarRapidsUrl(match[1]))
    .filter((value, index, array) => array.indexOf(value) === index)
    .slice(0, 2);
}

export function sheetRowsToObjects(buffer: Buffer) {
  const workbook = read(buffer, { type: "buffer", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = utils.sheet_to_json<Array<string | number | Date | null>>(sheet, {
    header: 1,
    defval: null,
    raw: false
  });

  const headerIndex = rows.findIndex((row) => {
    const joined = row.map((cell) => normalizeWhitespace(cell == null ? "" : String(cell)).toLowerCase()).join(" | ");
    return joined.includes("permit") && (joined.includes("status") || joined.includes("address"));
  });

  if (headerIndex === -1) {
    return [];
  }

  const headers = rows[headerIndex].map((cell) => normalizeWhitespace(cell == null ? "" : String(cell)));

  return rows
    .slice(headerIndex + 1)
    .filter((row) => row.some((cell) => normalizeWhitespace(cell == null ? "" : String(cell))))
    .map((row) =>
      Object.fromEntries(headers.map((header, index) => [header || `column_${index + 1}`, row[index] ?? null]))
    );
}

export class CedarRapidsRealConnector implements SourceConnector {
  slug = "cedar-rapids-monthly-reports";
  displayName = "Cedar Rapids Monthly Permit Reports";
  connectorType = "document" as const;

  async fetch(context: ConnectorContext): Promise<FetchedRecord[]> {
    const html = await fetchTextWithTimeout(
      reportIndexUrl,
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
        sourceRecordId: "cedar-rapids-report-index",
        payload: {
          url: reportIndexUrl,
          html
        },
        fetchedAt: new Date().toISOString()
      }
    ];
  }

  async parse(records: FetchedRecord[], context: ConnectorContext): Promise<Record<string, unknown>[]> {
    const html = String(records[0]?.payload.html ?? "");
    const workbookLinks = extractCedarRapidsWorkbookLinks(html);
    const rows: Record<string, unknown>[] = [];

    for (const workbookUrl of workbookLinks) {
      try {
        const buffer = await fetchBufferWithTimeout(
          workbookUrl,
          {
            headers: {
              ...requestHeaders,
              referer: reportIndexUrl
            },
            cache: "no-store"
          },
          {
            signal: context.signal,
            timeoutMs: 20000
          }
        );
        const workbookRows = sheetRowsToObjects(buffer);

        for (const row of workbookRows) {
          rows.push({
            ...row,
            __workbookUrl: workbookUrl
          });
        }
      } catch {
        // Keep the run alive even if one monthly workbook fails.
      }
    }

    return rows;
  }

  async normalize(rows: Record<string, unknown>[], _context: ConnectorContext): Promise<NormalizedPermitInput[]> {
    const normalized: NormalizedPermitInput[] = [];

    for (const row of rows) {
        const permitNumber =
          rowFromAliasMap(row, ["Permit Number", "Permit No", "Permit #"]) ??
          rowFromAliasMap(row, ["Number", "Permit"]);
        const address = rowFromAliasMap(row, ["Address", "Property Address", "Project Address"]);
        const permitType = rowFromAliasMap(row, ["Permit Type", "Type", "Permit"]) ?? "Unknown Permit";
        const permitSubtype = rowFromAliasMap(row, ["Permit Subtype", "Subtype", "Description"]);
        const permitStatus = rowFromAliasMap(row, ["Status", "Permit Status"]) ?? "Needs Review";
        const applicationDate = rowFromAliasMap(row, ["Application Date", "Applied", "Date Applied"]);
        const issueDate = rowFromAliasMap(row, ["Issue Date", "Issued", "Date Issued"]);
        const description = rowFromAliasMap(row, ["Description", "Project Description", "Work Description"]);
        const parcelNumber = rowFromAliasMap(row, ["Parcel", "Parcel Number", "Parcel #"]);
        const lotNumber = rowFromAliasMap(row, ["Lot", "Lot Number"]);
        const subdivision = rowFromAliasMap(row, ["Subdivision", "Addition"]);
        const builderName =
          rowFromAliasMap(row, ["Builder", "Builder Name", "Contractor", "General Contractor"]) ??
          rowFromAliasMap(row, ["Applicant", "Owner"]);
        const ownerName = rowFromAliasMap(row, ["Owner", "Owner Name"]);
        const valuation = parseCurrency(rowFromAliasMap(row, ["Valuation", "Project Value", "Permit Value"]));
        const landValue = parseCurrency(rowFromAliasMap(row, ["Land Value"]));
        const improvementValue = parseCurrency(rowFromAliasMap(row, ["Improvement Value"]));

        if (!permitNumber || !address) {
          continue;
        }

        const classification = inferClassification([
          permitType == null ? null : String(permitType),
          permitSubtype == null ? null : String(permitSubtype),
          description == null ? null : String(description)
        ]);

        normalized.push({
          dedupeHash: buildDedupeHash([
            String(permitNumber),
            String(address),
            applicationDate ? String(applicationDate) : null,
            builderName ? String(builderName) : null
          ]),
          permitNumber: String(permitNumber),
          permitType: String(permitType),
          permitSubtype: permitSubtype ? String(permitSubtype) : null,
          permitStatus: String(permitStatus),
          applicationDate: parseDateToIso(applicationDate),
          issueDate: parseDateToIso(issueDate),
          projectDescription: description ? String(description) : null,
          estimatedProjectValue: valuation,
          landValue,
          improvementValue,
          address: String(address),
          city: String(rowFromAliasMap(row, ["City"]) ?? "Cedar Rapids"),
          county: String(rowFromAliasMap(row, ["County"]) ?? "Linn"),
          state: "IA",
          zip: rowFromAliasMap(row, ["Zip", "Zip Code"]) ? String(rowFromAliasMap(row, ["Zip", "Zip Code"])) : null,
          parcelNumber: parcelNumber ? String(parcelNumber) : null,
          lotNumber: lotNumber ? String(lotNumber) : null,
          subdivision: subdivision ? String(subdivision) : null,
          builderName: builderName ? String(builderName) : null,
          contractorName: builderName ? String(builderName) : null,
          ownerName: ownerName ? String(ownerName) : null,
          developerName: null,
          sourceJurisdiction: "Cedar Rapids",
          sourceUrl: String(row.__workbookUrl ?? reportIndexUrl),
          classification,
          rawPayload: row
        });
    }

    return normalized;
  }

  async deduplicate(records: NormalizedPermitInput[], _context: ConnectorContext) {
    return Array.from(new Map(records.map((record) => [record.dedupeHash, record])).values());
  }

  calculateSourceReliability(records: NormalizedPermitInput[]) {
    if (!records.length) {
      return 45;
    }

    const withBuilder = records.filter((record) => record.builderName).length;
    const withValue = records.filter((record) => record.estimatedProjectValue != null).length;
    return Math.round(68 + (withBuilder / records.length) * 14 + (withValue / records.length) * 12);
  }

  async run(context: ConnectorContext) {
    const fetched = await this.fetch(context);
    const parsed = await this.parse(fetched, context);
    const normalized = await this.normalize(parsed, context);
    const deduped = await this.deduplicate(normalized, context);
    const workbookLinks = extractCedarRapidsWorkbookLinks(String(fetched[0]?.payload.html ?? ""));

    return {
      fetched,
      normalized: deduped,
      reliabilityScore: this.calculateSourceReliability(deduped),
      logs: [
        {
          level: "info" as const,
          message: `Discovered ${workbookLinks.length} official Cedar Rapids monthly workbook links.`
        },
        {
          level: deduped.length ? ("info" as const) : ("warning" as const),
          message: deduped.length
            ? `Normalized ${deduped.length} Cedar Rapids permit records from live monthly reports.`
            : "Live Cedar Rapids workbook discovery worked, but no rows normalized from the downloaded reports."
        }
      ]
    };
  }
}
