/** Deduped dynamic import — must resolve to the same module as `lazy(() => import("./pages/Contas"))` in App. */
let contasChunkPromise: Promise<unknown> | null = null;
let fortniteDetChunkPromise: Promise<unknown> | null = null;
let lolDetChunkPromise: Promise<unknown> | null = null;
let mcDetChunkPromise: Promise<unknown> | null = null;
let lztHoYoBrawlDetChunkPromise: Promise<unknown> | null = null;

export function prefetchContasChunk(): void {
  if (contasChunkPromise) return;
  contasChunkPromise = import("@/pages/Contas");
}

function prefetchFortniteDetalhesChunk(): void {
  if (fortniteDetChunkPromise) return;
  fortniteDetChunkPromise = import("@/pages/FortniteDetalhes");
}

function prefetchLolDetalhesChunk(): void {
  if (lolDetChunkPromise) return;
  lolDetChunkPromise = import("@/pages/LolDetalhes");
}

function prefetchMinecraftDetalhesChunk(): void {
  if (mcDetChunkPromise) return;
  mcDetChunkPromise = import("@/pages/MinecraftDetalhes");
}

function prefetchLztMarketGameDetailChunk(): void {
  if (lztHoYoBrawlDetChunkPromise) return;
  lztHoYoBrawlDetChunkPromise = import("@/pages/LztMarketGameDetail");
}

/** Entrada direta em URL de detalhe: começa o JS da página sem esperar pelo router. */
export function prefetchAccountDetailChunksForPathname(pathname: string): void {
  if (pathname.startsWith("/fortnite/")) prefetchFortniteDetalhesChunk();
  else if (pathname.startsWith("/lol/")) prefetchLolDetalhesChunk();
  else if (pathname.startsWith("/minecraft/")) prefetchMinecraftDetalhesChunk();
  else if (
    pathname.startsWith("/genshin/") ||
    pathname.startsWith("/honkai/") ||
    pathname.startsWith("/zzz/") ||
    pathname.startsWith("/brawlstars/")
  ) {
    prefetchLztMarketGameDetailChunk();
  }
}
