import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import AudioMessagePlayer from "@/components/AudioMessagePlayer";
import { Loader2, MessageSquare, Search, Send, Archive, ArchiveRestore, ArrowLeft, Clock, User, Copy, Check, ShieldCheck, ExternalLink, KeyRound, Mail, ChevronDown, ChevronUp, CheckCircle, BookOpen, FolderDown, Download, Package, Eye, EyeOff, Paperclip, Image, X, FileText, Bot, UserCircle, Mic, Square, Trash2 } from "lucide-react";
import { useAudioRecorder, formatDuration } from "@/hooks/useAudioRecorder";

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
}

interface Message {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_role: string;
  message: string;
  created_at: string;
}

const statusOptions = [
  { value: "open", label: "Aberto", color: "bg-success/20 text-success border-success/30" },
  { value: "delivered", label: "Entregue", color: "bg-info/20 text-info border-info/30" },
  { value: "resolved", label: "Resolvido", color: "bg-positive/20 text-positive border-positive/30" },
  { value: "closed", label: "Encerrado", color: "bg-muted text-muted-foreground border-border" },
  { value: "banned", label: "Banido", color: "bg-destructive/20 text-destructive border-destructive/30" },
  { value: "finished", label: "Finalizado", color: "bg-muted text-muted-foreground border-border" },
];

const ITEMS_PER_PAGE = 8;

const TicketsTab = () => {
  const { user } = useAuth();
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

  const fetchTickets = useCallback(async () => {
    const { data } = await supabase
      .from("order_tickets")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) {
      const productIds = [...new Set(data.map((t: any) => t.product_id))];
      const planIds = [...new Set(data.map((t: any) => t.product_plan_id))];
      const userIds = [...new Set(data.map((t: any) => t.user_id))];

      const [productsRes, plansRes, profilesRes, lztSalesRes] = await Promise.all([
        supabase.from("products").select("id, name").in("id", productIds),
        supabase.from("product_plans").select("id, name, price").in("id", planIds),
        supabase.from("profiles").select("user_id, username").in("user_id", userIds),
        supabase.from("lzt_sales").select("lzt_item_id, sell_price"),
      ]);

      let emailMap: Record<string, string> = {};
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const { data: usersData } = await supabase.functions.invoke("admin-users", {
          headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
        });
        if (Array.isArray(usersData)) {
          usersData.forEach((u: any) => { emailMap[u.id] = u.email; });
        }
      } catch {}

      const productMap: Record<string, string> = {};
      const planMap: Record<string, { name: string; price: number }> = {};
      const profileMap: Record<string, string> = {};
      const lztSalesMap = new Map<string, number>();
      productsRes.data?.forEach((p: any) => { productMap[p.id] = p.name; });
      plansRes.data?.forEach((p: any) => { planMap[p.id] = { name: p.name, price: p.price }; });
      profilesRes.data?.forEach((p: any) => { profileMap[p.user_id] = p.username || "—"; });
      lztSalesRes.data?.forEach((s: any) => { lztSalesMap.set(String(s.lzt_item_id), Number(s.sell_price)); });

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
          buyer_email: emailMap[t.user_id] || "—",
          buyer_username: profileMap[t.user_id] || "—",
        };
      }));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const selectTicket = useCallback(async (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setStockContent(null);
    setShowDelivery(false);
    setShowStockKey(false);
    setPendingFiles([]);
    setPreviewUrls([]);
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
        .single();
      if (stockData) {
        const raw = (stockData as any).content;
        setStockContent(typeof raw === "string" ? raw : JSON.stringify(raw));
      }
    }
  }, []);

  // Realtime subscription + polling fallback for reliable message sync
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

    // Polling fallback every 5s to catch missed realtime events
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
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [selectedTicket?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // File upload helpers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const newFiles = [...pendingFiles, ...files].slice(0, 5);
    setPendingFiles(newFiles);
    const urls = newFiles.map(f => {
      if (f.type.startsWith("image/")) return URL.createObjectURL(f);
      return "";
    });
    setPreviewUrls(urls);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePendingFile = (index: number) => {
    if (previewUrls[index]) URL.revokeObjectURL(previewUrls[index]);
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFileToStorage = async (file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop() || "bin";
    const path = `ticket-files/${selectedTicket!.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("game-images").upload(path, file, { upsert: false });
    if (error) {
      console.error("Upload error:", error);
      return null;
    }
    const { data: urlData } = supabase.storage.from("game-images").getPublicUrl(path);
    return urlData.publicUrl;
  };

  const handleSendAudio = async () => {
    if (!user || !selectedTicket) return;
    setSending(true);
    try {
      const blob = await stopRecording();
      if (!blob) { setSending(false); return; }
      setUploadingFile(true);
      const path = `ticket-files/${selectedTicket.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.webm`;
      const { error: uploadError } = await supabase.storage.from("game-images").upload(path, blob, { upsert: false, contentType: blob.type });
      if (uploadError) {
        toast({ title: "Erro no upload do áudio", description: uploadError.message, variant: "destructive" });
        setUploadingFile(false);
        setSending(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("game-images").getPublicUrl(path);
      const { data: insertedMsg, error } = await supabase.from("ticket_messages").insert({
        ticket_id: selectedTicket.id,
        sender_id: user.id,
        sender_role: "staff",
        message: `[AUDIO]${urlData.publicUrl}`,
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

  const sendMessage = async () => {
    if ((!newMessage.trim() && pendingFiles.length === 0) || !user || !selectedTicket) return;
    setSending(true);

    let messageParts: string[] = [];

    // Upload pending files
    if (pendingFiles.length > 0) {
      setUploadingFile(true);
      for (const file of pendingFiles) {
        const url = await uploadFileToStorage(file);
        if (url) {
          if (file.type.startsWith("image/")) {
            messageParts.push(`[IMAGE]${url}`);
          } else {
            messageParts.push(`📎 **Arquivo:** ${url}`);
          }
        }
      }
      setUploadingFile(false);
      setPendingFiles([]);
      setPreviewUrls([]);
    }

    if (newMessage.trim()) {
      messageParts.push(newMessage.trim());
    }

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

  const updateStatus = async (ticketId: string, status: string) => {
    // Se marcar como "closed", arquiva automaticamente
    const finalStatus = status === "closed" ? "archived" : status;
    const finalLabel = status === "closed" ? "Arquivado" : (statusOptions.find(s => s.value === status)?.label || status);
    const updates: any = { status: finalStatus, status_label: finalLabel };

    const { error } = await supabase.from("order_tickets").update(updates).eq("id", ticketId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Status: ${finalLabel}` });
      fetchTickets();
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket((prev) => prev ? { ...prev, status: finalStatus, status_label: finalLabel } : null);
      }
    }
  };

  const archiveTicket = async (ticketId: string) => {
    const { error } = await supabase
      .from("order_tickets")
      .update({ status: "archived" as any, status_label: "Arquivado" })
      .eq("id", ticketId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Ticket arquivado" });
      if (selectedTicket?.id === ticketId) setSelectedTicket(null);
      fetchTickets();
    }
  };

  const unarchiveTicket = async (ticketId: string) => {
    const { error } = await supabase
      .from("order_tickets")
      .update({ status: "open" as any, status_label: "Aberto" })
      .eq("id", ticketId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Ticket restaurado" });
      fetchTickets();
    }
  };

  const filteredTickets = tickets.filter((t) => {
    if (showArchived) {
      if (t.status !== "archived") return false;
    } else {
      if (t.status === "archived") return false;
    }
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (t.product_name?.toLowerCase().includes(q) || t.id.toLowerCase().includes(q) || t.buyer_email?.toLowerCase().includes(q) || t.buyer_username?.toLowerCase().includes(q));
    }
    return true;
  });

  const totalPages = Math.ceil(filteredTickets.length / ITEMS_PER_PAGE);
  const paginatedTickets = filteredTickets.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => { setCurrentPage(1); }, [searchQuery, filterStatus, showArchived]);

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
          <button onClick={handleCopy} className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground transition-colors">
            {fieldCopied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
      </div>
    );
  };

  const renderCredentialCard = (jsonStr: string) => {
    try {
      const creds = JSON.parse(jsonStr);
      const login = typeof creds.login === "string" ? creds.login : JSON.stringify(creds.login) || "";
      const password = typeof creds.password === "string" ? creds.password : JSON.stringify(creds.password) || "";
      const emailVal = creds.email;
      const accountEmail = typeof emailVal === "string" ? emailVal : (emailVal?.login || emailVal?.raw || JSON.stringify(emailVal) || "");

      return (
        <div className="space-y-3 w-full max-w-sm">
          <div className="rounded-xl border border-success/30 bg-background p-3 space-y-2.5">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-success/20">
                <ShieldCheck className="h-3 w-3 text-success" />
              </div>
              <span className="text-xs font-bold text-foreground">Dados de login entregues:</span>
            </div>
            <CopyField label="Login" value={login} />
            <CopyField label="Password" value={password} />
            {accountEmail && <CopyField label="Email da conta" value={accountEmail} />}
            <CopyField label="Login:Senha" value={`${login}:${password}`} />
            <div className="flex items-center gap-2 pt-1">
              <a href="https://account.riotgames.com" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-2 text-xs font-medium text-foreground transition-colors hover:border-success/40">
                Login page <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="rounded-xl border border-border bg-background overflow-hidden">
              <button onClick={() => setExpandedSection(expandedSection === "riot-admin" ? null : "riot-admin")}
                className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-secondary/50">
                <KeyRound className="h-4 w-4 text-success shrink-0" />
                <span className="flex-1 text-sm font-medium text-foreground">Como trocar os dados da Riot</span>
                {expandedSection === "riot-admin" ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              {expandedSection === "riot-admin" && (
                <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground space-y-1.5 leading-relaxed">
                  <p>1️⃣ Acesse <a href="https://account.riotgames.com" target="_blank" rel="noopener noreferrer" className="text-success underline">account.riotgames.com</a></p>
                  <p>2️⃣ Faça login com o email e senha acima</p>
                  <p>3️⃣ Vá em <strong className="text-foreground">Configurações da Conta</strong></p>
                  <p>4️⃣ Na seção <strong className="text-foreground">RIOT ID</strong>, clique em editar</p>
                  <p>5️⃣ Na seção <strong className="text-foreground">SENHA</strong>, clique em "Alterar senha"</p>
                </div>
              )}
            </div>
            <div className="rounded-xl border border-border bg-background overflow-hidden">
              <button onClick={() => setExpandedSection(expandedSection === "email-admin" ? null : "email-admin")}
                className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-secondary/50">
                <Mail className="h-4 w-4 text-success shrink-0" />
                <span className="flex-1 text-sm font-medium text-foreground">Como trocar o email da conta</span>
                {expandedSection === "email-admin" ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              {expandedSection === "email-admin" && (
                <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground space-y-1.5 leading-relaxed">
                  <p>1️⃣ Acesse <a href="https://account.riotgames.com" target="_blank" rel="noopener noreferrer" className="text-success underline">account.riotgames.com</a></p>
                  <p>2️⃣ Vá em <strong className="text-foreground">EMAIL</strong> e clique em "Alterar email"</p>
                  <p>3️⃣ Confirme com código do email atual</p>
                  <p>4️⃣ Digite o novo email e confirme</p>
                </div>
              )}
            </div>
            <div className="rounded-xl border border-success/30 bg-success/5 overflow-hidden">
              <button onClick={() => setExpandedSection(expandedSection === "done-admin" ? null : "done-admin")}
                className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-success/10">
                <CheckCircle className="h-4 w-4 text-success shrink-0" />
                <span className="flex-1 text-sm font-bold text-success">Entrega Concluída</span>
                {expandedSection === "done-admin" ? <ChevronUp className="h-4 w-4 text-success/60" /> : <ChevronDown className="h-4 w-4 text-success/60" />}
              </button>
              {expandedSection === "done-admin" && (
                <div className="border-t border-success/20 px-4 py-3 text-xs text-muted-foreground space-y-1.5 leading-relaxed">
                  <p className="text-foreground font-medium">📋 Checklist de segurança:</p>
                  <p>• Alterar a senha da conta Riot</p>
                  <p>• Trocar o email para o pessoal</p>
                  <p>• Alterar o Riot ID</p>
                  <p>• Ativar 2FA</p>
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

  const getFileExtension = (url: string) => {
    const match = url.match(/\.(\w+)(?:\?|$)/);
    return match ? match[1].toUpperCase() : "FILE";
  };

  const isImageUrl = (url: string) => {
    return /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?|$)/i.test(url);
  };

  // Renders message content with support for images, audio, credentials, and file attachments
  const renderMessageContent = (message: string, isStaff: boolean = false) => {
    const trimmed = message.trim();
    if (trimmed.startsWith("[CREDENTIALS]") || trimmed.includes("[CREDENTIALS]")) {
      const jsonStr = trimmed.replace("[CREDENTIALS]", "").trim();
      if (jsonStr.startsWith("{")) {
        return renderCredentialCard(jsonStr);
      }
    }

    // Handle [IMAGE] tags
    const imageTagPattern = /\[IMAGE\](https?:\/\/\S+)/g;
    const filePattern = /(📖\s*\*\*Tutorial:\*\*|📎\s*\*\*Arquivo:\*\*)\s*(https?:\/\/\S+)/g;
    
    const parts: { type: "text" | "file" | "image" | "audio"; content: string; label?: string; url?: string }[] = [];
    
    // Combined regex approach
    const combinedPattern = /(\[IMAGE\](https?:\/\/\S+))|(\[AUDIO\](https?:\/\/\S+))|((?:📖\s*\*\*Tutorial:\*\*|📎\s*\*\*Arquivo:\*\*)\s*(https?:\/\/\S+))/g;
    let lastIndex = 0;
    let match;

    while ((match = combinedPattern.exec(message)) !== null) {
      if (match.index > lastIndex) {
        const textBefore = message.slice(lastIndex, match.index).trim();
        if (textBefore) parts.push({ type: "text", content: textBefore });
      }
      if (match[1]) {
        parts.push({ type: "image", content: match[1], url: match[2] });
      } else if (match[3]) {
        parts.push({ type: "audio", content: match[3], url: match[4] });
      } else if (match[5]) {
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
          if (part.type === "text") {
            return <p key={i} className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">{part.content}</p>;
          }
          if (part.type === "image") {
            return (
              <a key={i} href={part.url} target="_blank" rel="noopener noreferrer" className="block">
                <img
                  src={part.url}
                  alt="Imagem enviada"
                  className="rounded-xl max-w-[280px] max-h-[200px] object-cover border border-border hover:brightness-110 transition-all cursor-pointer"
                  loading="lazy"
                />
              </a>
            );
          }
          if (part.type === "audio") {
            return <AudioMessagePlayer key={i} src={part.url!} isStaff={isStaff} />;
          }
          const isTutorial = part.label === "Tutorial";
          const IconComp = isTutorial ? BookOpen : FolderDown;
          const description = isTutorial ? "Baixe aqui o tutorial" : "Baixe aqui o arquivo";
          const ext = getFileExtension(part.url!);
          return (
            <a
              key={i}
              href={part.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-xl border border-border bg-background/80 p-3 transition-all hover:border-success/40 hover:bg-success/5 group"
            >
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors ${isTutorial ? "bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20" : "bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20"}`}>
                <IconComp className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-foreground">{part.label}</p>
                <p className="text-[10px] text-muted-foreground">{description}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="rounded bg-secondary px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">.{ext}</span>
                <Download className="h-4 w-4 text-muted-foreground group-hover:text-success transition-colors" />
              </div>
            </a>
          );
        })}
      </div>
    );
  };

  if (loading) return (
    <div className="flex justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-success" />
    </div>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] min-h-[600px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          {selectedTicket && (
            <button
              onClick={() => setSelectedTicket(null)}
              className="lg:hidden flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar
            </button>
          )}
          <h2 className="text-xl font-bold text-foreground">Tickets</h2>
          <span className="rounded-full bg-success/10 border border-success/20 px-2.5 py-0.5 text-xs font-bold text-success">
            {filteredTickets.length}
          </span>
        </div>
        <button
          onClick={() => { setShowArchived(!showArchived); setSelectedTicket(null); }}
          className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-semibold transition-all ${
            showArchived
              ? "border-success/30 bg-success/10 text-success"
              : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-border"
          }`}
        >
          {showArchived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
          {showArchived ? "Ativos" : "Arquivo"}
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-2 mb-4 flex-shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar ticket..."
            className="w-full rounded-lg border border-border bg-card pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-success/50 transition-colors"
          />
        </div>
        {!showArchived && (
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground outline-none focus:border-success/50 transition-colors"
          >
            <option value="all">Todos</option>
            {statusOptions.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 grid gap-4 lg:grid-cols-[340px_1fr] min-h-0">
        {/* Ticket list */}
        <div className={`flex flex-col min-h-0 ${selectedTicket ? "hidden lg:flex" : "flex"}`}>
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 scrollbar-chat">
            {paginatedTickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <MessageSquare className="h-10 w-10 mb-3 opacity-20" />
                <p className="text-sm">{showArchived ? "Nenhum ticket arquivado" : "Nenhum ticket encontrado"}</p>
              </div>
            ) : paginatedTickets.map((ticket) => (
              <div
                key={ticket.id}
                className={`group rounded-lg border p-3 cursor-pointer transition-all ${
                  selectedTicket?.id === ticket.id
                    ? "border-success/40 bg-success/5 shadow-[0_0_15px_-5px_hsl(var(--success)/0.2)]"
                    : "border-border bg-card hover:border-muted-foreground/20 hover:bg-accent/30"
                }`}
              >
                <button onClick={() => selectTicket(ticket)} className="w-full text-left">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span className="text-sm font-semibold text-foreground truncate leading-tight">{ticket.product_name}</span>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${getStatusBadge(ticket.status)}`}>
                      {getStatusLabel(ticket.status)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <span className="truncate">{ticket.plan_name}</span>
                    <span>·</span>
                    <span className="font-medium text-foreground/70">R$ {Number(ticket.plan_price || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <User className="h-3 w-3 shrink-0" />
                    <span className="truncate">{ticket.buyer_username}</span>
                    <span>·</span>
                    <span className="truncate">{ticket.buyer_email}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-muted-foreground/50">
                    <Clock className="h-2.5 w-2.5" />
                    <span>{formatDate(ticket.created_at)} {formatTime(ticket.created_at)}</span>
                  </div>
                </button>
                <div className="flex justify-end mt-2 pt-2 border-t border-border/50">
                  {showArchived ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); unarchiveTicket(ticket.id); }}
                      className="flex items-center gap-1 rounded-md bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-success hover:bg-success/20 transition-colors"
                    >
                      <ArchiveRestore className="h-3 w-3" /> Restaurar
                    </button>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); archiveTicket(ticket.id); }}
                      className="flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/50 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Archive className="h-3 w-3" /> Arquivar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 pt-3 flex-shrink-0 border-t border-border/50 mt-2">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">‹</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setCurrentPage(p)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${p === currentPage ? "bg-success text-success-foreground shadow-[0_0_10px_-3px_hsl(var(--success)/0.4)]" : "border border-border text-muted-foreground hover:text-foreground"}`}>{p}</button>
              ))}
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">›</button>
            </div>
          )}
        </div>

        {/* Chat panel */}
        <div className={`rounded-xl border border-border bg-card overflow-hidden flex flex-col min-h-0 ${!selectedTicket ? "hidden lg:flex" : "flex"}`}>
          {!selectedTicket ? (
            <div className="flex flex-1 items-center justify-center text-muted-foreground">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50">
                  <MessageSquare className="h-7 w-7 text-muted-foreground/30" />
                </div>
                <p className="text-sm font-medium">Selecione um ticket</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Escolha um ticket ao lado para ver a conversa</p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="border-b border-border bg-card flex-shrink-0">
                <div className="px-5 py-3.5 flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted ring-2 ring-border/50">
                        <UserCircle className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">{selectedTicket.buyer_username}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{selectedTicket.buyer_email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 ml-10">
                      <span className="text-xs text-muted-foreground">{selectedTicket.product_name}</span>
                      <span className="text-xs text-muted-foreground/40">·</span>
                      <span className="text-xs text-muted-foreground">{selectedTicket.plan_name}</span>
                      <span className="text-xs text-muted-foreground/40">·</span>
                      <span className="text-xs font-medium text-foreground/70">R$ {Number(selectedTicket.plan_price || 0).toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {stockContent && (
                      <button
                        onClick={() => setShowDelivery(!showDelivery)}
                        className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-all ${
                          showDelivery
                            ? "border-success/30 bg-success/10 text-success"
                            : "border-border bg-secondary/50 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Package className="h-3.5 w-3.5" />
                        Entrega
                      </button>
                    )}
                    {selectedTicket.status !== "archived" && (
                      <select
                        value={selectedTicket.status}
                        onChange={(e) => updateStatus(selectedTicket.id, e.target.value)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-bold outline-none transition-colors cursor-pointer ${getStatusBadge(selectedTicket.status)}`}
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
                  <div className="border-t border-border px-5 py-3 bg-secondary/30 space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-success/20">
                        <Package className="h-3 w-3 text-success" />
                      </div>
                      <span className="text-xs font-bold text-foreground">Conteúdo entregue ao usuário</span>
                    </div>
                    <div className="rounded-lg border border-border bg-background p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-muted-foreground font-medium">Chave / Credenciais</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setShowStockKey(!showStockKey)}
                            className="rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {showStockKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(stockContent);
                              setStockCopied(true);
                              setTimeout(() => setStockCopied(false), 2000);
                            }}
                            className="rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
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

              {/* Messages — AI chat style */}
              <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-4 py-5 space-y-4 scrollbar-chat bg-background/50">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground/40">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/30 mb-3">
                      <Bot className="h-6 w-6" />
                    </div>
                    <p className="text-xs">Nenhuma mensagem ainda</p>
                  </div>
                )}
                {messages.map((msg, idx) => {
                  const isStaff = msg.sender_role === "staff";
                  const showDate = idx === 0 || formatDate(messages[idx - 1].created_at) !== formatDate(msg.created_at);
                  return (
                    <div key={msg.id}>
                      {showDate && (
                        <div className="flex items-center justify-center my-4">
                          <div className="h-px flex-1 bg-border/50" />
                          <span className="mx-3 rounded-full bg-muted/50 px-3 py-1 text-[10px] font-medium text-muted-foreground/60">
                            {formatDate(msg.created_at)}
                          </span>
                          <div className="h-px flex-1 bg-border/50" />
                        </div>
                      )}
                      <div className={`flex gap-3 ${isStaff ? "flex-row-reverse" : "flex-row"}`}>
                        {/* Avatar */}
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                          isStaff
                            ? "bg-success/20 ring-2 ring-success/10"
                            : "bg-muted ring-2 ring-border/50"
                        }`}>
                          {isStaff ? (
                            <Bot className="h-4 w-4 text-success" />
                          ) : (
                            <UserCircle className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        {/* Bubble */}
                        <div className={`max-w-[75%] space-y-1`}>
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`text-[11px] font-bold ${isStaff ? "text-success" : "text-muted-foreground"}`}>
                              {isStaff ? "Staff" : "Usuário"}
                            </span>
                            <span className="text-[10px] text-muted-foreground/40">
                              {formatTime(msg.created_at)}
                            </span>
                          </div>
                          <div className={`rounded-2xl px-4 py-3 ${
                            isStaff
                              ? "bg-success/10 border border-success/20 rounded-tr-md"
                              : "bg-card border border-border rounded-tl-md"
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

              {/* Pending files preview */}
              {pendingFiles.length > 0 && (
                <div className="border-t border-border px-4 py-2 bg-secondary/30 flex gap-2 flex-wrap">
                  {pendingFiles.map((file, i) => (
                    <div key={i} className="relative group">
                      {file.type.startsWith("image/") ? (
                        <img
                          src={previewUrls[i]}
                          alt={file.name}
                          className="h-16 w-16 rounded-lg object-cover border border-border"
                        />
                      ) : (
                        <div className="h-16 w-16 rounded-lg border border-border bg-muted flex flex-col items-center justify-center gap-1">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <span className="text-[8px] text-muted-foreground font-bold truncate max-w-[56px]">
                            {file.name.split(".").pop()?.toUpperCase()}
                          </span>
                        </div>
                      )}
                      <button
                        onClick={() => removePendingFile(i)}
                        className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Quick replies */}
              <div className="border-t border-border px-3 pt-2 pb-1 bg-card/80 flex gap-1.5 flex-wrap">
                {[
                  "Precisa de ajuda?",
                  "Qual seu problema?",
                  "Quer resetar HWID?",
                  "Qual sua key?",
                  "Envie seu login e senha",
                  "Problema resolvido!",
                  "Aguarde um momento",
                ].map((text) => (
                  <button
                    key={text}
                    onClick={() => setNewMessage(text)}
                    className="text-[11px] px-2.5 py-1 rounded-full border border-border bg-secondary/50 text-muted-foreground hover:bg-success/10 hover:text-success hover:border-success/30 transition-all whitespace-nowrap"
                  >
                    {text}
                  </button>
                ))}
              </div>

              {/* Input — AI chat style */}
              <div className="border-t border-border/50 p-3 bg-card flex-shrink-0">
                {isRecording ? (
                  <div className="flex items-center gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 p-3">
                    <div className="h-3 w-3 rounded-full bg-destructive animate-pulse" />
                    <span className="text-sm font-medium text-foreground flex-1">Gravando... {formatDuration(recordingDuration)}</span>
                    <button onClick={cancelRecording} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all" title="Cancelar">
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <button onClick={handleSendAudio} disabled={sending || uploadingFile} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-success text-success-foreground disabled:opacity-30 hover:brightness-110 transition-all" title="Enviar áudio">
                      {sending || uploadingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-end gap-2 rounded-2xl border border-border bg-background p-2 focus-within:border-success/40 focus-within:shadow-[0_0_0_3px_hsl(var(--success)/0.08)] transition-all">
                    <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.txt,.doc,.docx,.zip,.rar,.exe" className="hidden" onChange={handleFileSelect} />
                    <button onClick={() => fileInputRef.current?.click()} disabled={uploadingFile} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all disabled:opacity-40" title="Anexar arquivo ou imagem">
                      <Paperclip className="h-[18px] w-[18px]" />
                    </button>
                    <textarea
                      value={newMessage}
                      onChange={(e) => { setNewMessage(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                      placeholder="Responder como staff..."
                      rows={1}
                      className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none py-2 max-h-[120px]"
                    />
                    <button
                      onClick={() => startRecording().catch(() => toast({ title: "Erro", description: "Permita o acesso ao microfone", variant: "destructive" }))}
                      disabled={sending || uploadingFile}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all disabled:opacity-40"
                      title="Gravar áudio"
                    >
                      <Mic className="h-[18px] w-[18px]" />
                    </button>
                    <button onClick={sendMessage} disabled={sending || uploadingFile || (!newMessage.trim() && pendingFiles.length === 0)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-success text-success-foreground disabled:opacity-30 hover:brightness-110 transition-all">
                      {sending || uploadingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </button>
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground/40 mt-1.5 text-center">
                  Shift + Enter para nova linha · 📎 anexar · 🎤 gravar áudio
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TicketsTab;
