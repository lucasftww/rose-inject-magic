import { useState } from "react";
import Header from "@/components/Header";
import {
  ShieldAlert, Gamepad2, Mail, Package, Tag, UserCheck, TrendingUp,
  Key, CreditCard, BarChart3, ShoppingBag, Globe, Shield, Users
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

const tabs = [
  { id: "overview", label: "Overview", icon: TrendingUp },
  { id: "financeiro", label: "Financeiro", icon: BarChart3 },
  { id: "jogos", label: "Jogos", icon: Gamepad2 },
  { id: "produtos", label: "Produtos", icon: Package },
  { id: "lzt", label: "LZT Market", icon: Globe },
  { id: "robot", label: "Robot Project", icon: Key },
  { id: "estoque", label: "Estoque", icon: Package },
  { id: "revendedores", label: "Revendedores", icon: UserCheck },
  { id: "tickets", label: "Tickets", icon: Mail },
  { id: "status", label: "Status", icon: Shield },
  { id: "cupons", label: "Cupons", icon: Tag },
  { id: "usuarios", label: "Usuários", icon: Users },
  { id: "credenciais", label: "Credenciais", icon: Key },
  { id: "vendas", label: "Vendas", icon: ShoppingBag },
  { id: "pagamentos", label: "Pagamentos", icon: CreditCard },
  { id: "raspadinha", label: "Raspadinha", icon: Gamepad2 },
] as const;
type TabId = typeof tabs[number]["id"];

const AdminPanel = () => {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [pendingTicketId, setPendingTicketId] = useState<string | null>(null);

  const handleGoToTicket = (ticketId: string) => {
    setPendingTicketId(ticketId);
    setActiveTab("tickets");
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-7xl px-6 pt-4 pb-20">
        <div className="flex items-center gap-2 mb-2">
          <ShieldAlert className="h-5 w-5 text-success" />
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-success">Administração</p>
        </div>
        <h1 className="text-3xl font-bold text-foreground" style={{ fontFamily: "'Valorant', sans-serif" }}>PAINEL ADMIN</h1>

        <div className="mt-8">
          <div className="flex flex-wrap gap-1 border-b border-border">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-xs font-medium transition-colors ${activeTab === tab.id ? "border-success text-success" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                  <Icon className="h-3.5 w-3.5" />{tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-8">
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
      </div>
    </div>
  );
};

export default AdminPanel;
