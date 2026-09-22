import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Product, Category } from '../types';
import { isProductCompletelyOutOfStock } from '../utils/variantHelpers';
import { getStorefrontCategories } from '../utils/categoryHelpers';
import { Truck, ArrowRight, ArrowLeftRight, Banknote, MapPin, Building2, Store, ChevronLeft, ChevronRight, Sparkles, ShieldCheck, Tag, Rocket } from 'lucide-react';
import { ImageWithSkeleton } from './common/ImageWithSkeleton';
import { ProductGridSkeleton } from './common/ProductCardSkeleton';
import {
  getStoreBannersConfig,
  DEFAULT_STORE_BANNERS,
  StoreBannersConfig,
  fetchStoreBannersFromSupabase,
  getNormalizedHeroBanners,
  getNormalizedSecondaryBanners1,
  getNormalizedSecondaryBanners2,
} from '../services/storeBanners';
import { IntermediateBannerSlot } from './IntermediateBannerSlot';
import { HomeReelsCarousel } from './HomeReelsCarousel';
import { VideoViewerModal } from './common/VideoViewerModal';
import {
  getLocalStoreVideos,
  fetchStoreVideosFromSupabase,
} from '../services/storeVideos';
import { StoreVideo } from '../types';

interface HomeViewProps {
  products: Product[];
  categories?: Category[];
  isLoadingData?: boolean;
  onSelectProduct: (product: Product) => void;
  onSelectCategory: (category: string) => void;
  currentCategory: string;
  searchQuery: string;
  onOpenLaunches?: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  products,
  categories = [],
  isLoadingData = false,
  onSelectProduct,
  onSelectCategory,
  currentCategory,
  searchQuery,
  onOpenLaunches,
}) => {
  const [currentIndex, setCurrentIndex] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [storeBanners, setStoreBanners] = useState<StoreBannersConfig>(() => getStoreBannersConfig());
  const [storeVideos, setStoreVideos] = useState<StoreVideo[]>(() => getLocalStoreVideos());
  const [isVideoViewerOpen, setIsVideoViewerOpen] = useState(false);
  const [selectedViewerVideoIndex, setSelectedViewerVideoIndex] = useState(0);

  // Sincronizar videos desde Supabase y escuchar eventos
  useEffect(() => {
    fetchStoreVideosFromSupabase()
      .then((vids) => setStoreVideos(vids))
      .catch(() => {});

    const handleVideosUpdate = (e: CustomEvent<StoreVideo[]>) => {
      if (e.detail) {
        setStoreVideos(e.detail);
      }
    };

    window.addEventListener('my_commerce_videos_updated' as any, handleVideosUpdate as any);
    return () => {
      window.removeEventListener('my_commerce_videos_updated' as any, handleVideosUpdate as any);
    };
  }, []);

  // Consolidar videos de la tienda y de publicaciones individuales
  const allReelVideos = useMemo<StoreVideo[]>(() => {
    const list: StoreVideo[] = [...storeVideos];
    const existingUrls = new Set(list.map((v) => v.videoUrl.trim()));

    // Incluir publicaciones que tengan un video cargado
    products.forEach((p) => {
      if (p.videoUrl && p.videoUrl.trim() && !existingUrls.has(p.videoUrl.trim())) {
        existingUrls.add(p.videoUrl.trim());
        list.push({
          id: `prod-vid-${p.id}`,
          videoUrl: p.videoUrl.trim(),
          title: p.title,
          productId: p.id,
          productTitle: p.title,
          productPrice: p.wholesalePrice,
          productImage: p.images?.[0],
          sortOrder: 999,
        });
      }
    });

    return list;
  }, [storeVideos, products]);

  // Sincronizar banners desde Supabase y escuchar eventos locales
  useEffect(() => {
    fetchStoreBannersFromSupabase()
      .then((b) => setStoreBanners(b))
      .catch(() => {});

    const handleBannersUpdate = (e: CustomEvent<StoreBannersConfig>) => {
      if (e.detail) {
        setStoreBanners(e.detail);
      }
    };

    window.addEventListener('my_commerce_banners_updated' as any, handleBannersUpdate as any);
    return () => {
      window.removeEventListener('my_commerce_banners_updated' as any, handleBannersUpdate as any);
    };
  }, []);

  const firstCat = categories && categories[0] ? categories[0].name : 'Todo';
  const secondCat = categories && categories[1] ? categories[1].name : firstCat;

  // Lista normalizada de banners desde la configuración de la tienda
  const rawHeroBanners = useMemo(() => getNormalizedHeroBanners(storeBanners), [storeBanners]);
  const secondaryBanners1 = useMemo(() => getNormalizedSecondaryBanners1(storeBanners), [storeBanners]);
  const secondaryBanners2 = useMemo(() => getNormalizedSecondaryBanners2(storeBanners), [storeBanners]);

  const hasCustomImages = useMemo(() => {
    return rawHeroBanners.some((b) => Boolean(b.imageUrl && b.imageUrl.trim()));
  }, [rawHeroBanners]);

  // Si tiene 1 imagen es estático; si tiene 2 o más se vuelve un carrusel
  const banners = useMemo(() => {
    // Si no se ha configurado ninguna imagen personalizada y vienen los 3 slots iniciales
    if (!hasCustomImages && rawHeroBanners.length === 3) {
      return [
        {
          id: 'banner-1',
          badge: 'Oferta Mayorista',
          badgeBg: 'bg-[#00a650]',
          title: 'Precios en efectivo',
          subtitleText: 'pagando en',
          subtitleHighlight: 'efectivo o transferencia',
          description: 'Precios directos para revendedores y comerciantes de todo el país',
          ctaText: 'Ver Catálogo',
          linkUrl: rawHeroBanners[0]?.linkUrl || 'Todo',
          bgGradient: 'from-slate-100 via-gray-50 to-slate-200',
          customImage: rawHeroBanners[0]?.imageUrl || '',
          showText: rawHeroBanners[0]?.showText !== false,
          images: [
            {
              src: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=500&auto=format&fit=crop&q=80',
              alt: 'Joyas y Dijes',
              className: 'w-24 h-24 md:w-44 md:h-44 object-cover rounded-xl shadow-md transform -rotate-3 border-2 border-white',
            },
            {
              src: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=500&auto=format&fit=crop&q=80',
              alt: 'Relojes',
              className: 'w-28 h-28 md:w-48 md:h-48 object-cover rounded-xl shadow-lg transform rotate-2 border-2 border-white',
            },
            {
              src: 'https://images.unsplash.com/photo-1585366119957-e9730b6d0f60?w=500&auto=format&fit=crop&q=80',
              alt: 'Juguetes',
              className: 'w-24 h-24 md:w-44 md:h-44 object-cover rounded-xl shadow-md transform -rotate-2 border-2 border-white hidden sm:block',
            },
            {
              src: 'https://images.unsplash.com/photo-1541643600914-78b084683601?w=500&auto=format&fit=crop&q=80',
              alt: 'Perfumes',
              className: 'w-28 h-28 md:w-48 md:h-48 object-cover rounded-xl shadow-lg border-2 border-white hidden md:block',
            },
          ],
        },
        {
          id: 'banner-2',
          badge: 'Envíos Nacionales',
          badgeBg: 'bg-[#0058bb]',
          title: 'Despacho Inmediato',
          subtitleText: 'a todo el país por',
          subtitleHighlight: 'Expresos y Correo',
          description: 'Retirá sin costo por Av. San Pedrito 28 (Flores, CABA) de Lunes a Viernes de 11 a 17hs',
          ctaText: firstCat !== 'Todo' ? `Ver ${firstCat}` : 'Ver Catálogo',
          linkUrl: rawHeroBanners[1]?.linkUrl || firstCat,
          bgGradient: 'from-blue-50 via-indigo-50/50 to-slate-100',
          customImage: rawHeroBanners[1]?.imageUrl || '',
          showText: rawHeroBanners[1]?.showText !== false,
          images: [
            {
              src: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=500&auto=format&fit=crop&q=80',
              alt: 'Envíos y Paquetes',
              className: 'w-28 h-28 md:w-48 md:h-48 object-cover rounded-xl shadow-lg transform -rotate-2 border-2 border-white',
            },
            {
              src: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=500&auto=format&fit=crop&q=80',
              alt: 'Acero Quirúrgico',
              className: 'w-24 h-24 md:w-44 md:h-44 object-cover rounded-xl shadow-md transform rotate-3 border-2 border-white',
            },
            {
              src: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=500&auto=format&fit=crop&q=80',
              alt: 'Accesorios Premium',
              className: 'w-24 h-24 md:w-44 md:h-44 object-cover rounded-xl shadow-md transform -rotate-1 border-2 border-white hidden sm:block',
            },
          ],
        },
        {
          id: 'banner-3',
          badge: 'Precios de Fábrica',
          badgeBg: 'bg-amber-600',
          title: 'Ventas por Bulto y Surtido',
          subtitleText: 'con hasta un',
          subtitleHighlight: '40% OFF Mayorista',
          description: 'Lotes de alta rotación en Bijouterie de acero, tecnología, juguetes y bazar importado',
          ctaText: secondCat !== 'Todo' ? `Ver ${secondCat}` : 'Ver Novedades',
          linkUrl: rawHeroBanners[2]?.linkUrl || secondCat,
          bgGradient: 'from-amber-50/80 via-orange-50/50 to-slate-100',
          customImage: rawHeroBanners[2]?.imageUrl || '',
          showText: rawHeroBanners[2]?.showText !== false,
          images: [
            {
              src: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=500&auto=format&fit=crop&q=80',
              alt: 'Maquillaje y Perfumes',
              className: 'w-28 h-28 md:w-48 md:h-48 object-cover rounded-xl shadow-lg transform rotate-2 border-2 border-white',
            },
            {
              src: 'https://images.unsplash.com/photo-1559454403-b8fb88521f11?w=500&auto=format&fit=crop&q=80',
              alt: 'Peluches',
              className: 'w-24 h-24 md:w-44 md:h-44 object-cover rounded-xl shadow-md transform -rotate-3 border-2 border-white',
            },
            {
              src: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=500&auto=format&fit=crop&q=80',
              alt: 'Smartwatches',
              className: 'w-24 h-24 md:w-44 md:h-44 object-cover rounded-xl shadow-md transform rotate-1 border-2 border-white hidden sm:block',
            },
          ],
        },
      ];
    }

    // Mapeo dinámico de banners configurados
    return rawHeroBanners.map((item, idx) => ({
      id: item.id || `banner-user-${idx + 1}`,
      badge: item.title ? item.title : `Banner #${idx + 1}`,
      badgeBg: 'bg-[#0058bb]',
      title: item.title || 'Oferta Exclusiva Mayorista',
      subtitleText: 'encontrá los mejores productos',
      subtitleHighlight: 'al por mayor',
      description: 'Precios directos para revendedores y comerciantes de todo el país',
      ctaText: 'Ver Productos',
      linkUrl: item.linkUrl || 'Todo',
      bgGradient: 'from-slate-100 via-gray-50 to-slate-200',
      customImage: item.imageUrl,
      showText: item.showText !== false,
      images: [],
    }));
  }, [rawHeroBanners, hasCustomImages, firstCat, secondCat]);

  // Si tiene 1 banner es estático; si tiene más de 1 es carrusel
  const isCarousel = banners.length > 1;

  // Extended banners for infinite seamless looping (solo si es carrusel)
  const extendedBanners = useMemo(() => {
    if (banners.length <= 1) return banners;
    return [
      banners[banners.length - 1],
      ...banners,
      banners[0],
    ];
  }, [banners]);

  // Redirección o navegación al hacer clic en un banner
  const handleBannerClick = (banner: { linkUrl?: string }) => {
    if (Math.abs(dragCurrentX.current - dragStartX.current) > 10) return;
    if (!banner.linkUrl) {
      onSelectCategory('Todo');
      return;
    }
    const link = banner.linkUrl.trim();
    if (!link) {
      onSelectCategory('Todo');
      return;
    }
    if (
      link.startsWith('http://') ||
      link.startsWith('https://') ||
      link.startsWith('//') ||
      link.startsWith('wa.me')
    ) {
      const targetUrl = link.startsWith('wa.me') ? `https://${link}` : link;
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    } else if (link.startsWith('#')) {
      const el = document.querySelector(link);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    } else {
      onSelectCategory(link);
    }
  };

  // Auto-advance banner every 3.5s si es carrusel
  useEffect(() => {
    if (!isCarousel || isPaused) return;

    const interval = setInterval(() => {
      setIsTransitioning(true);
      setCurrentIndex((prev) => prev + 1);
    }, 3500);

    return () => clearInterval(interval);
  }, [isCarousel, isPaused]);

  // Interactive Touch & Drag swipe handling for mobile
  const [dragOffset, setDragOffset] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const carouselRef = useRef<HTMLDivElement>(null);
  const dragStartX = useRef<number>(0);
  const dragCurrentX = useRef<number>(0);
  const isPointerDown = useRef<boolean>(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    isPointerDown.current = true;
    const clientX = e.targetTouches[0].clientX;
    dragStartX.current = clientX;
    dragCurrentX.current = clientX;
    setIsDragging(true);
    setIsPaused(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPointerDown.current) return;
    const clientX = e.targetTouches[0].clientX;
    dragCurrentX.current = clientX;
    const delta = clientX - dragStartX.current;
    setDragOffset(delta);
  };

  const handleTouchEnd = () => {
    if (!isPointerDown.current) return;
    isPointerDown.current = false;
    setIsDragging(false);
    setIsPaused(false);

    const delta = dragCurrentX.current - dragStartX.current;
    const containerWidth = carouselRef.current?.offsetWidth || window.innerWidth;
    const minSwipeDistance = Math.min(40, containerWidth * 0.12);

    setDragOffset(0);

    if (delta < -minSwipeDistance) {
      handleNextBanner();
    } else if (delta > minSwipeDistance) {
      handlePrevBanner();
    } else {
      setIsTransitioning(true);
    }
  };

  // Mouse drag support for desktop emulation of mobile gestures
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isPointerDown.current = true;
    dragStartX.current = e.clientX;
    dragCurrentX.current = e.clientX;
    setIsDragging(true);
    setIsPaused(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPointerDown.current) return;
    const clientX = e.clientX;
    dragCurrentX.current = clientX;
    const delta = clientX - dragStartX.current;
    setDragOffset(delta);
  };

  const handleMouseUp = () => {
    if (!isPointerDown.current) return;
    isPointerDown.current = false;
    setIsDragging(false);
    setIsPaused(false);

    const delta = dragCurrentX.current - dragStartX.current;
    const containerWidth = carouselRef.current?.offsetWidth || window.innerWidth;
    const minSwipeDistance = Math.min(40, containerWidth * 0.12);

    setDragOffset(0);

    if (delta < -minSwipeDistance) {
      handleNextBanner();
    } else if (delta > minSwipeDistance) {
      handlePrevBanner();
    } else {
      setIsTransitioning(true);
    }
  };

  const handlePrevBanner = () => {
    setIsTransitioning(true);
    setCurrentIndex((prev) => prev - 1);
  };

  const handleNextBanner = () => {
    setIsTransitioning(true);
    setCurrentIndex((prev) => prev + 1);
  };

  const handleTransitionEnd = () => {
    if (currentIndex >= banners.length + 1) {
      setIsTransitioning(false);
      setCurrentIndex(1);
    } else if (currentIndex <= 0) {
      setIsTransitioning(false);
      setCurrentIndex(banners.length);
    }
  };

  // Mapas de pesos aleatorios independientes para cada sector (estables por carga/visita, aleatorios en cada actualización/recarga)
  const bestSellersRandomMap = useRef<Map<string, number>>(new Map());
  const catalogRandomMap = useRef<Map<string, number>>(new Map());

  const getBestSellerWeight = (id: string) => {
    if (!bestSellersRandomMap.current.has(id)) {
      bestSellersRandomMap.current.set(id, Math.random());
    }
    return bestSellersRandomMap.current.get(id)!;
  };

  const getCatalogWeight = (id: string) => {
    if (!catalogRandomMap.current.has(id)) {
      catalogRandomMap.current.set(id, Math.random());
    }
    return catalogRandomMap.current.get(id)!;
  };

  // 1. Más vendidos: productos destacados en orden aleatorio independiente
  const bestSellers = useMemo(() => {
    const sellers = products.filter((p) => p.isBestSeller);
    return [...sellers]
      .sort((a, b) => getBestSellerWeight(a.id) - getBestSellerWeight(b.id))
      .slice(0, 4);
  }, [products]);

  // 2. Todos los productos: catálogo filtrado en orden aleatorio independiente
  const filteredProducts = useMemo(() => {
    const matched = products.filter((prod) => {
      const matchesCategory =
        currentCategory === 'Todo' ||
        prod.category.toLowerCase() === currentCategory.toLowerCase() ||
        (prod.subcategory && prod.subcategory.toLowerCase() === currentCategory.toLowerCase());

      const matchesSearch =
        !searchQuery ||
        prod.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        prod.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        prod.category.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesCategory && matchesSearch;
    });

    return [...matched].sort((a, b) => getCatalogWeight(a.id) - getCatalogWeight(b.id));
  }, [products, currentCategory, searchQuery]);

  // Get visible categories with independent images and dynamic product counts
  const storefrontCategories = useMemo(
    () => getStorefrontCategories(categories, products),
    [categories, products]
  );

  const categoriesScrollRef = useRef<HTMLDivElement>(null);

  const scrollCategories = (direction: 'left' | 'right') => {
    if (categoriesScrollRef.current) {
      const scrollAmount = 320;
      categoriesScrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  return (
    <div className="w-full">
      {/* Franja Informativa Superior (Imagen de alta definición sin pixelado) */}
      <section
        id="franja-informativa-inicio"
        className="w-full bg-[#F3D72D] border-b border-black/10 flex items-center justify-center overflow-hidden py-0.5"
      >
        <div className="w-full max-w-[1240px] mx-auto flex items-center justify-center px-2">
          <img
            src="https://zzkzssqwpcacmegmxerb.supabase.co/storage/v1/object/public/product-images/products/yjgjghkyuytiti.jpg?v=3"
            alt="Información mayorista y minorista | Tienda oficial"
            className="w-auto h-auto max-w-full max-h-[46px] min-[400px]:max-h-[52px] object-contain mx-auto select-none pointer-events-none"
            draggable={false}
          />
        </div>
      </section>

      {/* 1. Hero Promo Carousel o Banner Estático */}
      <section className="w-full max-w-[1240px] mx-auto">
        {!isCarousel ? (
          /* ================= BANNER ESTÁTICO (1 sola imagen) ================= */
          <div
            id="hero-banner-static"
            onClick={() => handleBannerClick(banners[0])}
            className={`relative w-full overflow-hidden border-0 shadow-none rounded-none aspect-[1920/910] sm:aspect-auto min-h-0 sm:min-h-[290px] md:min-h-[330px] flex items-center bg-gradient-to-r ${
              banners[0].bgGradient
            } select-none ${banners[0].linkUrl ? 'cursor-pointer' : ''}`}
            title={banners[0].linkUrl ? `Ir a ${banners[0].linkUrl}` : undefined}
          >
            {banners[0].customImage ? (
              <img
                src={banners[0].customImage}
                alt={banners[0].title}
                draggable={false}
                className="absolute inset-0 w-full h-full object-cover z-0 select-none pointer-events-none"
              />
            ) : (
              /* Banner Visual Collage Images (fallback si no hay imagen personalizada) */
              <div className="absolute inset-0 w-full h-full flex items-center justify-center gap-3 sm:gap-6 p-4 opacity-95 pointer-events-none overflow-hidden">
                {banners[0].images?.map((img, imgIdx) => (
                  <img
                    key={imgIdx}
                    src={img.src}
                    alt={img.alt}
                    className={img.className}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ================= BANNER CARRUSEL (2 o más imágenes) ================= */
          <div
            id="hero-banner-carousel"
            ref={carouselRef}
            className="relative w-full overflow-hidden border-0 shadow-none rounded-none aspect-[1920/910] sm:aspect-auto min-h-0 sm:min-h-[290px] md:min-h-[330px] flex items-center group select-none touch-pan-y cursor-grab active:cursor-grabbing"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => {
              if (isPointerDown.current) handleMouseUp();
              setIsPaused(false);
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          >
            {/* Horizontal Slider Track */}
            <div
              className={`flex w-full h-full aspect-[1920/910] sm:aspect-auto min-h-0 sm:min-h-[290px] md:min-h-[330px] ${
                isTransitioning && !isDragging ? 'transition-transform duration-500 ease-out' : ''
              }`}
              style={{
                transform: isDragging
                  ? `translateX(calc(-${currentIndex * 100}% + ${dragOffset}px))`
                  : `translateX(-${currentIndex * 100}%)`,
              }}
              onTransitionEnd={handleTransitionEnd}
            >
              {extendedBanners.map((banner, index) => {
                return (
                  <div
                    key={`${banner.id}-slide-${index}`}
                    onClick={() => handleBannerClick(banner)}
                    className={`w-full min-w-full h-full aspect-[1920/910] sm:aspect-auto min-h-0 sm:min-h-[290px] md:min-h-[330px] relative bg-gradient-to-r ${
                      banner.bgGradient
                    } flex items-center shrink-0 overflow-hidden select-none ${
                      banner.linkUrl ? 'cursor-pointer' : ''
                    }`}
                  >
                    {/* Custom Hero Banner Image */}
                    {banner.customImage ? (
                      <img
                        src={banner.customImage}
                        alt={banner.title}
                        draggable={false}
                        className="absolute inset-0 w-full h-full object-cover z-0 select-none pointer-events-none"
                      />
                    ) : (
                      /* Banner Visual Collage Images (fallback si no hay imagen personalizada) */
                      <div className="absolute inset-0 w-full h-full flex items-center justify-center gap-3 sm:gap-6 p-4 opacity-95 pointer-events-none overflow-hidden">
                        {banner.images?.map((img, imgIdx) => (
                          <img
                            key={imgIdx}
                            src={img.src}
                            alt={img.alt}
                            className={img.className}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Previous Button (oculto en móvil) */}
            <button
              id="btn-banner-prev"
              onClick={handlePrevBanner}
              className="hidden sm:flex absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/80 hover:bg-white text-gray-800 shadow-sm items-center justify-center border border-gray-200/80 hover:scale-105 active:scale-95 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
              aria-label="Banner anterior"
            >
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 text-gray-700" />
            </button>

            {/* Next Button (oculto en móvil) */}
            <button
              id="btn-banner-next"
              onClick={handleNextBanner}
              className="hidden sm:flex absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/80 hover:bg-white text-gray-800 shadow-sm items-center justify-center border border-gray-200/80 hover:scale-105 active:scale-95 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
              aria-label="Siguiente banner"
            >
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-700" />
            </button>

            {/* Bottom Dots Indicator (Oculto) */}
            <div className="hidden absolute bottom-2 sm:bottom-3 inset-x-0 z-20 items-center justify-center gap-1.5 pointer-events-auto">
              {banners.map((_, dotIdx) => {
                const activeSlide = (currentIndex - 1 + banners.length) % banners.length;
                const isActive = activeSlide === dotIdx;
                return (
                  <button
                    key={dotIdx}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsTransitioning(true);
                      setCurrentIndex(dotIdx + 1);
                    }}
                    className={`h-1.5 sm:h-2 rounded-full transition-all duration-300 cursor-pointer ${
                      isActive ? 'w-6 sm:w-8 bg-[#0058bb]' : 'w-1.5 sm:w-2 bg-black/25 hover:bg-black/45'
                    }`}
                    aria-label={`Ir al banner ${dotIdx + 1}`}
                  />
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Main Content Area */}
      <div className="max-w-[1240px] mx-auto px-2 sm:px-4 pt-1.5 sm:pt-2.5 pb-4 sm:pb-6 space-y-4 sm:space-y-6">
        {/* 2. Categorías principales (Fila horizontal desplazable) */}
      <section id="categorias-principales">
        <div className="hidden">
          <div>
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 font-['Montserrat']">
              Categorías principales
            </h2>
          </div>

          {/* Desktop Left/Right Navigation buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => scrollCategories('left')}
              className="w-8 h-8 rounded-full border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 shadow-2xs hover:scale-105 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
              aria-label="Desplazar a la izquierda"
              title="Desplazar categorías hacia la izquierda"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <button
              onClick={() => scrollCategories('right')}
              className="w-8 h-8 rounded-full border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 shadow-2xs hover:scale-105 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
              aria-label="Desplazar a la derecha"
              title="Desplazar categorías hacia la derecha"
            >
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Horizontal scrollable row */}
        <div
          ref={categoriesScrollRef}
          className="flex items-stretch gap-2.5 sm:gap-4 overflow-x-auto pt-2 pb-3.5 sm:pb-4 px-1 sm:px-1.5 -mb-2 sm:-mb-2.5 no-scrollbar scroll-smooth snap-x touch-auto"
        >
          {storefrontCategories.map((cat, idx) => (
            <button
              key={cat.id ? `${cat.id}-${idx}` : `${cat.name}-${idx}`}
              id={`cat-tile-${idx}`}
              onClick={() => onSelectCategory(cat.name)}
              className="snap-start shrink-0 w-[85px] sm:w-[108px] md:w-[117px] aspect-[3/4] group relative rounded-xl overflow-hidden shadow-md transition-transform active:scale-[0.98] cursor-pointer p-0 border-0"
            >
              <ImageWithSkeleton
                src={cat.image}
                alt={cat.name}
                className="w-full h-full"
                imgClassName="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute bottom-1.5 sm:bottom-2 inset-x-0 flex items-center justify-center px-1.5 pointer-events-none">
                <div className="bg-black/90 text-white px-2 sm:px-2.5 py-0.5 rounded-md shadow-sm max-w-[94%] flex items-center justify-center">
                  <span className="text-[11px] min-[360px]:text-[12px] sm:text-[13px] font-semibold text-white truncate capitalize text-center leading-tight">
                    {cat.name}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* 3. Más vendidos */}
      <section id="mas-vendidos" className="space-y-2 sm:space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="inline-flex items-center">
            <img
              src="https://zzkzssqwpcacmegmxerb.supabase.co/storage/v1/object/public/product-images/products/yjgjghkutut.png?v=3"
              alt="Más vendidos"
              className="h-[24px] sm:h-[27px] md:h-[31px] w-auto object-contain select-none pointer-events-none rounded-[6px] sm:rounded-[7px]"
              draggable={false}
            />
            <span className="sr-only">Más vendidos</span>
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3.5 md:gap-5">
          {isLoadingData && bestSellers.length === 0 ? (
            <ProductGridSkeleton count={4} />
          ) : (
            bestSellers.map((product) => {
              const isOutOfStock = isProductCompletelyOutOfStock(product);

              return (
                <div
                  key={product.id}
                  id={`product-card-${product.id}`}
                  onClick={() => onSelectProduct(product)}
                  className="group bg-white rounded-xl border border-gray-100 sm:border-gray-200/90 overflow-hidden shadow-2xs hover:shadow-lg hover:border-[#0058bb]/50 transition-all cursor-pointer flex flex-col"
                >
                  {/* Product Thumbnail */}
                  <div className="relative aspect-square w-full bg-gray-100 flex items-center justify-center overflow-hidden border-b border-gray-100">
                    <ImageWithSkeleton
                      src={(product.images && product.images[0]) || 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=400'}
                      alt={product.title}
                      className={`w-full h-full object-cover ${
                        isOutOfStock ? 'opacity-60 grayscale-[30%]' : 'group-hover:scale-105'
                      } transition-transform duration-300`}
                    />
                    {isOutOfStock && (
                      <span className="absolute top-2 right-2 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded shadow-xs z-10">
                        Sin stock
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-2.5 sm:p-3.5 flex-1 flex flex-col justify-between space-y-1.5 sm:space-y-2">
                    <h3 className="text-xs sm:text-sm font-semibold text-gray-800 line-clamp-2 leading-snug group-hover:text-[#0058bb] transition-colors">
                      {product.title}
                    </h3>

                    <div className="pt-0.5 sm:pt-1">
                      {/* Wholesale Price Highlight */}
                      <div className="flex items-center gap-1 sm:gap-1.5 flex-nowrap min-w-0">
                        <span className="text-base sm:text-lg font-bold text-gray-900 font-['Montserrat'] shrink-0">
                          ${product.wholesalePrice.toLocaleString('es-AR')}
                        </span>
                        {isOutOfStock ? (
                          <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded shrink-0">
                            Sin stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-[11px] sm:text-[13.2px] font-semibold bg-[#00a650] text-white px-1 py-0.5 rounded leading-tight shrink min-w-0">
                            <span className="overflow-hidden whitespace-nowrap text-clip block min-w-0">
                              desde {product.minWholesaleQty} unids
                            </span>
                          </span>
                        )}
                      </div>
                      {/* Retail comparison */}
                      <div className="text-xs text-gray-500 font-normal mt-0.5">
                        1 unidad ${product.retailPrice.toLocaleString('es-AR')}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* 4. Middle Promotional Banners (Independientes: estático si es 1 imagen, carrusel si son 2 o más) */}
      <section id="promo-banners-mid" className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        <IntermediateBannerSlot
          slotId="promo-banner-mid-1"
          banners={secondaryBanners1}
          defaultImage={DEFAULT_STORE_BANNERS.secondaryBanner1}
          fallbackLink="Todo"
          onBannerClick={handleBannerClick}
          autoRotateInterval={3600}
        />

        <IntermediateBannerSlot
          slotId="promo-banner-mid-2"
          banners={secondaryBanners2}
          defaultImage={DEFAULT_STORE_BANNERS.secondaryBanner2}
          fallbackLink={secondCat || 'Todo'}
          onBannerClick={handleBannerClick}
          autoRotateInterval={4200}
        />
      </section>

      {/* 4.5 Carrusel 9:16 sin título tipo Reels (debajo de los dos banners) */}
      {allReelVideos.length > 0 && (
        <HomeReelsCarousel
          videos={allReelVideos}
          onOpenViewer={(idx) => {
            setSelectedViewerVideoIndex(idx);
            setIsVideoViewerOpen(true);
          }}
          onSelectProduct={(productId) => {
            const prod = products.find((p) => p.id === productId);
            if (prod) onSelectProduct(prod);
          }}
        />
      )}

      {/* 5. Catálogo Completo de Productos */}
      <section id="todos-los-productos" className="space-y-2.5 sm:space-y-3">
        <div className="flex items-center justify-between border-b border-gray-200 pb-1.5 sm:pb-2">
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 font-['Montserrat']">
            {currentCategory === 'Todo' ? 'Destacados' : `Categoría: ${currentCategory}`}
          </h2>
        </div>

        {isLoadingData && filteredProducts.length === 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3.5 md:gap-4">
            <ProductGridSkeleton count={10} />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12 sm:py-16 bg-white rounded-xl border-0 sm:border border-gray-200 p-6 sm:p-8 space-y-3 shadow-xs">
            <p className="text-base text-gray-600 font-medium">
              No encontramos productos que coincidan con tu búsqueda o filtro.
            </p>
            <button
              onClick={() => {
                onSelectCategory('Todo');
              }}
              className="text-sm font-semibold text-[#0058bb] hover:underline cursor-pointer"
            >
              Ver todos los productos
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3.5 md:gap-4">
            {filteredProducts.map((product) => {
              const isOutOfStock = isProductCompletelyOutOfStock(product);

              return (
                <div
                  key={product.id}
                  id={`catalog-product-${product.id}`}
                  onClick={() => onSelectProduct(product)}
                  className="group bg-white rounded-xl border border-gray-100 sm:border-gray-200/90 overflow-hidden shadow-2xs hover:shadow-lg hover:border-[#0058bb]/50 transition-all cursor-pointer flex flex-col"
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-square w-full bg-gray-100 flex items-center justify-center overflow-hidden border-b border-gray-100">
                    <ImageWithSkeleton
                      src={(product.images && product.images[0]) || 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=400'}
                      alt={product.title}
                      className={`w-full h-full object-cover ${
                        isOutOfStock ? 'opacity-60 grayscale-[30%]' : 'group-hover:scale-105'
                      } transition-transform duration-300`}
                    />
                    {isOutOfStock && (
                      <span className="absolute top-2 right-2 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded shadow-xs z-10">
                        Sin stock
                      </span>
                    )}
                  </div>

                  {/* Details */}
                  <div className="p-2.5 sm:p-3 flex-1 flex flex-col justify-between space-y-1.5 sm:space-y-2">
                    <h3 className="text-xs sm:text-sm font-semibold text-gray-800 line-clamp-2 leading-snug group-hover:text-[#0058bb] transition-colors">
                      {product.title}
                    </h3>

                    <div className="pt-0.5 sm:pt-1">
                      <div className="flex items-center gap-1 sm:gap-1.5 flex-nowrap min-w-0">
                        <span className="text-base sm:text-lg font-bold text-gray-900 font-['Montserrat'] shrink-0">
                          ${product.wholesalePrice.toLocaleString('es-AR')}
                        </span>
                        {isOutOfStock ? (
                          <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded shrink-0">
                            Sin stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-[11px] sm:text-[13.2px] font-semibold bg-[#00a650] text-white px-1 py-0.5 rounded leading-tight shrink min-w-0">
                            <span className="overflow-hidden whitespace-nowrap text-clip block min-w-0">
                              desde {product.minWholesaleQty} unids
                            </span>
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 font-normal mt-0.5">
                        1 unidad ${product.retailPrice.toLocaleString('es-AR')}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 6. Formas de Envío, Medios de Pago y Direcciones (Matching Image 9 bottom tiles) */}
      <section id="informacion-comercial" className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-5 pt-1 sm:pt-2.5">
        {/* Formas de envío */}
        <div className="space-y-3">
          <h3 className="text-base font-bold text-gray-900 font-['Montserrat']">
            Formas de envío
          </h3>
          <div className="space-y-2">
            {/* Uber moto */}
            <div className="rounded-lg overflow-hidden shadow-xs w-full aspect-[2038/512] bg-[#1d1d1b] flex items-center justify-center">
              <img
                src="https://zzkzssqwpcacmegmxerb.supabase.co/storage/v1/object/public/product-images/products/btgh.jpg"
                alt="Uber Moto"
                className="w-full h-full object-cover [image-rendering:-webkit-optimize-contrast] [image-rendering:high-quality] [transform:translateZ(0)] [backface-visibility:hidden]"
                width={2038}
                height={512}
                loading="eager"
                decoding="async"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Envíos flex */}
            <div className="rounded-lg overflow-hidden shadow-xs w-full aspect-[2038/512] bg-[#a5cb2a] flex items-center justify-center">
              <img
                src="https://zzkzssqwpcacmegmxerb.supabase.co/storage/v1/object/public/product-images/products/btgf.jpg"
                alt="Envíos Flex"
                className="w-full h-full object-cover [image-rendering:-webkit-optimize-contrast] [image-rendering:high-quality] [transform:translateZ(0)] [backface-visibility:hidden]"
                width={2038}
                height={512}
                loading="eager"
                decoding="async"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Correo Argentino */}
            <div className="rounded-lg overflow-hidden shadow-xs w-full aspect-[2038/512] bg-[#fccc04] flex items-center justify-center">
              <img
                src="https://zzkzssqwpcacmegmxerb.supabase.co/storage/v1/object/public/product-images/products/bgt.jpg"
                alt="Correo Argentino"
                className="w-full h-full object-cover [image-rendering:-webkit-optimize-contrast] [image-rendering:high-quality] [transform:translateZ(0)] [backface-visibility:hidden]"
                width={2038}
                height={512}
                loading="eager"
                decoding="async"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>

        {/* Medios de Pago & Direcciones */}
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-bold text-gray-900 font-['Montserrat'] mb-2">
              Medios de pago
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white border border-gray-200 rounded-lg p-3 flex flex-col items-center justify-center text-center shadow-xs">
                <ArrowLeftRight className="w-6 h-6 text-[#0058bb] mb-1" />
                <span className="text-sm font-semibold text-gray-800">Transferencia</span>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-3 flex flex-col items-center justify-center text-center shadow-xs">
                <Banknote className="w-6 h-6 text-[#00a650] mb-1" />
                <span className="text-sm font-semibold text-gray-800">Efectivo</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-base font-bold text-gray-900 font-['Montserrat'] mb-2">
              Direcciones
            </h3>
            <div className="space-y-2">
              <div className="bg-[#f24ba8] text-white p-3 rounded-lg flex items-start gap-3 shadow-xs">
                <Store className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider block">Local</span>
                  <p className="text-sm text-white/90">Av. San Pedrito 28, CABA.</p>
                  <p className="text-xs text-white/80">Lunes a sábados de 11hs a 17hs</p>
                </div>
              </div>

              <div className="bg-[#262626] text-white p-3 rounded-lg flex items-start gap-3 shadow-xs">
                <Building2 className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider block">Depósito</span>
                  <p className="text-sm text-white/90">Carhue 2532, CABA.</p>
                  <p className="text-xs text-white/80">Lunes a viernes de 10hs a 11hs</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 🚀 Sección de Próximos Lanzamientos Teaser */}
        <div id="home-proximos-lanzamientos" className="bg-gradient-to-r from-[#003882] via-[#0058bb] to-[#0074f0] rounded-2xl p-4 sm:p-6 text-white shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center sm:text-left">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/15 text-yellow-300 font-bold text-[10px] sm:text-[11px] uppercase tracking-wider">
              <Sparkles className="w-3 h-3 fill-current" />
              <span>Comunidad</span>
            </div>
            <h3 className="text-base sm:text-lg font-black font-['Montserrat'] text-white">
              Próximos Lanzamientos: Tu voto define los ingresos
            </h3>
            <p className="text-xs sm:text-sm text-white/90 max-w-xl">
              Modelos identificados por letras (A, B, C, D...). Votá con 3 niveles de interés sin registro previo, o proponé tus modelos favoritos.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenLaunches || (() => window.location.assign('/lanzamientos'))}
            className="w-full sm:w-auto px-5 py-2.5 bg-yellow-400 hover:bg-yellow-300 text-gray-950 font-black text-xs sm:text-sm rounded-xl transition-all shadow-xs active:scale-95 flex items-center justify-center gap-2 shrink-0 cursor-pointer"
          >
            <Rocket className="w-4 h-4 text-gray-950 fill-current" />
            <span>Ver y Votar Modelos</span>
          </button>
        </div>

        {/* Showroom Image showcase */}
        <div className="space-y-2">
          <h3 className="text-base font-bold text-gray-900 font-['Montserrat']">
            Exhibición
          </h3>
          <div
            onClick={() => {
              if (storeBanners.showroomImageLink) {
                handleBannerClick({ linkUrl: storeBanners.showroomImageLink });
              }
            }}
            className={`h-[210px] rounded-xl overflow-hidden shadow-sm border border-gray-200 ${
              storeBanners.showroomImageLink ? 'cursor-pointer group' : ''
            }`}
            title={storeBanners.showroomImageLink ? `Ir a ${storeBanners.showroomImageLink}` : undefined}
          >
            <img
              src={storeBanners.showroomImage || DEFAULT_STORE_BANNERS.showroomImage}
              alt="Anillos y piedras finas"
              className={`w-full h-full object-cover ${
                storeBanners.showroomImageLink ? 'group-hover:scale-105 transition-transform duration-500' : 'hover:scale-105 transition-transform duration-500'
              }`}
            />
          </div>
        </div>
      </section>
      </div>

      {/* Visor de Pantalla Completa 9:16 con Sonido Activado y Deslizable */}
      <VideoViewerModal
        isOpen={isVideoViewerOpen}
        onClose={() => setIsVideoViewerOpen(false)}
        videos={allReelVideos}
        initialIndex={selectedViewerVideoIndex}
        products={products}
        onSelectProduct={(productId) => {
          const prod = products.find((p) => p.id === productId);
          if (prod) onSelectProduct(prod);
        }}
      />
    </div>
  );
};
