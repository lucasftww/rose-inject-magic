import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, Users, Mail, Calendar, Clock, Search, Shield, Ban, ShieldCheck,
  ShieldOff, Globe, RefreshCw, X, Package, Tag
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface RecentPayment {
  amount: number; status: string; created_at: string;
  cart_snapshot: { productName?: string; planName?: string; quantity?: number }[];
}

interface UserOrder {
  id: string; product_name: string; product_image: string | null;
  plan_name: string; plan_price: number; status: string; status_label: string;
  created_at: string; stock_content: string | null;
}

interface UserData {
  id: string; email: string; created_at: string; last_sign_in_at: string | null;
  email_confirmed_at: string | null; username: string | null; avatar_url: string | null;
  banned: boolean; banned_at: string | null; banned_reason: string | null;
  roles: string[]; provider: string;
  login_ips: { ip_address: string; logged_at: string }[];
  total_spent: number; total_orders: number;
  recent_payments: RecentPayment[];
  orders: UserOrder[];
}

const InfoCard = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="rounded-lg border border-border bg-secondary/30 p-3">
    <div className="flex items-center gap-1.5 mb-1">{icon}<span className="text-[10px] font-medium text-muted-foreground">{label}</span></div>
    <p className="text-sm font-semibold text-foreground">{value}</p>
  </div>
);

const UsersTab = ({ onGoToTicket }: { onGoToTicket?: (ticketId: string) => void }) => {
  const { user: currentUser } = useAuth();
  const { users: adminUsersRaw, loading: loadingAdminUsers, fetchUsers: refetchAdminUsers } = useAdminUsers();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [banReason, setBanReason] = useState("");
  const [showBanDialog, setShowBanDialog] = useState<UserData | null>(null);
  const [showOrdersUser, setShowOrdersUser] = useState<UserData | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [userPage, setUserPage] = useState(1);
  const USERS_PER_PAGE = 50;

  useEffect(() => {
    if (!loadingAdminUsers) {
      setUsers(adminUsersRaw as UserData[]);
      setLoadingUsers(false);
    }
  }, [adminUsersRaw, loadingAdminUsers]);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    await refetchAdminUsers(true);
  };

  const executeAction = async (action: string, targetUserId: string, reason?: string) => {
    setActionLoading(action + targetUserId);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setActionLoading(null); toast({ title: "Sessão expirada", description: "Faça login novamente.", variant: "destructive" }); return; }
    const res = await supabase.functions.invoke("admin-users", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: { action, target_user_id: targetUserId, reason },
    });
    if (res.error || res.data?.error) {
      toast({ title: "Erro", description: res.data?.error || String(res.error), variant: "destructive" });
    } else {
      toast({ title: res.data.message });
      await fetchUsers();
      if (selectedUser?.id === targetUserId) {
        setSelectedUser(null);
      }
    }
    setActionLoading(null);
  };

  const handleBan = async () => {
    if (!showBanDialog) return;
    await executeAction("ban", showBanDialog.id, banReason || "Banido pelo admin");
    setShowBanDialog(null);
    setBanReason("");
  };

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const filtered = users.filter((u) => {
    if (filterStatus === "banned" && !u.banned) return false;
    if (filterStatus === "admin" && !u.roles.includes("admin")) return false;
    if (filterStatus === "normal" && (u.banned || u.roles.includes("admin"))) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return u.email.toLowerCase().includes(q) || (u.username && u.username.toLowerCase().includes(q));
    }
    return true;
  });

  const totalUserPages = Math.max(1, Math.ceil(filtered.length / USERS_PER_PAGE));
  const paginatedUsers = filtered.slice((userPage - 1) * USERS_PER_PAGE, userPage * USERS_PER_PAGE);

  // Reset page when filters change
  useEffect(() => { setUserPage(1); }, [searchQuery, filterStatus]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">Usuários ({users.length})</h2>
        <button onClick={fetchUsers} className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:border-success hover:text-success">
          <RefreshCw className="h-3 w-3" /> Atualizar
        </button>
      </div>

      <div className="relative mt-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input type="text" placeholder="Buscar por email ou username..." value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value.slice(0, 100))}
          className="w-full rounded-lg border border-border bg-secondary/50 py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-success/50" />
      </div>

      <div className="flex gap-2 mt-3">
        {[
          { value: "all", label: "Todos" },
          { value: "admin", label: "Admins" },
          { value: "banned", label: "Banidos" },
          { value: "normal", label: "Normal" },
        ].map((f) => (
          <button key={f.value} onClick={() => setFilterStatus(f.value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${filterStatus === f.value ? "bg-success/20 text-success border border-success/30" : "bg-secondary/50 text-muted-foreground border border-border hover:text-foreground"}`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Ban dialog */}
      {showBanDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowBanDialog(null)}>
          <div className="mx-4 w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-destructive flex items-center gap-2"><Ban className="h-5 w-5" /> Banir Usuário</h3>
            <p className="mt-2 text-sm text-muted-foreground">Banir <strong className="text-foreground">{showBanDialog.email}</strong>?</p>
            <div className="mt-4">
              <label className="text-xs font-medium text-muted-foreground">Motivo (opcional)</label>
              <input type="text" value={banReason} onChange={(e) => setBanReason(e.target.value.slice(0, 200))} placeholder="Ex: Violação dos termos"
                className="mt-1 w-full rounded-lg border border-border bg-secondary/50 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-destructive/50" />
            </div>
            <div className="mt-6 flex gap-3">
              <button onClick={handleBan} disabled={actionLoading !== null}
                className="flex items-center gap-2 rounded-lg bg-destructive px-6 py-2.5 text-sm font-semibold text-destructive-foreground disabled:opacity-50">
                {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />} Banir
              </button>
              <button onClick={() => { setShowBanDialog(null); setBanReason(""); }}
                className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* User detail modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setSelectedUser(null)}>
          <div className="mx-4 w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground">Detalhes do Usuário</h3>
              <button onClick={() => setSelectedUser(null)} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
            </div>

            <div className="mt-5 space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary border border-border shrink-0">
                  {selectedUser.avatar_url ? <img src={selectedUser.avatar_url} className="h-14 w-14 rounded-full object-cover" /> : <Users className="h-6 w-6 text-muted-foreground" />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-base font-bold text-foreground truncate">{selectedUser.username || "Sem username"}</p>
                    {selectedUser.banned && <span className="rounded bg-destructive/20 px-1.5 py-0.5 text-[10px] font-bold text-destructive">BANIDO</span>}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{selectedUser.email}</p>
                </div>
              </div>

              {selectedUser.banned && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <p className="text-xs font-bold text-destructive">Banido em: {formatDate(selectedUser.banned_at)}</p>
                  {selectedUser.banned_reason && <p className="mt-1 text-xs text-muted-foreground">Motivo: {selectedUser.banned_reason}</p>}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <InfoCard icon={<Calendar className="h-4 w-4 text-success" />} label="Criado em" value={formatDate(selectedUser.created_at)} />
                <InfoCard icon={<Clock className="h-4 w-4 text-success" />} label="Último login" value={formatDate(selectedUser.last_sign_in_at)} />
                <InfoCard icon={<Mail className="h-4 w-4 text-success" />} label="Email confirmado" value={selectedUser.email_confirmed_at ? "Sim" : "Não"} />
                <InfoCard icon={<Shield className="h-4 w-4 text-success" />} label="Provider" value={selectedUser.provider} />
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Roles</p>
                <div className="flex gap-2">
                  {selectedUser.roles.length > 0 ? selectedUser.roles.map((r) => (
                    <span key={r} className="rounded bg-success/20 px-2 py-0.5 text-xs font-bold text-success">{r}</span>
                  )) : <span className="text-xs text-muted-foreground">Nenhuma role</span>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <InfoCard icon={<Tag className="h-4 w-4 text-success" />} label="Total Gasto" value={`R$ ${(selectedUser.total_spent / 100).toFixed(2)}`} />
                <InfoCard icon={<Package className="h-4 w-4 text-success" />} label="Total de Pedidos" value={String(selectedUser.total_orders)} />
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 text-success" /> Últimas 5 Vendas
                </p>
                {selectedUser.recent_payments.length > 0 ? (
                  <div className="space-y-1.5">
                    {selectedUser.recent_payments.map((p, i) => (
                      <div key={i} className="flex items-center justify-between rounded bg-secondary/50 px-3 py-2 border border-border">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-foreground truncate">
                            {p.cart_snapshot?.[0]?.productName || "Produto"}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {p.cart_snapshot?.[0]?.planName || "—"} · {new Date(p.created_at).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                        <div className="flex flex-col items-end shrink-0 ml-2">
                          <span className="text-xs font-bold text-foreground">R$ {(p.amount / 100).toFixed(2)}</span>
                          <span className={`text-[10px] font-bold ${p.status === "COMPLETED" ? "text-success" : p.status === "ACTIVE" ? "text-warning" : "text-muted-foreground"}`}>
                            {p.status === "COMPLETED" ? "Pago" : p.status === "ACTIVE" ? "Pendente" : p.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-xs text-muted-foreground">Nenhuma venda registrada</p>}
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-success" /> IP de Login
                </p>
                {selectedUser.login_ips.length > 0 ? (
                  <div className="space-y-1.5">
                    {selectedUser.login_ips.map((ip, i) => (
                      <div key={i} className="flex items-center justify-between rounded bg-secondary/50 px-3 py-1.5 border border-border">
                        <span className="text-xs font-mono text-foreground">{ip.ip_address}</span>
                        <span className="text-[10px] text-muted-foreground">{formatDate(ip.logged_at)}</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-xs text-muted-foreground">Nenhum IP registrado ainda</p>}
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">ID</p>
                <p className="rounded bg-secondary px-3 py-1.5 text-xs font-mono text-muted-foreground break-all">{selectedUser.id}</p>
              </div>

              <div className="border-t border-border pt-4">
                <p className="text-xs font-medium text-muted-foreground mb-3">Ações</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setShowOrdersUser(selectedUser)}
                    className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/50 px-4 py-2 text-xs font-medium text-foreground hover:border-success/30 hover:bg-secondary"
                  >
                    <Package className="h-3.5 w-3.5" /> Ver Pedidos ({selectedUser.orders?.length || 0})
                  </button>
                  {selectedUser.id !== currentUser?.id && (
                    selectedUser.banned ? (
                      <button
                        onClick={() => { executeAction("unban", selectedUser.id); setSelectedUser(null); }}
                        disabled={actionLoading !== null}
                        className="flex items-center gap-1.5 rounded-lg border border-success/30 bg-success/10 px-4 py-2 text-xs font-medium text-success hover:bg-success/20 disabled:opacity-50"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" /> Desbanir
                      </button>
                    ) : (
                      <button
                        onClick={() => { setSelectedUser(null); setShowBanDialog(selectedUser); }}
                        disabled={actionLoading !== null}
                        className="flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-xs font-medium text-destructive hover:bg-destructive/20 disabled:opacity-50"
                      >
                        <Ban className="h-3.5 w-3.5" /> Banir
                      </button>
                    )
                  )}
                  {selectedUser.id !== currentUser?.id && (
                    selectedUser.roles.includes("admin") ? (
                      <button
                        onClick={() => { executeAction("remove_admin", selectedUser.id); setSelectedUser(null); }}
                        disabled={actionLoading !== null}
                        className="flex items-center gap-1.5 rounded-lg border border-warning/30 bg-warning/10 px-4 py-2 text-xs font-medium text-warning hover:bg-warning/20 disabled:opacity-50"
                      >
                        <ShieldOff className="h-3.5 w-3.5" /> Remover Admin
                      </button>
                    ) : (
                      <button
                        onClick={() => { executeAction("add_admin", selectedUser.id); setSelectedUser(null); }}
                        disabled={actionLoading !== null}
                        className="flex items-center gap-1.5 rounded-lg border border-success/30 bg-success/10 px-4 py-2 text-xs font-medium text-success hover:bg-success/20 disabled:opacity-50"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" /> Tornar Admin
                      </button>
                    )
                  )}
                  {selectedUser.id === currentUser?.id && (
                    <p className="text-xs text-muted-foreground italic">Você não pode executar ações em si mesmo</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Users list */}
      <div className="mt-4 space-y-2">
        {loadingUsers ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-success" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-20 text-muted-foreground">
            <Users className="h-10 w-10 mb-3 opacity-40" /><p className="font-semibold">Nenhum usuário encontrado</p>
          </div>
        ) : paginatedUsers.map((u) => (
          <button key={u.id} onClick={() => setSelectedUser(u)}
            className="flex w-full items-center gap-4 rounded-lg border border-border bg-card p-4 text-left hover:border-success/30">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary border border-border">
              {u.avatar_url ? <img src={u.avatar_url} className="h-10 w-10 rounded-full object-cover" /> : <Users className="h-4 w-4 text-muted-foreground" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-foreground truncate">{u.username || u.email.split("@")[0]}</p>
                {u.roles.includes("admin") && <span className="rounded bg-success/20 px-1.5 py-0.5 text-[10px] font-bold text-success">Admin</span>}
                {u.banned && <span className="rounded bg-destructive/20 px-1.5 py-0.5 text-[10px] font-bold text-destructive">Banido</span>}
              </div>
              <p className="text-xs text-muted-foreground truncate">{u.email}</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[10px] text-success font-semibold">R$ {(u.total_spent / 100).toFixed(2)}</span>
                <span className="text-[10px] text-muted-foreground">{u.total_orders} pedido{u.total_orders !== 1 ? "s" : ""}</span>
              </div>
            </div>
            <div className="hidden sm:flex flex-col items-end gap-0.5 shrink-0">
              <p className="text-[10px] text-muted-foreground">Criado: {formatDate(u.created_at)}</p>
              <p className="text-[10px] text-muted-foreground">Login: {formatDate(u.last_sign_in_at)}</p>
              {u.login_ips.length > 0 && <p className="text-[10px] font-mono text-muted-foreground/60">{u.login_ips[0].ip_address}</p>}
            </div>
          </button>
        ))}
      </div>

      {/* Pagination */}
      {totalUserPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-muted-foreground">
            Mostrando {((userPage - 1) * USERS_PER_PAGE) + 1}–{Math.min(userPage * USERS_PER_PAGE, filtered.length)} de {filtered.length}
          </p>
          <div className="flex gap-1">
            <button onClick={() => setUserPage(p => Math.max(1, p - 1))} disabled={userPage === 1}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40">
              Anterior
            </button>
            <span className="flex items-center px-3 text-xs text-muted-foreground">{userPage}/{totalUserPages}</span>
            <button onClick={() => setUserPage(p => Math.min(totalUserPages, p + 1))} disabled={userPage === totalUserPages}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40">
              Próximo
            </button>
          </div>
        </div>
      )}

      {/* Orders Modal */}
      {showOrdersUser && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowOrdersUser(null)}>
          <div className="relative mx-4 max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowOrdersUser(null)} className="absolute right-3 top-3 rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground">
              <X className="h-4 w-4" />
            </button>

            <h3 className="text-base font-bold text-foreground mb-1 flex items-center gap-2">
              <Package className="h-4 w-4 text-success" />
              Pedidos de {showOrdersUser.username || showOrdersUser.email.split("@")[0]}
            </h3>
            <p className="text-xs text-muted-foreground mb-4">{showOrdersUser.orders?.length || 0} pedido(s)</p>

            {(!showOrdersUser.orders || showOrdersUser.orders.length === 0) ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhum pedido encontrado.</p>
            ) : (
              <div className="space-y-3">
                {showOrdersUser.orders.map((order) => {
                  const statusColor = order.status === "delivered" ? "text-info bg-info/20"
                    : order.status === "open" ? "text-success bg-success/20"
                    : order.status === "waiting_staff" ? "text-warning bg-warning/20"
                    : order.status === "resolved" ? "text-positive bg-positive/20"
                    : "text-muted-foreground bg-muted";

                  const statusLabel = order.status === "waiting_staff" ? "Aguardando" : order.status_label;

                  return (
                    <div
                      key={order.id}
                      onClick={() => onGoToTicket?.(order.id)}
                      className="rounded-lg border border-border bg-secondary/30 p-4 space-y-2 cursor-pointer hover:border-success/30"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          {order.product_image && (
                            <img src={order.product_image} className="h-8 w-8 rounded object-cover shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{order.product_name}</p>
                            <p className="text-[10px] text-muted-foreground">{order.plan_name} · R$ {Number(order.plan_price).toFixed(2)}</p>
                          </div>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0 ${statusColor}`}>
                          {statusLabel}
                        </span>
                      </div>

                      <p className="text-[10px] text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>

                      {order.stock_content && (
                        <div className="rounded bg-background border border-border p-2">
                          <p className="text-[10px] font-medium text-muted-foreground mb-1">🔑 Chave Entregue:</p>
                          <p className="text-xs font-mono text-foreground break-all select-all">{typeof order.stock_content === "string" ? order.stock_content : JSON.stringify(order.stock_content)}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersTab;
