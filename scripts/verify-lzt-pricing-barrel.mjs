/**
 * Garante que `src/lib/lztPricingModel.ts` continua a ser só barrel para
 * `supabase/functions/_shared/lztPricingModel.ts` (uma fonte de verdade com a Edge).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const barrel = readFileSync(join(root, "src", "lib", "lztPricingModel.ts"), "utf8");
const needle = 'from "../../supabase/functions/_shared/lztPricingModel.ts"';

if (!barrel.includes(needle)) {
  console.error(
    "[verify:lzt-pricing] src/lib/lztPricingModel.ts must re-export only from supabase/functions/_shared/lztPricingModel.ts",
  );
  process.exit(1);
}

if (/export function |function getContentFloorBrl|function getDisplayedPriceBrl/.test(barrel)) {
  console.error(
    "[verify:lzt-pricing] Implement pricing only in supabase/functions/_shared/lztPricingModel.ts — barrel contains inline logic.",
  );
  process.exit(1);
}

console.log("[verify:lzt-pricing] OK");
