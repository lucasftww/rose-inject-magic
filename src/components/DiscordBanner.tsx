import { X, MessageCircle } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const DiscordBanner = ({ dismissible = true, onVisibilityChange }: { dismissible?: boolean; onVisibilityChange?: (visible: boolean) => void }) => {
  const [visible, setVisible] = useState(true);

  const handleDismiss = () => {
    setVisible(false);
    onVisibilityChange?.(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="relative w-full bg-success text-success-foreground text-center py-1.5 sm:py-2 px-10 sm:px-4 z-[60] overflow-hidden"
        >
          <div className="mx-auto flex items-center justify-center gap-1.5 sm:gap-2 max-w-7xl">
            <MessageCircle className="w-3.5 h-3.5 shrink-0 hidden sm:block" />
            <span className="text-[11px] sm:text-xs font-medium truncate">
              ⚠️ <span className="hidden sm:inline">Nosso antigo </span>Discord caiu! Novo:
            </span>
            <a
              href="https://discord.gg/royalstorebr"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-bold hover:text-white/80 transition-colors text-[11px] sm:text-xs shrink-0"
            >
              discord.gg/royalstorebr
            </a>
          </div>
          {dismissible && (
            <button
              onClick={handleDismiss}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default DiscordBanner;
