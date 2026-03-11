import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { Star, ArrowRight, ChevronLeft, ChevronRight, Package, Loader2, Crosshair, Globe } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLztMarkup } from "@/hooks/useLztMarkup";
import bannerInject from "@/assets/banner-inject.png";
import cardHilex from "@/assets/card-hilex.jpg";
import cardShadow from "@/assets/card-shadow.jpg";
import cardHilexSkin from "@/assets/card-hilex-skin.jpg";
import contaKnife from "@/assets/conta-knife.png";
import rankAscendente from "@/assets/rank-ascendente.png";
import rankFerro from "@/assets/rank-ferro.png";
import rankBronze from "@/assets/rank-bronze.png";
import rankPrata from "@/assets/rank-prata.png";
import rankOuro from "@/assets/rank-ouro.png";
import rankPlatina from "@/assets/rank-platina.png";
import rankDiamante from "@/assets/rank-diamante.png";
import rankImortal from "@/assets/rank-imortal.png";
import rankRadiante from "@/assets/rank-radiante-new.png";
import rankUnranked from "@/assets/rank-unranked.png";

const rankMap: Record<number, { name: string; img: string }> = {
  3: { name: "Ferro 1", img: rankFerro },
  4: { name: "Ferro 2", img: rankFerro },
  5: { name: "Ferro 3", img: rankFerro },
  6: { name: "Bronze 1", img: rankBronze },
  7: { name: "Bronze 2", img: rankBronze },
  8: { name: "Bronze 3", img: rankBronze },
  9: { name: "Prata 1", img: rankPrata },
  10: { name: "Prata 2", img: rankPrata },
  11: { name: "Prata 3", img: rankPrata },
  12: { name: "Ouro 1", img: rankOuro },
  13: { name: "Ouro 2", img: rankOuro },
  14: { name: "Ouro 3", img: rankOuro },
  15: { name: "Platina 1", img: rankPlatina },
  16: { name: "Platina 2", img: rankPlatina },
  17: { name: "Platina 3", img: rankPlatina },
  18: { name: "Diamante 1", img: rankDiamante },
  19: { name: "Diamante 2", img: rankDiamante },
  20: { name: "Diamante 3", img: rankDiamante },
  21: { name: "Ascendente 1", img: rankAscendente },
  22: { name: "Ascendente 2", img: rankAscendente },
  23: { name: "Ascendente 3", img: rankAscendente },
  24: { name: "Imortal 1", img: rankImortal },
  25: { name: "Imortal 2", img: rankImortal },
  26: { name: "Imortal 3", img: rankImortal },
  27: { name: "Radiante", img: rankRadiante },
};

interface LztItem {
  item_id: number;
  title: string;
  price: number;
  price_currency?: string;
  riot_valorant_rank?: number;
  riot_valorant_skin_count?: number;
  riot_valorant_knife?: number;
  riot_valorant_rank_type?: string;
  valorantRegionPhrase?: string;
  valorantInventory?: {
    WeaponSkins?: string[];
    Agent?: string[];
    Buddy?: string[];
  };
  imagePreviewLinks?: {
    direct?: {
      weapons?: string;
      agents?: string;
      buddies?: string;
    };
  };
  price_brl?: number;
}

const fetchAllValorantSkins = async (): Promise<Map<string, { name: string; image: string }>> => {
  const map = new Map<string, { name: string; image: string }>();

  // Fetch weapon skins
  try {
    const res = await fetch("https://valorant-api.com/v1/weapons/skins?language=pt-BR");
    if (res.ok) {
      const data = await res.json();
      for (const s of (data.data || [])) {
        const image = s.levels?.[0]?.displayIcon || s.displayIcon || s.chromas?.[0]?.fullRender;
        if (!image) continue;
        const entry = { name: s.displayName, image };
        if (s.uuid) map.set(s.uuid.toLowerCase(), entry);
        for (const level of (s.levels || [])) {
          if (level.uuid) map.set(level.uuid.toLowerCase(), entry);
        }
        for (const chroma of (s.chromas || [])) {
          if (chroma.uuid) map.set(chroma.uuid.toLowerCase(), entry);
        }
      }
    }
  } catch { /* ignore */ }

  // Fetch agents
  try {
    const res = await fetch("https://valorant-api.com/v1/agents?isPlayableCharacter=true&language=pt-BR");
    if (res.ok) {
      const data = await res.json();
      for (const a of (data.data || [])) {
        const image = a.displayIcon || a.fullPortrait || a.bustPortrait;
        if (!image || !a.uuid) continue;
        map.set(a.uuid.toLowerCase(), { name: a.displayName, image });
      }
    }
  } catch { /* ignore */ }

  // Fetch buddies
  try {
    const res = await fetch("https://valorant-api.com/v1/buddies?language=pt-BR");
    if (res.ok) {
      const data = await res.json();
      for (const b of (data.data || [])) {
        const image = b.displayIcon;
        if (!image || !b.uuid) continue;
        const entry = { name: b.displayName, image };
        if (b.uuid) map.set(b.uuid.toLowerCase(), entry);
        for (const level of (b.levels || [])) {
          if (level.uuid) map.set(level.uuid.toLowerCase(), entry);
        }
      }
    }
  } catch { /* ignore */ }

  return map;
};

const fetchLztAccounts = async (): Promise<LztItem[]> => {
  const projectUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const res = await fetch(
    `${projectUrl}/functions/v1/lzt-market?order_by=pdate_desc&valorant_smin=20&valorant_region[]=br`,
    { headers: { "Content-Type": "application/json", apikey: anonKey } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  // Sort by skin count descending to show best accounts first
  const items: LztItem[] = data.items || [];
  items.sort((a, b) => (b.riot_valorant_skin_count || 0) - (a.riot_valorant_skin_count || 0));
  return items.slice(0, 6);
};

interface ProductFromDB {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  product_plans: { id: string; name: string; price: number; active: boolean }[];
}

// Animation variants
const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.1, ease: "easeOut" as const },
  }),
};

const staggerContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.15 },
  },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: (i: number = 0) => ({
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, delay: i * 0.1, ease: "easeOut" as const },
  }),
};

const slideInLeft = {
  hidden: { opacity: 0, x: -60 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.7, ease: "easeOut" as const },
  },
};

const CartHeartIcon = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path d="M9 20C9 21.1 8.1 22 7 22S5 21.1 5 20 5.9 18 7 18 9 18.9 9 20M17 18C15.9 18 15 18.9 15 20S15.9 22 17 22 19 21.1 19 20 18.1 18 17 18M7.2 14.8V14.7L8.1 13H15.5C16.2 13 16.9 12.6 17.2 12L21.1 5L19.4 4L15.5 11H8.5L4.3 2H1V4H3L6.6 11.6L5.2 14C5.1 14.3 5 14.6 5 15C5 16.1 5.9 17 7 17H19V15H7.4C7.3 15 7.2 14.9 7.2 14.8M12 9.3L11.4 8.8C9.4 6.9 8 5.7 8 4.2C8 3 9 2 10.2 2C10.9 2 11.6 2.3 12 2.8C12.4 2.3 13.1 2 13.8 2C15 2 16 2.9 16 4.2C16 5.7 14.6 6.9 12.6 8.8L12 9.3Z" />
  </svg>
);

const ShieldIcon = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
    <path d="M5.072.56C6.157.265 7.31 0 8 0s1.843.265 2.928.56c1.11.3 2.229.655 2.887.87a1.54 1.54 0 0 1 1.044 1.262c.596 4.477-.787 7.795-2.465 9.99a11.8 11.8 0 0 1-2.517 2.453 7 7 0 0 1-1.048.625c-.28.132-.581.24-.829.24s-.548-.108-.829-.24a7 7 0 0 1-1.048-.625 11.8 11.8 0 0 1-2.517-2.453C1.928 10.487.545 7.169 1.141 2.692A1.54 1.54 0 0 1 2.185 1.43 63 63 0 0 1 5.072.56"/>
  </svg>
);

const StarHalfIcon = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor">
    <path d="M239.18,97.26A16.38,16.38,0,0,0,224.92,86l-59-4.76L143.14,26.15a16.36,16.36,0,0,0-30.27,0L90.11,81.23,31.08,86a16.46,16.46,0,0,0-9.37,28.86l45,38.83L53,211.75a16.4,16.4,0,0,0,24.5,17.82L128,198.49l50.53,31.08A16.4,16.4,0,0,0,203,211.75l-13.76-58.07,45-38.83A16.43,16.43,0,0,0,239.18,97.26Zm-15.34,5.47-48.7,42a8,8,0,0,0-2.56,7.91l14.88,62.8a.37.37,0,0,1-.17.48c-.18.14-.23.11-.38,0l-54.72-33.65A8,8,0,0,0,128,181.1V32c.24,0,.27.08.35.26L153,91.86a8,8,0,0,0,6.75,4.92l63.91,5.16c.16,0,.25,0,.34.29S224,102.63,223.84,102.73Z"/>
  </svg>
);

const trustBadges = [
  { icon: CartHeartIcon, label: "Entrega", highlight: "Instantanea" },
  { icon: ShieldIcon, label: "100%", highlight: "Seguro" },
  { icon: StarHalfIcon, label: "+5 Anos de", highlight: "Experiencia" },
];

const FloatingWidgets = () => {
  const [showTooltip, setShowTooltip] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowTooltip(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex items-end gap-2 sm:gap-3">
      <div
        className={`mb-1 rounded-lg border border-border bg-card px-3 py-2 sm:px-4 sm:py-3 shadow-lg transition-all duration-500 hidden sm:block ${
          showTooltip ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
        }`}
      >
        <p className="text-sm font-semibold text-foreground">Dúvidas? Fale conosco!</p>
        <p className="text-xs text-muted-foreground">Entre no nosso Discord</p>
      </div>
      <a
        href="https://discord.gg/royalstorebr"
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-[#5865F2] text-white shadow-[0_0_20px_rgba(88,101,242,0.4)] transition-all hover:scale-110 hover:shadow-[0_0_30px_rgba(88,101,242,0.6)]"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="currentColor" viewBox="0 0 127.14 96.36">
          <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53.12S36,40.55,42.45,40.55,54,46.24,53.91,53.12,48.85,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53.12s5-12.57,11.44-12.57S96.23,46.24,96.12,53.12,91.06,65.69,84.69,65.69Z"/>
        </svg>
      </a>
    </div>
  );
};


// Fallback: show LZT direct preview image, with placeholder on error
const LztPreviewFallback = ({ url }: { url: string }) => {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <div className="flex h-full w-full items-center justify-center"><Crosshair className="h-12 w-12 text-muted-foreground/20" /></div>;
  }
  return (
    <div className="relative z-[1] flex items-center justify-center w-full h-full p-3">
      <img src={url} alt="Skins preview" className="h-full w-full object-contain" loading="lazy" onError={() => setFailed(true)} />
    </div>
  );
};


const LztContaCard = ({ item, skinsMap, formatPrice }: { item: LztItem; skinsMap: Map<string, { name: string; image: string }>; formatPrice: (price: number, currency?: string) => string }) => {
  const navigate = useNavigate();
  const rank = item.riot_valorant_rank ? rankMap[item.riot_valorant_rank] : null;
  const hasKnife = (item.riot_valorant_knife ?? 0) > 0;
  const skinCount = item.riot_valorant_skin_count ?? 0;

  const skinPreviews = useMemo(() => {
    const results: { name: string; image: string }[] = [];
    const toUuids = (raw: unknown): string[] => {
      if (Array.isArray(raw)) return raw;
      if (raw && typeof raw === "object") return Object.values(raw as Record<string, string>);
      return [];
    };
    const allUuids = [
      ...toUuids(item.valorantInventory?.WeaponSkins),
      ...toUuids(item.valorantInventory?.Agent),
      ...toUuids(item.valorantInventory?.Buddy),
    ];
    for (const uuid of allUuids) {
      if (typeof uuid !== "string") continue;
      const entry = skinsMap.get(uuid.toLowerCase());
      if (entry) results.push(entry);
      if (results.length >= 6) break;
    }
    return results;
  }, [item.valorantInventory, skinsMap]);

  return (
    <div
      className="group cursor-pointer overflow-hidden rounded-lg border border-border bg-card transition-all hover:border-success/40 hover:shadow-[0_0_20px_hsl(197,100%,50%,0.1)]"
      onClick={() => navigate(`/conta/${item.item_id}`)}
    >
      <div className="relative flex h-48 items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--secondary))] via-[hsl(var(--background))] to-[hsl(var(--secondary))]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--success)/0.08),transparent_70%)]" />
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[hsl(var(--card))] to-transparent z-[2]" />
        <div className="absolute left-3 top-3 z-10 flex gap-1.5">
          {hasKnife && <span className="rounded bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground">🔪 Knife</span>}
        </div>
        {skinPreviews.length > 0 ? (
          <div className="relative z-[1] grid grid-cols-3 gap-2 p-4 w-full h-full">
            {skinPreviews.map((skin, i) => (
              <div key={i} className="flex items-center justify-center rounded bg-secondary/30 p-1.5">
                <img src={skin.image} alt={skin.name} className="h-full w-full object-contain" loading="lazy" />
              </div>
            ))}
          </div>
        ) : item.imagePreviewLinks?.direct?.weapons ? (
          <LztPreviewFallback url={item.imagePreviewLinks.direct.weapons} />
        ) : (
          <div className="flex h-full w-full items-center justify-center"><Crosshair className="h-12 w-12 text-muted-foreground/20" /></div>
        )}
      </div>
      <div className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={rank?.img || rankUnranked} alt={rank?.name || "Unranked"} className="h-6 w-6 object-contain" />
            <span className="rounded bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">{rank?.name || "Unranked"}</span>
          </div>
          <span className="text-sm text-muted-foreground">{skinCount} skins</span>
        </div>
        <div className="mt-3 flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <svg className="h-4 w-4 text-success" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M11.14 4L6.43 16H8.36L9.32 13.43H14.67L15.64 16H17.57L12.86 4M12 6.29L14.03 11.71H9.96M4 18V15H2V20H22V18Z" /></svg>
            <span className="text-xs font-medium text-success">Conta Full Acesso</span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg className="h-4 w-4 text-success" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="currentColor"><path d="M19,24H4L3.9966,8.9062l11.4341,7.9161a1.0008,1.0008,0,0,0,1.1386,0L28,8.9087,28,18h2V8a2.0027,2.0027,0,0,0-2-2H4A2.0023,2.0023,0,0,0,2,8V24a2.0027,2.0027,0,0,0,2,2H19ZM25.7986,8,16,14.7837,6.2014,8Z"/><circle cx="26" cy="24" r="4"/></svg>
            <span className="text-xs font-medium text-success">Email e Senha inclusos</span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg className="h-4 w-4 text-success" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2.05v2.02c3.95.49 7 3.85 7 7.93 0 1.45-.39 2.81-1.06 3.97l1.47 1.47A9.953 9.953 0 0022 12c0-5.18-3.95-9.45-9-9.95zM12 19c-3.87 0-7-3.13-7-7 0-3.53 2.61-6.43 6-6.92V3.05c-5.06.5-9 4.76-9 9.95 0 5.52 4.47 10 9.99 10 3.31 0 6.24-1.61 8.06-4.09l-1.46-1.46A7.932 7.932 0 0112 19z"/><path d="M16 12l-4-4v3H8v2h4v3z"/></svg>
            <span className="text-xs font-medium text-success">Entrega Automática</span>
          </div>
        </div>
        {item.valorantRegionPhrase && (
          <div className="mt-2 flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">{item.valorantRegionPhrase}</span>
          </div>
        )}
        <div className="mt-4 flex items-end justify-between">
          <p className="text-xl font-bold text-success">
            {formatPrice(item.price, item.price_currency)}
          </p>
          <span className="flex items-center gap-1.5 rounded border border-border px-4 py-2 text-xs font-medium text-muted-foreground transition-colors group-hover:border-success group-hover:text-success">
            Ver conta
          </span>
        </div>
      </div>
    </div>
  );
};

const ContasSection = () => {
  const { getDisplayPrice } = useLztMarkup();
  const { data: accounts = [], isLoading: loadingAccounts } = useQuery({
    queryKey: ["landing-lzt-accounts"],
    queryFn: fetchLztAccounts,
    staleTime: 1000 * 60 * 5,
  });

  const { data: skinsMap = new Map() } = useQuery({
    queryKey: ["all-valorant-skins"],
    queryFn: fetchAllValorantSkins,
    staleTime: 1000 * 60 * 60,
  });

  return (
    <section className="border-t border-border bg-background px-4 sm:px-6 py-12 sm:py-24">
      <div className="mx-auto max-w-7xl">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={slideInLeft}>
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-success">Selecao Accounts</p>
          <h2 className="mt-3 text-3xl sm:text-5xl font-bold tracking-tight text-foreground md:text-7xl" style={{ fontFamily: "'Valorant', sans-serif" }}>CONTAS VALORANT</h2>
        </motion.div>

        {loadingAccounts ? (
          <div className="mt-14 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-success" /></div>
        ) : accounts.length === 0 ? (
          <div className="mt-14 text-center text-muted-foreground">Nenhuma conta disponível no momento.</div>
        ) : (
          <motion.div
            className="mt-8 sm:mt-14 grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-40px" }}
            variants={staggerContainer}
          >
            {accounts.map((item, idx) => (
              <motion.div key={item.item_id} variants={fadeUp} custom={idx}>
                <LztContaCard item={item} skinsMap={skinsMap} formatPrice={(p, c) => getDisplayPrice({ price: p, price_currency: c, price_brl: item.price_brl }, "valorant")} />
              </motion.div>
            ))}
          </motion.div>
        )}

        <motion.div className="mt-10 sm:mt-12 flex justify-center" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
          <Link
            to="/contas"
            className="flex w-full sm:w-auto items-center justify-center gap-2 border-2 border-foreground/30 px-8 sm:px-14 py-3.5 sm:py-4 text-sm font-bold uppercase tracking-[0.25em] text-foreground transition-all hover:border-success hover:text-success hover:shadow-[0_0_30px_hsl(197,100%,50%,0.2)] rounded-lg sm:rounded-none mx-4 sm:mx-0"
            style={{ fontFamily: "'Valorant', sans-serif" }}
          >
            Explorar Contas
            <ArrowRight className="h-5 w-5" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
};



const FaqItem = ({ question, answer, index }: { question: string; answer: string; index: number }) => {
  const [open, setOpen] = useState(false);
  return (
    <motion.div variants={fadeUp} custom={index} className="rounded-lg border border-border bg-card overflow-hidden transition-colors hover:border-success/30">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-6 py-5 text-left"
      >
        <span className="text-base font-semibold text-foreground pr-4">{question}</span>
        <svg
          className={`h-5 w-5 shrink-0 text-success transition-transform duration-300 ${open ? "rotate-45" : ""}`}
          xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
      <div className={`grid transition-all duration-300 ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <p className="px-6 pb-5 text-sm leading-relaxed text-muted-foreground">{answer}</p>
        </div>
      </div>
    </motion.div>
  );
};

const ProductsSection = () => {
  const navigate = useNavigate();
  const { data: dbProducts = [], isLoading } = useQuery({
    queryKey: ["featured-products"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("*, product_plans(*)")
        .eq("active", true)
        .order("sort_order", { ascending: true })
        .limit(6);
      return (data || []) as ProductFromDB[];
    },
    staleTime: 1000 * 60 * 5,
  });

  return (
    <section className="border-t border-border bg-background px-4 sm:px-6 py-12 sm:py-24">
      <div className="mx-auto max-w-7xl">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={slideInLeft}>
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-success">Selecao Premium</p>
          <h2 className="mt-3 text-3xl sm:text-5xl font-bold tracking-tight text-foreground md:text-7xl" style={{ fontFamily: "'Valorant', sans-serif" }}>DESTAQUE</h2>
        </motion.div>

        {isLoading ? (
          <div className="mt-14 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-success" /></div>
        ) : dbProducts.length === 0 ? (
          <div className="mt-14 text-center text-muted-foreground">Nenhum produto disponível no momento.</div>
        ) : (
          <motion.div
            className="mt-8 sm:mt-14 grid grid-cols-2 gap-3 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            variants={staggerContainer}
          >
            {dbProducts.map((product, idx) => {
              const activePlans = product.product_plans?.filter(p => p.active) || [];
              const lowestPrice = activePlans.length > 0 ? Math.min(...activePlans.map(p => Number(p.price))) : null;
              return (
                <motion.div
                  key={product.id}
                  variants={scaleIn}
                  custom={idx}
                  onClick={() => navigate(`/produto/${product.id}`)}
                  className="group cursor-pointer overflow-hidden rounded-lg border border-border bg-card transition-all hover:border-success/40 hover:shadow-[0_0_20px_hsl(197,100%,50%,0.1)]"
                >
                  <div className="relative aspect-square w-full overflow-hidden bg-secondary/50">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="absolute inset-0 h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Package className="h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground/20" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col justify-between p-3 sm:p-5 flex-1">
                    <div>
                      <h3 className="text-xs sm:text-base font-bold text-foreground line-clamp-1">{product.name}</h3>
                      {product.description && (
                        <p className="mt-1 text-[10px] sm:text-xs text-muted-foreground line-clamp-2 hidden sm:block">{product.description}</p>
                      )}
                    </div>
                    {lowestPrice !== null && (
                      <div className="mt-2 sm:mt-4 flex items-end justify-between gap-2">
                        <div>
                          <p className="text-[9px] sm:text-[10px] text-muted-foreground">A partir de</p>
                          <p className="text-base sm:text-xl font-bold text-success">R$ {lowestPrice.toFixed(2)}</p>
                        </div>
                        <span className="hidden sm:flex items-center gap-1.5 rounded border border-border px-4 py-2 text-xs font-medium text-muted-foreground transition-colors group-hover:border-success group-hover:text-success">
                          Ver produto
                        </span>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        <motion.div className="mt-10 sm:mt-12 flex justify-center" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
          <Link to="/produtos" className="flex w-full sm:w-auto items-center justify-center gap-2 border-2 border-foreground/30 px-8 sm:px-14 py-3.5 sm:py-4 text-sm font-bold uppercase tracking-[0.25em] text-foreground transition-all hover:border-success hover:text-success hover:shadow-[0_0_30px_hsl(197,100%,50%,0.2)] rounded-lg sm:rounded-none mx-4 sm:mx-0" style={{ fontFamily: "'Valorant', sans-serif" }}>
            Ver Todos Produtos
            <ArrowRight className="h-5 w-5" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
};
const StickyMobileCTA = () => (
  <div className="fixed bottom-0 left-0 right-0 z-40 sm:hidden">
    <div className="bg-card/95 backdrop-blur-xl border-t border-border px-4 py-3 safe-area-bottom">
      <div className="flex gap-2.5">
        <Link
          to="/produtos"
          className="btn-shine flex-1 flex items-center justify-center gap-2 bg-success py-3.5 text-sm font-bold tracking-wide text-success-foreground rounded-xl shadow-[0_0_25px_hsl(197,100%,50%,0.3)]"
        >
          <span className="relative flex items-center gap-2">
            🛒 Ver Produtos
          </span>
        </Link>
        <Link
          to="/contas"
          className="flex-1 flex items-center justify-center gap-2 border-2 border-success/50 py-3.5 text-sm font-bold tracking-wide text-success rounded-xl"
        >
          🎮 Ver Contas
        </Link>
      </div>
    </div>
  </div>
);

const Index = () => {
  return (
    <div className="relative min-h-screen bg-background overflow-x-hidden">
      <Header />

      {/* HERO - Mobile-first conversion optimized */}
      <main className="relative flex min-h-[85vh] sm:min-h-screen flex-col items-center justify-center px-4 sm:px-6 pt-2 sm:pt-4 pb-8 sm:pb-20 text-center">
        {/* Grid pattern */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[400px] sm:h-[550px] w-[600px] sm:w-[900px] -translate-x-1/2 -translate-y-1/2"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--border) / 0.8) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border) / 0.8) 1px, transparent 1px)",
            backgroundSize: "50px 50px",
            maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
            filter: "blur(0.5px)",
          }}
        />
        {/* Glow */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[400px] sm:h-[600px] w-[600px] sm:w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,_hsl(197,100%,50%,0.15)_0%,_transparent_65%)]" />

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="z-10 mb-6 sm:mb-12 flex items-center gap-2"
        >
          <Star className="h-5 w-5 sm:h-6 sm:w-6 fill-success text-success" />
          <span className="text-sm sm:text-base font-semibold tracking-wide text-success">+20.000 Clientes Satisfeitos</span>
        </motion.div>

        {/* Headline - shorter on mobile */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="z-10 max-w-4xl text-[2rem] leading-[1.1] sm:text-5xl font-bold tracking-tight text-foreground md:text-7xl lg:text-8xl"
        >
          Domine o Jogo com{" "}
          <span
            className="inline-block bg-gradient-to-r from-success via-[hsl(197,100%,70%)] to-success bg-[length:200%_100%] bg-clip-text text-transparent"
            style={{ fontFamily: "'Valorant', sans-serif" }}
          >
            Royal Store
          </span>
        </motion.h1>

        {/* Subtitle - shorter on mobile */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="z-10 mt-4 sm:mt-8 max-w-2xl text-[13px] leading-relaxed sm:text-lg text-muted-foreground md:text-xl px-2 sm:px-0"
        >
          <span className="hidden sm:inline">Somos referência no mercado há mais de 5 anos, oferecendo softwares premium com{" "}
          <span className="text-foreground font-medium">tecnologia indetectável</span>,{" "}
          <span className="text-foreground font-medium">atualizações constantes</span> e{" "}
          <span className="text-foreground font-medium">suporte dedicado 24/7</span>.
          Mais de 20 mil clientes confiam na Royal Store para alcançar o próximo nível.
          Entrega instantânea, pagamento seguro e garantia de satisfação em todos os produtos.</span>
          <span className="sm:hidden">Softwares premium com <span className="text-foreground font-medium">entrega instantânea</span>, <span className="text-foreground font-medium">suporte 24/7</span> e <span className="text-foreground font-medium">garantia total</span>. +20 mil clientes confiam na Royal.</span>
        </motion.p>

        {/* CTA Buttons - bigger on mobile */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="z-10 mt-6 sm:mt-12 flex w-full sm:w-auto flex-col sm:flex-row items-center justify-center gap-3 sm:gap-5 px-2 sm:px-0"
        >
          <Link to="/produtos" className="btn-shine group relative flex w-full sm:w-auto items-center justify-center gap-2 bg-success px-10 py-4 sm:py-4 text-base font-semibold tracking-wide text-success-foreground transition-all hover:shadow-[0_0_30px_hsl(197,100%,50%,0.5)] rounded-xl sm:rounded-none shadow-[0_0_20px_hsl(197,100%,50%,0.25)]">
            <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,_hsl(197,100%,70%,0.3)_0%,_transparent_60%)]" />
            <span className="relative flex items-center gap-2">
              Ver Produtos
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
          <Link to="/contas" className="w-full sm:w-auto border-2 border-success/40 px-10 py-4 text-base font-medium text-success transition-colors hover:border-foreground hover:text-foreground rounded-xl sm:rounded-none text-center">
            Ver Contas
          </Link>
        </motion.div>

        {/* Trust badges - horizontal scroll on mobile */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1.0 }}
          className="z-10 mt-8 sm:mt-20 flex items-center justify-center gap-4 sm:gap-8 md:gap-14 w-full overflow-x-auto scrollbar-hide px-2 sm:px-0"
        >
          {trustBadges.map((item, idx) => (
            <motion.div
              key={item.highlight}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1.0 + idx * 0.15 }}
              className="flex items-center gap-2 sm:gap-3 shrink-0"
            >
              <item.icon className="h-5 w-5 sm:h-6 sm:w-6 text-success" />
              <div className="text-left">
                <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">{item.label}</span>
                <p
                  className="text-sm sm:text-base font-bold tracking-wide text-foreground whitespace-nowrap"
                  style={{ fontFamily: "'Valorant', sans-serif" }}
                >
                  {item.highlight}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Social proof */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1.4 }}
          className="z-10 mt-6 sm:mt-12 flex flex-col sm:flex-row items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground"
        >
          <div className="flex">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="h-4 w-4 fill-success text-success" />
            ))}
          </div>
          <span className="text-center">Avaliação média 4.8/5 • +5000 avaliações</span>
        </motion.div>

        {/* Scroll indicator - hidden on mobile */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1.6 }}
          className="z-10 mt-8 sm:mt-16 hidden sm:flex animate-bounce flex-col items-center gap-1 text-muted-foreground"
        >
          <span className="text-xs tracking-widest uppercase">Explorar</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M19 12l-7 7-7-7"/>
          </svg>
        </motion.div>
      </main>

      {/* Banner Section */}
      <section className="relative overflow-hidden border-t border-border">
        <div className="absolute inset-0">
          <img src={bannerInject} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-20 flex items-center justify-center">
          <motion.div
            className="text-center"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <h2 className="text-xl sm:text-4xl font-bold tracking-tight text-foreground md:text-6xl" style={{ fontFamily: "'Valorant', sans-serif" }}>
              CHEATS <span className="text-success">&</span> ACCOUNTS
            </h2>
            <p className="mt-3 sm:mt-4 text-sm sm:text-base text-muted-foreground max-w-xl mx-auto px-4 sm:px-0">
              Cheats seguros e otimizados com suporte contínuo e atualizações frequentes.
            </p>
            <Link
              to="/produtos"
              className="mt-6 sm:mt-8 inline-flex items-center gap-2 bg-success px-8 sm:px-10 py-3 sm:py-3.5 text-sm font-bold uppercase tracking-[0.2em] text-success-foreground transition-all hover:shadow-[0_0_30px_hsl(197,100%,50%,0.4)] rounded-xl sm:rounded-none"
              style={{ fontFamily: "'Valorant', sans-serif" }}
            >
              Ver Produtos
              <ArrowRight className="h-5 w-5" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Destaque / Produtos Section */}
      <ProductsSection />

      {/* Contas Valorant Section */}
      <ContasSection />

      {/* Avaliações Section */}
      <section className="border-t border-border bg-background px-4 sm:px-6 py-12 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={slideInLeft}>
            <p className="text-sm font-medium uppercase tracking-[0.3em] text-success">
              Feedback
            </p>
            <h2
              className="mt-2 sm:mt-3 text-2xl sm:text-5xl font-bold tracking-tight text-foreground md:text-7xl"
              style={{ fontFamily: "'Valorant', sans-serif" }}
            >
              AVALIACOES
            </h2>
          </motion.div>

          {/* Mobile: horizontal scroll carousel / Desktop: grid */}
          <div className="mt-8 sm:mt-14 sm:hidden">
            <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-4 -mx-4 px-4 snap-x snap-mandatory">
              {[
                { name: "lucas", text: "mano melhor loja que ja comprei, entrega na hora e suporte responde rapido demais. recomendo", rating: 5 },
                { name: "breno", text: "conta veio certinha com todas as skin, ja e minha terceira compra aqui e nunca deu problema", rating: 5 },
                { name: "rafael", text: "tava com medo de ser scam mas entregaram tudo certinho, suporte me ajudou em tudo. confia!", rating: 5 },
                { name: "kaua", text: "inject cs ta rodando liso demais, sem ban nenhum. atualizaram rapido depois do update da valve", rating: 5 },
                { name: "gabriel", text: "comprei a conta e recebi na hora pelo discord, preco justo e qualidade braba", rating: 5 },
                { name: "enzo", text: "ja uso o inject faz 3 meses e zero problema. suporte respondeu em 5 min quando precisei, mt bom", rating: 5 },
              ].map((review, idx) => (
                <div
                  key={idx}
                  className="flex flex-col justify-between rounded-xl border border-border bg-card p-5 min-w-[280px] max-w-[300px] shrink-0 snap-center"
                >
                  <div>
                    <div className="flex gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`h-4 w-4 ${i < review.rating ? "fill-success text-success" : "text-muted-foreground/30"}`} />
                      ))}
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{review.text}</p>
                  </div>
                  <div className="mt-4 flex items-center gap-3 border-t border-border pt-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success/20 text-xs font-bold text-success">
                      {review.name.charAt(0)}
                    </div>
                    <p className="text-sm font-semibold text-foreground">{review.name}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-center mt-3">
              <Link to="/avaliacoes" className="text-sm font-medium text-success">Ver todas avaliações →</Link>
            </div>
          </div>

          {/* Desktop grid */}
          <motion.div
            className="mt-14 hidden sm:grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-40px" }}
            variants={staggerContainer}
          >
            {[
              { name: "lucas", text: "mano melhor loja que ja comprei, entrega na hora e suporte responde rapido demais. recomendo", rating: 5 },
              { name: "breno", text: "conta veio certinha com todas as skin, ja e minha terceira compra aqui e nunca deu problema", rating: 5 },
              { name: "rafael", text: "tava com medo de ser scam mas entregaram tudo certinho, suporte me ajudou em tudo. confia!", rating: 5 },
              { name: "kaua", text: "inject cs ta rodando liso demais, sem ban nenhum. atualizaram rapido depois do update da valve", rating: 5 },
              { name: "gabriel", text: "comprei a conta e recebi na hora pelo discord, preco justo e qualidade braba", rating: 5 },
              { name: "enzo", text: "ja uso o inject faz 3 meses e zero problema. suporte respondeu em 5 min quando precisei, mt bom", rating: 5 },
              { name: "thiago", text: "mlk melhor cheat de cs2 do mercado, roda suave e indetectavel. virei cliente fiel da royal!", rating: 5 },
              { name: "davi", text: "comprei pra testar e fiquei impressionado, aimbot muito smooth ninguem percebe kkkkk", rating: 4 },
              { name: "juliana", text: "ja sou cliente faz tempo, nunca tive problema. confianca total nessa loja", rating: 5 },
              { name: "felipe", text: "tomei hwid ban no valorant e o spoofer resolveu na hora, voltei a jogar no msm dia sem stress", rating: 5 },
              { name: "vinicius", text: "spoofer top demais, funciona em qualquer anti-cheat. ja usei no cs2 e val, nunca falhou", rating: 5 },
              { name: "amanda", text: "pensei q ia ter q trocar de pc dps do ban mas o spoofer salvou minha vida. recomendo 100%!", rating: 5 },
            ].map((review, idx) => (
              <motion.div
                key={idx}
                variants={fadeUp}
                custom={idx}
                className="flex flex-col justify-between rounded-lg border border-border bg-card p-6 transition-all hover:border-success/40 hover:shadow-[0_0_20px_hsl(197,100%,50%,0.1)]"
              >
                <div>
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${i < review.rating ? "fill-success text-success" : "text-muted-foreground/30"}`}
                      />
                    ))}
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                    {review.text}
                  </p>
                </div>
                <div className="mt-5 flex items-center gap-3 border-t border-border pt-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-success/20 text-sm font-bold text-success">
                    {review.name.charAt(0)}
                  </div>
                  <p className="text-sm font-semibold text-foreground">{review.name}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Como Funciona Section */}
      <section className="border-t border-border bg-background px-4 sm:px-6 py-12 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={slideInLeft}>
            <p className="text-sm font-medium uppercase tracking-[0.3em] text-success">
              Passo a Passo
            </p>
            <h2
              className="mt-2 sm:mt-3 text-2xl sm:text-5xl font-bold tracking-tight text-foreground md:text-7xl"
              style={{ fontFamily: "'Valorant', sans-serif" }}
            >
              COMO FUNCIONA
            </h2>
          </motion.div>

          <motion.div
            className="mt-8 sm:mt-14 grid grid-cols-2 gap-3 sm:gap-8 md:grid-cols-2 lg:grid-cols-4"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-40px" }}
            variants={staggerContainer}
          >
            {[
              { step: "01", title: "Escolha", desc: "Selecione o produto desejado." },
              { step: "02", title: "Pague", desc: "PIX, cartão ou cripto." },
              { step: "03", title: "Receba", desc: "Entrega instantânea automática." },
              { step: "04", title: "Jogue", desc: "Configure e domine o jogo." },
            ].map((item, idx) => (
              <motion.div
                key={idx}
                variants={fadeUp}
                custom={idx}
                className="group relative rounded-xl sm:rounded-lg border border-border bg-card p-4 sm:p-6 transition-all hover:border-success/40 hover:shadow-[0_0_20px_hsl(197,100%,50%,0.1)]"
              >
                <span
                  className="text-2xl sm:text-4xl font-bold text-success/20 transition-colors group-hover:text-success/40"
                  style={{ fontFamily: "'Valorant', sans-serif" }}
                >
                  {item.step}
                </span>
                <h3 className="mt-2 sm:mt-3 text-sm sm:text-lg font-bold text-foreground">{item.title}</h3>
                <p className="mt-1 sm:mt-2 text-xs sm:text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA Final Section */}
      <section className="border-t border-border bg-background px-4 sm:px-6 py-14 sm:py-32">
        <motion.div
          className="mx-auto max-w-3xl text-center"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={staggerContainer}
        >
          <motion.p variants={fadeUp} className="text-xs sm:text-sm font-medium uppercase tracking-[0.3em] text-muted-foreground">
            IAE? TA ESPERANDO OQUE?
          </motion.p>
          <motion.h2
            variants={fadeUp}
            custom={1}
            className="mt-4 sm:mt-6 text-2xl sm:text-5xl font-bold leading-tight tracking-tight text-foreground md:text-7xl"
            style={{ fontFamily: "'Valorant', sans-serif" }}
          >
            PROXIMO NIVEL
          </motion.h2>
          <motion.p variants={fadeUp} custom={2} className="mt-4 sm:mt-6 text-sm sm:text-base leading-relaxed text-muted-foreground px-4 sm:px-0">
            Junte-se a centenas de jogadores que já garantiram a deles com total segurança.
          </motion.p>
          <motion.div variants={fadeUp} custom={3} className="mt-8 sm:mt-10 flex flex-col sm:flex-row justify-center gap-3 px-4 sm:px-0">
            <Link
              to="/produtos"
              className="flex items-center justify-center gap-2 bg-success px-10 py-4 text-sm font-bold uppercase tracking-[0.2em] text-success-foreground rounded-xl sm:rounded-none shadow-[0_0_20px_hsl(197,100%,50%,0.25)] sm:shadow-none"
              style={{ fontFamily: "'Valorant', sans-serif" }}
            >
              Ver Produtos
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              to="/contas"
              className="flex items-center justify-center gap-2 border-2 border-foreground/30 px-10 py-4 text-sm font-bold uppercase tracking-[0.25em] text-foreground transition-all hover:border-success hover:text-success rounded-xl sm:rounded-none"
              style={{ fontFamily: "'Valorant', sans-serif" }}
            >
              Explorar Contas
              <ArrowRight className="h-5 w-5" />
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="border-t border-border bg-background px-4 sm:px-6 py-12 sm:py-24">
        <div className="mx-auto max-w-3xl">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={slideInLeft}
            className="text-center"
          >
            <p className="text-sm font-medium uppercase tracking-[0.3em] text-success">
              Dúvidas Frequentes
            </p>
            <h2
              className="mt-2 sm:mt-3 text-2xl sm:text-5xl font-bold tracking-tight text-foreground md:text-7xl"
              style={{ fontFamily: "'Valorant', sans-serif" }}
            >
              FAQ
            </h2>
          </motion.div>

          <motion.div
            className="mt-8 sm:mt-14 space-y-3 sm:space-y-4"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            variants={staggerContainer}
          >
            {[
              {
                q: "Como funciona a entrega dos produtos?",
                a: "Após a confirmação do pagamento, a entrega é feita de forma instantânea. Você receberá os dados de acesso diretamente no seu e-mail e também poderá acessá-los pelo painel da sua conta.",
              },
              {
                q: "Os softwares são seguros e indetectáveis?",
                a: "Sim! Nossos softwares utilizam tecnologia de ponta com atualizações constantes para garantir total segurança. Trabalhamos com sistemas anti-detecção avançados que são atualizados diariamente.",
              },
              {
                q: "Quais formas de pagamento são aceitas?",
                a: "Aceitamos PIX, cartão de crédito, boleto bancário e criptomoedas. O PIX é processado instantaneamente, enquanto outras formas podem levar até 24 horas para confirmação.",
              },
              {
                q: "As contas Valorant possuem garantia?",
                a: "Sim! Todas as contas possuem garantia de 7 dias. Caso ocorra qualquer problema com a conta adquirida dentro desse período, realizamos a troca ou reembolso integral.",
              },
              {
                q: "Como entro em contato com o suporte?",
                a: "Nosso suporte está disponível 24/7 pelo Discord. Basta entrar no nosso servidor e abrir um ticket. O tempo médio de resposta é de até 15 minutos.",
              },
              {
                q: "Posso usar os produtos em qualquer região?",
                a: "Sim, nossos softwares funcionam em todas as regiões. As contas Valorant são específicas por região (BR, NA, EU), e você pode escolher a região desejada na hora da compra.",
              },
            ].map((item, idx) => (
              <FaqItem key={idx} question={item.q} answer={item.a} index={idx} />
            ))}
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <motion.footer
        className="border-t border-border bg-background px-4 sm:px-6 py-10 sm:py-16 pb-24 sm:pb-16"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
      >
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-2 gap-8 sm:gap-12 md:grid-cols-4">
            <div className="col-span-2 sm:col-span-1 md:col-span-1">
              <h3
                className="text-xl sm:text-2xl font-bold text-foreground"
                style={{ fontFamily: "'Valorant', sans-serif" }}
              >
                <span className="text-success">ROYAL</span> STORE
              </h3>
              <p className="mt-3 text-xs sm:text-sm leading-relaxed text-muted-foreground">
                Referência no mercado há mais de 5 anos. Softwares premium, contas verificadas e suporte 24/7.
              </p>
              <div className="mt-4 flex gap-3">
                <a href="https://discord.gg/royalstorebr" target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-success hover:text-success">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M13.545 2.907a13.2 13.2 0 0 0-3.257-1.011.05.05 0 0 0-.052.025c-.141.25-.297.577-.406.833a12.2 12.2 0 0 0-3.658 0 8 8 0 0 0-.412-.833.05.05 0 0 0-.052-.025c-1.125.194-2.22.534-3.257 1.011a.04.04 0 0 0-.021.018C.356 6.024-.213 9.047.066 12.032q.003.022.021.037a13.3 13.3 0 0 0 3.995 2.02.05.05 0 0 0 .056-.019q.463-.63.818-1.329a.05.05 0 0 0-.01-.059l-.018-.011a9 9 0 0 1-1.248-.595.05.05 0 0 1-.02-.066l.015-.019q.127-.095.248-.195a.05.05 0 0 1 .051-.007c2.619 1.196 5.454 1.196 8.041 0a.05.05 0 0 1 .053.007q.121.1.248.195a.05.05 0 0 1-.004.085 8 8 0 0 1-1.249.594.05.05 0 0 0-.03.03.05.05 0 0 0 .003.041c.24.465.515.909.817 1.329a.05.05 0 0 0 .056.019 13.2 13.2 0 0 0 4.001-2.02.05.05 0 0 0 .021-.037c.334-3.451-.559-6.449-2.366-9.106a.03.03 0 0 0-.02-.019"/>
                  </svg>
                </a>
                <a href="https://www.instagram.com/royalstorebr.ofc/" target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-success hover:text-success">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M8 0C5.829 0 5.556.01 4.703.048 3.85.088 3.269.222 2.76.42a3.9 3.9 0 0 0-1.417.923A3.9 3.9 0 0 0 .42 2.76C.222 3.268.087 3.85.048 4.7.01 5.555 0 5.827 0 8.001c0 2.172.01 2.444.048 3.297.04.852.174 1.433.372 1.942.205.526.478.972.923 1.417.444.445.89.719 1.416.923.51.198 1.09.333 1.942.372C5.555 15.99 5.827 16 8 16s2.444-.01 3.298-.048c.851-.04 1.434-.174 1.943-.372a3.9 3.9 0 0 0 1.416-.923c.445-.445.718-.891.923-1.417.197-.509.332-1.09.372-1.942C15.99 10.445 16 10.173 16 8s-.01-2.445-.048-3.299c-.04-.851-.175-1.433-.372-1.941a3.9 3.9 0 0 0-.923-1.417A3.9 3.9 0 0 0 13.24.42c-.51-.198-1.092-.333-1.943-.372C10.443.01 10.172 0 7.998 0ZM8 1.442c2.136 0 2.389.007 3.232.046.78.035 1.204.166 1.486.275.373.145.64.319.92.599s.453.546.598.92c.11.281.24.705.275 1.485.039.843.047 1.096.047 3.231s-.008 2.389-.047 3.232c-.035.78-.166 1.203-.275 1.485a2.5 2.5 0 0 1-.599.919c-.28.28-.546.453-.92.598-.28.11-.704.24-1.485.276-.843.038-1.096.047-3.232.047s-2.39-.009-3.233-.047c-.78-.036-1.203-.166-1.485-.276a2.5 2.5 0 0 1-.92-.598 2.5 2.5 0 0 1-.6-.92c-.109-.281-.24-.705-.275-1.485-.038-.843-.046-1.096-.046-3.233s.008-2.388.046-3.231c.036-.78.166-1.204.276-1.486.145-.373.319-.64.599-.92s.546-.453.92-.598c.282-.11.705-.24 1.485-.276.738-.034 1.024-.044 2.515-.045zm0 2.452a4.108 4.108 0 1 0 0 8.215 4.108 4.108 0 0 0 0-8.215Zm0 6.775a2.667 2.667 0 1 1 0-5.334 2.667 2.667 0 0 1 0 5.334Zm5.23-6.937a.96.96 0 1 1-1.92 0 .96.96 0 0 1 1.92 0Z"/>
                  </svg>
                </a>
                <a className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-success hover:text-success cursor-default">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M8.051 1.999h.089c.822.003 4.987.033 6.11.335a2.01 2.01 0 0 1 1.415 1.42c.101.38.172.883.22 1.402l.01.104.022.26.008.104c.065.914.073 1.77.074 1.957v.075c-.001.194-.01 1.108-.082 2.06l-.008.105-.009.104c-.05.572-.124 1.14-.235 1.558a2.01 2.01 0 0 1-1.415 1.42c-1.16.312-5.569.334-6.18.335h-.142c-.309 0-1.587-.006-2.927-.052l-.17-.006-.087-.004-.171-.007-.171-.007c-1.11-.049-2.167-.128-2.654-.26a2.01 2.01 0 0 1-1.415-1.419c-.111-.417-.185-.986-.235-1.558L.09 9.82l-.008-.104A31 31 0 0 1 0 7.68v-.123c.002-.215.01-.958.064-1.778l.007-.103.003-.052.008-.104.022-.26.01-.104c.048-.519.119-1.023.22-1.402a2.01 2.01 0 0 1 1.415-1.42c.487-.13 1.544-.21 2.654-.26l.17-.007.172-.006.086-.003.171-.007A100 100 0 0 1 7.858 2zM6.4 5.209v4.818l4.157-2.408z"/>
                  </svg>
                </a>
              </div>
            </div>

            <div>
              <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-foreground">Produtos</h4>
              <ul className="mt-3 sm:mt-4 space-y-2">
                <li><a href="/produtos" className="text-xs sm:text-sm text-muted-foreground transition-colors hover:text-success">Softwares</a></li>
                <li><a href="/contas" className="text-xs sm:text-sm text-muted-foreground transition-colors hover:text-success">Contas Valorant</a></li>
                <li><a href="/produtos" className="text-xs sm:text-sm text-muted-foreground transition-colors hover:text-success">Skins Premium</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-foreground">Suporte</h4>
              <ul className="mt-3 sm:mt-4 space-y-2">
                <li><a href="/ajuda" className="text-xs sm:text-sm text-muted-foreground transition-colors hover:text-success">Central de Ajuda</a></li>
                <li><a href="https://discord.gg/royalstorebr" target="_blank" rel="noopener noreferrer" className="text-xs sm:text-sm text-muted-foreground transition-colors hover:text-success">Discord</a></li>
                <li><a href="/garantia" className="text-xs sm:text-sm text-muted-foreground transition-colors hover:text-success">Garantia</a></li>
                <li><a href="/status" className="text-xs sm:text-sm text-muted-foreground transition-colors hover:text-success">Status</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-foreground">Legal</h4>
              <ul className="mt-3 sm:mt-4 space-y-2">
                <li><a href="/termos" className="text-xs sm:text-sm text-muted-foreground transition-colors hover:text-success">Termos de Uso</a></li>
                <li><a href="/privacidade" className="text-xs sm:text-sm text-muted-foreground transition-colors hover:text-success">Privacidade</a></li>
                <li><a href="/reembolso" className="text-xs sm:text-sm text-muted-foreground transition-colors hover:text-success">Reembolso</a></li>
              </ul>
            </div>
          </div>

          <div className="mt-10 sm:mt-14 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 sm:pt-8 md:flex-row">
            <p className="text-[10px] sm:text-xs text-muted-foreground">
              © 2026 Royal Store. Todos os direitos reservados.
            </p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">
              Feito com 💖 para gamers
            </p>
          </div>
        </div>
      </motion.footer>

      {/* Floating widgets */}
      <FloatingWidgets />

      {/* Sticky mobile CTA bar */}
      <StickyMobileCTA />
    </div>
  );
};

export default Index;
