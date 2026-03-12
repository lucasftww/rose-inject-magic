import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw, Wifi, WifiOff, Gamepad2, AlertTriangle, CheckCircle, Package, DollarSign, Clock, Zap } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface RobotGame {
  id: number;
  name: string;
  version: string;
  status: string;
  icon: string;
  is_free: boolean;
  prices: Record<string, number>;
  maxKeys: number | null;
  soldKeys: number;
}

interface ProductWithRobot {
  id: string;
  name: string;
  image_url: string | null;
  robot_game_id: number | null;
  robot_markup_percent: number | null;
  hasStock: boolean;
  stockCount: number;
}

const RobotProjectTab = () => {
  const [loading, setLoading] = useState(true);
  const [pingStatus, setPingStatus] = useState<"online" | "offline" | "loading">("loading");
  const [robotGames, setRobotGames] = useState<RobotGame[]>([]);
  const [productsWithRobot, setProductsWithRobot] = useState<ProductWithRobot[]>([]);
  const [loadingGames, setLoadingGames] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const checkPing = async () => {
    setPingStatus("loading");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/robot-project?action=ping`,
        {
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );
      setPingStatus(response.ok ? "online" : "offline");
    } catch {
      setPingStatus("offline");
    }
  };

  const fetchRobotGames = async () => {
    setLoadingGames(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/robot-project?action=list-games`,
        {
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );
      if (response.ok) {
        const data = await response.json();
        setRobotGames(Array.isArray(data) ? data : data.games || []);
      } else {
        toast({ title: "Erro ao carregar jogos Robot", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro de conexão com Robot Project", variant: "destructive" });
    }
    setLoadingGames(false);
  };

  const fetchProductsWithRobot = async () => {
    const { data: products } = await supabase
      .from("products")
      .select("id, name, image_url, robot_game_id, robot_markup_percent")
      .not("robot_game_id", "is", null)
      .eq("active", true);

    if (!products || products.length === 0) {
      setProductsWithRobot([]);
      return;
    }

    const productIds = products.map(p => p.id);
    const { data: plans } = await supabase
      .from("product_plans")
      .select("id, product_id")
      .in("product_id", productIds)
      .eq("active", true);

    const planIds = (plans || []).map(p => p.id);
    const planToProduct: Record<string, string> = {};
    (plans || []).forEach(p => { planToProduct[p.id] = p.product_id; });

    let stockCounts: Record<string, number> = {};
    if (planIds.length > 0) {
      const { data: stockData } = await supabase
        .from("stock_items")
        .select("product_plan_id")
        .in("product_plan_id", planIds)
        .eq("used", false);

      (stockData || []).forEach(s => {
        const productId = planToProduct[s.product_plan_id];
        if (productId) {
          stockCounts[productId] = (stockCounts[productId] || 0) + 1;
        }
      });
    }

    setProductsWithRobot(products.map(p => ({
      ...p,
      hasStock: (stockCounts[p.id] || 0) > 0,
      stockCount: stockCounts[p.id] || 0,
    })));
  };

  const refreshAll = async () => {
    setLoading(true);
    await Promise.all([checkPing(), fetchRobotGames(), fetchProductsWithRobot()]);
    setLastRefresh(new Date());
    setLoading(false);
  };

  useEffect(() => { refreshAll(); }, []);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">Robot Project</h2>
        <button
          onClick={refreshAll}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:border-success hover:text-success disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </button>
      </div>

      {lastRefresh && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Última atualização: {lastRefresh.toLocaleTimeString("pt-BR")}
        </p>
      )}

      {/* Status Cards */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* API Status */}
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
              pingStatus === "online" ? "bg-success/10" : pingStatus === "offline" ? "bg-destructive/10" : "bg-muted"
            }`}>
              {pingStatus === "loading" ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : pingStatus === "online" ? (
                <Wifi className="h-5 w-5 text-success" />
              ) : (
                <WifiOff className="h-5 w-5 text-destructive" />
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status da API</p>
              <p className={`text-sm font-bold ${
                pingStatus === "online" ? "text-success" : pingStatus === "offline" ? "text-destructive" : "text-muted-foreground"
              }`}>
                {pingStatus === "loading" ? "Verificando..." : pingStatus === "online" ? "Online" : "Offline"}
              </p>
            </div>
          </div>
        </div>

        {/* Games Available */}
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
              <Gamepad2 className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Jogos Disponíveis</p>
              <p className="text-sm font-bold text-foreground">
                {loadingGames ? "..." : robotGames.length}
              </p>
            </div>
          </div>
        </div>

        {/* Products Linked */}
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <Package className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Produtos Vinculados</p>
              <p className="text-sm font-bold text-foreground">{productsWithRobot.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Products with Robot - Stock Status */}
      <div className="mt-8">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Package className="h-4 w-4 text-success" />
          Produtos Robot Project — Status do Estoque
        </h3>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-success" />
          </div>
        ) : productsWithRobot.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
            Nenhum produto vinculado ao Robot Project.
            <br />
            <span className="text-xs">Vincule um produto em Produtos → Editar → Robot Game ID</span>
          </div>
        ) : (
          <div className="space-y-2">
            {productsWithRobot.map(product => {
              const linkedGame = robotGames.find(g => g.id === product.robot_game_id);
              return (
                <div
                  key={product.id}
                  className={`flex items-center gap-4 rounded-lg border p-4 ${
                    product.hasStock
                      ? "border-border bg-card"
                      : "border-warning/30 bg-warning/5"
                  }`}
                >
                  {product.image_url ? (
                    <img src={product.image_url} alt="" className="h-12 w-12 rounded-lg border border-border object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-secondary">
                      <Package className="h-5 w-5 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{product.name}</p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-[11px] text-muted-foreground">
                        Robot ID: <span className="font-mono text-foreground">{product.robot_game_id}</span>
                      </span>
                      {product.robot_markup_percent && (
                        <span className="text-[11px] text-muted-foreground">
                          Markup: <span className="font-mono text-foreground">{product.robot_markup_percent}%</span>
                        </span>
                      )}
                      {linkedGame && (
                        <span className={`text-[11px] ${linkedGame.status === "on" ? "text-success" : "text-destructive"}`}>
                          {linkedGame.status === "on" ? "● Online" : "● Offline"}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {product.hasStock ? (
                      <span className="flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-bold text-success">
                        <CheckCircle className="h-3.5 w-3.5" />
                        {product.stockCount} em estoque
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 rounded-full bg-warning/10 px-3 py-1 text-xs font-bold text-warning">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Sem estoque
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Robot Games List */}
      <div className="mt-8">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Gamepad2 className="h-4 w-4 text-success" />
          Jogos Disponíveis na API
        </h3>

        {loadingGames ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-success" />
          </div>
        ) : robotGames.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
            Nenhum jogo retornado pela API.
            <br />
            <span className="text-xs">Verifique as credenciais em Credenciais → ROBOT_API_USERNAME / PASSWORD</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {robotGames.map(game => {
              const linkedProduct = productsWithRobot.find(p => p.robot_game_id === game.id);
              const priceEntries = game.prices ? Object.entries(game.prices) : [];
              const slotsAvailable = game.maxKeys ? game.maxKeys - game.soldKeys : null;

              return (
                <div
                  key={game.id}
                  className={`rounded-lg border p-4 ${
                    linkedProduct ? "border-success/30 bg-success/5" : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-foreground">{game.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-[11px] text-muted-foreground">ID: {game.id}</p>
                        <span className="text-[10px] text-muted-foreground">v{game.version}</span>
                        <span className={`text-[10px] font-bold ${game.status === "on" ? "text-success" : "text-destructive"}`}>
                          {game.status === "on" ? "● ON" : "● OFF"}
                        </span>
                        {game.is_free && (
                          <span className="rounded bg-accent/20 px-1.5 py-0.5 text-[9px] font-bold text-accent-foreground">FREE</span>
                        )}
                      </div>
                    </div>
                    {linkedProduct ? (
                      <span className="rounded bg-success/20 px-2 py-0.5 text-[10px] font-bold text-success">
                        Vinculado
                      </span>
                    ) : (
                      <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                        Não vinculado
                      </span>
                    )}
                  </div>

                  {/* Prices by duration */}
                  {priceEntries.length > 0 && (
                    <div className="mt-3 space-y-1">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                        <DollarSign className="h-3 w-3" /> Preços por duração
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {priceEntries.map(([days, price]) => (
                          <span key={days} className="inline-flex items-center gap-1 rounded-md bg-secondary/60 border border-border px-2 py-0.5 text-[11px]">
                            <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                            <span className="text-muted-foreground">{days}d</span>
                            <span className="font-bold text-foreground">R${Number(price).toFixed(2)}</span>
                          </span>
                        ))}
                      </div>
                      {linkedProduct?.robot_markup_percent && (
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {priceEntries.map(([days, price]) => {
                            const withMarkup = Number(price) * (1 + (linkedProduct.robot_markup_percent || 0) / 100);
                            return (
                              <span key={`mk-${days}`} className="inline-flex items-center gap-1 rounded-md bg-accent/10 border border-accent/20 px-2 py-0.5 text-[11px]">
                                <Zap className="h-2.5 w-2.5 text-accent-foreground" />
                                <span className="text-muted-foreground">{days}d</span>
                                <span className="font-bold text-accent-foreground">R${withMarkup.toFixed(2)}</span>
                                <span className="text-[9px] text-muted-foreground">+{linkedProduct.robot_markup_percent}%</span>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Slots info */}
                  {game.maxKeys !== null && game.maxKeys > 0 && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            slotsAvailable !== null && slotsAvailable <= 5 ? "bg-warning" : "bg-success"
                          }`}
                          style={{ width: `${Math.min(100, ((game.soldKeys || 0) / game.maxKeys) * 100)}%` }}
                        />
                      </div>
                      <span className={`text-[10px] font-bold ${
                        slotsAvailable !== null && slotsAvailable <= 5 ? "text-warning" : "text-muted-foreground"
                      }`}>
                        {game.soldKeys}/{game.maxKeys} slots
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default RobotProjectTab;
