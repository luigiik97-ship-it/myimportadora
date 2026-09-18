import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Play, Pause, ChevronLeft, ChevronRight, Volume2, VolumeX, Sparkles } from 'lucide-react';
import { StoreVideo } from '../types';

interface HomeReelsCarouselProps {
  videos: StoreVideo[];
  onOpenViewer: (index: number) => void;
  onSelectProduct?: (productId: string) => void;
}

export const HomeReelsCarousel: React.FC<HomeReelsCarouselProps> = ({
  videos,
  onOpenViewer,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  const [activePlayingIndex, setActivePlayingIndex] = useState<number>(0);
  const [isCarouselInView, setIsCarouselInView] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(true); // Muted by default on home to allow seamless chained autoplay
  const [canScrollLeft, setCanScrollLeft] = useState<boolean>(false);
  const [canScrollRight, setCanScrollRight] = useState<boolean>(false);

  // Return null if no videos are configured
  if (!videos || videos.length === 0) {
    return null;
  }

  // Check scroll bounds for desktop buttons
  const checkScrollBounds = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = containerRef.current;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
  }, []);

  useEffect(() => {
    checkScrollBounds();
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkScrollBounds, { passive: true });
    window.addEventListener('resize', checkScrollBounds);
    return () => {
      el.removeEventListener('scroll', checkScrollBounds);
      window.removeEventListener('resize', checkScrollBounds);
    };
  }, [checkScrollBounds, videos.length]);

  // 1. IntersectionObserver on the whole carousel to pause videos when out of view
  // (Crucial for protecting Cloudinary bandwidth)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setIsCarouselInView(entry.isIntersecting);
      },
      { threshold: 0.25 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 2. Manage one-video-at-a-time playback
  useEffect(() => {
    videoRefs.current.forEach((vid, idx) => {
      if (!vid) return;
      if (isCarouselInView && idx === activePlayingIndex) {
        vid.muted = isMuted;
        const playPromise = vid.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            // Autoplay might be muted or deferred by browser
          });
        }
      } else {
        vid.pause();
      }
    });
  }, [activePlayingIndex, isCarouselInView, isMuted]);

  // 3. Chained Playback: when video finishes, advance to next
  const handleVideoEnded = (finishedIndex: number) => {
    if (finishedIndex !== activePlayingIndex) return;

    const nextIndex = (activePlayingIndex + 1) % videos.length;
    setActivePlayingIndex(nextIndex);

    // Smoothly scroll the container to center the next card
    scrollToCard(nextIndex);
  };

  const scrollToCard = (index: number) => {
    const targetCard = cardRefs.current[index];
    const container = containerRef.current;
    if (targetCard && container) {
      const containerWidth = container.clientWidth;
      const cardLeft = targetCard.offsetLeft;
      const cardWidth = targetCard.clientWidth;
      const scrollTo = cardLeft - (containerWidth / 2) + (cardWidth / 2);

      container.scrollTo({
        left: Math.max(0, scrollTo),
        behavior: 'smooth',
      });
    }
  };

  // 4. Track horizontal scroll to play the most visible video when user swipes
  const handleScroll = () => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const containerCenter = container.scrollLeft + container.clientWidth / 2;

    let closestIndex = activePlayingIndex;
    let minDistance = Infinity;

    cardRefs.current.forEach((card, idx) => {
      if (!card) return;
      const cardCenter = card.offsetLeft + card.clientWidth / 2;
      const dist = Math.abs(containerCenter - cardCenter);
      if (dist < minDistance) {
        minDistance = dist;
        closestIndex = idx;
      }
    });

    if (closestIndex !== activePlayingIndex && minDistance < 150) {
      setActivePlayingIndex(closestIndex);
    }
  };

  const scrollByAmount = (direction: 'left' | 'right') => {
    if (!containerRef.current) return;
    const scrollAmount = containerRef.current.clientWidth * 0.7;
    containerRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  return (
    <section
      id="home-reels-carousel"
      className="relative w-full max-w-[1240px] mx-auto py-2 group select-none"
    >
      {/* Navigation Arrows for Desktop */}
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scrollByAmount('left')}
          className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/95 text-gray-800 items-center justify-center shadow-md border border-gray-200 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          aria-label="Ver videos anteriores"
        >
          <ChevronLeft className="w-5 h-5 text-gray-700" />
        </button>
      )}

      {canScrollRight && (
        <button
          type="button"
          onClick={() => scrollByAmount('right')}
          className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/95 text-gray-800 items-center justify-center shadow-md border border-gray-200 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          aria-label="Ver siguientes videos"
        >
          <ChevronRight className="w-5 h-5 text-gray-700" />
        </button>
      )}

      {/* Horizontal Scrollable Container (9:16 Cards) */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex gap-2.5 sm:gap-3.5 md:gap-4 overflow-x-auto snap-x snap-mandatory no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden px-1 sm:px-2 py-1"
      >
        {videos.map((vid, idx) => {
          const isActive = idx === activePlayingIndex && isCarouselInView;

          return (
            <div
              key={vid.id || idx}
              ref={(el) => (cardRefs.current[idx] = el)}
              onClick={() => onOpenViewer(idx)}
              className="snap-start shrink-0 aspect-[9/16] w-[136px] sm:w-[165px] md:w-[195px] rounded-xl sm:rounded-2xl overflow-hidden relative bg-neutral-950 shadow-xs sm:shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer group/card border border-gray-200/80 hover:border-[#0058bb]/50"
            >
              {/* Cloudinary MP4 Video Element */}
              <video
                ref={(el) => (videoRefs.current[idx] = el)}
                src={vid.videoUrl}
                playsInline
                preload="metadata"
                loop={false}
                muted={isMuted}
                onEnded={() => handleVideoEnded(idx)}
                className="w-full h-full object-cover pointer-events-none group-hover/card:scale-105 transition-transform duration-500"
              />

              {/* Top Vignette with Reel indicator */}
              <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-black/70 via-black/20 to-transparent z-10 p-2 flex items-center justify-between">
                <div className="w-6 h-6 rounded-full bg-black/40 backdrop-blur-xs flex items-center justify-center text-white">
                  <Play className={`w-3 h-3 ${isActive ? 'fill-white text-white' : 'text-white/80'}`} />
                </div>
                {isActive && (
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                )}
              </div>

              {/* Bottom Vignette with Title and Product Tag */}
              <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-black/85 via-black/40 to-transparent z-10 p-2.5 flex flex-col justify-end">
                {vid.title && (
                  <p className="text-white text-xs sm:text-[13px] font-bold line-clamp-2 leading-tight drop-shadow-sm font-['Montserrat']">
                    {vid.title}
                  </p>
                )}
                {vid.productPrice !== undefined && (
                  <p className="text-yellow-300 text-[11px] sm:text-xs font-black mt-0.5">
                    ${vid.productPrice.toLocaleString('es-AR')}
                  </p>
                )}
              </div>

              {/* Subtle play pulse overlay when card is hovered */}
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/card:opacity-100 transition-opacity z-10 flex items-center justify-center pointer-events-none">
                <div className="w-10 h-10 rounded-full bg-white/30 backdrop-blur-md flex items-center justify-center text-white shadow-lg">
                  <Play className="w-5 h-5 ml-0.5 fill-white text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
