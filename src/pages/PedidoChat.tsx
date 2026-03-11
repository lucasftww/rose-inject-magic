import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Copy, Check, Eye, EyeOff, Loader2, Lock, MessageSquare, Package, Send, ShieldCheck, Calendar, Hash, DollarSign, Clock, CreditCard, Star, BookOpen, FolderDown, Download, ExternalLink, Mail, KeyRound, ChevronDown, ChevronUp, CheckCircle, Paperclip, X, FileText, Mic, Square, Trash2 } from "lucide-react";
import { useAudioRecorder, formatDuration } from "@/hooks/useAudioRecorder";
import { motion } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import AudioMessagePlayer from "@/components/AudioMessagePlayer";

interface TicketData {
  id: string;
  user_id: string;
  product_id: string;
  product_plan_id: string;
  stock_item_id: string | null;
  status: string;
  status_label: string;
  created_at: string;
}

interface Message {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_role: string;
  message: string;
  created_at: string;
}

const PedidoChat = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [productName, setProductName] = useState("");
  const [planName, setPlanName] = useState("");
  const [planPrice, setPlanPrice] = useState<number | null>(null);
  const [stockContent, setStockContent] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tutorialText, setTutorialText] = useState<string | null>(null);
  const [tutorialFileUrl, setTutorialFileUrl] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const { isRecording, recordingDuration, startRecording, stopRecording, cancelRecording } = useAudioRecorder();

  // Review state
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewHover, setReviewHover] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [existingReview, setExistingReview] = useState<{ id: string; rating: number; comment: string | null } | null>(null);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [loadingReview, setLoadingReview] = useState(true);
  const [showReviewModal, setShowReviewModal] = useState(false);

  // Only staff can close — chat is locked only on closed/banned/finished
  const isLocked = ticket && ["closed", "banned", "finished"].includes(ticket.status);

  useEffect(() => {
    if (!authLoading && !user) navigate("/");
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!id || !user) return;
    const fetchData = async () => {
      const { data: ticketData } = await supabase
        .from("order_tickets")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (!ticketData) { setLoading(false); return; }
      setTicket(ticketData as any);

      const meta = ticketData.metadata as any;
      const isLzt = meta?.type === "lzt-account";

      const [prodRes, planRes, messagesRes, tutorialRes] = await Promise.all([
        supabase.from("products").select("name").eq("id", ticketData.product_id).single(),
        supabase.from("product_plans").select("name, price").eq("id", ticketData.product_plan_id).single(),
        supabase.from("ticket_messages").select("*").eq("ticket_id", id).order("created_at", { ascending: true }),
        supabase.from("product_tutorials").select("tutorial_text, tutorial_file_url").eq("product_id", ticketData.product_id).maybeSingle(),
      ]);

      if (isLzt) {
        const lztGameLabels: Record<string, string> = {
          valorant: "Conta Valorant", lol: "Conta LoL", fortnite: "Conta Fortnite", minecraft: "Conta Minecraft",
        };
        const gameLabel = lztGameLabels[meta?.game] || "Conta LZT";
        setProductName(meta?.account_name || meta?.title || gameLabel);
        setPlanName(gameLabel);
        setPlanPrice(meta?.price_paid || meta?.sell_price || 0);
      } else {
        if (prodRes.data) setProductName((prodRes.data as any).name);
        if (planRes.data) {
          setPlanName((planRes.data as any).name);
          setPlanPrice((planRes.data as any).price);
        }
      }
      if (tutorialRes.data) {
        setTutorialText((tutorialRes.data as any).tutorial_text || null);
        setTutorialFileUrl((tutorialRes.data as any).tutorial_file_url || null);
      }
      if (messagesRes.data) setMessages(messagesRes.data as any[]);
      if (messagesRes.data) setMessages(messagesRes.data as any[]);

      if (ticketData.stock_item_id) {
        const { data: stockData } = await supabase
          .from("stock_items")
          .select("content")
          .eq("id", ticketData.stock_item_id)
          .single();
        if (stockData) {
          const raw = (stockData as any).content;
          setStockContent(typeof raw === "string" ? raw : JSON.stringify(raw));
        }
      }

      // Fetch existing review (now that we have ticketData.product_id)
      const { data: reviewData } = await supabase
        .from("product_reviews")
        .select("id, rating, comment")
        .eq("product_id", ticketData.product_id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (reviewData) {
        setExistingReview(reviewData as any);
        setReviewRating((reviewData as any).rating);
        setReviewComment((reviewData as any).comment || "");
      }
      setLoadingReview(false);

      setLoading(false);
    };
    fetchData();
  }, [id, user]);

  // Realtime subscription + polling fallback for reliable message sync
  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    const channel = supabase
      .channel(`ticket-${id}-${Date.now()}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "ticket_messages",
        filter: `ticket_id=eq.${id}`,
      }, (payload) => {
        setMessages((prev) => {
          const newMsg = payload.new as Message;
          if (prev.some(m => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      })
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "order_tickets",
        filter: `id=eq.${id}`,
      }, (payload) => {
        setTicket(payload.new as any);
      })
      .subscribe();

    // Polling fallback every 5s to catch missed realtime events
    const pollInterval = setInterval(async () => {
      if (cancelled) return;
      const { data } = await supabase
        .from("ticket_messages")
        .select("*")
        .eq("ticket_id", id)
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
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
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
    const ext = file.name.split(".").pop() || "bin";
    const path = `ticket-files/${ticket!.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("game-images").upload(path, file, { upsert: false });
    if (error) { console.error("Upload error:", error); return null; }
    const { data: urlData } = supabase.storage.from("game-images").getPublicUrl(path);
    return urlData.publicUrl;
  };

  const handleSendAudio = async () => {
    if (!user || !ticket || isLocked) return;
    setSending(true);
    try {
      const blob = await stopRecording();
      if (!blob) { setSending(false); return; }
      setUploadingFile(true);
      const path = `ticket-files/${ticket.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.webm`;
      const { error: uploadError } = await supabase.storage.from("game-images").upload(path, blob, { upsert: false, contentType: blob.type });
      if (uploadError) {
        toast({ title: "Erro no upload do áudio", description: uploadError.message, variant: "destructive" });
        setUploadingFile(false);
        setSending(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("game-images").getPublicUrl(path);
      const { data: insertedMsg, error } = await supabase.from("ticket_messages").insert({
        ticket_id: ticket.id,
        sender_id: user.id,
        sender_role: "user",
        message: `[AUDIO]${urlData.publicUrl}`,
      }).select().single();
      if (error) {
        toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" });
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
    if ((!newMessage.trim() && pendingFiles.length === 0) || !user || !ticket || isLocked) return;
    setSending(true);
    
    try {
      let messageParts: string[] = [];

      if (pendingFiles.length > 0) {
        setUploadingFile(true);
        try {
          for (const file of pendingFiles) {
            const url = await uploadFileToStorage(file);
            if (url) {
              messageParts.push(file.type.startsWith("image/") ? `[IMAGE]${url}` : `📎 **Arquivo:** ${url}`);
            } else {
              toast({ title: "Erro no upload", description: `Falha ao enviar ${file.name}`, variant: "destructive" });
            }
          }
        } catch (uploadErr: any) {
          console.error("Upload error:", uploadErr);
          toast({ title: "Erro no upload", description: uploadErr?.message || "Falha ao enviar arquivo", variant: "destructive" });
        } finally {
          setUploadingFile(false);
          // Clean up preview URLs
          previewUrls.forEach(url => { if (url) URL.revokeObjectURL(url); });
          setPendingFiles([]);
          setPreviewUrls([]);
        }
      }

      if (newMessage.trim()) messageParts.push(newMessage.trim());
      const fullMessage = messageParts.join("\n");
      if (!fullMessage) { setSending(false); return; }

      const { data: insertedMsg, error } = await supabase.from("ticket_messages").insert({
        ticket_id: ticket.id,
        sender_id: user.id,
        sender_role: "user",
        message: fullMessage,
      }).select().single();
      if (error) {
        toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" });
      } else if (insertedMsg) {
        setMessages(prev => prev.some(m => m.id === insertedMsg.id) ? prev : [...prev, insertedMsg as Message]);
      }
      setNewMessage("");
    } catch (err: any) {
      console.error("Send message error:", err);
      toast({ title: "Erro", description: err?.message || "Erro ao enviar mensagem", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const submitReview = async () => {
    if (!reviewRating || !user || !ticket) return;
    setSubmittingReview(true);
    if (existingReview) {
      const { error } = await supabase
        .from("product_reviews")
        .update({ rating: reviewRating, comment: reviewComment.trim() || null })
        .eq("id", existingReview.id);
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
      } else {
        setExistingReview({ ...existingReview, rating: reviewRating, comment: reviewComment.trim() || null });
        toast({ title: "Avaliação atualizada!" });
      }
    } else {
      const { data, error } = await supabase
        .from("product_reviews")
        .insert({
          user_id: user.id,
          product_id: ticket.product_id,
          rating: reviewRating,
          comment: reviewComment.trim() || null,
        })
        .select("id, rating, comment")
        .single();
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
      } else if (data) {
        setExistingReview(data as any);
        toast({ title: "Avaliação enviada!" });
      }
    }
    setSubmittingReview(false);
  };

  const copyKey = () => {
    if (stockContent) {
      const text = typeof stockContent === "string" ? stockContent : JSON.stringify(stockContent);
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getFileExtension = (url: string) => {
    const match = url.match(/\.(\w+)(?:\?|$)/);
    return match ? match[1].toUpperCase() : "FILE";
  };

  const getFileName = (url: string) => {
    const parts = url.split("/");
    return parts[parts.length - 1]?.split("?")[0] || "arquivo";
  };

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
          {/* Credential Card */}
          <div className="rounded-xl border border-success/30 bg-background p-3 space-y-2.5">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-success/20">
                <ShieldCheck className="h-3 w-3 text-success" />
              </div>
              <span className="text-xs font-bold text-foreground">Valorant and League Of Legends login data:</span>
            </div>
            
            <CopyField label="Login" value={login} />
            <CopyField label="Password" value={password} />
            {accountEmail && <CopyField label="Access to email (auto registered)" value={accountEmail} />}
            <CopyField label="Login and password" value={`${login}:${password}`} />

            <div className="flex items-center gap-2 pt-1">
              <a
                href="https://account.riotgames.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-2 text-xs font-medium text-foreground transition-colors hover:border-success/40"
              >
                Login page <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-1.5">
            {/* Button 1: Como trocar dados da Riot */}
            <div className="rounded-xl border border-border bg-background overflow-hidden">
              <button
                onClick={() => setExpandedSection(expandedSection === "riot" ? null : "riot")}
                className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-secondary/50"
              >
                <KeyRound className="h-4 w-4 text-success shrink-0" />
                <span className="flex-1 text-sm font-medium text-foreground">Como trocar os dados da Riot</span>
                {expandedSection === "riot" ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              {expandedSection === "riot" && (
                <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground space-y-1.5 leading-relaxed">
                  <p>1️⃣ Acesse <a href="https://account.riotgames.com" target="_blank" rel="noopener noreferrer" className="text-success underline">account.riotgames.com</a></p>
                  <p>2️⃣ Faça login com o email e senha acima</p>
                  <p>3️⃣ Vá em <strong className="text-foreground">Configurações da Conta</strong></p>
                  <p>4️⃣ Na seção <strong className="text-foreground">RIOT ID</strong>, clique em editar para alterar nome e tag</p>
                  <p>5️⃣ Na seção <strong className="text-foreground">SENHA</strong>, clique em "Alterar senha"</p>
                  <p className="pl-4">• Coloque a senha atual (fornecida acima)</p>
                  <p className="pl-4">• Defina sua nova senha</p>
                  <p className="mt-2 text-warning font-medium">⚠️ Altere a senha IMEDIATAMENTE para garantir a segurança.</p>
                </div>
              )}
            </div>

            {/* Button 2: Como trocar o email */}
            <div className="rounded-xl border border-border bg-background overflow-hidden">
              <button
                onClick={() => setExpandedSection(expandedSection === "email" ? null : "email")}
                className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-secondary/50"
              >
                <Mail className="h-4 w-4 text-success shrink-0" />
                <span className="flex-1 text-sm font-medium text-foreground">Como trocar o email da conta</span>
                {expandedSection === "email" ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              {expandedSection === "email" && (
                <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground space-y-1.5 leading-relaxed">
                  <p>1️⃣ Acesse <a href="https://account.riotgames.com" target="_blank" rel="noopener noreferrer" className="text-success underline">account.riotgames.com</a> e faça login</p>
                  <p>2️⃣ Vá em <strong className="text-foreground">Configurações da Conta</strong> {'>'} <strong className="text-foreground">EMAIL</strong></p>
                  <p>3️⃣ Clique em <strong className="text-foreground">"Alterar email"</strong></p>
                  <p>4️⃣ Um código será enviado para o email atual</p>
                  <p className="pl-4">• Se não tiver acesso, clique em "Não tenho acesso"</p>
                  <p>5️⃣ Digite o seu novo email pessoal</p>
                  <p>6️⃣ Confirme o código enviado ao seu novo email</p>
                  <p className="mt-2 text-success font-medium">✅ Pronto! A conta estará 100% no seu nome.</p>
                </div>
              )}
            </div>

            {/* Button 3: Entrega Concluída */}
            <div className="rounded-xl border border-success/30 bg-success/5 overflow-hidden">
              <button
                onClick={() => setExpandedSection(expandedSection === "done" ? null : "done")}
                className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-success/10"
              >
                <CheckCircle className="h-4 w-4 text-success shrink-0" />
                <span className="flex-1 text-sm font-bold text-success">Entrega Concluída</span>
                {expandedSection === "done" ? <ChevronUp className="h-4 w-4 text-success/60" /> : <ChevronDown className="h-4 w-4 text-success/60" />}
              </button>
              {expandedSection === "done" && (
                <div className="border-t border-success/20 px-4 py-3 text-xs text-muted-foreground space-y-1.5 leading-relaxed">
                  <p className="text-foreground font-medium">📋 Checklist de segurança:</p>
                  <p>• Alterar a senha da conta Riot</p>
                  <p>• Trocar o email para o seu pessoal</p>
                  <p>• Alterar o Riot ID (nome + tag)</p>
                  <p>• Ativar verificação em duas etapas</p>
                  <p className="mt-2 text-muted-foreground">Se precisar de ajuda, envie uma mensagem aqui! 🙌</p>
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

  const renderMessageContent = (message: string, isStaff: boolean) => {
    // Check for credential card
    const trimmed = message.trim();
    if (trimmed.startsWith("[CREDENTIALS]") || trimmed.includes("[CREDENTIALS]")) {
      const jsonStr = trimmed.replace("[CREDENTIALS]", "").trim();
      if (jsonStr.startsWith("{")) {
        return renderCredentialCard(jsonStr);
      }
    }

    // Combined pattern for [IMAGE], Tutorial, Arquivo
    const combinedPattern = /(\[IMAGE\](https?:\/\/\S+))|(\[AUDIO\](https?:\/\/\S+))|((?:📖\s*\*\*Tutorial:\*\*|📎\s*\*\*Arquivo:\*\*)\s*(https?:\/\/\S+))/g;
    const parts: { type: "text" | "file" | "image" | "audio"; content: string; label?: string; url?: string }[] = [];
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
      return <p className={`text-sm leading-relaxed whitespace-pre-wrap ${isStaff ? "text-success" : "text-foreground"}`}>{message}</p>;
    }

    return (
      <div className="space-y-2">
        {parts.map((part, i) => {
          if (part.type === "text") {
            return <p key={i} className={`text-sm leading-relaxed whitespace-pre-wrap ${isStaff ? "text-success" : "text-foreground"}`}>{part.content}</p>;
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
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors ${isTutorial ? "bg-info/10 text-info group-hover:bg-info/20" : "bg-warning/10 text-warning group-hover:bg-warning/20"}`}>
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

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center pt-16">
          <Loader2 className="h-8 w-8 animate-spin text-success" />
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="mx-auto max-w-3xl px-6 pt-4 text-center">
          <Package className="mx-auto h-16 w-16 text-muted-foreground/20" />
          <h1 className="mt-4 text-xl font-bold text-foreground">Pedido não encontrado</h1>
          <button onClick={() => navigate("/dashboard?tab=purchases")} className="mt-4 text-sm text-success hover:underline">
            ← Voltar aos pedidos
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-7xl px-3 pt-4 pb-8">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-sm">
          <button
            onClick={() => navigate("/dashboard?tab=purchases")}
            className="flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-success"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Minhas Compras
          </button>
          <span className="text-muted-foreground/40">›</span>
          <span className="text-foreground font-medium">Pedido #{ticket.id.slice(0, 8).toUpperCase()}</span>
        </div>

        {/* Order Details - Horizontal Bar */}
        <div className="mb-6 rounded-xl border border-border bg-card p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-success shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pedido</p>
                <p className="text-sm font-bold font-mono text-foreground truncate">#{ticket.id.slice(0, 8).toUpperCase()}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-success shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Produto</p>
                <p className="text-sm font-bold text-foreground truncate">{productName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-success shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Plano</p>
                <p className="text-sm font-bold text-foreground truncate">{planName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-success shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Valor</p>
                <p className="text-sm font-bold text-foreground truncate">
                  {planPrice !== null ? `R$ ${planPrice.toFixed(2).replace(".", ",")}` : "—"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-success shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Data</p>
                <p className="text-sm font-bold text-foreground truncate">
                  {new Date(ticket.created_at).toLocaleDateString("pt-BR", {
                    day: "2-digit", month: "2-digit", year: "numeric"
                  })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-success shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pagamento</p>
                <p className="text-sm font-bold text-foreground truncate">PIX</p>
              </div>
            </div>
          </div>
        </div>

        {/* Chat - Full Width */}
        <div className="flex max-h-[700px] min-h-[450px] flex-col rounded-xl border border-border bg-card overflow-hidden">
          {/* Delivery banner inside chat */}
          {stockContent && (
            <>
              <button
                onClick={() => setExpandedSection(expandedSection === "delivery" ? null : "delivery")}
                className="w-full px-5 py-3 flex items-center gap-3 bg-success/10 border-b border-success/20 transition-colors hover:bg-success/15 text-left shrink-0"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-success/20 shrink-0">
                  <CheckCircle className="h-5 w-5 text-success" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground">Parabéns! Seu produto foi entregue 🎉</p>
                  <p className="text-[10px] text-muted-foreground">Clique para ver sua chave, tutorial e arquivos</p>
                </div>
                <div className={`flex h-7 w-7 items-center justify-center rounded-lg border border-success/30 bg-success/10 transition-transform duration-300 shrink-0 ${expandedSection === "delivery" ? "rotate-180" : ""}`}>
                  <ChevronDown className="h-3.5 w-3.5 text-success" />
                </div>
              </button>

              {expandedSection === "delivery" && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="border-b border-success/20 bg-background/50 shrink-0 overflow-y-auto max-h-[300px]"
                >
                  <div className="p-4 space-y-4">
                    {/* Product Key */}
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-success mb-2 flex items-center gap-1.5">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4"/><path d="m21 2-9.6 9.6"/><circle cx="7.5" cy="15.5" r="5.5"/></svg>
                        Chave do Produto
                      </p>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 rounded-xl border border-success/20 bg-card p-3">
                        <code className="flex-1 min-w-0 rounded-lg bg-secondary/50 px-3 py-2 text-sm font-mono text-foreground break-all">
                          {showKey ? (typeof stockContent === "string" ? stockContent : JSON.stringify(stockContent)) : "••••••••••••••••••••••••"}
                        </code>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); setShowKey(!showKey); }}
                            className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground hover:border-success/40"
                          >
                            {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            {showKey ? "Ocultar" : "Revelar"}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); copyKey(); }}
                            className="flex items-center gap-1 rounded-lg bg-success px-2.5 py-1.5 text-[11px] font-bold text-success-foreground transition-all hover:shadow-[0_0_20px_hsl(var(--success)/0.3)]"
                          >
                            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                            {copied ? "Copiado!" : "Copiar"}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Tutorial Text */}
                    {tutorialText && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <BookOpen className="h-4 w-4 text-success" />
                          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Tutorial</p>
                        </div>
                        <div className="rounded-xl border border-border bg-card p-4 text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                          {tutorialText}
                        </div>
                      </div>
                    )}

                    {/* Tutorial File */}
                    {tutorialFileUrl && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <FolderDown className="h-4 w-4 text-success" />
                          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Arquivo</p>
                        </div>
                        <a
                          href={tutorialFileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-all hover:border-success/40 hover:bg-success/5 group"
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning group-hover:bg-warning/20">
                            <FolderDown className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-foreground truncate">{getFileName(tutorialFileUrl)}</p>
                            <p className="text-[10px] text-muted-foreground">Clique para baixar</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="rounded bg-secondary px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">.{getFileExtension(tutorialFileUrl)}</span>
                            <Download className="h-4 w-4 text-muted-foreground group-hover:text-success transition-colors" />
                          </div>
                        </a>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </>
          )}
          {/* Chat Header */}
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <MessageSquare className="h-4 w-4 text-success" />
              <div>
                <span className="text-sm font-bold text-foreground">Chat do Pedido</span>
                <p className="text-[10px] text-muted-foreground">{messages.length} mensagen{messages.length !== 1 ? "s" : ""}</p>
              </div>
            </div>
            {/* Feedback button in header */}
            {!loadingReview && (
              existingReview ? (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} className={`h-3.5 w-3.5 ${star <= existingReview.rating ? "fill-warning text-warning" : "text-muted-foreground/30"}`} />
                    ))}
                  </div>
                  <span className="text-muted-foreground/60">Avaliado</span>
                </div>
              ) : (
                <button
                  onClick={() => setShowReviewModal(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-success/30 bg-success/5 px-3 py-1.5 text-xs font-medium text-success transition-colors hover:bg-success/10"
                >
                  <Star className="h-3.5 w-3.5" />
                  Gostaria de dar feedback?
                </button>
              )
            )}
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background/50 scrollbar-chat">
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center gap-3">
                <MessageSquare className="h-10 w-10 text-muted-foreground/20" />
                <p className="text-sm text-muted-foreground">Nenhuma mensagem ainda.</p>
                <p className="text-xs text-muted-foreground/60">Inicie a conversa abaixo.</p>
              </div>
            )}
            {messages.map((msg) => {
              const isStaff = msg.sender_role === "staff";
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex gap-3 ${isStaff ? "flex-row-reverse" : "flex-row"}`}
                >
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                    isStaff ? "text-success border border-success/30" : "text-muted-foreground border border-border"
                  }`}>
                    {isStaff ? "S" : "V"}
                  </div>
                  <div className={`space-y-1 max-w-[80%]`}>
                    <p className={`text-[10px] font-semibold ${isStaff ? "text-right text-success" : "text-left text-muted-foreground"}`}>
                      {isStaff ? "Staff" : "Você"}
                    </p>
                    <div className={`rounded-2xl px-5 py-3 ${
                      isStaff
                        ? "rounded-tr-sm bg-success/10 border border-success/20"
                        : "rounded-tl-sm bg-accent/50 border border-border"
                    }`}>
                      {renderMessageContent(msg.message, isStaff)}
                    </div>
                    <p className={`text-[10px] text-muted-foreground/60 ${isStaff ? "text-right" : "text-left"}`}>
                      {new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </motion.div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          {isLocked ? (
            <div className="border-t border-border px-5 py-4 flex items-center gap-2.5">
              <Lock className="h-4 w-4 text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground">
                Este pedido foi encerrado pelo staff — chat bloqueado.
              </p>
            </div>
          ) : (
            <>
              {/* Pending files preview */}
              {pendingFiles.length > 0 && (
                <div className="border-t border-border px-4 py-2 bg-secondary/30 flex gap-2 flex-wrap">
                  {pendingFiles.map((file, i) => (
                    <div key={i} className="relative group">
                      {file.type.startsWith("image/") ? (
                        <img src={previewUrls[i]} alt={file.name} className="h-16 w-16 rounded-lg object-cover border border-border" />
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
              <div className="border-t border-border p-3">
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
                    <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.txt,.doc,.docx,.zip,.rar" className="hidden" onChange={handleFileSelect} />
                    <button onClick={() => fileInputRef.current?.click()} disabled={uploadingFile} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all disabled:opacity-40" title="Anexar arquivo ou imagem">
                      <Paperclip className="h-[18px] w-[18px]" />
                    </button>
                    <textarea
                      value={newMessage}
                      onChange={(e) => { setNewMessage(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                      placeholder="Digite sua mensagem..."
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
              </div>
            </>
          )}
        </div>

        {/* Review Modal */}
        {showReviewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowReviewModal(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mx-4 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 mb-5">
                <Star className="h-5 w-5 text-success" />
                <h3 className="text-lg font-bold text-foreground">Avaliar Produto</h3>
              </div>

              <p className="text-sm text-muted-foreground mb-4">Como foi sua experiência com <strong className="text-foreground">{productName}</strong>?</p>

              <div className="flex items-center gap-1 mb-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setReviewRating(star)}
                    onMouseEnter={() => setReviewHover(star)}
                    onMouseLeave={() => setReviewHover(0)}
                    className="transition-transform hover:scale-110"
                  >
                    <Star
                      className={`h-8 w-8 ${
                        star <= (reviewHover || reviewRating)
                          ? "fill-warning text-warning"
                          : "text-muted-foreground/30"
                      }`}
                    />
                  </button>
                ))}
                {reviewRating > 0 && (
                  <span className="ml-3 text-sm font-medium text-muted-foreground">{reviewRating}/5</span>
                )}
              </div>

              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Deixe um comentário (opcional)..."
                rows={3}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors focus:border-success/40 resize-none mb-4"
              />

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowReviewModal(false)}
                  className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    await submitReview();
                    setShowReviewModal(false);
                  }}
                  disabled={!reviewRating || submittingReview}
                  className="flex-1 rounded-xl bg-success px-4 py-2.5 text-sm font-bold text-success-foreground transition-all disabled:opacity-30 hover:shadow-[0_0_20px_hsl(var(--success)/0.3)]"
                >
                  {submittingReview ? <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> : null}
                  Enviar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PedidoChat;
