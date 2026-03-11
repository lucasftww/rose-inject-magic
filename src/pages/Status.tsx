import { useState, useEffect } from "react";
import Header from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ShieldCheck, ShieldAlert, RefreshCw, Clock } from "lucide-react";
import { motion } from "framer-motion";

interface ProductStatus {
  id: string;
  name: string;
  image_url: string | null;
  status: string;
  status_label: string;
  status_updated_at: string;
  game_name: string;
  game_image: string | null;
}

const statusConfig: Record<string, { color: string; bg: string; border: string; icon: typeof ShieldCheck }> = {
  undetected: { color: "text-success", bg: "bg-success/10", border: "border-success/30", icon: ShieldCheck },
  detected: { color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/30", icon: ShieldAlert },
  updating: { color: "text-warning", bg: "bg-warning/10", border: "border-warning/30", icon: RefreshCw },
  offline: { color: "text-muted-foreground", bg: "bg-muted/10", border: "border-border", icon: Clock },
};

const Status = () => {
  const [products, setProducts] = useState<ProductStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, image_url, status, status_label, status_updated_at, game_id, games(name, image_url)")
        .eq("active", true)
        .order("sort_order");

      if (data) {
        setProducts(
          data.map((p: any) => ({
            id: p.id,
            name: p.name,
            image_url: p.image_url,
            status: p.status,
            status_label: p.status_label,
            status_updated_at: p.status_updated_at,
            game_name: p.games?.name || "",
            game_image: p.games?.image_url || null,
          }))
        );
      }
      setLoading(false);
    };
    fetch();
  }, []);

  const grouped = products.reduce<Record<string, ProductStatus[]>>((acc, p) => {
    if (!acc[p.game_name]) acc[p.game_name] = [];
    acc[p.game_name].push(p);
    return acc;
  }, {});

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}min atrás`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h atrás`;
    return `${Math.floor(hours / 24)}d atrás`;
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-5xl px-6 pt-4 pb-20">
        <div className="mb-10 text-center">
          <h1
            className="text-3xl font-bold text-foreground"
            style={{ fontFamily: "'Valorant', sans-serif" }}
          >
            <span className="text-success">STATUS</span> DOS PRODUTOS
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Acompanhe o status de detecção de cada produto em tempo real
          </p>
        </div>

        {/* Legend */}
        <div className="mb-8 flex flex-wrap justify-center gap-4">
          {[
            { key: "undetected", label: "Indetectável" },
            { key: "updating", label: "Atualizando" },
            { key: "detected", label: "Detectável" },
            { key: "offline", label: "Offline" },
          ].map((s) => {
            const cfg = statusConfig[s.key];
            const Icon = cfg.icon;
            return (
              <div key={s.key} className={`flex items-center gap-2 rounded-lg ${cfg.bg} ${cfg.border} border px-3 py-1.5`}>
                <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
                <span className={`text-xs font-semibold ${cfg.color}`}>{s.label}</span>
              </div>
            );
          })}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-success" />
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-muted-foreground">
            <ShieldCheck className="h-12 w-12 opacity-20" />
            <p className="mt-3 font-semibold">Nenhum produto cadastrado</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(grouped).map(([gameName, prods]) => (
              <div key={gameName}>
                <div className="mb-3 flex items-center gap-2">
                  {prods[0].game_image && (
                    <img src={prods[0].game_image} alt={gameName} className="h-6 w-6 rounded object-cover" />
                  )}
                  <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">{gameName}</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {prods.map((product, idx) => {
                    const cfg = statusConfig[product.status] || statusConfig.offline;
                    const Icon = cfg.icon;
                    return (
                      <motion.div
                        key={product.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.04 }}
                        className={`relative flex flex-col items-center rounded-xl border ${cfg.border} bg-card overflow-hidden transition-all hover:shadow-md hover:scale-[1.02]`}
                      >
                        <div className="w-full aspect-square overflow-hidden bg-secondary/50">
                          {product.image_url ? (
                            <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <ShieldCheck className="h-8 w-8 text-muted-foreground/20" />
                            </div>
                          )}
                        </div>
                        <div className="w-full p-3 text-center space-y-1.5">
                          <h3 className="text-xs font-bold text-foreground truncate">{product.name}</h3>
                          <div className={`inline-flex items-center gap-1.5 rounded-lg ${cfg.bg} ${cfg.border} border px-2.5 py-1`}>
                            <Icon className={`h-3 w-3 ${cfg.color} ${product.status === "updating" ? "animate-spin" : ""}`} />
                            <span className={`text-[10px] font-bold ${cfg.color}`}>
                              {product.status_label}
                            </span>
                          </div>
                          <p className="text-[9px] text-muted-foreground">
                            {timeAgo(product.status_updated_at)}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Status;
