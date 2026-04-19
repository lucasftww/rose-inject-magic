import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const DEFAULT_META_PIXEL_ID = "706054019233816";

function resolveMetaPixelId(mode: string): string {
  const env = loadEnv(mode, process.cwd(), "");
  const raw = String(env.VITE_META_PIXEL_ID || DEFAULT_META_PIXEL_ID).trim();
  return /^\d{10,20}$/.test(raw) ? raw : DEFAULT_META_PIXEL_ID;
}

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const metaPixelId = resolveMetaPixelId(mode);

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [
      {
        name: "html-meta-pixel-id",
        enforce: "pre",
        transformIndexHtml(html) {
          /** Só em `vite build` (qualquer --mode); em `vite dev` não carrega fbevents.js — menos avisos no Issues. Builds `build:dev` mantêm o pixel. */
          const loadMetaPixel = command === "build";
          return html
            .replace(/__ROYAL_META_PIXEL_ID__/g, metaPixelId)
            .replace(/__ROYAL_LOAD_META_PIXEL__/g, loadMetaPixel ? "true" : "false");
        },
      },
      react(),
      mode === "development" && componentTagger(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      target: "es2020",
      cssMinify: true,
      rollupOptions: {
        output: {
          manualChunks: {
            "vendor-react": ["react", "react-dom", "react-router-dom"],
            // framer-motion: não forçar chunk próprio — manualChunks puxava jsx/runtime para o entry
            "vendor-query": ["@tanstack/react-query"],
            "vendor-supabase": ["@supabase/supabase-js"],
            // recharts: chunk manual puxava o pacote para o entry; fica só nos chunks lazy (Dashboard/FinanceTab)
            "vendor-i18n": ["i18next", "react-i18next", "i18next-browser-languagedetector"],
          },
        },
      },
    },
  };
});
