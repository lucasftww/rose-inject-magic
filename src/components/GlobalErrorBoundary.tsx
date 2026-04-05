import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCcw } from "lucide-react";

interface Props {
  children?: ReactNode;
  /** Pass current location key/pathname so the boundary resets on navigation */
  locationKey?: string;
}

interface State {
  hasError: boolean;
  isChunkError: boolean;
  /** Track which location triggered the error so we can auto-reset */
  errorLocationKey?: string;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    isChunkError: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    const isChunkError =
      error.name === "ChunkLoadError" ||
      error.message.includes("Failed to fetch dynamically imported module") ||
      error.message.includes("Importing a module script failed");

    return { hasError: true, isChunkError };
  }

  public static getDerivedStateFromProps(
    nextProps: Props,
    prevState: State,
  ): Partial<State> | null {
    // Reset the error when the route changes (user navigated away)
    if (
      prevState.hasError &&
      prevState.errorLocationKey &&
      nextProps.locationKey &&
      nextProps.locationKey !== prevState.errorLocationKey
    ) {
      return { hasError: false, isChunkError: false, errorLocationKey: undefined };
    }
    return null;
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Stamp the current location so we know which route errored
    this.setState({ errorLocationKey: this.props.locationKey });

    if (import.meta.env.DEV) {
      console.error("Uncaught error:", error, errorInfo);
    }
  }

  private handleReload = () => {
    if (this.state.isChunkError) {
      // Force bypass browser cache for chunk errors
      window.location.href = window.location.href;
      // Fallback if href assignment doesn't trigger navigation (same URL)
      setTimeout(() => window.location.reload(), 100);
    } else {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-card border border-border rounded-xl p-8 text-center shadow-lg">
            <h1 className="text-2xl font-bold text-foreground mb-4">
              {this.state.isChunkError ? "Erro de Conexão" : "Ops! Algo deu errado."}
            </h1>
            <p className="text-muted-foreground mb-6">
              {this.state.isChunkError
                ? "Tivemos um problema ao carregar esta página. Isso pode ter sido causado por uma falha de rede temporária ou por um bloqueador de anúncios agressivo (Adblock)."
                : "Encontramos um erro inesperado. O sistema foi notificado."}
            </p>
            <Button onClick={this.handleReload} size="lg" className="w-full gap-2">
              <RefreshCcw className="w-4 h-4" />
              Recarregar Página
            </Button>

            {this.state.isChunkError && (
              <p className="text-xs text-muted-foreground/60 mt-6">
                Se o erro persistir, desative momentaneamente o seu bloqueador de anúncios para esta página.
              </p>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
