import React, { useMemo, useState, useRef, useCallback } from "react";
import type { ReactNode, MouseEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

// Game card images (accounts)
import valorantCardImg from "@/assets/games/valorant-card.webp";
import fortniteCardImg from "@/assets/games/fortnite-card.webp";
import lolCardImg from "@/assets/games/lol-card.webp";
import minecraftCardImg from "@/assets/games/minecraft-card.webp";

// Software game images (fallbacks)
import swValorant from "@/assets/games/sw-valorant.webp";
import swFortnite from "@/assets/games/sw-fortnite.webp";
import swCs2 from "@/assets/games/sw-cs2.webp";
import swApex from "@/assets/games/sw-apex.webp";
import swCod from "@/assets/games/sw-cod.webp";
import swRust from "@/assets/games/sw-rust.webp";
import swOverwatch from "@/assets/games/sw-overwatch2.webp";
import swFivem from "@/assets/games/sw-fivem.webp";
import swPubg from "@/assets/games/sw-pubg.webp";
import swMarvelRivals from "@/assets/games/sw-marvel-rivals.webp";
import swDayz from "@/assets/games/sw-dayz.webp";
import swSquad from "@/assets/games/sw-squad.webp";

// Character overlay images — backgrounds
import bgCardCod from "@/assets/games/bg-card-cod.webp";
import bgCardPubg from "@/assets/games/bg-card-pubg.webp";
import bgCardFortnite from "@/assets/games/bg-card-fortnite-v2.webp";
import bgCardValorant from "@/assets/games/bg-card-valorant.webp";
import bgCardCs2 from "@/assets/games/bg-card-cs2.webp";
import bgCardRust from "@/assets/games/bg-card-rust.webp";
import bgCardDayz from "@/assets/games/bg-card-dayz.webp";
import bgCardFivem from "@/assets/games/bg-card-fivem.webp";
import bgCardRivals from "@/assets/games/bg-card-rivals.webp";
import bgCardBloodstrike from "@/assets/games/bg-card-bloodstrike.webp";
import bgCardApex from "@/assets/games/bg-card-apex.webp";
import bgCardArcraiders from "@/assets/games/bg-card-arcraiders.webp";
import bgCardArenabreakout from "@/assets/games/bg-card-arenabreakout.webp";
import bgCardOverwatch2 from "@/assets/games/bg-card-overwatch2.webp";
import bgCardSquad from "@/assets/games/bg-card-squad.webp";
import bgCardDbd from "@/assets/games/bg-card-dbd.webp";
import bgCardFarlight84 from "@/assets/games/bg-card-farlight84.webp";
import bgCardHellletloose from "@/assets/games/bg-card-hellletloose.webp";

// Character overlay images — normal + hover
import codNormal from "@/assets/games/cod-normal.webp";
import codHover from "@/assets/games/cod-hover.webp";
import pubgNormal from "@/assets/games/pubg-normal.webp";
import pubgHover from "@/assets/games/pubg-hover.webp";
import fortniteNormal from "@/assets/games/fortnite-normal.webp";
import fortniteHover from "@/assets/games/fortnite-hover.webp";
import valorantNormal from "@/assets/games/valorant-normal.webp";
import valorantHover from "@/assets/games/valorant-hover.webp";
import cs2Normal from "@/assets/games/cs2-normal.webp";
import cs2Hover from "@/assets/games/cs2-hover.webp";
import rustNormal from "@/assets/games/rust-normal.webp";
import rustHover from "@/assets/games/rust-hover.webp";
import dayzNormal from "@/assets/games/dayz-normal.webp";
import dayzHover from "@/assets/games/dayz-hover.webp";
import fivemNormal from "@/assets/games/fivem-normal.webp";
import fivemHover from "@/assets/games/fivem-hover.webp";
import rivalsNormal from "@/assets/games/rivals-normal.webp";
import rivalsHover from "@/assets/games/rivals-hover.webp";
import bloodstrikeNormal from "@/assets/games/bloodstrike-normal.webp";
import bloodstrikeHover from "@/assets/games/bloodstrike-hover.webp";
import apexNormal from "@/assets/games/apex-normal.webp";
import apexHover from "@/assets/games/apex-hover.webp";
import arcraidersNormal from "@/assets/games/arcraiders-normal.webp";
import arcraidersHover from "@/assets/games/arcraiders-hover.webp";
import arenabreakoutNormal from "@/assets/games/arenabreakout-normal.webp";
import arenabreakoutHover from "@/assets/games/arenabreakout-hover.webp";
import overwatch2Normal from "@/assets/games/overwatch2-normal.webp";
import overwatch2Hover from "@/assets/games/overwatch2-hover.webp";
import squadNormal from "@/assets/games/squad-normal.webp";
import squadHover from "@/assets/games/squad-hover.webp";
import dbdNormal from "@/assets/games/dbd-normal.webp";
import dbdHover from "@/assets/games/dbd-hover.webp";
import farlight84Normal from "@/assets/games/farlight84-normal.webp";
import farlight84Hover from "@/assets/games/farlight84-hover.webp";
import hellletlooseNormal from "@/assets/games/hellletloose-normal.webp";
import hellletlooseHover from "@/assets/games/hellletloose-hover.webp";

// Local images map for software game cards (fallbacks when no character overlay)
const softwareImageMap: Record<string, string> = {
  valorant: swValorant,
  fortnite: swFortnite,
  "cs2": swCs2,
  "counter-strike 2": swCs2,
  "counter-strike-2": swCs2,
  "counter strike 2": swCs2,
  "apex legends": swApex,
  "apex": swApex,
  "call of duty": swCod,
  "call-of-duty": swCod,
  "cod": swCod,
  rust: swRust,
  "overwatch 2": swOverwatch,
  overwatch: swOverwatch,
  fivem: swFivem,
  pubg: swPubg,
  "marvel rivals": swMarvelRivals,
  dayz: swDayz,
  squad: swSquad,
};

// Character overlay data — bg, character, characterHover per game slug
const characterOverlayMap: Record<string, { bg: string; character: string; characterHover: string }> = {
  "call of duty": { bg: bgCardCod, character: codNormal, characterHover: codHover },
  "call-of-duty": { bg: bgCardCod, character: codNormal, characterHover: codHover },
  cod: { bg: bgCardCod, character: codNormal, characterHover: codHover },
  pubg: { bg: bgCardPubg, character: pubgNormal, characterHover: pubgHover },
  fortnite: { bg: bgCardFortnite, character: fortniteNormal, characterHover: fortniteHover },
  valorant: { bg: bgCardValorant, character: valorantNormal, characterHover: valorantHover },
  cs2: { bg: bgCardCs2, character: cs2Normal, characterHover: cs2Hover },
  "counter-strike 2": { bg: bgCardCs2, character: cs2Normal, characterHover: cs2Hover },
  "counter-strike-2": { bg: bgCardCs2, character: cs2Normal, characterHover: cs2Hover },
  rust: { bg: bgCardRust, character: rustNormal, characterHover: rustHover },
  dayz: { bg: bgCardDayz, character: dayzNormal, characterHover: dayzHover },
  fivem: { bg: bgCardFivem, character: fivemNormal, characterHover: fivemHover },
  "marvel rivals": { bg: bgCardRivals, character: rivalsNormal, characterHover: rivalsHover },
  bloodstrike: { bg: bgCardBloodstrike, character: bloodstrikeNormal, characterHover: bloodstrikeHover },
  "apex legends": { bg: bgCardApex, character: apexNormal, characterHover: apexHover },
  apex: { bg: bgCardApex, character: apexNormal, characterHover: apexHover },
  "arc raiders": { bg: bgCardArcraiders, character: arcraidersNormal, characterHover: arcraidersHover },
  "arena breakout": { bg: bgCardArenabreakout, character: arenabreakoutNormal, characterHover: arenabreakoutHover },
  "arena breakout infinite": { bg: bgCardArenabreakout, character: arenabreakoutNormal, characterHover: arenabreakoutHover },
  "overwatch 2": { bg: bgCardOverwatch2, character: overwatch2Normal, characterHover: overwatch2Hover },
  overwatch: { bg: bgCardOverwatch2, character: overwatch2Normal, characterHover: overwatch2Hover },
  squad: { bg: bgCardSquad, character: squadNormal, characterHover: squadHover },
  "dead by daylight": { bg: bgCardDbd, character: dbdNormal, characterHover: dbdHover },
  dbd: { bg: bgCardDbd, character: dbdNormal, characterHover: dbdHover },
  "farlight 84": { bg: bgCardFarlight84, character: farlight84Normal, characterHover: farlight84Hover },
  farlight84: { bg: bgCardFarlight84, character: farlight84Normal, characterHover: farlight84Hover },
  "hell let loose": { bg: bgCardHellletloose, character: hellletlooseNormal, characterHover: hellletlooseHover },
};

// Gradient fallbacks for games without images
const GAME_GRADIENTS: Record<string, string> = {
  "Valorant": "from-destructive/40 to-card",
  "Fortnite": "from-accent/40 to-card",
  "CS2": "from-muted/60 to-card",
  "Call of Duty": "from-success/30 to-card",
  "PUBG": "from-muted/50 to-card",
  "Rust": "from-destructive/30 to-card",
  "DayZ": "from-success/20 to-card",
  "FiveM": "from-primary/30 to-card",
  "Marvel Rivals": "from-destructive/35 to-card",
  "Apex Legends": "from-destructive/30 to-card",
  "Spoofer": "from-accent/30 to-card",
};

// Slugs to hide from the landing page software showcase
const HIDDEN_GAME_SLUGS = ["spoofers", "spoofer"];

// Descrições curtas na landing (i18n `products.desc_*` em geral não existe — evita mostrar a chave crua)
const LANDING_SOFTWARE_BLURB: Record<string, string> = {
  valorant: "Cheats premium para Valorant — domine cada round",
  fortnite: "Softwares indetectáveis para Fortnite",
  cs2: "Hacks indetectados para CS2",
  "counter-strike 2": "Hacks indetectados para CS2",
  "counter-strike-2": "Hacks indetectados para CS2",
  cod: "Cheats para Call of Duty — Warzone & MP",
  "call of duty": "Cheats para Call of Duty — Warzone & MP",
  "call-of-duty": "Cheats para Call of Duty — Warzone & MP",
  pubg: "Softwares para PUBG — domine o battleground",
  rust: "Hacks indetectados para Rust",
  dayz: "Sobreviva com vantagem no DayZ",
  fivem: "Mods e menus para FiveM / GTA RP",
  "marvel rivals": "Domine as batalhas em Marvel Rivals",
  "apex legends": "Cheats premium para Apex Legends",
  apex: "Cheats premium para Apex Legends",
  overwatch: "Cheats para Overwatch 2",
  "overwatch 2": "Cheats para Overwatch 2",
  squad: "Softwares táticos para Squad",
};

interface GameFromDB {
  id: string;
  name: string;
  slug: string | null;
  image_url: string | null;
  sort_order: number | null;
  active: boolean | null;
  products: { id: string; active: boolean | null }[];
}

type LandingGameQueryRow = {
  id: string;
  name: string;
  slug: string | null;
  image_url: string | null;
  sort_order: number | null;
  active: boolean | null;
  products: { id: string | null; active: boolean | null }[] | null;
};

function toLandingGameFromRow(g: LandingGameQueryRow): GameFromDB {
  return {
    id: g.id,
    name: g.name,
    slug: g.slug,
    image_url: g.image_url,
    sort_order: g.sort_order,
    active: g.active,
    products: (g.products ?? []).filter((p): p is { id: string; active: boolean | null } => p.id != null).map((p) => ({ id: p.id, active: p.active })),
  };
}

// ─── Game Categories for Accounts ───────────────────────────────────────────
const GAME_CATEGORIES = [
  { name: "VALORANT", image: valorantCardImg, tab: "valorant", tagline: "Contas rankeadas e full acesso", badge: "Popular" },
  { name: "FORTNITE", image: fortniteCardImg, tab: "fortnite", tagline: "Skins raras e V-Bucks inclusos", badge: "Novo" },
  { name: "LOL", image: lolCardImg, tab: "lol", tagline: "Campeões, skins e ranks", badge: null },
  { name: "MINECRAFT", image: minecraftCardImg, tab: "minecraft", tagline: "Java & Bedrock Edition", badge: null },
];

// ─── Shared Section Header ──────────────────────────────────────────────────
const SectionHeader = ({ subtitle, title }: { subtitle: string; title: string }) => (
  <div className="text-center sm:text-left">
    <p className="text-[10px] sm:text-sm font-medium uppercase tracking-[0.3em] text-success">{subtitle}</p>
    <h2 className="mt-1.5 sm:mt-3 text-xl sm:text-4xl font-bold tracking-tight text-foreground md:text-6xl" style={{ fontFamily: "'Valorant', sans-serif" }}>
      {title}
    </h2>
  </div>
);

// ─── Accounts Section ───────────────────────────────────────────────────────
const ContasSection = React.forwardRef<HTMLElement>(function ContasSection(_props, ref) {
  const { t } = useTranslation();

  return (
    <section ref={ref} className="border-t border-border bg-background px-4 sm:px-6 py-12 sm:py-20">
      <div className="mx-auto max-w-7xl">
        <SectionHeader subtitle={t("accounts.subtitle")} title={t("accounts.title")} />

        <div className="mt-5 sm:mt-12 grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
          {GAME_CATEGORIES.map((game) => (
            <Link
              key={game.tab}
              to={`/contas?game=${game.tab}`}
              className="group relative touch-manipulation overflow-hidden rounded-xl border border-border/40 bg-card transition-all duration-300 hover:border-success/40 hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)]"
            >
              <div className="relative aspect-[3/4] overflow-hidden">
                <img src={game.image} alt={game.name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy" decoding="async" />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />

                {game.badge && (
                  <div className="absolute top-2 right-2 sm:top-3 sm:right-3 rounded-full bg-success px-2 sm:px-2.5 py-0.5 text-[7px] sm:text-[10px] font-bold uppercase tracking-wider text-success-foreground shadow-lg shadow-success/20">
                    {game.badge}
                  </div>
                )}

                <div className="absolute inset-x-0 bottom-0 p-3 sm:p-5">
                  <h3 className="text-sm sm:text-xl lg:text-2xl font-bold tracking-tight text-foreground" style={{ fontFamily: "'Valorant', sans-serif" }}>
                    {game.name}
                  </h3>
                  <p className="mt-0.5 text-[8px] sm:text-[11px] text-muted-foreground leading-tight line-clamp-1">{game.tagline}</p>
                  <div className="mt-2 sm:mt-3 flex items-center gap-1 text-success text-[8px] sm:text-[11px] font-semibold uppercase tracking-wider group-hover:gap-2 transition-all">
                    <span>{t("accounts.exploreAccounts")}</span>
                    <ArrowRight className="h-2.5 w-2.5 sm:h-3 sm:w-3 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-6 sm:mt-10 flex justify-center">
          <Link
            to="/contas"
            className="touch-manipulation flex w-full sm:w-auto items-center justify-center gap-2 bg-foreground px-6 sm:px-12 py-2.5 sm:py-3.5 text-[10px] sm:text-sm font-bold uppercase tracking-[0.2em] text-background transition-all hover:opacity-90 rounded-xl shadow-[0_4px_16px_rgba(255,255,255,0.1)]"
            style={{ fontFamily: "'Valorant', sans-serif" }}
          >
            {t("accounts.exploreAccounts")}
            <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
});
ContasSection.displayName = "ContasSection";

// ─── TiltCard (3D tilt on hover — disabled on touch devices) ────────────────
const TiltCard = React.forwardRef<HTMLDivElement, { children: ReactNode }>(({ children }, ref) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const isTouchDevice = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

  const handleMouseMove = useCallback((e: MouseEvent<HTMLDivElement>) => {
    if (isTouchDevice) return;
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = centerY > 0 ? ((y - centerY) / centerY) * -8 : 0;
    const rotateY = centerX > 0 ? ((x - centerX) / centerX) * 8 : 0;
    card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02,1.02,1.02)`;
  }, [isTouchDevice]);

  const handleMouseLeave = useCallback(() => {
    const card = cardRef.current;
    if (card) card.style.transform = "";
  }, []);

  return (
    <div
      ref={(node) => {
        (cardRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }}
      onMouseMove={isTouchDevice ? undefined : handleMouseMove}
      onMouseLeave={isTouchDevice ? undefined : handleMouseLeave}
      style={{ transition: "transform 0.15s ease-out", willChange: isTouchDevice ? "auto" : "transform" }}
    >
      {children}
    </div>
  );
});
TiltCard.displayName = "TiltCard";

// ─── GameCard (exact user-provided component) ───────────────────────────────
interface GameCardGame {
  name: string;
  keywords: string[];
  image: string | null;
  descKey: string;
  /** Texto quando a chave i18n `descKey` não existe */
  fallbackDesc: string;
  logo?: string;
  character?: string;
  characterHover?: string;
}

const GameCard = React.forwardRef<HTMLDivElement, { game: GameCardGame; count: number; t: TFunction }>(function GameCard({ game, count, t }, ref) {
  const hasProducts = count > 0;
  const [isHovered, setIsHovered] = useState(false);
  const characterPositionClass = "absolute bottom-0 right-0 w-[40%] sm:w-[50%]";

  return (
    <TiltCard>
      <Link
        to={
          game.keywords[0]
            ? `/produtos?game=${encodeURIComponent(game.keywords[0])}`
            : "/produtos"
        }
        className="group touch-manipulation relative block rounded-2xl border border-border/50 hover:border-success/40 transition-colors duration-200 sm:transition-all sm:duration-500 bg-card overflow-hidden sm:hover:shadow-[0_20px_50px_hsl(var(--foreground)/0.18)]"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Image / gradient background */}
        <div className="relative aspect-[4/3] sm:aspect-[16/11] overflow-hidden">
          {game.image ? (
            <img
              src={game.image}
              alt={game.name}
              loading="lazy"
              decoding="async"
              width={400}
              height={275}
              className="w-full h-full object-cover sm:transition-transform sm:duration-700 sm:group-hover:scale-110"
            />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${GAME_GRADIENTS[game.name] || "from-muted to-card"} flex items-center justify-center`}>
              <span className="text-3xl md:text-4xl font-bold text-foreground/20 uppercase tracking-widest select-none">
                {game.name}
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/5" />

          {/* Character normal */}
          {game.character && (
            <div
              className={`${characterPositionClass} pointer-events-none z-[8] sm:transition-opacity sm:duration-500 sm:ease-out`}
              style={{ opacity: isHovered ? 0 : 1 }}
            >
              <img src={game.character} alt="" loading="lazy" decoding="async" className="w-full h-auto object-contain" style={{ filter: "drop-shadow(0 10px 28px rgba(0,0,0,0.55))" }} />
            </div>
          )}

          {/* Character hover */}
          {game.characterHover && (
            <div
              className={`${characterPositionClass} pointer-events-none z-[9] sm:transition-all sm:duration-500 sm:ease-out`}
              style={{
                opacity: isHovered ? 1 : 0,
                transformOrigin: "bottom right",
                transform: isHovered ? "scale(1.08)" : "scale(0.95)",
              }}
            >
              <img src={game.characterHover} alt="" loading="lazy" decoding="async" className="w-full h-auto object-contain" style={{ filter: "drop-shadow(0 12px 32px rgba(0,0,0,0.6))" }} />
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 z-[12] p-3 sm:p-5">
            <h3
              className="text-xs sm:text-lg lg:text-xl font-bold tracking-tight text-foreground"
              style={{ fontFamily: "'Valorant', sans-serif", textShadow: '0 2px 8px rgba(0,0,0,0.8), 0 0 2px rgba(0,0,0,0.9)' }}
            >
              {game.name}
            </h3>
            <p
              className="mt-0.5 sm:mt-1 max-w-[90%] text-[9px] sm:text-xs leading-snug sm:leading-relaxed text-muted-foreground line-clamp-2"
              style={{ textShadow: '0 1px 4px rgba(0,0,0,0.7)' }}
            >
              {t(game.descKey, { defaultValue: game.fallbackDesc })}
            </p>
            <div className="mt-2 sm:mt-3 inline-flex items-center gap-1.5 sm:gap-2 text-[9px] sm:text-xs font-bold uppercase tracking-[0.15em] sm:tracking-[0.18em] text-success sm:transition-all sm:group-hover:gap-3">
              <span className="truncate max-w-[85%]">{t("games.viewSoftwares")}</span>
              <ArrowRight className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0 sm:transition-transform sm:group-hover:translate-x-1" />
            </div>
          </div>
        </div>
      </Link>
    </TiltCard>
  );
});
GameCard.displayName = "GameCard";

// ─── Software Section ───────────────────────────────────────────────────────
const SoftwareSection = React.forwardRef<HTMLElement>(function SoftwareSection(_props, ref) {
  const { t } = useTranslation();

  const { data: games = [], isLoading } = useQuery({
    queryKey: ["landing-games-software"],
    queryFn: async () => {
      const { data } = await supabase
        .from("games")
        .select("id, name, slug, image_url, sort_order, active, products:public_products(id, active)")
        .eq("active", true)
        .order("sort_order", { ascending: true });
      return (data ?? []).map(toLandingGameFromRow);
    },
    staleTime: 1000 * 60 * 5,
  });

  const activeGames = useMemo(
    () => games
      .filter(g => g.products?.some(p => p.active))
      .filter(g => {
        const slug = (g.slug || g.name || "").toLowerCase();
        return !HIDDEN_GAME_SLUGS.includes(slug);
      }),
    [games]
  );

  // Build GameCard-compatible data from DB games
  const gameCards = useMemo(() =>
    activeGames.slice(0, 8).map(game => {
      const slug = (game.slug || game.name || "").toLowerCase();
      const overlay = characterOverlayMap[slug];
      const image = overlay?.bg || softwareImageMap[slug] || game.image_url;
      const productCount = game.products?.filter(p => p.active).length || 0;

      const slugKey = slug.replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
      return {
        id: game.id,
        name: game.name,
        keywords: [game.slug || game.name].filter((s): s is string => Boolean(s)),
        image,
        descKey: `products.desc_${slugKey}`,
        fallbackDesc: LANDING_SOFTWARE_BLURB[slug] || `Softwares premium para ${game.name}`,
        character: overlay?.character,
        characterHover: overlay?.characterHover,
        count: productCount,
      };
    }),
    [activeGames]
  );

  return (
    <section ref={ref} className="border-t border-border bg-background px-4 sm:px-6 py-12 sm:py-20">
      <div className="mx-auto max-w-7xl">
        <SectionHeader subtitle={t("products.subtitle")} title={t("products.title")} />

        {isLoading ? (
          <div className="mt-10 flex justify-center"><Loader2 className="h-7 w-7 animate-spin text-success" /></div>
        ) : gameCards.length === 0 ? (
          <div className="mt-10 text-center text-muted-foreground text-sm">{t("products.empty")}</div>
        ) : (
          <div className="mt-5 sm:mt-12 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {gameCards.map((gc) => (
              <GameCard key={gc.id} game={gc} count={gc.count} t={t} />
            ))}
          </div>
        )}

        <div className="mt-6 sm:mt-10 flex justify-center">
          <Link
            to="/produtos"
            className="touch-manipulation flex w-full sm:w-auto items-center justify-center gap-2 bg-foreground/10 border border-foreground/15 px-6 sm:px-12 py-2.5 sm:py-3.5 text-[10px] sm:text-sm font-bold uppercase tracking-[0.2em] text-foreground transition-all hover:bg-foreground/15 rounded-xl"
            style={{ fontFamily: "'Valorant', sans-serif" }}
          >
            {t("products.viewAll")}
            <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
});
SoftwareSection.displayName = "SoftwareSection";

export default function IndexGameShowcase() {
  return (
    <>
      <ContasSection />
      <SoftwareSection />
    </>
  );
}
