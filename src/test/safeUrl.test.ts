import { describe, expect, it } from "vitest";
import { safeAuthRedirect, safeHttpUrl } from "@/lib/safeUrl";

describe("safeAuthRedirect", () => {
  it("allows root and simple paths", () => {
    expect(safeAuthRedirect(null)).toBe("/");
    expect(safeAuthRedirect("")).toBe("/");
    expect(safeAuthRedirect("/")).toBe("/");
    expect(safeAuthRedirect("/raspadinha")).toBe("/raspadinha");
    expect(safeAuthRedirect("/checkout?x=1")).toBe("/checkout?x=1");
  });

  it("blocks external and protocol-relative redirects", () => {
    expect(safeAuthRedirect("https://evil.com")).toBe("/");
    expect(safeAuthRedirect("//evil.com")).toBe("/");
    expect(safeAuthRedirect("/\\evil.com")).toBe("/");
    expect(safeAuthRedirect("///path")).toBe("/");
  });

  it("blocks smuggling via encoding or newlines", () => {
    expect(safeAuthRedirect("/%2f%2fevil.com")).toBe("/");
    expect(safeAuthRedirect("/foo\n/bar")).toBe("/");
    expect(safeAuthRedirect("/foo\0bar")).toBe("/");
  });
});

describe("safeHttpUrl", () => {
  it("allows http and https without credentials", () => {
    expect(safeHttpUrl("https://example.com/path?q=1")).toBe("https://example.com/path?q=1");
    expect(safeHttpUrl("http://localhost:3000/x")).toBe("http://localhost:3000/x");
  });

  it("blocks dangerous schemes and whitespace", () => {
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("data:text/html,<script>")).toBeNull();
    expect(safeHttpUrl("file:///etc/passwd")).toBeNull();
    expect(safeHttpUrl("https://x.com y.com")).toBeNull();
  });

  it("blocks userinfo phishing", () => {
    expect(safeHttpUrl("https://user:pass@example.com/")).toBeNull();
  });
});
