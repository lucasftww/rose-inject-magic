import "https://deno.land/std@0.224.0/dotenv/load.ts";
import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/pix-payment`;

// ─── CORS ────────────────────────────────────────────────────────────────────
Deno.test("OPTIONS preflight returns CORS headers", async () => {
  const res = await fetch(FUNCTION_URL, { method: "OPTIONS" });
  await res.text(); // consume body
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
});

// ─── Auth guard ──────────────────────────────────────────────────────────────
Deno.test("GET without auth returns 401", async () => {
  const res = await fetch(`${FUNCTION_URL}?action=status&payment_id=fake`, {
    headers: { apikey: SUPABASE_ANON_KEY },
  });
  const body = await res.json();
  assertEquals(res.status, 401);
  assertExists(body.error);
});

Deno.test("POST without auth returns 401", async () => {
  const res = await fetch(`${FUNCTION_URL}?action=create`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ cart: [] }),
  });
  const body = await res.json();
  assertEquals(res.status, 401);
  assertExists(body.error);
});

// ─── Invalid / unsupported actions ───────────────────────────────────────────
Deno.test("POST with invalid Bearer token returns 401", async () => {
  const res = await fetch(`${FUNCTION_URL}?action=create`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: "Bearer invalid.jwt.token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ cart: [] }),
  });
  const body = await res.json();
  assertEquals(res.status, 401);
  assertExists(body.error);
});

// ─── Card / Crypto not supported ─────────────────────────────────────────────
// These require auth so they'll return 401 without a valid token.
// We verify the function responds (no crash) — the 401 proves the pipeline works.
Deno.test("create-card without auth returns 401 (not 500)", async () => {
  const res = await fetch(`${FUNCTION_URL}?action=create-card`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  const body = await res.json();
  assertEquals(res.status, 401);
  assertExists(body.error);
});

Deno.test("crypto-status without auth returns 401 (not 500)", async () => {
  const res = await fetch(`${FUNCTION_URL}?action=crypto-status`, {
    headers: { apikey: SUPABASE_ANON_KEY },
  });
  const body = await res.json();
  assertEquals(res.status, 401);
  assertExists(body.error);
});

// ─── Webhook endpoint ────────────────────────────────────────────────────────
Deno.test("Webhook without valid signature returns 401 or 400", async () => {
  const res = await fetch(`${FUNCTION_URL}?action=webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      transactionId: "fake-tx-123",
      transactionState: "COMPLETED",
    }),
  });
  const body = await res.json();
  // Webhook should reject unsigned/invalid requests (401, 400, or 403)
  const validRejection = [400, 401, 403].includes(res.status);
  assertEquals(validRejection, true, `Expected 400/401/403 but got ${res.status}: ${JSON.stringify(body)}`);
});

// ─── Missing action param ────────────────────────────────────────────────────
Deno.test("Request without action param returns error (not 500 crash)", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  const body = await res.json();
  // Should be 401 (no auth) — but definitely not 500
  const notCrash = res.status < 500;
  assertEquals(notCrash, true, `Server error ${res.status}: ${JSON.stringify(body)}`);
});

// ─── IP rate-limit headers ───────────────────────────────────────────────────
Deno.test("Response always includes Content-Type JSON", async () => {
  const res = await fetch(`${FUNCTION_URL}?action=status`, {
    headers: { apikey: SUPABASE_ANON_KEY },
  });
  await res.json(); // consume
  const ct = res.headers.get("content-type") || "";
  assertEquals(ct.includes("application/json"), true);
});

// ─── Force-complete without admin ────────────────────────────────────────────
Deno.test("force-complete without auth returns 401", async () => {
  const res = await fetch(`${FUNCTION_URL}?action=force-complete`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ payment_id: "fake-id" }),
  });
  const body = await res.json();
  assertEquals(res.status, 401);
  assertExists(body.error);
});

// ─── Retry-robot without admin ───────────────────────────────────────────────
Deno.test("retry-robot without auth returns 401", async () => {
  const res = await fetch(`${FUNCTION_URL}?action=retry-robot`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ticket_id: "fake-id" }),
  });
  const body = await res.json();
  assertEquals(res.status, 401);
  assertExists(body.error);
});
