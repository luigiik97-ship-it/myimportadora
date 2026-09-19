import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { StoreBannerItem } from '../services/storeBanners';

interface IntermediateBannerSlotProps {
  slotId: string;
  banners: StoreBannerItem[];
  defaultImage: string;
  fallbackLink?: string;
  onBannerClick: (banner: { linkUrl?: string }) => void;
  autoRotateInterval?: number;
}

export const IntermediateBannerSlot: React.FC<IntermediateBannerSlotProps> = ({
  slotId,
  banners,
  defaultImage,
  fallbackLink,
  onBannerClick,
  autoRotateInterval = 3800,
}) => {
  // Filtrar banners con imagen o usar el default
  const validBanners = React.useMemo(() => {
    const list = banners.filter((b) => Boolean(b.imageUrl && b.imageUrl.trim() !== ''));
    if (list.length > 0) return list;
    return [
      {
        id: `${slotId}-default`,
        imageUrl: defaultImage,
        linkUrl: fallbackLink || '',
      },
    ];
  }, [banners, defaultImage, fallbackLink, slotId]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const isCarousel = validBanners.length > 1;

  // Rotación automática si tiene más de 1 imagen
  useEffect(() => {
    if (!isCarousel || isHovered) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % validBanners.length);
    }, autoRotateInterval);

    return () => clearInterval(timer);
  }, [isCarousel, isHovered, validBanners.length, autoRotateInterval]);

  // Si cambia la cantidad de banners y el índice queda fuera de rango
  useEffect(() => {
    if (currentIndex >= validBanners.length) {
      setCurrentIndex(0);
    }
  }, [validBanners.length, currentIndex]);

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + validBanners.length) % validBanners.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % validBanners.length);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const diff = touchStartX.current - touchEndX.current;
    if (diff > 45) {
      // Swipe izquierda -> siguiente
      setCurrentIndex((prev) => (prev + 1) % validBanners.length);
    } else if (diff < -45) {
      // Swipe derecha -> anterior
      setCurrentIndex((prev) => (prev - 1 + validBanners.length) % validBanners.length);
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  const currentBanner = validBanners[currentIndex] || validBanners[0];
  const targetLink = currentBanner?.linkUrl || fallbackLink;

  const handleClick = () => {
    if (targetLink) {
      onBannerClick({ linkUrl: targetLink });
    }
  };

  // 1. Si es solo 1 imagen -> MODO ESTÁTICO LIMPIO
  if (!isCarousel) {
    return (
      <div
        id={slotId}
        onClick={handleClick}
        className="relative rounded-xl overflow-hidden shadow-xs sm:shadow-sm h-44 sm:h-48 md:h-56 bg-neutral-100 group cursor-pointer"
        title={targetLink ? `Ir a ${targetLink}` : undefined}
      >
        <img
          src={validBanners[0].imageUrl || defaultImage}
          alt="Banner promocional"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      </div>
    );
  }

  // 2. Si son 2 o más imágenes -> MODO CARRUSEL DINÁMICO
  return (
    <div
      id={slotId}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative rounded-xl overflow-hidden shadow-xs sm:shadow-sm h-44 sm:h-48 md:h-56 bg-neutral-100 group cursor-pointer select-none"
      title={targetLink ? `Ir a ${targetLink}` : undefined}
    >
      {/* Slider Track */}
      <div
        className="flex w-full h-full transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {validBanners.map((banner, idx) => (
          <div key={banner.id || `${slotId}-slide-${idx}`} className="w-full min-w-full h-full shrink-0 relative">
            <img
              src={banner.imageUrl || defaultImage}
              alt={banner.title || `Banner ${idx + 1}`}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          </div>
        ))}
      </div>

      {/* Flechas de Navegación (aparecen en hover en pantallas grandes) */}
      <button
        type="button"
        onClick={handlePrev}
        aria-label="Banner anterior"
        className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-white/80 hover:bg-white text-gray-800 shadow-sm items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer hover:scale-105 active:scale-95"
      >
        <ChevronLeft className="w-4 h-4 text-gray-700" />
      </button>

      <button
        type="button"
        onClick={handleNext}
        aria-label="Siguiente banner"
        className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-white/80 hover:bg-white text-gray-800 shadow-sm items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer hover:scale-105 active:scale-95"
      >
        <ChevronRight className="w-4 h-4 text-gray-700" />
      </button>
    </div>
  );
};
