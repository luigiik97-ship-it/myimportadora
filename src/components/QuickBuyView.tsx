import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Product, CartItem, Category, SizeVariant, Order, UserProfile } from '../types';
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
  X,
  ExternalLink,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import {
  normalizeVariantTypes,
  getActiveVariantImages,
  getSelectedVariantStock,
  getResolvedProductPrices,
  ResolvedProductPrices
} from '../utils/variantHelpers';
import { ImageWithSkeleton } from './common/ImageWithSkeleton';
import { ProductImageLightbox } from './common/ProductImageLightbox';
import {
  isQuickBuyCustomLinkActive,
  getQuickBuyLinkConfig,
  recordQuickBuyOrderPlaced,
  buildQuickBuyWhatsAppMessage,
  buildQuickBuyWhatsAppUrl
} from '../services/quickBuyLink';
import { getNextCorrelativeOrderNumber, saveOrder } from '../services/supabase';
import { getLocalAuthUser, getLocalProfiles } from '../services/auth';
import { OfficialWhatsAppIcon } from './admin/QuickBuyLinkManager';

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
  onOpenCart: (options?: { deliveryOption?: 'pickup' | 'delivery'; paymentMethod?: 'transfer' | 'cash' }) => void;
  onProceedToCheckout: () => void;
  onGoToHome?: () => void;
  onSelectProductDetail?: (product: Product, selectedVariants?: Record<string, string>, selectedImage?: string) => void;
  currentUser?: UserProfile | null;
  onSaveOrder?: (orderPayload: any) => Promise<Order>;
  onClearCart?: () => void;
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
  currentUser,
  onSaveOrder,
  onClearCart,
}) => {
  const [isCustomLinkMode, setIsCustomLinkMode] = useState<boolean>(() => {
    return isQuickBuyCustomLinkActive(typeof window !== 'undefined' ? window.location.search : '');
  });
  const [isSubmittingWhatsAppOrder, setIsSubmittingWhatsAppOrder] = useState(false);
  const [orderSaveError, setOrderSaveError] = useState<string | null>(null);
  const [whatsAppSuccessModal, setWhatsAppSuccessModal] = useState<{
    orderNumber: string;
    waUrl: string;
    itemsCount: number;
    total: number;
  } | null>(null);

  // Mantener actualizado el modo de enlace personalizado si cambia la URL o la configuración
  useEffect(() => {
    const handleCheckMode = () => {
      setIsCustomLinkMode(isQuickBuyCustomLinkActive(window.location.search));
    };
    handleCheckMode();
    window.addEventListener('my_commerce_quick_buy_config_updated', handleCheckMode);
    window.addEventListener('popstate', handleCheckMode);
    return () => {
      window.removeEventListener('my_commerce_quick_buy_config_updated', handleCheckMode);
      window.removeEventListener('popstate', handleCheckMode);
    };
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<string>('all');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [lightboxData, setLightboxData] = useState<{
    images: string[];
    initialIndex: number;
    title: string;
    variantText?: string;
  } | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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
      const rawCat = (item.category || '').trim();
      const matchedAdminCat = categories.find(
        (c) =>
          c.name.toLowerCase() === rawCat.toLowerCase() ||
          c.slug.toLowerCase() === rawCat.toLowerCase() ||
          (c.id && c.id.toLowerCase() === rawCat.toLowerCase())
      );
      const finalCatName = matchedAdminCat ? matchedAdminCat.name : 'Otros';

      if (!categoryMap.has(finalCatName)) {
        categoryMap.set(finalCatName, []);
      }
      categoryMap.get(finalCatName)!.push(item);
    });

    // Order strictly according to the defined administration category list
    const sortedCatNames: string[] = [];

    // Add administered categories in their sortOrder
    categories.forEach((c) => {
      if (categoryMap.has(c.name) && !sortedCatNames.includes(c.name)) {
        sortedCatNames.push(c.name);
      }
    });

    // If 'Otros' has items but wasn't in categories list, append it
    if (categoryMap.has('Otros') && !sortedCatNames.includes('Otros')) {
      sortedCatNames.push('Otros');
    }

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

  // Procesa la compra rápida exclusiva del enlace personalizado por WhatsApp:
  // 1. Genera número correlativo único (#1001, etc.)
  // 2. Registra el pedido de inmediato en la base de datos para que aparezca en el panel de administración
  // 3. Abre WhatsApp (https://wa.me/message/TSF5H4YUIQJOC1) con el mensaje listo (número de pedido, listado de productos, cantidades y total)
  const handleWhatsAppQuickBuy = async () => {
    if (totalCartCount === 0 || isSubmittingWhatsAppOrder) return;

    setIsSubmittingWhatsAppOrder(true);
    try {
      // 1. Generar número de pedido único y correlativo
      const orderNumber = await getNextCorrelativeOrderNumber();

      // 2. Mapear productos con precios resueltos
      const processedItems = cartItems.map((item) => {
        const cat = item.product.category || 'General';
        const catQty = categoryQuantitiesInCart[cat] || 0;
        const minQty = item.product.minWholesaleQty || 1;
        const isWholesale = catQty >= minQty;

        const prices = getResolvedProductPrices(item.product, item.selectedVariants, item.selectedSizeVariant);

        let unitPrice = isWholesale ? prices.wholesalePrice : prices.retailPrice;
        let cashUnitPrice = isWholesale
          ? (prices.wholesaleCashPrice || prices.wholesalePrice)
          : (prices.retailCashPrice || prices.retailPrice);

        const effectiveUnitPrice =
          deliveryOption === 'pickup' && paymentMethod === 'cash'
            ? cashUnitPrice
            : unitPrice;

        // Reutilizar la misma fuente de variantes que ya existe en el pedido y carrito
        const rawVariantList: string[] =
          item.selectedVariants && Object.keys(item.selectedVariants).length > 0
            ? (Object.values(item.selectedVariants).filter(Boolean) as string[])
            : item.variantText
            ? [item.variantText]
            : ([item.selectedColor, item.selectedSizeVariant?.name].filter(Boolean) as string[]);
        const resolvedVariantText = Array.from(new Set(rawVariantList)).join(', ');

        return {
          id: item.id,
          productId: item.productId,
          title: item.product.title,
          image: item.selectedImage || (item.product.images && item.product.images[0]) || '',
          variantText: resolvedVariantText || item.variantText || '',
          quantity: item.quantity,
          unitPrice: unitPrice,
          cashUnitPrice: cashUnitPrice,
          totalPrice: effectiveUnitPrice * item.quantity,
          totalCashPrice: cashUnitPrice * item.quantity,
          isWholesale,
        };
      });

      // 3. Resolver usuario: si está registrado, asociar pedido a su cuenta; si no, guardar usando el número de pedido sin solicitar registro
      const activeUser =
        currentUser ||
        (typeof window !== 'undefined'
          ? getLocalProfiles()[getLocalAuthUser()?.id || ''] || null
          : null);

      const orderPayload = {
        orderNumber,
        userId: activeUser ? activeUser.id : undefined,
        customerName: activeUser
          ? (activeUser.fullName || activeUser.email?.split('@')[0] || `Cliente #${orderNumber}`)
          : `Cliente #${orderNumber}`,
        customerEmail: activeUser?.email || '',
        customerWhatsapp: activeUser?.phone || 'WhatsApp',
        deliveryOption,
        shippingMethodName: deliveryOption === 'pickup' ? 'Retiro en local (Compra Rápida WhatsApp)' : 'Envío a coordinar por WhatsApp',
        deliveryAddress: activeUser?.street
          ? {
              street: activeUser.street || '',
              number: activeUser.streetNumber || '',
              floor: activeUser.floor || '',
              city: activeUser.city || '',
              postalCode: activeUser.postalCode || '',
              province: activeUser.province || '',
              receiverName: activeUser.receiverName || activeUser.fullName || '',
            }
          : undefined,
        paymentMethod,
        items: processedItems,
        subtotal: cartCalculations.subtotal,
        wholesaleDiscount: cartCalculations.totalSavings,
        cashDiscount: paymentMethod === 'cash' ? Math.max(0, cartCalculations.totalSavings) : 0,
        shippingCost: 0,
        total: cartCalculations.subtotal,
        status: 'pending_payment' as const,
      };

      // 4. Registrar en la base de datos de inmediato para que figure en el panel admin con estado "Pendiente"
      let savedOrder: Order | null = null;
      try {
        if (onSaveOrder) {
          savedOrder = await onSaveOrder(orderPayload);
        } else {
          savedOrder = await saveOrder(orderPayload);
        }
      } catch (saveError) {
        console.error('Error al guardar el pedido en la base de datos:', saveError);
        savedOrder = null;
      }

      // 5. VALIDACIÓN CRÍTICA: Solo después de confirmar que el pedido fue guardado correctamente, abrir WhatsApp.
      // Si el guardado falla, NO abrir WhatsApp y mostrar mensaje de error indicando que no se pudo registrar el pedido.
      if (!savedOrder || (!savedOrder.id && !savedOrder.orderNumber)) {
        setIsSubmittingWhatsAppOrder(false);
        setOrderSaveError('No se pudo registrar el pedido en el sistema. Por favor, verifica tu conexión e inténtalo nuevamente.');
        return;
      }

      // 6. Registrar métrica de uso del enlace
      recordQuickBuyOrderPlaced();

      // 7. Construir mensaje formateado para WhatsApp (comienza con #pedido, sigue listado de productos, cantidades y el total)
      const config = getQuickBuyLinkConfig();
      const confirmedOrderNumber = savedOrder.orderNumber || orderNumber;
      const orderItemsForWa = (savedOrder.items && savedOrder.items.length > 0)
        ? savedOrder.items
        : processedItems;

      const whatsappMessage = buildQuickBuyWhatsAppMessage({
        orderNumber: confirmedOrderNumber,
        items: orderItemsForWa.map((p: any) => ({
          title: p.title,
          quantity: p.quantity,
          variantText: p.variantText,
          unitPrice: p.unitPrice,
          totalPrice: p.totalPrice,
        })),
        total: cartCalculations.subtotal,
        deliveryOption,
        paymentMethod,
      });

      // 8. Construir URL oficial de WhatsApp universal con codificación adecuada (Android, iPhone y WhatsApp Web)
      const finalWaUrl = buildQuickBuyWhatsAppUrl(whatsappMessage, config.whatsappUrl);

      // 9. Abrir WhatsApp solo tras confirmar el guardado exitoso
      try {
        const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
        if (isMobile) {
          // En móviles (Android / iPhone), window.location.href dispara de inmediato el universal link/app nativa
          window.location.href = finalWaUrl;
        } else {
          const win = window.open(finalWaUrl, '_blank', 'noopener,noreferrer');
          if (!win || win.closed || typeof win.closed === 'undefined') {
            window.location.href = finalWaUrl;
          }
        }
      } catch (e) {
        window.location.href = finalWaUrl;
      }

      // 10. Limpiar carrito
      if (onClearCart) {
        onClearCart();
      }

      // 11. Mostrar confirmación visual interactiva
      setWhatsAppSuccessModal({
        orderNumber: confirmedOrderNumber,
        waUrl: finalWaUrl,
        itemsCount: totalCartCount,
        total: cartCalculations.subtotal,
      });
    } catch (err) {
      console.error('Error procesando pedido de compra rápida WhatsApp:', err);
      setOrderSaveError('No se pudo registrar el pedido. Por favor verifica tu conexión e intenta nuevamente.');
    } finally {
      setIsSubmittingWhatsAppOrder(false);
    }
  };

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
      <div
        className="text-white py-3.5 sm:py-4.5 md:py-5 px-1 sm:px-6 shadow-sm relative overflow-hidden border-b border-gray-800"
        style={{
          background: 'radial-gradient(ellipse 85% 90% at 50% 50%, #262c36 0%, #15181f 55%, #08090c 100%)'
        }}
      >
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage: 'repeating-linear-gradient(65deg, rgba(255, 255, 255, 0.03) 0px, rgba(255, 255, 255, 0.03) 1px, transparent 1px, transparent 6px)'
          }}
        />
        <div className="max-w-[1240px] mx-auto w-full relative z-10">
          <h1 className="sr-only">Compra Rápida</h1>
          <p className="text-xs sm:text-sm md:text-[14.5px] text-gray-100 w-full leading-relaxed tracking-normal">
            <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full border-2 border-yellow-400 bg-black text-white font-bold text-xs sm:text-sm mr-1.5 sm:mr-2 align-middle shadow-xs">
              <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 fill-amber-400 shrink-0" />
              <span>Compra rápida</span>
            </span>
            Agrega decenas de productos en segundos, ideal para compras mayoristas. Los precios se actualizan en tiempo real según entrega y pago.
          </p>
        </div>
      </div>

      {/* Main Container - Minimal mobile padding for maximum width */}
      <div className="max-w-[1240px] mx-auto px-1 sm:px-4 py-2 sm:py-6 space-y-3 sm:space-y-6">
        {/* 1. Modalidad de Entrega & Forma de Pago (Flat native selectors on mobile, card on desktop) */}
        <div className="bg-transparent md:bg-white rounded-none md:rounded-2xl border-0 md:border md:border-gray-200/80 p-1 md:p-5 shadow-none md:shadow-xs space-y-2.5 sm:space-y-3 md:space-y-4 pb-3 border-b border-gray-100 md:border-b-0">
          <div className="hidden items-center justify-between border-b border-gray-100 pb-1.5 sm:pb-2.5">
            <span className="hidden text-xs sm:text-xs md:text-sm font-bold uppercase tracking-wide sm:tracking-wider text-gray-800 items-center gap-1.5">
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
                    <span className="text-xs text-gray-500 truncate">Flores, CABA.</span>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded shrink-0">
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
                    <div className="flex items-center gap-1.5 font-bold text-xs sm:text-xs md:text-sm text-gray-900 leading-tight min-w-0 overflow-hidden">
                      <Truck className={`w-4 h-4 shrink-0 ${deliveryOption === 'delivery' ? 'text-[#0058bb]' : 'text-gray-500'}`} />
                      <span className="whitespace-nowrap overflow-hidden [text-overflow:clip]">Envió a domicilio</span>
                    </div>
                    {deliveryOption === 'delivery' && (
                      <CheckCircle2 className="w-4 h-4 text-[#0058bb] shrink-0" />
                    )}
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-1">
                    <span className="text-xs text-gray-500 truncate">Correo / Moto</span>
                    <span className="text-xs font-semibold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded shrink-0">
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
                    className={`h-full px-2.5 py-2 sm:px-3 sm:py-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[58px] md:min-h-[62px] ${
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
                    <div className="mt-1 flex items-center justify-between gap-1 min-h-[20px]">
                      <span className="text-xs text-gray-500 truncate">En local</span>
                      <span className="text-xs font-bold text-emerald-800 bg-emerald-200/80 px-1.5 py-0.5 rounded shrink-0">
                        🏷️ Mejor precio
                      </span>
                    </div>
                  </button>

                  {/* Transferencia */}
                  <button
                    type="button"
                    id="quick-buy-pay-transfer-btn"
                    onClick={() => onSelectPaymentMethod('transfer')}
                    className={`h-full px-2.5 py-2 sm:px-3 sm:py-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[58px] md:min-h-[62px] ${
                      paymentMethod === 'transfer'
                        ? 'border-[#0058bb] bg-blue-50/70 ring-2 ring-[#0058bb]/20 shadow-xs'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="flex items-center gap-1.5 font-bold text-xs sm:text-xs md:text-sm text-gray-900 leading-tight min-w-0 overflow-hidden">
                        <CreditCard className={`w-4 h-4 shrink-0 ${paymentMethod === 'transfer' ? 'text-[#0058bb]' : 'text-gray-500'}`} />
                        <span className="whitespace-nowrap overflow-hidden [text-overflow:clip]">Transferencia</span>
                      </div>
                      {paymentMethod === 'transfer' && (
                        <CheckCircle2 className="w-4 h-4 text-[#0058bb] shrink-0" />
                      )}
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-1 min-h-[20px]">
                      <span className="text-xs text-gray-500 truncate">
                        Alias / CVU
                      </span>
                      <span className="text-xs font-semibold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded shrink-0">
                        Directo
                      </span>
                    </div>
                  </button>
                </div>
              ) : (
                /* Envío: Oculta efectivo y muestra solo Transferencia */
                <div className="grid grid-cols-2 gap-2">
                  <div className="h-full px-2.5 py-2 sm:px-3 sm:py-2 rounded-xl border border-[#0058bb] bg-blue-50/70 ring-2 ring-[#0058bb]/20 text-left flex flex-col justify-between min-h-[58px] md:min-h-[62px] shadow-xs">
                    <div className="flex items-start justify-between gap-1">
                      <div className="flex items-center gap-1.5 font-bold text-xs sm:text-xs md:text-sm text-gray-900 leading-tight min-w-0 overflow-hidden">
                        <CreditCard className="w-4 h-4 text-[#0058bb] shrink-0" />
                        <span className="whitespace-nowrap overflow-hidden [text-overflow:clip]">Transferencia</span>
                      </div>
                      <CheckCircle2 className="w-4 h-4 text-[#0058bb] shrink-0" />
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-1 min-h-[20px]">
                      <span className="text-xs text-gray-500 truncate">
                        Alias / CVU
                      </span>
                      <span className="text-xs font-semibold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded shrink-0">
                        Directo
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 2. Barra Anclada Unificada: Logo + Categorías + Buscador (Lupa) en un solo renglón */}
        <div className="sticky top-0 z-35 bg-white/95 backdrop-blur-md py-2.5 px-2.5 sm:px-4 -mx-1 sm:-mx-4 border-b border-gray-200 shadow-xs transition-all">
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
                      <span className="inline-flex items-center text-[10px] sm:text-[11px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-full leading-tight">
                        <span>Mayorista alcanzado ({catQtyInCart} unids.)</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-medium text-blue-900 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full leading-tight">
                        <Sparkles className="w-3 h-3 text-[#0058bb] shrink-0" />
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
                        className={`p-0 pr-1.5 sm:pr-2.5 md:p-3 transition-colors flex items-center justify-between gap-1.5 sm:gap-3 md:gap-4 h-20 sm:h-auto overflow-hidden ${
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
                              const variantImgs = getActiveVariantImages(item.product, item.selectedVariants);
                              const gallery = variantImgs.length > 0 ? variantImgs : (item.product.images?.length ? item.product.images : [item.image]);
                              const foundIdx = gallery.findIndex((img) => img === item.image);

                              setLightboxData({
                                images: gallery,
                                initialIndex: foundIdx >= 0 ? foundIdx : 0,
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
                                <span className="inline-flex items-center font-bold text-xs text-[#0058bb] bg-blue-50 border border-blue-200/70 px-1.5 sm:px-2 py-0.5 rounded-md leading-none truncate max-w-full">
                                  {item.variantText}
                                </span>
                              </div>
                            ) : null}
                          </div>
                        </div>

                        {/* Right: Price & Quantity Controller - Price placed above quantity selector on mobile */}
                        <div className="flex flex-col items-end justify-center gap-1 sm:flex-row sm:items-center sm:gap-4 md:gap-5 shrink-0 ml-auto pl-1">
                          {/* Clean Single Price Display */}
                          <div className="text-right w-full flex justify-end">
                            <span className="text-base sm:text-lg md:text-xl font-bold text-gray-900 font-['Montserrat'] whitespace-nowrap leading-none block text-right">
                              $ {activeUnitPrice.toLocaleString('es-AR')}
                            </span>
                          </div>

                          {/* Quantity Controller */}
                          <div className="flex items-center">
                            {isOutOfStock ? (
                              <span className="inline-flex items-center justify-center text-xs sm:text-sm font-semibold text-gray-400 bg-gray-100 border border-gray-200/80 rounded-xl w-[88px] sm:w-[108px] md:w-[120px] h-[39px] sm:h-[36px] md:h-[40px] shrink-0 select-none">
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
                                className="bg-[#0058bb] hover:bg-[#004bb0] text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-xs flex items-center justify-center gap-1 cursor-pointer active:scale-95 w-[88px] sm:w-[108px] md:w-[120px] h-[39px] sm:h-[36px] md:h-[40px] shrink-0"
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
                                  className="w-7 h-[35px] sm:w-8 sm:h-8 md:w-9 md:h-9 flex items-center justify-center text-[#0058bb] hover:bg-blue-50 transition-colors cursor-pointer active:bg-blue-100"
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
                                  className="w-7 sm:w-10 md:w-11 h-[35px] sm:h-8 md:h-9 text-center text-xs sm:text-sm font-bold text-gray-900 focus:outline-none bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />

                                <button
                                  type="button"
                                  id={`quick-inc-${item.itemId}`}
                                  disabled={item.stock > 0 && currentCartQty >= item.stock}
                                  onClick={() => onUpdateCartQuantity(item.itemId, 1)}
                                  className={`w-7 h-[35px] sm:w-8 sm:h-8 md:w-9 md:h-9 flex items-center justify-center text-[#0058bb] hover:bg-blue-50 transition-colors cursor-pointer active:bg-blue-100 ${
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
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200/90 shadow-[0_-8px_25px_rgba(0,0,0,0.08)] pl-1.5 sm:pl-2.5 pr-3 sm:pr-4 py-2.5 md:py-3 transition-transform">
        <div className="max-w-[1240px] mx-auto flex items-center justify-between gap-1.5 sm:gap-3">
          {/* Left: Summary Info */}
          <div className="flex items-center min-w-0 flex-1">
            {/* Total price and details */}
            <div className="min-w-0 flex-1 text-left">
              <div className="flex items-baseline gap-1 sm:gap-1.5 min-w-0 overflow-visible sm:overflow-hidden whitespace-nowrap justify-start text-left -ml-0.5 sm:-ml-1">
                <span className="text-xs text-gray-500 font-medium hidden sm:inline shrink-0">Total:</span>
                <span id="quick-buy-total-amount" className="text-lg md:text-2xl font-bold text-gray-900 font-['Montserrat'] tracking-tight shrink-0">
                  $ {cartCalculations.subtotal.toLocaleString('es-AR')}
                </span>
                <span className="text-xs text-gray-500 whitespace-nowrap shrink-0">
                  ({totalCartCount} unids.)
                </span>
              </div>

              {/* Delivery / Payment mini tag */}
              <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-gray-500 truncate justify-start text-left -ml-0.5 sm:-ml-1">
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
              onClick={() => onOpenCart({ deliveryOption, paymentMethod })}
              className="bg-white hover:bg-gray-100 text-gray-800 font-bold text-xs sm:text-sm px-3 sm:px-4 py-3 sm:py-2.5 min-h-[42px] sm:min-h-[38px] rounded-xl border border-gray-300 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
            >
              <ShoppingCart className="w-4 h-4 text-[#0058bb]" />
              <span>Carrito</span>
            </button>

            {isCustomLinkMode ? (
              <button
                type="button"
                id="quick-buy-whatsapp-checkout-btn"
                onClick={handleWhatsAppQuickBuy}
                disabled={totalCartCount === 0 || isSubmittingWhatsAppOrder}
                className={`font-bold text-xs sm:text-sm px-3.5 sm:px-5 py-3 sm:py-2.5 min-h-[42px] sm:min-h-[38px] rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer ${
                  totalCartCount > 0 && !isSubmittingWhatsAppOrder
                    ? 'bg-[#25D366] hover:bg-[#20bd5a] text-white active:scale-95 shadow-emerald-600/20'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                }`}
                title="Comprar por WhatsApp (Número de pedido correlativo)"
              >
                {isSubmittingWhatsAppOrder ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Registrando...</span>
                  </>
                ) : (
                  <>
                    <OfficialWhatsAppIcon className="w-5 h-5 text-white shrink-0" />
                    <span>Comprar</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                id="quick-buy-checkout-btn"
                onClick={onProceedToCheckout}
                disabled={totalCartCount === 0}
                className={`font-bold text-xs sm:text-sm px-3 sm:px-4 py-3 sm:py-2.5 min-h-[42px] sm:min-h-[38px] rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer ${
                  totalCartCount > 0
                    ? 'bg-[#0058bb] hover:bg-[#004bb0] text-white active:scale-95'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                }`}
              >
                <span>Comprar</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
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

      {/* Lightbox / Visor de Imagen a Pantalla Completa con Zoom y Deslizamiento */}
      <ProductImageLightbox
        isOpen={Boolean(lightboxData)}
        onClose={() => setLightboxData(null)}
        images={lightboxData?.images || []}
        initialIndex={lightboxData?.initialIndex || 0}
        title={lightboxData?.title}
        subtitle={lightboxData?.variantText}
      />

      {/* Modal de Error al Registrar Pedido (No abre WhatsApp si el guardado falla) */}
      {orderSaveError && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 text-center shadow-2xl space-y-4 animate-scale-up border border-red-100">
            <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto border border-red-100 shadow-xs">
              <AlertCircle className="w-9 h-9" />
            </div>

            <div>
              <span className="inline-block px-3 py-1 bg-red-100 text-red-800 text-xs font-bold rounded-full uppercase tracking-wider mb-2">
                Aviso del Sistema
              </span>
              <h3 className="text-xl font-black text-gray-900 font-['Montserrat']">
                No se pudo registrar el pedido
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 mt-2 leading-relaxed">
                {orderSaveError}
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setOrderSaveError(null)}
                className="w-full bg-gray-900 hover:bg-black text-white font-bold text-sm py-3 px-4 rounded-xl transition-all cursor-pointer shadow-xs"
              >
                Entendido, intentar nuevamente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Pedido Registrado por WhatsApp */}
      {whatsAppSuccessModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 text-center shadow-2xl space-y-4 animate-scale-up border border-emerald-100">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-[#25D366] flex items-center justify-center mx-auto border border-emerald-100 shadow-xs">
              <OfficialWhatsAppIcon className="w-10 h-10" />
            </div>

            <div>
              <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full uppercase tracking-wider mb-2">
                ¡Pedido Registrado con Éxito!
              </span>
              <h3 className="text-2xl font-black text-gray-900 font-['Montserrat']">
                Pedido #{whatsAppSuccessModal.orderNumber}
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">
                Tu pedido fue guardado en el sistema con el número correlativo asignado. Si WhatsApp no se abrió automáticamente, presiona el botón a continuación:
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-700 flex justify-between items-center font-medium border border-gray-200/80">
              <span>{whatsAppSuccessModal.itemsCount} productos seleccionados</span>
              <span className="font-bold text-sm text-gray-900 font-mono">
                $ {whatsAppSuccessModal.total.toLocaleString('es-AR')}
              </span>
            </div>

            <div className="space-y-2 pt-1">
              <a
                href={whatsAppSuccessModal.waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-sm py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer"
              >
                <OfficialWhatsAppIcon className="w-5 h-5 text-white" />
                <span>Abrir WhatsApp con mi Pedido</span>
              </a>

              <button
                type="button"
                onClick={() => setWhatsAppSuccessModal(null)}
                className="w-full py-2.5 text-xs text-gray-500 hover:text-gray-800 font-bold transition-colors cursor-pointer"
              >
                Cerrar y seguir explorando
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
