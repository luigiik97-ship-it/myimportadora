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

  // Active image index in the currently displayed gallery
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState<boolean>(false);

  // Active gallery of images based on current variant selection (falls back to product.images)
  const activeImages: string[] = useMemo(() => {
    return getActiveVariantImages(product, selectedOptions, lastSelectedTypeId);
  }, [product, selectedOptions, lastSelectedTypeId]);

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
    setActiveImageIndex(0);
    setQuantity(1);
  }, [product.id, initialSelectedVariants]);

  // If initialSelectedImage is passed and found in activeImages, focus that image
  useEffect(() => {
    if (initialSelectedImage && activeImages.length > 0) {
      const idx = activeImages.findIndex((img) => img === initialSelectedImage);
      if (idx >= 0) {
        setActiveImageIndex(idx);
      }
    }
  }, [initialSelectedImage, activeImages]);

  // Reset active image index if out of bounds
  useEffect(() => {
    if (activeImageIndex >= activeImages.length) {
      setActiveImageIndex(0);
    }
  }, [activeImages, activeImageIndex]);

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

  // Price calculations dynamically resolved from selected variant options and base product
  const resolvedPrices = useMemo(() => {
    return getResolvedProductPrices(product, selectedOptions);
  }, [product, selectedOptions]);

  const currentWholesalePrice = resolvedPrices.wholesalePrice;
  const currentRetailPrice = resolvedPrices.retailPrice;
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
    setActiveImageIndex(0);

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
        // Swiped left -> Next image
        if (activeImages.length > 1) {
          setActiveImageIndex((prev) => (prev < activeImages.length - 1 ? prev + 1 : 0));
        }
      } else {
        // Swiped right -> Previous image
        if (activeImages.length > 1) {
          setActiveImageIndex((prev) => (prev > 0 ? prev - 1 : activeImages.length - 1));
        }
      }
    } else if (Math.abs(deltaX) < 14 && Math.abs(deltaY) < 14) {
      // Direct tap without swipe opens fullscreen lightbox
      isSwipingMobile.current = false;
      lastTouchOpenTime.current = Date.now();
      setIsLightboxOpen(true);
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  const relatedProducts = allProducts
    .filter((p) => p.id !== product.id && (p.category === product.category || p.isBestSeller))
    .slice(0, 4);

  return (
    <div className="max-w-[1240px] mx-auto px-2 sm:px-4 py-1 sm:py-6 space-y-3 sm:space-y-8">
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

      {/* Main Product Container - Flat native look on mobile, refined card on desktop */}
      <div className="bg-transparent md:bg-white rounded-none md:rounded-2xl border-0 md:border md:border-gray-200/90 shadow-none md:shadow-sm p-0 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-6 lg:gap-8">
        {/* Left Column: Vertical Thumbnails (Desktop only) + Big Showcase Image (Lg: cols 7) */}
        <div className="lg:col-span-7 flex flex-col md:flex-row gap-4">
          {/* Thumbnails (Hidden on mobile, visible on desktop) */}
          <div className="hidden md:flex md:flex-col gap-2.5 md:overflow-y-auto max-h-[480px] no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden py-1">
            {activeImages.map((img, idx) => (
              <button
                key={idx}
                id={`thumb-btn-${idx}`}
                onClick={() => setActiveImageIndex(idx)}
                className={`w-16 h-16 md:w-20 md:h-20 rounded-lg overflow-hidden border-2 transition-all shrink-0 bg-white p-1 cursor-pointer ${
                  activeImageIndex === idx
                    ? 'border-[#0058bb] shadow-sm ring-2 ring-[#0058bb]/20'
                    : 'border-gray-200 hover:border-gray-400 opacity-70 hover:opacity-100'
                }`}
              >
                <img src={img} alt={`Vista ${idx + 1}`} className="w-full h-full object-contain" />
              </button>
            ))}
          </div>

          {/* Main Large Image with touch swipe support and full-width presence */}
          <div
            className="flex-1 bg-white -mx-2 sm:mx-0 rounded-none sm:rounded-xl border-b border-gray-100 sm:border flex items-center justify-center p-2 sm:p-4 min-h-[330px] sm:min-h-[380px] md:min-h-[480px] max-h-[520px] overflow-hidden relative group select-none touch-pan-y cursor-zoom-in"
            onClick={() => {
              // Ignore synthetic click if touch just handled the tap or if user was swiping
              if (Date.now() - lastTouchOpenTime.current < 600 || isSwipingMobile.current) {
                isSwipingMobile.current = false;
                return;
              }
              setIsLightboxOpen(true);
            }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <ImageWithSkeleton
              id="main-product-image"
              src={activeImages[activeImageIndex] || activeImages[0] || 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=400'}
              alt={product.title}
              className="max-h-[330px] sm:max-h-[380px] md:max-h-[440px] w-full object-contain transition-transform duration-300 group-hover:scale-105"
            />

            {/* Mobile image dots indicator */}
            {activeImages.length > 1 && (
              <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 md:hidden z-10 bg-black/20 backdrop-blur-xs px-2.5 py-1 rounded-full">
                {activeImages.map((_, dotIdx) => (
                  <button
                    key={dotIdx}
                    type="button"
                    onClick={() => setActiveImageIndex(dotIdx)}
                    className={`h-1.5 rounded-full transition-all ${
                      activeImageIndex === dotIdx ? 'w-4 bg-white' : 'w-1.5 bg-white/50'
                    }`}
                    aria-label={`Ver imagen ${dotIdx + 1}`}
                  />
                ))}
              </div>
            )}

            {/* Navigation arrows if multiple images exist */}
            {activeImages.length > 1 && (
              <>
                <button
                  type="button"
                  id="btn-prev-image"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveImageIndex((prev) => (prev > 0 ? prev - 1 : activeImages.length - 1));
                  }}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 shadow-md border border-gray-200 flex items-center justify-center text-gray-700 hover:text-[#0058bb] hover:bg-white transition-all opacity-80 md:opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer"
                  title="Imagen anterior"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  id="btn-next-image"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveImageIndex((prev) => (prev < activeImages.length - 1 ? prev + 1 : 0));
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 shadow-md border border-gray-200 flex items-center justify-center text-gray-700 hover:text-[#0058bb] hover:bg-white transition-all opacity-80 md:opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer"
                  title="Siguiente imagen"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Right Column: Pricing, Variants & Purchase Actions (Lg: cols 5) */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-3">
          <div className="flex flex-col space-y-2.5">
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

            {/* Pricing Section - Direct on canvas on mobile, subtle dividers instead of gray box */}
            <div className="order-3 p-0 md:p-3 bg-transparent md:bg-gray-50/80 rounded-none md:rounded-xl border-0 md:border md:border-gray-200/70 space-y-1.5 py-2 border-y border-gray-100 md:border-y-0">
              {/* Wholesale Price Display - Clear primary emphasis */}
              <div className="space-y-0.5">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span id="wholesale-price-display" className="text-3xl sm:text-4xl font-bold text-gray-900 font-['Montserrat'] tracking-tight">
                    $ {currentWholesalePrice.toLocaleString('es-AR')}
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-[#00a650]">c/u Mayorista</span>
                </div>

                {/* Minimum buy badge & category rule info */}
                <p className="text-xs sm:text-sm text-[#00a650] font-medium leading-tight">
                  ({product.minWholesaleQty} unids. acumulables dentro de la categoría {product.category})
                </p>
              </div>

              <div className="border-t border-gray-100 md:border-gray-200/80 pt-1.5 flex items-baseline gap-2">
                <span id="retail-price-display" className="text-sm sm:text-base font-normal text-gray-700">
                  $ {currentRetailPrice.toLocaleString('es-AR')}
                </span>
                <span className="text-xs text-gray-500 font-medium">Precio minorista 1 unidad</span>
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
          </div>
        </div>
      </div>

      {/* Product Description, Lifestyle Media & Reviews - Flat seamless flow on mobile */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-0 md:gap-6 divide-y divide-gray-100 md:divide-y-0 pt-2 md:pt-0">
        {/* Description */}
        <div className="bg-transparent md:bg-white rounded-none md:rounded-xl border-0 md:border md:border-gray-100 sm:border-gray-200 p-1 md:p-5 space-y-2.5 shadow-none md:shadow-xs py-4">
          <h3 className="text-base sm:text-lg font-bold text-gray-800 font-['Montserrat'] border-b border-gray-100 pb-2">
            Descripción del Producto
          </h3>
          <div className="text-xs sm:text-sm text-gray-600 space-y-2 whitespace-pre-line leading-relaxed font-normal">
            {product.description}
          </div>
        </div>

        {/* Center Lifestyle Banner */}
        <div className="relative rounded-none sm:rounded-xl overflow-hidden shadow-none md:shadow-xs min-h-[200px] sm:min-h-[240px] bg-gray-100 flex items-center justify-center group my-3 md:my-0">
          <img
            src={
              product.additionalImage ||
              'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80'
            }
            alt={product.title || 'Showcase'}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
          />
        </div>

        {/* Rating and Reviews */}
        <div className="bg-transparent md:bg-white rounded-none md:rounded-xl border-0 md:border md:border-gray-100 sm:border-gray-200 p-1 md:p-5 space-y-3 shadow-none md:shadow-xs py-4">
          <h3 className="text-base sm:text-lg font-bold text-gray-800 font-['Montserrat'] border-b border-gray-100 pb-2">
            Clasificación y Opiniones
          </h3>
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold text-gray-800">
              {(product.rating ?? 5.0).toFixed(1)}
            </span>
            <div>
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
                {product.reviewsCount ?? (product.reviews?.length || 128)} clasificaciones
              </span>
            </div>
          </div>

          <div className="space-y-3 pt-2 max-h-[300px] overflow-y-auto no-scrollbar">
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
                className="text-xs sm:text-sm text-gray-600 border-b border-gray-100 pb-2.5 space-y-1 last:border-0 last:pb-0"
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
                <p className="font-normal text-gray-600 leading-snug">"{rev.text}"</p>
                {rev.author && (
                  <span className="text-xs sm:text-sm text-gray-500 block">{rev.author}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Related Products */}
      <section id="productos-relacionados" className="space-y-3 sm:space-y-4 pt-2 sm:pt-4">
        <h3 className="text-base sm:text-lg font-bold text-gray-900 font-['Montserrat']">
          Productos Relacionados
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
          {relatedProducts.map((rel) => (
            <div
              key={rel.id}
              onClick={() => onSelectRelated(rel)}
              className="bg-white rounded-xl border border-gray-100 sm:border-gray-200 p-2.5 sm:p-3.5 shadow-2xs sm:shadow-xs hover:shadow-md hover:border-[#0058bb]/40 transition-all cursor-pointer flex flex-col justify-between"
            >
              <div className="aspect-square w-full bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center mb-1.5 sm:mb-2">
                <ImageWithSkeleton src={(rel.images && rel.images[0]) || 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=400'} alt={rel.title} className="w-full h-full object-cover" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-semibold text-gray-800 line-clamp-2 mb-1">{rel.title}</h4>
                <div className="flex items-baseline gap-1 sm:gap-1.5 flex-wrap">
                  <span className="text-sm sm:text-base font-bold text-gray-900">${rel.wholesalePrice.toLocaleString('es-AR')}</span>
                  <span className="text-xs text-[#00a650] font-semibold">min. {rel.minWholesaleQty} u.</span>
                </div>
                <span className="text-xs text-gray-500">${rel.retailPrice.toLocaleString('es-AR')} x1 unidad</span>
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
        onIndexChange={(newIdx) => setActiveImageIndex(newIdx)}
      />
    </div>
  );
};
