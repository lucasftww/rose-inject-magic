import { supabaseUrl } from "@/integrations/supabase/client";

const PROXY_IF_INCLUDES = [
  "lzt.market",
  "img.lzt.market",
  "brawlify.com",
  "hoyoverse.com",
  "mihoyo.com",
  "webstatic",
] as const;

/** Proxy external game/CDN images through our edge allowlist to reduce hotlink/CORS breakage. */
export const getProxiedImageUrl = (url: string): string => {
  if (!url) return "";
  if (PROXY_IF_INCLUDES.some((frag) => url.includes(frag))) {
    return `${supabaseUrl}/functions/v1/lzt-market?action=image-proxy&url=${encodeURIComponent(url)}`;
  }
  return url;
};

/** Strip BBCode, URLs, and return cleaned description or null if too short. */
export const cleanLztDescription = (description: unknown): string | null => {
  if (!description) return null;
  const raw = String(description).trim();
  const stripped = raw
    .replace(/\[URL=[^\]]*\][^[]*\[\/URL\]/gi, "")
    .replace(/\[\/?\w+\]/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .trim();
  return stripped.length >= 10 ? stripped : null;
};
