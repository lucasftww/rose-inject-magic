import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";
import { initErrorTracker } from "./lib/errorTracker";

function injectResourceHints() {
  if (typeof document === "undefined") return;
  const url = import.meta.env.VITE_SUPABASE_URL;
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
  for (const href of ["https://connect.facebook.net", "https://www.facebook.com"]) {
    const d = document.createElement("link");
    d.rel = "dns-prefetch";
    d.href = href;
    document.head.appendChild(d);
  }
}
injectResourceHints();

initErrorTracker();

createRoot(document.getElementById("root")!).render(<App />);
