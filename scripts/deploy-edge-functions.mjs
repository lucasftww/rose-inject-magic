/**
 * Deploy todas as Edge Functions do projeto para o Supabase.
 *
 * Requer: SUPABASE_ACCESS_TOKEN (Dashboard → Account → Access Tokens)
 *   PowerShell: $env:SUPABASE_ACCESS_TOKEN="sbp_..."
 *
 * Mitigação Windows / HTTP2: define GODEBUG=http2client=0 no processo filho
 * (evita `PROTOCOL_ERROR` / "cannot retry" ao falar com api.supabase.com).
 * Para forçar outro comportamento: $env:GODEBUG="..." (o script acrescenta http2client=0 se faltar).
 *
 * Uma função só:
 *   node scripts/deploy-edge-functions.mjs server-relay
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { setTimeout } from "node:timers/promises";
import { fileURLToPath } from "node:url";

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

/** Evita HTTP/2 no cliente Go do CLI (erros comuns em deploy no Windows). */
function envWithGoHttp11() {
  const raw = (process.env.GODEBUG || "").trim();
  const parts = raw
    ? raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  if (!parts.some((p) => /^http2client=/i.test(p))) {
    parts.push("http2client=0");
  }
  return { ...process.env, GODEBUG: parts.join(",") };
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

const deployEnv = envWithGoHttp11();
if (!process.env.SUPABASE_DEPLOY_QUIET_GO_DEBUG) {
  console.log(`[deploy] GODEBUG para o CLI: ${deployEnv.GODEBUG}`);
}

/** CLI recente reduz bugs de rede; --yes evita prompt do npx. */
const argsBase = [
  "--yes",
  "supabase@latest",
  "functions",
  "deploy",
  "--project-ref",
  PROJECT_REF,
  "--use-api",
];

const RETRY_WAIT_MS = [0, 4_000, 12_000, 24_000];
const PAUSE_BETWEEN_MS = 2_000;

function deployOnce(name) {
  const r = spawnSync("npx", [...argsBase, name], {
    stdio: "inherit",
    shell: true,
    cwd: root,
    env: deployEnv,
  });
  return r.status === 0;
}

for (let i = 0; i < FUNCTIONS.length; i++) {
  const name = FUNCTIONS[i];
  console.log(`\n── Deploy: ${name} ──`);

  let ok = false;
  for (let attempt = 0; attempt < RETRY_WAIT_MS.length; attempt++) {
    const wait = RETRY_WAIT_MS[attempt];
    if (wait > 0) {
      console.log(`   …espera ${wait / 1000}s antes da tentativa ${attempt + 1}/${RETRY_WAIT_MS.length}`);
      await setTimeout(wait);
    }
    if (deployOnce(name)) {
      ok = true;
      break;
    }
    if (attempt < RETRY_WAIT_MS.length - 1) {
      console.warn(`   Falha na tentativa ${attempt + 1}; a repetir…`);
    }
  }

  if (!ok) {
    console.error(`Falha ao fazer deploy de ${name} após ${RETRY_WAIT_MS.length} tentativas.`);
    console.error("Dicas: VPN/firewall off, rede estável, ou tente: $env:SUPABASE_DEPLOY_DEBUG='1'; npx supabase@latest functions deploy --project-ref ... --debug");
    process.exit(1);
  }

  if (i < FUNCTIONS.length - 1) {
    await setTimeout(PAUSE_BETWEEN_MS);
  }
}

console.log("\nTodas as Edge Functions foram publicadas.");
