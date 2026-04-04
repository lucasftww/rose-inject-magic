import { isRecord } from "@/types/ticketChat";

/** `{ data: [...] }` típico de APIs REST (Valorant, etc.). */
export function getJsonDataArray(body: unknown): unknown[] {
  if (!isRecord(body) || !("data" in body)) return [];
  const rows = body.data;
  return Array.isArray(rows) ? rows : [];
}
