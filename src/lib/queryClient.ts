import { QueryClient } from "@tanstack/react-query";

/** Single instance so `invalidateAdminCache` and the app share the same cache. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      /** Evita repetir o mesmo GET (ex.: 410 do lzt-market detail) na consola. */
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});
