import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { useAuth } from "@/hooks/useAuth";
import { supabase, supabaseUrl, supabaseAnonKey } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, Gift, Trophy, Frown, Ticket, History, Star, X, Flower2, Copy, Check, Plus, Minus, Package, User, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { safeJsonFetch, ApiError } from "@/lib/apiUtils";
import type { PixPaymentCreateResult, PixPaymentStatusResult, ScratchCardPlayResult } from "@/lib/edgeFunctionTypes";
import type { Json, Tables } from "@/integrations/supabase/types";
import { paymentCartSnapshot } from "@/types/paymentCart";

interface Prize {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  win_percentage?: number;
  prize_value?: number;
}

type ScratchPlayRow = Tables<"scratch_card_plays">;
type PublicScratchPrizeRow = Tables<"public_scratch_card_prizes">;

interface Play {
  id: string;
  won: boolean;
  prize_id: string | null;
  amount_paid: number;
  grid_data: Json | null;
  created_at: string;
}

function mapPublicScratchPrizeRow(r: PublicScratchPrizeRow): Prize | null {
  if (r.id == null || r.name == null || r.id === "" || r.name === "") return null;
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? null,
    image_url: r.image_url ?? null,
  };
}

function mapScratchPlayRow(r: ScratchPlayRow): Play {
  return {
    id: r.id,
    won: r.won ?? false,
    prize_id: r.prize_id,
    amount_paid: Number(r.amount_paid ?? 0),
    grid_data: r.grid_data,
    created_at: r.created_at ?? "",
  };
}

interface GridCell {
  type: "prize" | "nothing";
  prizeId?: string;
  name: string;
  image_url?: string | null;
  nothingIcon: "x" | "flower" | "skull";
  prize_value?: number;
}

type RaspadinhaMode = "produtos" | "contas";

function coerceRaspadinhaMode(m: string): RaspadinhaMode {
  return m === "contas" ? "contas" : "produtos";
}




const NOTHING_ICONS = ["x", "flower", "skull"] as const;
// Win chances are determined server-side only
const CONTAS_PRICE = 6.10;
const MAX_QUANTITY = 10;

const NothingIcon = ({ icon, className }: { icon: string; className?: string }) => {
  switch (icon) {
    case "flower": return <Flower2 className={className} />;
    case "skull": return <span className={`text-2xl md:text-3xl ${className}`}>💀</span>;
    default: return <X className={className} />;
  }
};

const CellContent = ({ cell }: { cell: GridCell }) => {
  if (cell.type === "prize") {
    return (
      <div className="absolute inset-0">
        {cell.image_url ? (
          <img src={cell.image_url} alt={cell.name} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center bg-success/10">
            <Gift className="h-8 w-8 text-success" />
          </div>
        )}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-1 py-1">
          <span className="text-[8px] md:text-[9px] font-semibold text-white leading-tight text-center block truncate">
            {cell.name}
          </span>
        </div>
      </div>
    );
  }
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-secondary/80">
      <NothingIcon icon={cell.nothingIcon} className="h-8 w-8 md:h-10 md:w-10 text-muted-foreground/50" />
      <span className="text-[9px] md:text-[10px] text-muted-foreground mt-1">Nada</span>
    </div>
  );
};

type PaymentPhase = "idle" | "generating" | "paying" | "paid";

const Raspadinha = () => {
  const { user } = useAuth();
  const [mode, setMode] = useState<RaspadinhaMode>("produtos");

  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [config, setConfig] = useState<{ price: number; active: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [grid, setGrid] = useState<GridCell[]>([]);
  const [revealed, setRevealed] = useState<boolean[]>(Array(9).fill(false));
  const [allRevealed, setAllRevealed] = useState(false);
  const [result, setResult] = useState<{ won: boolean; prize?: Prize } | null>(null);
  const [history, setHistory] = useState<Play[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const navigateAuth = useNavigate();
  const [scratching, setScratching] = useState(false);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>(Array(9).fill(null));
  const isDrawing = useRef(false);
  const pendingCanvasPaintRef = useRef<string | null>(null);

  // Payment state
  const [paymentPhase, setPaymentPhase] = useState<PaymentPhase>("idle");
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const paymentIdRef = useRef<string | null>(null);
  const [chargeData, setChargeData] = useState<{ brCode: string; qrCodeImage: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const raspadinhaPollFailCountRef = useRef(0);
  const raspadinhaPollNotifiedRef = useRef(false);
  const pendingQuantityRef = useRef(1);
  const pendingModeRef = useRef<RaspadinhaMode>("produtos");
  const [pendingPayment, setPendingPayment] = useState<{ id: string; mode: string; quantity: number } | null>(null);
  const mountedRef = useRef(true);
  const createPaymentCancelledRef = useRef(false);

  // Contas prizes pool (fixed)
  const contasPrizes: Prize[] = [
    { id: "conta-valorant", name: "Conta Valorant", description: null, image_url: null, win_percentage: 40, prize_value: 0 },
    { id: "conta-lol", name: "Conta LoL", description: null, image_url: null, win_percentage: 30, prize_value: 0 },
    { id: "conta-fortnite", name: "Conta Fortnite", description: null, image_url: null, win_percentage: 20, prize_value: 0 },
    { id: "conta-minecraft", name: "Conta Minecraft", description: null, image_url: null, win_percentage: 10, prize_value: 0 },
  ];

  const activePrizes = mode === "produtos" ? prizes : contasPrizes;
  const unitPrice = mode === "produtos" ? (config?.price ?? 2.50) : CONTAS_PRICE;
  const totalPrice = unitPrice * quantity;

  // Fetch products prizes + config
  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      const [{ data: prizesData }, { data: configData }] = await Promise.all([
        supabase.from("public_scratch_card_prizes").select("id, name, description, image_url").eq("active", true).order("sort_order"),
        supabase.from("scratch_card_config").select("price, active").limit(1).maybeSingle(),
      ]);
      if (cancelled) return;
      if (prizesData) {
        setPrizes(
          prizesData
            .map(mapPublicScratchPrizeRow)
            .filter((p): p is Prize => p !== null),
        );
      }
      if (configData) {
        setConfig({
          price: configData.price ?? 2.5,
          active: configData.active ?? false,
        });
      }
      setLoading(false);
    };
    void fetchData();
    return () => {
      cancelled = true;
    };
  }, []);




  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void supabase
      .from("scratch_card_plays")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (!cancelled && data) setHistory(data.map(mapScratchPlayRow));
      });
    return () => {
      cancelled = true;
    };
  }, [user, result]);

  const [checkingPayments, setCheckingPayments] = useState(false);

  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      throw new Error("Sessão expirada. Entre novamente.");
    }
    const apikey = supabaseAnonKey;
    if (!apikey.trim()) {
      throw new Error("Configuração do aplicativo incompleta.");
    }
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      apikey,
    };
  };

  // Check for paid-but-unplayed scratch card payments AND active payments that may have been paid
  const checkPendingPayments = useCallback(async (silent = false) => {
    if (!user || !mountedRef.current) return;
    if (!silent) setCheckingPayments(true);
    try {
      // Find recent raspadinha payments (COMPLETED or ACTIVE) from last 24h
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: payments } = await supabase
        .from("payments")
        .select("id, cart_snapshot, created_at, status")
        .eq("user_id", user.id)
        .in("status", ["COMPLETED", "ACTIVE"])
        .gte("created_at", oneDayAgo)
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (!payments || payments.length === 0) {
        if (!silent) {
          toast({ title: "Nenhum pagamento pendente encontrado" });
          if (mountedRef.current) setCheckingPayments(false);
        }
        return;
      }
      
      for (const payment of payments) {
        if (!mountedRef.current) return;
        const cart = paymentCartSnapshot(payment.cart_snapshot);
        if (cart.length === 0) continue;
        const raspadinhaItem = cart.find((item) => item.type === "raspadinha");
        if (!raspadinhaItem) continue;

        // If payment is still ACTIVE, re-check status with the gateway
        if (payment.status === "ACTIVE") {
          try {
            const headers = await getAuthHeaders();
            const data = await safeJsonFetch<PixPaymentStatusResult>(
              `${supabaseUrl}/functions/v1/pix-payment?action=status&payment_id=${payment.id}`,
              { headers }
            );
            if (data.status === "COMPLETED") {
              if (!mountedRef.current) return;
              const paymentMode = raspadinhaItem.planId?.includes("contas") ? "contas" : "produtos";
              const qty = parseInt(raspadinhaItem.planName?.match(/(\d+)x/)?.[1] || "1", 10);
              setPendingPayment({ id: payment.id, mode: paymentMode, quantity: qty });
              if (!silent) toast({ title: "Pagamento confirmado! Clique em Jogar Agora 🎉" });
              setCheckingPayments(false);
              return;
            }
          } catch (e: unknown) {
            console.warn("checkPendingPayments status poll failed:", e);
          }
          continue;
        }
        
        // For COMPLETED payments, check if plays exist
        const { data: plays } = await supabase
          .from("scratch_card_plays")
          .select("id")
          .eq("payment_id", payment.id)
          .limit(1);
        
        if (!plays || plays.length === 0) {
          if (!mountedRef.current) return;
          const paymentMode = raspadinhaItem.planId?.includes("contas") ? "contas" : "produtos";
          const qty = parseInt(raspadinhaItem.planName?.match(/(\d+)x/)?.[1] || "1", 10);
          setPendingPayment({ id: payment.id, mode: paymentMode, quantity: qty });
          if (!silent) toast({ title: "Raspadinha pendente encontrada! 🎉" });
          setCheckingPayments(false);
          return;
        }
      }
      if (!silent) {
        toast({ title: "Nenhum pagamento pendente encontrado" });
      }
    } catch (e: unknown) {
      console.error("checkPendingPayments failed:", e);
      if (!silent) {
        toast({
          title: "Erro ao verificar pagamentos",
          description: e instanceof Error ? e.message : "Tente novamente.",
          variant: "destructive",
        });
      }
    }
    if (mountedRef.current) setCheckingPayments(false);
  }, [user]);

  useEffect(() => {
    if (paymentPhase !== "idle") return;
    checkPendingPayments(true);
  }, [checkPendingPayments, paymentPhase]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, []);

  // Reset game when switching mode
  const handleModeChange = (newMode: RaspadinhaMode) => {
    if (paymentPhase !== "idle" || scratching) return;
    setMode(newMode);
    resetGame();
    setQuantity(1);
  };

  const cellId = (cell: GridCell) => cell.type === "prize" ? cell.prizeId! : `nothing-${cell.nothingIcon}`;

  // Grid generation and win determination are handled server-side only.
  // See edge function scratch-card-play for the secure implementation.

  const handlePlay = async () => {
    if (!user) {
      navigateAuth("/auth?redirect=/raspadinha");
      return;
    }
    if (mode === "produtos" && !config?.active) {
      toast({ title: "Raspadinha indisponível", variant: "destructive" });
      return;
    }

    setPlaying(true);
    createPaymentCancelledRef.current = false;
    setPaymentPhase("generating");
    setResult(null);
    setAllRevealed(false);
    setRevealed(Array(9).fill(false));
    setGrid([]);
    setChargeData(null);
    setPaymentId(null);
    paymentIdRef.current = null;
    setCopied(false);

    pendingQuantityRef.current = quantity;
    pendingModeRef.current = mode;

    try {
      const totalAmount = Math.round(unitPrice * quantity * 100);
      const label = mode === "contas" ? "Raspadinha de Contas" : "Raspadinha da Sorte";
      const data = await safeJsonFetch<PixPaymentCreateResult>(
        `${supabaseUrl}/functions/v1/pix-payment?action=create`,
        {
          method: "POST",
          headers: await getAuthHeaders(),
          body: JSON.stringify({
            amount: totalAmount,
            description: `${label}${quantity > 1 ? ` x${quantity}` : ""} - R$ ${(unitPrice * quantity).toFixed(2)}`,
            cart_snapshot: [{
              productId: "raspadinha",
              productName: label,
              planId: `raspadinha-${mode}`,
              planName: `${quantity}x ${label}`,
              price: unitPrice,
              quantity: quantity,
              type: "raspadinha",
            }],
          }),
        }
      );
      if (!data.success) throw new Error(data.error || "Erro ao criar cobrança");
      if (!data.payment_id) throw new Error("Resposta sem payment_id");
      if (!mountedRef.current) return;
      if (createPaymentCancelledRef.current) {
        setPlaying(false);
        return;
      }

      setPaymentId(data.payment_id);
      paymentIdRef.current = data.payment_id;
      setChargeData(data.charge ?? null);
      setPaymentPhase("paying");
      setPlaying(false);

      startPolling(data.payment_id);
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : String(err);
      toast({ title: "Erro ao gerar pagamento", description: message, variant: "destructive" });
      setPlaying(false);
      if (mountedRef.current) setPaymentPhase("idle");
    }
  };

  const startPolling = (pId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    raspadinhaPollFailCountRef.current = 0;
    raspadinhaPollNotifiedRef.current = false;
    const check = async () => {
      try {
        const headers = await getAuthHeaders();
        const data = await safeJsonFetch<PixPaymentStatusResult>(
          `${supabaseUrl}/functions/v1/pix-payment?action=status&payment_id=${pId}`,
          { headers }
        );
        if (!mountedRef.current) return;
        raspadinhaPollFailCountRef.current = 0;
        if (data.status === "COMPLETED") {
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          void onPaymentCompleted();
        } else if (data.status === "EXPIRED" || data.status === "FAILED" || data.status === "CANCELLED") {
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          setPaymentPhase("idle");
          setChargeData(null);
          toast({ title: "Pagamento expirado ou cancelado", variant: "destructive" });
        }
      } catch (e: unknown) {
        if (!mountedRef.current) return;
        raspadinhaPollFailCountRef.current += 1;
        console.error("Raspadinha payment status poll failed:", e);
        if (raspadinhaPollFailCountRef.current >= 5 && !raspadinhaPollNotifiedRef.current) {
          raspadinhaPollNotifiedRef.current = true;
          toast({
            title: "Não foi possível verificar o pagamento",
            description: "Verifique sua conexão. Atualize a página se já pagou.",
            variant: "destructive",
          });
        }
      }
    };
    pollRef.current = setInterval(check, 10000);
    check();
  };

  // Paint scratch overlay on canvases after React renders them (replaces unreliable setTimeout)
  const paintCanvasOverlay = useCallback(() => {
    const paintMode = pendingCanvasPaintRef.current;
    if (!paintMode) return;
    const painted = canvasRefs.current.every((canvas, i) => {
      if (revealed[i]) return true; // no canvas needed
      if (!canvas) return false; // canvas not mounted yet
      const ctx = canvas.getContext("2d");
      if (!ctx) return false;
      const w = canvas.width;
      const h = canvas.height;
      const grad = ctx.createLinearGradient(0, 0, w, h);
      if (paintMode === "contas") {
        grad.addColorStop(0, "hsl(220, 80%, 30%)");
        grad.addColorStop(0.5, "hsl(220, 100%, 47%)");
        grad.addColorStop(1, "hsl(220, 80%, 30%)");
      } else {
        grad.addColorStop(0, "hsl(197, 80%, 30%)");
        grad.addColorStop(0.5, "hsl(197, 100%, 50%)");
        grad.addColorStop(1, "hsl(197, 80%, 30%)");
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      for (let x = 0; x < w; x += 20) {
        for (let y = 0; y < h; y += 20) {
          if ((x + y) % 40 === 0) ctx.fillRect(x, y, 10, 10);
        }
      }
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.font = `bold ${Math.floor(w * 0.4)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("?", w / 2, h / 2);
      return true;
    });
    if (painted) pendingCanvasPaintRef.current = null;
  }, [revealed]);

  // Run paint after scratching state causes canvases to mount
  useEffect(() => {
    if (scratching && pendingCanvasPaintRef.current) {
      // Use requestAnimationFrame to ensure DOM has updated
      const raf = requestAnimationFrame(() => paintCanvasOverlay());
      return () => cancelAnimationFrame(raf);
    }
  }, [scratching, paintCanvasOverlay]);




  const onPaymentCompleted = async () => {
    if (!mountedRef.current) return;
    setPaymentPhase("paid");
    setChargeData(null);

    const qty = pendingQuantityRef.current;
    const currentMode = pendingModeRef.current;

    toast({
      title: "Pagamento confirmado! 🎉",
      description:
        qty > 1
          ? `Valor de ${qty} unidades — um sorteio por pagamento. Raspe para revelar!`
          : "Raspe para revelar!",
    });

    try {
      const headers = await getAuthHeaders();
      if (!mountedRef.current) return;
      const data = await safeJsonFetch<ScratchCardPlayResult>(
        `${supabaseUrl}/functions/v1/scratch-card-play`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            payment_id: paymentIdRef.current,
            mode: currentMode,
            quantity: qty,
          }),
        }
      );
      if (!mountedRef.current) return;
      if (!data) throw new Error("Erro ao processar raspadinha");

      const newGrid: GridCell[] = data.grid;
      setGrid(newGrid);
      const p = data.prize;
      setResult({
        won: data.won,
        prize: p
          ? {
              id: p.id ?? "",
              name: p.name ?? "",
              description: null,
              image_url: p.image_url ?? null,
              prize_value: p.prize_value,
            }
          : undefined,
      });
    } catch (err: unknown) {
      console.error("scratch-card-play error:", err);
      const message = err instanceof Error ? err.message : String(err);
      toast({ title: "Erro ao processar raspadinha", description: message, variant: "destructive" });
      resetGame();
      return;
    }

    if (!mountedRef.current) return;
    setScratching(true);
    // Store mode for canvas paint after React re-renders
    pendingCanvasPaintRef.current = currentMode;
  };

  const handleScratch = (index: number, e: React.MouseEvent | React.TouchEvent) => {
    if (!scratching || revealed[index]) return;
    const canvas = canvasRefs.current[index];
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let x: number, y: number;
    if ("touches" in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    const scale = canvas.width / rect.width;
    x *= scale;
    y *= scale;

    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(x, y, 20 * scale, 0, Math.PI * 2);
    ctx.fill();

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let transparent = 0;
    for (let i = 3; i < imageData.data.length; i += 4) {
      if (imageData.data[i] === 0) transparent++;
    }
    const pct = transparent / (imageData.data.length / 4);
    if (pct > 0.4) {
      const newRevealed = [...revealed];
      newRevealed[index] = true;
      setRevealed(newRevealed);
      if (newRevealed.every(Boolean)) {
        setAllRevealed(true);
        setScratching(false);
      }
    }
  };

  const revealAll = () => {
    setRevealed(Array(9).fill(true));
    setAllRevealed(true);
    setScratching(false);
  };

  const checkWinCell = (index: number): boolean => {
    if (grid.length < 9) return false;
    const patterns = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6],
    ];
    return patterns.some(([a, b, c]) => {
      // Only highlight prize matches — never "nothing" cells
      if (grid[a].type !== "prize" || grid[b].type !== "prize" || grid[c].type !== "prize") return false;
      const idA = cellId(grid[a]);
      const idB = cellId(grid[b]);
      const idC = cellId(grid[c]);
      return idA === idB && idB === idC && [a, b, c].includes(index);
    });
  };

  const copyCode = () => {
    if (chargeData?.brCode) {
      navigator.clipboard.writeText(chargeData.brCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Código PIX copiado!" });
    }
  };

  const resetGame = () => {
    setPaymentPhase("idle");
    setPaymentId(null);
    paymentIdRef.current = null;
    setChargeData(null);
    setScratching(false);
    setAllRevealed(false);
    setResult(null);
    setGrid([]);
    setRevealed(Array(9).fill(false));
  };

  const handleReplay = async () => {
    if (!pendingPayment) return;
    setPaymentId(pendingPayment.id);
    paymentIdRef.current = pendingPayment.id;
    pendingQuantityRef.current = pendingPayment.quantity;
    pendingModeRef.current = coerceRaspadinhaMode(pendingPayment.mode);
    setMode(coerceRaspadinhaMode(pendingPayment.mode));
    setQuantity(pendingPayment.quantity);
    setPendingPayment(null);
    
    // Call directly onPaymentCompleted logic
    setPaymentPhase("paid");
    const qty = pendingPayment.quantity;
    const currentMode = coerceRaspadinhaMode(pendingPayment.mode);

    toast({ title: "Carregando sua raspadinha! 🎉" });

    try {
      const headers = await getAuthHeaders();
      if (!mountedRef.current) return;
      const data = await safeJsonFetch<ScratchCardPlayResult>(
        `${supabaseUrl}/functions/v1/scratch-card-play`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            payment_id: pendingPayment.id,
            mode: currentMode,
            quantity: qty,
          }),
        }
      );
      if (!mountedRef.current) return;
      if (!data) throw new Error("Erro ao processar raspadinha");

      const newGrid: GridCell[] = data.grid;
      setGrid(newGrid);
      const p = data.prize;
      setResult({
        won: data.won,
        prize: p
          ? {
              id: p.id ?? "",
              name: p.name ?? "",
              description: null,
              image_url: p.image_url ?? null,
              prize_value: p.prize_value,
            }
          : undefined,
      });
    } catch (err: unknown) {
      console.error("scratch-card-play replay error:", err);
      const message = err instanceof Error ? err.message : String(err);
      toast({ title: "Erro ao processar raspadinha", description: message, variant: "destructive" });
      resetGame();
      return;
    }

    if (!mountedRef.current) return;
    setScratching(true);
    pendingCanvasPaintRef.current = coerceRaspadinhaMode(pendingPayment.mode);
  };

  const isContas = mode === "contas";
  const accentColor = isContas ? "hsl(var(--info))" : "hsl(var(--success))";
  const accentClass = isContas ? "text-info" : "text-success";
  const borderAccent = isContas ? "border-info/30" : "border-success/30";
  const bgAccent = isContas ? "bg-info/10" : "bg-success/10";

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center pt-16">
          <Loader2 className="h-8 w-8 animate-spin text-success" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      

      <div className="mx-auto max-w-4xl px-4 sm:px-6 pt-4 pb-20">
        {/* Pending payment banner */}
        {pendingPayment && paymentPhase === "idle" && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 rounded-xl border border-warning/30 bg-warning/10 p-4 flex items-center justify-between gap-4"
          >
            <div>
              <p className="text-sm font-semibold text-warning">🎰 Você tem uma raspadinha pendente!</p>
              <p className="text-xs text-muted-foreground mt-1">
                Pagamento confirmado mas o jogo não carregou. Clique para jogar agora.
              </p>
            </div>
            <button
              onClick={handleReplay}
              className="shrink-0 rounded-lg bg-warning px-5 py-2.5 text-sm font-bold text-warning-foreground hover:bg-warning/90 transition-colors"
            >
              Jogar Agora
            </button>
          </motion.div>
        )}

        {/* Manual verify button when no pending payment detected */}
        {!pendingPayment && paymentPhase === "idle" && user && (
          <div className="flex justify-end mb-4">
            <button
              onClick={() => checkPendingPayments(false)}
              disabled={checkingPayments}
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-success/30 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${checkingPayments ? "animate-spin" : ""}`} />
              Verificar pagamento pendente
            </button>
          </div>
        )}

        {/* Title */}
        <div className="text-center mb-6 sm:mb-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`inline-flex items-center gap-2 rounded-full border ${borderAccent} ${bgAccent} px-4 py-1.5 mb-3`}
          >
            <Ticket className={`h-4 w-4 ${accentClass}`} />
            <span className={`text-xs sm:text-sm font-medium ${accentClass}`}>Raspadinha da Sorte</span>
          </motion.div>
          <h1
            className="text-2xl sm:text-4xl md:text-5xl font-bold text-foreground mb-1.5 sm:mb-3"
            style={{ fontFamily: "'Valorant', sans-serif" }}
          >
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: isContas
                  ? "linear-gradient(90deg, hsl(220,100%,60%), hsl(200,100%,65%), hsl(220,100%,60%))"
                  : "linear-gradient(90deg, hsl(197,100%,50%), hsl(197,100%,65%), hsl(197,100%,50%))",
              }}
            >
              RASPADINHA
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto px-2">
            Apenas{" "}
            <span className={`font-bold ${accentClass}`}>
              R$ {unitPrice.toFixed(2)}
            </span>{" "}
            por raspadinha. Três iguais em linha = <span className={`font-semibold ${accentClass}`}>PRÊMIO!</span>
          </p>
        </div>

        {/* Mode Tabs */}
        <div className="flex justify-center mb-6 sm:mb-8">
          <div className="grid grid-cols-2 rounded-xl border border-border bg-card p-1 gap-1 w-full max-w-xs sm:max-w-sm">
            <button
              onClick={() => handleModeChange("produtos")}
              disabled={paymentPhase !== "idle" || scratching}
              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all ${
                mode === "produtos"
                  ? "bg-success text-success-foreground shadow"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              <Package className="h-4 w-4" />
              Produtos
            </button>
            <button
              onClick={() => handleModeChange("contas")}
              disabled={paymentPhase !== "idle" || scratching}
              className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all ${
                mode === "contas"
                  ? "bg-info text-info-foreground shadow"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              <User className="h-4 w-4" />
              Contas
              <span className="rounded-full bg-info/20 px-1.5 py-0.5 text-[9px] font-bold text-info border border-info/30">
                R$ {CONTAS_PRICE.toFixed(2).replace(".", ",")}
              </span>
            </button>
          </div>
        </div>

        {/* Mode description */}
        <AnimatePresence mode="wait">
          <motion.p
            key={mode}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-center text-xs text-muted-foreground mb-6 sm:mb-8 px-4"
          >
            {mode === "produtos"
              ? "🎁 Ganhe produtos do nosso catálogo — hacks, cheats e ferramentas exclusivas."
              : "🎮 Ganhe uma conta de jogo aleatória — Valorant, LoL, Fortnite ou Minecraft!"}
          </motion.p>
        </AnimatePresence>

        {/* PIX Payment Modal */}
        <AnimatePresence>
          {(paymentPhase === "generating" || paymentPhase === "paying") && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
            >
              <motion.div
                initial={{ y: 20 }}
                animate={{ y: 0 }}
                className={`relative w-full max-w-md rounded-2xl border ${borderAccent} bg-card p-6 md:p-8`}
                style={{ boxShadow: `0 0 60px ${accentColor}33` }}
              >
                <button
                  onClick={() => {
                    createPaymentCancelledRef.current = true;
                    if (pollRef.current) {
                      clearInterval(pollRef.current);
                      pollRef.current = null;
                    }
                    setPaymentPhase("idle");
                    setChargeData(null);
                    setPlaying(false);
                  }}
                  className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>

                <div className="text-center mb-6">
                  <div className={`inline-flex items-center gap-2 rounded-full ${bgAccent} border ${borderAccent} px-3 py-1 mb-3`}>
                    <div className={`h-2 w-2 rounded-full ${isContas ? "bg-info" : "bg-success"} animate-pulse`} />
                    <span className={`text-xs font-medium ${accentClass}`}>
                      {paymentPhase === "generating" ? "A preparar o PIX" : "Aguardando pagamento"}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Valorant', sans-serif" }}>
                    {paymentPhase === "generating" ? "UM MOMENTO" : "PAGUE VIA PIX"}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    R$ {totalPrice.toFixed(2)} • {pendingQuantityRef.current}x {isContas ? "Raspadinha de Contas" : "Raspadinha"}
                  </p>
                  {paymentPhase === "generating" && (
                    <p className="text-xs text-muted-foreground mt-3 flex items-center justify-center gap-2">
                      <Loader2 className={`h-4 w-4 animate-spin shrink-0 ${accentClass}`} />
                      A gerar o código PIX no banco — não feche esta janela.
                    </p>
                  )}
                </div>

                {chargeData?.qrCodeImage && (
                  <div className="mx-auto mb-4 w-48 h-48 rounded-xl border border-border bg-white p-2">
                    <img src={chargeData.qrCodeImage} alt="QR Code PIX" className="h-full w-full object-contain" />
                  </div>
                )}

                {chargeData && (
                  <div className="mb-4">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 text-center">Código Copia e Cola</p>
                    <div className="flex gap-2">
                      <input
                        readOnly
                        value={chargeData.brCode}
                        className="flex-1 rounded-lg border border-border bg-secondary/50 px-3 py-2.5 text-xs text-foreground font-mono truncate"
                      />
                      <button
                        onClick={copyCode}
                        className={`flex items-center gap-1.5 rounded-lg ${isContas ? "bg-info" : "bg-success"} px-4 py-2.5 text-xs font-bold text-white transition-all`}
                      >
                        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copied ? "Copiado" : "Copiar"}
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className={`h-3.5 w-3.5 animate-spin ${accentClass}`} />
                  <span>
                    {paymentPhase === "generating"
                      ? "Isto costuma levar só alguns segundos."
                      : "O jogo será liberado automaticamente após o pagamento"}
                  </span>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Game Area */}
        <div className="flex flex-col items-center">
          <motion.div
            layout
            className={`relative w-full max-w-[22rem] sm:max-w-sm md:max-w-md mx-auto rounded-2xl border-2 ${borderAccent} bg-gradient-to-br from-card via-secondary/50 to-card p-4 sm:p-6 md:p-8`}
            style={{ boxShadow: `0 0 60px ${accentColor}26` }}
          >
            {/* Decorative corners */}
            <div className={`absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 ${isContas ? "border-info" : "border-success"} rounded-tl-2xl`} />
            <div className={`absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 ${isContas ? "border-info" : "border-success"} rounded-tr-2xl`} />
            <div className={`absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 ${isContas ? "border-info" : "border-success"} rounded-bl-2xl`} />
            <div className={`absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 ${isContas ? "border-info" : "border-success"} rounded-br-2xl`} />

            {/* 3x3 Grid */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {(grid.length === 9 ? grid : Array(9).fill(null)).map((cell, i) => (
                <div
                  key={i}
                  className="relative aspect-square rounded-xl overflow-hidden select-none"
                >
                  <div className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${
                    revealed[i] ? "scale-100 opacity-100" : "scale-75 opacity-30"
                  } ${
                    allRevealed && result?.won && checkWinCell(i)
                      ? `${bgAccent} border-2 ${isContas ? "border-info" : "border-success"}`
                      : "bg-secondary/80 border border-border"
                  } rounded-xl`}
                  style={
                    allRevealed && result?.won && checkWinCell(i)
                      ? { boxShadow: `0 0 20px ${accentColor}66` }
                      : {}
                  }>
                    {(scratching || allRevealed) && cell ? (
                      <CellContent cell={cell} />
                    ) : (
                      <span className="text-3xl md:text-4xl font-bold text-muted-foreground/40">?</span>
                    )}
                  </div>

                  {scratching && !revealed[i] && (
                    <canvas
                      ref={(el) => { canvasRefs.current[i] = el; }}
                      width={224}
                      height={224}
                      className="absolute inset-0 w-full h-full cursor-pointer rounded-xl touch-none"
                      onMouseDown={() => { isDrawing.current = true; }}
                      onMouseUp={() => { isDrawing.current = false; }}
                      onMouseLeave={() => { isDrawing.current = false; }}
                      onMouseMove={(e) => { if (isDrawing.current) handleScratch(i, e); }}
                      onTouchStart={(e) => { e.preventDefault(); isDrawing.current = true; handleScratch(i, e); }}
                      onTouchMove={(e) => { e.preventDefault(); if (isDrawing.current) handleScratch(i, e); }}
                      onTouchEnd={() => { isDrawing.current = false; }}
                    />
                  )}
                </div>
              ))}
            </div>

            {scratching && (
              <button
                onClick={revealAll}
                className="mt-4 text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
              >
                Revelar tudo de uma vez
              </button>
            )}
          </motion.div>

          {/* Result */}
          <AnimatePresence>
            {allRevealed && result && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                className={`mt-6 rounded-xl border p-6 text-center w-full max-w-sm ${
                  result.won
                    ? `${borderAccent} ${bgAccent}`
                    : "border-border bg-card"
                }`}
                style={result.won ? { boxShadow: `0 0 40px ${accentColor}33` } : {}}
              >
                {result.won ? (
                  <>
                    <Trophy className={`h-10 w-10 ${accentClass} mx-auto mb-2`} />
                    <p className={`text-xl font-bold ${accentClass}`} style={{ fontFamily: "'Valorant', sans-serif" }}>PARABÉNS!</p>
                    <p className="text-foreground font-medium mt-1">Você ganhou: {result.prize?.name}</p>
                    {result.prize?.image_url && (
                      <img src={result.prize.image_url} alt={result.prize.name} className="h-16 w-16 rounded-lg object-cover mx-auto mt-3" />
                    )}
                    {mode === "contas" && (
                      <p className="text-xs text-muted-foreground mt-3 bg-secondary/50 rounded-lg p-2">
                        Nossa equipe vai entregar sua conta em breve via ticket de suporte.
                      </p>
                    )}
                    {typeof result.prize?.prize_value === "number" && result.prize.prize_value > 0 ? (
                      <p className={`font-bold text-lg mt-2 ${accentClass}`}>R$ {result.prize.prize_value.toFixed(2)}</p>
                    ) : null}
                  </>
                ) : (
                  <>
                    <Frown className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                    <p className="text-lg font-bold text-foreground">Não foi dessa vez!</p>
                    <p className="text-sm text-muted-foreground mt-1">Tente novamente, a sorte pode estar perto!</p>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Quantity selector */}
          {paymentPhase === "idle" && !scratching && !allRevealed && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 flex flex-col items-center gap-3"
            >
              <p className="text-xs text-muted-foreground uppercase tracking-widest">Quantidade de raspadinhas</p>
              <p className="text-[10px] text-muted-foreground/90 text-center max-w-xs leading-snug">
                Cada pagamento gera um sorteio; a quantidade só altera o valor total pago (não são várias rodadas separadas).
              </p>
              <div className="flex items-center gap-4 rounded-xl border border-border bg-card px-2 py-1.5">
                <button
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-30"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <div className="flex flex-col items-center min-w-[60px]">
                  <span className="text-xl font-bold text-foreground leading-none">{quantity}</span>
                  <span className={`text-[10px] font-medium mt-0.5 ${accentClass}`}>
                    R$ {totalPrice.toFixed(2)}
                  </span>
                </div>
                <button
                  onClick={() => setQuantity(q => Math.min(MAX_QUANTITY, q + 1))}
                  disabled={quantity >= MAX_QUANTITY}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-30"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              {/* Quick picks */}
              <div className="flex gap-2">
                {[1, 3, 5, 10].map(n => (
                  <button
                    key={n}
                    onClick={() => setQuantity(n)}
                    className={`rounded-lg px-3 py-1 text-xs font-semibold border transition-colors ${
                      quantity === n
                        ? isContas
                          ? "border-info bg-info/10 text-info"
                          : "border-success bg-success/10 text-success"
                        : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-muted-foreground/40"
                    }`}
                  >
                    {n}x
                  </button>
                ))}
              </div>
            </motion.div>
          )}




          {/* Play button */}
          <div className="flex justify-center w-full">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={allRevealed || paymentPhase === "idle" ? (allRevealed ? resetGame : handlePlay) : undefined}
            disabled={playing || scratching || paymentPhase === "paying"}
            className={`mt-6 w-full max-w-[22rem] sm:w-auto relative overflow-hidden rounded-xl px-8 sm:px-10 py-3.5 sm:py-4 text-base sm:text-lg font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              isContas ? "bg-info hover:bg-info/90" : "bg-success hover:bg-success/90"
            }`}
            style={
              !playing && !scratching && paymentPhase !== "paying" && paymentPhase !== "generating"
                ? { boxShadow: `0 0 40px ${accentColor}80` }
                : {}
            }
          >
            <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,_rgba(255,255,255,0.15)_0%,_transparent_60%)]" />
            <span className="relative flex items-center gap-3">
              {playing ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Ticket className="h-5 w-5" />
              )}
              {playing
                ? paymentPhase === "generating"
                  ? "A gerar o PIX..."
                  : "Gerando pagamento..."
                : scratching
                ? "Raspe para revelar!"
                : paymentPhase === "paying"
                ? "Aguardando pagamento..."
                : allRevealed
                ? "Jogar novamente"
                : quantity > 1
                ? `Jogar ${quantity}x — R$ ${totalPrice.toFixed(2)}`
                : `Jogar — R$ ${unitPrice.toFixed(2)}`}
            </span>
          </motion.button>
          </div>
        </div>

        {/* History */}
        {user && history.length > 0 && (
          <div className="mt-16">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-4"
            >
              <History className="h-4 w-4" />
              {showHistory ? "Ocultar" : "Ver"} histórico ({history.length})
            </button>
            {showHistory && (
              <div className="space-y-2">
                {history.map((play) => (
                  <div
                    key={play.id}
                    className={`flex items-center justify-between rounded-lg border p-3 ${
                      play.won ? "border-success/30 bg-success/5" : "border-border bg-card"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {play.won ? (
                        <Star className="h-4 w-4 text-success" />
                      ) : (
                        <Ticket className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="text-sm text-foreground">
                        {play.won ? "Ganhou!" : "Não ganhou"}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        {new Date(play.created_at).toLocaleDateString("pt-BR")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        R$ {(Number(play.amount_paid) / 100).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Raspadinha;
