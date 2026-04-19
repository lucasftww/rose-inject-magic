/**
 * Corre `npm run check` com VITE_* de publicação alinhados ao fallback de desenvolvimento
 * em `src/integrations/supabase/client.ts` (DEV_FALLBACK_*), para build de produção + E2E
 * passarem sem ficheiro `.env` local.
 *
 * Mantém estes valores em sync com client.ts se o fallback mudar.
 */
import { spawnSync } from "node:child_process";

const VITE_SUPABASE_URL = "https://cthqzetkshrbsjulfytl.supabase.co";
const VITE_SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0aHF6ZXRrc2hyYnNqdWxmeXRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0ODQ0MzMsImV4cCI6MjA4ODA2MDQzM30.j6cRaiydfGUnoXwoz34HzL3TtnYrj93qinX7aiA9ecg";

const r = spawnSync("npm", ["run", "check"], {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    VITE_SUPABASE_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY,
  },
});

process.exit(r.status ?? 1);
