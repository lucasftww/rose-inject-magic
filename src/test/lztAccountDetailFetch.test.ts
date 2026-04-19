import { describe, expect, it } from "vitest";
import { isLztDetailHttpError } from "@/lib/lztAccountDetailFetch";

describe("isLztDetailHttpError", () => {
  it("returns true for Error tagged with lztDetailHttpStatus 410", () => {
    const e = new Error("gone");
    (e as Error & { lztDetailHttpStatus: number }).lztDetailHttpStatus = 410;
    expect(isLztDetailHttpError(e, 410)).toBe(true);
    expect(isLztDetailHttpError(e, 404)).toBe(false);
  });

  it("returns false for plain Error", () => {
    expect(isLztDetailHttpError(new Error("x"), 410)).toBe(false);
  });

  it("returns false for non-errors", () => {
    expect(isLztDetailHttpError(null, 410)).toBe(false);
    expect(isLztDetailHttpError("x", 410)).toBe(false);
  });
});
