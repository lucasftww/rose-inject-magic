/** Deduped dynamic import — must resolve to the same module as `lazy(() => import("./pages/Contas"))` in App. */
let contasChunkPromise: Promise<unknown> | null = null;

export function prefetchContasChunk(): void {
  if (contasChunkPromise) return;
  contasChunkPromise = import("@/pages/Contas");
}
