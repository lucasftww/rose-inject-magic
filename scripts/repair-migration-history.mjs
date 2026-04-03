/**
 * Aligns remote supabase_migrations.schema_migrations with local migration filenames
 * so `supabase db push` works again (no SQL is executed — metadata only).
 *
 * Run from repo root: node scripts/repair-migration-history.mjs
 * Requires: linked project (`supabase link`) and CLI login.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function runSupabase(args) {
  const r = spawnSync("npx", ["supabase", ...args], {
    cwd: root,
    stdio: ["ignore", "inherit", "inherit"],
    encoding: "utf-8",
    shell: process.platform === "win32",
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

function migrationListText() {
  const r = spawnSync("npx", ["supabase", "migration", "list", "--linked"], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf-8",
    shell: process.platform === "win32",
  });
  if (r.status !== 0) {
    console.error(r.stderr || "migration list failed");
    process.exit(r.status ?? 1);
  }
  return r.stdout;
}

function parseList(output) {
  const remoteOnly = [];
  const localOnly = [];
  const ver = /^\d{14}$/;
  for (const line of output.split("\n")) {
    if (!line.includes("|")) continue;
    if (line.includes("---") || line.includes("Local")) continue;
    const parts = line.split("|").map((s) => s.trim());
    if (parts.length < 3) continue;
    const [local, remote] = parts;
    if (ver.test(local) && !ver.test(remote)) localOnly.push(local);
    else if (!ver.test(local) && ver.test(remote)) remoteOnly.push(remote);
  }
  return { remoteOnly, localOnly };
}

function repairBatch(status, versions) {
  const chunk = 25;
  for (let i = 0; i < versions.length; i += chunk) {
    const slice = versions.slice(i, i + chunk);
    console.log(`${status}: ${slice.length} versions (${i + 1}–${i + slice.length} of ${versions.length})`);
    runSupabase(["migration", "repair", "--status", status, ...slice, "--linked", "--yes"]);
  }
}

const text = migrationListText();
const { remoteOnly, localOnly } = parseList(text);

if (remoteOnly.length === 0 && localOnly.length === 0) {
  console.log("Nothing to repair (already aligned).");
  process.exit(0);
}

console.log(`Remote-only (revert): ${remoteOnly.length}`);
console.log(`Local-only (mark applied): ${localOnly.length}`);

if (remoteOnly.length) repairBatch("reverted", remoteOnly);
if (localOnly.length) repairBatch("applied", localOnly);

console.log("Done. Verifying with: npx supabase migration list --linked && npx supabase db push --dry-run --yes");
