import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause } from "lucide-react";

interface AudioMessagePlayerProps {
  src: string;
  isStaff?: boolean;
}

const AudioMessagePlayer = ({ src, isStaff }: AudioMessagePlayerProps) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const barsCount = 28;

  // Generate random bar heights (fixed per instance)
  const [bars] = useState(() =>
    Array.from({ length: barsCount }, () => 0.15 + Math.random() * 0.85)
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoaded = () => setDuration(audio.duration || 0);
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onEnded = () => { setPlaying(false); setCurrentTime(0); };

    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play();
      setPlaying(true);
    }
  }, [playing]);

  const handleBarClick = (index: number) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const t = (index / barsCount) * duration;
    audio.currentTime = t;
    setCurrentTime(t);
  };

  const progress = duration > 0 ? currentTime / duration : 0;
  const activeBar = Math.floor(progress * barsCount);

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-2.5 min-w-[220px] max-w-[280px]">
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Play / Pause button */}
      <button
        onClick={togglePlay}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all ${
          isStaff
            ? "bg-success/20 text-success hover:bg-success/30"
            : "bg-primary/20 text-primary hover:bg-primary/30"
        }`}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
      </button>

      {/* Waveform + time */}
      <div className="flex-1 flex flex-col gap-1">
        <div className="flex items-end gap-[2px] h-6 cursor-pointer" role="slider" aria-valuenow={currentTime} aria-valuemax={duration}>
          {bars.map((height, i) => (
            <div
              key={i}
              onClick={() => handleBarClick(i)}
              className={`flex-1 rounded-full min-w-[2px] transition-colors duration-100 ${
                i <= activeBar
                  ? isStaff ? "bg-success" : "bg-primary"
                  : "bg-muted-foreground/25"
              }`}
              style={{ height: `${height * 100}%` }}
            />
          ))}
        </div>
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {playing || currentTime > 0 ? fmt(currentTime) : duration > 0 ? fmt(duration) : "0:00"}
        </span>
      </div>
    </div>
  );
};

export default AudioMessagePlayer;
