import { describe, expect, it } from "vitest";

import { groupBuilders, normalizeBuilderName } from "@/lib/entities/grouping";
import { builders } from "@/lib/sample-data";

describe("entity grouping", () => {
  it("normalizes builder aliases by removing legal suffix noise", () => {
    expect(normalizeBuilderName("ABC Homes LLC")).toBe("abc");
  });

  it("returns grouped builder summaries", () => {
    const grouped = groupBuilders(builders);

    expect(grouped[0].activeProperties).toBeGreaterThan(0);
    expect(grouped[0].permits).toBeGreaterThan(0);
    expect(grouped[0].openOpportunities).toBeGreaterThan(0);
  });
});
