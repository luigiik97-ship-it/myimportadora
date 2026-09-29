import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { X, ChevronLeft, ChevronRight, Play } from 'lucide-react';

export interface LightboxMediaItem {
  type: 'image' | 'video';
  url: string;
  thumbnailUrl?: string;
  title?: string;
}

export interface ProductImageLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  images?: string[];
  mediaItems?: LightboxMediaItem[];
  initialIndex?: number;
  title?: string;
  subtitle?: string;
  onIndexChange?: (newIndex: number) => void;
  onOpenVideo?: () => void;
}

export const ProductImageLightbox: React.FC<ProductImageLightboxProps> = ({
  isOpen,
  onClose,
  images = [],
  mediaItems,
  initialIndex = 0,
  title,
  subtitle,
  onIndexChange,
  onOpenVideo,
}) => {
  // Normalize items to support both images and videos seamlessly
  const items = useMemo<LightboxMediaItem[]>(() => {
    if (mediaItems && mediaItems.length > 0) {
      return mediaItems;
    }
    return images.map((img) => ({
      type: 'image' as const,
      url: img,
    }));
  }, [mediaItems, images]);

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isZoomed, setIsZoomed] = useState(false);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [slideOffset, setSlideOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Tracking refs to avoid stale closures during pointer/mouse/touch movements
  const isDraggingRef = useRef(false);
  const isZoomedRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number; time: number }>({ x: 0, y: 0, time: 0 });
  const startPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragDistanceRef = useRef<number>(0);
  const currentDeltaXRef = useRef<number>(0);
  const lastTouchTimeRef = useRef<number>(0);
  const isImageTargetRef = useRef<boolean>(false);
  const openTimeRef = useRef<number>(0);
  const lastZoomToggleTimeRef = useRef<number>(0);

  // Keep isZoomedRef in sync
  useEffect(() => {
    isZoomedRef.current = isZoomed;
  }, [isZoomed]);

  // Sync index and reset states when initialIndex changes or modal opens
  useEffect(() => {
    if (isOpen) {
      openTimeRef.current = Date.now();
      const validIndex = Math.max(0, Math.min(initialIndex, Math.max(0, items.length - 1)));
      setCurrentIndex(validIndex);
      setIsZoomed(false);
      setPanPosition({ x: 0, y: 0 });
      setSlideOffset(0);
      setIsDragging(false);
      isDraggingRef.current = false;
    }
  }, [isOpen, initialIndex, items.length]);

  // Lock body scroll when lightbox is open
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Helper to filter out synthetic/ghost mouse events triggered by mobile touch
  const isSyntheticOrRecentTouch = () => {
    return Date.now() - lastTouchTimeRef.current < 1000 || Date.now() - openTimeRef.current < 400;
  };

  // Handle item index change and notify parent
  const handleIndexChange = useCallback(
    (newIndex: number) => {
      if (items.length <= 1) return;
      let targetIndex = newIndex;
      if (targetIndex < 0) targetIndex = items.length - 1;
      if (targetIndex >= items.length) targetIndex = 0;

      setCurrentIndex(targetIndex);
      setIsZoomed(false);
      setPanPosition({ x: 0, y: 0 });
      setSlideOffset(0);
      onIndexChange?.(targetIndex);
    },
    [items.length, onIndexChange]
  );

  const prevItem = useCallback(() => {
    handleIndexChange(currentIndex - 1);
  }, [currentIndex, handleIndexChange]);

  const nextItem = useCallback(() => {
    handleIndexChange(currentIndex + 1);
  }, [currentIndex, handleIndexChange]);

  // Keyboard navigation: Escape to close; ArrowLeft/Right only when NOT zoomed
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (!isZoomed && e.key === 'ArrowLeft') {
        prevItem();
      } else if (!isZoomed && e.key === 'ArrowRight') {
        nextItem();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isZoomed, onClose, prevItem, nextItem]);

  // Current item
  const currentItem = items[currentIndex] || items[0];
  const isCurrentVideo = currentItem?.type === 'video';

  // --------------------------------------------------------------------------
  // Gestures (Mouse & Touch) unified engine
  // --------------------------------------------------------------------------
  const startGesture = (clientX: number, clientY: number, onMedia: boolean) => {
    isDraggingRef.current = true;
    setIsDragging(true);
    isImageTargetRef.current = onMedia;
    dragStartRef.current = { x: clientX, y: clientY, time: Date.now() };
    dragDistanceRef.current = 0;
    currentDeltaXRef.current = 0;

    if (isZoomedRef.current && !isCurrentVideo) {
      startPanRef.current = { ...panPosition };
    }
  };

  const moveGesture = (clientX: number, clientY: number) => {
    if (!isDraggingRef.current) return;

    const deltaX = clientX - dragStartRef.current.x;
    const deltaY = clientY - dragStartRef.current.y;
    const dist = Math.hypot(deltaX, deltaY);
    dragDistanceRef.current = Math.max(dragDistanceRef.current, dist);
    currentDeltaXRef.current = deltaX;

    if (isZoomedRef.current && !isCurrentVideo) {
      // ZOOM 2.0x: Move (pan) the image. NEVER changes images!
      const maxPanX = Math.max(window.innerWidth * 0.55, 200);
      const maxPanY = Math.max(window.innerHeight * 0.55, 200);

      const newX = Math.max(-maxPanX, Math.min(maxPanX, startPanRef.current.x + deltaX));
      const newY = Math.max(-maxPanY, Math.min(maxPanY, startPanRef.current.y + deltaY));

      setPanPosition({ x: newX, y: newY });
    } else {
      // FULLSCREEN (1.0x): Drag horizontally to slide between items
      setSlideOffset(deltaX);
    }
  };

  const endGesture = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);

    const movedDist = dragDistanceRef.current;
    const finalDeltaX = currentDeltaXRef.current;
    const clickedOnMedia = isImageTargetRef.current;
    const elapsed = Date.now() - dragStartRef.current.time;

    // Distinguish between a clean tap and a drag/swipe:
    const isTap = movedDist <= 12 || (movedDist <= 18 && elapsed < 280);

    if (isZoomedRef.current && !isCurrentVideo) {
      // IN ZOOM 2.0x:
      if (isTap) {
        if (Date.now() - lastZoomToggleTimeRef.current < 250) return;
        lastZoomToggleTimeRef.current = Date.now();
        setIsZoomed(false);
        setPanPosition({ x: 0, y: 0 });
      }
    } else {
      // IN FULLSCREEN (1.0x):
      if (!isTap && movedDist > 12) {
        if (items.length > 1) {
          if (finalDeltaX < -40) {
            // Dragged left -> Next item
            nextItem();
          } else if (finalDeltaX > 40) {
            // Dragged right -> Previous item
            prevItem();
          }
        }
        setSlideOffset(0);
      } else {
        // User clicked/tapped without dragging:
        setSlideOffset(0);
        if (clickedOnMedia) {
          if (isCurrentVideo) {
            // Clicked on video thumbnail -> Open video in full screen!
            onOpenVideo?.();
          } else {
            // Tap/click on image -> ENTER ZOOM 2.0X!
            if (Date.now() - lastZoomToggleTimeRef.current < 250) return;
            lastZoomToggleTimeRef.current = Date.now();
            setIsZoomed(true);
            setPanPosition({ x: 0, y: 0 });
          }
        } else {
          // Click on background -> Close lightbox
          onClose();
        }
      }
    }
  };

  // Window-level listeners for mouse movements during active dragging
  useEffect(() => {
    if (!isDragging) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      if (isSyntheticOrRecentTouch()) return;
      moveGesture(e.clientX, e.clientY);
    };

    const handleWindowMouseUp = (e: MouseEvent) => {
      if (isSyntheticOrRecentTouch()) return;
      endGesture();
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [isDragging, items.length, nextItem, prevItem, onClose, isCurrentVideo]);

  // Touch Handlers
  const handleTouchStart = (e: React.TouchEvent, onMedia: boolean) => {
    lastTouchTimeRef.current = Date.now();
    if (Date.now() - openTimeRef.current < 350) return;

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      startGesture(touch.clientX, touch.clientY, onMedia);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    lastTouchTimeRef.current = Date.now();
    if (Date.now() - openTimeRef.current < 350) return;

    if (e.touches.length === 1 && isDraggingRef.current) {
      if (e.cancelable) e.preventDefault();
      const touch = e.touches[0];
      moveGesture(touch.clientX, touch.clientY);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    lastTouchTimeRef.current = Date.now();
    if (Date.now() - openTimeRef.current < 350) {
      isDraggingRef.current = false;
      setIsDragging(false);
      setSlideOffset(0);
      return;
    }
    endGesture();
  };

  if (!isOpen) return null;

  const hasMultipleItems = items.length > 1;

  return (
    <div
      id="product-image-lightbox"
      className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center select-none overflow-hidden animate-in fade-in duration-200"
      onMouseDown={(e) => {
        if (isSyntheticOrRecentTouch()) return;
        if (e.button === 0 && e.target === e.currentTarget) {
          startGesture(e.clientX, e.clientY, false);
        }
      }}
      onTouchStart={(e) => {
        if (e.target === e.currentTarget) {
          handleTouchStart(e, false);
        }
      }}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top Bar: Close button on right */}
      <div
        className="absolute top-0 left-0 right-0 z-50 p-3 sm:p-5 flex items-center justify-end pointer-events-none bg-gradient-to-b from-black/60 via-black/20 to-transparent"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Clear Close Button: High contrast, clearly readable */}
        <button
          type="button"
          id="lightbox-close-btn"
          onClick={onClose}
          className="pointer-events-auto bg-white/95 hover:bg-white text-gray-900 px-3.5 sm:px-4 py-2 rounded-full font-bold text-xs sm:text-sm shadow-2xl flex items-center gap-1.5 transition-all cursor-pointer hover:scale-105 active:scale-95 border border-white/40 focus:outline-none focus:ring-2 focus:ring-[#0058bb]"
          title="Cerrar y volver a la página (Esc)"
        >
          <X className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
          <span>Cerrar</span>
        </button>
      </div>

      {/* Main Stage */}
      <div
        className="relative w-full h-full flex items-center justify-center p-2 sm:p-6 overflow-hidden"
        onMouseDown={(e) => {
          if (isSyntheticOrRecentTouch()) return;
          if (e.button === 0 && e.target === e.currentTarget) {
            startGesture(e.clientX, e.clientY, false);
          }
        }}
        onTouchStart={(e) => {
          if (e.target === e.currentTarget) {
            handleTouchStart(e, false);
          }
        }}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {currentItem ? (
          isCurrentVideo ? (
            /* Video item: displays thumbnail without playing; clicking triggers full-screen video */
            <div
              className="relative flex items-center justify-center max-w-[94vw] max-h-[85vh] touch-none"
              style={{
                cursor: isDragging ? 'grabbing' : 'pointer',
              }}
              onMouseDown={(e) => {
                if (isSyntheticOrRecentTouch()) return;
                if (e.button === 0) {
                  e.stopPropagation();
                  startGesture(e.clientX, e.clientY, true);
                }
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                handleTouchStart(e, true);
              }}
            >
              <div
                className="relative aspect-[9/16] h-[72vh] max-h-[640px] max-w-full rounded-2xl overflow-hidden bg-black shadow-2xl border border-white/20 select-none group flex items-center justify-center"
                style={{
                  transform: `translate3d(${slideOffset}px, 0px, 0px)`,
                  transition: isDragging ? 'none' : 'transform 250ms ease-out',
                }}
              >
                <video
                  src={`${currentItem.url}#t=0.001`}
                  preload="metadata"
                  playsInline
                  muted
                  className="w-full h-full object-cover select-none pointer-events-none"
                />
                {/* Play Button Overlay */}
                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors flex flex-col items-center justify-center gap-3">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/95 group-hover:bg-white text-gray-950 flex items-center justify-center shadow-2xl transition-transform group-hover:scale-110 active:scale-95">
                    <Play className="w-8 h-8 sm:w-9 sm:h-9 ml-1 fill-gray-950 text-gray-950" />
                  </div>
                  <span className="text-white text-xs sm:text-sm font-semibold tracking-wide bg-black/75 px-4 py-1.5 rounded-full border border-white/20 backdrop-blur-xs shadow-md">
                    Ver video en pantalla completa
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* Image item: displays image with zoom / pan support */
            <div
              className="relative flex items-center justify-center max-w-[94vw] max-h-[85vh] touch-none"
              style={{
                cursor: isDragging ? 'grabbing' : 'grab',
              }}
              onMouseDown={(e) => {
                if (isSyntheticOrRecentTouch()) return;
                if (e.button === 0) {
                  e.stopPropagation();
                  startGesture(e.clientX, e.clientY, true);
                }
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                handleTouchStart(e, true);
              }}
            >
              <img
                src={currentItem.url}
                alt={title || 'Detalle del producto'}
                draggable={false}
                className={`max-w-[92vw] sm:max-w-[88vw] max-h-[80vh] sm:max-h-[84vh] object-contain rounded-lg drop-shadow-2xl select-none ${
                  isDragging ? 'transition-none' : 'transition-transform duration-250 ease-out'
                }`}
                style={{
                  transform: isZoomed
                    ? `translate3d(${panPosition.x}px, ${panPosition.y}px, 0px) scale(2.0)`
                    : `translate3d(${slideOffset}px, 0px, 0px) scale(1)`,
                  touchAction: 'none',
                }}
              />
            </div>
          )
        ) : (
          <div className="text-white/70 text-sm">No hay elemento disponible</div>
        )}

        {/* Previous Item Arrow (ONLY shown when NOT zoomed, has multiple items, and on desktop) */}
        {!isZoomed && hasMultipleItems && (
          <button
            type="button"
            id="lightbox-prev-btn"
            onClick={(e) => {
              e.stopPropagation();
              prevItem();
            }}
            className="hidden sm:flex absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 z-40 w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-black/60 hover:bg-black/85 text-white items-center justify-center border border-white/25 shadow-xl transition-all hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-xs"
            title="Elemento anterior (Flecha izquierda)"
          >
            <ChevronLeft className="w-6 h-6 sm:w-7 sm:h-7" />
          </button>
        )}

        {/* Next Item Arrow (ONLY shown when NOT zoomed, has multiple items, and on desktop) */}
        {!isZoomed && hasMultipleItems && (
          <button
            type="button"
            id="lightbox-next-btn"
            onClick={(e) => {
              e.stopPropagation();
              nextItem();
            }}
            className="hidden sm:flex absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 z-40 w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-black/60 hover:bg-black/85 text-white items-center justify-center border border-white/25 shadow-xl transition-all hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-xs"
            title="Siguiente elemento (Flecha derecha)"
          >
            <ChevronRight className="w-6 h-6 sm:w-7 sm:h-7" />
          </button>
        )}
      </div>

      {/* Bottom Floating Bar: Dots (ONLY shown when NOT zoomed and multiple items exist) */}
      {!isZoomed && hasMultipleItems && (
        <div
          className="absolute bottom-3 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="pointer-events-auto flex items-center gap-1.5 bg-black/60 backdrop-blur-xs px-3.5 py-1.5 rounded-full border border-white/15">
            {items.map((mItem, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleIndexChange(idx)}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  currentIndex === idx
                    ? mItem.type === 'video'
                      ? 'w-6 bg-red-500'
                      : 'w-5 bg-white'
                    : mItem.type === 'video'
                    ? 'w-2.5 bg-red-400/70 hover:bg-red-300'
                    : 'w-2 bg-white/40 hover:bg-white/70'
                }`}
                title={mItem.type === 'video' ? 'Ver video' : `Ver imagen ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
