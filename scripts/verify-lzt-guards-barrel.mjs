/**
 * Garante que `src/lib/lztItemGuards.ts` continua a ser só barrel para
 * `supabase/functions/_shared/lztItemGuards.ts` (uma fonte de verdade).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const barrel = readFileSync(join(root, "src", "lib", "lztItemGuards.ts"), "utf8");
const needle = "from \"../../supabase/functions/_shared/lztItemGuards.ts\"";

if (!barrel.includes(needle)) {
  console.error(
    "[verify:lzt-guards] src/lib/lztItemGuards.ts must re-export only from supabase/functions/_shared/lztItemGuards.ts",
  );
  process.exit(1);
}

if (/function\s+normalizeLztItemState|export function hasLztBuyerAssigned/.test(barrel)) {
  console.error(
    "[verify:lzt-guards] Implement guards only in supabase/functions/_shared/lztItemGuards.ts — barrel contains inline logic.",
  );
  process.exit(1);
}

console.log("[verify:lzt-guards] OK");
