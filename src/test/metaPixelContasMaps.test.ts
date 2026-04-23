import { describe, it, expect } from "vitest";
import type { GameTab } from "@/lib/contasMarketTypes";
import {
  IC_CATEGORY_CONTENT_NAME_BY_TAB,
  IC_CATEGORY_EVENT_BY_TAB,
} from "@/lib/metaPixel";

describe("metaPixel — mapas IC da secção Contas vs GameTab", () => {
  it("cada GameTab tem IC_* e content_name; mapas com as mesmas chaves (Record<> = compile-time)", () => {
    /** Se `GameTab` crescer sem atualizar os mapas no Pixel, isto falha no `tsc`. */
    const events: Record<GameTab, string> = IC_CATEGORY_EVENT_BY_TAB;
    const names: Record<GameTab, string> = IC_CATEGORY_CONTENT_NAME_BY_TAB;

    const eventKeys = Object.keys(events) as GameTab[];
    const nameKeys = Object.keys(names) as GameTab[];

    expect(eventKeys.length).toBe(8);
    expect(new Set(eventKeys).size).toBe(8);
    expect([...eventKeys].sort()).toEqual([...nameKeys].sort());

    for (const tab of eventKeys) {
      expect(events[tab]).toMatch(/^IC_CATEGORY_[A-Z0-9_]+$/);
      expect(names[tab]).toMatch(/^Contas .+/);
      expect(names[tab].length).toBeGreaterThan(8);
    }
  });
});
