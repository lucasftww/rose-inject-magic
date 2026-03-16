import { useState, lazy, Suspense, useCallback, memo, useTransition } from "react";
import {
  ShieldAlert, Gamepad2, Mail, Package, Tag, UserCheck, TrendingUp,
  Key, CreditCard, BarChart3, ShoppingBag, Globe, Shield, Users,
  ChevronRight, Menu, Loader2
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

/* Lazy-load all tabs */
const OverviewTab = lazy(() => import("@/components/admin/OverviewTab"));
const FinanceTab = lazy(() => import("@/components/admin/FinanceTab"));
const GamesTab = lazy(() => import("@/components/admin/GamesTab"));
const ProductsTab = lazy(() => import("@/components/admin/ProductsTab"));
const StockTab = lazy(() => import("@/components/admin/StockTab"));
const LztTab = lazy(() => import("@/components/admin/LztTab"));
const RobotProjectTab = lazy(() => import("@/components/admin/RobotProjectTab"));
const SalesTab = lazy(() => import("@/components/admin/SalesTab"));
const PaymentsTab = lazy(() => import("@/components/admin/PaymentsTab"));
const CouponsTab = lazy(() => import("@/components/admin/CouponsTab"));
const ScratchCardTab = lazy(() => import("@/components/admin/ScratchCardTab"));
const TicketsTab = lazy(() => import("@/components/admin/TicketsTab"));
const StatusTab = lazy(() => import("@/components/admin/StatusTab"));
const UsersTab = lazy(() => import("@/components/admin/UsersTab"));
const ResellersTab = lazy(() => import("@/components/admin/ResellersTab"));
const CredentialsTab = lazy(() => import("@/components/admin/CredentialsTab"));

type TabId = "overview" | "financeiro" | "jogos" | "produtos" | "estoque" | "lzt" | "robot" | "vendas" | "pagamentos" | "cupons" | "raspadinha" | "tickets" | "status" | "usuarios" | "revendedores" | "credenciais";

interface TabItem { id: TabId; label: string; icon: React.ComponentType<{ className?: string }>; }
interface TabGroup { label: string; tabs: TabItem[]; }

const tabGroups: TabGroup[] = [
  {
    label: "Principal",
    tabs: [
      { id: "overview", label: "Overview", icon: TrendingUp },
      { id: "financeiro", label: "Financeiro", icon: BarChart3 },
    ],
  },
  {
    label: "Catálogo",
    tabs: [
      { id: "jogos", label: "Jogos", icon: Gamepad2 },
      { id: "produtos", label: "Produtos", icon: Package },
      { id: "estoque", label: "Estoque", icon: Package },
      { id: "lzt", label: "LZT Market", icon: Globe },
      { id: "robot", label: "Robot Project", icon: Key },
    ],
  },
  {
    label: "Vendas",
    tabs: [
      { id: "vendas", label: "Vendas", icon: ShoppingBag },
      { id: "pagamentos", label: "Pagamentos", icon: CreditCard },
      { id: "cupons", label: "Cupons", icon: Tag },
      { id: "raspadinha", label: "Raspadinha", icon: Gamepad2 },
    ],
  },
  {
    label: "Suporte",
    tabs: [
      { id: "tickets", label: "Tickets", icon: Mail },
      { id: "status", label: "Status", icon: Shield },
    ],
  },
  {
    label: "Sistema",
    tabs: [
      { id: "usuarios", label: "Usuários", icon: Users },
      { id: "revendedores", label: "Revendedores", icon: UserCheck },
      { id: "credenciais", label: "Credenciais", icon: Key },
    ],
  },
];

const TabFallback = () => (
  <div className="flex items-center justify-center py-20">
    <Loader2 className="h-6 w-6 animate-spin text-success" />
  </div>
);

/* Memoized nav to avoid re-renders on tab content changes */
const SidebarNav = memo(({
  activeTab,
  onSelect,
  collapsed = false,
}: {
  activeTab: TabId;
  onSelect: (id: TabId) => void;
  collapsed?: boolean;
}) => (
  <nav className="py-3 space-y-0.5">
    {tabGroups.map((group) => (
      <div key={group.label}>
        {!collapsed && (
          <p className="px-4 pt-5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/50 select-none">
            {group.label}
          </p>
        )}
        {collapsed && <div className="pt-3" />}
        {group.tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelect(tab.id)}
              title={collapsed ? tab.label : undefined}
              className={`group flex w-full items-center gap-2.5 text-sm font-medium relative
                ${collapsed ? "justify-center px-2 py-2.5 mx-auto" : "px-4 py-2"}
                ${isActive
                  ? "text-success bg-success/8"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                }`}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-success" />
              )}
              <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-success" : "text-muted-foreground"}`} />
              {!collapsed && <span className="truncate">{tab.label}</span>}
            </button>
          );
        })}
      </div>
    ))}
  </nav>
));
SidebarNav.displayName = "SidebarNav";

const AdminPanel = () => {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [pendingTicketId, setPendingTicketId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [, startTransition] = useTransition();

  const handleGoToTicket = useCallback((ticketId: string) => {
    setPendingTicketId(ticketId);
    startTransition(() => setActiveTab("tickets"));
  }, []);

  const handleTabSelect = useCallback((id: TabId) => {
    startTransition(() => setActiveTab(id));
    setMobileOpen(false);
  }, []);

  const handleTicketOpened = useCallback(() => setPendingTicketId(null), []);

  const activeLabel = tabGroups.flatMap(g => g.tabs).find(t => t.id === activeTab)?.label || "";

  return (
    <div className="min-h-screen bg-background">

      {/* Mobile Sheet Sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 p-0 bg-card border-r border-border">
          <SheetHeader className="px-4 py-4 border-b border-border">
            <SheetTitle className="flex items-center gap-2 text-sm">
              <ShieldAlert className="h-4 w-4 text-success" />
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-success">Admin</span>
            </SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto h-[calc(100%-60px)] scrollbar-hide">
            <SidebarNav activeTab={activeTab} onSelect={handleTabSelect} />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex">
        {/* Desktop Sidebar */}
        <aside
          className={`hidden lg:flex flex-col fixed top-0 left-0 bottom-0 shrink-0 border-r border-border bg-card z-30 ${sidebarOpen ? "w-56" : "w-14"}`}
        >
          <div className="flex items-center gap-2 px-3 py-3 border-b border-border min-h-[48px]">
            <ShieldAlert className="h-4 w-4 text-success shrink-0" />
            {sidebarOpen && (
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-success truncate">Painel Admin</span>
            )}
            <button
              onClick={() => setSidebarOpen(v => !v)}
              className="ml-auto rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <ChevronRight className={`h-3.5 w-3.5 transition-transform duration-200 ${sidebarOpen ? "rotate-180" : ""}`} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            <SidebarNav activeTab={activeTab} onSelect={handleTabSelect} collapsed={!sidebarOpen} />
          </div>
        </aside>

        {/* Main Content — offset by sidebar width */}
        <main className={`flex-1 min-w-0 transition-[margin] duration-200 ${sidebarOpen ? "lg:ml-56" : "lg:ml-14"}`}>
          {/* Top bar */}
          <div className="sticky top-0 z-20 flex items-center gap-3 px-4 lg:px-8 py-3 border-b border-border bg-background/80 backdrop-blur-md">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">Administração</p>
              <h1 className="text-base sm:text-lg font-bold text-foreground truncate" style={{ fontFamily: "'Valorant', sans-serif" }}>
                {activeLabel.toUpperCase()}
              </h1>
            </div>
          </div>

          {/* Tab Content — each tab lazy-loaded */}
          <div className="px-3 sm:px-5 lg:px-8 py-5 lg:py-6">
            <Suspense fallback={<TabFallback />}>
              {activeTab === "overview" && <OverviewTab onGoToTicket={handleGoToTicket} />}
              {activeTab === "jogos" && <GamesTab />}
              {activeTab === "produtos" && <ProductsTab />}
              {activeTab === "estoque" && <StockTab />}
              {activeTab === "robot" && <RobotProjectTab />}
              {activeTab === "revendedores" && <ResellersTab />}
              {activeTab === "tickets" && <TicketsTab initialTicketId={pendingTicketId} onTicketOpened={handleTicketOpened} />}
              {activeTab === "status" && <StatusTab />}
              {activeTab === "cupons" && <CouponsTab />}
              {activeTab === "usuarios" && <UsersTab onGoToTicket={handleGoToTicket} />}
              {activeTab === "credenciais" && <CredentialsTab />}
              {activeTab === "lzt" && <LztTab />}
              {activeTab === "vendas" && <SalesTab onGoToTicket={handleGoToTicket} />}
              {activeTab === "pagamentos" && <PaymentsTab />}
              {activeTab === "financeiro" && <FinanceTab />}
              {activeTab === "raspadinha" && <ScratchCardTab />}
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminPanel;
