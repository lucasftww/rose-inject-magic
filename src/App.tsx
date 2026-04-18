import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { CartProvider } from "@/hooks/useCart";
import React, { lazy, Suspense } from "react";
import AdminGuard from "@/components/AdminGuard";
import RouteTracker from "@/components/RouteTracker";

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { GlobalErrorBoundary } from "@/components/GlobalErrorBoundary";

/** Wrapper that feeds the current route key into the error boundary so it resets on navigation */
function LocationAwareErrorBoundary({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return (
    <GlobalErrorBoundary locationKey={location.key + location.pathname}>
      {children}
    </GlobalErrorBoundary>
  );
}

// Retry wrapper for lazy imports — retries up to 3 times with delay to recover from transient network/chunk errors
// On final retry, forces a full page reload to bust stale chunk references after a new deploy
type LazyModule = { default: React.ComponentType<Record<string, unknown>> };

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
const PedidoSucesso = lazyRetry(() => import("./pages/PedidoSucesso"));
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

function LazyFallback() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-background">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
    </div>
  );
}

/** Per-route Suspense so navigating from home → shop does not blank the whole app behind a spinner */
function SuspenseRoute({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LazyFallback />}>{children}</Suspense>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <CartProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
            <RouteTracker />
            <LocationAwareErrorBoundary>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/produtos" element={<SuspenseRoute><Produtos /></SuspenseRoute>} />
                <Route path="/produto/:id" element={<SuspenseRoute><ProdutoDetalhes /></SuspenseRoute>} />
                <Route path="/contas" element={<SuspenseRoute><Contas /></SuspenseRoute>} />
                <Route path="/conta/:id" element={<SuspenseRoute><ContaDetalhes /></SuspenseRoute>} />
                <Route path="/lol/:id" element={<SuspenseRoute><LolDetalhes /></SuspenseRoute>} />
                <Route path="/fortnite/:id" element={<SuspenseRoute><FortniteDetalhes /></SuspenseRoute>} />
                <Route path="/minecraft/:id" element={<SuspenseRoute><MinecraftDetalhes /></SuspenseRoute>} />
                <Route path="/steam/:id" element={<Navigate to="/contas" replace />} />
                <Route path="/status" element={<SuspenseRoute><Status /></SuspenseRoute>} />
                <Route
                  path="/admin"
                  element={
                    <AdminGuard>
                      <SuspenseRoute>
                        <AdminPanel />
                      </SuspenseRoute>
                    </AdminGuard>
                  }
                />
                <Route path="/avaliacoes" element={<SuspenseRoute><Avaliacoes /></SuspenseRoute>} />
                <Route path="/dashboard" element={<SuspenseRoute><Dashboard /></SuspenseRoute>} />

                <Route path="/meus-pedidos" element={<SuspenseRoute><MeusPedidos /></SuspenseRoute>} />
                <Route path="/pedido/sucesso" element={<SuspenseRoute><PedidoSucesso /></SuspenseRoute>} />
                <Route path="/pedido/:id" element={<SuspenseRoute><PedidoChat /></SuspenseRoute>} />
                <Route path="/checkout" element={<SuspenseRoute><Checkout /></SuspenseRoute>} />

                <Route path="/raspadinha" element={<SuspenseRoute><Raspadinha /></SuspenseRoute>} />
                <Route path="/reset-password" element={<SuspenseRoute><ResetPassword /></SuspenseRoute>} />
                <Route path="/termos" element={<SuspenseRoute><TermosDeUso /></SuspenseRoute>} />
                <Route path="/privacidade" element={<SuspenseRoute><PoliticaPrivacidade /></SuspenseRoute>} />
                <Route path="/reembolso" element={<SuspenseRoute><PoliticaReembolso /></SuspenseRoute>} />
                <Route path="/garantia" element={<SuspenseRoute><Garantia /></SuspenseRoute>} />
                <Route path="/ajuda" element={<SuspenseRoute><CentralAjuda /></SuspenseRoute>} />
                <Route path="/auth" element={<SuspenseRoute><Auth /></SuspenseRoute>} />
                <Route path="/login" element={<SuspenseRoute><Auth /></SuspenseRoute>} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </LocationAwareErrorBoundary>
          </BrowserRouter>
        </TooltipProvider>
      </CartProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
