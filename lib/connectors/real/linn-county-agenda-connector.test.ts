import { describe, expect, it } from "vitest";

import { extractLinnCountyAgendaCases } from "@/lib/connectors/real/linn-county-agenda-connector";

describe("Linn County agenda connector parsing", () => {
  it("extracts case rows from the current county agenda pdf text", () => {
    const text = `
      LINN COUNTY TECHNICAL REVIEW COMMITTEE
      MEETING AGENDA
      Thursday, April 2, 2026
      New Business
      PF26-0005. Present case and discuss conditions for McGraw Farm First Addition, located at
      4333 Ring Road, Walker, Iowa. Terrence & Allison McGraw, owners, Brain Engineering, Inc,
      surveyor, Brad Wylam, staff.
      PR26-0003. Present case and discuss conditions for rezoning a 68.45 acre property located in
      the 6800 & 6900 block of Tower Terrace Road, Cedar Rapids, Iowa, from Agricultural (AG) to
      Rural Residential 2-Acre (RR2). B&K Companies, LLC, owner, Hall & Hall Engineers Inc, surveyor,
      Mike Tertinger, staff.
      Other Business
    `;

    const rows = extractLinnCountyAgendaCases(text);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      caseNumber: "PF26-0005",
      committee: "TECHNICAL REVIEW COMMITTEE",
      agendaDate: "Thursday, April 2, 2026",
      caseType: "Final Plat",
      projectName: "McGraw Farm First Addition",
      address: "4333 Ring Road, Walker, Iowa",
      ownerName: "Terrence & Allison McGraw"
    });
    expect(rows[1]).toMatchObject({
      caseNumber: "PR26-0003",
      caseType: "Rezoning",
      address: "the 6800 & 6900 block of Tower Terrace Road, Cedar Rapids, Iowa"
    });
  });
});
