import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useInvalidateAdminCache } from "@/hooks/useAdminData";
import {
  Plus, Pencil, Trash2, GripVertical, ImageIcon, Loader2,
  Upload, Link, Sparkles, X,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Game {
  id: string; name: string; slug: string | null; image_url: string | null;
  active: boolean; sort_order: number;
}

const GamesTab = () => {
  const [games, setGames] = useState<Game[]>([]);
  const [loadingGames, setLoadingGames] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imageMode, setImageMode] = useState<"url" | "upload" | "ai">("url");
  const [uploading, setUploading] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const invalidateAdmin = useInvalidateAdminCache();

  const fetchGames = async () => {
    const { data, error } = await supabase.from("games").select("*").order("sort_order", { ascending: true });
    if (!error && data) setGames(data as Game[]);
    setLoadingGames(false);
    invalidateAdmin();
  };

  useEffect(() => { fetchGames(); }, []);

  const resetForm = () => { setFormName(""); setFormSlug(""); setFormImageUrl(""); setFormActive(true); setEditingGame(null); setShowForm(false); setImageMode("url"); setAiPrompt(""); setImagePreview(null); };

  const handleDragStart = (index: number) => { setDragIndex(index); };
  const handleDragEnter = (index: number) => { setDragOverIndex(index); };
  const handleDragEnd = async () => {
    if (dragIndex === null || dragOverIndex === null || dragIndex === dragOverIndex) {
      setDragIndex(null); setDragOverIndex(null); return;
    }
    const reordered = [...games];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(dragOverIndex, 0, moved);
    setGames(reordered);
    setDragIndex(null); setDragOverIndex(null);
    const updates = reordered.map((g, i) => supabase.from("games").update({ sort_order: i }).eq("id", g.id));
    await Promise.all(updates);
  };

  const openEdit = (game: Game) => {
    setEditingGame(game); setFormName(game.name); setFormSlug(game.slug || "");
    setFormImageUrl(game.image_url || ""); setFormActive(game.active); setShowForm(true);
    setImagePreview(game.image_url || null); setImageMode("url");
  };

  const uploadFile = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast({ title: "Apenas imagens são aceitas", variant: "destructive" }); return; }
    if (file.size > 5 * 1024 * 1024) { toast({ title: "Máximo 5MB", variant: "destructive" }); return; }
    setUploading(true);
    const ext = file.name.split(".").pop() || "png";
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("game-images").upload(path, file, { contentType: file.type });
    if (error) { toast({ title: "Erro no upload", description: error.message, variant: "destructive" }); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("game-images").getPublicUrl(path);
    setFormImageUrl(urlData.publicUrl);
    setImagePreview(urlData.publicUrl);
    toast({ title: "Imagem enviada!" });
    setUploading(false);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }, []);

  const handleGenerateAI = async () => {
    const prompt = aiPrompt.trim() || formName.trim();
    if (!prompt) { toast({ title: "Digite um prompt ou nome do jogo", variant: "destructive" }); return; }
    setGeneratingAI(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");
      const res = await supabase.functions.invoke("generate-game-image", {
        body: { prompt },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.error || res.data?.error) throw new Error(res.data?.error || String(res.error));
      const base64 = res.data.image_base64;
      const byteString = atob(base64.split(",")[1]);
      const mimeMatch = base64.match(/data:([^;]+);/);
      const mime = mimeMatch ? mimeMatch[1] : "image/png";
      const ab = new Uint8Array(byteString.length);
      for (let i = 0; i < byteString.length; i++) ab[i] = byteString.charCodeAt(i);
      const blob = new Blob([ab], { type: mime });
      const path = `ai-${crypto.randomUUID()}.png`;
      const { error: uploadErr } = await supabase.storage.from("game-images").upload(path, blob, { contentType: mime });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from("game-images").getPublicUrl(path);
      setFormImageUrl(urlData.publicUrl);
      setImagePreview(urlData.publicUrl);
      toast({ title: "Imagem gerada com IA!" });
    } catch (err: any) {
      toast({ title: "Erro ao gerar", description: err.message, variant: "destructive" });
    }
    setGeneratingAI(false);
  };

  const generateSlug = (name: string) =>
    name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const handleNameChange = (val: string) => {
    setFormName(val.slice(0, 50));
    if (!editingGame) setFormSlug(generateSlug(val.slice(0, 50)));
  };

  const handleSave = async () => {
    if (!formName.trim() || !formSlug.trim()) { toast({ title: "Preencha nome e slug", variant: "destructive" }); return; }
    setSaving(true);
    if (editingGame) {
      const { error } = await supabase.from("games").update({ name: formName.trim(), slug: formSlug.trim(), image_url: formImageUrl.trim() || null, active: formActive }).eq("id", editingGame.id);
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else { toast({ title: "Jogo atualizado!" }); resetForm(); fetchGames(); }
    } else {
      const { error } = await supabase.from("games").insert({ name: formName.trim(), slug: formSlug.trim(), image_url: formImageUrl.trim() || null, active: formActive, sort_order: games.length });
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else { toast({ title: "Jogo criado!" }); resetForm(); fetchGames(); }
    }
    setSaving(false);
  };

  const handleDelete = async (game: Game) => {
    if (!confirm(`Excluir "${game.name}"?`)) return;
    const { error } = await supabase.from("games").delete().eq("id", game.id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Excluído!" }); fetchGames(); }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">Gerenciar Jogos</h2>
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 rounded-lg bg-success px-5 py-2.5 text-sm font-semibold text-success-foreground">
          <Plus className="h-4 w-4" /> Novo Jogo
        </button>
      </div>
      {showForm && (
        <div className="mt-6 rounded-lg border border-border bg-card p-6">
          <h3 className="text-lg font-bold text-foreground">{editingGame ? "Editar Jogo" : "Novo Jogo"}</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Nome</label>
              <input type="text" value={formName} onChange={(e) => handleNameChange(e.target.value)} placeholder="Ex: Valorant"
                className="mt-1 w-full rounded-lg border border-border bg-secondary/50 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-success/50" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Slug</label>
              <input type="text" value={formSlug} onChange={(e) => setFormSlug(e.target.value.slice(0, 50).toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="Ex: valorant"
                className="mt-1 w-full rounded-lg border border-border bg-secondary/50 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-success/50" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-2 block">Imagem (opcional)</label>
              
              {imagePreview && (
                <div className="relative mb-3 inline-block">
                  <img src={imagePreview} alt="Preview" className="h-24 w-24 rounded-lg border border-border object-cover" />
                  <button onClick={() => { setImagePreview(null); setFormImageUrl(""); }}
                    className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs"><X className="h-3 w-3" /></button>
                </div>
              )}

              <div className="flex gap-1 mb-3">
                {([["url", Link, "URL"], ["upload", Upload, "Upload"], ["ai", Sparkles, "Gerar IA"]] as const).map(([mode, Icon, label]) => (
                  <button key={mode} type="button" onClick={() => setImageMode(mode)}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${imageMode === mode ? "bg-success/20 text-success border border-success/30" : "bg-secondary/50 text-muted-foreground border border-border hover:text-foreground"}`}>
                    <Icon className="h-3 w-3" />{label}
                  </button>
                ))}
              </div>

              {imageMode === "url" && (
                <input type="text" value={formImageUrl} onChange={(e) => { setFormImageUrl(e.target.value.slice(0, 500)); setImagePreview(e.target.value || null); }} placeholder="https://..."
                  className="w-full rounded-lg border border-border bg-secondary/50 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-success/50" />
              )}

              {imageMode === "upload" && (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 ${dragOver ? "border-success bg-success/5" : "border-border hover:border-success/40"}`}
                >
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); }} />
                  {uploading ? (
                    <><Loader2 className="h-8 w-8 animate-spin text-success mb-2" /><p className="text-xs text-muted-foreground">Enviando...</p></>
                  ) : (
                    <><Upload className="h-8 w-8 text-muted-foreground/40 mb-2" /><p className="text-sm font-medium text-muted-foreground">Arraste uma imagem ou clique para selecionar</p><p className="text-xs text-muted-foreground/60 mt-1">PNG, JPG, WEBP · Máx 5MB</p></>
                  )}
                </div>
              )}

              {imageMode === "ai" && (
                <div className="space-y-3">
                  <input type="text" value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value.slice(0, 200))}
                    placeholder={formName ? `Ex: ${formName} game cover` : "Descreva a imagem..."}
                    className="w-full rounded-lg border border-border bg-secondary/50 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-success/50" />
                  <button type="button" onClick={handleGenerateAI} disabled={generatingAI}
                    className="flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-50">
                    {generatingAI ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {generatingAI ? "Gerando..." : "Gerar com IA"}
                  </button>
                </div>
              )}
            </div>
            <label className="flex cursor-pointer items-center gap-3">
              <div className="relative">
                <input type="checkbox" checked={formActive} onChange={(e) => setFormActive(e.target.checked)} className="peer sr-only" />
                <div className="h-5 w-9 rounded-full border border-border bg-secondary peer-checked:border-success peer-checked:bg-success" />
                <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-foreground/60 peer-checked:left-[18px] peer-checked:bg-success-foreground" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Ativo</span>
            </label>
          </div>
          <div className="mt-6 flex gap-3">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-success px-6 py-2.5 text-sm font-semibold text-success-foreground disabled:opacity-50">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} {editingGame ? "Salvar" : "Criar"}
            </button>
            <button onClick={resetForm} className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground">Cancelar</button>
          </div>
        </div>
      )}
      <div className="mt-6 space-y-3">
        {loadingGames ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-success" /></div>
        ) : games.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-20 text-muted-foreground">
            <ImageIcon className="h-10 w-10 mb-3 opacity-40" /><p className="font-semibold">Nenhum jogo cadastrado</p><p className="mt-1 text-sm">Clique em "Novo Jogo" para começar</p>
          </div>
        ) : games.map((game, index) => (
          <div key={game.id}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragEnter={() => handleDragEnter(index)}
            onDragOver={(e) => e.preventDefault()}
            onDragEnd={handleDragEnd}
            className={`flex items-center gap-4 rounded-lg border p-4 cursor-grab active:cursor-grabbing ${
              dragOverIndex === index ? "border-success bg-success/5" : "border-border bg-card hover:border-success/30"
            } ${dragIndex === index ? "opacity-50" : ""}`}>
            <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/40" />
            {game.image_url ? <img src={game.image_url} alt={game.name} className="h-12 w-12 shrink-0 rounded-lg border border-border object-cover" />
              : <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary"><ImageIcon className="h-5 w-5 text-muted-foreground/40" /></div>}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-foreground truncate">{game.name}</h4>
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${game.active ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}`}>{game.active ? "Ativo" : "Inativo"}</span>
              </div>
              <p className="text-xs text-muted-foreground">/{game.slug}</p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => openEdit(game)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"><Pencil className="h-4 w-4" /></button>
              <button onClick={() => handleDelete(game)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GamesTab;
