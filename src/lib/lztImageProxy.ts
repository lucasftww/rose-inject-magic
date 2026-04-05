import { supabaseUrl } from "@/integrations/supabase/client";

/** Proxy LZT Market images through our edge function to avoid CORS/hotlink issues. */
export const getProxiedImageUrl = (url: string): string => {
  if (!url) return "";
  if (url.includes("lzt.market") || url.includes("img.lzt.market")) {
    return `${supabaseUrl}/functions/v1/lzt-market?action=image-proxy&url=${encodeURIComponent(url)}`;
  }
  return url;
};

/** Strip BBCode, URLs, and return cleaned description or null if too short. */
export const cleanLztDescription = (description: unknown): string | null => {
  if (!description) return null;
  const raw = String(description).trim();
  const stripped = raw
    .replace(/\[URL=[^\]]*\][^\[]*\[\/URL\]/gi, "")
    .replace(/\[\/?\w+\]/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .trim();
  return stripped.length >= 10 ? stripped : null;
};
