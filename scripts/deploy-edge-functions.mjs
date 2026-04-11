/**
 * Deploy todas as Edge Functions do projeto para o Supabase.
 *
 * Requer: SUPABASE_ACCESS_TOKEN (Dashboard → Account → Access Tokens)
 *   PowerShell: $env:SUPABASE_ACCESS_TOKEN="sbp_..."
 *   cmd:        set SUPABASE_ACCESS_TOKEN=sbp_...
 *
 * Opcional: supabase login --token sbp_...
 *
 * Uma função só (ex.: após corrigir server-relay):
 *   npm run deploy:server-relay
 *   node scripts/deploy-edge-functions.mjs server-relay
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function projectRefFromConfig() {
  try {
    const toml = readFileSync(join(root, "supabase", "config.toml"), "utf8");
    const m = toml.match(/project_id\s*=\s*"([^"]+)"/);
    if (m) return m[1];
  } catch {
    /* ignore */
  }
  return null;
}

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || projectRefFromConfig();
if (!PROJECT_REF) {
  console.error("Não foi possível ler project_id de supabase/config.toml.");
  process.exit(1);
}

const ALL_FUNCTIONS = [
  "pix-payment",
  "scratch-card-play",
  "lzt-market",
  "admin-users",
  "generate-game-image",
  "track-login",
  "server-relay",
  "robot-project",
];

const cliNames = process.argv.slice(2).filter((a) => a && !a.startsWith("-"));
const FUNCTIONS =
  cliNames.length > 0
    ? cliNames.filter((name) => {
        if (!ALL_FUNCTIONS.includes(name)) {
          console.error(`Função desconhecida: ${name}. Válidas: ${ALL_FUNCTIONS.join(", ")}`);
          process.exit(1);
        }
        return true;
      })
    : ALL_FUNCTIONS;

if (!process.env.SUPABASE_ACCESS_TOKEN?.trim()) {
  console.error(
    "SUPABASE_ACCESS_TOKEN não definido.\n" +
      "1. Crie um token em https://supabase.com/dashboard/account/tokens\n" +
      "2. PowerShell: $env:SUPABASE_ACCESS_TOKEN=\"sbp_...\"\n" +
      "3. npm run deploy:supabase-functions\n" +
      "   (só server-relay: npm run deploy:server-relay)",
  );
  process.exit(1);
}

const argsBase = ["supabase", "functions", "deploy", "--project-ref", PROJECT_REF, "--use-api"];

for (const name of FUNCTIONS) {
  console.log(`\n── Deploy: ${name} ──`);
  const r = spawnSync("npx", [...argsBase, name], {
    stdio: "inherit",
    shell: true,
    cwd: root,
    env: { ...process.env },
  });
  if (r.status !== 0) {
    console.error(`Falha ao fazer deploy de ${name}.`);
    process.exit(r.status ?? 1);
  }
}

console.log("\nTodas as Edge Functions foram publicadas.");
