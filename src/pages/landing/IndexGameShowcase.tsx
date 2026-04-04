import { useMemo, useState, useRef, useCallback } from "react";
import type { ReactNode, MouseEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
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
import bgCardCod from "@/assets/games/bg-card-cod.png";
import bgCardPubg from "@/assets/games/bg-card-pubg.png";
import bgCardFortnite from "@/assets/games/bg-card-fortnite-v2.png";
import bgCardValorant from "@/assets/games/bg-card-valorant.png";
import bgCardCs2 from "@/assets/games/bg-card-cs2.png";
import bgCardRust from "@/assets/games/bg-card-rust.png";
import bgCardDayz from "@/assets/games/bg-card-dayz.png";
import bgCardFivem from "@/assets/games/bg-card-fivem.png";
import bgCardRivals from "@/assets/games/bg-card-rivals.png";
import bgCardBloodstrike from "@/assets/games/bg-card-bloodstrike.png";
import bgCardApex from "@/assets/games/bg-card-apex.png";
import bgCardArcraiders from "@/assets/games/bg-card-arcraiders.png";
import bgCardArenabreakout from "@/assets/games/bg-card-arenabreakout.png";

// Character overlay images — normal + hover
import codNormal from "@/assets/games/cod-normal.png";
import codHover from "@/assets/games/cod-hover.png";
import pubgNormal from "@/assets/games/pubg-normal.png";
import pubgHover from "@/assets/games/pubg-hover.png";
import fortniteNormal from "@/assets/games/fortnite-normal.png";
import fortniteHover from "@/assets/games/fortnite-hover.png";
import valorantNormal from "@/assets/games/valorant-normal.png";
import valorantHover from "@/assets/games/valorant-hover.png";
import cs2Normal from "@/assets/games/cs2-normal.png";
import cs2Hover from "@/assets/games/cs2-hover.png";
import rustNormal from "@/assets/games/rust-normal.png";
import rustHover from "@/assets/games/rust-hover.png";
import dayzNormal from "@/assets/games/dayz-normal.png";
import dayzHover from "@/assets/games/dayz-hover.png";
import fivemNormal from "@/assets/games/fivem-normal.png";
import fivemHover from "@/assets/games/fivem-hover.png";
import rivalsNormal from "@/assets/games/rivals-normal.png";
import rivalsHover from "@/assets/games/rivals-hover.png";
import bloodstrikeNormal from "@/assets/games/bloodstrike-normal.png";
import bloodstrikeHover from "@/assets/games/bloodstrike-hover.png";
import apexNormal from "@/assets/games/apex-normal.png";
import apexHover from "@/assets/games/apex-hover.png";
import arcraidersNormal from "@/assets/games/arcraiders-normal.png";
import arcraidersHover from "@/assets/games/arcraiders-hover.png";
import arenabreakoutNormal from "@/assets/games/arenabreakout-normal.png";
import arenabreakoutHover from "@/assets/games/arenabreakout-hover.png";

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
};

// Gradient fallbacks for games without images
const GAME_GRADIENTS: Record<string, string> = {
  "Valorant": "from-rose-900/60 to-card",
  "Fortnite": "from-violet-900/60 to-card",
  "CS2": "from-amber-900/60 to-card",
  "Call of Duty": "from-emerald-900/60 to-card",
  "PUBG": "from-yellow-900/60 to-card",
  "Rust": "from-orange-900/60 to-card",
  "DayZ": "from-green-900/60 to-card",
  "FiveM": "from-blue-900/60 to-card",
  "Marvel Rivals": "from-red-900/60 to-card",
  "Apex Legends": "from-red-800/60 to-card",
  "Spoofer": "from-purple-900/60 to-card",
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

type LandingGameQueryRow = Tables<"games"> & {
  products: Pick<Tables<"public_products">, "id" | "active">[] | null;
};

function toLandingGameFromRow(g: LandingGameQueryRow): GameFromDB {
  return {
    id: g.id,
    name: g.name,
    slug: g.slug,
    image_url: g.image_url,
    sort_order: g.sort_order,
    active: g.active,
    products: (g.products ?? []).map((p) => ({ id: p.id, active: p.active })),
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
const ContasSection = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <section className="border-t border-border bg-background px-4 sm:px-6 py-12 sm:py-20">
      <div className="mx-auto max-w-7xl">
        <SectionHeader subtitle={t("accounts.subtitle")} title={t("accounts.title")} />

        <div className="mt-5 sm:mt-12 grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
          {GAME_CATEGORIES.map((game) => (
            <div
              key={game.tab}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate(`/contas?game=${game.tab}`);
                }
              }}
              className="group relative touch-manipulation cursor-pointer overflow-hidden rounded-xl border border-border/40 bg-card transition-all duration-300 hover:border-success/40 hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)]"
              onClick={() => navigate(`/contas?game=${game.tab}`)}
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
            </div>
          ))}
        </div>

        <div className="mt-6 sm:mt-10 flex justify-center">
          <Link
            to="/contas"
            className="touch-manipulation flex w-full sm:w-auto items-center justify-center gap-2 border border-foreground/15 px-6 sm:px-12 py-2.5 sm:py-3.5 text-[10px] sm:text-sm font-bold uppercase tracking-[0.2em] text-foreground/80 transition-all hover:border-success hover:text-success rounded-xl"
            style={{ fontFamily: "'Valorant', sans-serif" }}
          >
            {t("accounts.exploreAccounts")}
            <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
};

// ─── TiltCard (3D tilt on hover) ────────────────────────────────────────────
const TiltCard = ({ children }: { children: ReactNode }) => {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: MouseEvent<HTMLDivElement>) => {
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
  }, []);

  const handleMouseLeave = useCallback(() => {
    const card = cardRef.current;
    if (card) card.style.transform = "perspective(800px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)";
  }, []);

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ transition: "transform 0.15s ease-out", transformStyle: "preserve-3d" }}
    >
      {children}
    </div>
  );
};

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

function GameCard({ game, count, t }: { game: GameCardGame; count: number; t: TFunction }) {
  const hasProducts = count > 0;
  const [isHovered, setIsHovered] = useState(false);
  const characterPositionClass = "absolute bottom-0 right-0 w-[55%] sm:w-[50%]";

  return (
    <TiltCard>
      <Link
        to={
          game.keywords[0]
            ? `/produtos?game=${encodeURIComponent(game.keywords[0])}`
            : "/produtos"
        }
        className="group touch-manipulation relative block rounded-2xl border border-border/50 hover:border-success/40 transition-all duration-500 bg-card overflow-hidden hover:shadow-[0_20px_50px_hsl(var(--foreground)/0.18)]"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Image / gradient background */}
        <div className="relative aspect-[16/11] overflow-hidden">
          {game.image ? (
            <img
              src={game.image}
              alt={game.name}
              loading="lazy"
              decoding="async"
              width={400}
              height={275}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${GAME_GRADIENTS[game.name] || "from-muted to-card"} flex items-center justify-center`}>
              <span className="text-3xl md:text-4xl font-bold text-foreground/20 uppercase tracking-widest select-none">
                {game.name}
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/10" />

          {/* Character normal */}
          {game.character && (
            <div
              className={`${characterPositionClass} pointer-events-none z-[8] transition-opacity duration-500 ease-out`}
              style={{ opacity: isHovered ? 0 : 1 }}
            >
              <img src={game.character} alt="" loading="lazy" decoding="async" className="w-full h-auto object-contain" style={{ filter: "drop-shadow(0 10px 28px rgba(0,0,0,0.55))" }} />
            </div>
          )}

          {/* Character hover */}
          {game.characterHover && (
            <div
              className={`${characterPositionClass} pointer-events-none z-[9] transition-all duration-500 ease-out`}
              style={{
                opacity: isHovered ? 1 : 0,
                transformOrigin: "bottom right",
                transform: isHovered ? "scale(1.08)" : "scale(0.95)",
              }}
            >
              <img src={game.characterHover} alt="" loading="lazy" decoding="async" className="w-full h-auto object-contain" style={{ filter: "drop-shadow(0 12px 32px rgba(0,0,0,0.6))" }} />
            </div>
          )}

          {/* Badge top-left */}
          <div className="absolute left-3 top-3 z-[12] flex flex-wrap gap-2">
            {hasProducts && (
              <div className="flex items-center gap-1.5 rounded-full border border-border/50 bg-card/75 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-foreground shadow-lg backdrop-blur-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                {count} {count === 1 ? t("games.software") : t("games.softwares")}
              </div>
            )}
          </div>

          {/* Content overlay at bottom */}
          <div className="absolute inset-x-0 bottom-0 z-[12] p-4 sm:p-5">
            <h3 className="text-sm sm:text-lg lg:text-xl font-bold tracking-tight text-foreground drop-shadow-lg" style={{ fontFamily: "'Valorant', sans-serif" }}>
              {game.name}
            </h3>
            <p className="mt-1 max-w-[70%] text-[10px] sm:text-xs leading-relaxed text-muted-foreground/90 line-clamp-2">
              {t(game.descKey, { defaultValue: game.fallbackDesc })}
            </p>
            <div className="mt-3 inline-flex items-center gap-2 text-[10px] sm:text-xs font-bold uppercase tracking-[0.18em] text-success transition-all group-hover:gap-3">
              <span>{t("games.viewSoftwares")} {game.name.split(" ")[0]}</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </div>
        </div>
      </Link>
    </TiltCard>
  );
}

// ─── Software Section ───────────────────────────────────────────────────────
const SoftwareSection = () => {
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
    <section className="border-t border-border bg-background px-4 sm:px-6 py-12 sm:py-20">
      <div className="mx-auto max-w-7xl">
        <SectionHeader subtitle={t("products.subtitle")} title={t("products.title")} />

        {isLoading ? (
          <div className="mt-10 flex justify-center"><Loader2 className="h-7 w-7 animate-spin text-success" /></div>
        ) : gameCards.length === 0 ? (
          <div className="mt-10 text-center text-muted-foreground text-sm">{t("products.empty")}</div>
        ) : (
          <div className="mt-5 sm:mt-12 grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
            {gameCards.map((gc) => (
              <GameCard key={gc.id} game={gc} count={gc.count} t={t} />
            ))}
          </div>
        )}

        <div className="mt-6 sm:mt-10 flex justify-center">
          <Link
            to="/produtos"
            className="touch-manipulation flex w-full sm:w-auto items-center justify-center gap-2 border border-foreground/15 px-6 sm:px-12 py-2.5 sm:py-3.5 text-[10px] sm:text-sm font-bold uppercase tracking-[0.2em] text-foreground/80 transition-all hover:border-success hover:text-success rounded-xl"
            style={{ fontFamily: "'Valorant', sans-serif" }}
          >
            {t("products.viewAll")}
            <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
};

export default function IndexGameShowcase() {
  return (
    <>
      <SoftwareSection />
      <ContasSection />
    </>
  );
}
