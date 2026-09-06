import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Product, CartItem, Category, SizeVariant } from '../types';
import {
  Search,
  Zap,
  Store,
  Truck,
  Banknote,
  CreditCard,
  Plus,
  Minus,
  ShoppingCart,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Package,
  Info,
  ChevronRight,
  Filter,
  Layers,
  ArrowUp,
  X
} from 'lucide-react';
import {
  normalizeVariantTypes,
  getActiveVariantImages,
  getSelectedVariantStock,
  getResolvedProductPrices,
  ResolvedProductPrices
} from '../utils/variantHelpers';
import { ImageWithSkeleton } from './common/ImageWithSkeleton';

export interface QuickBuyItem {
  itemId: string;
  productId: string;
  product: Product;
  title: string;
  variantText: string;
  image: string;
  sku?: string;
  stock: number;
  prices: ResolvedProductPrices;
  selectedVariants: Record<string, string>;
  category: string;
  minWholesaleQty: number;
}

interface QuickBuyViewProps {
  products: Product[];
  categories: Category[];
  cartItems: CartItem[];
  deliveryOption: 'pickup' | 'delivery';
  onSelectDeliveryOption: (option: 'pickup' | 'delivery') => void;
  paymentMethod: 'transfer' | 'cash';
  onSelectPaymentMethod: (method: 'transfer' | 'cash') => void;
  onAddToCart: (
    product: Product,
    selectedColor?: string,
    selectedSizeVariant?: SizeVariant,
    quantity?: number,
    selectedImage?: string,
    selectedVariants?: Record<string, string>
  ) => void;
  onUpdateCartQuantity: (id: string, delta: number) => void;
  onSetCartItemQuantity: (
    product: Product,
    selectedVariants: Record<string, string>,
    selectedImage: string,
    targetQty: number
  ) => void;
  onRemoveCartItem: (id: string) => void;
  onOpenCart: () => void;
  onProceedToCheckout: () => void;
  onGoToHome?: () => void;
  onSelectProductDetail?: (product: Product, selectedVariants?: Record<string, string>, selectedImage?: string) => void;
}

export const QuickBuyView: React.FC<QuickBuyViewProps> = ({
  products,
  categories,
  cartItems,
  deliveryOption,
  onSelectDeliveryOption,
  paymentMethod,
  onSelectPaymentMethod,
  onAddToCart,
  onUpdateCartQuantity,
  onSetCartItemQuantity,
  onRemoveCartItem,
  onOpenCart,
  onProceedToCheckout,
  onGoToHome,
  onSelectProductDetail,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<string>('all');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [previewImage, setPreviewImage] = useState<{
    url: string;
    title: string;
    variantText?: string;
  } | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const touchStartYRef = useRef<number | null>(null);
  const touchStartXRef = useRef<number | null>(null);

  // Close image preview modal on ESC
  useEffect(() => {
    if (!previewImage) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPreviewImage(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewImage]);

  // Restore scroll position if returning from Cart
  useEffect(() => {
    try {
      const savedScroll = sessionStorage.getItem('quick_buy_scroll_pos');
      if (savedScroll) {
        window.scrollTo({ top: parseInt(savedScroll, 10), behavior: 'instant' });
      }
    } catch (e) {}

    const handleScroll = () => {
      try {
        sessionStorage.setItem('quick_buy_scroll_pos', window.scrollY.toString());
      } catch (e) {}
      setShowScrollTop(window.scrollY > 400);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Compute category quantities in the cart to determine wholesale status
  const categoryQuantitiesInCart = useMemo(() => {
    const map: Record<string, number> = {};
    cartItems.forEach((item) => {
      const cat = item.product.category || 'General';
      map[cat] = (map[cat] || 0) + item.quantity;
    });
    return map;
  }, [cartItems]);

  // Fast lookup for current quantities in cart: itemId -> quantity
  const cartQuantityMap = useMemo(() => {
    const map: Record<string, number> = {};
    cartItems.forEach((item) => {
      map[item.id] = item.quantity;
    });
    return map;
  }, [cartItems]);

  // Expand all products into variant flat items
  const allFlatItems = useMemo<QuickBuyItem[]>(() => {
    const list: QuickBuyItem[] = [];

    products.forEach((product) => {
      const variantTypes = normalizeVariantTypes(product);
      const minWholesaleQty = product.minWholesaleQty || 1;
      const category = product.category || 'General';

      if (variantTypes.length === 0) {
        // Product without variants
        const itemId = `${product.id}-none-none`;
        const prices = getResolvedProductPrices(product, {});
        const image = (product.images && product.images[0]) || 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=400';
        const codeSpec = product.specs?.find(
          (s) => s.label.toLowerCase().includes('código') || s.label.toLowerCase().includes('sku') || s.label.toLowerCase().includes('art')
        );

        list.push({
          itemId,
          productId: product.id,
          product,
          title: product.title,
          variantText: '',
          image,
          sku: codeSpec?.value || '',
          stock: product.stock ?? 99,
          prices,
          selectedVariants: {},
          category,
          minWholesaleQty,
        });
      } else if (variantTypes.length === 1) {
        // Product with 1 variant type (e.g. Color or Size)
        const vt1 = variantTypes[0];
        vt1.options.forEach((opt) => {
          const selectedVariants: Record<string, string> = { [vt1.name]: opt.name };
          const variantKey = `${vt1.name}:${opt.name}`;
          const itemId = `${product.id}-${variantKey}`;
          const prices = getResolvedProductPrices(product, selectedVariants);
          const image = (opt.images && opt.images[0]) || getActiveVariantImages(product, selectedVariants)[0];
          const stock = getSelectedVariantStock(product, selectedVariants);

          list.push({
            itemId,
            productId: product.id,
            product,
            title: product.title,
            variantText: opt.name,
            image,
            sku: opt.sku || '',
            stock,
            prices,
            selectedVariants,
            category,
            minWholesaleQty,
          });
        });
      } else {
        // Product with 2 or more variant types (Cartesian product)
        const vt1 = variantTypes[0];
        const vt2 = variantTypes[1];

        vt1.options.forEach((opt1) => {
          vt2.options.forEach((opt2) => {
            const selectedVariants: Record<string, string> = {
              [vt1.name]: opt1.name,
              [vt2.name]: opt2.name,
            };
            const variantKey = Object.entries(selectedVariants)
              .map(([k, v]) => `${k}:${v}`)
              .sort()
              .join('|');
            const itemId = `${product.id}-${variantKey}`;
            const prices = getResolvedProductPrices(product, selectedVariants);
            const image = (opt1.images && opt1.images[0]) || (opt2.images && opt2.images[0]) || getActiveVariantImages(product, selectedVariants)[0];
            const stock = getSelectedVariantStock(product, selectedVariants);

            list.push({
              itemId,
              productId: product.id,
              product,
              title: product.title,
              variantText: `${opt1.name} • ${opt2.name}`,
              image,
              sku: opt2.sku || opt1.sku || '',
              stock,
              prices,
              selectedVariants,
              category,
              minWholesaleQty,
            });
          });
        });
      }
    });

    return list;
  }, [products]);

  // Filter items by search query
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return allFlatItems;
    const query = searchQuery.toLowerCase().trim();

    return allFlatItems.filter((item) => {
      const matchTitle = item.title.toLowerCase().includes(query);
      const matchVariant = item.variantText.toLowerCase().includes(query);
      const matchCat = item.category.toLowerCase().includes(query);
      const matchSku = item.sku ? item.sku.toLowerCase().includes(query) : false;
      const matchSubcat = item.product.subcategory ? item.product.subcategory.toLowerCase().includes(query) : false;
      return matchTitle || matchVariant || matchCat || matchSku || matchSubcat;
    });
  }, [allFlatItems, searchQuery]);

  // Helper to determine price for sorting
  const getSortPrice = (item: QuickBuyItem): number => {
    if (deliveryOption === 'pickup' && paymentMethod === 'cash') {
      return item.prices.wholesaleCashPrice || item.prices.wholesalePrice || 0;
    }
    return item.prices.wholesalePrice || 0;
  };

  // Group filtered items by category, sorted within each category from lowest to highest price (menor a mayor precio)
  const groupedCategories = useMemo(() => {
    const groups: { categoryName: string; categoryObj?: Category; items: QuickBuyItem[] }[] = [];
    const categoryMap = new Map<string, QuickBuyItem[]>();

    filteredItems.forEach((item) => {
      const cat = item.category || 'General';
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, []);
      }
      categoryMap.get(cat)!.push(item);
    });

    // Order categories according to the defined category list or alphabetically
    const existingCatNames = Array.from(categoryMap.keys());
    const sortedCatNames: string[] = [];

    // First add known categories by their sortOrder
    categories.forEach((c) => {
      if (categoryMap.has(c.name)) {
        sortedCatNames.push(c.name);
      }
    });

    // Append any remaining categories not explicitly in categories list
    existingCatNames.forEach((name) => {
      if (!sortedCatNames.includes(name)) {
        sortedCatNames.push(name);
      }
    });

    sortedCatNames.forEach((catName) => {
      const rawItems = categoryMap.get(catName) || [];
      // Sort ascending by price (menor a mayor precio)
      const sortedItems = [...rawItems].sort((a, b) => getSortPrice(a) - getSortPrice(b));
      const categoryObj = categories.find((c) => c.name.toLowerCase() === catName.toLowerCase());

      groups.push({
        categoryName: catName,
        categoryObj,
        items: sortedItems,
      });
    });

    return groups;
  }, [filteredItems, categories, deliveryOption, paymentMethod]);

  // Calculate live Cart totals with the active payment method & delivery selection
  const totalCartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  const cartCalculations = useMemo(() => {
    let subtotal = 0;
    let totalSavings = 0;

    cartItems.forEach((item) => {
      const cat = item.product.category || 'General';
      const catQty = categoryQuantitiesInCart[cat] || 0;
      const minQty = item.product.minWholesaleQty || 1;
      const isWholesale = catQty >= minQty;

      const prices = getResolvedProductPrices(item.product, item.selectedVariants, item.selectedSizeVariant);

      let unitPrice = 0;
      let retailComparison = 0;

      if (deliveryOption === 'pickup' && paymentMethod === 'cash') {
        const wholesaleCash = prices.wholesaleCashPrice || prices.wholesalePrice;
        const retailCash = prices.retailCashPrice || prices.retailPrice;
        unitPrice = isWholesale ? wholesaleCash : retailCash;
        retailComparison = retailCash;
      } else {
        unitPrice = isWholesale ? prices.wholesalePrice : prices.retailPrice;
        retailComparison = prices.retailPrice;
      }

      const itemTotal = unitPrice * item.quantity;
      const itemRetailTotal = retailComparison * item.quantity;

      subtotal += itemTotal;
      if (isWholesale) {
        totalSavings += Math.max(0, itemRetailTotal - itemTotal);
      }
    });

    return { subtotal, totalSavings };
  }, [cartItems, categoryQuantitiesInCart, deliveryOption, paymentMethod]);

  // Scroll to a specific category section
  const handleScrollToCategory = (catName: string) => {
    setSelectedCategoryTab(catName);
    if (catName === 'all') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const elem = document.getElementById(`category-section-${catName.replace(/\s+/g, '-')}`);
    if (elem) {
      const yOffset = -140; // accounts for sticky header & selectors
      const y = elem.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-gray-900 pb-28">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-[#004bb0] via-[#0058bb] to-[#006ee6] text-white py-4 md:py-6 px-4 shadow-sm">
        <div className="max-w-[1240px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-black font-['Montserrat'] tracking-tight text-white flex items-center gap-2">
              ⚡ Compra Rápida
            </h1>
            <p className="text-xs md:text-sm text-blue-100 max-w-2xl">
              Agrega variantes, talles y modelos directamente con los botones <strong className="text-yellow-300">– / +</strong>. Precios actualizados en tiempo real según entrega y pago.
            </p>
          </div>
        </div>
      </div>

      {/* Main Container - Minimal mobile padding for maximum width */}
      <div className="max-w-[1240px] mx-auto px-1 sm:px-4 py-2 sm:py-6 space-y-3 sm:space-y-6">
        {/* 1. Modalidad de Entrega & Forma de Pago (Flat native selectors on mobile, card on desktop) */}
        <div className="bg-transparent md:bg-white rounded-none md:rounded-2xl border-0 md:border md:border-gray-200/80 p-1 md:p-5 shadow-none md:shadow-xs space-y-2.5 sm:space-y-3 md:space-y-4 pb-3 border-b border-gray-100 md:border-b-0">
          <div className="flex items-center justify-between border-b border-gray-100 pb-1.5 sm:pb-2.5">
            <span className="text-xs sm:text-xs md:text-sm font-bold uppercase tracking-wide sm:tracking-wider text-gray-800 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#0058bb]" />
              Entrega y Forma de Pago
            </span>
            <span className="text-xs text-gray-500 hidden sm:inline">
              Ajusta los precios de la lista al instante
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3 md:gap-4">
            {/* Modalidad de Entrega */}
            <div className="space-y-1.5 sm:space-y-1.5 md:space-y-2">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-[#0058bb]" />
                OPCIONES DE ENTREGA
              </label>
              <div className="grid grid-cols-2 gap-2">
                {/* Retiro en el local */}
                <button
                  type="button"
                  id="quick-buy-pickup-btn"
                  onClick={() => onSelectDeliveryOption('pickup')}
                  className={`h-full px-2.5 py-2 sm:px-3 sm:py-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[46px] ${
                    deliveryOption === 'pickup'
                      ? 'border-[#0058bb] bg-blue-50/70 ring-2 ring-[#0058bb]/20 shadow-xs'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className="flex items-center gap-1.5 font-bold text-xs sm:text-xs md:text-sm text-gray-900 leading-tight">
                      <Store className={`w-4 h-4 ${deliveryOption === 'pickup' ? 'text-[#0058bb]' : 'text-gray-500'}`} />
                      <span>Retiro en local</span>
                    </div>
                    {deliveryOption === 'pickup' && (
                      <CheckCircle2 className="w-4 h-4 text-[#0058bb] shrink-0" />
                    )}
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-1">
                    <span className="text-[11px] text-gray-500 truncate">Flores, CABA.</span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded shrink-0">
                      GRATIS
                    </span>
                  </div>
                </button>

                {/* Envío a domicilio / sucursal */}
                <button
                  type="button"
                  id="quick-buy-delivery-btn"
                  onClick={() => onSelectDeliveryOption('delivery')}
                  className={`h-full px-2.5 py-2 sm:px-3 sm:py-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[46px] ${
                    deliveryOption === 'delivery'
                      ? 'border-[#0058bb] bg-blue-50/70 ring-2 ring-[#0058bb]/20 shadow-xs'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className="flex items-center gap-1.5 font-bold text-xs sm:text-xs md:text-sm text-gray-900 leading-tight">
                      <Truck className={`w-4 h-4 ${deliveryOption === 'delivery' ? 'text-[#0058bb]' : 'text-gray-500'}`} />
                      <span>Envió a domicilio</span>
                    </div>
                    {deliveryOption === 'delivery' && (
                      <CheckCircle2 className="w-4 h-4 text-[#0058bb] shrink-0" />
                    )}
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-1">
                    <span className="text-[11px] text-gray-500 truncate">Correo / Moto</span>
                    <span className="text-[10px] font-semibold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded shrink-0">
                      A todo el país
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* Forma de Pago */}
            <div className="space-y-1.5 sm:space-y-1.5 md:space-y-2">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                Forma de Pago
              </label>

              {deliveryOption === 'pickup' ? (
                /* Retiro: Permite Efectivo o Transferencia */
                <div className="grid grid-cols-2 gap-2">
                  {/* Efectivo */}
                  <button
                    type="button"
                    id="quick-buy-pay-cash-btn"
                    onClick={() => onSelectPaymentMethod('cash')}
                    className={`h-full px-2.5 py-2 sm:px-3 sm:py-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[46px] ${
                      paymentMethod === 'cash'
                        ? 'border-emerald-600 bg-emerald-50/80 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="flex items-center gap-1.5 font-bold text-xs sm:text-xs md:text-sm text-gray-900 leading-tight">
                        <Banknote className={`w-4 h-4 ${paymentMethod === 'cash' ? 'text-emerald-700' : 'text-gray-500'}`} />
                        <span>Efectivo</span>
                      </div>
                      {paymentMethod === 'cash' && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      )}
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-1">
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-200/80 px-1.5 py-0.5 rounded shrink-0">
                        🏷️ Mejor precio
                      </span>
                    </div>
                  </button>

                  {/* Transferencia */}
                  <button
                    type="button"
                    id="quick-buy-pay-transfer-btn"
                    onClick={() => onSelectPaymentMethod('transfer')}
                    className={`h-full px-2.5 py-2 sm:px-3 sm:py-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[46px] ${
                      paymentMethod === 'transfer'
                        ? 'border-[#0058bb] bg-blue-50/70 ring-2 ring-[#0058bb]/20 shadow-xs'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="flex items-center gap-1.5 font-bold text-xs sm:text-xs md:text-sm text-gray-900 leading-tight">
                        <CreditCard className={`w-4 h-4 ${paymentMethod === 'transfer' ? 'text-[#0058bb]' : 'text-gray-500'}`} />
                        <span>Transferencia</span>
                      </div>
                      {paymentMethod === 'transfer' && (
                        <CheckCircle2 className="w-4 h-4 text-[#0058bb] shrink-0" />
                      )}
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-1">
                      <span className="text-[11px] text-gray-500 truncate">
                        Alias / CVU
                      </span>
                    </div>
                  </button>
                </div>
              ) : (
                /* Envío: Oculta efectivo y muestra solo Transferencia */
                <div className="p-2 sm:p-3 rounded-xl border border-[#0058bb] bg-blue-50/70 ring-2 ring-[#0058bb]/20 flex items-center justify-between min-h-[46px]">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <CreditCard className="w-4 h-4 text-[#0058bb] shrink-0" />
                    <div>
                      <span className="font-bold text-xs sm:text-sm text-gray-900 block leading-tight">
                        Transferencia Bancaria
                      </span>
                      <span className="text-[11px] text-gray-500 block leading-tight">
                        Pago por Alias / CVU
                      </span>
                    </div>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-[#0058bb] shrink-0 ml-1.5 sm:ml-2" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 2. Barra Anclada Unificada: Logo + Categorías + Buscador (Lupa) en un solo renglón */}
        <div className="sticky top-0 z-35 bg-white/95 backdrop-blur-md py-2.5 px-3 sm:px-4 -mx-3 sm:-mx-4 border-b border-gray-200 shadow-xs transition-all">
          <div className="flex items-center gap-2 max-w-full">
            {/* Logo de marca al lado izquierdo de "Todas" */}
            <button
              type="button"
              id="quick-sticky-brand-logo-btn"
              onClick={() => {
                if (onGoToHome) {
                  onGoToHome();
                } else {
                  handleScrollToCategory('all');
                }
              }}
              className="p-1 rounded-xl bg-white border border-gray-200 hover:border-blue-400 hover:shadow-xs transition-all shrink-0 flex items-center justify-center cursor-pointer group active:scale-95"
              title="Ir a la página de inicio"
            >
              <img
                src="https://zzkzssqwpcacmegmxerb.supabase.co/storage/v1/object/public/product-images/products/lgo%20ps.png"
                alt="Logo"
                className="w-7 h-7 sm:w-8 sm:h-8 object-contain transition-transform group-hover:scale-105"
                referrerPolicy="no-referrer"
              />
            </button>

            {/* Recuadros de Categorías (Desplazamiento horizontal sin números) */}
            <div className="flex-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs py-0.5 min-w-0">
              <button
                type="button"
                id="quick-cat-tab-all"
                onClick={() => handleScrollToCategory('all')}
                className={`px-3 py-1.5 rounded-full font-bold whitespace-nowrap cursor-pointer transition-all shrink-0 ${
                  selectedCategoryTab === 'all'
                    ? 'bg-[#0058bb] text-white shadow-xs'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                Todas
              </button>

              {groupedCategories.map((group) => {
                const isActive = selectedCategoryTab === group.categoryName;
                return (
                  <button
                    key={group.categoryName}
                    type="button"
                    id={`quick-cat-tab-${group.categoryName.replace(/\s+/g, '-')}`}
                    onClick={() => handleScrollToCategory(group.categoryName)}
                    className={`px-3 py-1.5 rounded-full font-semibold whitespace-nowrap cursor-pointer transition-all shrink-0 ${
                      isActive
                        ? 'bg-[#0058bb] text-white font-bold shadow-xs'
                        : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                    }`}
                  >
                    <span>{group.categoryName}</span>
                  </button>
                );
              })}
            </div>

            {/* Buscador reducido a Icono de Lupa al extremo derecho */}
            <div className="shrink-0 flex items-center">
              {isSearchOpen || searchQuery ? (
                <div className="relative flex items-center animate-in fade-in zoom-in-95 duration-150">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    id="quick-buy-search-input"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar producto o SKU..."
                    className="w-36 sm:w-48 md:w-64 bg-white text-gray-900 placeholder-gray-400 text-xs sm:text-sm rounded-full py-1.5 pl-7 pr-7 border border-blue-400 shadow-xs focus:outline-none focus:ring-2 focus:ring-[#0058bb] transition-all"
                    autoFocus
                  />
                  <button
                    type="button"
                    id="quick-buy-clear-search-btn"
                    onClick={() => {
                      setSearchQuery('');
                      setIsSearchOpen(false);
                    }}
                    className="absolute right-2 text-xs text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full w-4 h-4 flex items-center justify-center cursor-pointer transition-colors"
                    title="Cerrar buscador"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  id="quick-buy-open-search-btn"
                  onClick={() => {
                    setIsSearchOpen(true);
                    setTimeout(() => searchInputRef.current?.focus(), 50);
                  }}
                  className="p-2 sm:px-2.5 sm:py-1.5 rounded-full bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 hover:border-gray-300 transition-all shrink-0 flex items-center justify-center cursor-pointer shadow-xs active:scale-95"
                  title="Buscar productos"
                >
                  <Search className="w-4 h-4 text-gray-700" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 3. Products List Grouped by Category */}
        {groupedCategories.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center space-y-3">
            <Package className="w-12 h-12 text-gray-300 mx-auto" />
            <h3 className="text-lg font-bold text-gray-800">No se encontraron productos</h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              No hay variantes que coincidan con &ldquo;{searchQuery}&rdquo;. Intenta con otro término o limpia el buscador.
            </p>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="bg-[#0058bb] hover:bg-[#004bb0] text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer transition-colors"
            >
              Ver todo el catálogo
            </button>
          </div>
        ) : (
          groupedCategories.map((group) => {
            const catQtyInCart = categoryQuantitiesInCart[group.categoryName] || 0;
            const sampleMinQty = group.items[0]?.minWholesaleQty || 3;
            const isCategoryWholesaleReached = catQtyInCart >= sampleMinQty;
            const remainingToCategoryWholesale = Math.max(0, sampleMinQty - catQtyInCart);

            return (
              <section
                key={group.categoryName}
                id={`category-section-${group.categoryName.replace(/\s+/g, '-')}`}
                className="bg-transparent md:bg-white rounded-none md:rounded-2xl border-0 md:border md:border-gray-200/90 shadow-none md:shadow-xs overflow-hidden scroll-mt-36 pb-3"
              >
                {/* Category Header - Seamless on mobile */}
                <div className="bg-transparent md:bg-gradient-to-r md:from-gray-50 md:via-white md:to-gray-50 px-1 sm:px-3.5 py-2 border-b border-gray-200 flex flex-wrap items-center justify-between gap-1.5 sm:gap-2">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#0058bb] shrink-0" />
                    <h2 className="text-sm sm:text-sm md:text-base font-black font-['Montserrat'] text-gray-900 uppercase tracking-tight leading-none">
                      {group.categoryName}
                    </h2>
                  </div>

                  {/* Wholesale Threshold Badge */}
                  <div className="flex items-center gap-1.5">
                    {isCategoryWholesaleReached ? (
                      <span className="inline-flex items-center text-[11px] sm:text-[11px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-full leading-tight">
                        <span>Mayorista alcanzado ({catQtyInCart} unids.)</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] sm:text-[11px] font-medium text-blue-900 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full leading-tight">
                        <Sparkles className="w-3.5 h-3.5 text-[#0058bb] shrink-0" />
                        <span>
                          Mayorista desde <strong>{sampleMinQty} u.</strong>
                          {catQtyInCart > 0 && ` (${catQtyInCart}/${sampleMinQty})`}
                        </span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Items List - Seamless rows with subtle hairline dividers */}
                <div className="divide-y divide-gray-100 bg-white md:bg-transparent rounded-xl md:rounded-none border border-gray-200/80 md:border-0 overflow-hidden shadow-2xs md:shadow-none">
                  {group.items.map((item) => {
                    const currentCartQty = cartQuantityMap[item.itemId] || 0;
                    const isOutOfStock = item.stock <= 0;

                    // Resolve price display based on current delivery + payment
                    const isCash = deliveryOption === 'pickup' && paymentMethod === 'cash';
                    const wholesalePrice = isCash
                      ? item.prices.wholesaleCashPrice || item.prices.wholesalePrice
                      : item.prices.wholesalePrice;
                    const retailPrice = isCash
                      ? item.prices.retailCashPrice || item.prices.retailPrice
                      : item.prices.retailPrice;

                    const activeUnitPrice = isCategoryWholesaleReached ? wholesalePrice : retailPrice;

                    return (
                      <div
                        key={item.itemId}
                        id={`quick-item-${item.itemId}`}
                        className={`p-0 pr-2.5 sm:p-2.5 md:p-3 transition-colors flex items-center justify-between gap-2 sm:gap-3 md:gap-4 h-20 sm:h-auto overflow-hidden ${
                          currentCartQty > 0 ? 'bg-blue-50/40' : 'hover:bg-gray-50/60'
                        }`}
                      >
                        {/* Left: Thumbnail & Details */}
                        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 h-full">
                          {/* Image Thumbnail - Square, full height of row, 0 border, 0 padding on mobile */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewImage({
                                url: item.image,
                                title: item.title,
                                variantText: item.variantText
                              });
                            }}
                            className="w-20 h-20 sm:w-14 sm:h-14 md:w-16 md:h-16 aspect-square bg-gray-50 sm:bg-white rounded-none sm:rounded-xl border-0 sm:border border-gray-200/80 p-0 sm:p-0.5 shrink-0 overflow-hidden flex items-center justify-center cursor-pointer hover:border-blue-400 transition-all group/img relative shadow-none sm:shadow-2xs"
                            title={`Ampliar imagen de ${item.title}`}
                          >
                            <ImageWithSkeleton
                              src={item.image}
                              alt={`${item.title} ${item.variantText}`}
                              className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-200"
                            />
                          </button>

                          {/* Info - Single line title on mobile, never breaking into two lines */}
                          <div className="flex-1 min-w-0 space-y-0.5 overflow-hidden py-1 sm:py-0">
                            <div className="flex items-center min-w-0 w-full">
                              <button
                                type="button"
                                onClick={() => onSelectProductDetail?.(item.product, item.selectedVariants, item.image)}
                                className="font-bold text-xs sm:text-sm md:text-base text-gray-900 hover:text-[#0058bb] text-left leading-snug transition-colors cursor-pointer truncate block w-full sm:whitespace-normal sm:line-clamp-2"
                                title={`Ver detalle de ${item.title}`}
                              >
                                {item.title}
                              </button>
                            </div>

                            {/* Variant chip */}
                            {item.variantText ? (
                              <div className="flex items-center gap-1 pt-0.5">
                                <span className="inline-flex items-center font-bold text-[11px] sm:text-xs text-[#0058bb] bg-blue-50 border border-blue-200/70 px-1.5 sm:px-2 py-0.5 rounded-md leading-none truncate max-w-full">
                                  {item.variantText}
                                </span>
                              </div>
                            ) : null}
                          </div>
                        </div>

                        {/* Right: Price & Quantity Controller - Price placed above quantity selector on mobile */}
                        <div className="flex flex-col items-end justify-center gap-1 sm:flex-row sm:items-center sm:gap-4 md:gap-5 shrink-0">
                          {/* Clean Single Price Display */}
                          <div className="text-right">
                            <span className="text-sm sm:text-base md:text-lg font-black text-gray-900 font-['Montserrat'] whitespace-nowrap leading-tight block">
                              $ {activeUnitPrice.toLocaleString('es-AR')}
                            </span>
                          </div>

                          {/* Quantity Controller */}
                          <div className="flex items-center">
                            {isOutOfStock ? (
                              <span className="text-xs font-semibold text-gray-400 px-2 py-1 bg-gray-100 rounded-lg">
                                Agotado
                              </span>
                            ) : currentCartQty === 0 ? (
                              <button
                                type="button"
                                id={`quick-add-${item.itemId}`}
                                onClick={() =>
                                  onAddToCart(
                                    item.product,
                                    undefined,
                                    undefined,
                                    1,
                                    item.image,
                                    item.selectedVariants
                                  )
                                }
                                className="bg-[#0058bb] hover:bg-[#004bb0] text-white font-bold text-xs sm:text-sm px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl transition-all shadow-xs flex items-center justify-center gap-1 cursor-pointer active:scale-95 min-h-[30px] sm:min-h-[38px]"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Agregar</span>
                              </button>
                            ) : (
                              <div className="flex items-center bg-white border-2 border-[#0058bb] rounded-xl overflow-hidden shadow-xs">
                                <button
                                  type="button"
                                  id={`quick-dec-${item.itemId}`}
                                  onClick={() => onUpdateCartQuantity(item.itemId, -1)}
                                  className="w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 flex items-center justify-center text-[#0058bb] hover:bg-blue-50 transition-colors cursor-pointer active:bg-blue-100"
                                  title="Disminuir cantidad"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>

                                <input
                                  type="number"
                                  min={0}
                                  max={item.stock > 0 ? item.stock : 999}
                                  value={currentCartQty}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value, 10);
                                    if (isNaN(val) || val <= 0) {
                                      onRemoveCartItem(item.itemId);
                                    } else {
                                      const clamped = item.stock > 0 ? Math.min(val, item.stock) : val;
                                      onSetCartItemQuantity(item.product, item.selectedVariants, item.image, clamped);
                                    }
                                  }}
                                  className="w-7 sm:w-10 md:w-11 h-7 sm:h-8 md:h-9 text-center text-xs sm:text-sm font-black text-gray-900 focus:outline-none bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />

                                <button
                                  type="button"
                                  id={`quick-inc-${item.itemId}`}
                                  disabled={item.stock > 0 && currentCartQty >= item.stock}
                                  onClick={() => onUpdateCartQuantity(item.itemId, 1)}
                                  className={`w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 flex items-center justify-center text-[#0058bb] hover:bg-blue-50 transition-colors cursor-pointer active:bg-blue-100 ${
                                    item.stock > 0 && currentCartQty >= item.stock
                                      ? 'opacity-30 cursor-not-allowed'
                                      : ''
                                  }`}
                                  title={
                                    item.stock > 0 && currentCartQty >= item.stock
                                      ? 'Stock máximo alcanzado'
                                      : 'Aumentar cantidad'
                                  }
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}
      </div>

      {/* 4. Fixed Bottom Bar (Barra inferior fija con cantidad total, importe y botón Ver carrito) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200/90 shadow-[0_-8px_25px_rgba(0,0,0,0.08)] px-3 sm:px-4 py-2.5 md:py-3 transition-transform">
        <div className="max-w-[1240px] mx-auto flex items-center justify-between gap-3">
          {/* Left: Summary Info */}
          <div className="flex items-center min-w-0 flex-1">
            {/* Total price and details */}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5 min-w-0 overflow-hidden whitespace-nowrap">
                <span className="text-xs text-gray-500 font-medium hidden sm:inline shrink-0">Total:</span>
                <span id="quick-buy-total-amount" className="text-lg md:text-2xl font-black text-gray-900 font-['Montserrat'] tracking-tight shrink-0">
                  $ {cartCalculations.subtotal.toLocaleString('es-AR')}
                </span>
                <span className="text-[11px] text-gray-500 overflow-hidden whitespace-nowrap [text-overflow:clip] min-w-0 shrink">
                  ({totalCartCount}unids.)
                </span>
              </div>

              {/* Delivery / Payment mini tag */}
              <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-gray-500 truncate">
                <span className="font-semibold text-gray-700">
                  {deliveryOption === 'pickup' ? 'Retiro en local' : 'Envió a domicilio'}
                </span>
                <span>•</span>
                <span className={paymentMethod === 'cash' ? 'text-emerald-700 font-bold' : 'text-blue-700 font-semibold'}>
                  {paymentMethod === 'cash' ? 'Efectivo' : 'Transferencia'}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Ver Carrito & Finalizar Compra CTA */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              id="quick-buy-view-cart-btn"
              onClick={onOpenCart}
              className="bg-white hover:bg-gray-100 text-gray-800 font-bold text-xs sm:text-sm px-3 sm:px-4 py-2.5 rounded-xl border border-gray-300 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
            >
              <ShoppingCart className="w-4 h-4 text-[#0058bb]" />
              <span>Carrito</span>
            </button>

            <button
              type="button"
              id="quick-buy-checkout-btn"
              onClick={onProceedToCheckout}
              disabled={totalCartCount === 0}
              className={`font-bold text-xs sm:text-sm px-3 sm:px-4 py-2.5 rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer ${
                totalCartCount > 0
                  ? 'bg-[#0058bb] hover:bg-[#004bb0] text-white active:scale-95'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
              }`}
            >
              <span>Comprar</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Floating Scroll to Top button */}
      {showScrollTop && (
        <button
          type="button"
          id="quick-buy-scroll-top-btn"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-20 right-4 z-30 p-2.5 rounded-full bg-gray-900 text-white shadow-lg hover:bg-black transition-all cursor-pointer opacity-90 hover:opacity-100"
          title="Volver arriba"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}

      {/* Lightbox / Ventana Emergente con Imagen Ampliada */}
      {previewImage && (
        <div
          id="quick-buy-image-modal"
          className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 transition-opacity animate-in fade-in duration-200"
          onClick={() => setPreviewImage(null)}
          onTouchStart={(e) => {
            if (e.touches.length === 1) {
              touchStartYRef.current = e.touches[0].clientY;
              touchStartXRef.current = e.touches[0].clientX;
            }
          }}
          onTouchEnd={(e) => {
            if (touchStartYRef.current !== null && touchStartXRef.current !== null && e.changedTouches.length === 1) {
              const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;
              const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
              // Si se desliza más de 45px vertical u horizontalmente, cerramos la ventana
              if (Math.abs(deltaY) > 45 || Math.abs(deltaX) > 60) {
                setPreviewImage(null);
              }
            }
            touchStartYRef.current = null;
            touchStartXRef.current = null;
          }}
        >
          {/* Botón cerrar "X" superior */}
          <button
            type="button"
            id="close-image-modal-btn"
            onClick={(e) => {
              e.stopPropagation();
              setPreviewImage(null);
            }}
            className="absolute top-4 right-4 sm:top-6 sm:right-6 z-70 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center cursor-pointer transition-all shadow-lg active:scale-95 border border-white/30"
            title="Cerrar imagen (o desliza)"
          >
            <X className="w-6 h-6 stroke-[2.5]" />
          </button>

          {/* Contenedor central de la imagen */}
          <div
            className="relative max-w-[92vw] sm:max-w-md md:max-w-lg lg:max-w-xl max-h-[85vh] bg-white rounded-2xl p-2 sm:p-3 shadow-2xl flex flex-col items-center gap-2.5 overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Imagen Ampliada */}
            <div className="w-full max-h-[68vh] sm:max-h-[70vh] flex items-center justify-center overflow-hidden rounded-xl bg-gray-50">
              <img
                src={previewImage.url}
                alt={previewImage.title}
                className="w-full h-full max-h-[68vh] sm:max-h-[70vh] object-contain select-none"
                loading="eager"
              />
            </div>

            {/* Título, Variante y Guía de Cierre */}
            <div className="w-full px-1.5 pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-center sm:text-left">
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-sm sm:text-base text-gray-900 truncate">
                  {previewImage.title}
                </h3>
                {previewImage.variantText && (
                  <span className="inline-block text-xs font-semibold text-[#0058bb] bg-blue-50 px-2 py-0.5 rounded-md mt-0.5">
                    {previewImage.variantText}
                  </span>
                )}
              </div>
              <span className="text-[11px] text-gray-400 font-medium shrink-0">
                Desliza o toca la ✕ para cerrar
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
