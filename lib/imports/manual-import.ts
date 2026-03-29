import { read, utils } from "xlsx";

import { NormalizedPermitInput } from "@/lib/connectors/shared/types";

export interface ManualImportResult {
  rows: Record<string, unknown>[];
  normalized: NormalizedPermitInput[];
}

export function parseWorkbook(buffer: Buffer): ManualImportResult {
  const workbook = read(buffer, { type: "buffer" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: null });

  const normalized = rows.map((row, index) => ({
    dedupeHash: `manual:${row["Permit Number"] ?? index}`,
    permitNumber: String(row["Permit Number"] ?? `manual-${index}`),
    permitType: String(row["Permit Type"] ?? "Unknown"),
    permitSubtype: row["Subtype"] ? String(row["Subtype"]) : null,
    permitStatus: String(row["Status"] ?? "Needs Review"),
    applicationDate: row["Application Date"] ? new Date(String(row["Application Date"])).toISOString() : null,
    issueDate: row["Issue Date"] ? new Date(String(row["Issue Date"])).toISOString() : null,
    projectDescription: row["Description"] ? String(row["Description"]) : null,
    estimatedProjectValue: row["Estimated Value"] ? Number(row["Estimated Value"]) : null,
    landValue: row["Land Value"] ? Number(row["Land Value"]) : null,
    improvementValue: row["Improvement Value"] ? Number(row["Improvement Value"]) : null,
    address: String(row["Address"] ?? ""),
    city: String(row["City"] ?? ""),
    county: String(row["County"] ?? ""),
    state: "IA",
    zip: row["Zip"] ? String(row["Zip"]) : null,
    parcelNumber: row["Parcel"] ? String(row["Parcel"]) : null,
    lotNumber: row["Lot"] ? String(row["Lot"]) : null,
    subdivision: row["Subdivision"] ? String(row["Subdivision"]) : null,
    builderName: row["Builder"] ? String(row["Builder"]) : null,
    contractorName: row["Contractor"] ? String(row["Contractor"]) : null,
    ownerName: row["Owner"] ? String(row["Owner"]) : null,
    developerName: row["Developer"] ? String(row["Developer"]) : null,
    sourceJurisdiction: String(row["Jurisdiction"] ?? row["City"] ?? "Manual Import"),
    sourceUrl: "manual://import",
    classification:
      String(row["Permit Type"] ?? "").toLowerCase().includes("single")
        ? "single_family_home"
        : "unknown_needs_review",
    rawPayload: row
  }));

  return { rows, normalized };
}
