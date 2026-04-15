import { useState, useMemo, useEffect } from "react";
import { useAdminCredentialsList } from "@/hooks/useAdminData";
import { Key, CheckCircle, ExternalLink, Plus, Pencil, Trash2, Loader2, X, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "@/hooks/use-toast";
import { safeHttpUrl } from "@/lib/safeUrl";

interface Credential {
  /** Opcional: bases legadas só têm env_key como chave única. */
  id?: string;
  name: string;
  env_key: string;
  value: string;
  description: string | null;
  help_url: string | null;
}

/** Modelos com os nomes exatos que pix-payment / lzt-market leem na base. */
type CredentialRow = Tables<"system_credentials">;

function credentialFromRow(r: CredentialRow): Credential {
  return {
    id: (r as unknown as Record<string, unknown>).id as string | undefined,
    name: r.name,
    env_key: r.env_key,
    value: "",
    description: r.description,
    help_url: r.help_url,
  };
}

const CREDENTIAL_PRESETS: { name: string; env_key: string; description: string; help_url: string }[] = [
  {
    name: "LZT Market — JWT",
    env_key: "LZT_MARKET_TOKEN",
    description: "JWT da API LZT. Alternativa: cria também LZT_API_TOKEN com o mesmo valor se preferires esse nome.",
    help_url: "https://lzt.market",
  },
  {
    name: "Meta — CAPI Access Token",
    env_key: "META_ACCESS_TOKEN",
    description: "Token Graph API para eventos de conversão (compras).",
    help_url: "https://developers.facebook.com/docs/marketing-api/conversions-api/get-started",
  },
  {
    name: "Meta — Pixel ID",
    env_key: "META_PIXEL_ID",
    description: "ID numérico do teu Pixel (o mesmo do site).",
    help_url: "https://business.facebook.com/events_manager",
  },
  {
    name: "Meta — Test Event Code (opcional)",
    env_key: "META_TEST_EVENT_CODE",
    description:
      "Código da aba «Testar eventos» no Events Manager. Envia CAPI (relay + compra) só para testes. Apaga este valor em produção.",
    help_url: "https://developers.facebook.com/docs/marketing-api/conversions-api/using-the-api#test",
  },
  {
    name: "MisticPay — Client ID",
    env_key: "MISTICPAY_CLIENT_ID",
    description: "Client ID do gateway MisticPay.",
    help_url: "",
  },
  {
    name: "MisticPay — Client Secret",
    env_key: "MISTICPAY_CLIENT_SECRET",
    description: "Client Secret do MisticPay.",
    help_url: "",
  },
  {
    name: "Robot API — utilizador",
    env_key: "ROBOT_API_USERNAME",
    description: "Utilizador da API Robot (cheats), se usares.",
    help_url: "",
  },
  {
    name: "Robot API — palavra-passe",
    env_key: "ROBOT_API_PASSWORD",
    description: "Palavra-passe da API Robot.",
    help_url: "",
  },
];

const CredentialsTab = () => {
  const { data: credentialRows = [], isPending: loading, isError, error, refetch: refetchCredentials } =
    useAdminCredentialsList();
  const credentials = useMemo(() => credentialRows.map(credentialFromRow), [credentialRows]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Credential | null>(null);
  /** Linha em edição identificada por env_key (sempre existe; evita .eq("id", undefined) se não houver coluna id). */
  const [editingRowEnvKey, setEditingRowEnvKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [credentialSecretLoading, setCredentialSecretLoading] = useState(false);

  const [formName, setFormName] = useState("");
  const [formEnvKey, setFormEnvKey] = useState("");
  const [formValue, setFormValue] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formHelpUrl, setFormHelpUrl] = useState("");

  useEffect(() => {
    if (!isError) return;
    toast({
      title: "Erro ao carregar credenciais",
      description: error instanceof Error ? error.message : "Tente novamente.",
      variant: "destructive",
    });
  }, [isError, error]);

  const existingEnvKeys = useMemo(
    () => new Set(credentials.map((c) => c.env_key.toUpperCase())),
    [credentials],
  );

  const hasLztToken = existingEnvKeys.has("LZT_MARKET_TOKEN") || existingEnvKeys.has("LZT_API_TOKEN");

  const missingPresets = useMemo(() => {
    return CREDENTIAL_PRESETS.filter((p) => {
      if (p.env_key === "LZT_MARKET_TOKEN") return !hasLztToken;
      return !existingEnvKeys.has(p.env_key);
    });
  }, [existingEnvKeys, hasLztToken]);

  const openPreset = (preset: (typeof CREDENTIAL_PRESETS)[0]) => {
    setFormName(preset.name);
    setFormEnvKey(preset.env_key);
    setFormDescription(preset.description);
    setFormHelpUrl(preset.help_url);
    setFormValue("");
    setEditing(null);
    setEditingRowEnvKey(null);
    setCredentialSecretLoading(false);
    setShowForm(true);
  };

  const resetForm = () => {
    setFormName(""); setFormEnvKey(""); setFormValue(""); setFormDescription(""); setFormHelpUrl("");
    setEditing(null);
    setEditingRowEnvKey(null);
    setShowForm(false);
    setCredentialSecretLoading(false);
  };

  const openEdit = (cred: Credential) => {
    setEditing(cred);
    setEditingRowEnvKey(cred.env_key);
    setFormName(cred.name);
    setFormEnvKey(cred.env_key);
    setFormValue("");
    setFormDescription(cred.description || "");
    setFormHelpUrl(cred.help_url || "");
    setCredentialSecretLoading(true);
    setShowForm(true);
    void supabase
      .from("system_credentials")
      .select("value")
      .eq("env_key", cred.env_key)
      .maybeSingle()
      .then(({ data, error }) => {
        setCredentialSecretLoading(false);
        if (error) {
          toast({ title: "Erro ao carregar valor", description: error.message, variant: "destructive" });
          return;
        }
        if (data?.value != null) setFormValue(data.value);
      });
  };

  const handleSave = async () => {
    if (!formName.trim() || !formEnvKey.trim()) {
      toast({ title: "Preencha nome e chave", variant: "destructive" });
      return;
    }
    setSaving(true);
    if (editing) {
      const rowEnvKey = editingRowEnvKey || editing.env_key;
      if (!rowEnvKey?.trim()) {
        toast({ title: "Erro", description: "Chave ENV inválida para atualizar.", variant: "destructive" });
        setSaving(false);
        return;
      }
      const updateRow: {
        name: string;
        env_key: string;
        description: string | null;
        help_url: string | null;
        value?: string;
      } = {
        name: formName.trim(),
        env_key: formEnvKey.trim().toUpperCase(),
        description: formDescription.trim() || null,
        help_url: formHelpUrl.trim() || null,
      };
      if (formValue.trim().length > 0) updateRow.value = formValue;
      const { error } = await supabase.from("system_credentials").update(updateRow).eq("env_key", rowEnvKey);
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else { toast({ title: "Credencial atualizada!" }); resetForm(); void refetchCredentials(); }
    } else {
      // Upsert: seed/migrations may already have a row for this env_key (empty value) — insert would duplicate or hit RLS confusion
      const row = {
        name: formName.trim(),
        env_key: formEnvKey.trim().toUpperCase(),
        value: formValue,
        description: formDescription.trim() || null,
        help_url: formHelpUrl.trim() || null,
      };
      const { error } = await supabase.from("system_credentials").upsert(row, {
        onConflict: "env_key",
      });
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else { toast({ title: "Credencial guardada!" }); resetForm(); void refetchCredentials(); }
    }
    setSaving(false);
  };

  const handleDelete = async (cred: Credential) => {
    if (!confirm(`Excluir "${cred.name}"?`)) return;
    const { error } = await supabase.from("system_credentials").delete().eq("env_key", cred.env_key);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Credencial excluída!" }); void refetchCredentials(); }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">Credenciais</h2>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 rounded-lg bg-success px-5 py-2.5 text-sm font-semibold text-success-foreground"
        >
          <Plus className="h-4 w-4" /> Nova Credencial
        </button>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Gerencie as chaves de API e credenciais do sistema. As credenciais são armazenadas de forma segura no banco de dados.
        O código das funções Edge lê primeiro esta tabela e só depois os secrets do Supabase.
      </p>

      {missingPresets.length > 0 && (
        <div className="mt-5 rounded-xl border border-warning/30 bg-warning/5 p-4">
          <p className="text-sm font-semibold text-foreground">Sugestão — ainda falta configurar</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Clica num modelo para abrir o formulário com a chave (ENV) correta; depois cola o valor real e guarda.
            Eu não tenho acesso aos teus tokens: tens de os copiar de LZT Market, Meta Business e MisticPay.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {missingPresets.map((p) => (
              <button
                key={p.env_key}
                type="button"
                onClick={() => openPreset(p)}
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-left text-[11px] font-mono text-foreground hover:border-success/50 hover:bg-success/5"
              >
                + {p.env_key}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="mt-6 rounded-lg border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-foreground">{editing ? "Editar Credencial" : "Nova Credencial"}</h3>
            <button onClick={resetForm} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Nome</label>
              <input type="text" value={formName} onChange={(e) => setFormName(e.target.value.slice(0, 100))} placeholder="Ex: Stripe API Key"
                className="mt-1 w-full rounded-lg border border-border bg-secondary/50 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-success/50" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Chave (ENV)</label>
              <input type="text" value={formEnvKey} onChange={(e) => setFormEnvKey(e.target.value.slice(0, 100).toUpperCase().replace(/[^A-Z0-9_]/g, ""))} placeholder="Ex: STRIPE_API_KEY"
                className="mt-1 w-full rounded-lg border border-border bg-secondary/50 px-4 py-2.5 text-sm font-mono text-foreground placeholder:text-muted-foreground outline-none focus:border-success/50" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Valor</label>
              <input
                type="password"
                autoComplete="off"
                value={formValue}
                onChange={(e) => setFormValue(e.target.value.slice(0, 500))}
                placeholder={editing ? "Deixe vazio para manter o valor atual" : "Cole o valor da credencial aqui"}
                disabled={Boolean(editing && credentialSecretLoading)}
                className="mt-1 w-full rounded-lg border border-border bg-secondary/50 px-4 py-2.5 text-sm font-mono text-foreground placeholder:text-muted-foreground outline-none focus:border-success/50 disabled:opacity-60"
              />
              {editing && credentialSecretLoading && (
                <p className="mt-1 text-xs text-muted-foreground">A carregar valor seguro…</p>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Descrição (opcional)</label>
              <input type="text" value={formDescription} onChange={(e) => setFormDescription(e.target.value.slice(0, 200))} placeholder="Breve descrição da credencial"
                className="mt-1 w-full rounded-lg border border-border bg-secondary/50 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-success/50" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">URL de ajuda (opcional)</label>
              <input type="text" value={formHelpUrl} onChange={(e) => setFormHelpUrl(e.target.value.slice(0, 300))} placeholder="https://..."
                className="mt-1 w-full rounded-lg border border-border bg-secondary/50 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-success/50" />
            </div>
          </form>
          <div className="mt-6 flex gap-3">
            <button onClick={handleSave} disabled={saving || Boolean(editing && credentialSecretLoading)}
              className="flex items-center gap-2 rounded-lg bg-success px-6 py-2.5 text-sm font-semibold text-success-foreground disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {editing ? "Salvar" : "Criar"}
            </button>
            <button onClick={resetForm} className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground">Cancelar</button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="mt-6 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-success" /></div>
        ) : credentials.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-20 text-muted-foreground">
            <Key className="h-10 w-10 mb-3 opacity-40" />
            <p className="font-semibold">Nenhuma credencial cadastrada</p>
            <p className="mt-1 text-sm">Clique em "Nova Credencial" para começar</p>
          </div>
        ) : credentials.map((cred) => {
          const helpSafe = safeHttpUrl(cred.help_url);
          return (
          <div key={cred.env_key} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
                  <Key className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">{cred.name}</h3>
                  {cred.description && <p className="mt-0.5 text-xs text-muted-foreground">{cred.description}</p>}
                  <div className="mt-2 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                      <CheckCircle className="h-3 w-3" />
                      Valor só ao editar
                    </span>
                    <code className="rounded bg-secondary px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                      {cred.env_key}
                    </code>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {helpSafe && (
                  <a href={helpSafe} target="_blank" rel="noopener noreferrer"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:border-success hover:text-success">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                <button onClick={() => openEdit(cred)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:border-accent hover:text-accent">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => handleDelete(cred)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:border-destructive hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

          </div>
          );
        })}
      </div>
    </div>
  );
};

export default CredentialsTab;
