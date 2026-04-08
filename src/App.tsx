import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { CartProvider } from "@/hooks/useCart";
import { lazy, Suspense } from "react";
import AdminGuard from "@/components/AdminGuard";
import RouteTracker from "@/components/RouteTracker";

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { GlobalErrorBoundary } from "@/components/GlobalErrorBoundary";

/** Wrapper that feeds the current route key into the error boundary so it resets on navigation */
const LocationAwareErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  return (
    <GlobalErrorBoundary locationKey={location.key + location.pathname}>
      {children}
    </GlobalErrorBoundary>
  );
};

// Retry wrapper for lazy imports — retries up to 3 times with delay to recover from transient network/chunk errors
// On final retry, forces a full page reload to bust stale chunk references after a new deploy
type LazyModule = { default: React.ComponentType<any> };

function lazyRetry(
  factory: () => Promise<LazyModule>,
  retries = 3,
) {
  return lazy(() => {
    const attempt = (remaining: number): Promise<LazyModule> =>
      factory().catch((err) => {
        if (remaining <= 0) {
          const reloadKey = "chunk_reload_" + window.location.pathname;
          if (!sessionStorage.getItem(reloadKey)) {
            sessionStorage.setItem(reloadKey, "1");
            const url = new URL(window.location.href);
            url.searchParams.set("_cb", String(Date.now()));
            window.location.replace(url.toString());
            return new Promise<LazyModule>(() => {});
          }
          sessionStorage.removeItem(reloadKey);
          throw err;
        }
        return new Promise<LazyModule>((resolve) =>
          setTimeout(() => resolve(attempt(remaining - 1)), 1000),
        );
      });
    return attempt(retries);
  });
}

// Lazy-load secondary routes (with automatic retry on chunk load failure)
const Produtos = lazyRetry(() => import("./pages/Produtos"));
const ProdutoDetalhes = lazyRetry(() => import("./pages/ProdutoDetalhes"));
const Contas = lazyRetry(() => import("./pages/Contas"));
const ContaDetalhes = lazyRetry(() => import("./pages/ContaDetalhes"));
const LolDetalhes = lazyRetry(() => import("./pages/LolDetalhes"));
const FortniteDetalhes = lazyRetry(() => import("./pages/FortniteDetalhes"));
const MinecraftDetalhes = lazyRetry(() => import("./pages/MinecraftDetalhes"));
const Status = lazyRetry(() => import("./pages/Status"));
const Dashboard = lazyRetry(() => import("./pages/Dashboard"));
const Avaliacoes = lazyRetry(() => import("./pages/Avaliacoes"));
const MeusPedidos = lazyRetry(() => import("./pages/MeusPedidos"));
const PedidoChat = lazyRetry(() => import("./pages/PedidoChat"));
const Checkout = lazyRetry(() => import("./pages/Checkout"));
const Raspadinha = lazyRetry(() => import("./pages/Raspadinha"));
const ResetPassword = lazyRetry(() => import("./pages/ResetPassword"));
const TermosDeUso = lazyRetry(() => import("./pages/TermosDeUso"));
const PoliticaPrivacidade = lazyRetry(() => import("./pages/PoliticaPrivacidade"));
const PoliticaReembolso = lazyRetry(() => import("./pages/PoliticaReembolso"));
const Garantia = lazyRetry(() => import("./pages/Garantia"));
const CentralAjuda = lazyRetry(() => import("./pages/CentralAjuda"));
const Auth = lazyRetry(() => import("./pages/Auth"));


// Admin panel — lazy-loaded INSIDE AdminGuard so the bundle never downloads for non-admins
const AdminPanel = lazyRetry(() => import("./pages/AdminPanel"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,   // 5 min — avoid refetching fresh data
      gcTime: 10 * 60 * 1000,     // 10 min garbage collection
      retry: 1,                    // single retry on failure
      refetchOnWindowFocus: false, // prevent refetch on tab switch
    },
  },
});

const LazyFallback = React.forwardRef<HTMLDivElement>((_props, ref) => (
  <div ref={ref} className="min-h-screen flex items-center justify-center bg-background">
    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
  </div>
));
LazyFallback.displayName = "LazyFallback";

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <CartProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
            <RouteTracker />
            <Suspense fallback={<LazyFallback />}>
              <LocationAwareErrorBoundary>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/produtos" element={<Produtos />} />
                  <Route path="/produto/:id" element={<ProdutoDetalhes />} />
                  <Route path="/contas" element={<Contas />} />
                  <Route path="/conta/:id" element={<ContaDetalhes />} />
                  <Route path="/lol/:id" element={<LolDetalhes />} />
                  <Route path="/fortnite/:id" element={<FortniteDetalhes />} />
                  <Route path="/minecraft/:id" element={<MinecraftDetalhes />} />
                  <Route path="/steam/:id" element={<Navigate to="/contas" replace />} />
                  <Route path="/status" element={<Status />} />
                  <Route path="/admin" element={<AdminGuard><AdminPanel /></AdminGuard>} />
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
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/login" element={<Auth />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </LocationAwareErrorBoundary>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </CartProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
