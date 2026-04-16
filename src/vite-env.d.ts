/// <reference types="vite/client" />

/** Meta `fbq`: função + flags opcionais (ex. `disablePushState` em SPAs). */
type MetaPixelFbq = ((
  command: "track" | "trackCustom" | "init" | "set" | "addToCart" | "consent",
  event?: string,
  params?: Record<string, unknown>,
  options?: { eventID?: string }
) => void) & { disablePushState?: boolean };

interface Window {
  fbq: MetaPixelFbq;
}
