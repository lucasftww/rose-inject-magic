import { describe, expect, it } from "vitest";
import { lztMarketListQuerySignature } from "@/lib/contasMarketFetch";

describe("lztMarketListQuerySignature", () => {
  it("matches regardless of object key insertion order", () => {
    const a = { page: "1", order_by: "pdate_to_down", game_type: "lol" };
    const b = { game_type: "lol", page: "1", order_by: "pdate_to_down" };
    expect(lztMarketListQuerySignature(a)).toBe(lztMarketListQuerySignature(b));
  });

  it("serializes array params with append semantics", () => {
    const p = { page: "1", "lol_region[]": ["BR1", "EUW1"] };
    expect(lztMarketListQuerySignature(p)).toContain("lol_region%5B%5D=BR1");
    expect(lztMarketListQuerySignature(p)).toContain("lol_region%5B%5D=EUW1");
  });
});
