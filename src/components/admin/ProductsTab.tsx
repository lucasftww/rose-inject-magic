import { useState, useEffect, useRef, useCallback } from "react";
import { useAdminGames, useAdminProductsWithPlans, useInvalidateAdminCache } from "@/hooks/useAdminData";
import { supabase } from "@/integrations/supabase/client";
import {
  Plus, Pencil, Trash2, Loader2, ImageIcon, Upload, Link, X,
  Package, ChevronDown, ChevronUp, DollarSign, GripVertical, Film, Image, Sparkles, FileText, Globe, RefreshCw
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { getYouTubeId, getYouTubeThumbnail, detectMediaType } from "@/lib/videoUtils";

interface Game {
  id: string; name: string;
}

interface ProductPlan {
  id?: string;
  name: string;
  price: number;
  active: boolean;
  sort_order: number;
  robot_duration_days?: number | null;
  _key?: string;
}

interface MediaItem {
  id?: string;
  media_type: "image" | "video";
  url: string;
  sort_order: number;
  _key?: string;
}

interface FeatureItem {
  id?: string;
  label: string;
  value: string;
  sort_order: number;
  _key?: string;
}

interface Product {
  id: string;
  game_id: string;
  name: string;
  description: string | null;
  features_text: string | null;
  image_url: string | null;
  active: boolean;
  sort_order: number;
  robot_game_id: number | null;
  robot_markup_percent: number | null;
  product_plans?: ProductPlan[];
}

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

const defaultPlans: ProductPlan[] = [
  { _key: "dp0", name: "Diário", price: 0, active: true, sort_order: 0, robot_duration_days: 1 },
  { _key: "dp1", name: "Semanal", price: 0, active: true, sort_order: 1, robot_duration_days: 7 },
  { _key: "dp2", name: "Mensal", price: 0, active: true, sort_order: 2, robot_duration_days: 30 },
];

const defaultFeatures: FeatureItem[] = [
  { _key: "df0", label: "GPU", value: "Compatible with AMD & NVIDIA", sort_order: 0 },
  { _key: "df1", label: "OS", value: "Windows 10 & 11 (24H2 and below)", sort_order: 1 },
  { _key: "df2", label: "CPU", value: "Intel & AMD", sort_order: 2 },
  { _key: "df3", label: "HVCI (Core Isolation)", value: "ON / OFF supported", sort_order: 3 },
];

const ITEMS_PER_PAGE = 10;
const ROBOT_USD_TO_BRL = 5.25;

const ProductsTab = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formFeaturesText, setFormFeaturesText] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formGameId, setFormGameId] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [formPlans, setFormPlans] = useState<ProductPlan[]>(defaultPlans);
  const [imageMode, setImageMode] = useState<"url" | "upload">("url");
  const [uploading, setUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [filterGameId, setFilterGameId] = useState<string>("all");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaFileInputRef = useRef<HTMLInputElement>(null);
  const [formMedia, setFormMedia] = useState<MediaItem[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [mediaUrlInput, setMediaUrlInput] = useState("");
  const [mediaTypeInput, setMediaTypeInput] = useState<"image" | "video">("image");
  const [formFeatures, setFormFeatures] = useState<FeatureItem[]>([]);
  const [formTutorialText, setFormTutorialText] = useState("");
  const [formTutorialFileUrl, setFormTutorialFileUrl] = useState("");
  const [uploadingTutorial, setUploadingTutorial] = useState(false);
  const tutorialFileInputRef = useRef<HTMLInputElement>(null);

  // Robot Project state
  const [robotEnabled, setRobotEnabled] = useState(false);
  const [formRobotGameId, setFormRobotGameId] = useState<number | null>(null);
  const [formRobotMarkup, setFormRobotMarkup] = useState<number | null>(null);
  const [robotGames, setRobotGames] = useState<RobotGame[]>([]);
  const [loadingRobotGames, setLoadingRobotGames] = useState(false);
  const [robotUsdToBrl, setRobotUsdToBrl] = useState(ROBOT_USD_TO_BRL);

  const fetchExchangeRate = async () => {
    try {
      const res = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL");
      if (res.ok) {
        const data = await res.json();
        const bid = Number(data?.USDBRL?.bid);
        if (bid > 0) setRobotUsdToBrl(bid);
      }
    } catch (_) { /* use fallback */ }
  };

  const fetchRobotGames = async () => {
    setLoadingRobotGames(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const [res] = await Promise.all([
        fetch(`https://${projectId}.supabase.co/functions/v1/robot-project?action=list-games`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }),
        fetchExchangeRate(),
      ]);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: "Erro ao carregar jogos Robot", description: err.error || `HTTP ${res.status}`, variant: "destructive" });
      } else {
        const data = await res.json();
        const games = Array.isArray(data) ? data : data.games || [];
        setRobotGames(games);
      }
    } catch (err: any) {
      toast({ title: "Erro Robot", description: err.message, variant: "destructive" });
    }
    setLoadingRobotGames(false);
  };

  const { data: cachedGames, refetch: refetchGames } = useAdminGames();
  const { data: cachedProducts, refetch: refetchProducts } = useAdminProductsWithPlans();
  const invalidateAdmin = useInvalidateAdminCache();

  useEffect(() => {
    if (cachedGames) setGames(cachedGames);
  }, [cachedGames]);

  useEffect(() => {
    if (cachedProducts) {
      setProducts(cachedProducts as any);
      setLoading(false);
    }
  }, [cachedProducts]);

  const fetchData = async (shouldInvalidate = false) => {
    if (shouldInvalidate) invalidateAdmin();
    await Promise.all([refetchGames(), refetchProducts()]);
    setLoading(false);
  };

  useEffect(() => { if (!cachedProducts) fetchData(); }, []);

  // Auto-fill plan prices when Robot games data loads (on edit)
  useEffect(() => {
    if (!robotEnabled || !formRobotGameId || formRobotMarkup === null || robotGames.length === 0) return;
    // Only auto-fill when editing an existing product (not creating new)
    if (!editing) return;
    const rg = robotGames.find(g => Number(g.id) === Number(formRobotGameId));
    if (!rg?.prices) return;

    setFormPlans(prev => {
      let changed = false;
      const updated = prev.map(p => {
        if (!p.robot_duration_days) return p;
        const robotPriceUsd = rg.prices[String(p.robot_duration_days)];
        if (robotPriceUsd === undefined) return p;
        const calc = Number((Number(robotPriceUsd) * robotUsdToBrl * (1 + (formRobotMarkup || 0) / 100)).toFixed(2));
        if (p.price !== calc) changed = true;
        return { ...p, price: calc };
      });
      return changed ? updated : prev;
    });
  }, [robotGames, robotUsdToBrl, robotEnabled, formRobotGameId, formRobotMarkup, editing]);

  const resetForm = () => {
    setFormName(""); setFormDescription(""); setFormFeaturesText(""); setFormImageUrl(""); setFormGameId("");
    setFormActive(true); setFormPlans([...defaultPlans]); setEditing(null);
    setShowForm(false); setImageMode("url"); setImagePreview(null);
    setFormMedia([]); setMediaUrlInput(""); setMediaTypeInput("image");
    setFormFeatures([...defaultFeatures]);
    setFormTutorialText(""); setFormTutorialFileUrl("");
    setRobotEnabled(false); setFormRobotGameId(null); setFormRobotMarkup(null);
  };

  const openEdit = async (product: Product) => {
    setEditing(product);
    setFormName(product.name);
    setFormDescription(product.description || "");
    setFormFeaturesText(product.features_text || "");
    setFormImageUrl(product.image_url || "");
    setFormGameId(product.game_id);
    setFormActive(product.active);
    setImagePreview(product.image_url || null);
    setImageMode("url");
    const hasRobot = !!product.robot_game_id && product.robot_game_id > 0;
    setRobotEnabled(hasRobot);
    setFormRobotGameId(product.robot_game_id || null);
    setFormRobotMarkup(product.robot_markup_percent || null);
    if (hasRobot) fetchRobotGames();

    // Fetch tutorial data from separate secure table
    const { data: tutorialData } = await supabase.from("product_tutorials").select("tutorial_text, tutorial_file_url").eq("product_id", product.id).maybeSingle();
    setFormTutorialText(tutorialData?.tutorial_text || "");
    setFormTutorialFileUrl(tutorialData?.tutorial_file_url || "");

    // Fetch plans
    const [plansRes, mediaRes, featuresRes] = await Promise.all([
      supabase.from("product_plans").select("*").eq("product_id", product.id).order("sort_order"),
      supabase.from("product_media").select("*").eq("product_id", product.id).order("sort_order"),
      supabase.from("product_features").select("*").eq("product_id", product.id).order("sort_order"),
    ]);
    if (plansRes.data && plansRes.data.length > 0) {
      setFormPlans(plansRes.data.map((p: any) => ({ id: p.id, name: p.name, price: Number(p.price), active: p.active, sort_order: p.sort_order, robot_duration_days: p.robot_duration_days || null, _key: p.id })));
    } else {
      setFormPlans([...defaultPlans]);
    }
    setFormMedia((mediaRes.data || []).map((m: any) => ({ id: m.id, media_type: m.media_type, url: m.url, sort_order: m.sort_order, _key: m.id })));
    setFormFeatures((featuresRes.data || []).map((f: any) => ({ id: f.id, label: f.label, value: f.value, sort_order: f.sort_order, _key: f.id })));
    setShowForm(true);
  };

  const uploadFile = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast({ title: "Apenas imagens", variant: "destructive" }); return; }
    if (file.size > 5 * 1024 * 1024) { toast({ title: "Máximo 5MB", variant: "destructive" }); return; }
    setUploading(true);
    const ext = file.name.split(".").pop() || "png";
    const path = `products/${crypto.randomUUID()}.${ext}`;
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

  const updatePlan = (index: number, field: keyof ProductPlan, value: any) => {
    const updated = [...formPlans];
    (updated[index] as any)[field] = value;
    setFormPlans(updated);
  };

  const addPlan = () => {
    setFormPlans([...formPlans, { name: "", price: 0, active: true, sort_order: formPlans.length, _key: crypto.randomUUID() }]);
  };

  const removePlan = (index: number) => {
    setFormPlans(formPlans.filter((_, i) => i !== index));
  };

  const uploadMediaFile = async (file: File) => {
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    if (!isVideo && !isImage) { toast({ title: "Apenas imagens ou vídeos", variant: "destructive" }); return; }
    if (file.size > 50 * 1024 * 1024) { toast({ title: "Máximo 50MB", variant: "destructive" }); return; }
    setUploadingMedia(true);
    const ext = file.name.split(".").pop() || "png";
    const path = `media/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("game-images").upload(path, file, { contentType: file.type });
    if (error) { toast({ title: "Erro no upload", description: error.message, variant: "destructive" }); setUploadingMedia(false); return; }
    const { data: urlData } = supabase.storage.from("game-images").getPublicUrl(path);
    setFormMedia([...formMedia, { media_type: isVideo ? "video" : "image", url: urlData.publicUrl, sort_order: formMedia.length, _key: crypto.randomUUID() }]);
    toast({ title: "Mídia enviada!" });
    setUploadingMedia(false);
  };

  const addMediaByUrl = () => {
    if (!mediaUrlInput.trim()) return;
    const detectedType = detectMediaType(mediaUrlInput.trim());
    setFormMedia([...formMedia, { media_type: detectedType, url: mediaUrlInput.trim(), sort_order: formMedia.length, _key: crypto.randomUUID() }]);
    setMediaUrlInput("");
  };

  const removeMedia = (index: number) => {
    setFormMedia(formMedia.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!formName.trim()) { toast({ title: "Preencha o nome", variant: "destructive" }); return; }
    if (!formGameId) { toast({ title: "Selecione o jogo", variant: "destructive" }); return; }

    // Trava anti-prejuízo: impedir salvar plano com preço abaixo do preço cheio da API Robot
    if (robotEnabled && formRobotGameId && robotGames.length > 0) {
      const rg = robotGames.find(g => Number(g.id) === Number(formRobotGameId));
      if (rg?.prices) {
        for (const plan of formPlans) {
          if (!plan.active || !plan.robot_duration_days) continue;
          const fullPriceUsd = rg.prices[String(plan.robot_duration_days)];
          if (fullPriceUsd === undefined) continue;
          const fullPriceBrl = Number(fullPriceUsd) * robotUsdToBrl;
          if (plan.price > 0 && plan.price < fullPriceBrl) {
            toast({
              title: `⚠️ Preço do plano "${plan.name}" abaixo do custo!`,
              description: `R$${plan.price.toFixed(2)} é menor que o preço cheio da API (R$${fullPriceBrl.toFixed(2)}). Aumente o preço ou o markup para não ter prejuízo.`,
              variant: "destructive",
            });
            return;
          }
        }
      }
    }

    setSaving(true);

    try {
      if (editing) {
        const { error } = await supabase.from("products").update({
          name: formName.trim(), description: formDescription.trim() || null,
          features_text: formFeaturesText.trim() || null,
          image_url: formImageUrl.trim() || null, game_id: formGameId, active: formActive,
          robot_game_id: robotEnabled && formRobotGameId ? formRobotGameId : null,
          robot_markup_percent: robotEnabled && formRobotMarkup != null ? formRobotMarkup : null,
        } as any).eq("id", editing.id);
        if (error) throw error;

        // Save tutorial data to secure table
        await supabase.from("product_tutorials" as any).upsert({
          product_id: editing.id,
          tutorial_text: formTutorialText.trim() || null,
          tutorial_file_url: formTutorialFileUrl.trim() || null,
        } as any, { onConflict: "product_id" });

        // Sync plans: update existing, insert new, delete removed
        const validPlans = formPlans.filter(p => p.name.trim());
        const existingPlanIds = validPlans.filter(p => p.id).map(p => p.id!);
        
        // Delete plans that were removed (only those not referenced by order_tickets)
        const { data: currentPlans } = await supabase.from("product_plans").select("id").eq("product_id", editing.id);
        const plansToDelete = (currentPlans || []).filter(cp => !existingPlanIds.includes(cp.id)).map(cp => cp.id);
        if (plansToDelete.length > 0) {
          // Try to delete, ignore FK errors (plans referenced by orders can't be deleted)
          for (const pid of plansToDelete) {
            await supabase.from("product_plans").delete().eq("id", pid);
          }
        }

        // Update existing plans
        for (const [i, p] of validPlans.entries()) {
          if (p.id) {
            await supabase.from("product_plans").update({
              name: p.name.trim(), price: p.price, active: p.active, sort_order: i,
              robot_duration_days: p.robot_duration_days || null,
            } as any).eq("id", p.id);
          } else {
            // Insert new plans
            await supabase.from("product_plans").insert({
              product_id: editing.id, name: p.name.trim(), price: p.price, active: p.active, sort_order: i,
              robot_duration_days: p.robot_duration_days || null,
            } as any);
          }
        }
        // Save media
        await supabase.from("product_media").delete().eq("product_id", editing.id);
        const mediaToInsert = formMedia.filter(m => m.url.trim()).map((m, i) => ({
          product_id: editing.id, media_type: m.media_type, url: m.url.trim(), sort_order: i,
        }));
        if (mediaToInsert.length > 0) {
          const { error: mediaErr } = await supabase.from("product_media").insert(mediaToInsert);
          if (mediaErr) throw mediaErr;
        }
        // Save features
        await supabase.from("product_features").delete().eq("product_id", editing.id);
        const featuresToInsert = formFeatures.filter(f => f.label.trim() && f.value.trim()).map((f, i) => ({
          product_id: editing.id, label: f.label.trim(), value: f.value.trim(), sort_order: i,
        }));
        if (featuresToInsert.length > 0) {
          const { error: featErr } = await supabase.from("product_features").insert(featuresToInsert);
          if (featErr) throw featErr;
        }
        toast({ title: "Produto atualizado!" });
      } else {
        const { data, error } = await supabase.from("products").insert({
          name: formName.trim(), description: formDescription.trim() || null,
          features_text: formFeaturesText.trim() || null,
          image_url: formImageUrl.trim() || null, game_id: formGameId, active: formActive,
          sort_order: products.length,
          robot_game_id: robotEnabled && formRobotGameId ? formRobotGameId : null,
          robot_markup_percent: robotEnabled && formRobotMarkup != null ? formRobotMarkup : null,
        } as any).select().single();
        if (error) throw error;

        // Save tutorial data to secure table
        if (formTutorialText.trim() || formTutorialFileUrl.trim()) {
          await supabase.from("product_tutorials" as any).insert({
            product_id: data.id,
            tutorial_text: formTutorialText.trim() || null,
            tutorial_file_url: formTutorialFileUrl.trim() || null,
          } as any);
        }

        const plansToInsert = formPlans.filter(p => p.name.trim()).map((p, i) => ({
          product_id: data.id, name: p.name.trim(), price: p.price, active: p.active, sort_order: i,
          robot_duration_days: p.robot_duration_days || null,
        }));
        if (plansToInsert.length > 0) {
          const { error: planErr } = await supabase.from("product_plans").insert(plansToInsert);
          if (planErr) throw planErr;
        }
        // Save media
        const mediaToInsert = formMedia.filter(m => m.url.trim()).map((m, i) => ({
          product_id: data.id, media_type: m.media_type, url: m.url.trim(), sort_order: i,
        }));
        if (mediaToInsert.length > 0) {
          const { error: mediaErr } = await supabase.from("product_media").insert(mediaToInsert);
          if (mediaErr) throw mediaErr;
        }
        // Save features
        const featuresToInsert = formFeatures.filter(f => f.label.trim() && f.value.trim()).map((f, i) => ({
          product_id: data.id, label: f.label.trim(), value: f.value.trim(), sort_order: i,
        }));
        if (featuresToInsert.length > 0) {
          const { error: featErr } = await supabase.from("product_features").insert(featuresToInsert);
          if (featErr) throw featErr;
        }
        toast({ title: "Produto criado!" });
      }
      resetForm();
      fetchData(true);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handleDelete = async (product: Product) => {
    if (!confirm(`Excluir "${product.name}"?`)) return;
    const { error } = await supabase.from("products").delete().eq("id", product.id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Excluído!" }); fetchData(true); }
  };

  const getGameName = (gameId: string) => games.find(g => g.id === gameId)?.name || "—";

  const filtered = filterGameId === "all" ? products : products.filter(p => p.game_id === filterGameId);
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedProducts = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => { setCurrentPage(1); }, [filterGameId]);

  const handleDragStart = (index: number) => { setDragIndex(index); };
  const handleDragEnter = (index: number) => { setDragOverIndex(index); };
  const handleDragEnd = async () => {
    if (dragIndex === null || dragOverIndex === null || dragIndex === dragOverIndex) {
      setDragIndex(null); setDragOverIndex(null); return;
    }
    const reordered = [...filtered];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(dragOverIndex, 0, moved);
    setDragIndex(null); setDragOverIndex(null);
    // When a game filter is active, preserve other products' sort_order
    // by only updating the filtered subset with offsets based on their current positions
    const filteredIds = new Set(reordered.map(p => p.id));
    const otherProducts = products.filter(p => !filteredIds.has(p.id));
    // Merge: filtered products get new sequential order, others keep theirs
    const allReordered = [...reordered, ...otherProducts];
    const updates = allReordered.map((p, i) => supabase.from("products").update({ sort_order: i }).eq("id", p.id));
    await Promise.all(updates);
    toast({ title: "Ordem atualizada!" });
    fetchData(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">Gerenciar Produtos</h2>
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 rounded-lg bg-success px-5 py-2.5 text-sm font-semibold text-success-foreground">
          <Plus className="h-4 w-4" /> Novo Produto
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="mt-6 rounded-lg border border-border bg-card p-6">
          <h3 className="text-lg font-bold text-foreground">{editing ? "Editar Produto" : "Novo Produto"}</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {/* Game select */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">Jogo</label>
              <select value={formGameId} onChange={(e) => setFormGameId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-secondary/50 px-4 py-2.5 text-sm text-foreground outline-none focus:border-success/50">
                <option value="">Selecione...</option>
                {games.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>

            {/* Name */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">Nome do Produto</label>
              <input type="text" value={formName} onChange={(e) => setFormName(e.target.value.slice(0, 100))}
                placeholder="Ex: Aimbot Premium"
                className="mt-1 w-full rounded-lg border border-border bg-secondary/50 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-success/50" />
            </div>

            {/* Description */}
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Descrição</label>
              <textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value.slice(0, 500))}
                placeholder="Descreva o produto..."
                rows={3}
                className="mt-1 w-full rounded-lg border border-border bg-secondary/50 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-success/50 resize-none" />
            </div>

            {/* Image */}
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-2 block">Foto (opcional)</label>
              {imagePreview && (
                <div className="relative mb-3 inline-block">
                  <img src={imagePreview} alt="Preview" className="h-24 w-24 rounded-lg border border-border object-cover" />
                  <button onClick={() => { setImagePreview(null); setFormImageUrl(""); }}
                    className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs"><X className="h-3 w-3" /></button>
                </div>
              )}
              <div className="flex gap-1 mb-3">
                {([["url", Link, "URL"], ["upload", Upload, "Upload"]] as const).map(([mode, Icon, label]) => (
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
                  className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 ${dragOver ? "border-success bg-success/5" : "border-border hover:border-success/40"}`}>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); }} />
                  {uploading ? (
                    <><Loader2 className="h-6 w-6 animate-spin text-success mb-2" /><p className="text-xs text-muted-foreground">Enviando...</p></>
                  ) : (
                    <><Upload className="h-6 w-6 text-muted-foreground/40 mb-2" /><p className="text-xs font-medium text-muted-foreground">Arraste ou clique · Máx 5MB</p></>
                  )}
                </div>
              )}
            </div>

            {/* Plans (sub-products) */}
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-medium text-muted-foreground">Planos / Sub-produtos</label>
                <div className="flex items-center gap-2">
                  {robotEnabled && formRobotMarkup !== null && formRobotGameId && robotGames.length > 0 && (
                    <button type="button" onClick={() => {
                      const rg = robotGames.find(g => Number(g.id) === Number(formRobotGameId));
                      if (!rg || !rg.prices) {
                        toast({ title: "Jogo Robot não encontrado ou sem preços", variant: "destructive" });
                        return;
                      }
                      let filledCount = 0;
                      const updated = formPlans.map((p) => {
                        if (!p.robot_duration_days) return p;
                        const robotPriceUsd = rg.prices[String(p.robot_duration_days)];
                        if (robotPriceUsd === undefined) return p;
                        const robotPriceBrl = Number(robotPriceUsd) * robotUsdToBrl;
                        const calc = Number((robotPriceBrl * (1 + (formRobotMarkup || 0) / 100)).toFixed(2));
                        filledCount += 1;
                        return { ...p, price: calc };
                      });
                      setFormPlans(updated);
                      toast({
                        title: filledCount > 0 ? "Preços preenchidos com markup!" : "Nenhum plano foi atualizado",
                        description: filledCount > 0 ? undefined : "Verifique se os dias dos planos batem com a API (ex: 1, 7, 30).",
                        variant: filledCount > 0 ? undefined : "destructive",
                      });
                    }}
                      className="flex items-center gap-1 rounded-lg bg-accent/10 border border-accent/30 px-3 py-1 text-xs font-medium text-accent-foreground hover:bg-accent/20">
                      <DollarSign className="h-3 w-3" /> Auto-preencher preços
                    </button>
                  )}
                  <button type="button" onClick={addPlan}
                    className="flex items-center gap-1 rounded-lg bg-secondary/50 border border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                    <Plus className="h-3 w-3" /> Adicionar
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {formPlans.map((plan, index) => {
                  // Calculate suggested price from Robot markup
                  const selectedRobotGame = robotEnabled && formRobotGameId ? robotGames.find(g => Number(g.id) === Number(formRobotGameId)) : null;
                  const robotPriceUsd = selectedRobotGame && plan.robot_duration_days
                    ? selectedRobotGame.prices?.[String(plan.robot_duration_days)] : undefined;
                  const robotPriceBrl = robotPriceUsd !== undefined ? Number(robotPriceUsd) * robotUsdToBrl : undefined;
                  const suggestedPrice = robotPriceBrl !== undefined && formRobotMarkup !== null
                    ? Number((robotPriceBrl * (1 + formRobotMarkup / 100)).toFixed(2)) : null;

                  return (
                    <div key={plan._key || index} className="rounded-lg border border-border bg-secondary/30 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <input type="text" value={plan.name} onChange={(e) => updatePlan(index, "name", e.target.value.slice(0, 50))}
                          placeholder="Nome (ex: Diário)"
                          className="flex-1 min-w-[120px] rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-success/50" />
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                          <input type="number" value={plan.price} onChange={(e) => updatePlan(index, "price", Number(e.target.value))}
                            min="0" step="0.01" placeholder="0.00"
                            className={`w-28 rounded-lg border bg-background pl-9 pr-3 py-2 text-sm text-foreground outline-none focus:border-success/50 ${
                              plan.price === 0 && robotEnabled ? "border-warning/50" : "border-border"
                            }`} />
                        </div>
                        {robotEnabled && (
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">dias</span>
                            <input type="number" value={plan.robot_duration_days || ""} onChange={(e) => updatePlan(index, "robot_duration_days", Number(e.target.value) || null)}
                              min="1" step="1" placeholder="30"
                              title="Duração Robot (dias)"
                              className="w-20 rounded-lg border border-accent/30 bg-accent/5 pl-9 pr-2 py-2 text-sm text-foreground outline-none focus:border-accent/50" />
                          </div>
                        )}
                        <label className="flex items-center gap-1.5 cursor-pointer" onClick={() => updatePlan(index, "active", !plan.active)}>
                         <div className={`h-4 w-7 rounded-full border relative ${plan.active ? "border-success bg-success" : "border-border bg-secondary"}`}>
                            <div className={`absolute top-0.5 h-3 w-3 rounded-full ${plan.active ? "left-[12px] bg-white" : "left-0.5 bg-foreground/60"}`} />
                          </div>
                        </label>
                        <button type="button" onClick={() => removePlan(index)}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {/* Show markup calculation hint */}
                      {robotEnabled && suggestedPrice !== null && (
                        <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                          <span>
                            Preço API: ${Number(robotPriceUsd).toFixed(2)} USD ≈ R${robotPriceBrl?.toFixed(2)} × {(1 + (formRobotMarkup || 0) / 100).toFixed(2)} = <span className="font-bold text-accent-foreground">R${suggestedPrice.toFixed(2)}</span>
                            <span className="text-success ml-1">(40% volta como cashback)</span>
                          </span>
                          {plan.price !== suggestedPrice && plan.price > 0 && (
                            <span className="text-warning">(manual: R${plan.price.toFixed(2)})</span>
                          )}
                          {plan.price === 0 && (
                            <button type="button" onClick={() => updatePlan(index, "price", suggestedPrice)}
                              className="text-accent-foreground hover:underline font-medium">Usar este valor</button>
                          )}
                        </div>
                      )}
                      {robotEnabled && plan.price === 0 && !suggestedPrice && (
                        <p className="mt-1 text-[10px] text-warning">⚠️ Preço R$ 0 — defina um preço ou configure dias + markup</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Robot Project Integration */}
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-2 mb-3">
                <Globe className="h-3.5 w-3.5 text-accent" />
                Robot Project (Revenda)
              </label>
              <div className="rounded-lg border border-border bg-secondary/20 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer" onClick={() => {
                    if (robotEnabled) { setRobotEnabled(false); setFormRobotGameId(null); setFormRobotMarkup(null); }
                    else { setRobotEnabled(true); fetchRobotGames(); }
                  }}>
                    <div className={`h-4 w-7 rounded-full border relative ${robotEnabled ? "border-accent bg-accent" : "border-border bg-secondary"}`}>
                      <div className={`absolute top-0.5 h-3 w-3 rounded-full ${robotEnabled ? "left-[12px] bg-white" : "left-0.5 bg-foreground/60"}`} />
                    </div>
                    <span className="text-xs text-muted-foreground">Produto fornecido via Robot Project</span>
                  </label>
                </div>

                {robotEnabled && (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Jogo Robot</label>
                        <div className="flex gap-2 mt-1">
                          <select value={formRobotGameId || ""} onChange={(e) => setFormRobotGameId(Number(e.target.value) || null)}
                            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent/50">
                            <option value="">Selecione o jogo...</option>
                            {robotGames.map(g => (
                              <option key={g.id} value={g.id}>
                                {g.name} {g.status === "off" ? "(OFF)" : ""} {g.is_free ? "(FREE)" : ""}
                              </option>
                            ))}
                          </select>
                          <button type="button" onClick={fetchRobotGames} disabled={loadingRobotGames}
                            className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground">
                            {loadingRobotGames ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                          </button>
                        </div>
                        {formRobotGameId && formRobotGameId > 0 && robotGames.length > 0 && (() => {
                          const rg = robotGames.find(g => Number(g.id) === Number(formRobotGameId));
                          if (!rg) return null;
                          return (
                            <div className="mt-2 text-[10px] text-muted-foreground space-y-0.5">
                              <p>Versão: {rg.version} · Status: <span className={rg.status === "on" ? "text-success" : "text-destructive"}>{rg.status}</span> · Câmbio: R${robotUsdToBrl.toFixed(2)}/USD</p>
                              {Object.keys(rg.prices).length > 0 && (
                                 <div className="mt-1 space-y-0.5">
                                  <p className="font-medium text-foreground/80">Preços API (40% volta como cashback):</p>
                                  <p>{Object.entries(rg.prices).map(([d, p]) => {
                                    const usd = Number(p);
                                    const brl = usd * robotUsdToBrl;
                                    return `${d}d = $${usd.toFixed(2)} (R$${brl.toFixed(2)})`;
                                  }).join(" · ")}</p>
                                   
                                </div>
                              )}
                              {rg.maxKeys && <p>Slots: {rg.soldKeys}/{rg.maxKeys}</p>}
                            </div>
                          );
                        })()}
                      </div>
                      <div>
                        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Markup % (opcional)</label>
                        <input type="number" value={formRobotMarkup || ""} onChange={(e) => setFormRobotMarkup(Number(e.target.value) || null)}
                          min="0" max="500" step="1" placeholder="Ex: 30 (30% de lucro)"
                          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-accent/50" />
                        <p className="text-[10px] text-muted-foreground/60 mt-1">Se definido, calcula preço automático: preço API × câmbio (R${robotUsdToBrl.toFixed(2)}) × (1 + markup/100). 40% volta como cashback. Preço manual no plano tem prioridade.</p>
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground/60">
                      💡 Configure a duração em dias em cada plano acima (campo "dias" aparece quando Robot está ativado). Quando o cliente comprar, a key será gerada automaticamente via API Robot.
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                  <Film className="h-3.5 w-3.5 text-success" />
                  Galeria de Mídia (Fotos / Vídeos)
                </label>
              </div>

              {/* Current media */}
              {formMedia.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {formMedia.map((m, idx) => {
                    const ytId = getYouTubeId(m.url);
                    return (
                      <div key={m._key || idx} className="relative group">
                        {m.media_type === "video" ? (
                          ytId ? (
                            <img src={getYouTubeThumbnail(ytId)} alt="YouTube" className="h-20 w-20 rounded-lg border border-border object-cover" />
                          ) : (
                            <video src={m.url} className="h-20 w-20 rounded-lg border border-border object-cover" muted />
                          )
                        ) : (
                          <img src={m.url} alt="" className="h-20 w-20 rounded-lg border border-border object-cover" />
                        )}
                        {m.media_type === "video" && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-background/80">
                              <Film className="h-3 w-3 text-success" />
                            </div>
                          </div>
                        )}
                        <button onClick={() => removeMedia(idx)}
                          className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs opacity-0 group-hover:opacity-100">
                          <X className="h-3 w-3" />
                        </button>
                        <span className="absolute bottom-0.5 left-0.5 rounded bg-background/80 px-1 text-[8px] font-bold text-foreground">{idx + 1}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add by URL */}
              <div className="flex gap-2 mb-2">
                <input type="text" value={mediaUrlInput} onChange={(e) => setMediaUrlInput(e.target.value)}
                  placeholder="Cole URL: imagem, MP4, YouTube..."
                  className="flex-1 rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-success/50" />
                <button type="button" onClick={addMediaByUrl}
                  className="flex items-center gap-1 rounded-lg bg-secondary/50 border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-success/50">
                  <Plus className="h-3 w-3" /> Adicionar
                </button>
              </div>
              {mediaUrlInput && (
                <p className="mb-2 text-[10px] text-muted-foreground">
                  Detectado: <span className="font-bold text-success">{detectMediaType(mediaUrlInput) === "video" ? "Vídeo" : "Imagem"}</span>
                  {getYouTubeId(mediaUrlInput) && " (YouTube)"}
                </p>
              )}

              {/* Upload button */}
              <button type="button" onClick={() => mediaFileInputRef.current?.click()}
                disabled={uploadingMedia}
                className="flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-2.5 text-xs font-medium text-muted-foreground hover:border-success/40 hover:text-foreground">
                {uploadingMedia ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {uploadingMedia ? "Enviando..." : "Upload de arquivo"}
              </button>
              <input ref={mediaFileInputRef} type="file" accept="image/*,video/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadMediaFile(f); }} />
            </div>

            {/* Features Text */}
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Texto acima das Features (opcional)</label>
              <textarea value={formFeaturesText} onChange={(e) => setFormFeaturesText(e.target.value.slice(0, 500))}
                placeholder="Texto descritivo que aparece acima dos cards de features..."
                rows={3}
                className="mt-1 w-full rounded-lg border border-border bg-secondary/50 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-success/50 resize-none" />
            </div>

            {/* Features */}
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-success" />
                  Features / Características
                </label>
                <button type="button" onClick={() => setFormFeatures([...formFeatures, { label: "", value: "", sort_order: formFeatures.length, _key: crypto.randomUUID() }])}
                  className="flex items-center gap-1 rounded-lg bg-secondary/50 border border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                  <Plus className="h-3 w-3" /> Adicionar
                </button>
              </div>
              {formFeatures.length === 0 && (
                <p className="text-xs text-muted-foreground/60 italic">Ex: Skins: 49, Agentes: 26, Nível: 120</p>
              )}
              <div className="space-y-2">
                {formFeatures.map((feat, idx) => (
                  <div key={feat._key || idx} className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 p-3">
                    <input type="text" value={feat.label} onChange={(e) => {
                      const updated = [...formFeatures];
                      updated[idx].label = e.target.value.slice(0, 30);
                      setFormFeatures(updated);
                    }}
                      placeholder="Label (ex: Skins)"
                      className="w-32 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-success/50" />
                    <input type="text" value={feat.value} onChange={(e) => {
                      const updated = [...formFeatures];
                      updated[idx].value = e.target.value.slice(0, 50);
                      setFormFeatures(updated);
                    }}
                      placeholder="Valor (ex: 49)"
                      className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-success/50" />
                    <button type="button" onClick={() => setFormFeatures(formFeatures.filter((_, i) => i !== idx))}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Tutorial / Loader */}
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-2 mb-3">
                <FileText className="h-3.5 w-3.5 text-success" />
                Tutorial / Loader (enviado no chat após compra)
              </label>
              {robotEnabled && (
                <p className="text-[10px] text-muted-foreground/60 mb-3">
                  💡 Para produtos Robot, o tutorial e loader configurados aqui são exibidos como banner no chat do pedido.
                </p>
              )}
              
              {/* Tutorial text */}
              <div className="mb-3">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Texto do Tutorial</label>
                <textarea value={formTutorialText} onChange={(e) => setFormTutorialText(e.target.value.slice(0, 2000))}
                  placeholder="Instruções de uso, passo a passo, etc..."
                  rows={4}
                  className="mt-1 w-full rounded-lg border border-border bg-secondary/50 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-success/50 resize-none" />
              </div>

              {/* Tutorial file */}
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Arquivo do Tutorial / Loader (URL ou Upload)</label>
                {formTutorialFileUrl && (
                  <div className="mt-1 mb-2 flex items-center gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2">
                    <FileText className="h-4 w-4 text-success shrink-0" />
                    <a href={formTutorialFileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-success hover:underline truncate flex-1">{formTutorialFileUrl}</a>
                    <button type="button" onClick={() => setFormTutorialFileUrl("")} className="text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
                  </div>
                )}
                <div className="flex gap-2">
                  <input type="text" value={formTutorialFileUrl} onChange={(e) => setFormTutorialFileUrl(e.target.value)}
                    placeholder="https://link-do-arquivo..."
                    className="flex-1 rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-success/50" />
                  <button type="button" onClick={() => tutorialFileInputRef.current?.click()} disabled={uploadingTutorial}
                    className="flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:border-success/40 hover:text-foreground">
                    {uploadingTutorial ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    {uploadingTutorial ? "Enviando..." : "Upload"}
                  </button>
                </div>
                <input ref={tutorialFileInputRef} type="file" className="hidden" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 50 * 1024 * 1024) { toast({ title: "Máximo 50MB", variant: "destructive" }); return; }
                  setUploadingTutorial(true);
                  const ext = file.name.split(".").pop() || "bin";
                  const path = `tutorials/${crypto.randomUUID()}.${ext}`;
                  const { error } = await supabase.storage.from("game-images").upload(path, file, { contentType: file.type });
                  if (error) { toast({ title: "Erro no upload", description: error.message, variant: "destructive" }); setUploadingTutorial(false); return; }
                  const { data: urlData } = supabase.storage.from("game-images").getPublicUrl(path);
                  setFormTutorialFileUrl(urlData.publicUrl);
                  toast({ title: "Arquivo enviado!" });
                  setUploadingTutorial(false);
                }} />
                <p className="text-[10px] text-muted-foreground/60 mt-1">
                  {robotEnabled
                    ? "O texto e/ou arquivo serão exibidos como banner no chat do pedido do cliente."
                    : "O texto e/ou arquivo serão enviados automaticamente no chat do ticket quando o cliente comprar."}
                </p>
              </div>
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
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} {editing ? "Salvar" : "Criar"}
            </button>
            <button onClick={resetForm} className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground">Cancelar</button>
          </div>
        </div>
      )}

      {/* Filter */}
      {!showForm && games.length > 0 && (
        <div className="mt-4">
          <select value={filterGameId} onChange={(e) => setFilterGameId(e.target.value)}
            className="rounded-lg border border-border bg-secondary/50 px-4 py-2 text-sm text-foreground outline-none focus:border-success/50">
            <option value="all">Todos os jogos</option>
            {games.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
      )}

      {/* Product List */}
      <div className="mt-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-success" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-20 text-muted-foreground">
            <Package className="h-10 w-10 mb-3 opacity-40" /><p className="font-semibold">Nenhum produto</p><p className="mt-1 text-sm">Clique em "Novo Produto" para começar</p>
          </div>
        ) : paginatedProducts.map((product, index) => (
          <div key={product.id}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragEnter={() => handleDragEnter(index)}
            onDragOver={(e) => e.preventDefault()}
            onDragEnd={handleDragEnd}
            className={`rounded-lg border bg-card overflow-hidden cursor-grab active:cursor-grabbing ${
              dragOverIndex === index ? "border-success bg-success/5" : "border-border hover:border-success/30"
            } ${dragIndex === index ? "opacity-50" : ""}`}>
            <div className="flex items-center gap-4 p-4">
              <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/40" />
              {product.image_url ? <img src={product.image_url} alt={product.name} className="h-12 w-12 shrink-0 rounded-lg border border-border object-cover" />
                : <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary"><Package className="h-5 w-5 text-muted-foreground/40" /></div>}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-foreground truncate">{product.name}</h4>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${product.active ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}`}>{product.active ? "Ativo" : "Inativo"}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{getGameName(product.game_id)} · {product.product_plans?.length || 0} planos</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setExpandedProduct(expandedProduct === product.id ? null : product.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground">
                  {expandedProduct === product.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                <button onClick={() => openEdit(product)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => handleDelete(product)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
            {/* Expanded plans */}
            {expandedProduct === product.id && product.product_plans && product.product_plans.length > 0 && (
              <div className="border-t border-border bg-secondary/20 px-4 py-3">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Planos</p>
                <div className="space-y-1.5">
                  {(product.product_plans as any[]).sort((a: any, b: any) => a.sort_order - b.sort_order).map((plan: any) => (
                    <div key={plan.id} className="flex items-center justify-between rounded-lg bg-background/50 border border-border px-3 py-2">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-3 w-3 text-success" />
                        <span className="text-sm text-foreground">{plan.name}</span>
                        {!plan.active && <span className="rounded bg-destructive/20 px-1 py-0.5 text-[9px] text-destructive">Inativo</span>}
                      </div>
                      <span className="text-sm font-bold text-success">R$ {Number(plan.price).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1 pt-4">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-30">‹</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => setCurrentPage(p)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold ${p === currentPage ? "bg-success text-success-foreground" : "border border-border text-muted-foreground hover:text-foreground"}`}>{p}</button>
            ))}
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-30">›</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductsTab;
