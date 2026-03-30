import { describe, expect, it } from "vitest";

import {
  extractCoralvillePermitDetail,
  extractCoralvilleSearchRows
} from "@/lib/connectors/real/coralville-permit-connector";

describe("Coralville permit connector parsing", () => {
  it("extracts public search results from the official permit portal markup", () => {
    const html = `
      <table id="MainContent_gvResults">
        <tr>
          <th>Permit #</th>
        </tr>
        <tr>
          <td class="font-weight-bold">
            <a class="toolLink text-default" target="_blank" href="Permits/Permit?id=19726&ps=1">26-3646</a>
          </td>
          <td><span class="badge badge-success">Active</span></td>
          <td>Building</td>
          <td><span>2901 BROKEN WOODS DR</span></td>
          <td>3/24/2026</td>
          <td>3/27/2026</td>
          <td></td>
        </tr>
      </table>
    `;

    const rows = extractCoralvilleSearchRows(html);

    expect(rows).toHaveLength(1);
    expect(rows[0].permitNumber).toBe("26-3646");
    expect(rows[0].detailUrl).toContain("Permits/Permit?id=19726&ps=1");
    expect(rows[0].address).toBe("2901 BROKEN WOODS DR");
  });

  it("extracts builder-relevant detail fields from an official permit detail page", () => {
    const html = `
      <span id="MainContent_lblStatus">ISSUED</span>
      <span id="MainContent_lblPermitNumber">26-3646</span>
      <span id="MainContent_lblPermitType">BUILDING</span>
      <span id="MainContent_lblApplicationDate">3/24/2026</span>
      <span id="MainContent_lblIssueDate">3/27/2026</span>
      <h6><span id="MainContent_lblPropertyLabel">PROPERTY</span></h6>
      <h6 class="mb-0">2901 BROKEN WOODS DR</h6>
      <div class="row"><div class="col-12">0730216011</div></div>
      <span id="MainContent_lblOwnerName">THOMPSON, ANDREW</span>
      <span id="MainContent_lblWorkDescription">New single-family home with finished lower level.</span>
      <span id="MainContent_lblBuildingType">Single Family Dwelling</span>
      <span id="MainContent_lblBuildingCategory">New</span>
      <span id="MainContent_lblValuation">$455,000.00</span>
      <table id="MainContent_gvContractors">
        <tr><th>NAME</th><th>FUNCTION</th></tr>
        <tr><td>Elevation Home Builders</td><td>General</td></tr>
      </table>
    `;

    const detail = extractCoralvillePermitDetail(html);

    expect(detail.permitNumber).toBe("26-3646");
    expect(detail.address).toBe("2901 BROKEN WOODS DR");
    expect(detail.parcelNumber).toBe("0730216011");
    expect(detail.contractorName).toBe("Elevation Home Builders");
    expect(detail.buildingType).toBe("Single Family Dwelling");
    expect(detail.valuation).toBe("$455,000.00");
  });
});

