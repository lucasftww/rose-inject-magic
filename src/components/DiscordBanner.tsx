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
          className="relative w-full bg-[#00b3ff] text-white text-center py-2.5 px-4 text-sm font-semibold z-[60] shadow-[0_2px_20px_rgba(0,179,255,0.4)] overflow-hidden"
        >
          <div className="flex items-center justify-center gap-1.5 sm:gap-2 flex-wrap">
            <MessageCircle className="w-4 h-4 animate-pulse hidden sm:block" />
            <span className="text-xs sm:text-sm">⚠️ <span className="hidden sm:inline">Nosso antigo </span>Discord caiu! Entre no novo:</span>
            <a
              href="https://discord.gg/royalstorebr"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-bold hover:text-white/80 transition-colors text-xs sm:text-sm"
            >
              discord.gg/royalstorebr
            </a>
          </div>
          {dismissible && (
            <button
              onClick={handleDismiss}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default DiscordBanner;
