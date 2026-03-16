import { useState, useEffect, useRef, memo } from "react";
import { Crosshair } from "lucide-react";

interface ValorantImageProps {
  src: string;
  alt: string;
  className?: string;
  timeout?: number;
}

/**
 * Image component with timeout fallback for external APIs (valorant-api.com).
 * Shows a placeholder icon if the image fails or takes too long to load.
 */
const ValorantImage = memo(({ src, alt, className = "", timeout = 8000 }: ValorantImageProps) => {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setStatus("loading");
    timerRef.current = setTimeout(() => setStatus("error"), timeout);
    return () => clearTimeout(timerRef.current);
  }, [src, timeout]);

  const handleLoad = () => {
    clearTimeout(timerRef.current);
    setStatus("loaded");
  };

  const handleError = () => {
    clearTimeout(timerRef.current);
    setStatus("error");
  };

  if (status === "error") {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <Crosshair className="h-6 w-6 text-muted-foreground/20" />
      </div>
    );
  }

  return (
    <>
      {status === "loading" && (
        <div className={`flex items-center justify-center ${className}`}>
          <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground/60 animate-spin" />
        </div>
      )}
      <img
        src={src}
        alt={alt}
        className={`${className} ${status === "loading" ? "sr-only" : ""}`}
        loading="lazy"
        onLoad={handleLoad}
        onError={handleError}
      />
    </>
  );
});

ValorantImage.displayName = "ValorantImage";

export default ValorantImage;
