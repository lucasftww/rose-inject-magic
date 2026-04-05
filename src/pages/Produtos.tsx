import { useState, useMemo, useEffect, useRef, useCallback, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Header from "@/components/Header";
import { Search, SlidersHorizontal, DollarSign, ArrowLeft, Loader2, Package, Tag, ArrowUpDown, UserCheck, X, ArrowRight, Gamepad2, Gift, Shield, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useReseller } from "@/hooks/useReseller";

// Local game images
import imgValorant from "@/assets/games/valorant.webp";
import imgFortnite from "@/assets/games/fortnite.webp";
import imgCS2 from "@/assets/games/cs2.webp";
import imgSpoofers from "@/assets/games/spoofers.webp";
import imgArenaBreakout from "@/assets/games/arena-breakout.webp";
import imgArcRaiders from "@/assets/games/arc-raiders.webp";
import imgCallOfDuty from "@/assets/games/call-of-duty.webp";
import imgRust from "@/assets/games/rust.webp";
import imgBloodstrike from "@/assets/games/bloodstrike.webp";
import imgApexLegends from "@/assets/games/apex-legends.webp";
import imgFarlight84 from "@/assets/games/farlight-84.webp";
import imgBodycam from "@/assets/games/bodycam.webp";
import imgWarface from "@/assets/games/warface.webp";
import imgFiveM from "@/assets/games/fivem.webp";
import imgSquad from "@/assets/games/squad.webp";
import imgOverwatch2 from "@/assets/games/overwatch-2.webp";
import imgHellLetLoose from "@/assets/games/hell-let-loose.webp";
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
import swArcRaiders from "@/assets/games/sw-arc-raiders.webp";
import swArenaBreakout from "@/assets/games/sw-arena-breakout.webp";
import swSpoofers from "@/assets/games/sw-spoofers.webp";
import swBloodhunt from "@/assets/games/sw-bloodhunt.webp";
import swDbd from "@/assets/games/sw-dbd.webp";
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
import overwatch2Normal from "@/assets/games/overwatch2-normal.png";
import overwatch2Hover from "@/assets/games/overwatch2-hover.png";
import bgCardOverwatch2 from "@/assets/games/bg-card-overwatch2.png";
import hellletlooseNormal from "@/assets/games/hellletloose-normal.png";
import hellletlooseHover from "@/assets/games/hellletloose-hover.png";
import bgCardHellletloose from "@/assets/games/bg-card-hellletloose.png";
import squadCharNormal from "@/assets/games/squad-normal.png";
import squadCharHover from "@/assets/games/squad-hover.png";
import bgCardSquad from "@/assets/games/bg-card-squad.png";
import farlight84Normal from "@/assets/games/farlight84-normal.png";
import farlight84Hover from "@/assets/games/farlight84-hover.png";
import bgCardFarlight84 from "@/assets/games/bg-card-farlight84.png";
import bodycamNormal from "@/assets/games/bodycam-normal.png";
import bodycamHover from "@/assets/games/bodycam-hover.png";
import bgCardBodycam from "@/assets/games/bg-card-bodycam.png";
import warfaceNormal from "@/assets/games/warface-normal.png";
import warfaceHover from "@/assets/games/warface-hover.png";
import bgCardWarface from "@/assets/games/bg-card-warface.png";
import bloodhuntNormal from "@/assets/games/bloodhunt-normal.png";
import bloodhuntHover from "@/assets/games/bloodhunt-hover.png";
import bgCardBloodhunt from "@/assets/games/bg-card-bloodhunt.png";
import dbdNormal from "@/assets/games/dbd-normal.png";
import dbdHover from "@/assets/games/dbd-hover.png";
import bgCardDbd from "@/assets/games/bg-card-dbd.png";
import spoofersNormal from "@/assets/games/spoofers-normal.png";
import spoofersHover from "@/assets/games/spoofers-hover.png";
import bgCardSpoofers from "@/assets/games/bg-card-spoofers.png";

const localImageMap: Record<string, string> = {
  'Valorant': imgValorant,
  'Counter-Strike 2': imgCS2,
  'Counter-Strike 2 (FREE)': imgCS2,
  'Spoofers': imgSpoofers,
  'Arena Breakout Infinite': imgArenaBreakout,
  'ARC Raiders': imgArcRaiders,
  'Call of Duty': imgCallOfDuty,
  'Rust': imgRust,
  'Bloodstrike': imgBloodstrike,
  'Apex Legends': imgApexLegends,
  'Farlight 84': imgFarlight84,
  'Bodycam': imgBodycam,
  'Warface': imgWarface,
  'FiveM': imgFiveM,
  'Squad': imgSquad,
  'Overwatch 2': imgOverwatch2,
  'Hell Let Loose': imgHellLetLoose,
  'Fortnite': imgFortnite,
  'DayZ': swDayz,
  'PUBG': swPubg,
  'Marvel Rivals': swMarvelRivals,
  'Bloodhunt': swBloodhunt,
  'Dead by Daylight': swDbd,
};

const softwareImageMap: Record<string, string> = {
  valorant: swValorant,
  fortnite: swFortnite,
  cs2: swCs2,
  'cs2-free': swCs2,
  'counter-strike 2': swCs2,
  'counter-strike-2': swCs2,
  'counter-strike 2 (free)': swCs2,
  'counter-strike-2-free': swCs2,
  apex: swApex,
  'apex legends': swApex,
  'apex-legends': swApex,
  cod: swCod,
  'call of duty': swCod,
  'call-of-duty': swCod,
  rust: swRust,
  overwatch: swOverwatch,
  'overwatch 2': swOverwatch,
  'overwatch-2': swOverwatch,
  fivem: swFivem,
  pubg: swPubg,
  dayz: swDayz,
  squad: swSquad,
  'marvel rivals': swMarvelRivals,
  'marvel-rivals': swMarvelRivals,
  'arc raiders': swArcRaiders,
  'arc-raiders': swArcRaiders,
  'arena breakout': swArenaBreakout,
  'arena-breakout': swArenaBreakout,
  'arena breakout infinite': swArenaBreakout,
  'bodycam': imgBodycam,
  'spoofers': swSpoofers,
  'bloodhunt': swBloodhunt,
  'dead by daylight': swDbd,
  'dead-by-daylight': swDbd,
  'warface': imgWarface,
};

const softwareCharacterOverlayMap: Record<string, { bg: string; character: string; characterHover: string }> = {
  'call of duty': { bg: bgCardCod, character: codNormal, characterHover: codHover },
  'call-of-duty': { bg: bgCardCod, character: codNormal, characterHover: codHover },
  cod: { bg: bgCardCod, character: codNormal, characterHover: codHover },
  pubg: { bg: bgCardPubg, character: pubgNormal, characterHover: pubgHover },
  fortnite: { bg: bgCardFortnite, character: fortniteNormal, characterHover: fortniteHover },
  valorant: { bg: bgCardValorant, character: valorantNormal, characterHover: valorantHover },
  cs2: { bg: bgCardCs2, character: cs2Normal, characterHover: cs2Hover },
  'cs2-free': { bg: bgCardCs2, character: cs2Normal, characterHover: cs2Hover },
  'counter-strike 2': { bg: bgCardCs2, character: cs2Normal, characterHover: cs2Hover },
  'counter-strike-2': { bg: bgCardCs2, character: cs2Normal, characterHover: cs2Hover },
  'counter-strike 2 (free)': { bg: bgCardCs2, character: cs2Normal, characterHover: cs2Hover },
  rust: { bg: bgCardRust, character: rustNormal, characterHover: rustHover },
  dayz: { bg: bgCardDayz, character: dayzNormal, characterHover: dayzHover },
  fivem: { bg: bgCardFivem, character: fivemNormal, characterHover: fivemHover },
  'marvel rivals': { bg: bgCardRivals, character: rivalsNormal, characterHover: rivalsHover },
  'marvel-rivals': { bg: bgCardRivals, character: rivalsNormal, characterHover: rivalsHover },
  bloodstrike: { bg: bgCardBloodstrike, character: bloodstrikeNormal, characterHover: bloodstrikeHover },
  'apex legends': { bg: bgCardApex, character: apexNormal, characterHover: apexHover },
  'apex-legends': { bg: bgCardApex, character: apexNormal, characterHover: apexHover },
  apex: { bg: bgCardApex, character: apexNormal, characterHover: apexHover },
  'arc raiders': { bg: bgCardArcraiders, character: arcraidersNormal, characterHover: arcraidersHover },
  'arc-raiders': { bg: bgCardArcraiders, character: arcraidersNormal, characterHover: arcraidersHover },
  'arena breakout': { bg: bgCardArenabreakout, character: arenabreakoutNormal, characterHover: arenabreakoutHover },
  'arena-breakout': { bg: bgCardArenabreakout, character: arenabreakoutNormal, characterHover: arenabreakoutHover },
  'arena breakout infinite': { bg: bgCardArenabreakout, character: arenabreakoutNormal, characterHover: arenabreakoutHover },
  'overwatch 2': { bg: bgCardOverwatch2, character: overwatch2Normal, characterHover: overwatch2Hover },
  'overwatch-2': { bg: bgCardOverwatch2, character: overwatch2Normal, characterHover: overwatch2Hover },
  overwatch: { bg: bgCardOverwatch2, character: overwatch2Normal, characterHover: overwatch2Hover },
  'hell let loose': { bg: bgCardHellletloose, character: hellletlooseNormal, characterHover: hellletlooseHover },
  'hell-let-loose': { bg: bgCardHellletloose, character: hellletlooseNormal, characterHover: hellletlooseHover },
  squad: { bg: bgCardSquad, character: squadCharNormal, characterHover: squadCharHover },
  'farlight 84': { bg: bgCardFarlight84, character: farlight84Normal, characterHover: farlight84Hover },
  'farlight-84': { bg: bgCardFarlight84, character: farlight84Normal, characterHover: farlight84Hover },
  bodycam: { bg: bgCardBodycam, character: bodycamNormal, characterHover: bodycamHover },
  warface: { bg: bgCardWarface, character: warfaceNormal, characterHover: warfaceHover },
  bloodhunt: { bg: bgCardBloodhunt, character: bloodhuntNormal, characterHover: bloodhuntHover },
  'dead by daylight': { bg: bgCardDbd, character: dbdNormal, characterHover: dbdHover },
  'dead-by-daylight': { bg: bgCardDbd, character: dbdNormal, characterHover: dbdHover },
  spoofers: { bg: bgCardSpoofers, character: spoofersNormal, characterHover: spoofersHover },
};

const fadeUpShowcase = {
  hidden: { opacity: 0, y: 18 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, delay: i * 0.04, ease: 'easeOut' as const },
  }),
};

const getLookupKeys = (game: Pick<GameFromDB, 'name' | 'slug'>) => {
  const keys = [
    game.slug || '',
    game.name || '',
    (game.slug || '').replace(/-/g, ' '),
    (game.name || '').replace(/\s+/g, '-'),
  ];

  return Array.from(new Set(keys.map(key => key.trim().toLowerCase()).filter(Boolean)));
};

const getShowcaseAssets = (game: Pick<GameFromDB, 'name' | 'slug' | 'image_url'>) => {
  const keys = getLookupKeys(game);
  const overlay = keys.map((key) => softwareCharacterOverlayMap[key]).find(Boolean);
  const image = overlay?.bg || keys.map((key) => softwareImageMap[key]).find(Boolean) || localImageMap[game.name] || game.image_url || null;

  return {
    image,
    character: overlay?.character,
    characterHover: overlay?.characterHover,
  };
};

const TiltCard = ({ children, index }: { children: ReactNode; index: number }) => {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;

    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = centerY > 0 ? ((y - centerY) / centerY) * -7 : 0;
    const rotateY = centerX > 0 ? ((x - centerX) / centerX) * 7 : 0;
    card.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.015, 1.015, 1.015)`;
  }, []);

  const handleMouseLeave = useCallback(() => {
    const card = cardRef.current;
    if (card) card.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
  }, []);

  return (
    <motion.div
      ref={cardRef}
      variants={fadeUpShowcase}
      custom={index}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ transition: 'transform 0.18s ease-out', transformStyle: 'preserve-3d' }}
    >
      {children}
    </motion.div>
  );
};

const SoftwareShowcaseCard = ({ game, index, isFree, description, onSelect }: { game: GameFromDB; index: number; isFree: boolean; description: string; onSelect: (gameId: string) => void }) => {
  const [isHovered, setIsHovered] = useState(false);
  const { image, character, characterHover } = getShowcaseAssets(game);
  const hasProducts = game.product_count > 0;
  const characterPositionClass = 'absolute bottom-0 right-0 z-[8] w-[55%] sm:w-[50%]';

  return (
    <TiltCard index={index}>
      <motion.button
        type="button"
        onClick={() => onSelect(game.id)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="group relative block w-full overflow-hidden rounded-2xl border border-border/50 bg-card text-left transition-all duration-500 hover:border-success/40 hover:shadow-[0_20px_50px_hsl(var(--foreground)/0.18)] focus:outline-none active:scale-[0.98]"
      >
        <div className="relative aspect-[16/11] overflow-hidden">
          {image ? (
            <img src={image} alt={game.name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted to-card">
              <Gamepad2 className="h-12 w-12 text-muted-foreground/20" />
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/10" />

          {character && (
            <div className={`${characterPositionClass} pointer-events-none transition-opacity duration-500 ease-out`} style={{ opacity: isHovered ? 0 : 1 }}>
              <img src={character} alt="" loading="lazy" className="w-full h-auto object-contain" style={{ filter: 'drop-shadow(0 10px 28px rgba(0,0,0,0.55))' }} />
            </div>
          )}

          {characterHover && (
            <div
              className={`${characterPositionClass} pointer-events-none z-[9] transition-all duration-500 ease-out`}
              style={{
                opacity: isHovered ? 1 : 0,
                transformOrigin: 'bottom right',
                transform: isHovered ? 'scale(1.08)' : 'scale(0.95)',
              }}
            >
              <img src={characterHover} alt="" loading="lazy" className="w-full h-auto object-contain" style={{ filter: 'drop-shadow(0 12px 32px rgba(0,0,0,0.6))' }} />
            </div>
          )}

          <div className="absolute left-3 top-3 z-[12] flex flex-wrap gap-2">
            {isFree && (
              <div className="flex items-center gap-1 rounded-full bg-success px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-success-foreground shadow-lg">
                <Gift className="h-3 w-3" />
                FREE
              </div>
            )}

            {hasProducts && (
              <div className="flex items-center gap-1.5 rounded-full border border-border/50 bg-card/75 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-foreground shadow-lg backdrop-blur-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                {game.product_count} {game.product_count === 1 ? 'software' : 'softwares'}
              </div>
            )}
          </div>

          <div className="absolute inset-x-0 bottom-0 z-[12] p-4 sm:p-5">
            <h3 className="text-sm sm:text-lg lg:text-xl font-bold tracking-tight text-foreground drop-shadow-lg" style={{ fontFamily: "'Valorant', sans-serif" }}>
              {game.name}
            </h3>
            <p className="mt-1 max-w-[70%] text-[10px] sm:text-xs leading-relaxed text-muted-foreground/90 line-clamp-2">{description}</p>
            <div className="mt-3 inline-flex items-center gap-2 text-[10px] sm:text-xs font-bold uppercase tracking-[0.18em] text-success transition-all group-hover:gap-3">
              <span>Ver softwares</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </div>
        </div>
      </motion.button>
    </TiltCard>
  );
};

interface GameFromDB {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  product_count: number;
  active: boolean;
}

interface ProductPlan {
  id: string;
  name: string;
  price: number;
  active: boolean;
  sort_order: number;
}

interface ProductFromDB {
  id: string;
  game_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  active: boolean;
  sort_order: number;
  created_at?: string | null;
  robot_game_id: number | null;
  product_plans: ProductPlan[];
  _stockCount?: number;
}

type ProductWithPlansRow = Tables<"products"> & {
  product_plans: Tables<"product_plans">[] | null;
};

function mapProductWithPlansToCatalog(row: ProductWithPlansRow): ProductFromDB {
  return {
    id: row.id,
    game_id: row.game_id ?? "",
    name: row.name,
    description: row.description,
    image_url: row.image_url,
    active: row.active ?? false,
    sort_order: row.sort_order ?? 0,
    created_at: row.created_at,
    robot_game_id: row.robot_game_id,
    product_plans: (row.product_plans ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      price: Number(p.price ?? 0),
      active: p.active ?? false,
      sort_order: p.sort_order ?? 0,
    })),
  };
}

const finitePlanPrice = (p: ProductPlan) => {
  const n = Number(p.price);
  return Number.isFinite(n) ? n : 0;
};

const fadeUp = {
  hidden: { opacity: 0, y: 15 },
  visible: (i: number = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.25, delay: i * 0.03, ease: "easeOut" as const },
  }),
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.03, delayChildren: 0 } },
};

const priceRanges = [
  { label: "Todos", min: 0, max: Infinity },
  { label: "Até R$ 50", min: 0, max: 50 },
  { label: "R$ 50 - R$ 100", min: 50, max: 100 },
  { label: "R$ 100 - R$ 300", min: 100, max: 300 },
  { label: "R$ 300+", min: 300, max: Infinity },
];
const sortOptions = ["Mais Recentes", "Menor Preço", "Maior Preço"] as const;

const ProductCard = ({ product }: { product: ProductFromDB }) => {
  const navigate = useNavigate();
  const { isReseller, isResellerForProduct, getDiscountedPrice } = useReseller();
  const lowestPrice = useMemo(() => {
    const activePlans = product.product_plans?.filter(p => p.active) || [];
    if (activePlans.length === 0) return null;
    const paidPlans = activePlans.filter(p => finitePlanPrice(p) > 0);
    if (paidPlans.length === 0) return Math.min(...activePlans.map(p => finitePlanPrice(p)));
    return Math.min(...paidPlans.map(p => finitePlanPrice(p)));
  }, [product.product_plans]);

  const isRobot = !!product.robot_game_id;

  const isResellerProduct = isReseller && isResellerForProduct(product.id);
  const discountedPrice = lowestPrice !== null && isResellerProduct ? getDiscountedPrice(product.id, lowestPrice) : null;

  return (
    <div
      onClick={() => navigate(`/produto/${product.id}`)}
      className="group cursor-pointer overflow-hidden rounded-lg border border-border bg-card transition-all hover:border-success/40 hover:shadow-[0_0_20px_hsl(var(--success)/0.1)]"
    >
      <div className="relative flex h-72 items-center justify-center overflow-hidden bg-secondary/50">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <Package className="h-12 w-12 text-muted-foreground/20" />
        )}
        {isResellerProduct && (
          <span className="absolute top-3 left-3 flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[10px] font-bold text-accent-foreground shadow-lg">
            <UserCheck className="h-3 w-3" /> Revendedor
          </span>
        )}
      </div>
      <div className="p-5">
        <h3 className="text-base font-bold text-foreground">{product.name}</h3>
        {product.description && (
          <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">{product.description}</p>
        )}

        {lowestPrice !== null && (
          <div className="mt-4 flex items-end justify-between">
            <div>
              <p className="text-[10px] text-muted-foreground">A partir de</p>
              {discountedPrice !== null ? (
                <div>
                  <p className="text-xs text-muted-foreground line-through">R$ {lowestPrice.toFixed(2)}</p>
                  <p className="text-xl font-bold text-success">R$ {discountedPrice.toFixed(2)}</p>
                </div>
              ) : (
                <p className="text-xl font-bold text-success">R$ {lowestPrice.toFixed(2)}</p>
              )}
            </div>
            <span className="flex items-center gap-1.5 rounded border border-border px-4 py-2 text-xs font-medium text-muted-foreground transition-colors group-hover:border-success group-hover:text-success">
              Ver produto
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

const GameSelectScreen = ({
  onSelect,
  games,
  loading,
  error,
  onRetry,
}: {
  onSelect: (gameId: string) => void;
  games: GameFromDB[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) => {
  const [gameSearch, setGameSearch] = useState("");

  const filteredBySearch = useMemo(() => {
    if (!gameSearch.trim()) return games;
    const q = gameSearch.toLowerCase();
    return games.filter(g => g.name.toLowerCase().includes(q));
  }, [games, gameSearch]);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero header */}
      <section className="relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full opacity-[0.07]" style={{ background: 'radial-gradient(ellipse, hsl(var(--success)), transparent 70%)' }} />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 pt-10 sm:pt-16 pb-6 sm:pb-8">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex flex-col items-center text-center gap-4">
            {/* Badge */}
            <div className="flex items-center gap-2 rounded-full border border-success/20 bg-success/[0.06] px-4 py-1.5">
              <Gamepad2 className="h-4 w-4 text-success" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-success">Catálogo de Jogos</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-foreground" style={{ fontFamily: "'Valorant', sans-serif" }}>
              <span className="text-success">Escolha</span> seu jogo
            </h1>
            <p className="max-w-md text-sm text-muted-foreground">
              Encontre os melhores softwares para seu jogo favorito. Selecione abaixo e descubra as opções disponíveis.
            </p>
            <p className="max-w-md text-xs text-muted-foreground/60">
              Procurando contas prontas? Acesse{" "}
              <Link to="/contas" className="text-success font-medium hover:underline underline-offset-2">Contas</Link>.
            </p>

            {/* Search bar */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
              className="relative mt-2 w-full max-w-md"
            >
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
              <input
                type="text"
                value={gameSearch}
                onChange={e => setGameSearch(e.target.value)}
                placeholder="Pesquisar jogo..."
                className="w-full rounded-xl border border-border/60 bg-card/80 pl-11 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none transition-all focus:border-success/50 focus:ring-2 focus:ring-success/20"
                style={{ backdropFilter: 'blur(12px)' }}
              />
              {gameSearch && (
                <button type="button" onClick={() => setGameSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {loading ? (
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 sm:py-8 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
             <Skeleton key={i} className="aspect-[16/11] w-full rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <div className="mx-auto max-w-lg px-4 py-20 sm:py-28">
          <div className="rounded-2xl border border-destructive/25 bg-destructive/[0.06] p-8 text-center">
            <AlertCircle className="mx-auto h-11 w-11 text-destructive/85" aria-hidden />
            <h2 className="mt-4 text-lg font-semibold text-foreground">Não foi possível carregar o catálogo</h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              disabled={loading}
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-success px-5 py-2.5 text-sm font-bold text-success-foreground transition-opacity disabled:opacity-60 hover:opacity-95"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Tentar novamente
            </button>
          </div>
        </div>
      ) : filteredBySearch.length === 0 ? (
        <div className="py-32 text-center text-muted-foreground">
          {gameSearch ? `Nenhum jogo encontrado para "${gameSearch}"` : 'Nenhum jogo disponível no momento.'}
        </div>
      ) : (() => {
        const descriptions: Record<string, string> = {
          'Valorant': 'Cheats premium para Valorant — domine cada round',
          'Counter-Strike 2': 'Hacks indetectados para CS2',
          'Counter-Strike 2 (FREE)': 'Cheats gratuitos para CS2',
          'Spoofers': 'Limpe seu HWID e volte a jogar',
          'Fortnite': 'Softwares indetectáveis para Fortnite',
          'Arena Breakout Infinite': 'Cheats para Arena Breakout',
          'ARC Raiders': 'Softwares premium para ARC Raiders',
          'Call of Duty': 'Cheats para Call of Duty — Warzone & MP',
          'PUBG': 'Softwares para PUBG — domine o battleground',
          'Rust': 'Hacks indetectados para Rust',
          'DayZ': 'Sobreviva com vantagem no DayZ',
          'Bloodstrike': 'Cheats premium para Bloodstrike',
          'Apex Legends': 'Cheats premium para Apex Legends',
          'Marvel Rivals': 'Domine as batalhas em Marvel Rivals',
          'Farlight 84': 'Softwares para Farlight 84',
          'Bodycam': 'Cheats gratuitos para Bodycam FPS',
          'Bloodhunt': 'Domine a caçada em Bloodhunt',
          'Warface': 'Hacks gratuitos para Warface',
          'Dead by Daylight': 'Cheats para Dead by Daylight',
          'FiveM': 'Mods e menus para FiveM / GTA RP',
          'Squad': 'Softwares táticos para Squad',
          'Overwatch 2': 'Cheats para Overwatch 2',
          'Hell Let Loose': 'Domine o campo de batalha WW2',
        };

        const freeGameNames = ['Bodycam', 'Bloodhunt', 'Counter-Strike 2 (FREE)', 'Warface'];
        const spooferNames = ['Spoofers'];
        const premiumGames = filteredBySearch.filter(g => !freeGameNames.includes(g.name) && !spooferNames.includes(g.name));
        const spooferGames = filteredBySearch.filter(g => spooferNames.includes(g.name));
        const freeGames = filteredBySearch.filter(g => freeGameNames.includes(g.name));

        const renderCard = (game: GameFromDB, idx: number, isFree: boolean) => {
          const desc = descriptions[game.name] || `Softwares para ${game.name}`;
          return <SoftwareShowcaseCard key={game.id} game={game} index={idx} isFree={isFree} description={desc} onSelect={onSelect} />;
        };

        const gridClasses = "grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4";

        const renderSectionHeader = (icon: ReactNode, label: string, color: string) => (
          <div className="mb-5 flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border px-4 py-1.5" style={{ borderColor: `${color}30`, backgroundColor: `${color}15` }}>
              {icon}
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color }}>{label}</span>
            </div>
            <div className="h-px flex-1 bg-border/40" />
          </div>
        );

        return (
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 sm:py-8 space-y-10">
            {/* Premium games */}
            {premiumGames.length > 0 && (
              <div>
                <motion.div className={gridClasses} initial="hidden" animate="visible" variants={staggerContainer}>
                  {premiumGames.map((game, idx) => renderCard(game, idx, false))}
                </motion.div>
              </div>
            )}

            {/* Spoofers section */}
            {spooferGames.length > 0 && (
              <div>
                {renderSectionHeader(
                  <Shield className="h-4 w-4" style={{ color: 'hsl(197, 100%, 50%)' }} />,
                  'Spoofers',
                  'hsl(197, 100%, 50%)'
                )}
                <motion.div className={gridClasses} initial="hidden" animate="visible" variants={staggerContainer}>
                  {spooferGames.map((game, idx) => renderCard(game, idx, false))}
                </motion.div>
              </div>
            )}

            {/* Free games section */}
            {freeGames.length > 0 && (
              <div>
                {renderSectionHeader(
                  <Gift className="h-4 w-4" style={{ color: 'hsl(142, 76%, 36%)' }} />,
                  'Softwares Gratuitos',
                  'hsl(142, 76%, 36%)'
                )}
                <motion.div className={gridClasses} initial="hidden" animate="visible" variants={staggerContainer}>
                  {freeGames.map((game, idx) => renderCard(game, idx, true))}
                </motion.div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
};

const Produtos = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [games, setGames] = useState<GameFromDB[]>([]);
  const [loadingGames, setLoadingGames] = useState(true);
  const [gamesError, setGamesError] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductFromDB[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [selectedPriceRange, setSelectedPriceRange] = useState(0);
  const [sortBy, setSortBy] = useState<typeof sortOptions[number]>("Mais Recentes");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlanType, setSelectedPlanType] = useState("Todos");
  const [onlyWithPlans, setOnlyWithPlans] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const loadGames = useCallback(async () => {
    setGamesError(null);
    setLoadingGames(true);
    try {
      const [gamesRes, productsRes] = await Promise.all([
        supabase.from("games").select("id, name, slug, image_url, active, sort_order").eq("active", true).order("sort_order", { ascending: true }),
        supabase.from("products").select("id, game_id").eq("active", true),
      ]);

      if (gamesRes.error) {
        setGames([]);
        setGamesError(gamesRes.error.message || "Não foi possível carregar a lista de jogos.");
        return;
      }
      if (productsRes.error) {
        setGames([]);
        setGamesError(
          productsRes.error.message
            ? `Não foi possível montar o catálogo: ${productsRes.error.message}`
            : "Não foi possível carregar as informações dos produtos.",
        );
        return;
      }

      const countMap: Record<string, number> = {};
      (productsRes.data || []).forEach((p) => {
        const gid = p.game_id;
        if (gid) countMap[gid] = (countMap[gid] || 0) + 1;
      });
      setGames(
        (gamesRes.data || []).map((g) => ({
          id: g.id,
          name: g.name,
          slug: g.slug ?? "",
          image_url: g.image_url,
          product_count: countMap[g.id] || 0,
          active: g.active ?? false,
        })),
      );
    } catch (e) {
      console.error("loadGames:", e);
      setGames([]);
      setGamesError(e instanceof Error ? e.message : "Erro de conexão. Verifique a internet e tente novamente.");
    } finally {
      setLoadingGames(false);
    }
  }, []);

  useEffect(() => {
    void loadGames();
  }, [loadGames]);

  const loadProductsForGame = useCallback(async (gameId: string) => {
    setProductsError(null);
    setLoadingProducts(true);
    try {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, description, image_url, active, sort_order, game_id, created_at, status, status_label, status_updated_at, features_text, robot_game_id, product_plans(*)")
        .eq("game_id", gameId)
        .eq("active", true)
        .order("sort_order", { ascending: true });
      if (error) {
        setProducts([]);
        setProductsError(error.message || "Não foi possível carregar os produtos deste jogo.");
        return;
      }
      setProducts((data ?? []).map(mapProductWithPlansToCatalog));
    } catch (e) {
      console.error("loadProductsForGame:", e);
      setProducts([]);
      setProductsError(e instanceof Error ? e.message : "Erro de conexão. Verifique a internet e tente novamente.");
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  const handleGameSelect = useCallback(
    async (gameId: string) => {
      try {
        const game = games.find((g) => g.id === gameId);
        if (game && game.product_count === 1) {
          const { data } = await supabase
            .from("products")
            .select("id")
            .eq("game_id", gameId)
            .eq("active", true)
            .limit(1);
          if (data && data.length === 1) {
            navigate(`/produto/${data[0].id}`);
            return;
          }
        }
        setSelectedGame(gameId);
      } catch (e) {
        console.error("handleGameSelect:", e);
        setSelectedGame(gameId);
      }
    },
    [games, navigate],
  );

  const deepLinkHandledParamRef = useRef<string | null>(null);

  // Deep link: /produtos?game=valorant (ou slug/nome) — igual aos cards da landing
  useEffect(() => {
    const raw = searchParams.get("game")?.trim() ?? "";
    if (!raw) {
      deepLinkHandledParamRef.current = null;
      return;
    }
    if (loadingGames || games.length === 0 || selectedGame) return;
    if (deepLinkHandledParamRef.current === raw) return;
    let decoded: string;
    try {
      decoded = decodeURIComponent(raw).toLowerCase();
    } catch {
      decoded = raw.toLowerCase();
    }
    const match = games.find((g) => getLookupKeys(g).some((k) => k === decoded));
    if (!match) return;
    deepLinkHandledParamRef.current = raw;
    void handleGameSelect(match.id);
  }, [loadingGames, games, selectedGame, searchParams, handleGameSelect]);

  useEffect(() => {
    if (!selectedGame) {
      setProducts([]);
      setProductsError(null);
      return;
    }
    void loadProductsForGame(selectedGame);
  }, [selectedGame, loadProductsForGame]);

  // Available plan types from current products
  const availablePlanTypes = useMemo(() => {
    const types = new Set<string>();
    products.forEach(p => p.product_plans?.filter(pl => pl.active).forEach(pl => types.add(pl.name)));
    return ["Todos", ...Array.from(types)];
  }, [products]);

  const filtered = useMemo(() => {
    const range = priceRanges[selectedPriceRange];
    return products
      .filter((p) => {
        if (!searchQuery) return true;
        return p.name.toLowerCase().includes(searchQuery.toLowerCase());
      })
      .filter((p) => {
        if (onlyWithPlans) {
          const activePlans = p.product_plans?.filter(pl => pl.active) || [];
          if (activePlans.length === 0) return false;
        }
        return true;
      })
      .filter((p) => {
        if (selectedPlanType === "Todos") return true;
        return p.product_plans?.some(pl => pl.active && pl.name === selectedPlanType);
      })
      .filter((p) => {
        if (range.max === Infinity && range.min === 0) return true;
        const plans = p.product_plans?.filter(pl => pl.active) || [];
        if (plans.length === 0) return range.min === 0;
        const lowest = Math.min(...plans.map(pl => finitePlanPrice(pl)));
        return lowest >= range.min && lowest <= range.max;
      })
      .sort((a, b) => {
        if (sortBy === "Mais Recentes") {
          const aT = new Date(a.created_at || 0).getTime();
          const bT = new Date(b.created_at || 0).getTime();
          return bT - aT;
        }
        if (sortBy === "Menor Preço") {
          const aPlans = a.product_plans?.filter(p => p.active) || [];
          const bPlans = b.product_plans?.filter(p => p.active) || [];
          const aMin = aPlans.length ? Math.min(...aPlans.map(p => finitePlanPrice(p))) : Infinity;
          const bMin = bPlans.length ? Math.min(...bPlans.map(p => finitePlanPrice(p))) : Infinity;
          return aMin - bMin;
        }
        if (sortBy === "Maior Preço") {
          const aPlans = a.product_plans?.filter(p => p.active) || [];
          const bPlans = b.product_plans?.filter(p => p.active) || [];
          const aMax = aPlans.length ? Math.max(...aPlans.map(p => finitePlanPrice(p))) : -Infinity;
          const bMax = bPlans.length ? Math.max(...bPlans.map(p => finitePlanPrice(p))) : -Infinity;
          return bMax - aMax;
        }
        return 0;
      });
  }, [products, selectedPriceRange, sortBy, searchQuery, selectedPlanType, onlyWithPlans]);

  const clearFilters = () => {
    setSelectedPriceRange(0);
    setSearchQuery("");
    setSelectedPlanType("Todos");
    setOnlyWithPlans(false);
  };

  const activeFiltersCount = [
    selectedPriceRange !== 0,
    searchQuery !== "",
    selectedPlanType !== "Todos",
    onlyWithPlans,
  ].filter(Boolean).length;

  const currentGame = games.find((g) => g.id === selectedGame);

  const renderFilterContent = () => (
    <>
      {/* Search */}
      <div className="relative mt-5">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar produtos..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-border bg-secondary/50 py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-success/50"
        />
      </div>

      {/* Price range filter */}
      <div className="mt-6">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <DollarSign className="h-4 w-4 text-success" />
          Faixa de Preço
        </h4>
        <div className="mt-3 flex flex-col gap-1.5">
          {priceRanges.map((range, idx) => (
            <button
              key={range.label}
              onClick={() => setSelectedPriceRange(idx)}
              className={`rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors ${
                selectedPriceRange === idx
                  ? "border-success bg-success/10 text-success"
                  : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {/* Plan type filter */}
      {availablePlanTypes.length > 1 && (
        <div className="mt-6">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Tag className="h-4 w-4 text-success" />
            Tipo de Plano
          </h4>
          <div className="mt-3 flex flex-wrap gap-2">
            {availablePlanTypes.map((type) => (
              <button
                key={type}
                onClick={() => setSelectedPlanType(type)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  selectedPlanType === type
                    ? "border-success bg-success/10 text-success"
                    : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sort inside sidebar */}
      <div className="mt-6">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <ArrowUpDown className="h-4 w-4 text-success" />
          Ordenar por
        </h4>
        <div className="mt-3 flex flex-col gap-1.5">
          {sortOptions.map((opt) => (
            <button
              key={opt}
              onClick={() => setSortBy(opt)}
              className={`rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors ${
                sortBy === opt
                  ? "border-success bg-success/10 text-success"
                  : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* Only with plans toggle */}
      <div className="mt-6">
        <label className="flex cursor-pointer items-center gap-3">
          <div className="relative">
            <input
              type="checkbox"
              checked={onlyWithPlans}
              onChange={(e) => setOnlyWithPlans(e.target.checked)}
              className="peer sr-only"
            />
            <div className="h-5 w-9 rounded-full border border-border bg-secondary transition-colors peer-checked:border-success peer-checked:bg-success" />
            <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-foreground/60 transition-all peer-checked:left-[18px] peer-checked:bg-success-foreground" />
          </div>
          <span className="text-xs font-medium text-muted-foreground">Apenas com planos</span>
        </label>
      </div>
    </>
  );

  const clearGameQueryParam = () => {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.delete("game");
        return p;
      },
      { replace: true },
    );
  };

  if (!selectedGame) {
    return (
      <GameSelectScreen
        onSelect={handleGameSelect}
        games={games}
        loading={loadingGames}
        error={gamesError}
        onRetry={() => void loadGames()}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-4 pb-20">
        <button
          onClick={() => {
            setSelectedGame(null);
            clearGameQueryParam();
          }}
          className="mb-4 sm:mb-6 flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-success"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar aos jogos
        </button>
        <div className="flex flex-col gap-3 sm:gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            {currentGame && (
              (localImageMap[currentGame.name] || currentGame.image_url)
                ? <img src={localImageMap[currentGame.name] || currentGame.image_url!} alt={currentGame.name} className="h-10 w-10 sm:h-14 sm:w-14 rounded-lg border border-border object-cover" />
                : <div className="flex h-10 w-10 sm:h-14 sm:w-14 items-center justify-center rounded-lg border border-border bg-secondary text-lg font-bold text-muted-foreground">{currentGame.name[0]}</div>
            )}
            <div>
              <h1 className="text-xl sm:text-3xl font-bold text-foreground" style={{ fontFamily: "'Valorant', sans-serif" }}>
                {currentGame?.name || "Produtos"}
              </h1>
              <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-muted-foreground">
                {loadingProducts ? "Carregando..." : `${filtered.length} produto${filtered.length !== 1 ? "s" : ""}`}
              </p>
            </div>
          </div>
          <div className="flex gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide">
            {sortOptions.map((opt) => (
              <button
                key={opt}
                onClick={() => setSortBy(opt)}
                className={`rounded border px-3 sm:px-4 py-1.5 sm:py-2 text-[11px] sm:text-xs font-medium transition-colors whitespace-nowrap ${
                  sortBy === opt
                    ? "border-success bg-success/10 text-success"
                    : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        <p className="mt-3 max-w-2xl text-xs leading-relaxed text-muted-foreground/85">
          Esta listagem é do catálogo <span className="font-medium text-foreground/80">Produtos</span> (software e entregas digitais).
          Para comprar <span className="font-medium text-foreground/80">conta pronta</span> do jogo, use{" "}
          <Link to="/contas" className="text-success underline-offset-2 hover:underline">Contas</Link>.
        </p>

        <div className="mt-8 flex flex-col gap-8 lg:flex-row">
          {/* ─── Mobile Filter Button ─── */}
          <button
            onClick={() => setMobileFiltersOpen(true)}
            className="flex lg:hidden items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground transition-all active:scale-[0.98]"
            style={{ borderColor: activeFiltersCount > 0 ? 'hsl(var(--success) / 0.6)' : undefined }}
          >
            <SlidersHorizontal className="h-4 w-4 text-success" />
            Filtros
            {activeFiltersCount > 0 && (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-success px-1 text-[10px] font-bold text-success-foreground">{activeFiltersCount}</span>
            )}
          </button>

          {/* ─── Mobile Filter Bottom Sheet ─── */}
          {mobileFiltersOpen && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileFiltersOpen(false)} />
              <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-card border-t border-border animate-in slide-in-from-bottom duration-300">
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-5 py-4 rounded-t-2xl">
                  <h3 className="flex items-center gap-2 text-base font-bold text-foreground">
                    <SlidersHorizontal className="h-4 w-4 text-success" />
                    Filtros
                    {activeFiltersCount > 0 && (
                      <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-success px-1 text-[10px] font-bold text-success-foreground">{activeFiltersCount}</span>
                    )}
                  </h3>
                  <div className="flex items-center gap-3">
                    <button onClick={clearFilters} className="text-xs text-muted-foreground transition-colors hover:text-success">Limpar</button>
                    <button onClick={() => setMobileFiltersOpen(false)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary transition-colors">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>
                <div className="p-5">
                  {renderFilterContent()}
                </div>
                <div className="sticky bottom-0 border-t border-border bg-card p-4">
                  <button
                    onClick={() => setMobileFiltersOpen(false)}
                    className="w-full rounded-xl bg-success py-3 text-sm font-bold text-success-foreground transition-all active:scale-[0.98]"
                  >
                    Ver resultados
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ─── Desktop Sidebar ─── */}
          <aside className="hidden shrink-0 lg:block lg:w-72">
            <div className="sticky top-28 max-h-[calc(100vh-8rem)] overflow-y-auto space-y-4 scrollbar-hide">
              <div className="rounded-lg border border-border bg-card p-5">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-base font-bold text-foreground">
                    <SlidersHorizontal className="h-4 w-4 text-success" />
                    Filtros
                    {activeFiltersCount > 0 && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success text-[10px] font-bold text-success-foreground">
                        {activeFiltersCount}
                      </span>
                    )}
                  </h3>
                  <button onClick={clearFilters} className="text-xs text-muted-foreground transition-colors hover:text-success">
                    Limpar
                  </button>
                </div>
                {renderFilterContent()}
              </div>
            </div>
          </aside>

          {/* Products Grid */}
          {loadingProducts ? (
            <div className="flex-1 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                 <Skeleton key={i} className="h-96 w-full rounded-lg" />
              ))}
            </div>
          ) : productsError ? (
            <div className="flex-1 flex flex-col items-center justify-center rounded-xl border border-destructive/25 bg-destructive/[0.06] px-6 py-16 text-center min-h-[280px]">
              <AlertCircle className="h-11 w-11 text-destructive/85 shrink-0" aria-hidden />
              <p className="mt-4 text-lg font-semibold text-foreground">Erro ao carregar produtos</p>
              <p className="mt-2 text-sm text-muted-foreground max-w-md leading-relaxed">{productsError}</p>
              <button
                type="button"
                onClick={() => selectedGame && void loadProductsForGame(selectedGame)}
                disabled={loadingProducts}
                className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-success px-5 py-2.5 text-sm font-bold text-success-foreground transition-opacity disabled:opacity-60 hover:opacity-95"
              >
                {loadingProducts && <Loader2 className="h-4 w-4 animate-spin" />}
                Tentar novamente
              </button>
            </div>
          ) : (
            <motion.div
              className="flex-1 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3"
              initial="hidden"
              animate="visible"
              variants={staggerContainer}
            >
              {filtered.map((product, idx) => (
                <motion.div key={product.id} variants={fadeUp} custom={idx}>
                  <ProductCard product={product} />
                </motion.div>
              ))}
              {filtered.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <Package className="h-10 w-10 mb-3 opacity-40" />
                  <p className="text-lg font-semibold">Nenhum produto encontrado</p>
                  <p className="mt-1 text-sm">Tente alterar os filtros ou cadastre produtos no admin</p>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Produtos;
