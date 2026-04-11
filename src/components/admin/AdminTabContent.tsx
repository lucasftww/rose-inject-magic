import type { TabId } from "./adminTabIds";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import {
  OverviewTab,
  FinanceTab,
  GamesTab,
  ProductsTab,
  StockTab,
  LztTab,
  RobotProjectTab,
  SalesTab,
  PaymentsTab,
  PaymentsListTab,
  CouponsTab,
  ScratchCardTab,
  TicketsTab,
  StatusTab,
  UsersTab,
  ResellersTab,
  CredentialsTab,
} from "./adminLazyTabs";

export const TabFallback = () => (
  <div className="flex min-h-[40vh] items-center justify-center py-16">
    <Loader2 className="h-6 w-6 animate-spin text-success" />
  </div>
);

type Props = {
  activeTab: TabId;
  onGoToTicket: (ticketId: string) => void;
  pendingTicketId: string | null;
  onTicketOpened: () => void;
};

/**
 * Only the active admin tab is mounted — saves CPU/network (e.g. Tickets realtime) when browsing other sections.
 */
export function AdminTabContent({ activeTab, onGoToTicket, pendingTicketId, onTicketOpened }: Props) {
  switch (activeTab) {
    case "overview":
      return <OverviewTab onGoToTicket={onGoToTicket} />;
    case "financeiro":
      return <FinanceTab />;
    case "jogos":
      return <GamesTab />;
    case "produtos":
      return <ProductsTab />;
    case "estoque":
      return <StockTab />;
    case "lzt":
      return <LztTab />;
    case "robot":
      return <RobotProjectTab />;
    case "vendas":
      return <SalesTab onGoToTicket={onGoToTicket} />;
    case "pix_historico":
      return <PaymentsListTab />;
    case "pagamentos":
      return <PaymentsTab />;
    case "cupons":
      return <CouponsTab />;
    case "raspadinha":
      return <ScratchCardTab />;
    case "tickets":
      return <TicketsTab initialTicketId={pendingTicketId} onTicketOpened={onTicketOpened} />;
    case "status":
      return <StatusTab />;
    case "usuarios":
      return <UsersTab onGoToTicket={onGoToTicket} />;
    case "revendedores":
      return <ResellersTab />;
    case "credenciais":
      return <CredentialsTab />;
    default:
      return null;
  }
}

export function AdminTabPanel(props: Props) {
  return (
    <Suspense fallback={<TabFallback />}>
      <AdminTabContent {...props} />
    </Suspense>
  );
}
