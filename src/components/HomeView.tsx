import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Product, Category } from '../types';
import { isProductCompletelyOutOfStock } from '../utils/variantHelpers';
import { getStorefrontCategories } from '../utils/categoryHelpers';
import { Truck, ArrowRight, ArrowLeftRight, Banknote, MapPin, Building2, Store, ChevronLeft, ChevronRight, Sparkles, ShieldCheck, Tag } from 'lucide-react';
import { ImageWithSkeleton } from './common/ImageWithSkeleton';
import { ProductGridSkeleton } from './common/ProductCardSkeleton';

interface HomeViewProps {
  products: Product[];
  categories?: Category[];
  isLoadingData?: boolean;
  onSelectProduct: (product: Product) => void;
  onSelectCategory: (category: string) => void;
  currentCategory: string;
  searchQuery: string;
}

export const HomeView: React.FC<HomeViewProps> = ({
  products,
  categories = [],
  isLoadingData = false,
  onSelectProduct,
  onSelectCategory,
  currentCategory,
  searchQuery,
}) => {
  const [currentIndex, setCurrentIndex] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  // 3 distinct hero banners
  const banners = [
    {
      id: 'banner-1',
      badge: 'Oferta Mayorista',
      badgeBg: 'bg-[#00a650]',
      title: 'Precios en efectivo',
      subtitleText: 'pagando en',
      subtitleHighlight: 'efectivo o transferencia',
      description: 'Precios directos para revendedores y comerciantes de todo el país',
      ctaText: 'Ver Catálogo',
      categoryTarget: 'Todo',
      bgGradient: 'from-slate-100 via-gray-50 to-slate-200',
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
      ctaText: 'Ver Bijouterie',
      categoryTarget: 'Bijuteria',
      bgGradient: 'from-blue-50 via-indigo-50/50 to-slate-100',
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
      ctaText: 'Ver Tecnología',
      categoryTarget: 'Tecnología',
      bgGradient: 'from-amber-50/80 via-orange-50/50 to-slate-100',
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

  // Extended banners for infinite seamless looping (clone of last at start, clone of first at end)
  const extendedBanners = [
    banners[banners.length - 1],
    ...banners,
    banners[0],
  ];

  // Auto-advance banner every 3 seconds (3000ms) in continuous loop
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setIsTransitioning(true);
      setCurrentIndex((prev) => prev + 1);
    }, 3000);

    return () => clearInterval(interval);
  }, [isPaused]);

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

  // Filter products by category and search query
  const filteredProducts = products.filter((prod) => {
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

  const bestSellers = products.filter((p) => p.isBestSeller).slice(0, 4);

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
    <div className="max-w-[1240px] mx-auto px-2 sm:px-4 py-3 sm:py-6 space-y-6 sm:space-y-10">
      {/* 1. Hero Promo Carousel (3 Banners, sliding from right to left every 3s) */}
      <div
        id="hero-banner-carousel"
        className="relative overflow-hidden rounded-xl sm:rounded-2xl border-0 sm:border border-gray-200 shadow-xs sm:shadow-sm min-h-[250px] sm:min-h-[280px] md:min-h-[300px] flex items-center group transition-all"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {/* Horizontal Slider Track */}
        <div
          className={`flex w-full h-full min-h-[250px] sm:min-h-[280px] md:min-h-[300px] ${
            isTransitioning ? 'transition-transform duration-700 ease-in-out' : ''
          }`}
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
          onTransitionEnd={handleTransitionEnd}
        >
          {extendedBanners.map((banner, index) => {
            return (
              <div
                key={`${banner.id}-slide-${index}`}
                className={`w-full min-w-full h-full min-h-[250px] sm:min-h-[280px] md:min-h-[300px] relative bg-gradient-to-r ${banner.bgGradient} flex items-center shrink-0`}
              >
                {/* Left Copy Info */}
                <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/80 to-transparent z-10 p-4 sm:p-6 md:p-10 flex flex-col justify-center max-w-xl">
                  <div
                    className={`inline-block ${banner.badgeBg} text-white text-xs md:text-sm font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-2 w-max shadow-xs`}
                  >
                    {banner.badge}
                  </div>
                  <h1 className="text-2xl sm:text-3xl md:text-5xl font-black text-gray-900 leading-tight font-['Montserrat']">
                    {banner.title}
                  </h1>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-gray-700 mt-1">
                    {banner.subtitleText}{' '}
                    <span className="text-[#0058bb]">{banner.subtitleHighlight}</span>
                  </p>
                  <p className="text-xs md:text-sm text-gray-600 mt-2 font-medium max-w-md">
                    {banner.description}
                  </p>
                  <div className="mt-3 sm:mt-4 flex items-center gap-3">
                    <button
                      onClick={() => onSelectCategory(banner.categoryTarget)}
                      className="inline-flex items-center gap-2 bg-[#0058bb] hover:bg-[#004494] text-white text-xs md:text-sm font-bold px-4 sm:px-5 py-2.5 rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer min-h-[40px]"
                    >
                      <span>{banner.ctaText}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <span className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider hidden sm:inline-block">
                      Cambio cada 3s
                    </span>
                  </div>
                </div>

                {/* Banner Visual Collage Images */}
                <div className="absolute right-0 top-0 bottom-0 w-full md:w-3/4 flex items-center justify-end gap-2 md:gap-4 pr-4 md:pr-12 opacity-85 pointer-events-none">
                  {banner.images.map((img, imgIdx) => (
                    <img
                      key={imgIdx}
                      src={img.src}
                      alt={img.alt}
                      className={img.className}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Previous Button */}
        <button
          id="btn-banner-prev"
          onClick={handlePrevBanner}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 md:w-11 md:h-11 rounded-full bg-white/90 hover:bg-white text-gray-800 shadow-md flex items-center justify-center border border-gray-200 hover:scale-105 active:scale-95 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
          aria-label="Banner anterior"
        >
          <ChevronLeft className="w-5 h-5 text-gray-700" />
        </button>

        {/* Next Button */}
        <button
          id="btn-banner-next"
          onClick={handleNextBanner}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 md:w-11 md:h-11 rounded-full bg-white/90 hover:bg-white text-gray-800 shadow-md flex items-center justify-center border border-gray-200 hover:scale-105 active:scale-95 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
          aria-label="Siguiente banner"
        >
          <ChevronRight className="w-5 h-5 text-gray-700" />
        </button>
      </div>

      {/* 2. Categorías principales (Fila horizontal desplazable) */}
      <section id="categorias-principales" className="space-y-3">
        <div className="flex items-center justify-between">
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
          className="flex items-stretch gap-2.5 sm:gap-4 overflow-x-auto pb-2 sm:pb-3 pt-1 no-scrollbar scroll-smooth snap-x touch-pan-x"
        >
          {storefrontCategories.map((cat, idx) => (
            <button
              key={cat.id || `${cat.name}-${idx}`}
              id={`cat-tile-${idx}`}
              onClick={() => onSelectCategory(cat.name)}
              className="snap-start shrink-0 w-[110px] sm:w-[140px] md:w-[150px] group flex flex-col items-center bg-white rounded-xl p-2 sm:p-2.5 border border-gray-100 sm:border-gray-200/90 shadow-2xs hover:shadow-md hover:border-[#0058bb]/50 transition-all cursor-pointer text-center justify-between"
            >
              <div className="w-full aspect-square rounded-lg overflow-hidden bg-gray-100 mb-1.5 sm:mb-2 flex items-center justify-center relative">
                <ImageWithSkeleton
                  src={cat.image}
                  alt={cat.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="w-full py-0.5">
                <span className="text-xs sm:text-sm font-semibold text-gray-800 group-hover:text-[#0058bb] transition-colors block line-clamp-1 capitalize">
                  {cat.name}
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* 3. Más vendidos */}
      <section id="mas-vendidos" className="space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 font-['Montserrat']">
            Más vendidos
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
                      src={product.images[0]}
                      alt={product.title}
                      className={`w-full h-full object-cover ${
                        isOutOfStock ? 'opacity-60 grayscale-[30%]' : 'group-hover:scale-105'
                      } transition-transform duration-300`}
                    />
                    {isOutOfStock && (
                      <span className="absolute top-2 right-2 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-xs z-10">
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
                      <div className="flex items-baseline gap-1 sm:gap-1.5 flex-wrap">
                        <span className="text-base sm:text-lg md:text-xl font-bold text-gray-900 font-['Montserrat']">
                          ${product.wholesalePrice.toLocaleString('es-AR')}
                        </span>
                        {isOutOfStock ? (
                          <span className="text-[10px] sm:text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">
                            Sin stock
                          </span>
                        ) : (
                          <span className="text-[11px] sm:text-xs font-semibold text-[#00a650]">
                            min. {product.minWholesaleQty} u.
                          </span>
                        )}
                      </div>
                      {/* Retail comparison */}
                      <div className="text-[11px] sm:text-xs text-gray-500 font-medium mt-0.5">
                        ${product.retailPrice.toLocaleString('es-AR')} x1 unidad
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* 4. Middle Promotional Banners */}
      <section id="promo-banners-mid" className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        <div className="relative rounded-xl overflow-hidden shadow-xs sm:shadow-sm h-44 sm:h-48 md:h-56 bg-neutral-900 flex items-center justify-between p-4 sm:p-6 text-white group cursor-pointer">
          <img
            src="https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800&auto=format&fit=crop&q=80"
            alt="Accessories"
            className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:scale-105 transition-transform duration-500"
          />
          <div className="relative z-10 space-y-1.5 sm:space-y-2 max-w-xs">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-yellow-400 bg-yellow-400/20 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded">
              Accessories 欧美嘻哈饰品
            </span>
            <h3 className="text-lg sm:text-xl md:text-2xl font-black font-['Montserrat'] leading-tight">
              Mercado Mayorista
            </h3>
            <p className="text-xs sm:text-sm text-gray-200">Explora nuestra colección exclusiva de cadenas y dijes.</p>
            <button className="text-xs sm:text-sm font-bold text-yellow-300 flex items-center gap-1 group-hover:underline pt-0.5">
              Ver Catálogo <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>

        <div className="relative rounded-xl overflow-hidden shadow-xs sm:shadow-sm h-44 sm:h-48 md:h-56 bg-neutral-900 flex items-center justify-between p-4 sm:p-6 text-white group cursor-pointer">
          <img
            src="https://images.unsplash.com/photo-1611591475152-47eac9806830?w=800&auto=format&fit=crop&q=80"
            alt="Gothic Fantasy"
            className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:scale-105 transition-transform duration-500"
          />
          <div className="relative z-10 space-y-1.5 sm:space-y-2 max-w-xs">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-emerald-400 bg-emerald-400/20 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded">
              Mercado Mayorista
            </span>
            <h3 className="text-lg sm:text-xl md:text-2xl font-black font-['Montserrat'] leading-tight text-white">
              THE KEY TO A <span className="text-red-400">WORLD</span> OF GOTHIC FANTASY
            </h3>
            <button className="text-xs sm:text-sm font-bold text-emerald-300 flex items-center gap-1 group-hover:underline pt-0.5">
              Descubrir Novedades <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* 5. Catálogo Completo de Productos */}
      <section id="todos-los-productos" className="space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between border-b border-gray-200 pb-2 sm:pb-3">
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 font-['Montserrat']">
            {currentCategory === 'Todo' ? 'Todos los Productos' : `Categoría: ${currentCategory}`}
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
                      src={product.images[0]}
                      alt={product.title}
                      className={`w-full h-full object-cover ${
                        isOutOfStock ? 'opacity-60 grayscale-[30%]' : 'group-hover:scale-105'
                      } transition-transform duration-300`}
                    />
                    {isOutOfStock && (
                      <span className="absolute top-2 right-2 bg-red-600 text-white text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded shadow-xs z-10">
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
                      <div className="flex items-baseline gap-1 sm:gap-1.5 flex-wrap">
                        <span className="text-base sm:text-lg font-bold text-gray-900 font-['Montserrat']">
                          ${product.wholesalePrice.toLocaleString('es-AR')}
                        </span>
                        {isOutOfStock ? (
                          <span className="text-[10px] sm:text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">
                            Sin stock
                          </span>
                        ) : (
                          <span className="text-[11px] sm:text-xs font-semibold text-[#00a650]">
                            min. {product.minWholesaleQty} u.
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] sm:text-xs text-gray-500 font-medium mt-0.5">
                        ${product.retailPrice.toLocaleString('es-AR')} x1 unidad
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
      <section id="informacion-comercial" className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-5 pt-2 sm:pt-4">
        {/* Formas de envío */}
        <div className="space-y-3">
          <h3 className="text-base font-bold text-gray-900 font-['Montserrat']">
            Formas de envío
          </h3>
          <div className="space-y-2">
            {/* Uber moto */}
            <div className="bg-[#1b1c1c] text-white p-3 rounded-lg flex items-center justify-between shadow-xs">
              <div>
                <span className="text-sm font-black tracking-tight block">Uber</span>
                <span className="text-xs font-semibold text-gray-300">moto</span>
              </div>
              <div className="text-right">
                <span className="text-xs text-gray-400 italic block">Llega</span>
                <span className="text-sm font-bold text-white flex items-center gap-1">
                  Hoy <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>

            {/* Envíos flex */}
            <div className="bg-[#a3e635] text-gray-900 p-3 rounded-lg flex items-center justify-between shadow-xs font-medium">
              <div>
                <span className="text-sm font-bold block">Envíos</span>
                <span className="text-xs font-semibold">flex</span>
              </div>
              <div className="text-right">
                <span className="text-xs text-gray-700 italic block">Llega</span>
                <span className="text-sm font-bold text-gray-900 flex items-center gap-1">
                  Mañana <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>

            {/* Correo Argentino */}
            <div className="bg-[#facc15] text-gray-900 p-3 rounded-lg flex items-center justify-between shadow-xs">
              <div>
                <span className="text-sm font-bold block">Correo</span>
                <span className="text-xs font-semibold">Argentino</span>
              </div>
              <div className="text-right">
                <span className="text-xs text-gray-700 italic block">Llega</span>
                <span className="text-sm font-bold text-gray-900 flex items-center gap-1">
                  1 a 4 días <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
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
              <div className="bg-[#e11d48] text-white p-3 rounded-lg flex items-start gap-3 shadow-xs">
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

        {/* Showroom Image showcase */}
        <div className="space-y-2">
          <h3 className="text-base font-bold text-gray-900 font-['Montserrat']">
            Exhibición
          </h3>
          <div className="h-[210px] rounded-xl overflow-hidden shadow-sm border border-gray-200">
            <img
              src="https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=600&auto=format&fit=crop&q=80"
              alt="Anillos y piedras finas"
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
            />
          </div>
        </div>
      </section>
    </div>
  );
};
