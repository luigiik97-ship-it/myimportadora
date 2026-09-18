import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  X,
  Volume2,
  VolumeX,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  ArrowRight,
} from 'lucide-react';
import { StoreVideo, Product } from '../../types';

interface VideoViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  videos: StoreVideo[];
  initialIndex?: number;
  onSelectProduct?: (productId: string) => void;
}

export const VideoViewerModal: React.FC<VideoViewerModalProps> = ({
  isOpen,
  onClose,
  videos,
  initialIndex = 0,
  onSelectProduct,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false); // Default unmuted as requested: "sonido activado"
  const [progress, setProgress] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const modalContainerRef = useRef<HTMLDivElement | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchStartX = useRef<number | null>(null);

  // Sync initial index
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(Math.max(0, Math.min(initialIndex, videos.length - 1)));
      setIsPlaying(true);
      setIsMuted(false);
      setProgress(0);
    }
  }, [isOpen, initialIndex, videos.length]);

  // Back button (popstate) & Escape key support
  useEffect(() => {
    if (!isOpen) return;

    // Push state for back button intercept
    const stateObj = { videoModalOpen: true };
    window.history.pushState(stateObj, '');

    const handlePopState = () => {
      onClose();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        goToNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        goToPrev();
      } else if (e.key === ' ') {
        e.preventDefault();
        togglePlay();
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const currentVideo = videos[currentIndex];

  // Play / Pause toggler
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  // Audio toggler
  const toggleMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    const nextMuted = !videoRef.current.muted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
  }, []);

  const goToNext = useCallback(() => {
    if (videos.length === 0) return;
    setCurrentIndex((prev) => (prev < videos.length - 1 ? prev + 1 : 0));
    setProgress(0);
    setIsPlaying(true);
  }, [videos.length]);

  const goToPrev = useCallback(() => {
    if (videos.length === 0) return;
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : videos.length - 1));
    setProgress(0);
    setIsPlaying(true);
  }, [videos.length]);

  // Play video whenever currentIndex changes
  useEffect(() => {
    if (!isOpen || !videoRef.current) return;
    const video = videoRef.current;
    video.currentTime = 0;
    video.muted = isMuted;

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => setIsPlaying(true))
        .catch(() => {
          // Autoplay with sound might need user interaction in some browsers
          setIsPlaying(false);
        });
    }
  }, [currentIndex, isOpen]);

  // Handle video progress and chained finish
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const current = videoRef.current.currentTime;
    const duration = videoRef.current.duration || 1;
    setProgress((current / duration) * 100);
  };

  const handleVideoEnded = () => {
    // Chained: When video ends, advance to next if available
    if (currentIndex < videos.length - 1) {
      goToNext();
    } else {
      setIsPlaying(false);
    }
  };

  // Touch swipe handling (swipe up / down / left / right)
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null || touchStartX.current === null) return;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;

    // Detect significant swipe (minimum 45px threshold)
    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      if (deltaY < -45) {
        // Swiped UP -> Next video
        goToNext();
      } else if (deltaY > 45) {
        // Swiped DOWN -> Prev video
        goToPrev();
      }
    } else {
      if (deltaX < -45) {
        // Swiped LEFT -> Next video
        goToNext();
      } else if (deltaX > 45) {
        // Swiped RIGHT -> Prev video
        goToPrev();
      }
    }

    touchStartY.current = null;
    touchStartX.current = null;
  };

  if (!isOpen || !currentVideo) return null;

  return (
    <div
      ref={modalContainerRef}
      id="video-reels-viewer-modal"
      className="fixed inset-0 z-[99999] bg-black flex items-center justify-center select-none overflow-hidden touch-none"
      onClick={(e) => {
        // Close if tapping the black backdrop outside the 9:16 central card
        if (e.target === modalContainerRef.current) {
          onClose();
        }
      }}
    >
      {/* 9:16 Video Container */}
      <div
        className="relative w-full h-full max-h-[100dvh] aspect-[9/16] max-w-[460px] bg-black flex items-center justify-center overflow-hidden shadow-2xl"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={(e) => e.stopPropagation()}
      >
        {/* HTML5 Video Element */}
        <video
          ref={videoRef}
          key={currentVideo.videoUrl}
          src={currentVideo.videoUrl}
          playsInline
          preload="metadata"
          loop={false}
          className="w-full h-full object-cover cursor-pointer"
          onClick={togglePlay}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleVideoEnded}
        />

        {/* Top Gradient Overlay */}
        <div className="absolute top-0 inset-x-0 h-28 bg-gradient-to-b from-black/80 via-black/30 to-transparent pointer-events-none z-10" />

        {/* Bottom Gradient Overlay */}
        <div className="absolute bottom-0 inset-x-0 h-44 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none z-10" />

        {/* Top Progress Bar (Reels / Stories style) */}
        <div className="absolute top-2.5 inset-x-3 z-20 flex gap-1 items-center">
          {videos.map((_, idx) => (
            <div
              key={idx}
              className="flex-1 h-1 rounded-full overflow-hidden bg-white/30 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex(idx);
              }}
            >
              <div
                className="h-full bg-white transition-all duration-100"
                style={{
                  width:
                    idx < currentIndex
                      ? '100%'
                      : idx === currentIndex
                      ? `${progress}%`
                      : '0%',
                }}
              />
            </div>
          ))}
        </div>

        {/* Header Controls (Close 'X' + Sound toggle) */}
        <div className="absolute top-6 inset-x-4 z-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-close-video-viewer"
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 active:scale-95 text-white flex items-center justify-center transition-transform backdrop-blur-md cursor-pointer border border-white/10"
              aria-label="Cerrar visor"
            >
              <X className="w-5 h-5" />
            </button>
            {currentVideo.title && (
              <span className="text-white text-xs sm:text-sm font-semibold truncate max-w-[200px] drop-shadow-md">
                {currentVideo.title}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-toggle-sound-viewer"
              onClick={toggleMute}
              className="w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 active:scale-95 text-white flex items-center justify-center transition-transform backdrop-blur-md cursor-pointer border border-white/10"
              aria-label={isMuted ? 'Activar sonido' : 'Silenciar'}
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5 text-emerald-400" />}
            </button>
          </div>
        </div>

        {/* Play/Pause Center Indicator (visible when paused) */}
        {!isPlaying && (
          <div
            onClick={togglePlay}
            className="absolute inset-0 z-15 flex items-center justify-center bg-black/30 cursor-pointer"
          >
            <div className="w-16 h-16 rounded-full bg-black/60 text-white flex items-center justify-center backdrop-blur-sm border border-white/20 shadow-xl transition-transform transform scale-100 hover:scale-110">
              <Play className="w-8 h-8 ml-1 fill-white text-white" />
            </div>
          </div>
        )}

        {/* Left / Right Quick Navigation Buttons (Desktop friendly) */}
        {videos.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goToPrev();
              }}
              className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/40 hover:bg-black/70 text-white items-center justify-center backdrop-blur-xs border border-white/10 transition-transform active:scale-90 cursor-pointer"
              aria-label="Video anterior"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goToNext();
              }}
              className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/40 hover:bg-black/70 text-white items-center justify-center backdrop-blur-xs border border-white/10 transition-transform active:scale-90 cursor-pointer"
              aria-label="Siguiente video"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}

        {/* Bottom Info & Linked Product Badge */}
        <div className="absolute bottom-4 inset-x-4 z-20 flex flex-col gap-2.5">
          {currentVideo.productId && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                if (onSelectProduct && currentVideo.productId) {
                  onClose();
                  onSelectProduct(currentVideo.productId);
                }
              }}
              className="bg-white/95 hover:bg-white text-gray-900 rounded-xl p-2.5 flex items-center justify-between shadow-lg backdrop-blur-md cursor-pointer transition-all hover:scale-[1.02] border border-white/40"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {currentVideo.productImage ? (
                  <img
                    src={currentVideo.productImage}
                    alt={currentVideo.productTitle || 'Producto'}
                    className="w-11 h-11 rounded-lg object-cover bg-gray-100 shrink-0 border border-gray-200"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-lg bg-[#0058bb]/10 flex items-center justify-center shrink-0">
                    <ShoppingBag className="w-5 h-5 text-[#0058bb]" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-900 truncate">
                    {currentVideo.productTitle || currentVideo.title || 'Ver Producto'}
                  </p>
                  {currentVideo.productPrice !== undefined && (
                    <p className="text-xs font-black text-gray-900">
                      ${currentVideo.productPrice.toLocaleString('es-AR')}
                    </p>
                  )}
                </div>
              </div>
              <div className="inline-flex items-center gap-1 bg-[#0058bb] text-white px-2.5 py-1.5 rounded-lg text-xs font-bold shrink-0 shadow-xs">
                <span>Ver</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          )}

          {/* Swipe indicator label on mobile */}
          <div className="text-center text-[11px] text-white/60 font-medium tracking-wide">
            {videos.length > 1 ? `${currentIndex + 1} de ${videos.length} • Desliza para el siguiente` : 'Desliza hacia abajo o toca fuera para cerrar'}
          </div>
        </div>
      </div>
    </div>
  );
};
