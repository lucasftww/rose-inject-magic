import { useState, useEffect } from "react";
import { Key, Eye, EyeOff, CheckCircle, ExternalLink, Plus, Pencil, Trash2, Loader2, X, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Credential {
  id: string;
  name: string;
  env_key: string;
  value: string;
  description: string;
  help_url: string;
}

const CredentialsTab = () => {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Credential | null>(null);
  const [saving, setSaving] = useState(false);

  const [formName, setFormName] = useState("");
  const [formEnvKey, setFormEnvKey] = useState("");
  const [formValue, setFormValue] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formHelpUrl, setFormHelpUrl] = useState("");

  const fetchCredentials = async () => {
    const { data, error } = await supabase
      .from("system_credentials")
      .select("*")
      .order("created_at", { ascending: true });
    if (!error && data) setCredentials(data as unknown as Credential[]);
    setLoading(false);
  };

  useEffect(() => { fetchCredentials(); }, []);

  const resetForm = () => {
    setFormName(""); setFormEnvKey(""); setFormValue(""); setFormDescription(""); setFormHelpUrl("");
    setEditing(null); setShowForm(false);
  };

  const openEdit = (cred: Credential) => {
    setEditing(cred);
    setFormName(cred.name);
    setFormEnvKey(cred.env_key);
    setFormValue(cred.value);
    setFormDescription(cred.description || "");
    setFormHelpUrl(cred.help_url || "");
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formEnvKey.trim()) {
      toast({ title: "Preencha nome e chave", variant: "destructive" });
      return;
    }
    setSaving(true);
    if (editing) {
      const { error } = await supabase.from("system_credentials")
        .update({
          name: formName.trim(),
          env_key: formEnvKey.trim().toUpperCase(),
          value: formValue,
          description: formDescription.trim(),
          help_url: formHelpUrl.trim(),
        })
        .eq("id", editing.id);
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else { toast({ title: "Credencial atualizada!" }); resetForm(); fetchCredentials(); }
    } else {
      const { error } = await supabase.from("system_credentials")
        .insert({
          name: formName.trim(),
          env_key: formEnvKey.trim().toUpperCase(),
          value: formValue,
          description: formDescription.trim(),
          help_url: formHelpUrl.trim(),
        });
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else { toast({ title: "Credencial criada!" }); resetForm(); fetchCredentials(); }
    }
    setSaving(false);
  };

  const handleDelete = async (cred: Credential) => {
    if (!confirm(`Excluir "${cred.name}"?`)) return;
    const { error } = await supabase.from("system_credentials")
      .delete()
      .eq("id", cred.id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Credencial excluída!" }); fetchCredentials(); }
  };

  const toggleVisibility = (id: string) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
      </p>

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
              <input type="password" autoComplete="off" value={formValue} onChange={(e) => setFormValue(e.target.value.slice(0, 500))} placeholder="Cole o valor da credencial aqui"
                className="mt-1 w-full rounded-lg border border-border bg-secondary/50 px-4 py-2.5 text-sm font-mono text-foreground placeholder:text-muted-foreground outline-none focus:border-success/50" />
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
            <button onClick={handleSave} disabled={saving}
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
        ) : credentials.map((cred) => (
          <div key={cred.id} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
                  <Key className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">{cred.name}</h3>
                  {cred.description && <p className="mt-0.5 text-xs text-muted-foreground">{cred.description}</p>}
                  <div className="mt-2 flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${cred.value ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                      <CheckCircle className="h-3 w-3" />
                      {cred.value ? "Configurada" : "Não configurada"}
                    </span>
                    <code className="rounded bg-secondary px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                      {cred.env_key}
                    </code>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {cred.help_url && (
                  <a href={cred.help_url} target="_blank" rel="noopener noreferrer"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-success hover:text-success">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                <button onClick={() => toggleVisibility(cred.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-success hover:text-success">
                  {visibleKeys.has(cred.id) ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
                <button onClick={() => openEdit(cred)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-accent hover:text-accent">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => handleDelete(cred)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-destructive hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {visibleKeys.has(cred.id) && (
              <div className="mt-3 rounded-lg border border-border bg-secondary/50 px-4 py-2.5">
                <p className="text-xs font-mono text-foreground break-all">
                  {cred.value || <span className="text-muted-foreground italic">Sem valor definido</span>}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CredentialsTab;
