import { X, MessageCircle } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const DiscordBanner = ({ dismissible = true }: { dismissible?: boolean }) => {
  const [visible, setVisible] = useState(true);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="relative w-full bg-[#F00083] text-white text-center py-2.5 px-4 text-sm font-semibold z-[60] shadow-[0_2px_20px_rgba(240,0,131,0.4)] overflow-hidden"
        >
          <div className="flex items-center justify-center gap-2">
            <MessageCircle className="w-4 h-4 animate-pulse" />
            <span>⚠️ Nosso antigo Discord caiu! Entre no novo:</span>
            <a
              href="https://discord.gg/EM8hAyTvtj"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-bold hover:text-white/80 transition-colors ml-1"
            >
              discord.gg/EM8hAyTvtj
            </a>
          </div>
          {dismissible && (
            <button
              onClick={() => setVisible(false)}
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
