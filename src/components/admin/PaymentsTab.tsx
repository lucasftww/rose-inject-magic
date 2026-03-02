import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, QrCode, CreditCard, Bitcoin } from "lucide-react";

interface PaymentSetting {
  id: string;
  method: string;
  enabled: boolean;
  label: string;
}

const methodIcons: Record<string, typeof QrCode> = {
  pix: QrCode,
  card: CreditCard,
  crypto: Bitcoin,
};

const PaymentsTab = () => {
  const [settings, setSettings] = useState<PaymentSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from("payment_settings")
      .select("*")
      .order("method");
    if (!error && data) setSettings(data as PaymentSetting[]);
    setLoading(false);
  };

  useEffect(() => { fetchSettings(); }, []);

  const toggleMethod = async (setting: PaymentSetting) => {
    setToggling(setting.id);
    const newEnabled = !setting.enabled;
    const { error } = await supabase
      .from("payment_settings")
      .update({ enabled: newEnabled })
      .eq("id", setting.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setSettings((prev) =>
        prev.map((s) => (s.id === setting.id ? { ...s, enabled: newEnabled } : s))
      );
      toast({ title: `${setting.label} ${newEnabled ? "ativado" : "desativado"}` });
    }
    setToggling(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-success" />
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-foreground mb-6">Métodos de Pagamento</h2>
      <p className="text-sm text-muted-foreground mb-8">
        Ative ou desative os métodos de pagamento disponíveis no checkout.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        {settings.map((s) => {
          const Icon = methodIcons[s.method] || QrCode;
          return (
            <div
              key={s.id}
              className={`relative flex flex-col items-center gap-4 rounded-xl border-2 p-8 transition-all ${
                s.enabled
                  ? "border-success/40 bg-success/5"
                  : "border-border bg-card opacity-60"
              }`}
            >
              <div
                className={`flex h-16 w-16 items-center justify-center rounded-full border transition-colors ${
                  s.enabled
                    ? "border-success/50 bg-success/10"
                    : "border-border bg-secondary/50"
                }`}
              >
                <Icon
                  className={`h-8 w-8 ${
                    s.enabled ? "text-success" : "text-muted-foreground"
                  }`}
                />
              </div>
              <h3 className="text-lg font-bold text-foreground">{s.label}</h3>
              <span
                className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
                  s.enabled
                    ? "bg-success/20 text-success"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                {s.enabled ? "Ativo" : "Desativado"}
              </span>
              <button
                onClick={() => toggleMethod(s)}
                disabled={toggling === s.id}
                className={`mt-2 w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
                  s.enabled
                    ? "border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20"
                    : "bg-success px-6 text-success-foreground hover:shadow-[0_0_24px_hsl(130,99%,41%,0.45)]"
                }`}
              >
                {toggling === s.id ? (
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                ) : s.enabled ? (
                  "Desativar"
                ) : (
                  "Ativar"
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PaymentsTab;
