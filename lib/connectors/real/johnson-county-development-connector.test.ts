import { describe, expect, it } from "vitest";

import { extractJohnsonCountyApplicationRows } from "@/lib/connectors/real/johnson-county-development-connector";

describe("Johnson County development connector parsing", () => {
  it("extracts county application rows with section status and owners", () => {
    const html = `
      <div property="schema:text" class="field__item">
        <h3><strong>Planning &amp; Zoning Commission</strong></h3>
        <p><strong>Applications Currently on File</strong></p>
        <p>
          <a href="https://johnsoncountyiowa.gov/sites/default/files/2026-03/SD26-000004.pdf">
            <u>SD26-000004 Swartzentruber Acres on James Ave SW (Swartzentruber)(Filed 03.04.26)</u>
          </a>
        </p>
        <p><strong>Deferred Applications/Items:</strong></p>
        <p>
          <a href="https://johnsoncountyiowa.gov/sites/default/files/2026-03/REZ26-000002.pdf">
            <u>REZ26-000002 Rohret Rezone on Cosgrove RD SW (Rohret)(Filed 03.03.26)</u>
          </a>
        </p>
      </div>
      <h1 class="title">&nbsp;</h1>
    `;

    const rows = extractJohnsonCountyApplicationRows(html);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      caseNumber: "SD26-000004",
      caseType: "Subdivision",
      board: "Planning & Zoning Commission",
      statusBucket: "on_file",
      projectName: "Swartzentruber Acres",
      address: "James Ave SW",
      ownerName: "Swartzentruber",
      filedDate: "03.04.26"
    });
    expect(rows[1].statusBucket).toBe("deferred");
    expect(rows[1].detailUrl).toContain("REZ26-000002.pdf");
  });
});
