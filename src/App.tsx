import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { CartProvider } from "@/hooks/useCart";
import { lazy, Suspense } from "react";

// Eager-load critical routes
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// Lazy-load secondary routes
const Produtos = lazy(() => import("./pages/Produtos"));
const ProdutoDetalhes = lazy(() => import("./pages/ProdutoDetalhes"));
const Contas = lazy(() => import("./pages/Contas"));
const ContaDetalhes = lazy(() => import("./pages/ContaDetalhes"));
const LolDetalhes = lazy(() => import("./pages/LolDetalhes"));
const FortniteDetalhes = lazy(() => import("./pages/FortniteDetalhes"));
const MinecraftDetalhes = lazy(() => import("./pages/MinecraftDetalhes"));
const Status = lazy(() => import("./pages/Status"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Avaliacoes = lazy(() => import("./pages/Avaliacoes"));
const MeusPedidos = lazy(() => import("./pages/MeusPedidos"));
const PedidoChat = lazy(() => import("./pages/PedidoChat"));
const Checkout = lazy(() => import("./pages/Checkout"));
const Raspadinha = lazy(() => import("./pages/Raspadinha"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const TermosDeUso = lazy(() => import("./pages/TermosDeUso"));
const PoliticaPrivacidade = lazy(() => import("./pages/PoliticaPrivacidade"));
const PoliticaReembolso = lazy(() => import("./pages/PoliticaReembolso"));
const Garantia = lazy(() => import("./pages/Garantia"));
const CentralAjuda = lazy(() => import("./pages/CentralAjuda"));

const queryClient = new QueryClient({});

const LazyFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <CartProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Suspense fallback={<LazyFallback />}>
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
                
                <Route path="/raspadinha" element={<Raspadinha />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/termos" element={<TermosDeUso />} />
                <Route path="/privacidade" element={<PoliticaPrivacidade />} />
                <Route path="/reembolso" element={<PoliticaReembolso />} />
                <Route path="/garantia" element={<Garantia />} />
                <Route path="/ajuda" element={<CentralAjuda />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </CartProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
