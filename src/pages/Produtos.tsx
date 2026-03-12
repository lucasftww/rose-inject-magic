import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { Search, SlidersHorizontal, DollarSign, ArrowLeft, Loader2, Package, Tag, ArrowUpDown, UserCheck } from "lucide-react";
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
  product_plans: ProductPlan[];
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

  const isResellerProduct = isReseller && isResellerForProduct(product.id);
  const discountedPrice = lowestPrice !== null && isResellerProduct ? getDiscountedPrice(product.id, lowestPrice) : null;

  return (
    <div
      onClick={() => navigate(`/produto/${product.id}`)}
      className="group cursor-pointer overflow-hidden rounded-lg border border-border bg-card transition-all hover:border-success/40 hover:shadow-[0_0_20px_hsl(130,99%,41%,0.1)]"
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

const GameSelectScreen = ({ onSelect, games, loading }: { onSelect: (gameId: string) => void; games: GameFromDB[]; loading: boolean }) => (
  <div className="min-h-screen bg-background">
    <Header />
    <div className="mx-auto max-w-5xl px-4 sm:px-6 pt-4 pb-20">
      <motion.div
        className="text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <p className="text-xs sm:text-sm font-medium uppercase tracking-[0.3em] text-success">Selecione o Jogo</p>
        <h1 className="mt-2 sm:mt-3 text-2xl sm:text-4xl font-bold tracking-tight text-foreground md:text-6xl" style={{ fontFamily: "'Valorant', sans-serif" }}>
          ESCOLHA SEU JOGO
        </h1>
        <p className="mt-2 sm:mt-4 text-sm sm:text-base text-muted-foreground">Selecione o jogo para ver os produtos disponíveis</p>
      </motion.div>

      {loading ? (
        <div className="mt-14 sm:mt-20 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-success" /></div>
      ) : games.length === 0 ? (
        <div className="mt-14 sm:mt-20 text-center text-muted-foreground">Nenhum jogo disponível no momento.</div>
      ) : (
        <motion.div
          className="mt-8 sm:mt-14 grid grid-cols-2 gap-3 sm:gap-6 sm:grid-cols-3"
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
        >
          {games.map((game, idx) => (
            <motion.button
              key={game.id}
              variants={fadeUp}
              custom={idx}
              onClick={() => onSelect(game.id)}
              className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card transition-all duration-500 hover:border-success/50 hover:shadow-[0_0_40px_hsl(130,99%,41%,0.12)] focus:outline-none"
            >
              <div className="relative aspect-[4/5] overflow-hidden">
                {game.image_url ? (
                  <img
                    src={game.image_url}
                    alt={game.name}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-secondary text-5xl font-bold text-muted-foreground/20">
                    {game.name[0]}
                  </div>
                )}
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-80 transition-opacity duration-500 group-hover:opacity-90" />
                
                {/* Glow line on hover */}
                <div className="absolute bottom-0 left-0 h-[2px] w-full bg-gradient-to-r from-transparent via-success to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              </div>

              {/* Content */}
              <div className="absolute bottom-0 left-0 w-full p-5 md:p-6">
                <div className="flex items-end justify-between gap-3">
                  <div className="text-left">
                    <h3
                      className="text-lg font-bold text-white md:text-2xl drop-shadow-lg"
                      style={{ fontFamily: "'Valorant', sans-serif" }}
                    >
                      {game.name}
                    </h3>
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-white/60 md:text-sm">
                      <Package className="h-3.5 w-3.5" />
                      {game.product_count} {game.product_count === 1 ? "produto" : "produtos"}
                    </p>
                  </div>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/40 backdrop-blur-sm transition-all duration-300 group-hover:border-success/40 group-hover:bg-success/20 group-hover:text-success md:h-10 md:w-10">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </motion.button>
          ))}
        </motion.div>
      )}
    </div>
  </div>
);

const Produtos = () => {
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

  // Fetch games with real product counts
  useEffect(() => {
    const fetchGames = async () => {
      const [gamesRes, productsRes] = await Promise.all([
        supabase.from("games").select("*").eq("active", true).order("sort_order", { ascending: true }),
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
      setLoadingProducts(true);
      const { data } = await supabase
        .from("products")
        .select("*, product_plans(*)")
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

  if (!selectedGame) {
    return <GameSelectScreen onSelect={setSelectedGame} games={games} loading={loadingGames} />;
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
          {/* Sidebar Filters */}
          <aside className="w-full shrink-0 lg:w-72">
            <div className="sticky top-28 space-y-4">
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
