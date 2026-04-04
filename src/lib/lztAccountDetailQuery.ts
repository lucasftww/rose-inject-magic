/** Chave alinhada com `useQuery` nas páginas de detalhe LZT — usada para reutilizar cache no “Comprar”. */
export const lztAccountDetailQueryKey = (game: string, itemId: string) =>
  ["lzt-account-detail", game, itemId] as const;
