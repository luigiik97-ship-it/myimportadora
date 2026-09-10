import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

export interface ProductImageLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  images: string[];
  initialIndex?: number;
  title?: string;
  subtitle?: string;
  onIndexChange?: (newIndex: number) => void;
}

export const ProductImageLightbox: React.FC<ProductImageLightboxProps> = ({
  isOpen,
  onClose,
  images,
  initialIndex = 0,
  title,
  subtitle,
  onIndexChange,
}) => {
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
      const validIndex = Math.max(0, Math.min(initialIndex, Math.max(0, images.length - 1)));
      setCurrentIndex(validIndex);
      setIsZoomed(false);
      setPanPosition({ x: 0, y: 0 });
      setSlideOffset(0);
      setIsDragging(false);
      isDraggingRef.current = false;
    }
  }, [isOpen, initialIndex, images.length]);

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

  // Handle image index change and notify parent
  const handleIndexChange = useCallback(
    (newIndex: number) => {
      if (images.length <= 1) return;
      let targetIndex = newIndex;
      if (targetIndex < 0) targetIndex = images.length - 1;
      if (targetIndex >= images.length) targetIndex = 0;

      setCurrentIndex(targetIndex);
      setIsZoomed(false);
      setPanPosition({ x: 0, y: 0 });
      setSlideOffset(0);
      onIndexChange?.(targetIndex);
    },
    [images.length, onIndexChange]
  );

  const prevImage = useCallback(() => {
    handleIndexChange(currentIndex - 1);
  }, [currentIndex, handleIndexChange]);

  const nextImage = useCallback(() => {
    handleIndexChange(currentIndex + 1);
  }, [currentIndex, handleIndexChange]);

  // Keyboard navigation: Escape to close; ArrowLeft/Right only when NOT zoomed
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (!isZoomed && e.key === 'ArrowLeft') {
        prevImage();
      } else if (!isZoomed && e.key === 'ArrowRight') {
        nextImage();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isZoomed, onClose, prevImage, nextImage]);

  // --------------------------------------------------------------------------
  // Gestures (Mouse & Touch) unified engine
  // --------------------------------------------------------------------------
  const startGesture = (clientX: number, clientY: number, onImage: boolean) => {
    isDraggingRef.current = true;
    setIsDragging(true);
    isImageTargetRef.current = onImage;
    dragStartRef.current = { x: clientX, y: clientY, time: Date.now() };
    dragDistanceRef.current = 0;
    currentDeltaXRef.current = 0;

    if (isZoomedRef.current) {
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

    if (isZoomedRef.current) {
      // ZOOM 2.0x: Move (pan) the image. NEVER changes images!
      const maxPanX = Math.max(window.innerWidth * 0.55, 200);
      const maxPanY = Math.max(window.innerHeight * 0.55, 200);

      const newX = Math.max(-maxPanX, Math.min(maxPanX, startPanRef.current.x + deltaX));
      const newY = Math.max(-maxPanY, Math.min(maxPanY, startPanRef.current.y + deltaY));

      setPanPosition({ x: newX, y: newY });
    } else {
      // FULLSCREEN (1.0x): Drag horizontally to slide between images
      setSlideOffset(deltaX);
    }
  };

  const endGesture = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);

    const movedDist = dragDistanceRef.current;
    const finalDeltaX = currentDeltaXRef.current;
    const clickedOnImage = isImageTargetRef.current;
    const elapsed = Date.now() - dragStartRef.current.time;

    // Distinguish between a clean tap and a drag/swipe:
    // On mobile touchscreens, normal finger taps produce minor displacement (up to 14px) and complete quickly.
    const isTap = movedDist <= 12 || (movedDist <= 18 && elapsed < 280);

    if (isZoomedRef.current) {
      // IN ZOOM 2.0x:
      // If user dragged/panned (not a tap): KEEP ZOOM 2.0X! DO NOT EXIT, DO NOT CHANGE IMAGES!
      // If user clicked/tapped without dragging: EXIT ZOOM 2.0x and return to Pantalla completa!
      if (isTap) {
        if (Date.now() - lastZoomToggleTimeRef.current < 250) return;
        lastZoomToggleTimeRef.current = Date.now();
        setIsZoomed(false);
        setPanPosition({ x: 0, y: 0 });
      }
    } else {
      // IN FULLSCREEN (1.0x):
      // If user dragged/swiped:
      if (!isTap && movedDist > 12) {
        if (images.length > 1) {
          if (finalDeltaX < -40) {
            // Dragged left -> Next image
            nextImage();
          } else if (finalDeltaX > 40) {
            // Dragged right -> Previous image
            prevImage();
          }
        }
        setSlideOffset(0);
      } else {
        // User clicked/tapped without dragging:
        setSlideOffset(0);
        if (clickedOnImage) {
          // Tap/click on image -> ENTER ZOOM 2.0X!
          if (Date.now() - lastZoomToggleTimeRef.current < 250) return;
          lastZoomToggleTimeRef.current = Date.now();
          setIsZoomed(true);
          setPanPosition({ x: 0, y: 0 });
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
  }, [isDragging, images.length, nextImage, prevImage, onClose]);

  // Touch Handlers
  const handleTouchStart = (e: React.TouchEvent, onImage: boolean) => {
    lastTouchTimeRef.current = Date.now();
    // Guard against touch events immediately right as the modal mounts
    if (Date.now() - openTimeRef.current < 350) return;

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      startGesture(touch.clientX, touch.clientY, onImage);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    lastTouchTimeRef.current = Date.now();
    if (Date.now() - openTimeRef.current < 350) return;

    if (e.touches.length === 1 && isDraggingRef.current) {
      // Prevent browser bounce / scroll while interacting
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

  const currentImageUrl = images[currentIndex] || images[0] || '';
  const hasMultipleImages = images.length > 1;

  return (
    <div
      id="product-image-lightbox"
      className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center select-none overflow-hidden animate-in fade-in duration-200"
      onMouseDown={(e) => {
        if (isSyntheticOrRecentTouch()) return;
        // Click on outer backdrop
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
      {/* Top Bar: Title / Variant info on left, Close button on right */}
      <div
        className="absolute top-0 left-0 right-0 z-50 p-3 sm:p-5 flex items-center justify-between pointer-events-none bg-gradient-to-b from-black/60 via-black/20 to-transparent"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Product Title & Subtitle */}
        <div className="text-white max-w-[65%] sm:max-w-[75%] truncate pointer-events-auto">
          {title && (
            <h2 className="text-sm sm:text-base font-bold text-white drop-shadow-md truncate">
              {title}
            </h2>
          )}
          {subtitle && (
            <span className="inline-block text-xs text-blue-200 font-medium truncate drop-shadow-xs">
              {subtitle}
            </span>
          )}
        </div>

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

      {/* Main Image Stage */}
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
        {currentImageUrl ? (
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
              src={currentImageUrl}
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
        ) : (
          <div className="text-white/70 text-sm">No hay imagen disponible</div>
        )}

        {/* Previous Image Arrow (ONLY shown when NOT zoomed and has multiple images) */}
        {!isZoomed && hasMultipleImages && (
          <button
            type="button"
            id="lightbox-prev-btn"
            onClick={(e) => {
              e.stopPropagation();
              prevImage();
            }}
            className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 z-40 w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center border border-white/25 shadow-xl transition-all hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-xs"
            title="Imagen anterior (Flecha izquierda)"
          >
            <ChevronLeft className="w-6 h-6 sm:w-7 sm:h-7" />
          </button>
        )}

        {/* Next Image Arrow (ONLY shown when NOT zoomed and has multiple images) */}
        {!isZoomed && hasMultipleImages && (
          <button
            type="button"
            id="lightbox-next-btn"
            onClick={(e) => {
              e.stopPropagation();
              nextImage();
            }}
            className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 z-40 w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center border border-white/25 shadow-xl transition-all hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-xs"
            title="Siguiente imagen (Flecha derecha)"
          >
            <ChevronRight className="w-6 h-6 sm:w-7 sm:h-7" />
          </button>
        )}
      </div>

      {/* Bottom Floating Bar: Thumbnail Dots (ONLY shown when NOT zoomed and multiple images exist) */}
      {!isZoomed && hasMultipleImages && (
        <div
          className="absolute bottom-3 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="pointer-events-auto flex items-center gap-1.5 bg-black/50 backdrop-blur-xs px-3 py-1.5 rounded-full border border-white/10">
            {images.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleIndexChange(idx)}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  currentIndex === idx
                    ? 'w-5 bg-white'
                    : 'w-2 bg-white/40 hover:bg-white/70'
                }`}
                title={`Ver imagen ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
