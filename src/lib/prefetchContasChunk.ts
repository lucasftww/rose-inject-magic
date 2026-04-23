import type { GameTab } from "@/lib/contasMarketTypes";

/** Deduped dynamic import — must resolve to the same module as `lazy(() => import("./pages/Contas"))` in App. */
let contasChunkPromise: Promise<unknown> | null = null;
let valorantDetChunkPromise: Promise<unknown> | null = null;
let fortniteDetChunkPromise: Promise<unknown> | null = null;
let lolDetChunkPromise: Promise<unknown> | null = null;
let mcDetChunkPromise: Promise<unknown> | null = null;
let lztHoYoBrawlDetChunkPromise: Promise<unknown> | null = null;

export function prefetchContasChunk(): void {
  if (contasChunkPromise) return;
  contasChunkPromise = import("@/pages/Contas");
}

function prefetchValorantContaDetalhesChunk(): void {
  if (valorantDetChunkPromise) return;
  valorantDetChunkPromise = import("@/pages/ContaDetalhes");
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
  if (pathname.startsWith("/conta/")) prefetchValorantContaDetalhesChunk();
  else if (pathname.startsWith("/fortnite/")) prefetchFortniteDetalhesChunk();
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

/**
 * Bundle da página de detalhe do marketplace para a categoria ativa.
 * Chamado no boot (`/contas?game=`) e em idle ao mudar de aba — dedupe por promise global.
 */
export function prefetchAccountDetailChunkForMarketGame(game: GameTab): void {
  switch (game) {
    case "valorant":
      prefetchValorantContaDetalhesChunk();
      break;
    case "lol":
      prefetchLolDetalhesChunk();
      break;
    case "fortnite":
      prefetchFortniteDetalhesChunk();
      break;
    case "minecraft":
      prefetchMinecraftDetalhesChunk();
      break;
    case "genshin":
    case "honkai":
    case "zzz":
    case "brawlstars":
      prefetchLztMarketGameDetailChunk();
      break;
  }
}
