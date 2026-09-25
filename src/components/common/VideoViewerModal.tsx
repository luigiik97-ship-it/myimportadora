import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  X,
  Volume2,
  VolumeX,
  Play,
  Share2,
  Check,
  ChevronUp,
  ChevronDown,
  ArrowRight,
} from 'lucide-react';
import { StoreVideo, Product } from '../../types';
import { ProductCardPrice } from './ProductCardPrice';
import { ImageWithSkeleton } from './ImageWithSkeleton';
import { isProductCompletelyOutOfStock } from '../../utils/variantHelpers';

interface VideoViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  videos: StoreVideo[];
  initialIndex?: number;
  products?: Product[];
  onSelectProduct?: (productId: string) => void;
  showAssociatedProduct?: boolean;
}

export const VideoViewerModal: React.FC<VideoViewerModalProps> = ({
  isOpen,
  onClose,
  videos,
  initialIndex = 0,
  products = [],
  onSelectProduct,
  showAssociatedProduct = true,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isPlaying, setIsPlaying] = useState(true);
  // Default unmuted as requested: "comienza automáticamente con sonido y en loop"
  const [isMuted, setIsMuted] = useState(false);
  const [showShareToast, setShowShareToast] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const modalContainerRef = useRef<HTMLDivElement | null>(null);
  const touchStartY = useRef<number | null>(null);

  // Sync initial index
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(Math.max(0, Math.min(initialIndex, videos.length - 1)));
      setIsPlaying(true);
      setIsMuted(false);
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
      } else if (e.key === 'ArrowDown') {
        goToNext();
      } else if (e.key === 'ArrowUp') {
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

  // Share handler
  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentVideo) return;

    const assignedProduct = currentVideo.productId
      ? products.find((p) => p.id === currentVideo.productId)
      : undefined;

    const shareTitle = assignedProduct?.title || currentVideo.title || 'Video en Michy';
    const shareUrl = assignedProduct
      ? `${window.location.origin}?product=${assignedProduct.id}`
      : window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: `Mira este video en Michy: ${shareTitle}`,
          url: shareUrl,
        });
        return;
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setShowShareToast(true);
      setTimeout(() => setShowShareToast(false), 2500);
    } catch {
      setShowShareToast(true);
      setTimeout(() => setShowShareToast(false), 2500);
    }
  };

  const goToNext = useCallback(() => {
    if (videos.length === 0) return;
    setCurrentIndex((prev) => (prev < videos.length - 1 ? prev + 1 : 0));
    setIsPlaying(true);
  }, [videos.length]);

  const goToPrev = useCallback(() => {
    if (videos.length === 0) return;
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : videos.length - 1));
    setIsPlaying(true);
  }, [videos.length]);

  // Play video with sound whenever currentIndex changes or modal opens
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
          // If browser policy blocks sound before user tap, attempt muted playback
          if (!video.muted) {
            video.muted = true;
            video.play().catch(() => {});
          }
        });
    }
  }, [currentIndex, isOpen, isMuted]);

  // Touch swipe handling for Reels navigation: ONLY vertical swipe is allowed
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;

    // Detect swipe (40px threshold) - strictly vertical only
    if (Math.abs(deltaY) > 40) {
      if (deltaY < 0) {
        // Swiped UP -> Next video
        goToNext();
      } else {
        // Swiped DOWN -> Prev video
        goToPrev();
      }
    }

    touchStartY.current = null;
  };

  if (!isOpen || !currentVideo) return null;

  // Check if video is assigned to a publication in the admin panel and allowed to be shown
  const hasAssignedProduct = Boolean(
    showAssociatedProduct &&
    currentVideo.productId &&
    currentVideo.productId.trim() !== '' &&
    currentVideo.productId !== 'none'
  );

  const linkedProduct = hasAssignedProduct
    ? products.find((p) => p.id === currentVideo.productId) || (currentVideo.productPrice !== undefined ? {
        id: currentVideo.productId!,
        title: currentVideo.productTitle || currentVideo.title || 'Producto',
        category: '',
        wholesalePrice: currentVideo.productPrice,
        retailPrice: currentVideo.productPrice,
        minWholesaleQty: 1,
        stock: 99,
        images: currentVideo.productImage ? [currentVideo.productImage] : [],
        description: '',
        createdAt: currentVideo.createdAt,
      } as Product : undefined)
    : undefined;

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
        {/* HTML5 Video Element (Loops continuously, audio on by default) */}
        <video
          ref={videoRef}
          key={currentVideo.videoUrl}
          src={currentVideo.videoUrl}
          playsInline
          preload="metadata"
          loop={true}
          className="w-full h-full object-cover cursor-pointer"
          onClick={togglePlay}
        />

        {/* Top Gradient Overlay */}
        <div className="absolute top-0 inset-x-0 h-28 bg-gradient-to-b from-black/80 via-black/30 to-transparent pointer-events-none z-10" />

        {/* Bottom Gradient Overlay */}
        <div className="absolute bottom-0 inset-x-0 h-48 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none z-10" />

        {/* Header Controls (Close 'X' on left, Sound + Share buttons on right) */}
        <div className="absolute top-4 sm:top-5 inset-x-4 z-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-close-video-viewer"
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-black/40 hover:bg-black/70 active:scale-95 text-white flex items-center justify-center transition-transform backdrop-blur-md cursor-pointer border border-white/15"
              aria-label="Cerrar visor"
              title="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
            {currentVideo.title && !hasAssignedProduct && (
              <span className="text-white text-xs sm:text-sm font-semibold truncate max-w-[200px] drop-shadow-md">
                {currentVideo.title}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle Sound */}
            <button
              type="button"
              id="btn-toggle-sound-viewer"
              onClick={toggleMute}
              className="w-10 h-10 rounded-full bg-black/40 hover:bg-black/70 active:scale-95 text-white flex items-center justify-center transition-transform backdrop-blur-md cursor-pointer border border-white/15"
              aria-label={isMuted ? 'Activar sonido' : 'Silenciar'}
              title={isMuted ? 'Activar sonido' : 'Silenciar'}
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5 text-emerald-400" />}
            </button>

            {/* Share Button */}
            <button
              type="button"
              id="btn-share-video-viewer"
              onClick={handleShare}
              className="w-10 h-10 rounded-full bg-black/40 hover:bg-black/70 active:scale-95 text-white flex items-center justify-center transition-transform backdrop-blur-md cursor-pointer border border-white/15"
              aria-label="Compartir video"
              title="Compartir video"
            >
              <Share2 className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Share Toast Notification */}
        {showShareToast && (
          <div className="absolute top-16 inset-x-4 z-30 flex justify-center pointer-events-none transition-all">
            <div className="bg-black/85 text-white text-xs font-semibold px-4 py-2 rounded-full border border-white/20 shadow-xl backdrop-blur-md flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>¡Enlace copiado al portapapeles!</span>
            </div>
          </div>
        )}

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

        {/* Quick Navigation Buttons (Desktop friendly, vertical) */}
        {videos.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goToPrev();
              }}
              className="hidden md:flex absolute right-3 top-[44%] -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/40 hover:bg-black/70 text-white items-center justify-center backdrop-blur-xs border border-white/10 transition-transform active:scale-90 cursor-pointer"
              aria-label="Video anterior"
            >
              <ChevronUp className="w-6 h-6" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goToNext();
              }}
              className="hidden md:flex absolute right-3 top-[56%] -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/40 hover:bg-black/70 text-white items-center justify-center backdrop-blur-xs border border-white/10 transition-transform active:scale-90 cursor-pointer"
              aria-label="Siguiente video"
            >
              <ChevronDown className="w-6 h-6" />
            </button>
          </>
        )}

        {/* Bottom Area: Shows Product Card if the video is assigned to a publication and showAssociatedProduct is enabled */}
        <div className="absolute bottom-4 sm:bottom-6 inset-x-3 sm:inset-x-4 z-20 flex flex-col gap-2">
          {hasAssignedProduct && linkedProduct && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                if (onSelectProduct && linkedProduct.id) {
                  onClose();
                  onSelectProduct(linkedProduct.id);
                }
              }}
              className="group bg-black/10 backdrop-blur-md rounded-2xl border border-white/20 hover:border-white/35 shadow-2xl p-2.5 sm:p-3 flex items-center justify-between gap-3 cursor-pointer transition-all duration-300 hover:bg-black/15 active:scale-[0.99]"
            >
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                {/* Imagen del producto asociado idéntica a la tarjeta original */}
                <div className="relative aspect-square w-14 h-14 sm:w-16 sm:h-16 bg-black/20 rounded-xl overflow-hidden shrink-0 border border-white/15 shadow-inner">
                  <ImageWithSkeleton
                    src={(linkedProduct.images && linkedProduct.images[0]) || currentVideo.productImage || 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=400'}
                    alt={linkedProduct.title}
                    className={`w-full h-full object-cover ${
                      isProductCompletelyOutOfStock(linkedProduct) ? 'opacity-60 grayscale-[30%]' : 'group-hover:scale-105'
                    } transition-transform duration-300`}
                  />
                  {isProductCompletelyOutOfStock(linkedProduct) && (
                    <span className="absolute top-1 right-1 bg-red-600/90 backdrop-blur-xs text-white text-[9px] font-bold px-1 rounded shadow-xs z-10">
                      Sin stock
                    </span>
                  )}
                </div>

                {/* Detalles y Precio: reutilizando exactamente la lógica y componente con tema dark */}
                <div className="min-w-0 flex-1 space-y-0.5 sm:space-y-1">
                  <h3 className="text-xs sm:text-sm font-semibold text-white line-clamp-1 leading-snug group-hover:text-blue-200 transition-colors drop-shadow-xs">
                    {linkedProduct.title}
                  </h3>
                  <ProductCardPrice product={linkedProduct} theme="dark" className="!pt-0" />
                </div>
              </div>

              {/* Botón Ver sin fondo (el fondo es el recuadro de la tarjeta negra con opacidad del 10%) */}
              <div className="inline-flex items-center gap-1.5 bg-transparent hover:bg-white/10 active:scale-95 text-white px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl text-xs font-semibold shrink-0 border border-white/25 transition-all">
                <span>Ver</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          )}

          {/* Flecha discreta hacia abajo sin línea media (solo líneas oblicuas) */}
          {videos.length > 1 && (
            <div className="flex justify-center items-center py-0.5 pointer-events-none">
              <ChevronDown className="w-5 h-5 text-white/50 animate-bounce drop-shadow-xs" strokeWidth={2} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
