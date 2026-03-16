import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/supabaseAllRows";
import { useAuth } from "@/hooks/useAuth";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import { toast } from "@/hooks/use-toast";
import AudioMessagePlayer from "@/components/AudioMessagePlayer";
import {
  Loader2, MessageSquare, Search, Send, Archive, ArchiveRestore, ArrowLeft,
  Clock, User, Copy, Check, ShieldCheck, ExternalLink, KeyRound, Mail,
  ChevronDown, ChevronUp, CheckCircle, BookOpen, FolderDown, Download,
  Package, Eye, EyeOff, Paperclip, Image, X, FileText, Bot, UserCircle,
  Mic, Square, Trash2, Hash,
} from "lucide-react";
import { useAudioRecorder, formatDuration } from "@/hooks/useAudioRecorder";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Ticket {
  id: string;
  user_id: string;
  product_id: string;
  product_plan_id: string;
  stock_item_id: string | null;
  status: string;
  status_label: string;
  created_at: string;
  created_at_sort: string;
  product_name?: string;
  plan_name?: string;
  plan_price?: number;
  buyer_email?: string;
  buyer_username?: string;
  metadata?: any;
}

interface Message {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_role: string;
  message: string;
  created_at: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const statusOptions = [
  { value: "open", label: "Aberto", color: "bg-warning/15 text-warning border-warning/25" },
  { value: "delivered", label: "Entregue", color: "bg-success/15 text-success border-success/25" },
  { value: "waiting", label: "Aguardando", color: "bg-info/15 text-info border-info/25" },
  { value: "waiting_staff", label: "Ag. Equipe", color: "bg-info/15 text-info border-info/25" },
  { value: "resolved", label: "Resolvido", color: "bg-positive/15 text-positive border-positive/25" },
  { value: "closed", label: "Encerrado", color: "bg-muted text-muted-foreground border-border" },
  { value: "banned", label: "Banido", color: "bg-destructive/15 text-destructive border-destructive/25" },
  { value: "finished", label: "Finalizado", color: "bg-muted text-muted-foreground border-border" },
];

const ITEMS_PER_PAGE = 10;

const QUICK_REPLIES = [
  "Precisa de ajuda?",
  "Qual seu problema?",
  "Quer resetar HWID?",
  "Qual sua key?",
  "Envie seu login e senha",
  "Problema resolvido!",
  "Aguarde um momento",
];

// ─── Component ──────────────────────────────────────────────────────────────

const TicketsTab = ({
  initialTicketId,
  onTicketOpened,
}: {
  initialTicketId?: string | null;
  onTicketOpened?: () => void;
}) => {
  const { user } = useAuth();
  const { emailMap: adminEmailMap } = useAdminUsers();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [stockContent, setStockContent] = useState<string | null>(null);
  const [showDelivery, setShowDelivery] = useState(false);
  const [showStockKey, setShowStockKey] = useState(false);
  const [stockCopied, setStockCopied] = useState(false);

  // Upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const { isRecording, recordingDuration, startRecording, stopRecording, cancelRecording } = useAudioRecorder();

  // ─── Data Fetching ──────────────────────────────────────────────────────

  const fetchTickets = useCallback(async () => {
    const data = await fetchAllRows("order_tickets", {
      select: "*",
      order: { column: "created_at", ascending: false },
    }).catch(() => null);

    if (data) {
      const productIds = [...new Set(data.map((t: any) => t.product_id))] as string[];
      const planIds = [...new Set(data.map((t: any) => t.product_plan_id))] as string[];

      const [productsRes, plansRes, profilesData, lztSalesData] = await Promise.all([
        supabase.from("products").select("id, name").in("id", productIds),
        supabase.from("product_plans").select("id, name, price").in("id", planIds),
        fetchAllRows("profiles", { select: "user_id, username" }),
        fetchAllRows("lzt_sales", { select: "lzt_item_id, sell_price" }),
      ]);

      const productMap: Record<string, string> = {};
      const planMap: Record<string, { name: string; price: number }> = {};
      const profileMap: Record<string, string> = {};
      const lztSalesMap = new Map<string, number>();
      productsRes.data?.forEach((p: any) => { productMap[p.id] = p.name; });
      plansRes.data?.forEach((p: any) => { planMap[p.id] = { name: p.name, price: p.price }; });
      (profilesData || []).forEach((p: any) => { profileMap[p.user_id] = p.username || "—"; });
      (lztSalesData || []).forEach((s: any) => { lztSalesMap.set(String(s.lzt_item_id), Number(s.sell_price)); });

      setTickets(data.map((t: any) => {
        const meta = t.metadata as any;
        const isLzt = meta?.type === "lzt-account";
        const lztItemId = meta?.lzt_item_id;
        const lztPrice = lztItemId ? (lztSalesMap.get(String(lztItemId)) || meta?.price || meta?.sell_price || 0) : 0;

        return {
          ...t,
          product_name: isLzt ? (meta?.title || "Conta LZT") : (productMap[t.product_id] || "Produto"),
          plan_name: isLzt ? "Conta" : (planMap[t.product_plan_id]?.name || "Plano"),
          plan_price: isLzt ? lztPrice : (planMap[t.product_plan_id]?.price ?? 0),
          buyer_email: "—",
          buyer_username: profileMap[t.user_id] || "—",
        };
      }));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  // Enrich emails separately when adminEmailMap updates (no refetch)
  useEffect(() => {
    if (adminEmailMap.size === 0) return;
    setTickets(prev => prev.map(t => ({
      ...t,
      buyer_email: adminEmailMap.get(t.user_id) || t.buyer_email,
    })));
  }, [adminEmailMap]);

  // ─── Ticket Selection & Realtime ────────────────────────────────────────

  const selectTicket = useCallback(async (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setStockContent(null);
    setShowDelivery(false);
    setShowStockKey(false);
    // Revoke old object URLs to prevent memory leaks
    setPreviewUrls(prev => { prev.forEach(u => { if (u) URL.revokeObjectURL(u); }); return []; });
    setPendingFiles([]);
    const { data } = await supabase
      .from("ticket_messages")
      .select("*")
      .eq("ticket_id", ticket.id)
      .order("created_at", { ascending: true });
    if (data) setMessages(data as Message[]);

    if (ticket.stock_item_id) {
      const { data: stockData } = await supabase
        .from("stock_items")
        .select("content")
        .eq("id", ticket.stock_item_id)
        .maybeSingle();
      if (stockData) {
        const raw = (stockData as any).content;
        setStockContent(typeof raw === "string" ? raw : JSON.stringify(raw));
      }
    }
  }, []);

  useEffect(() => {
    if (initialTicketId && tickets.length > 0) {
      const found = tickets.find(t => t.id === initialTicketId);
      if (found) {
        selectTicket(found);
        onTicketOpened?.();
      } else {
        setSearchQuery(initialTicketId.slice(0, 8));
        onTicketOpened?.();
      }
    }
  }, [initialTicketId, tickets, selectTicket, onTicketOpened]);

  useEffect(() => {
    if (!selectedTicket) return;
    let cancelled = false;

    const channel = supabase
      .channel(`admin-ticket-rt-${selectedTicket.id}-${Date.now()}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "ticket_messages",
        filter: `ticket_id=eq.${selectedTicket.id}`,
      }, (payload) => {
        if (payload.eventType === "INSERT") {
          setMessages((prev) => {
            const newMsg = payload.new as Message;
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        } else if (payload.eventType === "DELETE") {
          setMessages((prev) => prev.filter(m => m.id !== (payload.old as any).id));
        }
      })
      .subscribe();

    const pollInterval = setInterval(async () => {
      if (cancelled) return;
      const { data } = await supabase
        .from("ticket_messages")
        .select("*")
        .eq("ticket_id", selectedTicket.id)
        .order("created_at", { ascending: true });
      if (data && !cancelled) {
        setMessages(prev => {
          if (data.length !== prev.length) return data as Message[];
          const lastNew = data[data.length - 1];
          const lastOld = prev[prev.length - 1];
          if (lastNew && lastOld && lastNew.id !== lastOld.id) return data as Message[];
          return prev;
        });
      }
    }, 10000);

    return () => {
      cancelled = true;
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [selectedTicket?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ─── File Upload ────────────────────────────────────────────────────────

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    // Revoke old preview URLs to prevent memory leaks
    previewUrls.forEach(url => { if (url) URL.revokeObjectURL(url); });
    const newFiles = [...pendingFiles, ...files].slice(0, 5);
    setPendingFiles(newFiles);
    setPreviewUrls(newFiles.map(f => f.type.startsWith("image/") ? URL.createObjectURL(f) : ""));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePendingFile = (index: number) => {
    if (previewUrls[index]) URL.revokeObjectURL(previewUrls[index]);
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFileToStorage = async (file: File): Promise<string | null> => {
    if (!user || !selectedTicket) return null;
    const ext = file.name.split(".").pop() || "bin";
    const path = `${selectedTicket.user_id}/${selectedTicket.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("ticket-files").upload(path, file, { upsert: false });
    if (error) return null;
    const { data: urlData } = await supabase.storage.from("ticket-files").createSignedUrl(path, 7 * 24 * 3600);
    return urlData?.signedUrl || null;
  };

  const handleSendAudio = async () => {
    if (!user || !selectedTicket) return;
    setSending(true);
    try {
      const blob = await stopRecording();
      if (!blob) { setSending(false); return; }
      setUploadingFile(true);
      const path = `${selectedTicket.user_id}/${selectedTicket.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.webm`;
      const { error: uploadError } = await supabase.storage.from("ticket-files").upload(path, blob, { upsert: false, contentType: blob.type });
      if (uploadError) {
        toast({ title: "Erro no upload do áudio", description: uploadError.message, variant: "destructive" });
        setUploadingFile(false);
        setSending(false);
        return;
      }
      const { data: urlData } = await supabase.storage.from("ticket-files").createSignedUrl(path, 7 * 24 * 3600);
      const { data: insertedMsg, error } = await supabase.from("ticket_messages").insert({
        ticket_id: selectedTicket.id,
        sender_id: user.id,
        sender_role: "staff",
        message: `[AUDIO]${urlData?.signedUrl || ""}`,
      }).select().single();
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
      } else if (insertedMsg) {
        setMessages(prev => prev.some(m => m.id === insertedMsg.id) ? prev : [...prev, insertedMsg as Message]);
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message || "Erro ao enviar áudio", variant: "destructive" });
    } finally {
      setUploadingFile(false);
      setSending(false);
    }
  };

  // ─── Send Message ───────────────────────────────────────────────────────

  const sendMessage = async () => {
    if ((!newMessage.trim() && pendingFiles.length === 0) || !user || !selectedTicket) return;
    setSending(true);

    const messageParts: string[] = [];

    if (pendingFiles.length > 0) {
      setUploadingFile(true);
      for (const file of pendingFiles) {
        const url = await uploadFileToStorage(file);
        if (url) {
          messageParts.push(file.type.startsWith("image/") ? `[IMAGE]${url}` : `📎 **Arquivo:** ${url}`);
        }
      }
      setUploadingFile(false);
      // Revoke preview URLs before clearing to prevent memory leaks
      previewUrls.forEach(url => { if (url) URL.revokeObjectURL(url); });
      setPendingFiles([]);
      setPreviewUrls([]);
    }

    if (newMessage.trim()) messageParts.push(newMessage.trim());

    const fullMessage = messageParts.join("\n");
    if (!fullMessage) { setSending(false); return; }

    const { data: insertedMsg, error } = await supabase.from("ticket_messages").insert({
      ticket_id: selectedTicket.id,
      sender_id: user.id,
      sender_role: "staff",
      message: fullMessage,
    }).select().single();
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else if (insertedMsg) setMessages(prev => prev.some(m => m.id === insertedMsg.id) ? prev : [...prev, insertedMsg as Message]);
    setNewMessage("");
    setSending(false);
  };

  // ─── Status Management ──────────────────────────────────────────────────

  const updateStatus = async (ticketId: string, status: string) => {
    const finalStatus = status === "closed" ? "archived" : status;
    const finalLabel = status === "closed" ? "Arquivado" : (statusOptions.find(s => s.value === status)?.label || status);
    const { error } = await supabase.from("order_tickets").update({ status: finalStatus, status_label: finalLabel }).eq("id", ticketId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Status: ${finalLabel}` });
      fetchTickets();
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket(prev => prev ? { ...prev, status: finalStatus, status_label: finalLabel } : null);
      }
    }
  };

  const archiveTicket = async (ticketId: string) => {
    const { error } = await supabase.from("order_tickets").update({ status: "archived" as any, status_label: "Arquivado" }).eq("id", ticketId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Ticket arquivado" });
      if (selectedTicket?.id === ticketId) setSelectedTicket(null);
      fetchTickets();
    }
  };

  const unarchiveTicket = async (ticketId: string) => {
    const { error } = await supabase.from("order_tickets").update({ status: "open" as any, status_label: "Aberto" }).eq("id", ticketId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Ticket restaurado" });
      fetchTickets();
    }
  };

  // ─── Filtering & Pagination ─────────────────────────────────────────────

  const filteredTickets = tickets.filter((t) => {
    if (showArchived ? t.status !== "archived" : t.status === "archived") return false;
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        t.product_name?.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        t.buyer_email?.toLowerCase().includes(q) ||
        t.buyer_username?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalPages = Math.ceil(filteredTickets.length / ITEMS_PER_PAGE);
  const paginatedTickets = filteredTickets.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => { setCurrentPage(1); }, [searchQuery, filterStatus, showArchived]);

  // ─── Helpers ────────────────────────────────────────────────────────────

  const getStatusBadge = (status: string) => {
    if (status === "archived") return "bg-muted text-muted-foreground border border-border";
    return statusOptions.find(s => s.value === status)?.color || "bg-muted text-muted-foreground border border-border";
  };

  const getStatusLabel = (status: string) => {
    if (status === "archived") return "Arquivado";
    return statusOptions.find(s => s.value === status)?.label || status;
  };

  const formatTime = (date: string) => new Date(date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const formatDate = (date: string) => new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  // ─── Sub-Components ─────────────────────────────────────────────────────

  const CopyField = ({ label, value }: { label: string; value: string }) => {
    const [fieldCopied, setFieldCopied] = useState(false);
    const handleCopy = () => {
      navigator.clipboard.writeText(value);
      setFieldCopied(true);
      setTimeout(() => setFieldCopied(false), 2000);
    };
    return (
      <div>
        <p className="text-[11px] text-muted-foreground mb-1">{label}:</p>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
          <code className="flex-1 text-sm font-mono text-foreground break-all">{value}</code>
          <button onClick={handleCopy} className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground">
            {fieldCopied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    );
  };

  const getEmailWebmailUrl = (email: string): string | null => {
    const domain = email.split("@")[1]?.toLowerCase();
    if (!domain) return null;
    const known: Record<string, string> = {
      "hotmail.com": "https://login.live.com", "outlook.com": "https://login.live.com", "live.com": "https://login.live.com",
      "gmail.com": "https://mail.google.com", "yahoo.com": "https://mail.yahoo.com",
      "rambler.ru": "https://mail.rambler.ru", "autorambler.ru": "https://mail.rambler.ru", "myrambler.ru": "https://mail.rambler.ru",
      "ro.ru": "https://mail.rambler.ru", "lenta.ru": "https://mail.rambler.ru",
      "mail.ru": "https://e.mail.ru", "bk.ru": "https://e.mail.ru", "inbox.ru": "https://e.mail.ru", "list.ru": "https://e.mail.ru",
      "yandex.ru": "https://mail.yandex.ru", "yandex.com": "https://mail.yandex.com", "ya.ru": "https://mail.yandex.ru",
      "firstmail.ltd": "https://firstmail.ltd/webmail/login/", "ffrmail.com": "https://ffrmail.com/webmail/login/",
    };
    return known[domain] || `https://${domain}/webmail/login/`;
  };

  const getGameConfig = (game?: string) => {
    switch (game) {
      case "fortnite":
        return {
          loginUrl: "https://www.epicgames.com/id/login",
          changeDataTitle: "Como trocar os dados da Epic",
          changeDataSteps: [
            <>Acesse <a href="https://www.epicgames.com/account/personal" target="_blank" rel="noopener noreferrer" className="text-success underline">epicgames.com/account</a></>,
            <>Faça login com o email e senha acima</>,
            <>Vá em <strong className="text-foreground">Configurações da Conta</strong></>,
            <>Na seção <strong className="text-foreground">SENHA</strong>, clique em "Alterar senha"</>,
            <>Defina sua nova senha</>,
          ],
          changeEmailSteps: [
            <>Acesse <a href="https://www.epicgames.com/account/personal" target="_blank" rel="noopener noreferrer" className="text-success underline">epicgames.com/account</a> e faça login</>,
            <>Vá em <strong className="text-foreground">Informações Pessoais</strong> {'>'} <strong className="text-foreground">EMAIL</strong></>,
            <>Clique em <strong className="text-foreground">"Alterar email"</strong></>,
            <>Confirme com o código enviado ao email atual</>,
            <>Digite seu novo email pessoal e confirme</>,
          ],
          checklist: ["Alterar a senha da conta Epic", "Trocar o email para o pessoal", "Alterar o nome de exibição", "Ativar 2FA"],
        };
      case "minecraft":
        return {
          loginUrl: "https://login.live.com",
          changeDataTitle: "Como trocar os dados da Microsoft",
          changeDataSteps: [
            <>Acesse <a href="https://account.microsoft.com/security" target="_blank" rel="noopener noreferrer" className="text-success underline">account.microsoft.com</a></>,
            <>Faça login com o email e senha acima</>,
            <>Vá em <strong className="text-foreground">Segurança</strong></>,
            <>Clique em <strong className="text-foreground">"Alterar senha"</strong></>,
            <>Defina sua nova senha</>,
          ],
          changeEmailSteps: [
            <>Acesse <a href="https://account.microsoft.com" target="_blank" rel="noopener noreferrer" className="text-success underline">account.microsoft.com</a> e faça login</>,
            <>Vá em <strong className="text-foreground">Suas Informações</strong></>,
            <>Em <strong className="text-foreground">Informações de contato</strong>, edite o email</>,
            <>Adicione seu novo email pessoal</>,
            <>Confirme e defina como email principal</>,
          ],
          checklist: ["Alterar a senha da conta Microsoft", "Trocar o email para o pessoal", "Ativar 2FA"],
        };
      default:
        return {
          loginUrl: "https://account.riotgames.com",
          changeDataTitle: "Como trocar os dados da Riot",
          changeDataSteps: [
            <>Acesse <a href="https://account.riotgames.com" target="_blank" rel="noopener noreferrer" className="text-success underline">account.riotgames.com</a></>,
            <>Faça login com o email e senha acima</>,
            <>Vá em <strong className="text-foreground">Configurações da Conta</strong></>,
            <>Na seção <strong className="text-foreground">RIOT ID</strong>, clique em editar</>,
            <>Na seção <strong className="text-foreground">SENHA</strong>, clique em "Alterar senha"</>,
          ],
          changeEmailSteps: [
            <>Acesse <a href="https://account.riotgames.com" target="_blank" rel="noopener noreferrer" className="text-success underline">account.riotgames.com</a></>,
            <>Vá em <strong className="text-foreground">EMAIL</strong> e clique em "Alterar email"</>,
            <>Confirme com código do email atual</>,
            <>Digite o novo email e confirme</>,
          ],
          checklist: ["Alterar a senha da conta Riot", "Trocar o email para o pessoal", "Alterar o Riot ID", "Ativar 2FA"],
        };
    }
  };

  // ─── Credential Card ────────────────────────────────────────────────────

  const renderCredentialCard = (jsonStr: string) => {
    try {
      const creds = JSON.parse(jsonStr);
      const login = typeof creds.login === "string" ? creds.login : JSON.stringify(creds.login) || "";
      const password = typeof creds.password === "string" ? creds.password : JSON.stringify(creds.password) || "";
      const emailVal = creds.email;
      const emailLogin = typeof emailVal === "object" && emailVal?.login ? emailVal.login : (typeof emailVal === "string" ? emailVal : "");
      const emailPassword = typeof emailVal === "object" && emailVal?.password ? emailVal.password : "";

      const game = creds.game || selectedTicket?.metadata?.game || "";
      const cfg = getGameConfig(game);

      return (
        <div className="space-y-2.5 w-full max-w-md">
          {/* Main credentials */}
          <div className="rounded-xl border border-success/25 bg-background p-3 space-y-2">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-success/15">
                <ShieldCheck className="h-3 w-3 text-success" />
              </div>
              <span className="text-xs font-bold text-foreground">Dados de login entregues</span>
            </div>
            <CopyField label="Login" value={login} />
            <CopyField label="Senha" value={password} />
            <CopyField label="Login:Senha" value={`${login}:${password}`} />

            {emailLogin && (
              <div className="mt-2.5 pt-2.5 border-t border-border space-y-2">
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-success" />
                  <span className="text-[11px] font-bold text-foreground">Acesso ao email (auto registrado)</span>
                </div>
                <CopyField label="Email da conta" value={emailLogin} />
                {emailPassword && <CopyField label="Senha do email" value={emailPassword} />}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1.5">
              <a href={cfg.loginUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/60 px-3 py-1.5 text-xs font-medium text-foreground hover:border-success/30 hover:bg-success/5">
                Login page <ExternalLink className="h-3 w-3" />
              </a>
              {emailLogin && (() => {
                const url = getEmailWebmailUrl(emailLogin);
                return url ? (
                  <a href={url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/60 px-3 py-1.5 text-xs font-medium text-foreground hover:border-success/30 hover:bg-success/5">
                    <Mail className="h-3 w-3" /> Email login <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null;
              })()}
            </div>
          </div>

          {/* Expandable sections */}
          <div className="space-y-1">
            {/* Change data */}
            <div className="rounded-xl border border-border bg-background overflow-hidden">
              <button onClick={() => setExpandedSection(expandedSection === "riot-admin" ? null : "riot-admin")}
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-secondary/40">
                <KeyRound className="h-3.5 w-3.5 text-success shrink-0" />
                <span className="flex-1 text-xs font-medium text-foreground">{cfg.changeDataTitle}</span>
                {expandedSection === "riot-admin" ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
              </button>
              {expandedSection === "riot-admin" && (
                <div className="border-t border-border px-3.5 py-2.5 text-xs text-muted-foreground space-y-1 leading-relaxed">
                  {cfg.changeDataSteps.map((step, i) => <p key={i}>{["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣"][i]} {step}</p>)}
                </div>
              )}
            </div>
            {/* Change email */}
            <div className="rounded-xl border border-border bg-background overflow-hidden">
              <button onClick={() => setExpandedSection(expandedSection === "email-admin" ? null : "email-admin")}
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-secondary/40">
                <Mail className="h-3.5 w-3.5 text-success shrink-0" />
                <span className="flex-1 text-xs font-medium text-foreground">Como trocar o email da conta</span>
                {expandedSection === "email-admin" ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
              </button>
              {expandedSection === "email-admin" && (
                <div className="border-t border-border px-3.5 py-2.5 text-xs text-muted-foreground space-y-1 leading-relaxed">
                  {cfg.changeEmailSteps.map((step, i) => <p key={i}>{["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣"][i]} {step}</p>)}
                </div>
              )}
            </div>
            {/* Checklist */}
            <div className="rounded-xl border border-success/20 bg-success/5 overflow-hidden">
              <button onClick={() => setExpandedSection(expandedSection === "done-admin" ? null : "done-admin")}
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-success/10">
                <CheckCircle className="h-3.5 w-3.5 text-success shrink-0" />
                <span className="flex-1 text-xs font-bold text-success">Entrega Concluída</span>
                {expandedSection === "done-admin" ? <ChevronUp className="h-3.5 w-3.5 text-success/60" /> : <ChevronDown className="h-3.5 w-3.5 text-success/60" />}
              </button>
              {expandedSection === "done-admin" && (
                <div className="border-t border-success/15 px-3.5 py-2.5 text-xs text-muted-foreground space-y-1 leading-relaxed">
                  <p className="text-foreground font-medium">📋 Checklist de segurança:</p>
                  {cfg.checklist.map((item, i) => <p key={i}>• {item}</p>)}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    } catch {
      return <p className="text-sm text-foreground whitespace-pre-wrap">{jsonStr}</p>;
    }
  };

  // ─── Message Content Renderer ───────────────────────────────────────────

  const getFileExtension = (url: string) => {
    const match = url.match(/\.(\w+)(?:\?|$)/);
    return match ? match[1].toUpperCase() : "FILE";
  };

  const renderMessageContent = (message: string, isStaff: boolean = false) => {
    const trimmed = message.trim();
    if (trimmed.startsWith("[CREDENTIALS]") || trimmed.includes("[CREDENTIALS]")) {
      const jsonStr = trimmed.replace("[CREDENTIALS]", "").trim();
      if (jsonStr.startsWith("{")) return renderCredentialCard(jsonStr);
    }

    const combinedPattern = /(\[IMAGE\](https?:\/\/\S+))|(\[AUDIO\](https?:\/\/\S+))|((?:📖\s*\*\*Tutorial:\*\*|📎\s*\*\*Arquivo:\*\*)\s*(https?:\/\/\S+))/g;
    const parts: { type: "text" | "file" | "image" | "audio"; content: string; label?: string; url?: string }[] = [];
    let lastIndex = 0;
    let match;

    while ((match = combinedPattern.exec(message)) !== null) {
      if (match.index > lastIndex) {
        const text = message.slice(lastIndex, match.index).trim();
        if (text) parts.push({ type: "text", content: text });
      }
      if (match[1]) parts.push({ type: "image", content: match[1], url: match[2] });
      else if (match[3]) parts.push({ type: "audio", content: match[3], url: match[4] });
      else if (match[5]) {
        const label = match[5].includes("Tutorial") ? "Tutorial" : "Arquivo";
        parts.push({ type: "file", content: match[5], label, url: match[6] });
      }
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < message.length) {
      const remaining = message.slice(lastIndex).trim();
      if (remaining) parts.push({ type: "text", content: remaining });
    }

    if (parts.length === 0 || parts.every(p => p.type === "text")) {
      return <p className="text-sm whitespace-pre-wrap text-foreground leading-relaxed">{message}</p>;
    }

    return (
      <div className="space-y-2">
        {parts.map((part, i) => {
          if (part.type === "text") return <p key={i} className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">{part.content}</p>;
          if (part.type === "image") {
            return (
              <a key={i} href={part.url} target="_blank" rel="noopener noreferrer" className="block">
                <img src={part.url} alt="Imagem enviada" className="rounded-lg max-w-[260px] max-h-[180px] object-cover border border-border hover:brightness-110 cursor-pointer" loading="lazy" />
              </a>
            );
          }
          if (part.type === "audio") return <AudioMessagePlayer key={i} src={part.url!} isStaff={isStaff} />;
          const isTutorial = part.label === "Tutorial";
          const IconComp = isTutorial ? BookOpen : FolderDown;
          const ext = getFileExtension(part.url!);
          return (
            <a key={i} href={part.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-lg border border-border bg-background/80 p-2.5 hover:border-success/30 hover:bg-success/5 group">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isTutorial ? "bg-info/10 text-info" : "bg-warning/10 text-warning"}`}>
                <IconComp className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-foreground">{part.label}</p>
                <p className="text-[10px] text-muted-foreground">{isTutorial ? "Baixe aqui o tutorial" : "Baixe aqui o arquivo"}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="rounded bg-secondary px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">.{ext}</span>
                <Download className="h-3.5 w-3.5 text-muted-foreground group-hover:text-success" />
              </div>
            </a>
          );
        })}
      </div>
    );
  };

  // ─── Pagination Helper ──────────────────────────────────────────────────

  const getPageNumbers = () => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "...")[] = [1];
    if (currentPage > 3) pages.push("...");
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push("...");
    pages.push(totalPages);
    return pages;
  };

  // ─── Loading ────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-success" />
    </div>
  );

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          {selectedTicket && (
            <button
              onClick={() => setSelectedTicket(null)}
              className="lg:hidden inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </button>
          )}
          <h2 className="text-lg font-bold text-foreground">Tickets</h2>
          <span className="rounded-full bg-success/10 border border-success/20 px-2 py-0.5 text-[11px] font-bold text-success tabular-nums">
            {filteredTickets.length}
          </span>
        </div>
        <button
          onClick={() => { setShowArchived(!showArchived); setSelectedTicket(null); }}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold ${
            showArchived
              ? "border-success/25 bg-success/10 text-success"
              : "border-border bg-card text-muted-foreground hover:text-foreground"
          }`}
        >
          {showArchived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
          {showArchived ? "Ativos" : "Arquivo"}
        </button>
      </div>

      {/* ── Search & Filter ── */}
      <div className="flex gap-2 mb-3 flex-shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome, email ou ID..."
            className="w-full rounded-lg border border-border bg-card pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-success/40 focus:ring-1 focus:ring-success/10"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground/40 hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {!showArchived && (
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground outline-none focus:border-success/40 cursor-pointer"
          >
            <option value="all">Todos</option>
            {statusOptions.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        )}
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 grid gap-3 lg:grid-cols-[320px_1fr] min-h-0">

        {/* ── Ticket List ── */}
        <div className={`flex flex-col min-h-0 ${selectedTicket ? "hidden lg:flex" : "flex"}`}>
          <div className="flex-1 overflow-y-auto space-y-1 pr-0.5 scrollbar-hide">
            {paginatedTickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <MessageSquare className="h-10 w-10 mb-3 opacity-15" />
                <p className="text-sm">{showArchived ? "Nenhum ticket arquivado" : "Nenhum ticket encontrado"}</p>
              </div>
            ) : paginatedTickets.map((ticket) => (
              <div
                key={ticket.id}
                className={`group rounded-lg border p-3 cursor-pointer ${
                  selectedTicket?.id === ticket.id
                    ? "border-success/30 bg-success/[0.06]"
                    : "border-border/60 bg-card hover:border-muted-foreground/20 hover:bg-accent/20"
                }`}
              >
                <button onClick={() => selectTicket(ticket)} className="w-full text-left">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-sm font-semibold text-foreground truncate leading-tight flex-1">{ticket.product_name}</span>
                    <span className={`shrink-0 rounded-full border px-2 py-px text-[10px] font-bold ${getStatusBadge(ticket.status)}`}>
                      {getStatusLabel(ticket.status)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                    <span className="truncate">{ticket.plan_name}</span>
                    <span className="text-muted-foreground/30">·</span>
                    <span className="font-semibold text-foreground/70">R$ {Number(ticket.plan_price || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <User className="h-3 w-3 shrink-0 text-muted-foreground/40" />
                    <span className="truncate">{ticket.buyer_username}</span>
                    <span className="text-muted-foreground/30">·</span>
                    <span className="truncate text-muted-foreground/60">{ticket.buyer_email}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground/40">
                      <Clock className="h-2.5 w-2.5" />
                      <span>{formatDate(ticket.created_at)} {formatTime(ticket.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground/30">
                      <Hash className="h-2.5 w-2.5" />
                      <span className="font-mono">{ticket.id.slice(0, 8)}</span>
                    </div>
                  </div>
                </button>
                <div className="flex justify-end mt-1.5 pt-1.5 border-t border-border/30">
                  {showArchived ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); unarchiveTicket(ticket.id); }}
                      className="inline-flex items-center gap-1 rounded-md bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success hover:bg-success/20"
                    >
                      <ArchiveRestore className="h-3 w-3" /> Restaurar
                    </button>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); archiveTicket(ticket.id); }}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/40 opacity-0 group-hover:opacity-100"
                    >
                      <Archive className="h-3 w-3" /> Arquivar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 pt-2.5 flex-shrink-0 border-t border-border/30 mt-1.5">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                className="rounded-lg border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-20">‹</button>
              {getPageNumbers().map((p, i) =>
                p === "..." ? (
                  <span key={`dots-${i}`} className="px-1.5 text-xs text-muted-foreground/40">…</span>
                ) : (
                  <button key={p} onClick={() => setCurrentPage(p as number)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold ${p === currentPage ? "bg-success text-success-foreground" : "border border-border text-muted-foreground hover:text-foreground"}`}>{p}</button>
                )
              )}
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                className="rounded-lg border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-20">›</button>
            </div>
          )}
        </div>

        {/* ── Chat Panel ── */}
        <div className={`rounded-xl border border-border bg-card overflow-hidden flex flex-col min-h-0 ${!selectedTicket ? "hidden lg:flex" : "flex"}`}>
          {!selectedTicket ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/30">
                  <MessageSquare className="h-6 w-6 text-muted-foreground/20" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Selecione um ticket</p>
                <p className="text-xs text-muted-foreground/50 mt-0.5">Escolha um ticket para ver a conversa</p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="border-b border-border bg-card flex-shrink-0">
                <div className="px-4 py-2.5 flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted ring-1 ring-border/50">
                    <UserCircle className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-foreground truncate">{selectedTicket.buyer_username}</p>
                      <span className="text-[10px] text-muted-foreground/50 truncate hidden sm:inline">{selectedTicket.buyer_email}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-px">
                      <span className="text-[11px] text-muted-foreground truncate max-w-[120px]">{selectedTicket.product_name}</span>
                      <span className="text-muted-foreground/20">·</span>
                      <span className="text-[11px] font-semibold text-foreground/60">R$ {Number(selectedTicket.plan_price || 0).toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {stockContent && (
                      <button
                        onClick={() => setShowDelivery(!showDelivery)}
                        className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold ${
                          showDelivery
                            ? "border-success/25 bg-success/10 text-success"
                            : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Package className="h-3 w-3" />
                        <span className="hidden sm:inline">Entrega</span>
                      </button>
                    )}
                    {selectedTicket.status !== "archived" && (
                      <select
                        value={selectedTicket.status}
                        onChange={(e) => updateStatus(selectedTicket.id, e.target.value)}
                        className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-bold outline-none cursor-pointer ${getStatusBadge(selectedTicket.status)}`}
                      >
                        {statusOptions.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                {/* Delivery panel */}
                {showDelivery && stockContent && (
                  <div className="border-t border-border px-4 py-2.5 bg-secondary/20 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-success/15">
                        <Package className="h-3 w-3 text-success" />
                      </div>
                      <span className="text-xs font-bold text-foreground">Conteúdo entregue</span>
                    </div>
                    <div className="rounded-lg border border-border bg-background p-2.5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-muted-foreground font-medium">Chave / Credenciais</span>
                        <div className="flex items-center gap-0.5">
                          <button onClick={() => setShowStockKey(!showStockKey)} className="rounded p-1 text-muted-foreground hover:text-foreground">
                            {showStockKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(stockContent);
                              setStockCopied(true);
                              setTimeout(() => setStockCopied(false), 2000);
                            }}
                            className="rounded p-1 text-muted-foreground hover:text-foreground"
                          >
                            {stockCopied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </div>
                      <code className="text-xs font-mono text-foreground break-all leading-relaxed">
                        {showStockKey ? stockContent : "••••••••••••••••••••"}
                      </code>
                    </div>
                  </div>
                )}
              </div>

              {/* Messages */}
              <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-hide bg-background/40">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground/30">
                    <Bot className="h-10 w-10 mb-2" />
                    <p className="text-xs">Nenhuma mensagem ainda</p>
                  </div>
                )}
                {messages.map((msg, idx) => {
                  const isStaff = msg.sender_role === "staff";
                  const showDate = idx === 0 || formatDate(messages[idx - 1].created_at) !== formatDate(msg.created_at);
                  return (
                    <div key={msg.id}>
                      {showDate && (
                        <div className="flex items-center justify-center my-3">
                          <div className="h-px flex-1 bg-border/30" />
                          <span className="mx-3 rounded-full bg-muted/30 px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground/50">
                            {formatDate(msg.created_at)}
                          </span>
                          <div className="h-px flex-1 bg-border/30" />
                        </div>
                      )}
                      <div className={`flex gap-2.5 ${isStaff ? "flex-row-reverse" : "flex-row"}`}>
                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                          isStaff ? "bg-success/15 ring-1 ring-success/10" : "bg-muted ring-1 ring-border/30"
                        }`}>
                          {isStaff ? <Bot className="h-3.5 w-3.5 text-success" /> : <UserCircle className="h-3.5 w-3.5 text-muted-foreground" />}
                        </div>
                        <div className="max-w-[75%] space-y-0.5">
                          <div className={`flex items-center gap-1.5 ${isStaff ? "justify-end" : ""}`}>
                            <span className={`text-[10px] font-bold ${isStaff ? "text-success/80" : "text-muted-foreground/70"}`}>
                              {isStaff ? "Staff" : "Usuário"}
                            </span>
                            <span className="text-[10px] text-muted-foreground/30">{formatTime(msg.created_at)}</span>
                          </div>
                          <div className={`rounded-2xl px-3.5 py-2.5 ${
                            isStaff
                              ? "bg-success/[0.08] border border-success/15 rounded-tr-md"
                              : "bg-card border border-border/60 rounded-tl-md"
                          }`}>
                            {renderMessageContent(msg.message, isStaff)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Pending files */}
              {pendingFiles.length > 0 && (
                <div className="border-t border-border px-3 py-2 bg-secondary/20 flex gap-2 flex-wrap">
                  {pendingFiles.map((file, i) => (
                    <div key={i} className="relative group">
                      {file.type.startsWith("image/") ? (
                        <img src={previewUrls[i]} alt={file.name} className="h-14 w-14 rounded-lg object-cover border border-border" />
                      ) : (
                        <div className="h-14 w-14 rounded-lg border border-border bg-muted flex flex-col items-center justify-center gap-0.5">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-[8px] text-muted-foreground font-bold truncate max-w-[48px]">
                            {file.name.split(".").pop()?.toUpperCase()}
                          </span>
                        </div>
                      )}
                      <button onClick={() => removePendingFile(i)}
                        className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow opacity-0 group-hover:opacity-100">
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Quick replies */}
              <div className="border-t border-border/50 px-3 pt-1.5 pb-1 bg-card/50 flex gap-1 overflow-x-auto scrollbar-hide">
                {QUICK_REPLIES.map((text) => (
                  <button key={text} onClick={() => setNewMessage(text)}
                    className="text-[10px] px-2 py-1 rounded-full border border-border/60 bg-secondary/30 text-muted-foreground/70 hover:bg-success/10 hover:text-success hover:border-success/25 whitespace-nowrap shrink-0">
                    {text}
                  </button>
                ))}
              </div>

              {/* Input */}
              <div className="border-t border-border/40 p-2.5 bg-card flex-shrink-0">
                {isRecording ? (
                  <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-2.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-destructive animate-pulse" />
                    <span className="text-sm font-medium text-foreground flex-1">Gravando... {formatDuration(recordingDuration)}</span>
                    <button onClick={cancelRecording} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10" title="Cancelar">
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <button onClick={handleSendAudio} disabled={sending || uploadingFile} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-success text-success-foreground disabled:opacity-30" title="Enviar áudio">
                      {sending || uploadingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-end gap-1.5 rounded-xl border border-border bg-background p-1.5 focus-within:border-success/30 focus-within:ring-1 focus-within:ring-success/10">
                    <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.txt,.doc,.docx,.zip,.rar,.exe" className="hidden" onChange={handleFileSelect} />
                    <button onClick={() => fileInputRef.current?.click()} disabled={uploadingFile}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-muted/40 disabled:opacity-30" title="Anexar">
                      <Paperclip className="h-4 w-4" />
                    </button>
                    <textarea
                      value={newMessage}
                      onChange={(e) => { setNewMessage(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px"; }}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                      placeholder="Responder como staff..."
                      rows={1}
                      className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 outline-none py-1.5 max-h-[100px]"
                    />
                    <button
                      onClick={() => startRecording().catch(() => toast({ title: "Erro", description: "Permita o acesso ao microfone", variant: "destructive" }))}
                      disabled={sending || uploadingFile}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-muted/40 disabled:opacity-30" title="Gravar áudio">
                      <Mic className="h-4 w-4" />
                    </button>
                    <button onClick={sendMessage} disabled={sending || uploadingFile || (!newMessage.trim() && pendingFiles.length === 0)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-success text-success-foreground disabled:opacity-20">
                      {sending || uploadingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TicketsTab;
