import { isRecord } from "@/types/ticketChat";

/** Mensagem segura para UI a partir de `unknown` (fetch, React Query, etc.). */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function errorName(err: unknown): string {
  if (err instanceof Error) return err.name;
  if (isRecord(err) && typeof err.name === "string") return err.name;
  return "";
}
