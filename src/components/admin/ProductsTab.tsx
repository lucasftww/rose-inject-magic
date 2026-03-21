import { useState, useEffect, useRef, useCallback } from "react";
import { useAdminGames, useAdminProductsWithPlans, useInvalidateAdminCache } from "@/hooks/useAdminData";
import { supabase } from "@/integrations/supabase/client";
import {
  Plus, Pencil, Trash2, Loader2, Upload, Link, X,
  Package, ChevronDown, ChevronUp, DollarSign, GripVertical, Film, Sparkles, FileText, Globe, RefreshCw,
  Search, Filter, Eye, EyeOff, Layers, Settings2, Save, ArrowLeft
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

/* ─── Reusable UI Primitives ─── */
const SectionCard = ({ title, icon: Icon, children, actions, className = "" }: {
  title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode;
  actions?: React.ReactNode; className?: string;
}) => (
  <div className={`rounded-xl border border-border/60 bg-card/50 backdrop-blur-sm ${className}`}>
    <div className="flex items-center justify-between border-b border-border/40 px-5 py-3">
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-success/10">
          <Icon className="h-3.5 w-3.5 text-success" />
        </div>
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      </div>
      {actions}
    </div>
    <div className="p-5">{children}</div>
  </div>
);

const FormField = ({ label, children, hint, span2 = false }: {
  label: string; children: React.ReactNode; hint?: string; span2?: boolean;
}) => (
  <div className={span2 ? "sm:col-span-2" : ""}>
    <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</label>
    {children}
    {hint && <p className="mt-1 text-[10px] text-muted-foreground/60">{hint}</p>}
  </div>
);

const inputClass = "w-full rounded-xl border border-border/60 bg-background/80 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors focus:border-success/50 focus:ring-1 focus:ring-success/20";
const selectClass = "w-full rounded-xl border border-border/60 bg-background/80 px-4 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-success/50 focus:ring-1 focus:ring-success/20";

const ProductsTab = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");

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

  useEffect(() => {
    if (!robotEnabled || !formRobotGameId || formRobotMarkup === null || robotGames.length === 0) return;
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

    const { data: tutorialData } = await supabase.from("product_tutorials").select("tutorial_text, tutorial_file_url").eq("product_id", product.id).maybeSingle();
    setFormTutorialText(tutorialData?.tutorial_text || "");
    setFormTutorialFileUrl(tutorialData?.tutorial_file_url || "");

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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  };

  const updatePlan = (index: number, field: keyof ProductPlan, value: any) => {
    const updated = [...formPlans];
    (updated[index] as any)[field] = value;
    setFormPlans(updated);
  };

  const addPlan = () => {
    setFormPlans([...formPlans, { name: "", price: 0, active: true, sort_order: formPlans.length, robot_duration_days: null, _key: crypto.randomUUID() }]);
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

        await supabase.from("product_tutorials" as any).upsert({
          product_id: editing.id,
          tutorial_text: formTutorialText.trim() || null,
          tutorial_file_url: formTutorialFileUrl.trim() || null,
        } as any, { onConflict: "product_id" });

        const validPlans = formPlans.filter(p => p.name.trim());
        const existingPlanIds = validPlans.filter(p => p.id).map(p => p.id!);
        
        const { data: currentPlans } = await supabase.from("product_plans").select("id").eq("product_id", editing.id);
        const plansToDelete = (currentPlans || []).filter(cp => !existingPlanIds.includes(cp.id)).map(cp => cp.id);
        if (plansToDelete.length > 0) {
          for (const pid of plansToDelete) {
            await supabase.from("product_plans").delete().eq("id", pid);
          }
        }

        for (const [i, p] of validPlans.entries()) {
          if (p.id) {
            await supabase.from("product_plans").update({
              name: p.name.trim(), price: p.price, active: p.active, sort_order: i,
              robot_duration_days: p.robot_duration_days || null,
            } as any).eq("id", p.id);
          } else {
            await supabase.from("product_plans").insert({
              product_id: editing.id, name: p.name.trim(), price: p.price, active: p.active, sort_order: i,
              robot_duration_days: p.robot_duration_days || null,
            } as any);
          }
        }
        await supabase.from("product_media").delete().eq("product_id", editing.id);
        const mediaToInsert = formMedia.filter(m => m.url.trim()).map((m, i) => ({
          product_id: editing.id, media_type: m.media_type, url: m.url.trim(), sort_order: i,
        }));
        if (mediaToInsert.length > 0) {
          const { error: mediaErr } = await supabase.from("product_media").insert(mediaToInsert);
          if (mediaErr) throw mediaErr;
        }
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
        const mediaToInsert = formMedia.filter(m => m.url.trim()).map((m, i) => ({
          product_id: data.id, media_type: m.media_type, url: m.url.trim(), sort_order: i,
        }));
        if (mediaToInsert.length > 0) {
          const { error: mediaErr } = await supabase.from("product_media").insert(mediaToInsert);
          if (mediaErr) throw mediaErr;
        }
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
    if (!confirm(`Excluir "${product.name}"? Isso removerá todos os planos, mídias, features e tutoriais associados.`)) return;
    await Promise.all([
      supabase.from("product_media").delete().eq("product_id", product.id),
      supabase.from("product_features").delete().eq("product_id", product.id),
      supabase.from("product_tutorials").delete().eq("product_id", product.id),
      supabase.from("coupon_products").delete().eq("product_id", product.id),
      supabase.from("reseller_products").delete().eq("product_id", product.id),
      supabase.from("scratch_card_prizes").delete().eq("product_id", product.id),
      supabase.from("product_reviews").delete().eq("product_id", product.id),
    ]);
    const { data: plans } = await supabase.from("product_plans").select("id").eq("product_id", product.id);
    if (plans) {
      for (const plan of plans) {
        await supabase.from("stock_items").delete().eq("product_plan_id", plan.id);
        await supabase.from("product_plans").delete().eq("id", plan.id);
      }
    }
    const { error } = await supabase.from("products").delete().eq("id", product.id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Excluído!" }); fetchData(true); }
  };

  const getGameName = (gameId: string) => games.find(g => g.id === gameId)?.name || "—";

  const filtered = (() => {
    let list = filterGameId === "all" ? products : products.filter(p => p.game_id === filterGameId);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || getGameName(p.game_id).toLowerCase().includes(q));
    }
    return list;
  })();
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedProducts = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => { setCurrentPage(1); }, [filterGameId, searchQuery]);

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
    const filteredIds = new Set(reordered.map(p => p.id));
    const otherProducts = products.filter(p => !filteredIds.has(p.id));
    const allReordered = [...reordered, ...otherProducts];
    const updates = allReordered.map((p, i) => supabase.from("products").update({ sort_order: i }).eq("id", p.id));
    await Promise.all(updates);
    toast({ title: "Ordem atualizada!" });
    fetchData(true);
  };

  const activeCount = products.filter(p => p.active).length;
  const totalPlans = products.reduce((acc, p) => acc + (p.product_plans?.length || 0), 0);

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      {!showForm ? (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-foreground tracking-tight">Produtos</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {products.length} produtos · {activeCount} ativos · {totalPlans} planos
              </p>
            </div>
            <button onClick={() => { resetForm(); setShowForm(true); }}
              className="flex items-center gap-2 rounded-xl bg-success px-5 py-2.5 text-sm font-semibold text-success-foreground shadow-sm shadow-success/20 hover:bg-success/90 transition-colors">
              <Plus className="h-4 w-4" /> Novo Produto
            </button>
          </div>

          {/* ─── Stats Row ─── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total", value: products.length, icon: Package },
              { label: "Ativos", value: activeCount, icon: Eye },
              { label: "Inativos", value: products.length - activeCount, icon: EyeOff },
              { label: "Planos", value: totalPlans, icon: Layers },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-border/40 bg-card/50 p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <s.icon className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider">{s.label}</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
              </div>
            ))}
          </div>

          {/* ─── Filter Bar ─── */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar produto..."
                className="w-full rounded-xl border border-border/60 bg-card/50 pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-success/50 focus:ring-1 focus:ring-success/20 transition-colors" />
            </div>
            {games.length > 0 && (
              <div className="relative">
                <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                <select value={filterGameId} onChange={(e) => setFilterGameId(e.target.value)}
                  className="rounded-xl border border-border/60 bg-card/50 pl-9 pr-8 py-2.5 text-sm text-foreground outline-none focus:border-success/50 appearance-none cursor-pointer">
                  <option value="all">Todos os jogos</option>
                  {games.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* ─── Product List ─── */}
          <div className="space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-success" /></div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 py-20 text-muted-foreground">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/30 mb-4">
                  <Package className="h-8 w-8 opacity-40" />
                </div>
                <p className="font-semibold text-foreground">Nenhum produto encontrado</p>
                <p className="mt-1 text-sm">Clique em "Novo Produto" para começar</p>
              </div>
            ) : paginatedProducts.map((product, index) => (
              <div key={product.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragEnter={() => handleDragEnter(index)}
                onDragOver={(e) => e.preventDefault()}
                onDragEnd={handleDragEnd}
                className={`group rounded-xl border bg-card/80 backdrop-blur-sm overflow-hidden cursor-grab active:cursor-grabbing transition-all duration-200 ${
                  dragOverIndex === index ? "border-success ring-2 ring-success/20 scale-[1.01]" : "border-border/40 hover:border-border hover:shadow-sm"
                } ${dragIndex === index ? "opacity-40 scale-95" : ""}`}>
                <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4">
                  <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
                  
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="h-11 w-11 sm:h-14 sm:w-14 shrink-0 rounded-xl border border-border/40 object-cover" />
                  ) : (
                    <div className="flex h-11 w-11 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-xl border border-border/40 bg-muted/20">
                      <Package className="h-5 w-5 text-muted-foreground/30" />
                    </div>
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-foreground truncate">{product.name}</h4>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        product.active
                          ? "bg-success/10 text-success border border-success/20"
                          : "bg-destructive/10 text-destructive border border-destructive/20"
                      }`}>
                        {product.active ? <Eye className="h-2.5 w-2.5" /> : <EyeOff className="h-2.5 w-2.5" />}
                        {product.active ? "Ativo" : "Inativo"}
                      </span>
                      {product.robot_game_id && product.robot_game_id > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 border border-accent/20 px-2 py-0.5 text-[10px] font-bold text-accent-foreground">
                          <Globe className="h-2.5 w-2.5" /> Robot
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground truncate">
                      {getGameName(product.game_id)} · {product.product_plans?.length || 0} planos
                      {product.product_plans && product.product_plans.length > 0 && (
                        <> · a partir de <span className="font-semibold text-success">
                          R$ {Math.min(...(product.product_plans as any[]).filter((p: any) => p.active && p.price > 0).map((p: any) => Number(p.price)) || [0]).toFixed(2)}
                        </span></>
                      )}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-0.5">
                    <button onClick={() => setExpandedProduct(expandedProduct === product.id ? null : product.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/60 hover:bg-muted/40 hover:text-foreground transition-colors">
                      {expandedProduct === product.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    <button onClick={() => openEdit(product)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/60 hover:bg-success/10 hover:text-success transition-colors">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleDelete(product)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                
                {/* Expanded plans */}
                {expandedProduct === product.id && product.product_plans && product.product_plans.length > 0 && (
                  <div className="border-t border-border/30 bg-muted/10 px-4 sm:px-5 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2.5">Planos</p>
                    <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                      {(product.product_plans as any[]).sort((a: any, b: any) => a.sort_order - b.sort_order).map((plan: any) => (
                        <div key={plan.id} className="flex items-center justify-between rounded-lg bg-background/60 border border-border/30 px-3 py-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${plan.active ? "bg-success" : "bg-destructive"}`} />
                            <span className="text-sm text-foreground truncate">{plan.name}</span>
                          </div>
                          <span className="text-sm font-bold text-success ml-2 shrink-0">R$ {Number(plan.price).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 pt-2">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                className="rounded-lg border border-border/40 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border disabled:opacity-30 transition-colors">‹</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setCurrentPage(p)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${p === currentPage ? "bg-success text-success-foreground shadow-sm" : "border border-border/40 text-muted-foreground hover:text-foreground hover:border-border"}`}>{p}</button>
              ))}
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                className="rounded-lg border border-border/40 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border disabled:opacity-30 transition-colors">›</button>
            </div>
          )}
        </>
      ) : (
        /* ─── FORM ─── */
        <div className="space-y-5">
          {/* Form Header */}
          <div className="flex items-center gap-3">
            <button onClick={resetForm} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/40 text-muted-foreground hover:text-foreground hover:border-border transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-foreground tracking-tight">{editing ? "Editar Produto" : "Novo Produto"}</h2>
              <p className="text-xs text-muted-foreground">{editing ? `Editando: ${editing.name}` : "Preencha os dados do novo produto"}</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-border/40 px-3 py-2 hover:border-border transition-colors">
                <input type="checkbox" checked={formActive} onChange={(e) => setFormActive(e.target.checked)} className="peer sr-only" />
                <div className={`relative h-5 w-9 rounded-full transition-colors ${formActive ? "bg-success" : "bg-muted"}`}>
                  <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${formActive ? "left-[18px]" : "left-0.5"}`} />
                </div>
                <span className="text-xs font-medium text-muted-foreground">{formActive ? "Ativo" : "Inativo"}</span>
              </label>
            </div>
          </div>

          {/* Basic Info */}
          <SectionCard title="Informações Básicas" icon={Settings2}>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Jogo">
                <select value={formGameId} onChange={(e) => setFormGameId(e.target.value)} className={selectClass}>
                  <option value="">Selecione...</option>
                  {games.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </FormField>
              <FormField label="Nome do Produto">
                <input type="text" value={formName} onChange={(e) => setFormName(e.target.value.slice(0, 100))}
                  placeholder="Ex: Aimbot Premium" className={inputClass} />
              </FormField>
              <FormField label="Descrição" span2>
                <textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value.slice(0, 500))}
                  placeholder="Descreva o produto..." rows={3}
                  className={`${inputClass} resize-none`} />
              </FormField>

              {/* Image */}
              <FormField label="Imagem do Produto" span2>
                <div className="flex items-start gap-4">
                  {imagePreview && (
                    <div className="relative shrink-0">
                      <img src={imagePreview} alt="Preview" className="h-20 w-20 rounded-xl border border-border/40 object-cover shadow-sm" />
                      <button onClick={() => { setImagePreview(null); setFormImageUrl(""); }}
                        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  <div className="flex-1 space-y-2">
                    <div className="flex gap-1">
                      {([["url", Link, "URL"], ["upload", Upload, "Upload"]] as const).map(([mode, Icon, label]) => (
                        <button key={mode} type="button" onClick={() => setImageMode(mode)}
                          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                            imageMode === mode
                              ? "bg-success/10 text-success border border-success/30"
                              : "bg-muted/30 text-muted-foreground border border-border/40 hover:text-foreground"
                          }`}>
                          <Icon className="h-3 w-3" />{label}
                        </button>
                      ))}
                    </div>
                    {imageMode === "url" && (
                      <input type="text" value={formImageUrl} onChange={(e) => { setFormImageUrl(e.target.value.slice(0, 500)); setImagePreview(e.target.value || null); }}
                        placeholder="https://..." className={inputClass} />
                    )}
                    {imageMode === "upload" && (
                      <div
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-colors ${
                          dragOver ? "border-success bg-success/5" : "border-border/40 hover:border-success/40"
                        }`}>
                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); }} />
                        {uploading ? (
                          <><Loader2 className="h-6 w-6 animate-spin text-success mb-2" /><p className="text-xs text-muted-foreground">Enviando...</p></>
                        ) : (
                          <><Upload className="h-6 w-6 text-muted-foreground/30 mb-2" /><p className="text-xs text-muted-foreground">Arraste ou clique · Máx 5MB</p></>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </FormField>
            </div>
          </SectionCard>

          {/* Plans */}
          {(() => {
            const selectedRobotGameGlobal = robotEnabled && formRobotGameId ? robotGames.find(g => Number(g.id) === Number(formRobotGameId)) : null;
            const isRobotFree = !!selectedRobotGameGlobal?.is_free;

            return (
              <SectionCard title="Planos / Sub-produtos" icon={Layers} actions={
                <div className="flex items-center gap-2">
                  {robotEnabled && !isRobotFree && formRobotMarkup !== null && formRobotGameId && robotGames.length > 0 && (
                    <button type="button" onClick={() => {
                      const rg = robotGames.find(g => Number(g.id) === Number(formRobotGameId));
                      if (!rg || !rg.prices) { toast({ title: "Jogo Robot não encontrado ou sem preços", variant: "destructive" }); return; }
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
                        title: filledCount > 0 ? "Preços preenchidos!" : "Nenhum plano atualizado",
                        description: filledCount > 0 ? undefined : "Verifique se os dias batem com a API.",
                        variant: filledCount > 0 ? undefined : "destructive",
                      });
                    }}
                      className="flex items-center gap-1.5 rounded-lg bg-accent/10 border border-accent/20 px-3 py-1.5 text-[11px] font-medium text-accent-foreground hover:bg-accent/20 transition-colors">
                      <DollarSign className="h-3 w-3" /> Auto-preencher
                    </button>
                  )}
                  <button type="button" onClick={addPlan}
                    className="flex items-center gap-1 rounded-lg bg-success/10 border border-success/20 px-3 py-1.5 text-[11px] font-medium text-success hover:bg-success/20 transition-colors">
                    <Plus className="h-3 w-3" /> Plano
                  </button>
                </div>
              }>
                {/* Free game banner */}
                {robotEnabled && isRobotFree && (
                  <div className="mb-4 rounded-xl border border-info/20 bg-info/5 px-4 py-3 space-y-1">
                    <p className="text-sm font-semibold text-info">🆓 Jogo Gratuito (FREE)</p>
                    <p className="text-[11px] text-muted-foreground">
                      Este jogo não gera chaves de ativação. O cliente apenas faz download do programa e cria conta no loader.
                      Não é necessário configurar dias ou markup — defina apenas o nome do plano e preço (pode ser R$ 0,00 para gratuito).
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  {formPlans.map((plan, index) => {
                    const selectedRobotGame = robotEnabled && formRobotGameId && !isRobotFree ? robotGames.find(g => Number(g.id) === Number(formRobotGameId)) : null;
                    const robotPriceUsd = selectedRobotGame && plan.robot_duration_days
                      ? selectedRobotGame.prices?.[String(plan.robot_duration_days)] : undefined;
                    const robotPriceBrl = robotPriceUsd !== undefined ? Number(robotPriceUsd) * robotUsdToBrl : undefined;
                    const suggestedPrice = robotPriceBrl !== undefined && formRobotMarkup !== null
                      ? Number((robotPriceBrl * (1 + formRobotMarkup / 100)).toFixed(2)) : null;

                    return (
                      <div key={plan._key || index} className="rounded-xl border border-border/40 bg-background/50 p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <input type="text" value={plan.name} onChange={(e) => updatePlan(index, "name", e.target.value.slice(0, 50))}
                            placeholder={isRobotFree ? "Nome (ex: Gratuito)" : "Nome (ex: Diário)"}
                            className="flex-1 min-w-[120px] rounded-lg border border-border/40 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-success/50" />
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/60">R$</span>
                            <input type="number" value={plan.price} onChange={(e) => updatePlan(index, "price", Number(e.target.value))}
                              min="0" step="0.01"
                              className={`w-28 rounded-lg border bg-background pl-9 pr-3 py-2 text-sm text-foreground outline-none focus:border-success/50 ${
                                plan.price === 0 && robotEnabled && !isRobotFree ? "border-warning/40" : "border-border/40"
                              }`} />
                          </div>
                          {/* Hide days field for free Robot games */}
                          {robotEnabled && !isRobotFree && (
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/60">dias</span>
                              <input type="number" value={plan.robot_duration_days || ""} onChange={(e) => updatePlan(index, "robot_duration_days", Number(e.target.value) || null)}
                                min="1" step="1" placeholder="30"
                                className="w-20 rounded-lg border border-accent/20 bg-accent/5 pl-9 pr-2 py-2 text-sm text-foreground outline-none focus:border-accent/40" />
                            </div>
                          )}
                          <button type="button" onClick={() => updatePlan(index, "active", !plan.active)}
                            className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-medium transition-colors ${
                              plan.active ? "bg-success/10 text-success" : "bg-muted/30 text-muted-foreground"
                            }`}>
                            {plan.active ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                          </button>
                          <button type="button" onClick={() => removePlan(index)}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground/40 hover:bg-destructive/10 hover:text-destructive transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        {robotEnabled && !isRobotFree && suggestedPrice !== null && (
                          <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground rounded-lg bg-muted/20 px-3 py-1.5">
                            <span>
                              API: ${Number(robotPriceUsd).toFixed(2)} ≈ R${robotPriceBrl?.toFixed(2)} × {(1 + (formRobotMarkup || 0) / 100).toFixed(2)} = <span className="font-bold text-success">R${suggestedPrice.toFixed(2)}</span>
                              <span className="text-success/60 ml-1">(40% cashback)</span>
                            </span>
                            {plan.price !== suggestedPrice && plan.price > 0 && (
                              <span className="text-warning">(manual: R${plan.price.toFixed(2)})</span>
                            )}
                            {plan.price === 0 && (
                              <button type="button" onClick={() => updatePlan(index, "price", suggestedPrice)}
                                className="text-success hover:underline font-semibold ml-auto">Usar</button>
                            )}
                          </div>
                        )}
                        {robotEnabled && !isRobotFree && plan.price === 0 && !suggestedPrice && (
                          <p className="mt-1.5 text-[10px] text-warning bg-warning/5 rounded-lg px-3 py-1.5">⚠️ Preço R$ 0 — defina um preço ou configure dias + markup</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </SectionCard>
            );
          })()}

          {/* Robot Project */}
          <SectionCard title="Robot Project (Revenda)" icon={Globe}>
            <div className="space-y-4">
              <button type="button" onClick={() => {
                if (robotEnabled) { setRobotEnabled(false); setFormRobotGameId(null); setFormRobotMarkup(null); }
                else { setRobotEnabled(true); fetchRobotGames(); }
              }}
                className={`flex items-center gap-3 w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                  robotEnabled ? "border-accent/30 bg-accent/5" : "border-border/40 bg-background/50 hover:border-border"
                }`}>
                <div className={`relative h-5 w-9 rounded-full shrink-0 transition-colors ${robotEnabled ? "bg-accent" : "bg-muted"}`}>
                  <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${robotEnabled ? "left-[18px]" : "left-0.5"}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Produto via Robot Project</p>
                  <p className="text-[11px] text-muted-foreground">Keys geradas automaticamente via API</p>
                </div>
              </button>

              {robotEnabled && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Jogo Robot</label>
                    <div className="flex gap-2">
                      <select value={formRobotGameId || ""} onChange={(e) => setFormRobotGameId(Number(e.target.value) || null)} className={`flex-1 ${selectClass}`}>
                        <option value="">Selecione o jogo...</option>
                        {robotGames.map(g => (
                          <option key={g.id} value={g.id}>
                            {g.name} {g.status === "off" ? "(OFF)" : ""} {g.is_free ? "(FREE)" : ""}
                          </option>
                        ))}
                      </select>
                      <button type="button" onClick={fetchRobotGames} disabled={loadingRobotGames}
                        className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-border/40 text-muted-foreground hover:text-foreground transition-colors">
                        {loadingRobotGames ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    {formRobotGameId && formRobotGameId > 0 && robotGames.length > 0 && (() => {
                      const rg = robotGames.find(g => Number(g.id) === Number(formRobotGameId));
                      if (!rg) return null;
                      return (
                        <div className="mt-2 rounded-lg bg-muted/20 p-3 text-[10px] text-muted-foreground space-y-1">
                          <p>Versão: {rg.version} · Status: <span className={rg.status === "on" ? "text-success font-semibold" : "text-destructive font-semibold"}>{rg.status.toUpperCase()}</span> · Câmbio: R${robotUsdToBrl.toFixed(2)}/USD</p>
                          {Object.keys(rg.prices).length > 0 && (
                            <div>
                              <p className="font-semibold text-foreground/70">Preços API (40% cashback):</p>
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
                    <label className="mb-1.5 block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Markup %</label>
                    <input type="number" value={formRobotMarkup || ""} onChange={(e) => setFormRobotMarkup(Number(e.target.value) || null)}
                      min="0" max="500" step="1" placeholder="Ex: 30 (30% de lucro)" className={inputClass} />
                    <p className="text-[10px] text-muted-foreground/50 mt-1.5">Preço API × câmbio × (1 + markup/100). 40% volta como cashback.</p>
                  </div>
                </div>
              )}
            </div>
          </SectionCard>

          {/* Media Gallery */}
          <SectionCard title="Galeria de Mídia" icon={Film}>
            {formMedia.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {formMedia.map((m, idx) => {
                  const ytId = getYouTubeId(m.url);
                  return (
                    <div key={m._key || idx} className="relative group">
                      {m.media_type === "video" ? (
                        ytId ? (
                          <img src={getYouTubeThumbnail(ytId)} alt="YouTube" className="h-20 w-20 rounded-xl border border-border/40 object-cover" />
                        ) : (
                          <video src={m.url} className="h-20 w-20 rounded-xl border border-border/40 object-cover" muted />
                        )
                      ) : (
                        <img src={m.url} alt="" className="h-20 w-20 rounded-xl border border-border/40 object-cover" />
                      )}
                      {m.media_type === "video" && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm">
                            <Film className="h-3 w-3 text-success" />
                          </div>
                        </div>
                      )}
                      <button onClick={() => removeMedia(idx)}
                        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="h-3 w-3" />
                      </button>
                      <span className="absolute bottom-1 left-1 rounded-md bg-background/80 px-1 text-[8px] font-bold text-foreground">{idx + 1}</span>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex gap-2 mb-2">
              <input type="text" value={mediaUrlInput} onChange={(e) => setMediaUrlInput(e.target.value)}
                placeholder="Cole URL: imagem, MP4, YouTube..."
                className={`flex-1 ${inputClass}`} />
              <button type="button" onClick={addMediaByUrl}
                className="flex items-center gap-1.5 rounded-xl bg-success/10 border border-success/20 px-4 py-2.5 text-xs font-medium text-success hover:bg-success/20 transition-colors">
                <Plus className="h-3 w-3" /> Adicionar
              </button>
            </div>
            {mediaUrlInput && (
              <p className="mb-2 text-[10px] text-muted-foreground">
                Detectado: <span className="font-bold text-success">{detectMediaType(mediaUrlInput) === "video" ? "Vídeo" : "Imagem"}</span>
                {getYouTubeId(mediaUrlInput) && " (YouTube)"}
              </p>
            )}
            <button type="button" onClick={() => mediaFileInputRef.current?.click()} disabled={uploadingMedia}
              className="flex items-center gap-2 rounded-xl border-2 border-dashed border-border/40 px-4 py-3 text-xs font-medium text-muted-foreground hover:border-success/30 hover:text-foreground transition-colors w-full justify-center">
              {uploadingMedia ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {uploadingMedia ? "Enviando..." : "Upload de arquivo"}
            </button>
            <input ref={mediaFileInputRef} type="file" accept="image/*,video/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadMediaFile(f); }} />
          </SectionCard>

          {/* Features Text */}
          <SectionCard title="Features / Características" icon={Sparkles} actions={
            <button type="button" onClick={() => setFormFeatures([...formFeatures, { label: "", value: "", sort_order: formFeatures.length, _key: crypto.randomUUID() }])}
              className="flex items-center gap-1 rounded-lg bg-success/10 border border-success/20 px-3 py-1.5 text-[11px] font-medium text-success hover:bg-success/20 transition-colors">
              <Plus className="h-3 w-3" /> Feature
            </button>
          }>
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Texto descritivo (opcional)</label>
                <textarea value={formFeaturesText} onChange={(e) => setFormFeaturesText(e.target.value.slice(0, 500))}
                  placeholder="Texto que aparece acima dos cards de features..." rows={2}
                  className={`${inputClass} resize-none`} />
              </div>
              {formFeatures.length === 0 && (
                <p className="text-xs text-muted-foreground/50 italic">Ex: Skins: 49, Agentes: 26, Nível: 120</p>
              )}
              <div className="space-y-2">
                {formFeatures.map((feat, idx) => (
                  <div key={feat._key || idx} className="flex items-center gap-2 rounded-xl border border-border/40 bg-background/50 p-3">
                    <input type="text" value={feat.label} onChange={(e) => {
                      const updated = [...formFeatures];
                      updated[idx].label = e.target.value.slice(0, 30);
                      setFormFeatures(updated);
                    }}
                      placeholder="Label"
                      className="w-28 sm:w-36 rounded-lg border border-border/40 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-success/50" />
                    <input type="text" value={feat.value} onChange={(e) => {
                      const updated = [...formFeatures];
                      updated[idx].value = e.target.value.slice(0, 50);
                      setFormFeatures(updated);
                    }}
                      placeholder="Valor"
                      className="flex-1 rounded-lg border border-border/40 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-success/50" />
                    <button type="button" onClick={() => setFormFeatures(formFeatures.filter((_, i) => i !== idx))}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground/40 hover:bg-destructive/10 hover:text-destructive transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>

          {/* Tutorial */}
          <SectionCard title="Tutorial / Loader" icon={FileText}>
            {robotEnabled && (
              <p className="text-[10px] text-muted-foreground/60 mb-3 bg-accent/5 rounded-lg px-3 py-2 border border-accent/10">
                💡 Para produtos Robot, tutorial e loader são exibidos como banner no chat do pedido.
              </p>
            )}
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Texto do Tutorial</label>
                <textarea value={formTutorialText} onChange={(e) => setFormTutorialText(e.target.value.slice(0, 2000))}
                  placeholder="Instruções de uso, passo a passo..." rows={4}
                  className={`${inputClass} resize-none`} />
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Arquivo do Tutorial / Loader</label>
                {formTutorialFileUrl && (
                  <div className="mb-2 flex items-center gap-2 rounded-xl border border-success/20 bg-success/5 px-4 py-2.5">
                    <FileText className="h-4 w-4 text-success shrink-0" />
                    <a href={formTutorialFileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-success hover:underline truncate flex-1">{formTutorialFileUrl}</a>
                    <button type="button" onClick={() => setFormTutorialFileUrl("")} className="text-muted-foreground hover:text-destructive transition-colors"><X className="h-3.5 w-3.5" /></button>
                  </div>
                )}
                <div className="flex gap-2">
                  <input type="text" value={formTutorialFileUrl} onChange={(e) => setFormTutorialFileUrl(e.target.value)}
                    placeholder="https://link-do-arquivo..." className={`flex-1 ${inputClass}`} />
                  <button type="button" onClick={() => tutorialFileInputRef.current?.click()} disabled={uploadingTutorial}
                    className="flex items-center gap-1.5 rounded-xl border-2 border-dashed border-border/40 px-4 py-2.5 text-xs font-medium text-muted-foreground hover:border-success/30 hover:text-foreground transition-colors">
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
                <p className="text-[10px] text-muted-foreground/50 mt-1.5">
                  {robotEnabled
                    ? "Texto e arquivo exibidos como banner no chat do pedido."
                    : "Enviados automaticamente no chat do ticket após a compra."}
                </p>
              </div>
            </div>
          </SectionCard>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-card/50 p-4">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-success px-6 py-2.5 text-sm font-bold text-success-foreground shadow-sm shadow-success/20 hover:bg-success/90 disabled:opacity-50 transition-colors">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {editing ? "Salvar Alterações" : "Criar Produto"}
            </button>
            <button onClick={resetForm} className="rounded-xl border border-border/40 px-6 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-border transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductsTab;
