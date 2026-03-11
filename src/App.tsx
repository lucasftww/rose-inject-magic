import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { CartProvider } from "@/hooks/useCart";
import Index from "./pages/Index";
import Produtos from "./pages/Produtos";
import ProdutoDetalhes from "./pages/ProdutoDetalhes";
import Contas from "./pages/Contas";
import ContaDetalhes from "./pages/ContaDetalhes";
import LolDetalhes from "./pages/LolDetalhes";
import FortniteDetalhes from "./pages/FortniteDetalhes";
import MinecraftDetalhes from "./pages/MinecraftDetalhes";
import Status from "./pages/Status";
import AdminPanel from "./pages/AdminPanel";
import Dashboard from "./pages/Dashboard";
import Avaliacoes from "./pages/Avaliacoes";
import MeusPedidos from "./pages/MeusPedidos";
import PedidoChat from "./pages/PedidoChat";
import Checkout from "./pages/Checkout";
import NotFound from "./pages/NotFound";
import Raspadinha from "./pages/Raspadinha";
import TermosDeUso from "./pages/TermosDeUso";
import PoliticaPrivacidade from "./pages/PoliticaPrivacidade";
import PoliticaReembolso from "./pages/PoliticaReembolso";
import Garantia from "./pages/Garantia";
import CentralAjuda from "./pages/CentralAjuda";

const queryClient = new QueryClient({});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <CartProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/produtos" element={<Produtos />} />
              <Route path="/produto/:id" element={<ProdutoDetalhes />} />
              <Route path="/contas" element={<Contas />} />
              <Route path="/conta/:id" element={<ContaDetalhes />} />
              <Route path="/lol/:id" element={<LolDetalhes />} />
              <Route path="/fortnite/:id" element={<FortniteDetalhes />} />
              <Route path="/minecraft/:id" element={<MinecraftDetalhes />} />
              <Route path="/status" element={<Status />} />
              <Route path="/admin" element={<AdminPanel />} />
              <Route path="/avaliacoes" element={<Avaliacoes />} />
              <Route path="/dashboard" element={<Dashboard />} />
              
              <Route path="/meus-pedidos" element={<MeusPedidos />} />
              <Route path="/pedido/:id" element={<PedidoChat />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/carrinho" element={<Carrinho />} />
              <Route path="/raspadinha" element={<Raspadinha />} />
              <Route path="/termos" element={<TermosDeUso />} />
              <Route path="/privacidade" element={<PoliticaPrivacidade />} />
              <Route path="/reembolso" element={<PoliticaReembolso />} />
              <Route path="/garantia" element={<Garantia />} />
              <Route path="/ajuda" element={<CentralAjuda />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </CartProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
