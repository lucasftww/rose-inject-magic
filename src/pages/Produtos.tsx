import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { Search, SlidersHorizontal, DollarSign, ArrowLeft, Loader2, Package, Tag, ArrowUpDown, UserCheck, X, ArrowRight, Star, Gamepad2 } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useReseller } from "@/hooks/useReseller";

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
  robot_game_id: number | null;
  product_plans: ProductPlan[];
  _stockCount?: number;
}

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
    const paidPlans = activePlans.filter(p => Number(p.price) > 0);
    if (paidPlans.length === 0) return Math.min(...activePlans.map(p => Number(p.price)));
    return Math.min(...paidPlans.map(p => Number(p.price)));
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
          <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
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

const GameSelectScreen = ({ onSelect, games, loading }: { onSelect: (gameId: string) => void; games: GameFromDB[]; loading: boolean }) => {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero header */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 pt-8 sm:pt-12 pb-2 sm:pb-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex items-center gap-3">
          <Gamepad2 className="h-5 w-5 text-success" />
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Escolha seu jogo</h1>
        </motion.div>
      </section>

      {loading ? (
        <div className="flex items-center justify-center py-32"><Loader2 className="h-8 w-8 animate-spin text-success" /></div>
      ) : games.length === 0 ? (
        <div className="py-32 text-center text-muted-foreground">Nenhum jogo disponível no momento.</div>
      ) : (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-14">
          <motion.div
            className="grid grid-cols-2 gap-3 sm:gap-5 sm:grid-cols-3 lg:grid-cols-4"
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
          >
            {games.map((game, idx) => {
              const descriptions: Record<string, string> = {
                'Valorant': 'Cheats premium para Valorant — domine cada round',
                'Counter-Strike 2': 'Hacks indetectados para CS2',
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
                'Bodycam': 'Cheats para Bodycam FPS',
                'Bloodhunt': 'Domine a caçada em Bloodhunt',
                'Warface': 'Hacks premium para Warface',
                'Dead by Daylight': 'Cheats para Dead by Daylight',
                'FiveM': 'Mods e menus para FiveM / GTA RP',
                'Squad': 'Softwares táticos para Squad',
                'Overwatch 2': 'Cheats para Overwatch 2',
                'Hell Let Loose': 'Domine o campo de batalha WW2',
              };
              const desc = descriptions[game.name] || `Softwares para ${game.name}`;

              return (
                <motion.button
                  key={game.id}
                  variants={fadeUp}
                  custom={idx}
                  onClick={() => onSelect(game.id)}
                  className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/40 bg-card text-left transition-all duration-300 hover:border-success/50 hover:shadow-[0_0_30px_hsl(197,100%,50%,0.15)] focus:outline-none active:scale-[0.97]"
                >
                  {/* Image area */}
                  <div className="relative aspect-[4/3] overflow-hidden">
                    {game.image_url ? (
                      <img
                        src={game.image_url}
                        alt={game.name}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-secondary">
                        <Gamepad2 className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground/15" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />

                    {/* Product count badge */}
                    {game.product_count > 0 && (
                      <div className="absolute top-2.5 right-2.5 flex items-center gap-1 rounded-full bg-success px-2.5 py-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-success-foreground shadow-lg">
                        <span className="h-1.5 w-1.5 rounded-full bg-success-foreground animate-pulse" />
                        {game.product_count} {game.product_count === 1 ? "software" : "softwares"}
                      </div>
                    )}

                    {/* Game name overlay */}
                    <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
                      <h3 className="text-base sm:text-lg lg:text-xl font-bold tracking-tight text-foreground leading-tight drop-shadow-lg" style={{ fontFamily: "'Valorant', sans-serif" }}>
                        {game.name}
                      </h3>
                      <p className="mt-0.5 text-[10px] sm:text-xs text-muted-foreground/80 line-clamp-1">{desc}</p>
                    </div>
                  </div>

                  {/* CTA bar */}
                  <div className="flex items-center justify-center gap-1.5 border-t border-border/30 bg-card/80 px-3 py-2.5 sm:py-3 text-success text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-all group-hover:bg-success/10 group-hover:gap-2.5">
                    <span>Ver softwares {game.name.split(' ')[0]}</span>
                    <ArrowRight className="h-3 w-3 sm:h-3.5 sm:w-3.5 transition-transform group-hover:translate-x-1" />
                  </div>
                </motion.button>
              );
            })}
          </motion.div>
        </div>
      )}
    </div>
  );
};

const Produtos = () => {
  const navigate = useNavigate();
  const [games, setGames] = useState<GameFromDB[]>([]);
  const [loadingGames, setLoadingGames] = useState(true);
  const [products, setProducts] = useState<ProductFromDB[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [selectedPriceRange, setSelectedPriceRange] = useState(0);
  const [sortBy, setSortBy] = useState<typeof sortOptions[number]>("Mais Recentes");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlanType, setSelectedPlanType] = useState("Todos");
  const [onlyWithPlans, setOnlyWithPlans] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Fetch games with real product counts
  useEffect(() => {
    const fetchGames = async () => {
      const [gamesRes, productsRes] = await Promise.all([
        supabase.from("games").select("id, name, slug, image_url, active, sort_order").eq("active", true).order("sort_order", { ascending: true }),
        supabase.from("products").select("id, game_id").eq("active", true),
      ]);

      if (gamesRes.data) {
        const countMap: Record<string, number> = {};
        (productsRes.data || []).forEach((p: any) => {
          countMap[p.game_id] = (countMap[p.game_id] || 0) + 1;
        });
        setGames(gamesRes.data.map((g: any) => ({ ...g, product_count: countMap[g.id] || 0 })));
      }
      setLoadingGames(false);
    };
    fetchGames();
  }, []);

  // Fetch products when game is selected
  useEffect(() => {
    if (!selectedGame) { setProducts([]); return; }
    const fetchProducts = async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, description, image_url, active, sort_order, game_id, created_at, status, status_label, status_updated_at, features_text, robot_game_id, product_plans(*)")
        .eq("game_id", selectedGame)
        .eq("active", true)
        .order("sort_order", { ascending: true });
      if (data) setProducts(data as any);
      setLoadingProducts(false);
    };
    fetchProducts();
  }, [selectedGame]);

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
        const lowest = Math.min(...plans.map(pl => Number(pl.price)));
        return lowest >= range.min && lowest <= range.max;
      })
      .sort((a, b) => {
        if (sortBy === "Menor Preço") {
          const aMin = Math.min(...(a.product_plans?.filter(p => p.active).map(p => Number(p.price)) || [Infinity]));
          const bMin = Math.min(...(b.product_plans?.filter(p => p.active).map(p => Number(p.price)) || [Infinity]));
          return aMin - bMin;
        }
        if (sortBy === "Maior Preço") {
          const aMax = Math.max(...(a.product_plans?.filter(p => p.active).map(p => Number(p.price)) || [0]));
          const bMax = Math.max(...(b.product_plans?.filter(p => p.active).map(p => Number(p.price)) || [0]));
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

  const handleGameSelect = async (gameId: string) => {
    const game = games.find(g => g.id === gameId);
    if (game && game.product_count === 1) {
      // Only 1 product — navigate directly to it
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
  };

  if (!selectedGame) {
    return <GameSelectScreen onSelect={handleGameSelect} games={games} loading={loadingGames} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-4 pb-20">
        <button
          onClick={() => setSelectedGame(null)}
          className="mb-4 sm:mb-6 flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-success"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar aos jogos
        </button>
        <div className="flex flex-col gap-3 sm:gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            {currentGame && (
              currentGame.image_url
                ? <img src={currentGame.image_url} alt={currentGame.name} className="h-10 w-10 sm:h-14 sm:w-14 rounded-lg border border-border object-cover" />
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
            <div className="flex-1 flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-success" />
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
