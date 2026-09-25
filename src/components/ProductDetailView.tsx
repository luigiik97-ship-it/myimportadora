import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Product, SizeVariant, VariantOption, VariantType } from '../types';
import {
  normalizeVariantTypes,
  getActiveVariantImages,
  isOptionOutOfStock,
  getSelectedVariantStock,
  getFirstInStockVariantOptions,
  getOptionStock,
  isProductCompletelyOutOfStock,
  getResolvedProductPrices,
} from '../utils/variantHelpers';
import { ClassicStar as Star } from './common/ClassicStar';
import { MichyOfficialBadge } from './common/MichyOfficialBadge';
import { ImageWithSkeleton } from './common/ImageWithSkeleton';
import { ProductImageLightbox } from './common/ProductImageLightbox';
import { VideoViewerModal } from './common/VideoViewerModal';
import { ProductBottomVideoPlayer } from './common/ProductBottomVideoPlayer';
import { ProductCardBadge } from './common/ProductCardBadge';
import { StoreVideo } from '../types';
import { usePurchaseMode } from '../context/PurchaseModeContext';
import {
  Truck,
  ShieldCheck,
  Check,
  ArrowLeft,
  Minus,
  Plus,
  Banknote,
  Store,
  Sparkles,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  ShoppingBag,
  ArrowRight as ArrowRightIcon,
  Play,
  Maximize2,
  Video as VideoIcon,
} from 'lucide-react';

interface ProductDetailViewProps {
  product: Product;
  allProducts: Product[];
  initialSelectedVariants?: Record<string, string>;
  initialSelectedImage?: string;
  backLabel?: string;
  onBack: () => void;
  onGoToCart?: () => void;
  onAddToCart: (
    product: Product,
    selectedColor?: string,
    selectedSizeVariant?: SizeVariant,
    quantity?: number,
    selectedImage?: string,
    selectedVariants?: Record<string, string>
  ) => void;
  onBuyNow: (
    product: Product,
    selectedColor?: string,
    selectedSizeVariant?: SizeVariant,
    quantity?: number,
    selectedImage?: string,
    selectedVariants?: Record<string, string>
  ) => void;
  onSelectRelated: (product: Product) => void;
}

// Helper to format variant names (e.g. Color, Largo, Grosor de cadena)
const formatVariantTypeName = (name: string): string => {
  if (!name) return '';
  const trimmed = name.trim();
  if (trimmed === trimmed.toUpperCase() && trimmed.length > 1) {
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
  }
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

export const ProductDetailView: React.FC<ProductDetailViewProps> = ({
  product,
  allProducts,
  initialSelectedVariants,
  initialSelectedImage,
  backLabel,
  onBack,
  onGoToCart,
  onAddToCart,
  onBuyNow,
  onSelectRelated,
}) => {
  // Helper to compute initial options taking into account incoming initialSelectedVariants
  const resolveInitialOptions = (prod: Product, incoming?: Record<string, string>) => {
    const normTypes = normalizeVariantTypes(prod);
    const defaults = getFirstInStockVariantOptions(prod);
    const result: Record<string, string> = { ...defaults };

    if (incoming && Object.keys(incoming).length > 0) {
      normTypes.forEach((vt) => {
        const val =
          incoming[vt.id] ||
          incoming[vt.name] ||
          Object.entries(incoming).find(
            ([k]) => k.toLowerCase() === vt.id.toLowerCase() || k.toLowerCase() === vt.name.toLowerCase()
          )?.[1];

        if (val) {
          const matchedOpt = vt.options.find(
            (o) => o.name.toLowerCase() === val.toLowerCase() || o.id.toLowerCase() === val.toLowerCase()
          );
          if (matchedOpt) {
            result[vt.id] = matchedOpt.name;
            result[vt.name] = matchedOpt.name;
          }
        }
      });
    }

    return result;
  };

  // Normalized variant types (supports 0, 1, or 2 distinct variant axes: e.g. Color/Modelo and/or Tamaño/Medida)
  const variantTypes: VariantType[] = useMemo(() => normalizeVariantTypes(product), [product]);

  // Last interacted variant type ID to prioritize its gallery when multiple variants exist
  const [lastSelectedTypeId, setLastSelectedTypeId] = useState<string | undefined>(() => {
    const norm = normalizeVariantTypes(product);
    return norm[0]?.id;
  });

  // Selected options state: mapping from variantTypeId (and variantTypeName) to selected option name
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(() => {
    return resolveInitialOptions(product, initialSelectedVariants);
  });

  // Active media index in the currently displayed gallery (0 = first image as principal)
  const [activeMediaIndex, setActiveMediaIndex] = useState<number>(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState<boolean>(false);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState<boolean>(false);

  // Active gallery of images based on current variant selection (falls back to product.images)
  const activeImages: string[] = useMemo(() => {
    return getActiveVariantImages(product, selectedOptions, lastSelectedTypeId);
  }, [product, selectedOptions, lastSelectedTypeId]);

  // Gallery items including video as second thumbnail if present
  const galleryMedia = useMemo<{ type: 'image' | 'video'; url: string; imageIndex?: number }[]>(() => {
    const items: { type: 'image' | 'video'; url: string; imageIndex?: number }[] = [];
    const baseImages =
      activeImages.length > 0
        ? activeImages
        : product.images && product.images.length > 0
        ? product.images
        : ['https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800'];

    // 1st item: First image (principal)
    if (baseImages[0]) {
      items.push({ type: 'image', url: baseImages[0], imageIndex: 0 });
    }

    // 2nd item: If product has video, show video as second thumbnail with autoplay
    if (product.videoUrl && product.videoUrl.trim()) {
      items.push({ type: 'video', url: product.videoUrl.trim() });
    }

    // Remaining images
    for (let i = 1; i < baseImages.length; i++) {
      items.push({ type: 'image', url: baseImages[i], imageIndex: i });
    }

    return items;
  }, [activeImages, product.images, product.videoUrl]);

  // List of videos for the full-screen 9:16 VideoViewerModal
  const productReelsVideos = useMemo<StoreVideo[]>(() => {
    if (!product.videoUrl || !product.videoUrl.trim()) return [];
    const list: StoreVideo[] = [
      {
        id: `prod-vid-${product.id}`,
        videoUrl: product.videoUrl.trim(),
        title: product.title,
        createdAt: product.createdAt || new Date().toISOString(),
      },
    ];

    // Include other products that have video
    allProducts.forEach((p) => {
      if (p.id !== product.id && p.videoUrl && p.videoUrl.trim()) {
        list.push({
          id: `prod-vid-${p.id}`,
          videoUrl: p.videoUrl.trim(),
          title: p.title,
          createdAt: p.createdAt || new Date().toISOString(),
        });
      }
    });

    return list;
  }, [product, allProducts]);

  // Current active image index for lightbox and cart
  const activeImageIndex = galleryMedia[activeMediaIndex]?.imageIndex ?? 0;

  // Current stock for the actively selected variant option(s) or base product
  const currentSelectionStock = useMemo(() => {
    return getSelectedVariantStock(product, selectedOptions);
  }, [product, selectedOptions]);

  const isCurrentSelectionOutOfStock = currentSelectionStock <= 0;

  // Reset or initialize variant selections & active image when product or initial selection changes
  useEffect(() => {
    const initial = resolveInitialOptions(product, initialSelectedVariants);
    setSelectedOptions(initial);
    const norm = normalizeVariantTypes(product);
    setLastSelectedTypeId(norm[0]?.id);
    setActiveMediaIndex(0);
    setQuantity(1);
  }, [product.id, initialSelectedVariants]);

  // If initialSelectedImage is passed and found in activeImages, focus that image
  useEffect(() => {
    if (initialSelectedImage && activeImages.length > 0) {
      const idx = activeImages.findIndex((img) => img === initialSelectedImage);
      if (idx >= 0) {
        const mediaIdx = galleryMedia.findIndex(
          (m) => m.type === 'image' && m.imageIndex === idx
        );
        if (mediaIdx >= 0) {
          setActiveMediaIndex(mediaIdx);
        }
      }
    }
  }, [initialSelectedImage, activeImages, galleryMedia]);

  // Reset active media index if out of bounds
  useEffect(() => {
    if (activeMediaIndex >= galleryMedia.length) {
      setActiveMediaIndex(0);
    }
  }, [galleryMedia, activeMediaIndex]);

  // Selected Size Variant / Price Modifiers
  const selectedSizeOption = useMemo(() => {
    const sizeType = variantTypes.find(
      (vt) => vt.id === 'vt-size' || vt.name.toLowerCase().includes('tamaño') || vt.name.toLowerCase().includes('medida') || vt.name.toLowerCase().includes('talle')
    );
    if (sizeType) {
      const selectedName = selectedOptions[sizeType.id] || selectedOptions[sizeType.name];
      return sizeType.options.find((o) => o.name === selectedName);
    }
    // If only 1 variant type exists and has price overrides
    if (variantTypes.length === 1 && variantTypes[0].options.some((o) => o.wholesalePrice !== undefined)) {
      const selectedName = selectedOptions[variantTypes[0].id] || selectedOptions[variantTypes[0].name];
      return variantTypes[0].options.find((o) => o.name === selectedName);
    }
    // Check legacy sizeVariants
    if (product.sizeVariants && product.sizeVariants.length > 0) {
      const selectedName = selectedOptions['vt-size'] || selectedOptions['Tamaño / Medida'];
      return product.sizeVariants.find((sv) => sv.name === selectedName || sv.id === selectedName);
    }
    return undefined;
  }, [variantTypes, selectedOptions, product.sizeVariants]);

  const { purchaseMode, setPurchaseMode, isCashMode } = usePurchaseMode();

  // Price calculations dynamically resolved from selected variant options and base product
  const resolvedPrices = useMemo(() => {
    return getResolvedProductPrices(product, selectedOptions);
  }, [product, selectedOptions]);

  const currentWholesalePrice = isCashMode ? resolvedPrices.wholesaleCashPrice : resolvedPrices.wholesalePrice;
  const currentRetailPrice = isCashMode ? resolvedPrices.retailCashPrice : resolvedPrices.retailPrice;
  const currentWholesaleCashPrice = resolvedPrices.wholesaleCashPrice;
  const currentRetailCashPrice = resolvedPrices.retailCashPrice;

  // Selected color for legacy CartItem compatibility
  const selectedColorName = useMemo(() => {
    const colorType = variantTypes.find(
      (vt) => vt.id === 'vt-color' || vt.name.toLowerCase().includes('color') || vt.name.toLowerCase().includes('modelo') || vt.name.toLowerCase().includes('acabado')
    );
    if (colorType) {
      return selectedOptions[colorType.id] || selectedOptions[colorType.name] || '';
    }
    if (variantTypes.length === 1 && !selectedSizeOption) {
      return selectedOptions[variantTypes[0].id] || selectedOptions[variantTypes[0].name] || '';
    }
    return product.colors && product.colors.length > 0 ? product.colors[0] : '';
  }, [variantTypes, selectedOptions, product.colors, selectedSizeOption]);

  // Selected SizeVariant object for legacy CartItem compatibility
  const selectedSizeVariantObj: SizeVariant | undefined = useMemo(() => {
    if (selectedSizeOption) {
      return {
        id: selectedSizeOption.id,
        name: selectedSizeOption.name,
        images: selectedSizeOption.images || [],
        wholesalePrice: currentWholesalePrice,
        retailPrice: currentRetailPrice,
        wholesaleCashPrice: currentWholesaleCashPrice,
        retailCashPrice: currentRetailCashPrice,
        cashPrice: resolvedPrices.cashPrice,
        sku: selectedSizeOption.sku,
      };
    }
    if (resolvedPrices.hasCustomVariantPrice && resolvedPrices.priceControllingOptionName) {
      return {
        id: `var-${resolvedPrices.priceControllingOptionName}`,
        name: resolvedPrices.priceControllingOptionName,
        images: [],
        wholesalePrice: currentWholesalePrice,
        retailPrice: currentRetailPrice,
        wholesaleCashPrice: currentWholesaleCashPrice,
        retailCashPrice: currentRetailCashPrice,
        cashPrice: resolvedPrices.cashPrice,
      };
    }
    return undefined;
  }, [selectedSizeOption, resolvedPrices, currentWholesalePrice, currentRetailPrice, currentWholesaleCashPrice, currentRetailCashPrice]);

  // User-friendly selected variants map for cart/order representation
  const userFriendlySelectedVariants = useMemo(() => {
    const map: Record<string, string> = {};
    variantTypes.forEach((vt) => {
      const chosen = selectedOptions[vt.id] || selectedOptions[vt.name];
      if (chosen) {
        map[vt.name] = chosen;
      }
    });
    return map;
  }, [variantTypes, selectedOptions]);

  // Formatted sold count: strictly +500 or +1000 vendidos
  const formattedSoldCount = useMemo(() => {
    if (product.soldCount === 1000 || product.soldCount === 500) {
      return product.soldCount;
    }
    if (product.soldCount && product.soldCount >= 1000) {
      return 1000;
    }
    if (product.soldCount && product.soldCount > 0) {
      return product.soldCount >= 500 ? 1000 : 500;
    }
    const seed = String(product.id || product.title || '');
    let charSum = 0;
    for (let i = 0; i < seed.length; i++) {
      charSum += seed.charCodeAt(i);
    }
    return charSum % 2 === 0 ? 1000 : 500;
  }, [product.soldCount, product.id, product.title]);

  // Quantity state
  const [quantity, setQuantity] = useState<number>(1);
  const [quantityInput, setQuantityInput] = useState<string | null>(null);

  // Added to cart feedback
  const [showAddedFeedback, setShowAddedFeedback] = useState(false);
  const [hasAddedToCart, setHasAddedToCart] = useState(false);

  // Handler for selecting an option in any variant type
  const handleSelectOption = (variantType: VariantType, option: VariantOption) => {
    // If the clicked option is out of stock, do not select it
    if (isOptionOutOfStock(product, option, variantType.id)) {
      return;
    }

    setLastSelectedTypeId(variantType.id);
    const updatedOptions = {
      ...selectedOptions,
      [variantType.id]: option.name,
      [variantType.name]: option.name,
    };
    setSelectedOptions(updatedOptions);
    // Reset thumbnail viewer to the first image of this variant's gallery
    setActiveMediaIndex(0);

    const resultingGallery = getActiveVariantImages(product, updatedOptions, variantType.id);
    console.log(`[VARIANT DEBUG - DETAIL SELECTION] Variante seleccionada: "${variantType.name}" -> "${option.name}"`);
    console.log(`  └─ Imágenes en galería de la variante (${resultingGallery.length}):`, resultingGallery);
  };

  const handleAdd = () => {
    const activeMainImage = activeImages[activeImageIndex] || activeImages[0] || (product.images && product.images[0]) || 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800';
    onAddToCart(product, selectedColorName, selectedSizeVariantObj, quantity, activeMainImage, userFriendlySelectedVariants);
    setShowAddedFeedback(true);
    setHasAddedToCart(true);
    setTimeout(() => setShowAddedFeedback(false), 2500);
  };

  const handleBuy = () => {
    const activeMainImage = activeImages[activeImageIndex] || activeImages[0] || (product.images && product.images[0]) || 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800';
    onBuyNow(product, selectedColorName, selectedSizeVariantObj, quantity, activeMainImage, userFriendlySelectedVariants);
  };

  // Touch swipe support for mobile gallery
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const isSwipingMobile = useRef<boolean>(false);
  const lastTouchOpenTime = useRef<number>(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isSwipingMobile.current = false;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;

    // Check if horizontal swipe is significant and dominant over vertical scroll
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 35) {
      isSwipingMobile.current = true;
      if (deltaX < 0) {
        // Swiped left -> Next item
        if (galleryMedia.length > 1) {
          setActiveMediaIndex((prev) => (prev < galleryMedia.length - 1 ? prev + 1 : 0));
        }
      } else {
        // Swiped right -> Previous item
        if (galleryMedia.length > 1) {
          setActiveMediaIndex((prev) => (prev > 0 ? prev - 1 : galleryMedia.length - 1));
        }
      }
    } else if (Math.abs(deltaX) < 14 && Math.abs(deltaY) < 14) {
      // Direct tap without swipe opens fullscreen
      isSwipingMobile.current = false;
      lastTouchOpenTime.current = Date.now();
      const currentItem = galleryMedia[activeMediaIndex];
      if (currentItem && currentItem.type === 'video') {
        setIsVideoModalOpen(true);
      } else {
        setIsLightboxOpen(true);
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  const relatedProducts = allProducts
    .filter((p) => p.id !== product.id && (p.category === product.category || p.isBestSeller))
    .slice(0, 4);

  return (
    <div className="max-w-[1240px] mx-auto px-2 sm:px-4 py-1 sm:py-5 space-y-3 sm:space-y-5 md:space-y-6">
      {/* Breadcrumbs (Hidden on mobile, visible on desktop) */}
      <nav id="breadcrumbs" className="hidden md:flex items-center gap-2 text-sm text-gray-500 flex-wrap">
        <button
          onClick={onBack}
          className="text-[#0058bb] hover:underline font-medium flex items-center gap-1 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> {backLabel || 'Volver al listado'}
        </button>
        <span>|</span>
        <span className="hover:text-gray-800 cursor-pointer">{product.category}</span>
        {product.subcategory && (
          <>
            <span>&gt;</span>
            <span className="hover:text-gray-800 cursor-pointer">{product.subcategory}</span>
          </>
        )}
        <span>&gt;</span>
        <span className="text-gray-800 font-semibold truncate max-w-[200px] md:max-w-xs">{product.title}</span>
      </nav>

      {/* Unified Single Product Card (on desktop, unifies showcase, purchase details, description, lifestyle, reviews & video into one cohesive card; flat on mobile) */}
      <div className="bg-transparent md:bg-white rounded-none md:rounded-2xl border-0 md:border md:border-gray-200/90 shadow-none md:shadow-sm p-0 md:p-5 lg:p-6 space-y-3 md:space-y-6">
        {/* Top Section: Showcase Gallery & Purchase Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-5 lg:gap-6 items-start">
          {/* Left Column: Vertical Thumbnails (Desktop only) + Big Showcase Image + Description directly underneath on Desktop (Lg: cols 7) */}
          <div className="lg:col-span-7 flex flex-col space-y-3 md:space-y-4">
            <div className="flex flex-col md:flex-row gap-3 lg:gap-4 items-start w-full">
              {/* Thumbnails (Hidden on mobile, visible on desktop) */}
              <div className="hidden md:flex md:flex-col gap-2.5 md:overflow-y-auto max-h-[480px] no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden py-1 shrink-0">
              {galleryMedia.map((item, idx) => {
                const isActive = activeMediaIndex === idx;

                if (item.type === 'video') {
                  return (
                    <button
                      key="thumb-video-item"
                      id="thumb-btn-video"
                      onClick={() => {
                        setActiveMediaIndex(idx);
                        setIsVideoModalOpen(true);
                      }}
                      className={`w-16 h-16 md:w-20 md:h-20 rounded-lg overflow-hidden border-2 transition-all shrink-0 bg-black relative p-0.5 cursor-pointer group ${
                        isActive
                          ? 'border-[#0058bb] shadow-sm ring-2 ring-[#0058bb]/20'
                          : 'border-gray-200 hover:border-gray-400 opacity-90 hover:opacity-100'
                      }`}
                      title="Ver video del producto (pantalla completa Reels)"
                    >
                      <video
                        src={item.url}
                        autoPlay
                        muted
                        loop
                        playsInline
                        preload="metadata"
                        className="w-full h-full object-cover rounded-sm pointer-events-none"
                      />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <div className="w-6 h-6 rounded-full bg-white/90 text-gray-900 flex items-center justify-center shadow-xs">
                          <Play className="w-3.5 h-3.5 ml-0.5 fill-gray-900 text-gray-900" />
                        </div>
                      </div>
                    </button>
                  );
                }

                return (
                  <button
                    key={idx}
                    id={`thumb-btn-${idx}`}
                    onClick={() => setActiveMediaIndex(idx)}
                    className={`w-16 h-16 md:w-20 md:h-20 rounded-lg overflow-hidden border-2 transition-all shrink-0 bg-white p-1 cursor-pointer ${
                      isActive
                        ? 'border-[#0058bb] shadow-sm ring-2 ring-[#0058bb]/20'
                        : 'border-gray-200 hover:border-gray-400 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={item.url} alt={`Vista ${idx + 1}`} className="w-full h-full object-contain" />
                  </button>
                );
              })}
            </div>

            {/* Main Showcase Image: Strictly 1:1 Aspect Ratio on Desktop with non-deforming zoom */}
            <div
              className="flex-1 w-full bg-white -mx-2 sm:mx-0 rounded-none sm:rounded-xl border-b border-gray-100 sm:border md:border-gray-200/80 md:aspect-square flex items-center justify-center p-2 sm:p-3 md:p-4 min-h-[330px] sm:min-h-[380px] md:min-h-0 md:max-h-none overflow-hidden relative group select-none touch-pan-y cursor-pointer"
              onClick={() => {
                if (Date.now() - lastTouchOpenTime.current < 600 || isSwipingMobile.current) {
                  isSwipingMobile.current = false;
                  return;
                }
                const currentMedia = galleryMedia[activeMediaIndex];
                if (currentMedia && currentMedia.type === 'video') {
                  setIsVideoModalOpen(true);
                } else {
                  setIsLightboxOpen(true);
                }
              }}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              <ProductCardBadge product={product} className="!top-3 !left-3 sm:!top-4 sm:!left-4 text-xs sm:text-sm px-2.5 sm:px-3 py-1" />
              {galleryMedia[activeMediaIndex]?.type === 'video' ? (
                <div className="relative aspect-[9/16] h-[330px] sm:h-[380px] md:h-full md:max-h-[460px] max-w-full bg-black rounded-xl overflow-hidden shadow-md flex items-center justify-center">
                  <video
                    src={galleryMedia[activeMediaIndex].url}
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="w-full h-full object-cover cursor-pointer"
                  />
                  <div className="absolute inset-0 bg-black/25 flex items-center justify-center pointer-events-none">
                    <div className="w-14 h-14 rounded-full bg-black/60 text-white flex items-center justify-center backdrop-blur-xs border border-white/20 shadow-xl">
                      <Play className="w-7 h-7 ml-1 fill-white text-white" />
                    </div>
                  </div>
                  <div className="absolute bottom-3 inset-x-3 text-center pointer-events-none">
                    <span className="text-[11px] font-bold text-white bg-black/60 backdrop-blur-xs px-2.5 py-1 rounded-full border border-white/15 shadow-xs">
                      Toca para pantalla completa (Reels con sonido)
                    </span>
                  </div>
                </div>
              ) : (
                <div className="w-full h-full aspect-square flex items-center justify-center overflow-hidden">
                  <ImageWithSkeleton
                    id="main-product-image"
                    src={
                      galleryMedia[activeMediaIndex]?.url ||
                      activeImages[0] ||
                      product.images?.[0] ||
                      'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=400'
                    }
                    alt={product.title}
                    aspectRatio="aspect-square"
                    className="w-full h-full flex items-center justify-center"
                    imgClassName="w-full h-full object-contain aspect-square transition-transform duration-300 ease-out md:group-hover:scale-105 select-none"
                  />
                </div>
              )}

              {/* Minimalist expand cue on hover for desktop */}
              <div className="hidden md:flex items-center gap-1.5 absolute bottom-3 right-3 bg-black/60 backdrop-blur-xs text-white text-[11px] font-medium px-2.5 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xs">
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Ampliar</span>
              </div>

              {/* Mobile image/video dots indicator */}
              {galleryMedia.length > 1 && (
                <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 md:hidden z-10 bg-black/30 backdrop-blur-xs px-2.5 py-1 rounded-full">
                  {galleryMedia.map((mItem, dotIdx) => (
                    <button
                      key={dotIdx}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMediaIndex(dotIdx);
                        if (mItem.type === 'video') {
                          setIsVideoModalOpen(true);
                        }
                      }}
                      className={`h-1.5 rounded-full transition-all flex items-center justify-center ${
                        activeMediaIndex === dotIdx
                          ? mItem.type === 'video'
                            ? 'w-5 bg-emerald-400'
                            : 'w-4 bg-white'
                          : mItem.type === 'video'
                          ? 'w-2 bg-emerald-400/60'
                          : 'w-1.5 bg-white/50'
                      }`}
                      aria-label={`Ver elemento ${dotIdx + 1}`}
                    />
                  ))}
                </div>
              )}

              {/* Navigation arrows if multiple items exist */}
              {galleryMedia.length > 1 && (
                <>
                  <button
                    type="button"
                    id="btn-prev-image"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMediaIndex((prev) => (prev > 0 ? prev - 1 : galleryMedia.length - 1));
                    }}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 shadow-md border border-gray-200 flex items-center justify-center text-gray-700 hover:text-[#0058bb] hover:bg-white transition-all opacity-80 md:opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer"
                    title="Elemento anterior"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    id="btn-next-image"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMediaIndex((prev) => (prev < galleryMedia.length - 1 ? prev + 1 : 0));
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 shadow-md border border-gray-200 flex items-center justify-center text-gray-700 hover:text-[#0058bb] hover:bg-white transition-all opacity-80 md:opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer"
                    title="Siguiente elemento"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>
            </div>

            {/* Desktop Description: Placed directly below the main showcase image */}
            <div className="hidden md:block pt-3 border-t border-gray-100 md:border-gray-200/80 space-y-2">
              <h3 className="text-base sm:text-lg font-bold text-gray-900 font-['Montserrat']">
                Descripción del Producto
              </h3>
              <div className="text-xs sm:text-sm text-gray-600 space-y-2 whitespace-pre-line leading-relaxed font-normal">
                {product.description}
              </div>
            </div>
          </div>

          {/* Right Column: Pricing, Variants & Purchase Actions (Lg: cols 5) - Clean, compact & non-sticky */}
          <div className="lg:col-span-5 flex flex-col space-y-2.5">
            {/* Condition & Rating */}
            <div className="order-1 flex items-center justify-between text-xs md:text-sm text-gray-500">
              <span>Nuevo | +{formattedSoldCount} vendidos</span>
              <div className="flex items-center gap-1 text-[#0058bb]">
                <div className="flex">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-3.5 h-3.5 ${
                        i < Math.round(product.rating ?? 5)
                          ? 'fill-[#0058bb] text-[#0058bb]'
                          : 'fill-gray-200 text-gray-200'
                      }`}
                    />
                  ))}
                </div>
                <span className="font-bold text-xs md:text-sm">{(product.rating ?? 5.0).toFixed(1)}</span>
              </div>
            </div>

            {/* Product Title - Prominent and balanced */}
            <h1 id="product-detail-title" className="order-2 text-xl sm:text-2xl font-bold text-gray-900 leading-snug font-['Montserrat'] tracking-tight">
              {product.title}
            </h1>

            {/* Pricing Section - Direct on canvas on mobile, subtle dividers on desktop */}
            <div className="order-3 p-2.5 md:p-3 bg-transparent md:bg-gray-50/80 rounded-none md:rounded-xl border-0 md:border md:border-gray-200/70 space-y-2 py-2 border-y border-gray-100 md:border-y-0">
              {/* Wholesale Price Display & Integrated Mode Selector */}
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  {/* Single Wholesale Price corresponding strictly to active mode */}
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span
                      id="wholesale-price-display"
                      className={`text-3xl sm:text-4xl font-bold font-['Montserrat'] tracking-tight transition-colors ${
                        isCashMode ? 'text-emerald-700' : 'text-gray-900'
                      }`}
                    >
                      $ {currentWholesalePrice.toLocaleString('es-AR')}
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-[#00a650]">
                      c/u Mayorista
                    </span>
                  </div>

                  {/* Selector integrado: las palabras 'transferencia' y 'efectivo' funcionan como opción seleccionable */}
                  <div
                    id="detail-purchase-mode-toggle"
                    className="inline-flex items-center p-0.5 rounded-lg bg-gray-200/80 border border-gray-300/80 text-xs shadow-2xs"
                  >
                    <button
                      type="button"
                      id="detail-mode-transfer-btn"
                      onClick={() => setPurchaseMode('transfer')}
                      className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                        !isCashMode
                          ? 'bg-white text-[#0058bb] shadow-2xs'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                      aria-pressed={!isCashMode}
                      title="Modalidad transferencia"
                    >
                      Transferencia
                    </button>
                    <button
                      type="button"
                      id="detail-mode-cash-btn"
                      onClick={() => setPurchaseMode('cash')}
                      className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer flex items-center gap-1 ${
                        isCashMode
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'text-gray-600 hover:text-emerald-700'
                      }`}
                      aria-pressed={isCashMode}
                      title="Efectivo exclusivo para retiro en local"
                    >
                      <span>Efectivo</span>
                    </button>
                  </div>
                </div>

                {/* Sub-label: Exclusive pickup tag when cash is chosen, or category wholesale min */}
                <div className="flex items-center gap-2 flex-wrap">
                  {isCashMode && (
                    <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-bold text-emerald-800 bg-emerald-100/90 border border-emerald-300 px-2 py-0.5 rounded-md">
                      <Store className="w-3 h-3 text-emerald-700 shrink-0" />
                      exclusivo para retiro en local
                    </span>
                  )}
                  <p className="text-xs sm:text-sm text-[#00a650] font-medium leading-tight">
                    ({product.minWholesaleQty} unids. acumulables dentro de la categoría {product.category})
                  </p>
                </div>
              </div>

              {/* Retail Price line - displays only the retail price corresponding to chosen mode */}
              <div className="border-t border-gray-100 md:border-gray-200/80 pt-1.5 flex items-baseline justify-between gap-2">
                <div className="flex items-baseline gap-2">
                  <span id="retail-price-display" className="text-sm sm:text-base font-normal text-gray-700">
                    $ {currentRetailPrice.toLocaleString('es-AR')}
                  </span>
                  <span className="text-xs text-gray-500 font-medium">
                    Precio minorista 1 unidad {isCashMode ? '(efectivo en local)' : '(transferencia)'}
                  </span>
                </div>
              </div>
            </div>

            {/* DYNAMIC 2-TYPE VARIANT SELECTORS (Color / Modelo, Tamaño / Medida, etc.) */}
            {variantTypes.length > 0 ? (
              <div className="order-4 space-y-2">
                {variantTypes.map((vt, vtIdx) => {
                  const currentSelectedName = selectedOptions[vt.id] || selectedOptions[vt.name] || (vt.options[0]?.name ?? '');
                  const hasPriceModifiers = vt.options.some((o) => o.wholesalePrice !== undefined && o.wholesalePrice !== product.wholesalePrice);
                  const hasVariantImages = vt.options.some((o) => o.images && o.images.length > 0);

                  return (
                    <div key={vt.id || vtIdx} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-bold text-gray-700 block">
                          {formatVariantTypeName(vt.name)}: <span className="text-gray-900 font-semibold">{currentSelectedName}</span>
                        </label>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {vt.options.map((option) => {
                          const isSelected = currentSelectedName === option.name;
                          const optionHasImages = option.images && option.images.length > 0;
                          const optionThumb = optionHasImages ? option.images![0] : null;
                          const optionStock = getOptionStock(product, option, vt.id);
                          const isOptOutOfStock = isOptionOutOfStock(product, option, vt.id);

                          return (
                            <button
                              key={option.id || option.name}
                              id={`variant-opt-${vt.id}-${option.name.toLowerCase().replace(/\s+/g, '-')}`}
                              type="button"
                              disabled={isOptOutOfStock}
                              onClick={() => handleSelectOption(vt, option)}
                              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                                isOptOutOfStock
                                  ? 'border border-dashed border-gray-300 bg-gray-100/80 text-gray-400 opacity-60 cursor-not-allowed select-none'
                                  : isSelected
                                  ? 'border-2 border-[#0058bb] bg-blue-50/60 text-[#0058bb] font-bold shadow-xs cursor-pointer'
                                  : 'border border-gray-300 bg-white text-gray-700 hover:border-gray-400 cursor-pointer'
                              }`}
                            >
                              {/* Option thumbnail if available */}
                              {optionThumb && (
                                <img
                                  src={optionThumb}
                                  alt={option.name}
                                  className={`w-5.5 h-5.5 rounded object-cover border border-gray-200 shrink-0 ${
                                    isOptOutOfStock ? 'grayscale opacity-40' : ''
                                  }`}
                                />
                              )}

                              <div className="flex flex-col items-start leading-tight">
                                <span className={`text-sm ${isOptOutOfStock ? 'line-through text-gray-400' : ''}`}>
                                  {option.name}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {/* Discount Promo Banner */}
            <div id="cash-discount-banner" className="order-6 lg:order-5 bg-white border border-emerald-200 rounded-lg p-2 md:p-2.5 flex items-center gap-2.5">
              <Banknote className="w-4 h-4 text-[#00a650] shrink-0" />
              <div className="text-xs md:text-sm">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-[#00a650]">Descuento pagando en efectivo</span>
                  {currentWholesaleCashPrice < currentWholesalePrice && (
                    <span className="bg-[#00a650] text-white font-bold px-1.5 py-0.5 rounded text-xs">
                      ${currentWholesaleCashPrice.toLocaleString('es-AR')} mayorista
                    </span>
                  )}
                  {currentRetailCashPrice < currentRetailPrice && (
                    <span className="bg-emerald-100 text-emerald-800 font-semibold px-1.5 py-0.5 rounded text-xs">
                      ${currentRetailCashPrice.toLocaleString('es-AR')} minorista
                    </span>
                  )}
                </div>
                <p className="text-gray-600 text-xs mt-0.5 leading-tight">
                  Aplicable cuando confirme el carrito y seleccione Retiro en el local en efectivo
                </p>
              </div>
            </div>

            {/* Shipping & Delivery Highlights */}
            <div className="order-7 lg:order-6 space-y-1.5 pt-0.5 text-xs md:text-sm text-gray-700">
              <div className="flex items-start gap-2">
                <Truck className="w-3.5 h-3.5 text-[#00a650] shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-gray-900 block">Envío a domicilio</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="bg-[#a3e635] text-xs font-bold px-1.5 py-0.5 rounded text-gray-900">Envíos Flex</span>
                    <span className="bg-[#facc15] text-xs font-bold px-1.5 py-0.5 rounded text-gray-900">Correo Argentino</span>
                    <span className="bg-black text-xs font-bold px-1.5 py-0.5 rounded text-white">Uber moto</span>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Store className="w-3.5 h-3.5 text-[#0058bb] shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-gray-900">Retiro gratis</span> en Local de Flores, CABA.
                </div>
              </div>
            </div>

            {/* Action Buttons & Quantity (order 5 on mobile, order 7 on desktop) */}
            <div className="order-5 lg:order-7 space-y-2.5 pt-2 border-t border-gray-100 md:border-gray-200">
              {/* Stock status indicator */}
              {isCurrentSelectionOutOfStock ? (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs md:text-sm text-red-700 font-bold">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>
                    {variantTypes.length > 0
                      ? 'Esta variante se encuentra sin stock disponible.'
                      : 'Este producto se encuentra sin stock disponible.'}
                  </span>
                </div>
              ) : currentSelectionStock === 1 ? (
                <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-xs md:text-sm text-amber-800 font-bold">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Última unidad disponible</span>
                </div>
              ) : null}

              {/* Quantity Controller */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-gray-800">Cantidad:</span>
                <div className="flex items-center border border-gray-300 rounded-xl overflow-hidden bg-white shadow-2xs">
                  <button
                    id="qty-minus-btn"
                    disabled={quantity <= 1 || isCurrentSelectionOutOfStock}
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className={`px-3.5 py-2 text-gray-600 transition-colors min-h-[40px] min-w-[38px] flex items-center justify-center ${
                      quantity <= 1 || isCurrentSelectionOutOfStock
                        ? 'opacity-40 cursor-not-allowed bg-gray-50'
                        : 'hover:bg-gray-100 cursor-pointer'
                    }`}
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input
                    id="qty-count-display"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    aria-label="Cantidad del producto"
                    disabled={isCurrentSelectionOutOfStock}
                    value={quantityInput !== null ? quantityInput : quantity}
                    onChange={(e) => {
                      const cleanVal = e.target.value.replace(/\D/g, '');
                      setQuantityInput(cleanVal);
                      if (cleanVal !== '') {
                        const num = parseInt(cleanVal, 10);
                        if (!isNaN(num) && num > 0) {
                          const maxStock = currentSelectionStock > 0 ? currentSelectionStock : 99999;
                          setQuantity(Math.min(num, maxStock));
                        }
                      }
                    }}
                    onFocus={(e) => {
                      e.target.select();
                      setQuantityInput(String(quantity));
                    }}
                    onBlur={() => {
                      if (quantityInput === '' || quantityInput === null || parseInt(quantityInput, 10) < 1) {
                        setQuantity(1);
                      } else {
                        const num = parseInt(quantityInput, 10);
                        const maxStock = currentSelectionStock > 0 ? currentSelectionStock : 99999;
                        const clamped = Math.max(1, Math.min(num, maxStock));
                        setQuantity(clamped);
                      }
                      setQuantityInput(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    className={`w-12 py-2 text-sm font-bold text-gray-900 text-center bg-transparent border-none outline-none focus:bg-blue-50/60 focus:text-[#0058bb] transition-colors ${
                      isCurrentSelectionOutOfStock ? 'cursor-not-allowed opacity-40' : 'cursor-text'
                    }`}
                  />
                  <button
                    id="qty-plus-btn"
                    disabled={isCurrentSelectionOutOfStock || quantity >= currentSelectionStock}
                    onClick={() => setQuantity((q) => q + 1)}
                    className={`px-3.5 py-2 text-gray-600 transition-colors min-h-[40px] min-w-[38px] flex items-center justify-center ${
                      isCurrentSelectionOutOfStock || quantity >= currentSelectionStock
                        ? 'opacity-40 cursor-not-allowed bg-gray-50'
                        : 'hover:bg-gray-100 cursor-pointer'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                <button
                  id="buy-now-btn"
                  disabled={isCurrentSelectionOutOfStock}
                  onClick={handleBuy}
                  className={`w-full font-bold py-2.5 px-5 rounded-xl text-sm transition-colors shadow-xs min-h-[42px] flex items-center justify-center ${
                    isCurrentSelectionOutOfStock
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                      : 'bg-[#0058bb] hover:bg-[#004bb0] text-white cursor-pointer active:scale-[0.99]'
                  }`}
                >
                  {isCurrentSelectionOutOfStock ? 'Sin stock disponible' : 'Comprar ahora'}
                </button>

                <button
                  id="add-to-cart-btn"
                  disabled={isCurrentSelectionOutOfStock}
                  onClick={handleAdd}
                  className={`w-full font-bold py-2.5 px-5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2 min-h-[42px] ${
                    isCurrentSelectionOutOfStock
                      ? 'bg-gray-100 border border-gray-300 text-gray-400 cursor-not-allowed'
                      : 'bg-white hover:bg-blue-50/50 text-[#0058bb] border-2 border-[#0058bb] cursor-pointer active:scale-[0.99]'
                  }`}
                >
                  {isCurrentSelectionOutOfStock ? (
                    'Sin stock'
                  ) : showAddedFeedback ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      ¡Agregado al Carrito!
                    </>
                  ) : (
                    'Agregar al carrito'
                  )}
                </button>

                {/* Link to cart after adding */}
                {hasAddedToCart && onGoToCart && (
                  <button
                    type="button"
                    id="view-cart-link-btn"
                    onClick={onGoToCart}
                    className="w-full py-2.5 px-3 text-center text-xs md:text-sm font-semibold text-[#0058bb] hover:text-[#004bb0] hover:bg-blue-50/60 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer group animate-in fade-in duration-200"
                  >
                    <ShoppingBag className="w-4 h-4 text-[#0058bb] group-hover:scale-110 transition-transform" />
                    <span className="underline underline-offset-4">Ver carrito</span>
                    <ArrowRightIcon className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Official Store Badge */}
            <div className="order-8 lg:order-8 pt-1">
              <MichyOfficialBadge />
            </div>

            {/* Mobile Only: Description directly below purchase info, preserving mobile order */}
            <div className="md:hidden order-9 pt-3 border-t border-gray-100 space-y-2">
              <h3 className="text-base font-bold text-gray-900 font-['Montserrat']">
                Descripción del Producto
              </h3>
              <div className="text-xs text-gray-600 space-y-2 whitespace-pre-line leading-relaxed font-normal">
                {product.description}
              </div>
            </div>
          </div>
        </div>

        {/* Sección Inferior de la Tarjeta: Imagen Complementaria, Opiniones y Video (si existe, al lado derecho en desktop) */}
        <div className="border-t border-gray-100 md:border-gray-200/80 pt-4 md:pt-6">
          {product.videoUrl && product.videoUrl.trim() ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-stretch">
              {/* Columna Izquierda en Desktop: Imagen Complementaria + Clasificación y Opiniones */}
              <div className="lg:col-span-7 xl:col-span-8 flex flex-col space-y-4 sm:space-y-5 justify-between">
                {/* Imagen Complementaria */}
                <div className="space-y-2">
                  <div className="relative w-full h-48 sm:h-56 md:h-64 lg:h-56 xl:h-60 rounded-xl overflow-hidden bg-gray-100 border border-gray-200/70 shadow-2xs group">
                    <img
                      src={
                        product.additionalImage ||
                        'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80'
                      }
                      alt={product.title || 'Showcase'}
                      className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
                    />
                  </div>
                </div>

                {/* Clasificación y Opiniones */}
                <div className="space-y-3 pt-1">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 md:border-gray-200/80 pb-2.5">
                    <h3 className="text-base sm:text-lg font-bold text-gray-900 font-['Montserrat']">
                      Clasificación y Opiniones
                    </h3>
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl sm:text-2xl font-bold text-gray-900">
                        {(product.rating ?? 5.0).toFixed(1)}
                      </span>
                      <div className="flex">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${
                              i < Math.round(product.rating ?? 5)
                                ? 'fill-[#0058bb] text-[#0058bb]'
                                : 'fill-gray-200 text-gray-200'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-gray-500">
                        ({product.reviewsCount ?? (product.reviews?.length || 128)} opiniones)
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(product.reviews && product.reviews.length > 0
                      ? product.reviews
                      : [
                          {
                            id: 'def-1',
                            rating: 5,
                            text: 'Excelente calidad, no se ponen negros y se venden súper rápido.',
                          },
                          {
                            id: 'def-2',
                            rating: 5,
                            text: 'Muy buen cierre, el dorado es muy lindo y natural.',
                          },
                        ]
                    ).map((rev, idx) => (
                      <div
                        key={rev.id || idx}
                        className="text-xs sm:text-sm text-gray-600 bg-gray-50/70 rounded-xl p-3 border border-gray-100 md:border-gray-200/60 space-y-1"
                      >
                        <div className="flex text-[#0058bb]">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`w-3 h-3 ${
                                i < (rev.rating ?? 5)
                                  ? 'fill-[#0058bb] text-[#0058bb]'
                                  : 'fill-gray-200 text-gray-200'
                              }`}
                            />
                          ))}
                        </div>
                        <p className="font-normal text-gray-700 leading-snug">"{rev.text}"</p>
                        {rev.author && (
                          <span className="text-xs text-gray-400 block font-medium">{rev.author}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Columna Derecha en Desktop: Video Seleccionado al lado derecho */}
              <div className="lg:col-span-5 xl:col-span-4 flex items-center justify-center pt-3 lg:pt-0">
                <ProductBottomVideoPlayer
                  videoUrl={product.videoUrl}
                  onOpenFullscreen={() => setIsVideoModalOpen(true)}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Sin video: Imagen Complementaria a ancho completo */}
              <div className="space-y-2">
                <div className="relative w-full h-48 sm:h-64 md:h-80 rounded-xl overflow-hidden bg-gray-100 border border-gray-200/70 shadow-2xs group">
                  <img
                    src={
                      product.additionalImage ||
                      'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80'
                    }
                    alt={product.title || 'Showcase'}
                    className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
                  />
                </div>
              </div>

              {/* Clasificación y Opiniones */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 md:border-gray-200/80 pb-3">
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 font-['Montserrat']">
                    Clasificación y Opiniones
                  </h3>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold text-gray-900">
                      {(product.rating ?? 5.0).toFixed(1)}
                    </span>
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-4 h-4 ${
                            i < Math.round(product.rating ?? 5)
                              ? 'fill-[#0058bb] text-[#0058bb]'
                              : 'fill-gray-200 text-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs sm:text-sm text-gray-500">
                      ({product.reviewsCount ?? (product.reviews?.length || 128)} clasificaciones)
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  {(product.reviews && product.reviews.length > 0
                    ? product.reviews
                    : [
                        {
                          id: 'def-1',
                          rating: 5,
                          text: 'Excelente calidad, no se ponen negros y se venden súper rápido.',
                        },
                        {
                          id: 'def-2',
                          rating: 5,
                          text: 'Muy buen cierre, el dorado es muy lindo y natural.',
                        },
                      ]
                  ).map((rev, idx) => (
                    <div
                      key={rev.id || idx}
                      className="text-xs sm:text-sm text-gray-600 bg-gray-50/70 rounded-xl p-3.5 border border-gray-100 md:border-gray-200/60 space-y-1.5"
                    >
                      <div className="flex text-[#0058bb]">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3.5 h-3.5 ${
                              i < (rev.rating ?? 5)
                                ? 'fill-[#0058bb] text-[#0058bb]'
                                : 'fill-gray-200 text-gray-200'
                            }`}
                          />
                        ))}
                      </div>
                      <p className="font-normal text-gray-700 leading-snug">"{rev.text}"</p>
                      {rev.author && (
                        <span className="text-xs text-gray-400 block font-medium">{rev.author}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Video del producto si solo está en mobile sin videoUrl inside the card (handled inside card cleanly) */}
      {!product.videoUrl?.trim() && null}

      {/* Related Products */}
      <section id="productos-relacionados" className="space-y-3 sm:space-y-4 pt-2 sm:pt-4">
        <h3 className="text-base sm:text-lg font-bold text-gray-900 font-['Montserrat']">
          Productos Relacionados
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
          {relatedProducts.map((rel) => (
            <div
              key={rel.id}
              id={`related-product-card-${rel.id}`}
              onClick={() => onSelectRelated(rel)}
              className="group bg-white rounded-xl border border-gray-100 sm:border-gray-200/90 overflow-hidden shadow-2xs sm:shadow-xs hover:shadow-lg hover:border-[#0058bb]/50 transition-all cursor-pointer flex flex-col"
            >
              <div className="relative aspect-square w-full bg-gray-100 flex items-center justify-center overflow-hidden border-b border-gray-100">
                <ImageWithSkeleton
                  src={(rel.images && rel.images[0]) || 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=400'}
                  alt={rel.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <ProductCardBadge product={rel} />
              </div>
              <div className="p-2.5 sm:p-3.5 flex-1 flex flex-col justify-between space-y-1.5 sm:space-y-2">
                <h4 className="text-xs sm:text-sm font-semibold text-gray-800 line-clamp-2 leading-snug group-hover:text-[#0058bb] transition-colors">
                  {rel.title}
                </h4>
                <div className="pt-0.5 sm:pt-1">
                  <div className="flex items-center gap-1 sm:gap-1.5 flex-nowrap min-w-0">
                    <span className="text-sm sm:text-base font-bold text-gray-900 font-['Montserrat'] shrink-0">
                      ${rel.wholesalePrice.toLocaleString('es-AR')}
                    </span>
                    <span className="inline-flex items-center text-[11px] sm:text-[13.2px] font-semibold bg-[#00a650] text-white px-1 py-0.5 rounded leading-tight shrink min-w-0">
                      <span className="overflow-hidden whitespace-nowrap text-clip block min-w-0">
                        desde {rel.minWholesaleQty} unids
                      </span>
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 font-normal mt-0.5">
                    1 unidad ${rel.retailPrice.toLocaleString('es-AR')}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Lightbox / Visor de Imagen a Pantalla Completa con Zoom y Deslizamiento */}
      <ProductImageLightbox
        isOpen={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
        images={activeImages.length > 0 ? activeImages : [product.images?.[0] || '']}
        initialIndex={activeImageIndex}
        title={product.title}
        subtitle={
          userFriendlySelectedVariants
            ? Object.values(userFriendlySelectedVariants).join(' • ')
            : undefined
        }
        onIndexChange={(newIdx) => {
          const mediaIdx = galleryMedia.findIndex(
            (m) => m.type === 'image' && m.imageIndex === newIdx
          );
          if (mediaIdx >= 0) {
            setActiveMediaIndex(mediaIdx);
          }
        }}
      />

      {/* Visor de Pantalla Completa 9:16 con Sonido Activado y Deslizable (Reels) */}
      <VideoViewerModal
        isOpen={isVideoModalOpen}
        onClose={() => setIsVideoModalOpen(false)}
        videos={productReelsVideos}
        initialIndex={0}
        products={allProducts}
        showAssociatedProduct={false}
        onSelectProduct={(targetId) => {
          const target = allProducts.find((p) => p.id === targetId);
          if (target) onSelectRelated(target);
        }}
      />
    </div>
  );
};
