import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Header from "@/components/Header";
import { useAuth } from "@/hooks/useAuth";
import { useReseller } from "@/hooks/useReseller";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import {
  User, Shield, Lock, Package, BarChart3, Settings,
  Eye, EyeOff, Loader2, UserCheck, Check, AlertTriangle,
  ShoppingCart, ChevronRight,
  Smartphone, MessageSquare, Receipt, Clock,
  CheckCircle, XCircle, DollarSign, Key, LogOut, Mail,
  TrendingUp,
  Info,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";

const TURNSTILE_SITE_KEY = "0x4AAAAAAClS1zHIEKz4wE9_";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

type Tab = "overview" | "purchases" | "security" | "settings";

const Dashboard = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const { isReseller, discountPercent, reseller } = useReseller();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab) || "overview";
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  // Security state
  const [securityVerified, setSecurityVerified] = useState(false);
  const [verifyPassword, setVerifyPassword] = useState("");
  const [showVerifyPass, setShowVerifyPass] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPass, setShowNewPass] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [verifyCaptchaToken, setVerifyCaptchaToken] = useState<string | undefined>();
  const verifyCaptchaRef = useRef<TurnstileInstance>(null);

  // Tickets (pedidos) state
  interface Ticket {
    id: string;
    product_id: string;
    product_plan_id: string;
    status: string;
    status_label: string;
    created_at: string;
    product_name?: string;
    plan_name?: string;
    image_url?: string | null;
    plan_price?: number;
    metadata?: any;
  }
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  // Payments/invoices state
  interface Payment {
    id: string;
    amount: number;
    status: string;
    created_at: string;
    paid_at: string | null;
    charge_id: string;
    discount_amount: number;
    cart_snapshot: any;
  }
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

  const statusColors: Record<string, string> = {
    open: "bg-warning/20 text-warning",
    waiting: "bg-warning/20 text-warning",
    waiting_staff: "bg-info/20 text-info",
    delivered: "bg-success/20 text-success",
    resolved: "bg-positive/20 text-positive",
    closed: "bg-muted text-muted-foreground",
    banned: "bg-destructive/20 text-destructive",
    finished: "bg-muted text-muted-foreground",
  };
  const statusLabels: Record<string, string> = {
    open: "Aberto",
    waiting: "Aguardando",
    waiting_staff: "Aguardando Equipe",
    delivered: "Entregue",
    resolved: "Resolvido",
    closed: "Encerrado",
    banned: "Banido",
    finished: "Finalizado",
  };

  // Fetch user payments/invoices (all, not limited — needed for accurate stats)
  useEffect(() => {
    if (!user) return;
    const fetchPayments = async () => {
      setLoadingPayments(true);
      const { data } = await supabase
        .from("payments")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (data) setPayments(data as Payment[]);
      setLoadingPayments(false);
    };
    fetchPayments();
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/");
  }, [authLoading, user, navigate]);

  // Fetch user tickets (pedidos)
  useEffect(() => {
    if (!user) return;
    const fetchTickets = async () => {
      setLoadingTickets(true);
      const { data } = await supabase
        .from("order_tickets")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (data) {
        const regularTickets = data.filter((t: any) => !t.metadata?.type || t.metadata?.type === "robot-project");
        const productIds = [...new Set(regularTickets.map((t: any) => t.product_id))];
        const planIds = [...new Set(regularTickets.map((t: any) => t.product_plan_id))];

        const [productsRes, plansRes] = await Promise.all([
          productIds.length > 0 ? supabase.from("products").select("id, name, image_url").in("id", productIds) : { data: [] },
          planIds.length > 0 ? supabase.from("product_plans").select("id, name, price").in("id", planIds) : { data: [] },
        ]);

        const productMap: Record<string, { name: string; image_url: string | null }> = {};
        const planMap: Record<string, { name: string; price: number }> = {};
        productsRes.data?.forEach((p: any) => { productMap[p.id] = { name: p.name, image_url: p.image_url }; });
        plansRes.data?.forEach((p: any) => { planMap[p.id] = { name: p.name, price: p.price }; });

        setTickets(data.map((t: any) => {
          const isLzt = t.metadata?.type === "lzt-account";
          const isRobot = t.metadata?.type === "robot-project";
          if (isLzt) {
            const lztGameLabels: Record<string, string> = {
              valorant: "Conta Valorant", lol: "Conta LoL", fortnite: "Conta Fortnite", minecraft: "Conta Minecraft",
            };
            const lztGameLabel = lztGameLabels[t.metadata?.game] || "Conta LZT";
            return {
              ...t,
              product_name: t.metadata.account_name || t.metadata.title || lztGameLabel,
              plan_name: lztGameLabel,
              image_url: t.metadata.account_image || null,
              plan_price: t.metadata.price_paid || t.metadata.sell_price || 0,
            };
          }
          const duration = isRobot && t.metadata?.duration ? ` (${t.metadata.duration} dias)` : "";
          return {
            ...t,
            product_name: productMap[t.product_id]?.name || (isRobot ? t.metadata?.game_name || "Produto Robot" : "Produto"),
            plan_name: (planMap[t.product_plan_id]?.name || "Plano") + duration,
            image_url: productMap[t.product_id]?.image_url || null,
            plan_price: planMap[t.product_plan_id]?.price || 0,
          };
        }));
      }
      setLoadingTickets(false);
    };
    fetchTickets();
  }, [user]);

  const handleVerifyIdentity = async () => {
    if (!verifyPassword) return;
    if (!verifyCaptchaToken) {
      toast({ title: "Erro", description: "Aguarde a verificação de segurança.", variant: "destructive" });
      return;
    }
    setVerifying(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: user?.email || "",
      password: verifyPassword,
      options: { captchaToken: verifyCaptchaToken },
    });
    setVerifyCaptchaToken(undefined);
    verifyCaptchaRef.current?.reset();
    setVerifying(false);
    if (error) {
      toast({ title: "Erro", description: "Senha incorreta. Tente novamente.", variant: "destructive" });
    } else {
      setSecurityVerified(true);
      setVerifyPassword("");
      toast({ title: "Identidade verificada", description: "Agora você pode alterar suas configurações de segurança." });
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({ title: "Erro", description: "As senhas não coincidem.", variant: "destructive" });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: "Erro", description: "A senha deve ter no mínimo 8 caracteres.", variant: "destructive" });
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Sucesso", description: "Senha alterada com sucesso!" });
      setNewPassword("");
      setConfirmPassword("");
      setSecurityVerified(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-success" />
      </div>
    );
  }

  if (!user) return null;

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Visão Geral", icon: <BarChart3 className="h-4 w-4" /> },
    { id: "purchases", label: "Minhas Compras", icon: <Package className="h-4 w-4" /> },
    { id: "security", label: "Segurança", icon: <Shield className="h-4 w-4" /> },
    { id: "settings", label: "Configurações", icon: <Settings className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-4 pb-20">
        {/* Profile Header */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-success/30 bg-success/10">
              <User className="h-8 w-8 text-success" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {profile?.username || user.email?.split("@")[0]}
              </h1>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                {isReseller && (
                  <span className="flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-[10px] font-bold text-accent-foreground">
                    <UserCheck className="h-3 w-3" /> Revendedor · -{discountPercent}%
                  </span>
                )}
                <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  Membro desde {new Date(user.created_at).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="mt-8 relative">
          <div className="flex gap-0 overflow-x-auto border-b border-border scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center gap-1.5 sm:gap-2.5 whitespace-nowrap px-3 sm:px-5 py-3 sm:py-3.5 text-xs sm:text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "text-success"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className={`transition-colors duration-200 ${isActive ? "text-success" : ""}`}>
                    {tab.icon}
                  </span>
                  {tab.label}
                  {isActive && (
                    <motion.div
                      layoutId="dashboard-tab-indicator"
                      className="absolute bottom-0 left-0 right-0 h-[2px] bg-success rounded-full"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="mt-8">

          {/* ───── OVERVIEW ───── */}
          {activeTab === "overview" && (
            <motion.div initial="hidden" animate="visible" variants={fadeUp} className="space-y-8">
              {/* Stat Cards with mini charts */}
              <OverviewStats
                tickets={tickets}
                payments={payments}
                isReseller={isReseller}
                discountPercent={discountPercent}
              />

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Últimas Compras */}
                <div className="rounded-lg border border-border bg-card overflow-hidden">
                  <div className="flex items-center justify-between px-6 pt-5 pb-3">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-success/10 flex items-center justify-center">
                        <Package className="h-3.5 w-3.5 text-success" />
                      </div>
                      Últimas Compras
                    </h3>
                    <button onClick={() => setActiveTab("purchases")} className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-success transition-colors">
                      Ver todas <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="px-4 pb-4 space-y-1">
                    {loadingTickets ? (
                      <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-success" /></div>
                    ) : tickets.length === 0 ? (
                      <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma compra encontrada.</p>
                    ) : (
                      tickets.slice(0, 5).map((t, i) => (
                        <motion.div
                          key={t.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          onClick={() => navigate(`/pedido/${t.id}`)}
                          className="flex cursor-pointer items-center gap-3 rounded-md p-3 transition-all hover:bg-secondary/50 group"
                        >
                          {t.image_url ? (
                            <img src={t.image_url} alt="" className="h-10 w-10 rounded-md object-cover ring-1 ring-border" />
                          ) : (
                            <div className="h-10 w-10 rounded-md bg-secondary flex items-center justify-center ring-1 ring-border">
                              <Package className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate group-hover:text-success transition-colors">{t.product_name}</p>
                            <p className="text-[11px] text-muted-foreground">{t.plan_name} · {new Date(t.created_at).toLocaleDateString("pt-BR")}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusColors[t.status] || "bg-muted text-muted-foreground"}`}>
                              {statusLabels[t.status] || t.status_label}
                            </span>
                            {t.plan_price ? <span className="text-xs font-bold text-success">R$ {Number(t.plan_price).toFixed(2)}</span> : null}
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>
                </div>

                {/* Últimas Faturas */}
                <div className="rounded-lg border border-border bg-card overflow-hidden">
                  <div className="flex items-center justify-between px-6 pt-5 pb-3">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-success/10 flex items-center justify-center">
                        <Receipt className="h-3.5 w-3.5 text-success" />
                      </div>
                      Últimas Faturas
                    </h3>
                  </div>
                  <div className="px-4 pb-4 space-y-1">
                    {loadingPayments ? (
                      <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-success" /></div>
                    ) : payments.length === 0 ? (
                      <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma fatura encontrada.</p>
                    ) : (
                      payments.slice(0, 5).map((p, i) => {
                        const isPaid = p.status === "COMPLETED";
                        const isExpired = !isPaid && p.status !== "ACTIVE";
                        return (
                          <motion.div
                            key={p.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="flex items-center gap-3 rounded-md p-3 transition-all hover:bg-secondary/50"
                          >
                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${isPaid ? "bg-success/10 ring-1 ring-success/20" : isExpired ? "bg-destructive/10 ring-1 ring-destructive/20" : "bg-accent/30 ring-1 ring-border"}`}>
                              {isPaid ? <CheckCircle className="h-4 w-4 text-success" /> : isExpired ? <XCircle className="h-4 w-4 text-destructive" /> : <Clock className="h-4 w-4 text-accent-foreground" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground">
                                R$ {(Number(p.amount) / 100).toFixed(2)}
                                {p.discount_amount > 0 && <span className="ml-1 text-[11px] text-success">(-R$ {Number(p.discount_amount).toFixed(2)})</span>}
                              </p>
                              <p className="text-[11px] text-muted-foreground">{new Date(p.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                            </div>
                            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${isPaid ? "bg-success/15 text-success" : isExpired ? "bg-destructive/15 text-destructive" : "bg-accent/20 text-accent-foreground"}`}>
                              {isPaid ? "Pago" : isExpired ? "Expirado" : "Pendente"}
                            </span>
                          </motion.div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ───── PURCHASES ───── */}
          {activeTab === "purchases" && (
            <motion.div initial="hidden" animate="visible" variants={fadeUp} className="space-y-6">
              <div className="flex flex-col gap-1">
                <h2 className="text-xl font-bold text-foreground">Minhas Compras</h2>
                <p className="text-sm text-muted-foreground">Selecione uma categoria para visualizar seus pedidos.</p>
              </div>

              {/* Summary strip */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-lg border border-border bg-card px-4 py-3 flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
                    <Package className="h-4 w-4 text-success" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total pedidos</p>
                    <p className="text-lg font-bold text-foreground">{tickets.length}</p>
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-card px-4 py-3 flex items-center gap-3">
                   <div className="h-8 w-8 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
                     <CheckCircle className="h-4 w-4 text-success" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Entregues</p>
                    <p className="text-lg font-bold text-foreground">{tickets.filter(t => t.status === "delivered").length}</p>
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-card px-4 py-3 flex items-center gap-3">
                   <div className="h-8 w-8 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
                     <Clock className="h-4 w-4 text-warning" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Em aberto</p>
                    <p className="text-lg font-bold text-foreground">{tickets.filter(t => t.status === "open").length}</p>
                  </div>
                </div>
              </div>

              {/* Category Cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Card Produtos */}
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  onClick={() => navigate("/meus-pedidos?tipo=produtos")}
                  className="group cursor-pointer relative overflow-hidden rounded-lg border border-border bg-card transition-all duration-300 hover:border-success/50 hover:shadow-[0_0_40px_hsl(var(--success)/0.12)]"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-success/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-success/5 -translate-y-1/2 translate-x-1/2" />

                  <div className="relative p-6 flex gap-5 items-start">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" fill="currentColor" className="text-success" viewBox="0 0 16 16">
                        <path fillRule="evenodd" d="M15.528 2.973a.75.75 0 0 1 .472.696v8.662a.75.75 0 0 1-.472.696l-7.25 2.9a.75.75 0 0 1-.557 0l-7.25-2.9A.75.75 0 0 1 0 12.331V3.669a.75.75 0 0 1 .471-.696L7.443.184l.004-.001.274-.11a.75.75 0 0 1 .558 0l.274.11.004.001zm-1.374.527L8 5.962 1.846 3.5 1 3.839v.4l6.5 2.6v7.922l.5.2.5-.2V6.84l6.5-2.6v-.4l-.846-.339Z"/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-bold text-foreground">Produtos</h3>
                      <p className="mt-1 text-sm text-muted-foreground">Cheats, softwares e licenças digitais</p>
                      <div className="mt-4 flex items-center gap-3">
                        <span className="flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">
                          <Package className="h-3 w-3" />{tickets.filter(t => !t.metadata?.type || t.metadata?.type === "robot-project").length} pedido(s)
                        </span>
                        {tickets.filter(t => !t.metadata?.type && t.status === "open").length > 0 && (
                           <span className="flex items-center gap-1.5 rounded-full bg-warning/10 px-3 py-1 text-xs font-semibold text-warning">
                             <Clock className="h-3 w-3" />{tickets.filter(t => !t.metadata?.type && t.status === "open").length} aberto(s)
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground/40 group-hover:text-success transition-colors mt-0.5 shrink-0" />
                  </div>

                  {tickets.filter(t => !t.metadata?.type).length > 0 && (
                    <div className="border-t border-border px-6 py-3 bg-secondary/20">
                      <div className="flex gap-2 overflow-hidden">
                        {tickets.filter(t => !t.metadata?.type).slice(0, 4).map((t) => (
                          <div key={t.id} className="relative shrink-0 h-8 w-8 rounded-lg overflow-hidden border border-border bg-secondary">
                            {t.image_url ? <img src={t.image_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Package className="h-3.5 w-3.5 text-muted-foreground/40" /></div>}
                          </div>
                        ))}
                        {tickets.filter(t => !t.metadata?.type).length > 4 && (
                          <div className="shrink-0 h-8 w-8 rounded-lg border border-border bg-secondary flex items-center justify-center">
                            <span className="text-[10px] font-bold text-muted-foreground">+{tickets.filter(t => !t.metadata?.type).length - 4}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>

                {/* Card Contas */}
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  onClick={() => navigate("/meus-pedidos?tipo=contas")}
                   className="group cursor-pointer relative overflow-hidden rounded-lg border border-border bg-card transition-all duration-300 hover:border-success/50 hover:shadow-[0_0_40px_hsl(var(--success)/0.1)]"
                 >
                   <div className="absolute inset-0 bg-gradient-to-br from-success/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                   <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-success/5 -translate-y-1/2 translate-x-1/2" />

                  <div className="relative p-6 flex gap-5 items-start">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center">
                      <svg fill="currentColor" height="38" width="38" className="text-success" role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M23.792 2.152a.252.252 0 0 0-.098.083c-3.384 4.23-6.769 8.46-10.15 12.69-.107.093-.025.288.119.265 2.439.003 4.877 0 7.316.001a.66.66 0 0 0 .552-.25c.774-.967 1.55-1.934 2.324-2.903a.72.72 0 0 0 .144-.49c-.002-3.077 0-6.153-.003-9.23.016-.11-.1-.206-.204-.167zM.077 2.166c-.077.038-.074.132-.076.205.002 3.074.001 6.15.001 9.225a.679.679 0 0 0 .158.463l7.64 9.55c.12.152.308.25.505.247 2.455 0 4.91.003 7.365 0 .142.02.222-.174.116-.265C10.661 15.176 5.526 8.766.4 2.35c-.08-.094-.174-.272-.322-.184z"/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-bold text-foreground">Contas</h3>
                      <p className="mt-1 text-sm text-muted-foreground">Contas de jogos adquiridas</p>
                      <div className="mt-4 flex items-center gap-3">
                        <span className="flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">
                          <Smartphone className="h-3 w-3" />{tickets.filter(t => t.metadata?.type === "lzt-account").length} conta(s)
                        </span>
                        {tickets.filter(t => t.metadata?.type === "lzt-account" && t.status === "delivered").length > 0 && (
                          <span className="flex items-center gap-1.5 rounded-full bg-positive/10 px-3 py-1 text-xs font-semibold text-positive">
                            <CheckCircle className="h-3 w-3" />{tickets.filter(t => t.metadata?.type === "lzt-account" && t.status === "delivered").length} entregue(s)
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground/40 group-hover:text-success transition-colors mt-0.5 shrink-0" />
                  </div>

                  <div className="border-t border-border px-6 py-3 bg-secondary/20">
                    {tickets.filter(t => t.metadata?.type === "lzt-account").length === 0 ? (
                      <p className="text-xs text-muted-foreground/60">Nenhuma conta adquirida ainda.</p>
                    ) : (
                      <div className="flex gap-2 overflow-hidden">
                        {tickets.filter(t => t.metadata?.type === "lzt-account").slice(0, 4).map((t) => (
                          <div key={t.id} className="relative shrink-0 h-8 w-8 rounded-lg overflow-hidden border border-border bg-secondary">
                            {t.image_url ? <img src={t.image_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Smartphone className="h-3.5 w-3.5 text-muted-foreground/40" /></div>}
                          </div>
                        ))}
                        {tickets.filter(t => t.metadata?.type === "lzt-account").length > 4 && (
                          <div className="shrink-0 h-8 w-8 rounded-lg border border-border bg-secondary flex items-center justify-center">
                            <span className="text-[10px] font-bold text-muted-foreground">+{tickets.filter(t => t.metadata?.type === "lzt-account").length - 4}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              </div>

              {/* Recent activity */}
              {tickets.length > 0 && (
                <div className="rounded-lg border border-border bg-card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" /> Atividade Recente
                    </h3>
                    <button onClick={() => navigate("/meus-pedidos?tipo=produtos")} className="text-xs text-success hover:underline flex items-center gap-1">
                      Ver todos <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    {tickets.slice(0, 4).map((t, idx) => (
                      <motion.div
                        key={t.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        onClick={() => navigate(`/pedido/${t.id}`)}
                        className="group flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-secondary/50"
                      >
                        <div className="shrink-0 h-9 w-9 rounded-lg overflow-hidden border border-border bg-secondary">
                          {t.image_url ? <img src={t.image_url} alt="" className="h-full w-full object-cover" /> : (
                            <div className="flex h-full items-center justify-center">
                              {t.metadata?.type === "lzt-account" ? <Smartphone className="h-3.5 w-3.5 text-muted-foreground/40" /> : <Package className="h-3.5 w-3.5 text-muted-foreground/40" />}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{t.product_name}</p>
                          <p className="text-xs text-muted-foreground">{t.plan_name} · {new Date(t.created_at).toLocaleDateString("pt-BR")}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusColors[t.status] || "bg-muted text-muted-foreground"}`}>{statusLabels[t.status] || t.status_label}</span>
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ───── SECURITY ───── */}
          {activeTab === "security" && (
            <motion.div initial="hidden" animate="visible" variants={fadeUp} className="space-y-6">
              <div className="flex flex-col gap-1">
                <h2 className="text-xl font-bold text-foreground">Segurança</h2>
                <p className="text-sm text-muted-foreground">Gerencie sua senha e configurações de acesso.</p>
              </div>

              {!securityVerified ? (
                <div className="rounded-lg border border-border bg-card overflow-hidden">
                  <div className="flex flex-col items-center text-center px-8 py-14 max-w-sm mx-auto">
                    <div className="relative mb-6">
                      <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-success/10 border border-success/20">
                        <Shield className="h-10 w-10 text-success" />
                      </div>
                      <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-success">
                        <Lock className="h-2.5 w-2.5 text-success-foreground" />
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-foreground">Área Protegida</h3>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                      Confirme sua identidade com sua senha atual para acessar as configurações de segurança.
                    </p>
                    <div className="mt-8 w-full space-y-3">
                      <div className="relative">
                        <input
                          type={showVerifyPass ? "text" : "password"}
                          value={verifyPassword}
                          onChange={(e) => setVerifyPassword(e.target.value)}
                          placeholder="Digite sua senha atual"
                          onKeyDown={(e) => e.key === "Enter" && handleVerifyIdentity()}
                          className="w-full rounded-lg border border-border bg-secondary/50 py-3 pl-4 pr-11 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-success/50 transition-colors"
                        />
                        <button onClick={() => setShowVerifyPass(!showVerifyPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                          {showVerifyPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {/* Turnstile temporarily disabled for debugging */}
                      <button
                        onClick={handleVerifyIdentity}
                        disabled={verifying || !verifyPassword}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-success px-6 py-3 text-sm font-semibold text-success-foreground transition-all hover:shadow-[0_0_20px_hsl(var(--success)/0.3)] disabled:opacity-50"
                      >
                        {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                        Verificar Identidade
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Verified banner */}
                  <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/5 px-5 py-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success/15">
                      <Check className="h-4 w-4 text-success" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-success">Identidade verificada</p>
                      <p className="text-xs text-muted-foreground">Você pode alterar sua senha agora.</p>
                    </div>
                  </div>

                  {/* Change password */}
                  <div className="rounded-lg border border-border bg-card p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary border border-border">
                        <Key className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-foreground">Alterar Senha</h3>
                        <p className="text-xs text-muted-foreground">Use uma senha forte e única.</p>
                      </div>
                    </div>
                    <div className="max-w-md space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nova Senha</label>
                        <div className="relative">
                           <input
                             type={showNewPass ? "text" : "password"}
                             autoComplete="new-password"
                             value={newPassword}
                             onChange={(e) => setNewPassword(e.target.value)}
                             placeholder="Mínimo 8 caracteres"
                            className="w-full rounded-lg border border-border bg-secondary/50 py-3 pl-4 pr-11 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-success/50 transition-colors"
                          />
                          <button onClick={() => setShowNewPass(!showNewPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                            {showNewPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Confirmar Nova Senha</label>
                         <input
                           type="password"
                           autoComplete="new-password"
                           value={confirmPassword}
                           onChange={(e) => setConfirmPassword(e.target.value)}
                           placeholder="Repita a nova senha"
                           onKeyDown={(e) => e.key === "Enter" && handleChangePassword()}
                          className="w-full rounded-lg border border-border bg-secondary/50 py-3 pl-4 pr-4 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-success/50 transition-colors"
                        />
                      </div>

                      {newPassword && confirmPassword && (
                        <div className={`flex items-center gap-2 text-xs ${newPassword === confirmPassword ? "text-success" : "text-destructive"}`}>
                          {newPassword === confirmPassword
                            ? <><Check className="h-3.5 w-3.5" /> Senhas coincidem</>
                            : <><AlertTriangle className="h-3.5 w-3.5" /> Senhas não coincidem</>
                          }
                        </div>
                      )}

                      <button
                        onClick={handleChangePassword}
                        disabled={changingPassword || !newPassword || newPassword !== confirmPassword}
                        className="flex items-center justify-center gap-2 rounded-lg bg-success px-6 py-3 text-sm font-semibold text-success-foreground transition-all hover:shadow-[0_0_20px_hsl(var(--success)/0.3)] disabled:opacity-50"
                      >
                        {changingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                        Salvar Nova Senha
                      </button>
                    </div>
                  </div>

                  {/* Session info */}
                  <div className="rounded-lg border border-border bg-card p-6">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary border border-border">
                        <Smartphone className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-foreground">Sessão Atual</h3>
                        <p className="text-xs text-muted-foreground">Detalhes do seu último acesso.</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <InfoRow label="E-mail" value={user.email || "—"} />
                      <InfoRow label="Membro desde" value={new Date(user.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })} />
                      <InfoRow label="Último login" value={user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"} />
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ───── SETTINGS ───── */}
          {activeTab === "settings" && (
            <motion.div initial="hidden" animate="visible" variants={fadeUp} className="space-y-5">
              <div className="flex flex-col gap-1">
                <h2 className="text-xl font-bold text-foreground">Configurações</h2>
                <p className="text-sm text-muted-foreground">Informações da sua conta.</p>
              </div>

              <div className="rounded-lg border border-border bg-card overflow-hidden">
                {/* Perfil */}
                <div className="border-b border-border p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-secondary border border-border">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <h3 className="text-sm font-bold text-foreground">Perfil</h3>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Username</label>
                      <div className="rounded-md border border-border bg-secondary/50 py-2.5 px-3 text-sm text-foreground">
                        {profile?.username || "—"}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">E-mail</label>
                      <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/50 py-2.5 px-3">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm text-foreground truncate">{user.email}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Detalhes */}
                <div className="border-b border-border p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-secondary border border-border">
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <h3 className="text-sm font-bold text-foreground">Detalhes da Conta</h3>
                  </div>
                  <div className="space-y-2">
                    <InfoRow label="ID da Conta" value={user.id.slice(0, 16) + "..."} />
                    <InfoRow label="Conta criada em" value={new Date(user.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })} />
                    <InfoRow label="Último login" value={user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"} />
                  </div>
                </div>

                {/* Revendedor */}
                {isReseller && reseller && (
                  <div className="border-b border-border p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-success/10 border border-success/20">
                        <UserCheck className="h-4 w-4 text-success" />
                      </div>
                      <h3 className="text-sm font-bold text-foreground">Revendedor</h3>
                    </div>
                    <div className="space-y-2">
                      <InfoRow label="Status" value="Ativo" valueClassName="text-success font-semibold" />
                      <InfoRow label="Desconto" value={`${discountPercent}%`} />
                      {reseller.expires_at && (
                        <InfoRow label="Expira em" value={new Date(reseller.expires_at).toLocaleDateString("pt-BR")} />
                      )}
                    </div>
                  </div>
                )}

                {/* Sair */}
                <div className="p-5 bg-destructive/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-destructive/10 border border-destructive/20">
                        <LogOut className="h-4 w-4 text-destructive" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-foreground">Sair da Conta</h3>
                        <p className="text-[11px] text-muted-foreground">Encerrar sua sessão atual.</p>
                      </div>
                    </div>
                    <button
                      onClick={async () => { await supabase.auth.signOut(); navigate("/"); }}
                      className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-xs font-semibold text-destructive transition-all hover:bg-destructive hover:text-destructive-foreground"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Sair
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

        </div>
      </div>
    </div>
  );
};

/* ── Mini sparkline data generator ── */
const generateSparkline = (count: number, trend: "up" | "down" | "flat" = "up") => {
  const data = [];
  let val = trend === "up" ? 20 : trend === "down" ? 80 : 50;
  for (let i = 0; i < count; i++) {
    const change = (Math.random() - (trend === "up" ? 0.3 : trend === "down" ? 0.7 : 0.5)) * 15;
    val = Math.max(5, Math.min(95, val + change));
    data.push({ v: val });
  }
  return data;
};

/* ── Overview Stats Component ── */
const OverviewStats = ({
  tickets,
  payments,
  isReseller,
  discountPercent,
}: {
  tickets: any[];
  payments: any[];
  isReseller: boolean;
  discountPercent: number;
}) => {
  const paidPayments = payments.filter((p: any) => p.status === "COMPLETED");
  const totalSpent = paidPayments.reduce((s: number, p: any) => s + Number(p.amount) / 100, 0);

  const stats = useMemo(() => [
    {
      icon: <ShoppingCart className="h-4 w-4" />,
      label: "Total de Pedidos",
      value: String(tickets.length),
      color: "hsl(var(--success))",
      sparkline: generateSparkline(12, "up"),
    },
    {
      icon: <DollarSign className="h-4 w-4" />,
      label: "Total Gasto",
      value: `R$ ${totalSpent.toFixed(2)}`,
      color: "hsl(var(--success))",
      sparkline: generateSparkline(12, "up"),
    },
    {
      icon: <CheckCircle className="h-4 w-4" />,
      label: "Faturas Pagas",
      value: String(paidPayments.length),
      color: "hsl(var(--success))",
      sparkline: generateSparkline(12, "flat"),
    },
    {
      icon: <UserCheck className="h-4 w-4" />,
      label: "Status Revenda",
      value: isReseller ? `Ativo · -${discountPercent}%` : "Inativo",
      color: "hsl(var(--success))",
      sparkline: generateSparkline(12, isReseller ? "up" : "flat"),
    },
  ], [tickets.length, totalSpent, paidPayments.length, isReseller, discountPercent]);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.07 }}
          className="group relative overflow-hidden rounded-lg border border-border bg-card p-5 transition-all duration-300 hover:border-success/30 hover:shadow-[0_0_30px_hsl(var(--success)/0.06)]"
        >
          {/* Sparkline background */}
          <div className="absolute inset-x-0 bottom-0 h-16 opacity-[0.08] group-hover:opacity-[0.15] transition-opacity duration-300">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stat.sparkline}>
                <defs>
                  <linearGradient id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={stat.color} stopOpacity={1} />
                    <stop offset="100%" stopColor={stat.color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={stat.color}
                  strokeWidth={1.5}
                  fill={`url(#grad-${i})`}
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Content */}
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-success/10 text-success">
                {stat.icon}
              </div>
              <TrendingUp className="h-3.5 w-3.5 text-muted-foreground/50" />
            </div>
            <p className="text-2xl font-bold text-foreground tracking-tight">{stat.value}</p>
            <p className="mt-1 text-[11px] font-medium text-muted-foreground">{stat.label}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

const StatCard = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) => (
  <div className="rounded-lg border border-border bg-card p-5">
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
        {icon}
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold text-foreground">{value}</p>
      </div>
    </div>
  </div>
);

const InfoRow = ({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) => (
  <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 px-4 py-3">
    <span className="text-xs font-medium text-muted-foreground">{label}</span>
    <span className={`text-sm text-foreground ${valueClassName || ""}`}>{value}</span>
  </div>
);

export default Dashboard;
