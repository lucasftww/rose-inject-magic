import { useState } from "react";
import Header from "@/components/Header";
import {
  ShieldAlert, Gamepad2, Mail, Package, Tag, UserCheck, TrendingUp,
  Key, CreditCard, BarChart3, ShoppingBag, Globe, Shield, Users,
  ChevronRight
} from "lucide-react";
import ProductsTab from "@/components/admin/ProductsTab";
import CouponsTab from "@/components/admin/CouponsTab";
import StatusTab from "@/components/admin/StatusTab";
import StockTab from "@/components/admin/StockTab";
import ResellersTab from "@/components/admin/ResellersTab";
import TicketsTab from "@/components/admin/TicketsTab";
import OverviewTab from "@/components/admin/OverviewTab";
import CredentialsTab from "@/components/admin/CredentialsTab";
import LztTab from "@/components/admin/LztTab";
import PaymentsTab from "@/components/admin/PaymentsTab";
import FinanceTab from "@/components/admin/FinanceTab";
import ScratchCardTab from "@/components/admin/ScratchCardTab";
import SalesTab from "@/components/admin/SalesTab";
import GamesTab from "@/components/admin/GamesTab";
import RobotProjectTab from "@/components/admin/RobotProjectTab";
import UsersTab from "@/components/admin/UsersTab";

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

const AdminPanel = () => {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [pendingTicketId, setPendingTicketId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleGoToTicket = (ticketId: string) => {
    setPendingTicketId(ticketId);
    setActiveTab("tickets");
  };

  const activeLabel = tabGroups.flatMap(g => g.tabs).find(t => t.id === activeTab)?.label || "";

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex">
        {/* Sidebar */}
        <aside className={`sticky top-0 h-[calc(100vh-64px)] shrink-0 border-r border-border bg-card/50 backdrop-blur-sm transition-all duration-300 overflow-y-auto ${sidebarOpen ? "w-56" : "w-14"}`}>
          {/* Brand */}
          <div className="flex items-center gap-2 px-4 py-5 border-b border-border">
            <ShieldAlert className="h-5 w-5 text-success shrink-0" />
            {sidebarOpen && (
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-success truncate">Admin</span>
            )}
            <button
              onClick={() => setSidebarOpen(v => !v)}
              className="ml-auto rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <ChevronRight className={`h-4 w-4 transition-transform duration-300 ${sidebarOpen ? "rotate-180" : ""}`} />
            </button>
          </div>

          {/* Nav Groups */}
          <nav className="py-3 space-y-1">
            {tabGroups.map((group) => (
              <div key={group.label}>
                {sidebarOpen && (
                  <p className="px-4 pt-4 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/60">
                    {group.label}
                  </p>
                )}
                {group.tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      title={!sidebarOpen ? tab.label : undefined}
                      className={`group flex w-full items-center gap-2.5 px-4 py-2 text-sm font-medium transition-all duration-200 relative
                        ${isActive
                          ? "text-success bg-success/10"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                        }`}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-success" />
                      )}
                      <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-success" : "text-muted-foreground group-hover:text-foreground"}`} />
                      {sidebarOpen && <span className="truncate">{tab.label}</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 px-6 lg:px-10 pt-6 pb-20">
          {/* Page Title */}
          <div className="mb-8">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Administração</p>
            <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Valorant', sans-serif" }}>
              {activeLabel.toUpperCase()}
            </h1>
          </div>

          {/* Tab Content */}
          <div>
            {activeTab === "overview" && <OverviewTab onGoToTicket={handleGoToTicket} />}
            {activeTab === "jogos" && <GamesTab />}
            {activeTab === "produtos" && <ProductsTab />}
            {activeTab === "estoque" && <StockTab />}
            {activeTab === "robot" && <RobotProjectTab />}
            {activeTab === "revendedores" && <ResellersTab />}
            {activeTab === "tickets" && <TicketsTab initialTicketId={pendingTicketId} onTicketOpened={() => setPendingTicketId(null)} />}
            {activeTab === "status" && <StatusTab />}
            {activeTab === "cupons" && <CouponsTab />}
            {activeTab === "usuarios" && <UsersTab onGoToTicket={handleGoToTicket} />}
            {activeTab === "credenciais" && <CredentialsTab />}
            {activeTab === "lzt" && <LztTab />}
            {activeTab === "vendas" && <SalesTab onGoToTicket={handleGoToTicket} />}
            {activeTab === "pagamentos" && <PaymentsTab />}
            {activeTab === "financeiro" && <FinanceTab />}
            {activeTab === "raspadinha" && <ScratchCardTab />}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminPanel;
