import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize2 } from 'lucide-react';

interface ProductBottomVideoPlayerProps {
  videoUrl?: string;
  onOpenFullscreen: () => void;
}

export const ProductBottomVideoPlayer: React.FC<ProductBottomVideoPlayerProps> = ({
  videoUrl,
  onOpenFullscreen,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [isInView, setIsInView] = useState<boolean>(false);

  // If no video, render nothing (no space occupied, no title)
  if (!videoUrl || !videoUrl.trim()) {
    return null;
  }

  // Optimize bandwidth: pause video when it leaves the viewport
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setIsInView(entry.isIntersecting);
        if (!entry.isIntersecting && videoRef.current && !videoRef.current.paused) {
          videoRef.current.pause();
          setIsPlaying(false);
        } else if (entry.isIntersecting && videoRef.current && videoRef.current.paused) {
          videoRef.current.play().catch(() => {});
          setIsPlaying(true);
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [videoUrl]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    const nextMuted = !videoRef.current.muted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  return (
    <div
      ref={containerRef}
      id="product-detail-bottom-video"
      className="w-full h-full py-2 lg:py-0 flex flex-col items-center justify-center select-none"
    >
      <div className="relative aspect-[9/16] w-full max-w-[320px] sm:max-w-[340px] lg:max-w-[320px] xl:max-w-[340px] h-[480px] sm:h-[500px] lg:h-full lg:max-h-[520px] bg-black rounded-2xl overflow-hidden shadow-md border border-gray-200/80 group flex items-center justify-center">
        {/* Ambient blurred backdrop for aesthetic cohesion */}
        <video
          src={videoUrl}
          playsInline
          muted
          loop
          autoPlay
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover blur-xl opacity-35 scale-110 pointer-events-none"
        />

        {/* Video Element */}
        <video
          ref={videoRef}
          src={videoUrl}
          playsInline
          preload="metadata"
          loop
          autoPlay
          muted={isMuted}
          onClick={togglePlay}
          className="relative z-10 w-full h-full object-cover cursor-pointer"
        />

        {/* Top Vignette with Controls */}
        <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-black/70 to-transparent p-3 flex items-center justify-between z-20">
          <div className="flex items-center gap-1.5 text-white/90 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Video del Producto</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleMute}
              className="w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-xs border border-white/10 transition-transform active:scale-95 cursor-pointer"
              aria-label={isMuted ? 'Activar sonido' : 'Silenciar'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            </button>
            <button
              type="button"
              onClick={onOpenFullscreen}
              className="w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-xs border border-white/10 transition-transform active:scale-95 cursor-pointer"
              aria-label="Ver pantalla completa"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Center Play Overlay when paused */}
        {!isPlaying && (
          <div
            onClick={togglePlay}
            className="absolute inset-0 bg-black/30 flex items-center justify-center cursor-pointer z-20"
          >
            <div className="w-14 h-14 rounded-full bg-black/60 text-white flex items-center justify-center backdrop-blur-xs border border-white/20 shadow-xl">
              <Play className="w-7 h-7 ml-1 fill-white text-white" />
            </div>
          </div>
        )}

        {/* Bottom Expand Prompt */}
        <div
          onClick={onOpenFullscreen}
          className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-black/80 to-transparent p-3 flex items-end justify-center z-20 cursor-pointer"
        >
          <span className="text-[11px] font-bold text-white/90 bg-white/20 hover:bg-white/30 backdrop-blur-md px-3 py-1 rounded-full transition-colors">
            Toca para pantalla completa (Reels)
          </span>
        </div>
      </div>
    </div>
  );
};
