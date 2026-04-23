import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";
import { initErrorTracker } from "./lib/errorTracker";
import { runMetaDevChecks } from "./lib/metaDevChecks";
import { supabaseUrl } from "./integrations/supabase/client";
import {
  prefetchContasChunk,
  prefetchAccountDetailChunksForPathname,
  prefetchAccountDetailChunkForMarketGame,
} from "./lib/prefetchContasChunk";
import { gameTabFromSearchParams } from "./lib/contasMarketTypes";

function injectResourceHints() {
  if (typeof document === "undefined") return;
  const url = supabaseUrl;
  if (typeof url === "string" && url.startsWith("https://")) {
    try {
      const origin = new URL(url).origin;
      const p = document.createElement("link");
      p.rel = "preconnect";
      p.href = origin;
      p.crossOrigin = "";
      document.head.prepend(p);
    } catch {
      /* ignore */
    }
  }
  for (const href of [
    "https://connect.facebook.net",
    "https://www.facebook.com",
    "https://economia.awesomeapi.com.br",
    "https://fortnite-api.com",
    "https://valorant-api.com",
    "https://ddragon.leagueoflegends.com",
  ]) {
    const d = document.createElement("link");
    d.rel = "dns-prefetch";
    d.href = href;
    document.head.appendChild(d);
  }
}
injectResourceHints();

/** Rotas pesadas: chunk lazy o mais cedo possível (paralelo ao boot do React). */
if (typeof window !== "undefined") {
  const p = window.location.pathname;
  if (p === "/contas") {
    prefetchContasChunk();
    try {
      prefetchAccountDetailChunkForMarketGame(gameTabFromSearchParams(new URLSearchParams(window.location.search)));
    } catch {
      /* ignore */
    }
  } else {
    prefetchAccountDetailChunksForPathname(p);
  }
}

initErrorTracker();
runMetaDevChecks();

createRoot(document.getElementById("root")!).render(<App />);
