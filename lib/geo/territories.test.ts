import { describe, expect, it } from "vitest";

import {
  COUNTIES_NEAR_ME_LABEL,
  cedarRapids75MileCounties,
  corridorBoostForCounty,
  getCountySelectorOptions,
  isSeventyFiveMileCounty
} from "@/lib/geo/territories";

describe("75-mile county coverage", () => {
  it("includes the seeded Cedar Rapids-centered county set", () => {
    expect(cedarRapids75MileCounties).toContain("Linn");
    expect(cedarRapids75MileCounties).toContain("Johnson");
    expect(cedarRapids75MileCounties).toContain("Black Hawk");
    expect(cedarRapids75MileCounties).toContain("Washington");
  });

  it("builds selector options with the all-counties default first", () => {
    const options = getCountySelectorOptions();

    expect(options[0]).toBe(COUNTIES_NEAR_ME_LABEL);
    expect(options).toContain("Benton");
  });

  it("scores in-radius counties higher than outside counties", () => {
    expect(isSeventyFiveMileCounty("Jones")).toBe(true);
    expect(corridorBoostForCounty("Jones")).toBeGreaterThan(0);
    expect(corridorBoostForCounty("Scott")).toBeLessThan(0);
  });
});
