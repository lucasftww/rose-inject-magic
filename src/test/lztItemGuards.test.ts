import { describe, expect, it } from "vitest";
import {
  hasLztBuyerAssigned,
  hasLztItemBuyerAssigned,
  isLztItemStateAwaiting,
  isLztItemStateSoldOrRemoved,
  normalizeLztItemState,
} from "@/lib/lztItemGuards";

describe("normalizeLztItemState", () => {
  it("lowercases and trims", () => {
    expect(normalizeLztItemState("  ACTIVE  ")).toBe("active");
  });
});

describe("isLztItemStateSoldOrRemoved", () => {
  it("flags terminal sale/removal states", () => {
    expect(isLztItemStateSoldOrRemoved("paid")).toBe(true);
    expect(isLztItemStateSoldOrRemoved("closed")).toBe(true);
    expect(isLztItemStateSoldOrRemoved("deleted")).toBe(true);
    expect(isLztItemStateSoldOrRemoved("stickied")).toBe(false);
    expect(isLztItemStateSoldOrRemoved("active")).toBe(false);
  });
});

describe("isLztItemStateAwaiting", () => {
  it("detects awaiting", () => {
    expect(isLztItemStateAwaiting("awaiting")).toBe(true);
    expect(isLztItemStateAwaiting("active")).toBe(false);
  });
});

describe("hasLztBuyerAssigned", () => {
  it("returns false for null and empty object", () => {
    expect(hasLztBuyerAssigned(null)).toBe(false);
    expect(hasLztBuyerAssigned(undefined)).toBe(false);
    expect(hasLztBuyerAssigned({})).toBe(false);
  });

  it("returns true when id or user_id is set", () => {
    expect(hasLztBuyerAssigned({ id: 1 })).toBe(true);
    expect(hasLztBuyerAssigned({ user_id: 99 })).toBe(true);
    expect(hasLztBuyerAssigned({ username: "x" })).toBe(true);
  });
});

describe("hasLztItemBuyerAssigned", () => {
  it("returns false when nested buyer is empty and no root signals", () => {
    expect(hasLztItemBuyerAssigned({ buyer: {}, item_state: "active" })).toBe(false);
  });

  it("detects buyer_username on item root", () => {
    expect(hasLztItemBuyerAssigned({ buyer_username: "someone" })).toBe(true);
  });

  it("detects buyer_user_id on item root", () => {
    expect(hasLztItemBuyerAssigned({ buyer_user_id: "42" })).toBe(true);
  });
});
