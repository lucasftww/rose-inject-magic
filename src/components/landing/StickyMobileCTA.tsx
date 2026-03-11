import { Link } from "react-router-dom";

const StickyMobileCTA = () => (
  <div className="fixed bottom-0 left-0 right-0 z-40 sm:hidden">
    <div className="bg-card/95 backdrop-blur-xl border-t border-border px-4 py-3 safe-area-bottom">
      <div className="flex gap-2.5">
        <Link
          to="/produtos"
          className="btn-shine flex-1 flex items-center justify-center gap-2 bg-success py-3.5 text-sm font-bold tracking-wide text-success-foreground rounded-xl shadow-[0_0_25px_hsl(197,100%,50%,0.3)]"
        >
          <span className="relative flex items-center gap-2">
            🛒 Ver Produtos
          </span>
        </Link>
        <Link
          to="/contas"
          className="flex-1 flex items-center justify-center gap-2 border-2 border-success/50 py-3.5 text-sm font-bold tracking-wide text-success rounded-xl"
        >
          🎮 Ver Contas
        </Link>
      </div>
    </div>
  </div>
);

export default StickyMobileCTA;
