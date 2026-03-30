import { describe, expect, it } from "vitest";

import {
  extractTiffinPageUrls,
  extractTiffinPermitDetail,
  extractTiffinPermitRows
} from "@/lib/connectors/real/tiffin-permit-connector";

describe("Tiffin permit connector parsing", () => {
  it("extracts public permit rows and pagination links from the listing page", () => {
    const html = `
      <ul class="pagination">
        <li class="page-item"><a class="page-link" href="https://portal.iworq.net/TIFFIN/permits/600?page=2">2</a></li>
      </ul>
      <table class="table table-sm">
        <tbody>
          <tr>
            <th scope="row" class="permit-open" data-route="https://portal.iworq.net/TIFFIN/permit/600/28520690">
              <a href="https://portal.iworq.net/TIFFIN/permit/600/28520690">4993</a>
            </th>
            <td class="permit-open" data-label="Date">03/26/2026</td>
            <td class="permit-open" data-label="Parcel Address">527 Tulip Ct</td>
            <td><a href="https://portal.iworq.net/TIFFIN/permit/600/28520690">View</a></td>
          </tr>
        </tbody>
      </table>
    `;

    expect(extractTiffinPageUrls(html)).toContain("https://portal.iworq.net/TIFFIN/permits/600?page=2");

    const rows = extractTiffinPermitRows(html);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      permitNumber: "4993",
      permitDate: "03/26/2026",
      address: "527 Tulip Ct",
      externalId: "28520690"
    });
  });

  it("extracts builder-relevant detail fields from the permit page", () => {
    const html = `
      <h2>Permit Information</h2>
      <div class="row"><div class="col">Permit Number:</div><div class="col">4993</div></div>
      <div class="row"><div class="col">Permit Date:</div><div class="col">03/26/2026</div></div>
      <div class="row"><div class="col">Permit Type:</div><div class="col">Building</div></div>
      <div class="row"><div class="col">Permit Sub-Type:</div><div class="col">Single Family Dwelling</div></div>
      <div class="row"><div class="col">Applicant Type:</div><div class="col">Contractor</div></div>
      <div class="row"><div class="col">Applicant:</div><div class="col">Acorn Builders LLC</div></div>
      <div class="row"><div class="col">Permit Issued Date:</div><div class="col">03/28/2026</div></div>
      <div class="row"><div class="col">Construction Value:</div><div class="col">455000</div></div>
      <div class="row"><div class="col">Status:</div><div class="col">Issued</div></div>
      <h2>Contractors</h2>
      <div class="contractor primary"><div>Acorn Builders LLC - <strong>General</strong></div></div>
      <h2>Property Information</h2>
      <div class="property-info">
        <div>Parcel #: 0628179027</div>
        <div>527 Tulip Ct</div>
        <div>Tiffin, IA 52340</div>
      </div>
    `;

    expect(extractTiffinPermitDetail(html)).toMatchObject({
      permitNumber: "4993",
      permitType: "Building",
      permitSubtype: "Single Family Dwelling",
      applicantName: "Acorn Builders LLC",
      contractorName: "Acorn Builders LLC",
      parcelNumber: "0628179027",
      address: "527 Tulip Ct",
      city: "Tiffin",
      state: "IA",
      zip: "52340",
      constructionValue: 455000,
      status: "Issued"
    });
  });
});
