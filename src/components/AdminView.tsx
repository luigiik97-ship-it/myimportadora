import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Product, Order, SizeVariant, VariantType, ProductReview, Category, ProductTag } from '../types';
import {
  TAG_COLOR_PALETTE,
  getLocalProductTags,
  fetchProductTags,
  createProductTag,
  getProductTagById,
  toVividTagColor,
} from '../services/productTags';
import {
  normalizeVariantTypes,
  syncLegacyFields,
  getProductTotalStock,
  isProductCompletelyOutOfStock,
  getOptionStock,
  getResolvedProductPrices,
  getProductCoverImage,
} from '../utils/variantHelpers';
import { VariantManager } from './admin/VariantManager';
import { StandaloneVariantsManager } from './admin/StandaloneVariantsManager';
import { BulkPriceUpdate } from './admin/BulkPriceUpdate';
import { CategoryManager } from './admin/CategoryManager';
import { ClassicStar } from './common/ClassicStar';
import { ImageOptimizationBadge } from './admin/ImageOptimizationBadge';
import { ImageOptimizationAuditor } from './admin/ImageOptimizationAuditor';
import {
  fetchProducts,
  fetchCategories,
  getLocalCategories,
  createProduct,
  updateProduct,
  deleteProduct,
  uploadProductImage,
  uploadProductImages,
  deleteStorageImageIfUnused,
  fetchOrders,
  subscribeToOrders,
  subscribeToProductsAndSystemConfig,
  updateOrderStatus,
  updateOrder,
  deleteOrder,
  isSupabaseConfigured,
  SUPABASE_SQL_SETUP_SCHEMA,
  SUPABASE_MIGRATION_SQL,
  STORAGE_REPAIR_SQL,
  testSupabaseImagesPersistence,
  testSupabaseStorageUpload,
} from '../services/supabase';
import { AnalyticsDashboard } from './admin/AnalyticsDashboard';
import { BannerManager } from './admin/BannerManager';
import { VideoManager } from './admin/VideoManager';
import {
  optimizeCloudinaryVideoUrl,
  getCloudinaryVideoPosterUrl,
} from '../utils/cloudinaryVideoOptimizer';
import { isLaunchesSectionVisible, fetchLaunchesVisibilityFromSupabase, LAUNCHES_VISIBILITY_EVENT } from '../services/launches';
import { ShippingConfigManager } from './admin/ShippingConfigManager';
import { QuickBuyLinkManager, OfficialWhatsAppIcon } from './admin/QuickBuyLinkManager';
import { LaunchesManager } from './admin/LaunchesManager';
import { BestSellersManager } from './admin/BestSellersManager';
import { StoreSettingsManager } from './admin/StoreSettingsManager';
import { StockNotificationsManager } from './admin/StockNotificationsManager';
import { getStoreSettings, fetchStoreSettingsFromSupabase, StoreSettings } from '../services/storeSettings';
import { isQuickBuyOrder } from '../services/quickBuyLink';
import { fetchStockNotifications } from '../services/stockNotifications';
import {
  isAdminAuthenticated,
  authenticateAdmin,
  clearAdminSession,
  restoreSupabaseAdminSession,
  AUTHORIZED_ADMIN_EMAIL,
} from '../services/adminAuth';
import {
  Lock,
  Package,
  ShoppingBag,
  Settings,
  Flame,
  Plus,
  Edit2,
  Trash2,
  Image as ImageIcon,
  Upload,
  CheckCircle2,
  Clock,
  Truck,
  XCircle,
  ExternalLink,
  MessageSquare,
  Search,
  Copy,
  Check,
  RefreshCw,
  LogOut,
  ChevronRight,
  Database,
  Mail,
  AlertCircle,
  Star,
  Percent,
  EyeOff,
  ArrowLeft as ArrowLeftIcon,
  ArrowRight as ArrowRightIcon,
  Sparkles,
  Layers,
  Calendar,
  Filter,
  RotateCcw,
  Eye,
  BarChart3,
  ArrowUpRight,
  Video,
  Rocket,
  SlidersHorizontal,
  Bell,
  X,
  Loader2,
} from 'lucide-react';

export const resolveOrderItemPrices = (
  it: Order['items'][number],
  paymentMethod: 'transfer' | 'cash',
  productsList: Product[]
) => {
  const isCash = paymentMethod === 'cash';
  const matchedProduct = productsList.find(
    (p) => p.id === it.productId || (p.title && it.title && p.title.trim().toLowerCase() === it.title.trim().toLowerCase())
  );

  // Normal unit price (Transfer / List price)
  let normalUnitPrice = it.unitPrice || 0;
  if (matchedProduct) {
    const resolved = getResolvedProductPrices(matchedProduct, undefined, undefined);
    const baseNormal = it.isWholesale ? resolved.wholesalePrice : resolved.retailPrice;
    if (baseNormal > 0 && (!normalUnitPrice || normalUnitPrice === it.cashUnitPrice)) {
      normalUnitPrice = baseNormal;
    }
  }

  // Cash unit price (Efectivo mayorista o minorista)
  let cashUnitPrice = it.cashUnitPrice && it.cashUnitPrice > 0 ? it.cashUnitPrice : 0;
  if (!cashUnitPrice && matchedProduct) {
    const resolved = getResolvedProductPrices(matchedProduct, undefined, undefined);
    const baseCash = it.isWholesale
      ? (resolved.wholesaleCashPrice || resolved.cashPrice || resolved.wholesalePrice)
      : (resolved.retailCashPrice || resolved.cashPrice || resolved.retailPrice);
    if (baseCash > 0) {
      cashUnitPrice = baseCash;
    }
  }

  // Fallback if product not in catalog and no cashUnitPrice
  if (!cashUnitPrice) {
    if (it.totalCashPrice && it.quantity > 0) {
      cashUnitPrice = Math.round(it.totalCashPrice / it.quantity);
    } else {
      cashUnitPrice = normalUnitPrice;
    }
  }

  const effectiveUnitPrice = isCash ? (cashUnitPrice > 0 ? cashUnitPrice : normalUnitPrice) : normalUnitPrice;
  const effectiveTotalPrice = effectiveUnitPrice * it.quantity;

  const pricingLabel = isCash
    ? (it.isWholesale ? 'Efectivo Mayorista' : 'Efectivo Minorista')
    : (it.isWholesale ? 'Mayorista' : 'Minorista');

  return {
    normalUnitPrice,
    cashUnitPrice,
    effectiveUnitPrice,
    effectiveTotalPrice,
    pricingLabel,
    isCash,
  };
};

interface AdminViewProps {
  onExitAdmin: () => void;
  onSelectProduct?: (product: Product, selectedVariants?: Record<string, string>, image?: string) => void;
}

export const AdminView: React.FC<AdminViewProps> = ({ onExitAdmin, onSelectProduct }) => {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return isAdminAuthenticated();
  });
  const [adminUserInput, setAdminUserInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState<number>(0);
  const [lockoutRemaining, setLockoutRemaining] = useState<number>(0);

  // Restaurar automáticamente la sesión si existe sesión activa en Supabase Auth
  useEffect(() => {
    if (!isAuthenticated) {
      restoreSupabaseAdminSession().then((restored) => {
        if (restored) {
          setIsAuthenticated(true);
        }
      });
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (lockoutRemaining <= 0) return;
    const interval = setInterval(() => {
      setLockoutRemaining((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutRemaining]);

  // Tab state
  const [activeTab, setActiveTab] = useState<
    | 'products'
    | 'standalone_variants'
    | 'categories'
    | 'best_sellers'
    | 'banners'
    | 'videos'
    | 'orders'
    | 'bulk_price_update'
    | 'integrations'
    | 'analytics'
    | 'quick_buy_link'
    | 'shipping'
    | 'launches'
    | 'store_settings'
    | 'stock_notifications'
  >('products');
  const [updatingBestSellerId, setUpdatingBestSellerId] = useState<string | null>(null);

  // Avisos de stock pendientes y alerta de reposición
  const [pendingStockCount, setPendingStockCount] = useState<number>(0);
  const [initialFilterForStockNotifications, setInitialFilterForStockNotifications] = useState<string>('');
  const [restockAlert, setRestockAlert] = useState<{
    productTitle: string;
    variantName: string;
    count: number;
    productId: string;
  } | null>(null);

  const refreshPendingStockCount = useCallback(async () => {
    try {
      const list = await fetchStockNotifications();
      const count = list.filter((n) => n.status === 'pending').length;
      setPendingStockCount(count);
    } catch (e) {
      // Ignorar en caso de error de conexión
    }
  }, []);

  useEffect(() => {
    refreshPendingStockCount();
  }, [refreshPendingStockCount, activeTab]);

  // Visibilidad configurable de botones de tienda (Comprar ahora)
  const [storeSettings, setStoreSettings] = useState<StoreSettings>(() => getStoreSettings());

  useEffect(() => {
    fetchStoreSettingsFromSupabase()
      .then((s) => setStoreSettings(s))
      .catch(() => {});

    const handleSettingsUpdate = (e: CustomEvent<StoreSettings>) => {
      if (e.detail) {
        setStoreSettings(e.detail);
      }
    };
    window.addEventListener('my_commerce_store_settings_updated' as any, handleSettingsUpdate);
    return () => {
      window.removeEventListener('my_commerce_store_settings_updated' as any, handleSettingsUpdate);
    };
  }, []);

  // Visibilidad de la sección Próximos Lanzamientos
  const [isLaunchesVisible, setIsLaunchesVisible] = useState<boolean>(() => isLaunchesSectionVisible());

  useEffect(() => {
    fetchLaunchesVisibilityFromSupabase()
      .then((vis) => setIsLaunchesVisible(vis))
      .catch(() => {});

    const handleVis = () => {
      setIsLaunchesVisible(isLaunchesSectionVisible());
    };
    window.addEventListener(LAUNCHES_VISIBILITY_EVENT, handleVis);
    window.addEventListener('storage', handleVis);
    return () => {
      window.removeEventListener(LAUNCHES_VISIBILITY_EVENT, handleVis);
      window.removeEventListener('storage', handleVis);
    };
  }, []);

  // Data states
  const [products, setProducts] = useState<Product[]>([]);
  const [adminCategories, setAdminCategories] = useState<Category[]>(() => getLocalCategories());
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Orders Search & Filter states
  const [orderSearchTerm, setOrderSearchTerm] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | Order['status']>('all');
  const [orderDateFilter, setOrderDateFilter] = useState<'all' | 'today' | 'last_7_days' | 'this_month' | 'custom'>('all');
  const [orderCustomDate, setOrderCustomDate] = useState('');
  const [orderPaymentFilter, setOrderPaymentFilter] = useState<'all' | 'transfer' | 'cash'>('all');
  const [orderDeliveryFilter, setOrderDeliveryFilter] = useState<'all' | 'pickup' | 'delivery'>('all');
  const [orderOriginFilter, setOrderOriginFilter] = useState<'all' | 'quick_buy' | 'web'>('all');

  // Product edit/create modal
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isImageAuditorOpen, setIsImageAuditorOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);

  // Additional image & reviews states
  const [additionalImageInputUrl, setAdditionalImageInputUrl] = useState('');
  const [isUploadingAdditionalImage, setIsUploadingAdditionalImage] = useState(false);
  const [lastOptimizationSummary, setLastOptimizationSummary] = useState<string | null>(null);
  const [newReviewText, setNewReviewText] = useState('');
  const [newReviewAuthor, setNewReviewAuthor] = useState('');
  const [newReviewRating, setNewReviewRating] = useState(5);

  // Estados de Galería de Fotos de la Publicación (Foto 1 a Foto 6)
  const [galleryUrlInput, setGalleryUrlInput] = useState('');
  const [isUploadingGalleryImages, setIsUploadingGalleryImages] = useState(false);
  const [galleryUploadProgress, setGalleryUploadProgress] = useState<string | null>(null);
  const [storageWarningBanner, setStorageWarningBanner] = useState<string | null>(null);

  // Product tags states
  const [availableTags, setAvailableTags] = useState<ProductTag[]>(() => getLocalProductTags());
  const [isCreatingNewTag, setIsCreatingNewTag] = useState(false);
  const [newTagLabel, setNewTagLabel] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLOR_PALETTE[0].color);

  useEffect(() => {
    fetchProductTags().then((tags) => {
      if (tags && tags.length > 0) {
        setAvailableTags(tags);
      }
    });

    const handleTagsUpdated = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) {
        setAvailableTags(e.detail);
      }
    };
    window.addEventListener('product_tags_updated', handleTagsUpdated);
    return () => window.removeEventListener('product_tags_updated', handleTagsUpdated);
  }, []);

  useEffect(() => {
    const handleStorageWarn = (e: any) => {
      if (e.detail?.message) {
        setStorageWarningBanner(e.detail.message);
      }
    };
    window.addEventListener('supabase-storage-warning', handleStorageWarn);
    return () => window.removeEventListener('supabase-storage-warning', handleStorageWarn);
  }, []);

  const handleCreateAndAssignTag = async () => {
    if (!newTagLabel.trim()) return;
    const palette = TAG_COLOR_PALETTE.find((p) => p.color === newTagColor);
    const created = await createProductTag(
      newTagLabel.trim(),
      newTagColor,
      palette?.textColor || '#ffffff'
    );
    const updatedTags = getLocalProductTags();
    setAvailableTags(updatedTags);
    if (editingProduct) {
      setEditingProduct({
        ...editingProduct,
        tagId: created.id,
        tag: created,
      });
    }
    setNewTagLabel('');
    setIsCreatingNewTag(false);
  };

  // Selected order details modal
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // SQL schema copied notifications
  const [schemaCopied, setSchemaCopied] = useState(false);
  const [migrationCopied, setMigrationCopied] = useState(false);
  const [storageCopied, setStorageCopied] = useState(false);
  const [activeSqlTab, setActiveSqlTab] = useState<'migration' | 'full' | 'storage'>('migration');
  const [diagnosticResult, setDiagnosticResult] = useState<{
    connected: boolean;
    hasImagesColumn: boolean;
    hasNumberedColumns: boolean;
    imageCountDetected: number;
    message: string;
  } | null>(null);
  const [isTestingDiagnostic, setIsTestingDiagnostic] = useState(false);
  const [isTestingStorageUpload, setIsTestingStorageUpload] = useState(false);
  const [storageUploadResult, setStorageUploadResult] = useState<{
    success: boolean;
    message: string;
    url?: string;
  } | null>(null);

  // In-app deletion modals (reliable, replaces blocked window.confirm)
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeletingProduct, setIsDeletingProduct] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [isDeletingOrder, setIsDeletingOrder] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutRemaining > 0) return;

    try {
      const emailToUse = (adminUserInput || AUTHORIZED_ADMIN_EMAIL).trim();
      const result = await authenticateAdmin(emailToUse, passwordInput);
      if (result.success) {
        setIsAuthenticated(true);
        setAuthError(null);
        setPasswordInput('');
        setAdminUserInput('');
        setFailedAttempts(0);
      } else {
        const nextAttempts = failedAttempts + 1;
        setFailedAttempts(nextAttempts);
        if (nextAttempts >= 5) {
          setLockoutRemaining(30);
          setAuthError('Demasiados intentos fallidos por seguridad. Bloqueado temporalmente por 30 segundos.');
        } else {
          setAuthError(`${result.error || 'Contraseña de administrador incorrecta.'} (Intento ${nextAttempts} de 5)`);
        }
      }
    } catch (err: any) {
      console.error('Error durante autenticación admin en handleLogin:', err);
      setAuthError('Error al verificar credenciales.');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    clearAdminSession();
    setAdminUserInput('');
  };

  // Load data on mount / auth
  const loadData = async () => {
    setLoading(true);
    try {
      const [prods, ords, cats] = await Promise.all([
        fetchProducts(),
        fetchOrders(),
        fetchCategories({ force: true }),
      ]);
      setProducts(prods);
      setOrders(ords);
      if (cats && cats.length > 0) {
        setAdminCategories(cats);
      }
    } catch (e) {
      console.error('Error cargando datos del admin:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;

    loadData();

    // Suscripción en tiempo real a la tabla 'orders' de Supabase (cross-device instantáneo)
    const unsubscribeOrders = subscribeToOrders((latestOrders) => {
      setOrders(latestOrders);
    });

    // Suscripción en tiempo real a la tabla 'products' de Supabase (productos, categorías y configuraciones)
    const unsubscribeProductsAndConfig = subscribeToProductsAndSystemConfig({
      onProductsChanged: (newProds) => {
        setProducts(newProds);
      },
      onCategoriesChanged: (newCats) => {
        if (newCats && newCats.length > 0) {
          setAdminCategories(newCats);
        }
      },
    });

    // Control inteligente de recarga en foco: evita ráfagas innecesarias (mínimo 90s entre chequeos pasivos)
    let lastFocusFetchTime = Date.now();

    const handleWindowFocus = () => {
      if (isAuthenticated) {
        const now = Date.now();
        if (now - lastFocusFetchTime > 90000) {
          lastFocusFetchTime = now;
          fetchOrders().then((ords) => setOrders(ords));
          fetchProducts({ force: true }).then((prods) => setProducts(prods));
          fetchCategories({ force: true }).then((cats) => {
            if (cats && cats.length > 0) setAdminCategories(cats);
          });
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleWindowFocus();
      }
    };

    const handleOrdersUpdated = (event?: any) => {
      // Optimistic update if order is included in the event detail
      const incomingOrder = (event?.detail?.order || event?.detail) as Order | undefined;
      if (incomingOrder && (incomingOrder.id || incomingOrder.orderNumber)) {
        setOrders((prev) => {
          const exists = prev.some((o) => o.id === incomingOrder.id || o.orderNumber === incomingOrder.orderNumber);
          if (exists) {
            return prev.map((o) => (o.id === incomingOrder.id ? incomingOrder : o));
          }
          return [incomingOrder, ...prev];
        });
      }

      fetchOrders().then((ords) => {
        setOrders(ords);
      });
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'my_commerce_orders') {
        fetchOrders().then((ords) => {
          setOrders(ords);
        });
      }
    };

    const handleProductsUpdated = () => {
      fetchProducts().then((prods) => {
        setProducts(prods);
      });
      fetchCategories().then((cats) => {
        if (cats && cats.length > 0) {
          setAdminCategories(cats);
        }
      });
    };

    const handleCategoriesUpdated = (event?: any) => {
      if (event?.detail && Array.isArray(event.detail) && event.detail.length > 0) {
        setAdminCategories(event.detail);
      }
      fetchCategories({ force: true }).then((cats) => {
        if (cats && cats.length > 0) {
          setAdminCategories(cats);
        }
      });
    };

    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('my_commerce_orders_updated', handleOrdersUpdated);
    window.addEventListener('products-updated', handleProductsUpdated);
    window.addEventListener('categories-updated', handleCategoriesUpdated);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      unsubscribeOrders();
      unsubscribeProductsAndConfig();
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('my_commerce_orders_updated', handleOrdersUpdated);
      window.removeEventListener('products-updated', handleProductsUpdated);
      window.removeEventListener('categories-updated', handleCategoriesUpdated);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (actionFeedback) {
      const timer = setTimeout(() => {
        setActionFeedback(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [actionFeedback]);

  // Filtered and Sorted Orders (single source of truth, most recent first)
  const filteredOrders = useMemo(() => {
    return orders
      .filter((order) => {
        // 1. Search Query: Matches #orderNumber, customer name, email, whatsapp, shipping or product title/variant
        if (orderSearchTerm.trim()) {
          const query = orderSearchTerm.trim().toLowerCase();
          const matchesNumber = order.orderNumber?.toLowerCase().includes(query);
          const matchesName = order.customerName?.toLowerCase().includes(query);
          const matchesEmail = order.customerEmail?.toLowerCase().includes(query);
          const matchesWhatsapp = order.customerWhatsapp?.toLowerCase().includes(query);
          const matchesShipping =
            order.shippingMethodName?.toLowerCase().includes(query) ||
            order.deliveryAddress?.correoBranch?.toLowerCase().includes(query) ||
            order.correoBranch?.toLowerCase().includes(query);
          const matchesOrigin =
            (query.includes('rapida') || query.includes('rápida') || query.includes('whatsapp')) &&
            isQuickBuyOrder(order);
          const matchesProducts = order.items?.some(
            (item) =>
              item.title?.toLowerCase().includes(query) ||
              item.variantText?.toLowerCase().includes(query)
          );
          if (!matchesNumber && !matchesName && !matchesEmail && !matchesWhatsapp && !matchesShipping && !matchesOrigin && !matchesProducts) {
            return false;
          }
        }

        // 2. Status Filter
        if (orderStatusFilter !== 'all' && order.status !== orderStatusFilter) {
          return false;
        }

        // 3. Date Filter
        if (orderDateFilter !== 'all') {
          const orderDate = new Date(order.createdAt);
          const now = new Date();

          if (orderDateFilter === 'today') {
            const isToday =
              orderDate.getDate() === now.getDate() &&
              orderDate.getMonth() === now.getMonth() &&
              orderDate.getFullYear() === now.getFullYear();
            if (!isToday) return false;
          } else if (orderDateFilter === 'last_7_days') {
            const diffTime = Math.abs(now.getTime() - orderDate.getTime());
            const diffDays = diffTime / (1000 * 60 * 60 * 24);
            if (diffDays > 7) return false;
          } else if (orderDateFilter === 'this_month') {
            const isThisMonth =
              orderDate.getMonth() === now.getMonth() &&
              orderDate.getFullYear() === now.getFullYear();
            if (!isThisMonth) return false;
          } else if (orderDateFilter === 'custom' && orderCustomDate) {
            const orderDateStr = orderDate.toISOString().split('T')[0];
            if (orderDateStr !== orderCustomDate) return false;
          }
        }

        // 4. Payment Method Filter
        if (orderPaymentFilter !== 'all' && order.paymentMethod !== orderPaymentFilter) {
          return false;
        }

        // 5. Delivery Option Filter
        if (orderDeliveryFilter !== 'all' && order.deliveryOption !== orderDeliveryFilter) {
          return false;
        }

        // 6. Origin Filter (Compra Rápida WhatsApp vs Web)
        if (orderOriginFilter !== 'all') {
          const isQB = isQuickBuyOrder(order);
          if (orderOriginFilter === 'quick_buy' && !isQB) return false;
          if (orderOriginFilter === 'web' && isQB) return false;
        }

        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [
    orders,
    orderSearchTerm,
    orderStatusFilter,
    orderDateFilter,
    orderCustomDate,
    orderPaymentFilter,
    orderDeliveryFilter,
    orderOriginFilter,
  ]);

  const hasActiveOrderFilters = Boolean(
    orderSearchTerm.trim() ||
    orderStatusFilter !== 'all' ||
    orderDateFilter !== 'all' ||
    orderPaymentFilter !== 'all' ||
    orderDeliveryFilter !== 'all' ||
    orderOriginFilter !== 'all'
  );

  const handleResetOrderFilters = () => {
    setOrderSearchTerm('');
    setOrderStatusFilter('all');
    setOrderDateFilter('all');
    setOrderCustomDate('');
    setOrderPaymentFilter('all');
    setOrderDeliveryFilter('all');
    setOrderOriginFilter('all');
  };

  const quickBuyOrdersCount = useMemo(() => {
    return orders.filter(isQuickBuyOrder).length;
  }, [orders]);

  // Categories loaded from Supabase for the selector dropdown
  const categoryOptions = useMemo(() => {
    const list: string[] = [];
    const seen = new Set<string>();

    // 1. Existing categories from Supabase (adminCategories)
    adminCategories.forEach((c) => {
      const name = (c.name || '').trim();
      if (name && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        list.push(name);
      }
    });

    // 2. If editing a product whose current category is not in list, preserve it
    if (editingProduct?.category) {
      const currentCat = editingProduct.category.trim();
      if (currentCat && !seen.has(currentCat.toLowerCase())) {
        seen.add(currentCat.toLowerCase());
        list.push(currentCat);
      }
    }

    return list;
  }, [adminCategories, editingProduct?.category]);

  // Product CRUD
  const handleOpenCreateProduct = async () => {
    let availableCategories = adminCategories;
    try {
      const freshCats = await fetchCategories();
      if (freshCats && freshCats.length > 0) {
        availableCategories = freshCats;
        setAdminCategories(freshCats);
      }
    } catch (e) {
      console.warn('Error syncing categories before creating product:', e);
    }

    const initialVariantTypes: VariantType[] = [
      {
        id: `vt-color-${Date.now()}`,
        name: 'Color / Modelo',
        options: [
          { id: `opt-c1-${Date.now()}`, name: 'Opción 1', images: [] },
          { id: `opt-c2-${Date.now()}`, name: 'Opción 2', images: [] },
        ],
      },
    ];

    setEditingProduct({
      title: '',
      description: '',
      category: availableCategories[0]?.name || 'Otros',
      subcategory: '',
      images: [],
      additionalImage: '',
      rating: 5.0,
      reviewsCount: 0,
      reviews: [],
      minWholesaleQty: 3,
      wholesalePrice: 1000,
      retailPrice: 1500,
      cashPrice: undefined,
      retailCashPrice: undefined,
      wholesaleCashPrice: undefined,
      colors: ['Opción 1', 'Opción 2'],
      sizeVariants: [],
      variantTypes: initialVariantTypes,
      stock: 50,
      soldCount: 0,
      isBestSeller: false,
      videoUrl: '',
    });
    setGalleryUrlInput('');
    setIsUploadingGalleryImages(false);
    setGalleryUploadProgress(null);
    setStorageWarningBanner(null);
    setAdditionalImageInputUrl('');
    setNewReviewText('');
    setNewReviewAuthor('');
    setNewReviewRating(5);
    setIsProductModalOpen(true);
  };

  const handleOpenEditProduct = (prod: Product) => {
    const cloned = JSON.parse(JSON.stringify(prod));
    cloned.variantTypes = normalizeVariantTypes(cloned);
    if (cloned.rating === undefined || cloned.rating === null) cloned.rating = 5.0;
    cloned.reviews = Array.isArray(cloned.reviews) ? cloned.reviews : [];
    if (cloned.reviewsCount === undefined || cloned.reviewsCount === null) {
      cloned.reviewsCount = cloned.reviews.length;
    }
    console.log(`\n================== [CASH & VARIANT DEBUG - POST-LOAD (Admin Edit Open)] ==================`);
    console.log(`[Admin Edit Open] Abriendo edición para producto "${cloned.title}" (ID: ${cloned.id})`);
    console.log(`[Admin Edit Open] Precios en efectivo cargados: Min: ${cloned.retailCashPrice !== undefined ? `$${cloned.retailCashPrice}` : 'N/A'} | May: ${cloned.wholesaleCashPrice !== undefined ? `$${cloned.wholesaleCashPrice}` : 'N/A'}`);
    console.log(`[Admin Edit Open] Variantes cargadas en el modal:`, JSON.stringify(cloned.variantTypes, null, 2));
    cloned.videoUrl = cloned.videoUrl || '';
    setEditingProduct(cloned);
    setGalleryUrlInput('');
    setIsUploadingGalleryImages(false);
    setGalleryUploadProgress(null);
    setStorageWarningBanner(null);
    setAdditionalImageInputUrl(cloned.additionalImage || '');
    setNewReviewText('');
    setNewReviewAuthor('');
    setNewReviewRating(5);
    setIsProductModalOpen(true);
  };

  const handleVariantTypesChange = (newVariantTypes: VariantType[]) => {
    if (!editingProduct) return;
    const { colors, sizeVariants } = syncLegacyFields(
      newVariantTypes,
      editingProduct.wholesalePrice || 0,
      editingProduct.retailPrice || 0,
      editingProduct.cashPrice,
      editingProduct.retailCashPrice,
      editingProduct.wholesaleCashPrice
    );
    console.log(`[VARIANT DEBUG - EDIT] Variantes actualizadas en el estado local del producto:`, newVariantTypes);

    // Portada única obtenida de la primera variante con foto (o primera foto de la publicación)
    const coverImage = getProductCoverImage({
      ...editingProduct,
      variantTypes: newVariantTypes,
    });

    // Preservar la galería de imágenes completa sin truncarla a una sola foto
    const existingImages = Array.isArray(editingProduct.images) ? editingProduct.images : [];
    const resolvedImages = existingImages.length > 0
      ? existingImages
      : (coverImage ? [coverImage] : []);

    setEditingProduct({
      ...editingProduct,
      variantTypes: newVariantTypes,
      colors,
      sizeVariants,
      images: resolvedImages,
      image: resolvedImages[0] || coverImage || '',
    });
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || !editingProduct.title) {
      console.warn('[AdminView handleSaveProduct] Formulario inválido o sin título.');
      return;
    }

    if (isUploadingAdditionalImage) {
      alert('El banner inferior se está subiendo y optimizando. Por favor espera unos segundos antes de guardar la publicación.');
      return;
    }

    const currentVariantTypes = editingProduct.variantTypes || normalizeVariantTypes(editingProduct as Product);
    const targetCashPrice = editingProduct.cashPrice !== undefined && editingProduct.cashPrice !== null && !isNaN(Number(editingProduct.cashPrice))
      ? Number(editingProduct.cashPrice)
      : undefined;

    const targetRetailCashPrice = editingProduct.retailCashPrice !== undefined && editingProduct.retailCashPrice !== null && !isNaN(Number(editingProduct.retailCashPrice))
      ? Number(editingProduct.retailCashPrice)
      : targetCashPrice;

    const targetWholesaleCashPrice = editingProduct.wholesaleCashPrice !== undefined && editingProduct.wholesaleCashPrice !== null && !isNaN(Number(editingProduct.wholesaleCashPrice))
      ? Number(editingProduct.wholesaleCashPrice)
      : targetCashPrice;

    const { colors, sizeVariants } = syncLegacyFields(
      currentVariantTypes,
      editingProduct.wholesalePrice || 0,
      editingProduct.retailPrice || 0,
      targetCashPrice,
      targetRetailCashPrice,
      targetWholesaleCashPrice
    );

    // Consolidación de imágenes de la publicación (hasta 6 imágenes para image_1 a image_6 y JSONB)
    // 1. Imágenes explícitas de la galería del producto
    const explicitGalleryImages = (editingProduct.images || []).filter(
      (img) => typeof img === 'string' && img.trim().length > 0
    );

    // 2. Extraer imágenes asignadas a opciones de variantes para no perder ninguna foto seleccionada
    const variantOptionImages: string[] = [];
    currentVariantTypes.forEach((vt) => {
      (vt.options || []).forEach((opt) => {
        (opt.images || []).forEach((img) => {
          if (img && typeof img === 'string' && img.trim().length > 0 && !variantOptionImages.includes(img.trim())) {
            variantOptionImages.push(img.trim());
          }
        });
      });
    });

    // 3. Unir fotos sin duplicados
    let combinedImages = [...explicitGalleryImages];
    variantOptionImages.forEach((vImg) => {
      if (!combinedImages.includes(vImg)) {
        combinedImages.push(vImg);
      }
    });

    // 4. Determinar portada principal de la publicación (Foto 1)
    const coverImage = getProductCoverImage({
      ...editingProduct,
      images: combinedImages,
      variantTypes: currentVariantTypes,
    });

    if (coverImage) {
      if (combinedImages.includes(coverImage)) {
        combinedImages = [coverImage, ...combinedImages.filter((img) => img !== coverImage)];
      } else if (combinedImages.length === 0) {
        combinedImages = [coverImage];
      }
    }

    const finalImages = combinedImages.slice(0, 6);

    const rawAdditionalImg = (editingProduct.additionalImage && editingProduct.additionalImage.trim()) || (additionalImageInputUrl && additionalImageInputUrl.trim()) || '';
    const effectiveAdditionalImage = rawAdditionalImg.startsWith('blob:')
      ? (additionalImageInputUrl && !additionalImageInputUrl.startsWith('blob:') ? additionalImageInputUrl : '')
      : rawAdditionalImg;

    const productPayload: Partial<Product> = {
      ...editingProduct,
      additionalImage: effectiveAdditionalImage,
      images: finalImages,
      image: finalImages[0] || coverImage || null,
      cashPrice: targetCashPrice ?? targetRetailCashPrice,
      retailCashPrice: targetRetailCashPrice,
      wholesaleCashPrice: targetWholesaleCashPrice,
      variantTypes: currentVariantTypes,
      colors,
      sizeVariants,
    };

    console.log(`\n================== [CASH & VARIANT DEBUG - PRE-SAVE (AdminView)] ==================`);
    console.log(`[AdminView handleSaveProduct] Guardando producto: "${productPayload.title}" (ID: ${productPayload.id || 'NUEVO'})`);
    console.log(`[AdminView handleSaveProduct] Precios en efectivo antes de guardar: Min: ${targetRetailCashPrice !== undefined ? `$${targetRetailCashPrice}` : 'N/A'} | May: ${targetWholesaleCashPrice !== undefined ? `$${targetWholesaleCashPrice}` : 'N/A'}`);
    console.log(`[AdminView handleSaveProduct] Payload enviado:`, JSON.stringify(productPayload, null, 2));
    console.log(`[AdminView handleSaveProduct] Imágenes base del producto (${productPayload.images?.length || 0}):`, productPayload.images);
    console.log(`[AdminView handleSaveProduct] Objeto completo de variantes antes de guardar:`, JSON.stringify(currentVariantTypes, null, 2));

    try {
      if (productPayload.id) {
        // Detectar si alguna variante pasa de SIN STOCK -> CON STOCK
        const oldProduct = products.find((p) => p.id === productPayload.id);
        const restockedVariantNames: string[] = [];

        if (oldProduct) {
          const oldVariantTypes = oldProduct.variantTypes || normalizeVariantTypes(oldProduct);
          const newVariantTypes = currentVariantTypes;

          newVariantTypes.forEach((newVt) => {
            const oldVt = oldVariantTypes.find((ov) => ov.id === newVt.id || ov.name === newVt.name);
            newVt.options.forEach((newOpt) => {
              const oldOpt = oldVt?.options.find((oo) => oo.id === newOpt.id || oo.name === newOpt.name);
              const oldStock = oldOpt?.stock ?? oldProduct.stock ?? 0;
              const newStock = newOpt.stock ?? productPayload.stock ?? 0;
              if (oldStock <= 0 && newStock > 0) {
                restockedVariantNames.push(newOpt.name);
              }
            });
          });

          // Caso de producto único sin variantes
          if (newVariantTypes.length === 0 && (oldProduct.stock ?? 0) <= 0 && (productPayload.stock ?? 0) > 0) {
            restockedVariantNames.push('Estándar');
          }
        }

        // Update
        console.log('[AdminView handleSaveProduct] Ejecutando UPDATE para ID:', productPayload.id);
        const updated = await updateProduct(productPayload.id, productPayload);
        console.log('[AdminView handleSaveProduct] Producto actualizado retornado:', updated);
        setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));

        // Si alguna variante recuperó stock, comprobar si hay personas esperando ESA variante
        if (restockedVariantNames.length > 0) {
          try {
            const allNotifs = await fetchStockNotifications();
            for (const vName of restockedVariantNames) {
              const waiting = allNotifs.filter(
                (n) =>
                  n.productId === productPayload.id &&
                  n.status === 'pending' &&
                  (n.variantName.toLowerCase().trim() === vName.toLowerCase().trim() || vName === 'Estándar')
              );
              if (waiting.length > 0) {
                setRestockAlert({
                  productTitle: productPayload.title || 'Producto',
                  variantName: vName,
                  count: waiting.length,
                  productId: productPayload.id,
                });
                break;
              }
            }
          } catch (notifErr) {
            console.warn('Error comprobando avisos de stock al reponer:', notifErr);
          }
        }
      } else {
        // Create
        console.log('[AdminView handleSaveProduct] Ejecutando CREATE');
        const created = await createProduct(productPayload as any);
        console.log('[AdminView handleSaveProduct] Producto creado retornado:', created);
        setProducts((prev) => [created, ...prev]);
      }
      refreshPendingStockCount();
      setIsProductModalOpen(false);
      setEditingProduct(null);
    } catch (err: any) {
      console.error('[AdminView handleSaveProduct] Error capturado:', err);
      alert('Error al guardar el producto: ' + err.message);
    }
  };

  const handleOpenDeleteProductModal = (prod: Product) => {
    setProductToDelete(prod);
  };

  const confirmDeleteProduct = async () => {
    if (!productToDelete) return;
    setIsDeletingProduct(true);
    try {
      const id = productToDelete.id;
      await deleteProduct(id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
      setActionFeedback({
        type: 'success',
        text: `Publicación "${productToDelete.title}" eliminada correctamente del catálogo y base de datos.`,
      });
      setProductToDelete(null);
    } catch (err: any) {
      console.error('[AdminView handleDeleteProduct] Error:', err);
      setActionFeedback({
        type: 'error',
        text: `Error al eliminar publicación: ${err.message || 'Error desconocido'}`,
      });
    } finally {
      setIsDeletingProduct(false);
    }
  };

  const handleToggleBestSeller = async (prod: Product) => {
    const newStatus = !prod.isBestSeller;
    setUpdatingBestSellerId(prod.id);

    // Actualización optimista inmediata
    setProducts((prev) =>
      prev.map((p) => (p.id === prod.id ? { ...p, isBestSeller: newStatus } : p))
    );

    try {
      const updated = await updateProduct(prod.id, { isBestSeller: newStatus });
      setProducts((prev) =>
        prev.map((p) => (p.id === updated.id ? updated : p))
      );
      setActionFeedback({
        type: 'success',
        text: newStatus
          ? `«${prod.title}» fue agregado a Más Vendidos.`
          : `«${prod.title}» fue quitado de Más Vendidos.`,
      });
    } catch (err: any) {
      console.error('Error al actualizar Más Vendidos:', err);
      // Revertir optimismo
      setProducts((prev) =>
        prev.map((p) => (p.id === prod.id ? { ...p, isBestSeller: !newStatus } : p))
      );
      setActionFeedback({
        type: 'error',
        text: 'Error al actualizar el producto en Más Vendidos.',
      });
    } finally {
      setUpdatingBestSellerId(null);
    }
  };

  // Additional Image handling (Banner inferior de la publicación)
  const handleUploadAdditionalImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingProduct) return;

    // Vista previa instantánea inmediata con Object URL
    const objectUrl = URL.createObjectURL(file);
    setEditingProduct((prev) => (prev ? { ...prev, additionalImage: objectUrl } : prev));
    setAdditionalImageInputUrl(objectUrl);
    setIsUploadingAdditionalImage(true);

    try {
      let optResult: any = null;
      const uploadedUrl = await uploadProductImage(file, {
        isCover: true,
        maxDimension: 1600,
        targetMinKB: 200,
        targetMaxKB: 350,
        onOptimized: (res) => {
          optResult = res;
        },
      });
      if (uploadedUrl) {
        setEditingProduct((prev) => (prev ? { ...prev, additionalImage: uploadedUrl } : prev));
        setAdditionalImageInputUrl(uploadedUrl);
        if (optResult) {
          setLastOptimizationSummary(
            `✓ Optimizada: ${optResult.width}×${optResult.height}px ${optResult.format.toUpperCase()} • ${optResult.optimizedSizeKB.toFixed(0)} KB (-${optResult.savedPercent.toFixed(0)}% de ${optResult.originalSizeKB >= 1024 ? `${(optResult.originalSizeKB / 1024).toFixed(1)} MB` : `${optResult.originalSizeKB.toFixed(0)} KB`})`
          );
        } else {
          setLastOptimizationSummary('✓ Imagen adicional optimizada automáticamente en formato WebP.');
        }
      }
    } catch (err: any) {
      alert('Error subiendo imagen adicional: ' + err.message);
    } finally {
      setIsUploadingAdditionalImage(false);
      e.target.value = '';
    }
  };

  const handleAddAdditionalImageUrl = () => {
    if (!editingProduct || !additionalImageInputUrl.trim()) return;
    setEditingProduct((prev) =>
      prev ? { ...prev, additionalImage: additionalImageInputUrl.trim() } : prev
    );
  };

  const handleRemoveAdditionalImage = () => {
    if (!editingProduct) return;
    setEditingProduct((prev) =>
      prev ? { ...prev, additionalImage: '' } : prev
    );
    setAdditionalImageInputUrl('');
  };

  // Manejadores de Galería de Fotos de la Publicación (Foto 1 a Foto 6)
  const handleUploadGalleryImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !editingProduct) return;

    const filesArray: File[] = Array.from(files);
    const currentImages = Array.isArray(editingProduct.images) ? [...editingProduct.images] : [];
    const availableSlots = 6 - currentImages.length;

    if (availableSlots <= 0) {
      alert('Ya has alcanzado el límite máximo de 6 fotos por publicación.');
      e.target.value = '';
      return;
    }

    const filesToUpload: File[] = filesArray.slice(0, availableSlots);
    setIsUploadingGalleryImages(true);
    setGalleryUploadProgress(`Subiendo y optimizando ${filesToUpload.length} foto(s)...`);

    try {
      let optInfo: any = null;
      const uploadedUrls = await uploadProductImages(
        filesToUpload,
        (current, total, stats) => {
          if (stats) optInfo = stats;
          setGalleryUploadProgress(`Optimizando y subiendo: ${current} de ${total}...`);
        },
        {
          isFirstImageCover: currentImages.length === 0,
        }
      );

      if (uploadedUrls.length > 0) {
        const nextImages = [...currentImages, ...uploadedUrls].slice(0, 6);
        setEditingProduct({
          ...editingProduct,
          images: nextImages,
          image: nextImages[0] || editingProduct.image,
        });
        if (optInfo) {
          setLastOptimizationSummary(
            `✓ ${uploadedUrls.length} foto(s) optimizada(s) y agregada(s) con éxito (Total: ${nextImages.length}/6)`
          );
        } else {
          setLastOptimizationSummary(
            `✓ ${uploadedUrls.length} foto(s) agregada(s) a la publicación (Total: ${nextImages.length}/6)`
          );
        }
        setTimeout(() => setLastOptimizationSummary(null), 5000);
      }
    } catch (err: any) {
      console.error('[AdminView] Error subiendo fotos de galería:', err);
      alert('Error al subir fotos de la publicación: ' + (err?.message || err));
    } finally {
      setIsUploadingGalleryImages(false);
      setGalleryUploadProgress(null);
      e.target.value = '';
    }
  };

  const handleAddGalleryUrl = () => {
    if (!editingProduct || !galleryUrlInput.trim()) return;
    const url = galleryUrlInput.trim();
    const currentImages = Array.isArray(editingProduct.images) ? [...editingProduct.images] : [];

    if (currentImages.length >= 6) {
      alert('Ya has alcanzado el máximo de 6 fotos permitidas para esta publicación.');
      return;
    }

    if (currentImages.includes(url)) {
      alert('Esta URL de imagen ya se encuentra en la galería.');
      return;
    }

    const nextImages = [...currentImages, url].slice(0, 6);
    setEditingProduct({
      ...editingProduct,
      images: nextImages,
      image: nextImages[0] || editingProduct.image,
    });
    setGalleryUrlInput('');
  };

  const handleRemoveGalleryImage = (index: number) => {
    if (!editingProduct || !Array.isArray(editingProduct.images)) return;
    const nextImages = editingProduct.images.filter((_, i) => i !== index);
    setEditingProduct({
      ...editingProduct,
      images: nextImages,
      image: nextImages[0] || null,
    });
  };

  const handleSetGalleryCover = (index: number) => {
    if (!editingProduct || !Array.isArray(editingProduct.images) || index <= 0) return;
    const images = [...editingProduct.images];
    const [selected] = images.splice(index, 1);
    images.unshift(selected);
    setEditingProduct({
      ...editingProduct,
      images,
      image: images[0],
    });
  };

  const handleSyncVariantImagesToGallery = () => {
    if (!editingProduct) return;
    const currentImages = Array.isArray(editingProduct.images) ? [...editingProduct.images] : [];
    const variantTypes = editingProduct.variantTypes || [];
    const collected: string[] = [];

    variantTypes.forEach((vt) => {
      (vt.options || []).forEach((opt) => {
        (opt.images || []).forEach((img) => {
          if (img && typeof img === 'string' && img.trim().length > 0) {
            if (!currentImages.includes(img.trim()) && !collected.includes(img.trim())) {
              collected.push(img.trim());
            }
          }
        });
      });
    });

    if (collected.length === 0) {
      alert('No se encontraron fotos nuevas en las variantes para importar.');
      return;
    }

    const nextImages = [...currentImages, ...collected].slice(0, 6);
    const addedCount = nextImages.length - currentImages.length;
    setEditingProduct({
      ...editingProduct,
      images: nextImages,
      image: nextImages[0] || editingProduct.image,
    });
    alert(`Se sincronizaron ${addedCount} foto(s) de las variantes a la publicación (Total: ${nextImages.length}/6).`);
  };

  // Reviews & Rating handling
  const handleAddReview = () => {
    if (!editingProduct || !newReviewText.trim()) return;
    const currentReviews = editingProduct.reviews || [];
    const newRev: ProductReview = {
      id: `rev-${Date.now()}`,
      rating: newReviewRating,
      author: newReviewAuthor.trim() || 'Comprador verificado',
      text: newReviewText.trim(),
    };
    const updatedReviews = [...currentReviews, newRev];
    setEditingProduct({
      ...editingProduct,
      reviews: updatedReviews,
      reviewsCount: Math.max(editingProduct.reviewsCount || 0, updatedReviews.length),
    });
    setNewReviewText('');
    setNewReviewAuthor('');
    setNewReviewRating(5);
  };

  const handleRemoveReview = (index: number) => {
    if (!editingProduct || !editingProduct.reviews) return;
    const updatedReviews = editingProduct.reviews.filter((_, i) => i !== index);
    setEditingProduct({
      ...editingProduct,
      reviews: updatedReviews,
      reviewsCount: updatedReviews.length,
    });
  };

  const handleUpdateReview = (index: number, field: keyof ProductReview, value: any) => {
    if (!editingProduct || !editingProduct.reviews) return;
    const updatedReviews = [...editingProduct.reviews];
    updatedReviews[index] = { ...updatedReviews[index], [field]: value };
    setEditingProduct({
      ...editingProduct,
      reviews: updatedReviews,
    });
  };

  // Size Variants handling in product modal
  const handleAddSizeVariant = () => {
    if (editingProduct) {
      const currentVariants = editingProduct.sizeVariants || [];
      const newVariant: SizeVariant = {
        id: `size-${Date.now()}`,
        name: 'Nuevo Tamaño',
        wholesalePrice: editingProduct.wholesalePrice || 1000,
        retailPrice: editingProduct.retailPrice || 1500,
      };
      setEditingProduct({
        ...editingProduct,
        sizeVariants: [...currentVariants, newVariant],
      });
    }
  };

  const handleUpdateSizeVariant = (index: number, field: keyof SizeVariant, value: any) => {
    if (editingProduct && editingProduct.sizeVariants) {
      const updated = [...editingProduct.sizeVariants];
      updated[index] = { ...updated[index], [field]: value };
      setEditingProduct({ ...editingProduct, sizeVariants: updated });
    }
  };

  const handleRemoveSizeVariant = (index: number) => {
    if (editingProduct && editingProduct.sizeVariants) {
      const updated = editingProduct.sizeVariants.filter((_, i) => i !== index);
      setEditingProduct({ ...editingProduct, sizeVariants: updated });
    }
  };

  // Status badge helper
  const getStatusBadge = (status: Order['status']) => {
    switch (status) {
      case 'pending_payment':
        return (
          <span className="bg-amber-100 text-amber-800 text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 w-max">
            <Clock className="w-3 h-3" /> Pendiente Pago
          </span>
        );
      case 'preparing':
        return (
          <span className="bg-blue-100 text-blue-800 text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 w-max">
            <Package className="w-3 h-3" /> En Preparación
          </span>
        );
      case 'shipped':
        return (
          <span className="bg-purple-100 text-purple-800 text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 w-max">
            <Truck className="w-3 h-3" /> Enviado
          </span>
        );
      case 'completed':
        return (
          <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 w-max">
            <CheckCircle2 className="w-3 h-3" /> Completado
          </span>
        );
      case 'cancelled':
        return (
          <span className="bg-red-100 text-red-800 text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 w-max">
            <XCircle className="w-3 h-3" /> Cancelado
          </span>
        );
      default:
        return null;
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: Order['status']) => {
    await updateOrderStatus(orderId, newStatus);
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)));
    if (selectedOrder && selectedOrder.id === orderId) {
      setSelectedOrder({ ...selectedOrder, status: newStatus });
    }
  };

  const handleUpdateOrderPaymentMethod = async (order: Order, newMethod: 'transfer' | 'cash') => {
    if (order.paymentMethod === newMethod) return;

    // Recalculate item prices based on the new payment method
    const updatedItems = order.items.map((it) => {
      const { normalUnitPrice, cashUnitPrice, effectiveUnitPrice, effectiveTotalPrice } = resolveOrderItemPrices(
        it,
        newMethod,
        products
      );
      return {
        ...it,
        unitPrice: newMethod === 'cash' ? cashUnitPrice : normalUnitPrice,
        cashUnitPrice: cashUnitPrice,
        totalPrice: effectiveTotalPrice,
        totalCashPrice: cashUnitPrice * it.quantity,
      };
    });

    const isNewCash = newMethod === 'cash';
    let transferProductsSubtotal = 0;
    let cashProductsSubtotal = 0;

    order.items.forEach((it) => {
      const { normalUnitPrice, cashUnitPrice } = resolveOrderItemPrices(it, newMethod, products);
      transferProductsSubtotal += normalUnitPrice * it.quantity;
      cashProductsSubtotal += cashUnitPrice * it.quantity;
    });

    const shipping = order.shippingCost || 0;
    const newCashDiscount = isNewCash ? Math.max(0, transferProductsSubtotal - cashProductsSubtotal) : 0;
    const newSubtotal = transferProductsSubtotal > 0 ? transferProductsSubtotal : order.subtotal;
    const newTotal = (isNewCash ? cashProductsSubtotal : transferProductsSubtotal) + shipping;

    const updatedOrder: Order = {
      ...order,
      paymentMethod: newMethod,
      items: updatedItems,
      subtotal: newSubtotal,
      cashDiscount: newCashDiscount,
      total: newTotal,
    };

    setSelectedOrder(updatedOrder);
    setOrders((prev) => prev.map((o) => (o.id === order.id ? updatedOrder : o)));

    try {
      await updateOrder(order.id, {
        paymentMethod: newMethod,
        items: updatedItems,
        subtotal: newSubtotal,
        cashDiscount: newCashDiscount,
        total: newTotal,
      });
      setActionFeedback({
        type: 'success',
        text: `Medio de pago actualizado a ${newMethod === 'cash' ? 'Efectivo' : 'Transferencia'} y precios recalculados.`,
      });
    } catch (err) {
      console.warn('Error updating order payment method:', err);
    }
  };

  const handleOpenDeleteOrderModal = (order: Order) => {
    setOrderToDelete(order);
  };

  const confirmDeleteOrder = async () => {
    if (!orderToDelete) return;
    setIsDeletingOrder(true);
    try {
      const orderId = orderToDelete.id;
      await deleteOrder(orderId);
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(null);
      }
      setActionFeedback({
        type: 'success',
        text: `Pedido #${orderToDelete.orderNumber || orderId} eliminado del registro.`,
      });
      setOrderToDelete(null);
    } catch (err: any) {
      console.error('[AdminView handleDeleteOrder] Error:', err);
      setActionFeedback({
        type: 'error',
        text: `Error al eliminar pedido: ${err.message || 'Error desconocido'}`,
      });
    } finally {
      setIsDeletingOrder(false);
    }
  };

  const copySchemaToClipboard = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SETUP_SCHEMA);
    setSchemaCopied(true);
    setTimeout(() => setSchemaCopied(false), 2500);
  };

  const copyMigrationToClipboard = () => {
    navigator.clipboard.writeText(SUPABASE_MIGRATION_SQL);
    setMigrationCopied(true);
    setTimeout(() => setMigrationCopied(false), 2500);
  };

  const runDiagnosticTest = async () => {
    setIsTestingDiagnostic(true);
    try {
      const res = await testSupabaseImagesPersistence();
      setDiagnosticResult(res);
    } catch (err: any) {
      setDiagnosticResult({
        connected: false,
        hasImagesColumn: false,
        hasNumberedColumns: false,
        imageCountDetected: 0,
        message: `Error al ejecutar test: ${err?.message || err}`
      });
    } finally {
      setIsTestingDiagnostic(false);
    }
  };

  const runStorageUploadTest = async () => {
    setIsTestingStorageUpload(true);
    setStorageUploadResult(null);
    try {
      const res = await testSupabaseStorageUpload();
      setStorageUploadResult(res);
    } catch (err: any) {
      setStorageUploadResult({
        success: false,
        message: `Error al probar Storage: ${err?.message || err}`
      });
    } finally {
      setIsTestingStorageUpload(false);
    }
  };

  const copyStorageScriptToClipboard = () => {
    navigator.clipboard.writeText(STORAGE_REPAIR_SQL);
    setStorageCopied(true);
    setTimeout(() => setStorageCopied(false), 2500);
  };

  // ---------------- AUTHENTICATION SCREEN ---------------- //
  if (!isAuthenticated) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 p-8 shadow-md space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 bg-[#0058bb]/10 text-[#0058bb] rounded-full flex items-center justify-center mx-auto">
              <Lock className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 font-['Montserrat']">Panel de Administración</h1>
          </div>

          {authError && (
            <div className="bg-red-50 text-red-700 text-xs p-3 rounded-lg border border-red-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">
                Cuenta de Administrador
              </label>
              <input
                id="admin-username-input"
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                disabled={lockoutRemaining > 0}
                value={adminUserInput}
                onChange={(e) => setAdminUserInput(e.target.value)}
                placeholder=""
                className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0058bb] disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">
                Contraseña de Administrador
              </label>
              <div className="relative">
                <input
                  id="admin-password-input"
                  type={showAdminPassword ? 'text' : 'password'}
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck="false"
                  disabled={lockoutRemaining > 0}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder={lockoutRemaining > 0 ? 'Bloqueado por intentos fallidos...' : ''}
                  className="w-full border border-gray-300 rounded-lg pl-3.5 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0058bb] disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={() => setShowAdminPassword(!showAdminPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
                  title={showAdminPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  aria-label={showAdminPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                >
                  {showAdminPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              id="admin-login-btn"
              type="submit"
              disabled={lockoutRemaining > 0}
              className={`w-full bg-[#0058bb] hover:bg-[#004bb0] text-white font-bold py-2.5 px-4 rounded-lg text-sm transition-colors cursor-pointer ${
                lockoutRemaining > 0 ? 'opacity-60 cursor-not-allowed hover:bg-[#0058bb]' : ''
              }`}
            >
              {lockoutRemaining > 0 ? `Espera ${lockoutRemaining}s para reintentar` : 'Ingresar'}
            </button>
          </form>

          <div className="text-center pt-2">
            <button
              onClick={onExitAdmin}
              className="text-xs text-gray-500 hover:text-gray-800 underline cursor-pointer"
            >
              Volver a tienda
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------- MAIN DASHBOARD SCREEN ---------------- //
  const totalSales = orders
    .filter((o) => o.status !== 'cancelled')
    .reduce((acc, o) => acc + o.total, 0);

  const pendingOrders = orders.filter((o) => o.status === 'pending_payment' || o.status === 'preparing');

  return (
    <div className="max-w-[1280px] mx-auto px-4 py-6 space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#0058bb] text-white font-black text-xl rounded-lg flex items-center justify-center">
            MY
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 font-['Montserrat']">Panel de Control Mayorista</h1>
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mt-0.5">
              <span className="flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Cuenta Oficial: MICHY.K97@GMAIL.COM
              </span>
              <span className="flex items-center gap-1">
                <Database className="w-3.5 h-3.5 text-[#0058bb]" />
                Supabase: {isSupabaseConfigured() ? 'Conectado ✓' : 'Modo Local / Storage'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold"
            title="Recargar datos"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>

          <button
            onClick={onExitAdmin}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer"
          >
            Ir a Tienda
          </button>

          <button
            onClick={handleLogout}
            className="text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors cursor-pointer"
            title="Cerrar sesión de Administrador"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Action Feedback Banner */}
      {actionFeedback && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-semibold shadow-xs animate-fadeIn ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionFeedback.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{actionFeedback.text}</span>
          </div>
          <button
            onClick={() => setActionFeedback(null)}
            className="p-1 hover:bg-black/5 rounded cursor-pointer transition-colors text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-gray-500 font-semibold uppercase">Total Ventas</span>
            <p className="text-2xl font-bold text-gray-900 font-['Montserrat'] mt-1">
              ${totalSales.toLocaleString('es-AR')}
            </p>
          </div>
          <div className="w-10 h-10 bg-emerald-50 text-[#00a650] rounded-lg flex items-center justify-center">
            <ShoppingBag className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-gray-500 font-semibold uppercase">Pedidos Activos</span>
            <p className="text-2xl font-bold text-blue-600 font-['Montserrat'] mt-1">
              {pendingOrders.length}
            </p>
          </div>
          <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-gray-500 font-semibold uppercase">Publicaciones</span>
            <p className="text-2xl font-bold text-gray-900 font-['Montserrat'] mt-1">
              {products.length}
            </p>
          </div>
          <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center">
            <Package className="w-5 h-5" />
          </div>
        </div>

        <button
          onClick={() => setActiveTab('analytics')}
          className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between hover:border-[#0058bb]/50 hover:shadow-sm transition-all text-left cursor-pointer group"
          title="Ver panel de visitas y analítica"
        >
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500 font-semibold uppercase">Tráfico Web</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#0058bb] transition-colors" />
            </div>
            <p className="text-base font-bold text-[#0058bb] font-['Montserrat'] mt-1">
              Ver Visitas
            </p>
          </div>
          <div className="w-10 h-10 bg-blue-50 text-[#0058bb] rounded-lg flex items-center justify-center group-hover:bg-[#0058bb] group-hover:text-white transition-colors">
            <BarChart3 className="w-5 h-5" />
          </div>
        </button>
      </div>

      {/* Alerta de Restock / Reposición de Variantes con clientes esperando */}
      {restockAlert && (
        <div className="bg-amber-50 border-2 border-amber-400 text-amber-950 rounded-2xl p-4 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
              <Bell className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <h4 className="font-bold text-sm sm:text-base text-amber-950">
                ¡Variante con stock disponible!
              </h4>
              <p className="text-xs sm:text-sm text-amber-900 leading-snug">
                Esta variante volvió a tener stock: <strong>{restockAlert.productTitle} ({restockAlert.variantName})</strong>. Hay <strong>{restockAlert.count}</strong> {restockAlert.count === 1 ? 'cliente esperando' : 'clientes esperando'}. Recordá avisarles.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => {
                setInitialFilterForStockNotifications(restockAlert.variantName);
                setActiveTab('stock_notifications');
                setRestockAlert(null);
              }}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span>Ver clientes esperando</span>
              <ArrowRightIcon className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setRestockAlert(null)}
              className="text-amber-800 hover:text-amber-950 p-2 rounded-xl hover:bg-amber-100 transition-colors cursor-pointer"
              title="Cerrar alerta"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('products')}
          className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 cursor-pointer transition-colors border-b-2 whitespace-nowrap ${
            activeTab === 'products'
              ? 'border-[#0058bb] text-[#0058bb]'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Package className="w-4 h-4" />
          Gestión de Publicaciones ({products.length})
        </button>

        <button
          onClick={() => setActiveTab('standalone_variants')}
          className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 cursor-pointer transition-colors border-b-2 whitespace-nowrap ${
            activeTab === 'standalone_variants'
              ? 'border-[#0058bb] text-[#0058bb]'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Layers className="w-4 h-4 text-[#0058bb]" />
          <span>Tarjetas de Variantes</span>
          <span className="text-[10px] bg-blue-100 text-[#0058bb] font-extrabold px-1.5 py-0.5 rounded-full">
            Nueva
          </span>
        </button>

        <button
          onClick={() => setActiveTab('best_sellers')}
          className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 cursor-pointer transition-colors border-b-2 whitespace-nowrap ${
            activeTab === 'best_sellers'
              ? 'border-amber-500 text-amber-700'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Flame className="w-4 h-4 text-amber-500" />
          Más Vendidos ({products.filter((p) => p.isBestSeller).length})
        </button>

        <button
          onClick={() => setActiveTab('categories')}
          className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 cursor-pointer transition-colors border-b-2 whitespace-nowrap ${
            activeTab === 'categories'
              ? 'border-[#0058bb] text-[#0058bb]'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          Gestión de Categorías
        </button>

        <button
          onClick={() => setActiveTab('banners')}
          className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 cursor-pointer transition-colors border-b-2 whitespace-nowrap ${
            activeTab === 'banners'
              ? 'border-[#0058bb] text-[#0058bb]'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          Banners y Portada
        </button>

        <button
          onClick={() => setActiveTab('videos')}
          className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 cursor-pointer transition-colors border-b-2 whitespace-nowrap ${
            activeTab === 'videos'
              ? 'border-[#0058bb] text-[#0058bb]'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Video className="w-4 h-4" />
          Videos & Reels
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 cursor-pointer transition-colors border-b-2 whitespace-nowrap ${
            activeTab === 'analytics'
              ? 'border-[#0058bb] text-[#0058bb]'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Estadísticas de Visitas
        </button>

        <button
          onClick={() => setActiveTab('bulk_price_update')}
          className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 cursor-pointer transition-colors border-b-2 whitespace-nowrap ${
            activeTab === 'bulk_price_update'
              ? 'border-[#0058bb] text-[#0058bb]'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Percent className="w-4 h-4" />
          Actualización Masiva de Precios
        </button>

        <button
          onClick={() => setActiveTab('orders')}
          className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 cursor-pointer transition-colors border-b-2 whitespace-nowrap ${
            activeTab === 'orders'
              ? 'border-[#0058bb] text-[#0058bb]'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          Pedidos Finalizados ({orders.length})
        </button>

        <button
          onClick={() => {
            setActiveTab('stock_notifications');
            setInitialFilterForStockNotifications('');
          }}
          className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 cursor-pointer transition-colors border-b-2 whitespace-nowrap ${
            activeTab === 'stock_notifications'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Bell className="w-4 h-4 text-emerald-600" />
          <span>Avisos de Stock</span>
          {pendingStockCount > 0 ? (
            <span className="text-[10px] bg-red-500 text-white font-extrabold px-1.5 py-0.5 rounded-full animate-pulse shadow-2xs">
              {pendingStockCount}
            </span>
          ) : (
            <span className="text-[10px] bg-gray-100 text-gray-600 font-bold px-1.5 py-0.5 rounded-full">
              0
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('quick_buy_link')}
          className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 cursor-pointer transition-colors border-b-2 whitespace-nowrap ${
            activeTab === 'quick_buy_link'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <OfficialWhatsAppIcon className="w-4 h-4 text-[#25D366]" />
          Enlace Compra Rápida ({quickBuyOrdersCount})
        </button>

        <button
          onClick={() => setActiveTab('shipping')}
          className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 cursor-pointer transition-colors border-b-2 whitespace-nowrap ${
            activeTab === 'shipping'
              ? 'border-[#0058bb] text-[#0058bb]'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Truck className="w-4 h-4" />
          Tarifas de Envíos
        </button>

        <button
          onClick={() => setActiveTab('launches')}
          className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 cursor-pointer transition-colors border-b-2 whitespace-nowrap ${
            activeTab === 'launches'
              ? 'border-[#0058bb] text-[#0058bb]'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Rocket className="w-4 h-4 text-[#0058bb]" />
          <span>Próximos Lanzamientos</span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
              isLaunchesVisible
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-amber-100 text-amber-800'
            }`}
          >
            {isLaunchesVisible ? 'Visible' : 'Oculto'}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('store_settings')}
          className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 cursor-pointer transition-colors border-b-2 whitespace-nowrap ${
            activeTab === 'store_settings'
              ? 'border-[#0058bb] text-[#0058bb]'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4 text-[#0058bb]" />
          <span>Botones y Tienda</span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
              storeSettings.showBuyNowButton
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-amber-100 text-amber-800'
            }`}
          >
            {storeSettings.showBuyNowButton ? 'Comprar Ahora Activo' : 'Comprar Ahora Oculto'}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('integrations')}
          className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 cursor-pointer transition-colors border-b-2 whitespace-nowrap ${
            activeTab === 'integrations'
              ? 'border-[#0058bb] text-[#0058bb]'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Settings className="w-4 h-4" />
          Integración Supabase
        </button>
      </div>

      {/* TAB 1: GESTIÓN DE PRODUCTOS */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative max-w-sm flex-1">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por título o categoría..."
                className="w-full bg-white border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#0058bb]"
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('bulk_price_update')}
                className="bg-blue-50 hover:bg-blue-100 text-[#0058bb] text-xs font-bold px-3.5 py-2.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer border border-blue-200 shadow-xs"
                title="Ir a la herramienta de actualización masiva de precios"
              >
                <Percent className="w-3.5 h-3.5" />
                Actualizar Precios Masivamente
              </button>

              <button
                type="button"
                onClick={() => setIsImageAuditorOpen(true)}
                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold px-3.5 py-2.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer border border-emerald-200 shadow-xs"
                title="Auditar y probar en vivo el sistema de optimización de imágenes"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Auditoría de Imágenes</span>
              </button>

              <button
                id="admin-create-product-btn"
                onClick={handleOpenCreateProduct}
                className="bg-[#0058bb] hover:bg-[#004bb0] text-white text-xs font-bold px-4 py-2.5 rounded-lg flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4" />
                Nuevo Producto
              </button>
            </div>
          </div>

          {/* Product Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-600">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-800 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3">Producto</th>
                    <th className="p-3">Categoría</th>
                    <th className="p-3">Precio Mayorista</th>
                    <th className="p-3">Precio Minorista</th>
                    <th className="p-3">Precio Efectivo</th>
                    <th className="p-3">Mín. Mayorista</th>
                    <th className="p-3">Variantes de Tamaño</th>
                    <th className="p-3">Stock</th>
                    <th className="p-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {products
                    .filter((p) =>
                      searchTerm
                        ? p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.category.toLowerCase().includes(searchTerm.toLowerCase())
                        : true
                    )
                    .map((prod) => (
                      <tr key={prod.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <img
                              src={(prod.images && prod.images[0]) || 'https://via.placeholder.com/150'}
                              alt={prod.title}
                              className="w-10 h-10 object-contain rounded border border-gray-200 p-0.5 bg-white shrink-0"
                            />
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="font-semibold text-gray-900 line-clamp-1 max-w-xs">{prod.title}</p>
                                {(() => {
                                  const tag = prod.tag || (prod.tagId ? getProductTagById(prod.tagId) : undefined);
                                  if (!tag) return null;
                                  const vividBg = toVividTagColor(tag.color, tag.id, tag.label);
                                  const isLight = vividBg === '#FFE600' || vividBg.toLowerCase() === '#ffffff';
                                  return (
                                    <span
                                      className="px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider shadow-2xs leading-none shrink-0"
                                      style={{ backgroundColor: vividBg, color: isLight ? '#18181b' : (tag.textColor || '#ffffff') }}
                                    >
                                      {tag.label}
                                    </span>
                                  );
                                })()}
                              </div>
                              <span className="text-[10px] text-gray-400">{(prod.images || []).length} fotos</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 font-medium text-gray-800">{prod.category}</td>
                        <td className="p-3 font-bold text-gray-900">
                          ${prod.wholesalePrice.toLocaleString('es-AR')}
                        </td>
                        <td className="p-3 text-gray-500 font-medium">
                          ${prod.retailPrice.toLocaleString('es-AR')}
                        </td>
                        <td className="p-3 font-medium text-emerald-700">
                          {prod.cashPrice !== undefined && prod.cashPrice !== null && prod.cashPrice > 0
                            ? `$${prod.cashPrice.toLocaleString('es-AR')}`
                            : <span className="text-gray-400 italic text-[11px]">-</span>}
                        </td>
                        <td className="p-3">
                          <span className="bg-[#00a650]/15 text-[#00a650] font-bold px-2 py-0.5 rounded text-[11px]">
                            {prod.minWholesaleQty} u.
                          </span>
                        </td>
                        <td className="p-3">
                          {prod.sizeVariants && prod.sizeVariants.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {prod.sizeVariants.map((sv, idx) => (
                                <span
                                  key={idx}
                                  className="bg-blue-50 text-[#0058bb] border border-blue-200 text-[10px] px-1.5 py-0.5 rounded"
                                >
                                  {sv.name}: ${sv.wholesalePrice.toLocaleString('es-AR')}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-400 italic">Estándar</span>
                          )}
                        </td>
                        <td className="p-3">
                          {(() => {
                            const vts = normalizeVariantTypes(prod);
                            if (vts.length > 0) {
                              const isOut = isProductCompletelyOutOfStock(prod);
                              const totalStock = getProductTotalStock(prod);
                              return (
                                <div className="space-y-1">
                                  <span className={`font-bold block ${isOut ? 'text-red-600' : 'text-gray-900'}`}>
                                    {isOut ? 'Sin stock (0 u.)' : `${totalStock} u. total`}
                                  </span>
                                  <div className="flex flex-wrap gap-1 max-w-xs">
                                    {vts[0]?.options.map((opt, oIdx) => {
                                      const s = getOptionStock(prod, opt);
                                      return (
                                        <span
                                          key={oIdx}
                                          className={`text-[9px] px-1.5 py-0.5 rounded font-medium border ${
                                            s <= 0
                                              ? 'bg-red-50 text-red-700 border-red-200'
                                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                          }`}
                                          title={`Stock de ${opt.name}: ${s} u.`}
                                        >
                                          {opt.name}: {s <= 0 ? 'Sin stock' : `${s}u.`}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            }

                            const isOut = (prod.stock ?? 0) <= 0;
                            return (
                              <span className={`font-semibold ${isOut ? 'text-red-600' : 'text-gray-800'}`}>
                                {isOut ? 'Sin stock (0 u.)' : `${prod.stock} u.`}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              id={`edit-prod-btn-${prod.id}`}
                              onClick={() => handleOpenEditProduct(prod)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                              title="Modificar publicación"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              id={`delete-prod-btn-${prod.id}`}
                              onClick={() => handleOpenDeleteProductModal(prod)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                              title="Eliminar publicación"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: VARIANTES COMO TARJETAS INDEPENDIENTES */}
      {activeTab === 'standalone_variants' && (
        <StandaloneVariantsManager
          products={products}
          onOpenProductDetail={onSelectProduct}
        />
      )}

      {/* TAB: MÁS VENDIDOS */}
      {activeTab === 'best_sellers' && (
        <BestSellersManager
          products={products}
          onToggleBestSeller={handleToggleBestSeller}
          isUpdatingId={updatingBestSellerId}
        />
      )}

      {/* TAB 2: PEDIDOS FINALIZADOS */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          {/* Header & Metric Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs">
              <span className="text-[11px] font-semibold text-gray-500 block">Total Pedidos</span>
              <span className="text-xl font-bold text-gray-900">{orders.length}</span>
            </div>
            <div className="bg-emerald-50/80 p-3.5 rounded-xl border border-emerald-200 shadow-xs">
              <span className="text-[11px] font-bold text-emerald-800 flex items-center gap-1">
                <OfficialWhatsAppIcon className="w-3.5 h-3.5 text-[#25D366]" />
                Compra Rápida
              </span>
              <div className="flex items-baseline justify-between mt-0.5">
                <span className="text-xl font-bold text-emerald-900">{quickBuyOrdersCount}</span>
                <span className="text-[11px] font-bold text-emerald-700">
                  ${orders.filter(isQuickBuyOrder).reduce((acc, o) => acc + (o.total || 0), 0).toLocaleString('es-AR')}
                </span>
              </div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs">
              <span className="text-[11px] font-semibold text-gray-500 block">Pendiente Pago</span>
              <span className="text-xl font-bold text-amber-600">
                {orders.filter((o) => o.status === 'pending_payment').length}
              </span>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs">
              <span className="text-[11px] font-semibold text-gray-500 block">En Preparación / Enviados</span>
              <span className="text-xl font-bold text-blue-600">
                {orders.filter((o) => o.status === 'preparing' || o.status === 'shipped').length}
              </span>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs">
              <span className="text-[11px] font-semibold text-gray-500 block">Completados</span>
              <span className="text-xl font-bold text-emerald-600">
                {orders.filter((o) => o.status === 'completed').length}
              </span>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-3">
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between flex-wrap">
              {/* Search input */}
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="admin-orders-search"
                  type="text"
                  placeholder="Buscar por #pedido, cliente, email, WhatsApp o producto..."
                  value={orderSearchTerm}
                  onChange={(e) => setOrderSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 text-xs rounded-lg border border-gray-300 focus:outline-none focus:ring-1 focus:ring-[#0058bb] focus:border-[#0058bb]"
                />
                {orderSearchTerm && (
                  <button
                    onClick={() => setOrderSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Origin Filter (Compra Rápida WhatsApp vs Web) */}
              <div className="flex items-center gap-1.5 shrink-0">
                <OfficialWhatsAppIcon className="w-3.5 h-3.5 text-emerald-600" />
                <select
                  id="admin-orders-origin-filter"
                  value={orderOriginFilter}
                  onChange={(e) => setOrderOriginFilter(e.target.value as any)}
                  className="text-xs rounded-lg border border-gray-300 py-2 px-2.5 bg-white text-gray-700 font-medium focus:outline-none focus:ring-1 focus:ring-[#0058bb]"
                >
                  <option value="all">Todos los orígenes</option>
                  <option value="quick_buy">Compra Rápida (WhatsApp)</option>
                  <option value="web">Tienda Web Estándar</option>
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5 shrink-0">
                <Filter className="w-3.5 h-3.5 text-gray-400" />
                <select
                  id="admin-orders-status-filter"
                  value={orderStatusFilter}
                  onChange={(e) => setOrderStatusFilter(e.target.value as any)}
                  className="text-xs rounded-lg border border-gray-300 py-2 px-2.5 bg-white text-gray-700 font-medium focus:outline-none focus:ring-1 focus:ring-[#0058bb]"
                >
                  <option value="all">Todos los estados</option>
                  <option value="pending_payment">Pendiente Pago</option>
                  <option value="preparing">En Preparación</option>
                  <option value="shipped">Enviado</option>
                  <option value="completed">Completado</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>

              {/* Date Filter */}
              <div className="flex items-center gap-1.5 shrink-0">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                <select
                  id="admin-orders-date-filter"
                  value={orderDateFilter}
                  onChange={(e) => setOrderDateFilter(e.target.value as any)}
                  className="text-xs rounded-lg border border-gray-300 py-2 px-2.5 bg-white text-gray-700 font-medium focus:outline-none focus:ring-1 focus:ring-[#0058bb]"
                >
                  <option value="all">Todas las fechas</option>
                  <option value="today">Hoy</option>
                  <option value="last_7_days">Últimos 7 días</option>
                  <option value="this_month">Este mes</option>
                  <option value="custom">Fecha específica...</option>
                </select>
              </div>

              {/* Custom Date Input */}
              {orderDateFilter === 'custom' && (
                <input
                  id="admin-orders-custom-date"
                  type="date"
                  value={orderCustomDate}
                  onChange={(e) => setOrderCustomDate(e.target.value)}
                  className="text-xs rounded-lg border border-gray-300 py-2 px-2.5 bg-white text-gray-700 font-medium focus:outline-none focus:ring-1 focus:ring-[#0058bb]"
                />
              )}

              {/* Delivery Filter */}
              <select
                id="admin-orders-delivery-filter"
                value={orderDeliveryFilter}
                onChange={(e) => setOrderDeliveryFilter(e.target.value as any)}
                className="text-xs rounded-lg border border-gray-300 py-2 px-2.5 bg-white text-gray-700 font-medium focus:outline-none focus:ring-1 focus:ring-[#0058bb] shrink-0"
              >
                <option value="all">Todas las entregas</option>
                <option value="pickup">Retiro en Local</option>
                <option value="delivery">Envío a Domicilio</option>
              </select>

              {/* Payment Filter */}
              <select
                id="admin-orders-payment-filter"
                value={orderPaymentFilter}
                onChange={(e) => setOrderPaymentFilter(e.target.value as any)}
                className="text-xs rounded-lg border border-gray-300 py-2 px-2.5 bg-white text-gray-700 font-medium focus:outline-none focus:ring-1 focus:ring-[#0058bb] shrink-0"
              >
                <option value="all">Todos los pagos</option>
                <option value="transfer">Transferencia</option>
                <option value="cash">Efectivo</option>
              </select>

              {/* Reset Filters */}
              {hasActiveOrderFilters && (
                <button
                  id="admin-orders-reset-filters"
                  onClick={handleResetOrderFilters}
                  className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-semibold px-2 py-2 rounded hover:bg-red-50 transition-colors cursor-pointer shrink-0"
                  title="Limpiar filtros"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Limpiar
                </button>
              )}
            </div>

            {/* Results count text */}
            <div className="flex justify-between items-center text-[11px] text-gray-500 pt-1 border-t border-gray-100">
              <span>
                Mostrando <strong className="text-gray-800">{filteredOrders.length}</strong> de <strong className="text-gray-800">{orders.length}</strong> pedidos (ordenados por los más recientes)
              </span>
              {hasActiveOrderFilters && (
                <span className="text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  Filtros activos
                </span>
              )}
            </div>
          </div>

          {/* Orders Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-600">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-800 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3">Pedido</th>
                    <th className="p-3">Fecha y Hora</th>
                    <th className="p-3">Cliente</th>
                    <th className="p-3">WhatsApp</th>
                    <th className="p-3">Entrega</th>
                    <th className="p-3">Pago</th>
                    <th className="p-3">Total</th>
                    <th className="p-3">Estado</th>
                    <th className="p-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-12 text-gray-400">
                        {orders.length === 0
                          ? 'No hay pedidos registrados todavía.'
                          : 'No se encontraron pedidos con los filtros aplicados.'}
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order) => {
                      const orderDate = new Date(order.createdAt);
                      const formattedDate = orderDate.toLocaleDateString('es-AR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      });
                      const formattedTime = orderDate.toLocaleTimeString('es-AR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      });

                      const statusColorClasses =
                        order.status === 'completed'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : order.status === 'shipped'
                          ? 'bg-purple-50 text-purple-800 border-purple-300'
                          : order.status === 'preparing'
                          ? 'bg-blue-50 text-blue-800 border-blue-300'
                          : order.status === 'cancelled'
                          ? 'bg-red-50 text-red-800 border-red-300'
                          : 'bg-amber-50 text-amber-800 border-amber-300';

                      return (
                        <tr key={order.id} className="hover:bg-gray-50/80 transition-colors">
                          <td className="p-3 font-bold text-[#0058bb]">
                            <div className="flex flex-col gap-0.5">
                              <button
                                onClick={() => setSelectedOrder(order)}
                                className="hover:underline font-bold text-left cursor-pointer"
                                title="Ver detalle del pedido"
                              >
                                #{order.orderNumber}
                              </button>
                              {isQuickBuyOrder(order) && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md w-fit">
                                  <OfficialWhatsAppIcon className="w-2.5 h-2.5 text-[#25D366]" />
                                  Compra Rápida
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-gray-500 whitespace-nowrap">
                            <div>{formattedDate}</div>
                            <div className="text-[10px] text-gray-400">{formattedTime} hs</div>
                          </td>
                          <td className="p-3">
                            <div className="font-semibold text-gray-900">{order.customerName}</div>
                            <div className="text-[10px] text-gray-400 truncate max-w-[140px]" title={order.customerEmail}>
                              {order.customerEmail}
                            </div>
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            {order.customerWhatsapp && order.customerWhatsapp.replace(/\D/g, '').length > 5 ? (
                              <a
                                href={`https://wa.me/${order.customerWhatsapp.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-emerald-600 hover:underline font-semibold flex items-center gap-1"
                                title="Abrir chat de WhatsApp"
                              >
                                <MessageSquare className="w-3 h-3" />
                                {order.customerWhatsapp}
                              </a>
                            ) : (
                              <a
                                href="https://wa.me/message/TSF5H4YUIQJOC1"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-bold inline-flex items-center gap-1"
                                title="Abrir WhatsApp oficial de la tienda"
                              >
                                <OfficialWhatsAppIcon className="w-3 h-3 text-[#25D366]" />
                                WhatsApp
                              </a>
                            )}
                          </td>
                          <td className="p-3">
                            {order.deliveryOption === 'pickup' ? (
                              <span className="text-gray-700 font-medium">Retiro Local</span>
                            ) : (
                              <div>
                                <span className="text-blue-700 font-medium block">
                                  {order.shippingMethodName?.toLowerCase().includes('sucursal')
                                    ? 'Sucursal Correo'
                                    : 'Envío Domicilio'}
                                </span>
                                {order.shippingMethodName && (
                                  <span className="text-[10px] text-gray-500 block truncate max-w-[130px]" title={order.shippingMethodName}>
                                    {order.shippingMethodName}
                                  </span>
                                )}
                                {(order.deliveryAddress?.correoBranch || order.correoBranch) && (
                                  <span
                                    className="text-[9.5px] font-bold text-amber-800 bg-amber-50 px-1 py-0.5 rounded border border-amber-200 block truncate max-w-[140px] mt-0.5"
                                    title={`Sucursal: ${order.deliveryAddress?.correoBranch || order.correoBranch}`}
                                  >
                                    Suc: {order.deliveryAddress?.correoBranch || order.correoBranch}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="p-3 whitespace-nowrap font-medium text-gray-700">
                            {order.paymentMethod === 'transfer' ? 'Transferencia' : 'Efectivo'}
                          </td>
                          <td className="p-3 font-bold text-gray-900 whitespace-nowrap">
                            ${order.total.toLocaleString('es-AR')}
                          </td>
                          <td className="p-3">
                            <select
                              value={order.status}
                              onChange={(e) => handleStatusChange(order.id, e.target.value as any)}
                              className={`text-xs font-bold rounded-lg px-2.5 py-1 border focus:outline-none focus:ring-1 focus:ring-[#0058bb] cursor-pointer transition-colors ${statusColorClasses}`}
                            >
                              <option value="pending_payment">Pendiente Pago</option>
                              <option value="preparing">En Preparación</option>
                              <option value="shipped">Enviado</option>
                              <option value="completed">Completado</option>
                              <option value="cancelled">Cancelado</option>
                            </select>
                          </td>
                          <td className="p-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setSelectedOrder(order)}
                                className="text-[#0058bb] hover:bg-blue-50 px-2.5 py-1 rounded font-bold text-xs cursor-pointer flex items-center gap-1 transition-colors"
                                title="Ver recibo y detalle completo"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Detalle
                              </button>
                              <button
                                onClick={() => handleOpenDeleteOrderModal(order)}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded cursor-pointer transition-colors"
                                title="Eliminar pedido del registro"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: INTEGRACIÓN SUPABASE */}
      {activeTab === 'integrations' && (
        <div className="max-w-3xl">
          {/* Supabase Box */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-[#0058bb]" />
                <h3 className="font-bold text-gray-900 font-['Montserrat']">Configuración de Supabase</h3>
              </div>
              <span
                className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                  isSupabaseConfigured()
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {isSupabaseConfigured() ? 'Conectado ✓' : 'Modo Local Storage'}
              </span>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Para sincronizar tu base de datos y Supabase Storage en la nube, declara las siguientes variables en <code>.env</code> o en los secretos de Google AI Studio:
            </p>

            <div className="bg-gray-900 text-emerald-400 p-3 rounded-lg font-mono text-xs space-y-1 overflow-x-auto">
              <p>VITE_SUPABASE_URL="https://tu-proyecto.supabase.co"</p>
              <p>VITE_SUPABASE_ANON_KEY="tu-anon-key-de-supabase"</p>
            </div>

            {/* SQL Scripts (Migration vs Full Schema) */}
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center bg-gray-100 p-0.5 rounded-lg text-[11px] font-semibold">
                  <button
                    onClick={() => setActiveSqlTab('migration')}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      activeSqlTab === 'migration'
                        ? 'bg-white text-[#0058bb] shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    1. Migración 6 Fotos
                  </button>
                  <button
                    onClick={() => setActiveSqlTab('storage')}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      activeSqlTab === 'storage'
                        ? 'bg-white text-[#0058bb] shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    2. Políticas Storage (RLS 403)
                  </button>
                  <button
                    onClick={() => setActiveSqlTab('full')}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      activeSqlTab === 'full'
                        ? 'bg-white text-[#0058bb] shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    3. Schema Completo
                  </button>
                </div>

                {activeSqlTab === 'migration' && (
                  <button
                    onClick={copyMigrationToClipboard}
                    className="text-xs bg-[#0058bb] text-white px-2.5 py-1 rounded font-semibold flex items-center gap-1 hover:bg-[#004bb0] cursor-pointer"
                  >
                    {migrationCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {migrationCopied ? '¡Copiado!' : 'Copiar Migración'}
                  </button>
                )}

                {activeSqlTab === 'storage' && (
                  <button
                    onClick={copyStorageScriptToClipboard}
                    className="text-xs bg-amber-600 text-white px-2.5 py-1 rounded font-semibold flex items-center gap-1 hover:bg-amber-700 cursor-pointer"
                  >
                    {storageCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {storageCopied ? '¡Copiado!' : 'Copiar SQL Storage'}
                  </button>
                )}

                {activeSqlTab === 'full' && (
                  <button
                    onClick={copySchemaToClipboard}
                    className="text-xs bg-gray-700 text-white px-2.5 py-1 rounded font-semibold flex items-center gap-1 hover:bg-gray-850 cursor-pointer"
                  >
                    {schemaCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {schemaCopied ? '¡Copiado!' : 'Copiar Schema'}
                  </button>
                )}
              </div>

              <pre className="bg-gray-50 border border-gray-200 text-gray-700 text-[11px] p-3 rounded-lg max-h-48 overflow-y-auto font-mono">
                {activeSqlTab === 'migration'
                  ? SUPABASE_MIGRATION_SQL
                  : activeSqlTab === 'storage'
                  ? STORAGE_REPAIR_SQL
                  : SUPABASE_SQL_SETUP_SCHEMA}
              </pre>
            </div>

            {/* Test de Compatibilidad y Diagnóstico de Base de Datos */}
            <div className="pt-2 border-t border-gray-100 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-gray-800">Diagnóstico de Base de Datos y Fotos:</span>
                  <p className="text-[11px] text-gray-500">Verifica que las columnas image_1 a image_6 y el campo images JSONB estén activos</p>
                </div>
                <button
                  type="button"
                  onClick={runDiagnosticTest}
                  disabled={isTestingDiagnostic}
                  className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${isTestingDiagnostic ? 'animate-spin' : ''}`} />
                  {isTestingDiagnostic ? 'Comprobando...' : 'Comprobar Tabla'}
                </button>
              </div>

              {diagnosticResult && (
                <div
                  className={`p-3 rounded-lg text-xs space-y-1 border ${
                    diagnosticResult.connected
                      ? diagnosticResult.hasImagesColumn
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : 'bg-amber-50 border-amber-200 text-amber-900'
                      : 'bg-blue-50 border-blue-200 text-blue-900'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold">
                    {diagnosticResult.connected ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    )}
                    <span>{diagnosticResult.message}</span>
                  </div>
                  {diagnosticResult.connected && (
                    <div className="text-[11px] opacity-90 pl-5">
                      • Soporte columna JSONB: {diagnosticResult.hasImagesColumn ? '✅ Sí' : '❌ No (ejecuta migración)'}
                      <br />
                      • Columnas individuales: {diagnosticResult.hasNumberedColumns ? '✅ Sí' : 'ℹ️ No'}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Test en Vivo de Supabase Storage Upload */}
            <div className="pt-2 border-t border-gray-100 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-gray-800">Diagnóstico de Supabase Storage:</span>
                  <p className="text-[11px] text-gray-500">Prueba en vivo la subida de fotos al bucket 'product-images'</p>
                </div>
                <button
                  type="button"
                  onClick={runStorageUploadTest}
                  disabled={isTestingStorageUpload}
                  className="text-xs bg-[#0058bb] hover:bg-[#004bb0] text-white px-2.5 py-1 rounded font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${isTestingStorageUpload ? 'animate-spin' : ''}`} />
                  {isTestingStorageUpload ? 'Probando subida...' : 'Probar Subida Storage'}
                </button>
              </div>

              {storageUploadResult && (
                <div
                  className={`p-3 rounded-lg text-xs space-y-1 border ${
                    storageUploadResult.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold">
                    {storageUploadResult.success ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    )}
                    <span>{storageUploadResult.message}</span>
                  </div>
                  {!storageUploadResult.success && (
                    <div className="pt-1 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSqlTab('storage');
                          copyStorageScriptToClipboard();
                        }}
                        className="text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white px-2.5 py-1 rounded cursor-pointer"
                      >
                        Copiar Script SQL para Storage
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: GESTIÓN DE CATEGORÍAS INDEPENDIENTES */}
      {activeTab === 'categories' && (
        <CategoryManager
          products={products}
          onCategoriesUpdated={(updatedCats) => {
            if (updatedCats && updatedCats.length > 0) {
              setAdminCategories(updatedCats);
            }
            loadData();
          }}
          onProductsUpdated={loadData}
        />
      )}

      {/* TAB 3: BANNERS Y PORTADA DE LA TIENDA */}
      {activeTab === 'banners' && (
        <BannerManager />
      )}

      {/* TAB 3.5: VIDEOS Y REELS CLOUDINARY */}
      {activeTab === 'videos' && (
        <VideoManager products={products} onProductUpdated={loadData} />
      )}

      {/* TAB 4: ACTUALIZACIÓN MASIVA DE PRECIOS */}
      {activeTab === 'bulk_price_update' && (
        <BulkPriceUpdate
          products={products}
          onProductsUpdated={loadData}
        />
      )}

      {/* TAB 5: ESTADÍSTICAS DE VISITAS & TRÁFICO */}
      {activeTab === 'analytics' && (
        <AnalyticsDashboard />
      )}

      {/* TAB 6: ENLACE COMPRA RÁPIDA (WHATSAPP) */}
      {activeTab === 'quick_buy_link' && (
        <QuickBuyLinkManager
          orders={orders}
          onViewOrder={(ord) => {
            setSelectedOrder(ord);
            setActiveTab('orders');
          }}
        />
      )}

      {/* TAB 7: CONFIGURACIÓN Y TARIFAS DE ENVÍOS */}
      {activeTab === 'shipping' && (
        <ShippingConfigManager />
      )}

      {/* TAB 8: GESTIÓN DE PRÓXIMOS LANZAMIENTOS */}
      {activeTab === 'launches' && (
        <LaunchesManager />
      )}

      {/* TAB 9: CONFIGURACIÓN DE BOTONES Y FUNCIONES DE TIENDA */}
      {activeTab === 'store_settings' && (
        <StoreSettingsManager />
      )}

      {/* TAB 10: AVISOS DE STOCK PENDIENTES */}
      {activeTab === 'stock_notifications' && (
        <StockNotificationsManager
          initialFilterVariant={initialFilterForStockNotifications}
        />
      )}

      {/* ---------------- EDIT / CREATE PRODUCT MODAL ---------------- */}
      {isProductModalOpen && editingProduct && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <h2 className="text-lg font-bold text-gray-900 font-['Montserrat']">
                {editingProduct.id ? 'Modificar Publicación' : 'Crear Nueva Publicación'}
              </h2>
              <button
                onClick={() => {
                  setIsProductModalOpen(false);
                  setEditingProduct(null);
                }}
                className="text-gray-400 hover:text-gray-600 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
              {/* Título & Categoría */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label className="font-semibold text-gray-700 block mb-1">Título de la Publicación *</label>
                  <input
                    id="product-edit-title"
                    type="text"
                    required
                    value={editingProduct.title || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, title: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-[#0058bb]"
                  />
                </div>

                <div>
                  <label htmlFor="product-edit-category" className="font-semibold text-gray-700 block mb-1">
                    Categoría *
                  </label>
                  <select
                    id="product-edit-category"
                    required
                    value={editingProduct.category || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs bg-white focus:ring-1 focus:ring-[#0058bb] focus:border-[#0058bb] cursor-pointer"
                  >
                    <option value="" disabled>
                      Seleccionar categoría...
                    </option>
                    {categoryOptions.map((catName) => (
                      <option key={catName} value={catName}>
                        {catName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Subcategoría</label>
                  <input
                    type="text"
                    value={editingProduct.subcategory || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, subcategory: e.target.value })}
                    placeholder="Ej: Aros, Relojes, Peluches"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-[#0058bb]"
                  />
                </div>
              </div>

              {/* Sección Más Vendidos */}
              <div className="bg-amber-50/50 p-3 sm:p-3.5 rounded-xl border border-amber-200/90 shadow-2xs flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <label
                    className="font-semibold text-gray-900 text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer select-none"
                    onClick={() => setEditingProduct({ ...editingProduct, isBestSeller: !editingProduct.isBestSeller })}
                  >
                    <Flame className="w-4 h-4 text-amber-500 fill-amber-500/20" />
                    <span>Incluir en “Más Vendidos”</span>
                  </label>
                  <p className="text-[11px] text-gray-600 leading-tight">
                    Marcá esta casilla para que este producto aparezca en la sección de Más Vendidos en la tienda.
                  </p>
                </div>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={Boolean(editingProduct.isBestSeller)}
                  onClick={() => setEditingProduct({ ...editingProduct, isBestSeller: !editingProduct.isBestSeller })}
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl border flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                    editingProduct.isBestSeller
                      ? 'bg-[#16a34a] border-[#16a34a] text-white shadow-xs'
                      : 'bg-white border-gray-300 hover:border-[#16a34a] text-transparent hover:text-gray-300'
                  }`}
                  title={editingProduct.isBestSeller ? 'Quitar de Más vendidos' : 'Incluir en Más vendidos'}
                >
                  <Check className={`w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5] ${editingProduct.isBestSeller ? 'text-white' : 'text-gray-300'}`} />
                </button>
              </div>

              {/* Etiqueta del Producto */}
              <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-gray-200/90 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <label className="font-semibold text-gray-800 text-xs sm:text-sm flex items-center gap-1.5">
                      <span>🏷️</span> Etiqueta del Producto
                      <span className="text-[11px] font-normal text-gray-500 hidden sm:inline">
                        (Aparece en la esquina superior izquierda de la foto en toda la tienda)
                      </span>
                    </label>
                    <p className="text-[11px] text-gray-500">
                      Selecciona una etiqueta existente o crea una nueva con un color profesional.
                    </p>
                  </div>
                  {editingProduct.tagId && (
                    <button
                      type="button"
                      onClick={() => setEditingProduct({ ...editingProduct, tagId: undefined, tag: undefined })}
                      className="text-xs text-red-600 hover:text-red-700 font-semibold hover:underline cursor-pointer"
                    >
                      ✕ Quitar etiqueta
                    </button>
                  )}
                </div>

                {/* Lista de etiquetas disponibles para seleccionar */}
                <div className="flex flex-wrap gap-1.5 sm:gap-2 items-center">
                  <button
                    type="button"
                    onClick={() => setEditingProduct({ ...editingProduct, tagId: undefined, tag: undefined })}
                    className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      !editingProduct.tagId
                        ? 'bg-gray-800 text-white border-gray-800 shadow-xs'
                        : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                    }`}
                  >
                    Sin etiqueta
                  </button>

                  {availableTags.map((t) => {
                    const isSelected = editingProduct.tagId === t.id;
                    const vividBg = toVividTagColor(t.color, t.id, t.label);
                    const isLight = vividBg === '#FFE600' || vividBg.toLowerCase() === '#ffffff';
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() =>
                          setEditingProduct({
                            ...editingProduct,
                            tagId: t.id,
                            tag: { ...t, color: vividBg },
                          })
                        }
                        className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs select-none ${
                          isSelected
                            ? 'ring-2 ring-offset-2 ring-gray-900 scale-105'
                            : 'opacity-85 hover:opacity-100 hover:scale-102'
                        }`}
                        style={{
                          backgroundColor: vividBg,
                          color: isLight ? '#18181b' : (t.textColor || '#ffffff'),
                          borderColor: vividBg,
                        }}
                      >
                        {isSelected && <span>✓</span>}
                        <span>{t.label}</span>
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => setIsCreatingNewTag(!isCreatingNewTag)}
                    className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs font-semibold border border-dashed border-[#0058bb] text-[#0058bb] hover:bg-blue-50/70 transition-all cursor-pointer flex items-center gap-1"
                  >
                    {isCreatingNewTag ? '✕ Cancelar' : '+ Crear nueva etiqueta'}
                  </button>
                </div>

                {/* Formulario para crear nueva etiqueta */}
                {isCreatingNewTag && (
                  <div className="mt-2 p-3 bg-gray-50 rounded-xl border border-blue-200/70 space-y-2.5 animate-fadeIn">
                    <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-end">
                      <div className="flex-1">
                        <label className="text-xs font-semibold text-gray-700 block mb-1">
                          Texto de la etiqueta:
                        </label>
                        <input
                          type="text"
                          value={newTagLabel}
                          onChange={(e) => setNewTagLabel(e.target.value)}
                          placeholder="Ej: TOP 1, Oferta Relámpago, Edición Limitada"
                          className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-[#0058bb]"
                        />
                      </div>

                      {newTagLabel.trim() && (
                        <div className="shrink-0 flex flex-col items-center">
                          <span className="text-[10px] text-gray-400 mb-0.5">Vista previa</span>
                          <span
                            className="px-2.5 py-1 rounded text-xs font-bold uppercase shadow-xs tracking-wide"
                            style={{
                              backgroundColor: newTagColor,
                              color: TAG_COLOR_PALETTE.find((p) => p.color === newTagColor)?.textColor || '#ffffff',
                            }}
                          >
                            {newTagLabel.trim()}
                          </span>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={handleCreateAndAssignTag}
                        disabled={!newTagLabel.trim()}
                        className="px-3.5 py-1.5 bg-[#0058bb] text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all shadow-xs shrink-0"
                      >
                        Crear y Asignar
                      </button>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-gray-600 block mb-1">
                        Paleta de colores profesionales:
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {TAG_COLOR_PALETTE.map((pal) => (
                          <button
                            key={pal.name}
                            type="button"
                            onClick={() => setNewTagColor(pal.color)}
                            title={`${pal.name} (${pal.color})`}
                            className={`w-6 h-6 rounded-full border transition-all cursor-pointer flex items-center justify-center ${
                              newTagColor === pal.color
                                ? 'ring-2 ring-offset-2 ring-gray-900 scale-110 border-white'
                                : 'border-black/10 hover:scale-105'
                            }`}
                            style={{ backgroundColor: pal.color }}
                          >
                            {newTagColor === pal.color && (
                              <span className="text-[10px]" style={{ color: pal.textColor }}>
                                ✓
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* SECCIÓN: Galería de Fotos de la Publicación (Foto 1 a Foto 6 / Portada) */}
              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/70 space-y-3">
                <div className="flex items-center justify-between border-b border-gray-200 pb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-[#0058bb]" />
                    <div>
                      <label className="font-bold text-gray-800 text-xs uppercase tracking-wide flex items-center gap-1.5">
                        Fotos de la Publicación (Foto 1 a Foto 6)
                        <span className="text-[11px] font-normal text-gray-500 lowercase">
                          ({editingProduct.images?.length || 0}/6 fotos)
                        </span>
                      </label>
                      <p className="text-[11px] text-gray-500 font-normal">
                        La Foto 1 es la portada principal. Puedes subir imágenes desde tu dispositivo o sincronizarlas desde las opciones de variantes.
                      </p>
                    </div>
                  </div>

                  {editingProduct.variantTypes && editingProduct.variantTypes.length > 0 && (
                    <button
                      type="button"
                      onClick={handleSyncVariantImagesToGallery}
                      className="text-xs bg-blue-50 text-[#0058bb] hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                      title="Importa automáticamente las fotos asignadas a las variantes de este producto"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Importar fotos de variantes
                    </button>
                  )}
                </div>

                {/* Storage Warning Banner if RLS error occurred */}
                {storageWarningBanner && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">{storageWarningBanner}</p>
                        <p className="text-[11px] text-amber-700 mt-0.5">
                          Tus fotos se procesan y preservan de forma optimizada. Para permitir almacenamiento directo en el bucket 'product-images', ejecuta el script de Storage en tu Supabase SQL Editor o en la pestaña Integraciones.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(STORAGE_REPAIR_SQL);
                        alert('¡Script SQL de Storage copiado al portapapeles! Pégalo en tu Supabase SQL Editor.');
                      }}
                      className="text-[11px] font-bold bg-amber-200 hover:bg-amber-300 text-amber-900 px-2.5 py-1 rounded cursor-pointer whitespace-nowrap"
                    >
                      Copiar SQL Storage
                    </button>
                  </div>
                )}

                {/* Optimización y progreso */}
                {galleryUploadProgress && (
                  <div className="bg-blue-50 border border-blue-200 text-[#0058bb] text-xs font-medium px-3 py-2 rounded-lg flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                    <span>{galleryUploadProgress}</span>
                  </div>
                )}

                {lastOptimizationSummary && (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-mono font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{lastOptimizationSummary}</span>
                  </div>
                )}

                {/* Thumbnails grid */}
                <div className="flex flex-wrap gap-2.5 items-start">
                  {(editingProduct.images || []).map((imgUrl, imgIdx) => (
                    <div key={imgIdx} className="flex flex-col items-center gap-1">
                      <div className="relative w-20 h-20 rounded-xl border-2 border-gray-200 overflow-hidden group bg-white shadow-xs flex items-center justify-center p-1">
                        <img
                          src={imgUrl}
                          alt={`Foto ${imgIdx + 1}`}
                          className="max-h-full max-w-full object-contain"
                        />

                        {imgIdx === 0 ? (
                          <span className="absolute top-1 left-1 bg-[#0058bb] text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs">
                            Portada
                          </span>
                        ) : (
                          <span className="absolute top-1 left-1 bg-gray-800/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs">
                            #{imgIdx + 1}
                          </span>
                        )}

                        {/* Overlay actions */}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1.5 transition-opacity">
                          {imgIdx > 0 && (
                            <button
                              type="button"
                              onClick={() => handleSetGalleryCover(imgIdx)}
                              className="p-1.5 bg-white/90 text-amber-600 rounded-lg hover:bg-white cursor-pointer shadow-xs"
                              title="Establecer como Portada Principal (Foto 1)"
                            >
                              <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveGalleryImage(imgIdx)}
                            className="p-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 cursor-pointer shadow-xs"
                            title="Eliminar esta foto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <ImageOptimizationBadge imageUrl={imgUrl} compact align="center" />
                    </div>
                  ))}

                  {/* Add Slot via Upload if < 6 images */}
                  {(!editingProduct.images || editingProduct.images.length < 6) && (
                    <label
                      className={`w-20 h-20 rounded-xl border-2 border-dashed border-[#0058bb]/50 hover:border-[#0058bb] bg-blue-50/40 hover:bg-blue-50 flex flex-col items-center justify-center cursor-pointer transition-colors text-[#0058bb] ${
                        isUploadingGalleryImages ? 'opacity-50 pointer-events-none' : ''
                      }`}
                    >
                      {isUploadingGalleryImages ? (
                        <RefreshCw className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <Upload className="w-5 h-5 mb-1" />
                          <span className="text-[10px] font-bold">Subir Fotos</span>
                          <span className="text-[9px] text-gray-400">
                            ({6 - (editingProduct.images?.length || 0)} disponibles)
                          </span>
                        </>
                      )}
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleUploadGalleryImages}
                        disabled={isUploadingGalleryImages}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {/* Direct URL input bar */}
                {(!editingProduct.images || editingProduct.images.length < 6) && (
                  <div className="flex gap-2 pt-1">
                    <input
                      type="url"
                      value={galleryUrlInput}
                      onChange={(e) => setGalleryUrlInput(e.target.value)}
                      placeholder="O pegar URL directa de imagen (https://...)"
                      className="flex-1 border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:ring-1 focus:ring-[#0058bb]"
                    />
                    <button
                      type="button"
                      onClick={handleAddGalleryUrl}
                      disabled={!galleryUrlInput.trim()}
                      className="bg-gray-200 hover:bg-gray-300 disabled:opacity-50 text-gray-800 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      Añadir URL
                    </button>
                  </div>
                )}
              </div>

              {/* Precios Generales & Stock */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Precio Mayorista ($) *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={editingProduct.wholesalePrice ?? 0}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, wholesalePrice: Number(e.target.value) })
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs bg-white focus:ring-1 focus:ring-[#0058bb]"
                  />
                </div>

                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Precio Minorista ($) *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={editingProduct.retailPrice ?? 0}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, retailPrice: Number(e.target.value) })
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs bg-white focus:ring-1 focus:ring-[#0058bb]"
                  />
                </div>

                <div>
                  <label className="font-semibold text-emerald-800 block mb-1">Precio efectivo minorista ($)</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="Opcional"
                    value={editingProduct.retailCashPrice ?? editingProduct.cashPrice ?? ''}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        retailCashPrice: e.target.value === '' ? undefined : Number(e.target.value),
                        cashPrice: e.target.value === '' ? undefined : Number(e.target.value),
                      })
                    }
                    className="w-full border border-emerald-300 rounded-lg px-3 py-2 text-xs bg-white focus:ring-1 focus:ring-emerald-600 font-semibold text-emerald-900"
                    title="Precio en efectivo para compras minoristas"
                  />
                </div>

                <div>
                  <label className="font-semibold text-teal-800 block mb-1">Precio efectivo mayorista ($)</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="Opcional"
                    value={editingProduct.wholesaleCashPrice ?? ''}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        wholesaleCashPrice: e.target.value === '' ? undefined : Number(e.target.value),
                      })
                    }
                    className="w-full border border-teal-300 rounded-lg px-3 py-2 text-xs bg-white focus:ring-1 focus:ring-teal-600 font-semibold text-teal-900"
                    title="Precio en efectivo para compras mayoristas"
                  />
                </div>

                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Mínimo Mayorista *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={editingProduct.minWholesaleQty ?? 1}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, minWholesaleQty: Number(e.target.value) })
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs bg-white focus:ring-1 focus:ring-[#0058bb]"
                  />
                </div>

                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Stock Disponible *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={editingProduct.stock ?? 0}
                    onChange={(e) => setEditingProduct({ ...editingProduct, stock: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs bg-white focus:ring-1 focus:ring-[#0058bb]"
                  />
                </div>
              </div>

              {/* Sistema de Variantes e Imágenes Independientes por Opción */}
              <VariantManager
                variantTypes={editingProduct.variantTypes || []}
                onChange={handleVariantTypesChange}
                baseWholesalePrice={editingProduct.wholesalePrice ?? 1000}
                baseRetailPrice={editingProduct.retailPrice ?? 1500}
                baseCashPrice={editingProduct.cashPrice}
                baseRetailCashPrice={editingProduct.retailCashPrice}
                baseWholesaleCashPrice={editingProduct.wholesaleCashPrice}
                baseStock={editingProduct.stock ?? 10}
              />

              {/* Descripción */}
              <div>
                <label className="font-semibold text-gray-700 block mb-1">Descripción del Producto</label>
                <textarea
                  rows={4}
                  value={editingProduct.description || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                  placeholder="Detalles, materiales, especificaciones..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-[#0058bb]"
                />
              </div>

              {/* SECCIÓN: Imagen Adicional / Banner Lifestyle Inferior */}
              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/70 space-y-3">
                <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-[#0058bb]" />
                    <label className="font-bold text-gray-800 text-xs uppercase tracking-wide">
                      Imagen Adicional del Producto (Banner Inferior)
                    </label>
                  </div>
                  {editingProduct.additionalImage && (
                    <button
                      type="button"
                      onClick={handleRemoveAdditionalImage}
                      className="text-xs text-red-600 hover:text-red-700 font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      Eliminar / Usar Por Defecto
                    </button>
                  )}
                </div>

                {lastOptimizationSummary && (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-mono font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{lastOptimizationSummary}</span>
                  </div>
                )}

                <p className="text-[11px] text-gray-500">
                  Esta imagen se exhibe debajo de la descripción en la página del producto. Si no se carga ninguna, se mostrará el banner predeterminado.
                </p>

                {/* Preview de la imagen adicional */}
                {editingProduct.additionalImage ? (
                  <>
                    <div className="relative rounded-xl overflow-hidden border border-gray-300 bg-gray-100 max-h-52 group flex items-center justify-center shadow-xs">
                      <img
                        src={editingProduct.additionalImage}
                        alt="Banner adicional"
                        className="w-full h-44 object-cover group-hover:scale-102 transition-transform duration-300"
                        onError={(e) => {
                          console.warn('Error cargando preview de banner adicional');
                        }}
                      />
                      {/* Indicador de carga cuando se está procesando */}
                      {isUploadingAdditionalImage && (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center gap-2 text-white z-10">
                          <Loader2 className="w-6 h-6 animate-spin text-white" />
                          <span className="text-xs font-semibold">Subiendo y optimizando banner...</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2 z-10">
                        <label className="bg-white/90 hover:bg-white text-gray-800 text-xs font-bold px-3 py-1.5 rounded-lg shadow-md cursor-pointer flex items-center gap-1.5">
                          <Upload className="w-3.5 h-3.5" />
                          Reemplazar Imagen
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleUploadAdditionalImage}
                            disabled={isUploadingAdditionalImage}
                            className="hidden"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={handleRemoveAdditionalImage}
                          className="bg-red-600/90 hover:bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-md cursor-pointer flex items-center gap-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Quitar
                        </button>
                      </div>
                      <div className="absolute top-2 left-2 bg-emerald-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs flex items-center gap-1 z-10">
                        <CheckCircle2 className="w-3 h-3" />
                        Banner personalizado activo
                      </div>
                    </div>
                    {editingProduct.additionalImage && !editingProduct.additionalImage.startsWith('blob:') && (
                      <div className="pt-1.5">
                        <ImageOptimizationBadge imageUrl={editingProduct.additionalImage} />
                      </div>
                    )}
                  </>
                ) : isUploadingAdditionalImage ? (
                  <div className="border-2 border-[#0058bb]/40 rounded-xl p-6 text-center bg-blue-50/50 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-[#0058bb]" />
                    <p className="text-xs font-semibold text-[#0058bb]">Subiendo y optimizando banner...</p>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center bg-white space-y-1">
                    <p className="text-xs font-semibold text-gray-600">
                      Actualmente se muestra el banner predeterminado
                    </p>
                    <p className="text-[11px] text-gray-400">
                      Sube una imagen o pega una URL para personalizarla para este producto.
                    </p>
                  </div>
                )}

                {/* Controles para subir o ingresar URL de imagen adicional */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                  <div>
                    <label
                      className={`w-full flex items-center justify-center gap-2 bg-[#0058bb] hover:bg-[#004bb0] text-white px-3 py-2 rounded-lg font-bold text-xs transition-colors cursor-pointer shadow-xs ${
                        isUploadingAdditionalImage ? 'opacity-50 pointer-events-none' : ''
                      }`}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isUploadingAdditionalImage ? 'Subiendo imagen...' : 'Subir imagen desde PC / Celular'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleUploadAdditionalImage}
                        disabled={isUploadingAdditionalImage}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div className="flex gap-1.5">
                    <input
                      type="url"
                      value={additionalImageInputUrl}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAdditionalImageInputUrl(val);
                        if (val.trim()) {
                          setEditingProduct((prev) => (prev ? { ...prev, additionalImage: val.trim() } : prev));
                        }
                      }}
                      placeholder="O pega URL (https://...)"
                      className="flex-1 border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:ring-1 focus:ring-[#0058bb]"
                    />
                    <button
                      type="button"
                      onClick={handleAddAdditionalImageUrl}
                      disabled={!additionalImageInputUrl.trim()}
                      className="bg-gray-200 hover:bg-gray-300 disabled:opacity-50 text-gray-800 font-bold px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-colors"
                    >
                      Establecer
                    </button>
                  </div>
                </div>
              </div>

              {/* SECCIÓN: Video del Producto (Cloudinary MP4) */}
              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/70 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Video className="w-4 h-4 text-[#0058bb]" />
                    <label className="font-bold text-gray-800 text-xs uppercase tracking-wide">
                      Video del Producto (Cloudinary MP4)
                    </label>
                  </div>
                  {editingProduct.videoUrl && (
                    <button
                      type="button"
                      onClick={() => setEditingProduct({ ...editingProduct, videoUrl: '' })}
                      className="text-xs text-red-600 hover:text-red-700 font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      Quitar Video
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-gray-500">
                  Pega la URL directa de Cloudinary terminada en .mp4. Se mostrará automáticamente como segunda miniatura con autoplay en la galería de fotos, en el carrusel de Reels 9:16 y debajo de la información del producto.
                </p>

                <div className="flex gap-2">
                  <input
                    type="url"
                    value={editingProduct.videoUrl || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, videoUrl: e.target.value })}
                    placeholder="https://res.cloudinary.com/.../video/upload/...mp4"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono bg-white focus:ring-1 focus:ring-[#0058bb]"
                  />
                </div>

                {/* Previsualización directa del video del producto */}
                {editingProduct.videoUrl && editingProduct.videoUrl.trim() && (
                  <div className="flex items-center gap-3 pt-1">
                    <div className="aspect-[9/16] w-20 rounded-lg overflow-hidden bg-black border border-gray-300 relative shrink-0">
                      <video
                        src={optimizeCloudinaryVideoUrl(editingProduct.videoUrl.trim(), { width: 480 })}
                        poster={getCloudinaryVideoPosterUrl(editingProduct.videoUrl.trim(), { width: 480 }) || undefined}
                        muted
                        autoPlay
                        loop
                        playsInline
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="text-xs text-gray-600 space-y-0.5">
                      <p className="font-bold text-emerald-600">✓ Video vinculado correctamente</p>
                      <p className="text-[11px] text-gray-500">
                        Formato 9:16 optimizado. Si visitas la publicación, se verá en la galería y en la vista previa completa.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* SECCIÓN: Calificación y Opiniones (Estrellas y Comentarios) */}
              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/70 space-y-4">
                <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
                  <ClassicStar className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <label className="font-bold text-gray-800 text-xs uppercase tracking-wide">
                    Sección de Calificación y Opiniones
                  </label>
                </div>

                {/* Configuración de Puntuación General */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-white p-3 rounded-lg border border-gray-200">
                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1">
                      Puntuación General (1.0 a 5.0 estrellas)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.1"
                        min="1"
                        max="5"
                        value={editingProduct.rating ?? 5.0}
                        onChange={(e) =>
                          setEditingProduct({
                            ...editingProduct,
                            rating: parseFloat(e.target.value) || 5.0,
                          })
                        }
                        className="w-24 border border-gray-300 rounded-lg px-3 py-1.5 text-xs font-bold focus:ring-1 focus:ring-[#0058bb]"
                      />
                      <div className="flex text-amber-400">
                        {[1, 2, 3, 4, 5].map((starNum) => (
                          <ClassicStar
                            key={starNum}
                            className={`w-4 h-4 ${
                              starNum <= Math.round(editingProduct.rating ?? 5)
                                ? 'fill-amber-400 text-amber-400'
                                : 'fill-gray-200 text-gray-200'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1">
                      Número Total de Opiniones Mostradas
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editingProduct.reviewsCount ?? (editingProduct.reviews?.length || 0)}
                      onChange={(e) =>
                        setEditingProduct({
                          ...editingProduct,
                          reviewsCount: parseInt(e.target.value, 10) || 0,
                        })
                      }
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs font-semibold focus:ring-1 focus:ring-[#0058bb]"
                    />
                  </div>
                </div>

                {/* Lista de Comentarios Existentes */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-700">
                      Lista de Comentarios ({editingProduct.reviews?.length || 0})
                    </span>
                  </div>

                  {editingProduct.reviews && editingProduct.reviews.length > 0 ? (
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {editingProduct.reviews.map((rev, revIdx) => (
                        <div
                          key={rev.id || revIdx}
                          className="bg-white border border-gray-200 rounded-lg p-3 space-y-2 relative"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-semibold text-gray-500">Estrellas:</span>
                              <div className="flex">
                                {[1, 2, 3, 4, 5].map((starVal) => (
                                  <button
                                    key={starVal}
                                    type="button"
                                    onClick={() => handleUpdateReview(revIdx, 'rating', starVal)}
                                    className="p-0.5 hover:scale-110 transition-transform cursor-pointer"
                                  >
                                    <ClassicStar
                                      className={`w-3.5 h-3.5 ${
                                        starVal <= (rev.rating ?? 5)
                                          ? 'fill-[#0058bb] text-[#0058bb]'
                                          : 'fill-gray-200 text-gray-200'
                                      }`}
                                    />
                                  </button>
                                ))}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveReview(revIdx)}
                              className="text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-50 transition-colors cursor-pointer"
                              title="Eliminar este comentario"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            <input
                              type="text"
                              value={rev.author || ''}
                              onChange={(e) => handleUpdateReview(revIdx, 'author', e.target.value)}
                              placeholder="Autor (ej. Laura M.)"
                              className="text-xs border border-gray-200 rounded px-2 py-1 focus:ring-1 focus:ring-[#0058bb]"
                            />
                            <input
                              type="text"
                              value={rev.text}
                              onChange={(e) => handleUpdateReview(revIdx, 'text', e.target.value)}
                              placeholder="Texto del comentario..."
                              className="text-xs border border-gray-200 rounded px-2 py-1 md:col-span-2 focus:ring-1 focus:ring-[#0058bb]"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 bg-white rounded-lg border border-dashed border-gray-300 text-xs text-gray-400">
                      No hay comentarios cargados. Se mostrarán los comentarios de ejemplo por defecto.
                    </div>
                  )}
                </div>

                {/* Formulario para Agregar Nuevo Comentario */}
                <div className="bg-white border border-blue-100 rounded-lg p-3 space-y-2">
                  <span className="text-xs font-bold text-gray-800 block">
                    + Agregar Nuevo Comentario
                  </span>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600">Calificación:</span>
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((starVal) => (
                        <button
                          key={starVal}
                          type="button"
                          onClick={() => setNewReviewRating(starVal)}
                          className="p-0.5 hover:scale-110 transition-transform cursor-pointer"
                        >
                          <ClassicStar
                            className={`w-4 h-4 ${
                              starVal <= newReviewRating
                                ? 'fill-[#0058bb] text-[#0058bb]'
                                : 'fill-gray-200 text-gray-200'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={newReviewAuthor}
                      onChange={(e) => setNewReviewAuthor(e.target.value)}
                      placeholder="Autor (opcional)"
                      className="text-xs border border-gray-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-[#0058bb]"
                    />
                    <input
                      type="text"
                      value={newReviewText}
                      onChange={(e) => setNewReviewText(e.target.value)}
                      placeholder="Texto del comentario..."
                      className="text-xs border border-gray-300 rounded px-2.5 py-1.5 md:col-span-2 focus:ring-1 focus:ring-[#0058bb]"
                    />
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={handleAddReview}
                      disabled={!newReviewText.trim()}
                      className="bg-[#0058bb] hover:bg-[#004bb0] disabled:opacity-50 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Agregar Comentario
                    </button>
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-3 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setIsProductModalOpen(false);
                    setEditingProduct(null);
                  }}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-[#0058bb] hover:bg-[#004bb0] text-white px-6 py-2 rounded-lg font-bold transition-colors cursor-pointer shadow-xs"
                >
                  Guardar Publicación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- ORDER DETAILS MODAL ---------------- */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900 font-['Montserrat'] flex items-center gap-2 flex-wrap">
                  <span>Pedido #{selectedOrder.orderNumber}</span>
                  {isQuickBuyOrder(selectedOrder) && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2.5 py-0.5 rounded-full">
                      <OfficialWhatsAppIcon className="w-3 h-3 text-[#25D366]" />
                      Compra Rápida WhatsApp
                    </span>
                  )}
                </h3>
                <span className="text-xs text-gray-400">
                  {new Date(selectedOrder.createdAt).toLocaleString('es-AR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })} hs
                </span>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedOrder.status}
                  onChange={(e) => handleStatusChange(selectedOrder.id, e.target.value as any)}
                  className={`text-xs font-bold rounded-lg px-2.5 py-1.5 border focus:outline-none focus:ring-1 focus:ring-[#0058bb] cursor-pointer transition-colors ${
                    selectedOrder.status === 'completed'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : selectedOrder.status === 'shipped'
                      ? 'bg-purple-50 text-purple-800 border-purple-300'
                      : selectedOrder.status === 'preparing'
                      ? 'bg-blue-50 text-blue-800 border-blue-300'
                      : selectedOrder.status === 'cancelled'
                      ? 'bg-red-50 text-red-800 border-red-300'
                      : 'bg-amber-50 text-amber-800 border-amber-300'
                  }`}
                >
                  <option value="pending_payment">Pendiente Pago</option>
                  <option value="preparing">En Preparación</option>
                  <option value="shipped">Enviado</option>
                  <option value="completed">Completado</option>
                  <option value="cancelled">Cancelado</option>
                </select>

                <button
                  onClick={() => setSelectedOrder(null)}
                  className="text-gray-400 hover:text-gray-600 text-lg cursor-pointer p-1"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              {/* Customer & Payment Info */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-gray-50 p-3 rounded-lg border border-gray-100">
                <div>
                  <span className="text-gray-400 block">Cliente:</span>
                  <strong className="text-gray-900">{selectedOrder.customerName}</strong>
                </div>
                <div>
                  <span className="text-gray-400 block">Email:</span>
                  <strong className="text-gray-900 break-all">{selectedOrder.customerEmail}</strong>
                </div>
                <div>
                  <span className="text-gray-400 block">WhatsApp:</span>
                  {selectedOrder.customerWhatsapp && selectedOrder.customerWhatsapp.replace(/\D/g, '').length > 5 ? (
                    <a
                      href={`https://wa.me/${selectedOrder.customerWhatsapp.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-600 font-bold underline flex items-center gap-1"
                    >
                      <MessageSquare className="w-3 h-3" />
                      {selectedOrder.customerWhatsapp}
                    </a>
                  ) : (
                    <a
                      href="https://wa.me/message/TSF5H4YUIQJOC1"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded text-xs font-bold inline-flex items-center gap-1"
                      title="Abrir chat de WhatsApp oficial"
                    >
                      <OfficialWhatsAppIcon className="w-3 h-3 text-[#25D366]" />
                      Chat WhatsApp
                    </a>
                  )}
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">Medio de Pago:</span>
                  <select
                    value={selectedOrder.paymentMethod}
                    onChange={(e) => handleUpdateOrderPaymentMethod(selectedOrder, e.target.value as 'transfer' | 'cash')}
                    className="text-xs font-bold rounded border border-gray-300 bg-white px-2 py-1 text-gray-900 shadow-sm focus:outline-none focus:ring-1 focus:ring-[#0058bb] cursor-pointer"
                    title="Actualizar medio de pago y recalcular precios de los productos"
                  >
                    <option value="cash">Efectivo (Precio Efectivo)</option>
                    <option value="transfer">Transferencia Bancaria</option>
                  </select>
                </div>
                <div>
                  <span className="text-gray-400 block">Canal / Origen:</span>
                  <strong className={isQuickBuyOrder(selectedOrder) ? "text-emerald-700 font-bold flex items-center gap-1" : "text-gray-900"}>
                    {isQuickBuyOrder(selectedOrder) ? (
                      <>
                        <OfficialWhatsAppIcon className="w-3 h-3 text-[#25D366]" />
                        Compra Rápida
                      </>
                    ) : (
                      'Tienda Web'
                    )}
                  </strong>
                </div>
              </div>

              {/* Delivery Info */}
              <div className="bg-blue-50/60 p-3 rounded-lg border border-blue-100 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-gray-800">Método de Entrega:</span>
                  <span className="text-blue-700 font-bold">
                    {selectedOrder.deliveryOption === 'pickup'
                      ? 'Retiro en Local San Pedrito'
                      : `Envío a Domicilio ${selectedOrder.shippingMethodName ? `(${selectedOrder.shippingMethodName})` : ''}`}
                  </span>
                </div>

                {selectedOrder.deliveryOption === 'delivery' && selectedOrder.deliveryAddress && (
                  <div className="pt-2 text-gray-700 space-y-1 border-t border-blue-100/80">
                    {(selectedOrder.deliveryAddress.correoBranch || selectedOrder.correoBranch) && (
                      <div className="bg-amber-100/90 border border-amber-300 text-amber-950 p-2.5 rounded-lg mb-2">
                        <span className="block text-[11px] font-bold uppercase tracking-wider text-amber-900">
                          Sucursal de Correo Argentino:
                        </span>
                        <span className="text-sm font-bold text-gray-900 block mt-0.5">
                          {selectedOrder.deliveryAddress.correoBranch || selectedOrder.correoBranch}
                        </span>
                      </div>
                    )}
                    <div>
                      <strong>Dirección:</strong> {selectedOrder.deliveryAddress.street}{' '}
                      {selectedOrder.deliveryAddress.number}
                      {selectedOrder.deliveryAddress.floorApt ? ` (Piso/Dpto: ${selectedOrder.deliveryAddress.floorApt})` : ''}
                    </div>
                    <div>
                      <strong>Ciudad / CP:</strong> {selectedOrder.deliveryAddress.city},{' '}
                      {selectedOrder.deliveryAddress.province} (CP {selectedOrder.deliveryAddress.postalCode})
                    </div>
                    {selectedOrder.deliveryAddress.receiverName && (
                      <div>
                        <strong>Recibe:</strong> {selectedOrder.deliveryAddress.receiverName}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Item breakdown */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-800 block text-xs">
                    Productos del Pedido ({selectedOrder.items.reduce((acc, it) => acc + it.quantity, 0)} u.):
                  </span>
                  {selectedOrder.paymentMethod === 'cash' && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Precios en Efectivo
                    </span>
                  )}
                </div>
                <div className="divide-y divide-gray-100">
                  {selectedOrder.items.map((it) => {
                    const resolved = resolveOrderItemPrices(it, selectedOrder.paymentMethod, products);
                    const variantSuffix = it.variantText ? `, ${it.variantText}` : '';
                    const hasDiscount = resolved.isCash && resolved.normalUnitPrice > resolved.effectiveUnitPrice;

                    return (
                      <div
                        key={it.id}
                        className="flex justify-between items-center gap-3 py-2.5 first:pt-1 last:pb-1"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {it.image && (
                            <img
                              src={it.image}
                              alt={it.title}
                              referrerPolicy="no-referrer"
                              className="w-10 h-10 object-cover rounded-md border border-gray-200 shrink-0"
                            />
                          )}
                          <div className="leading-tight min-w-0">
                            <span className="font-semibold text-gray-900 block text-xs">
                              {it.quantity}x {it.title}
                            </span>
                            <span className="text-[10px] text-gray-500 block mt-0.5">
                              {variantSuffix ? variantSuffix.replace(/^, /, '') + ' · ' : ''}
                              <span className={resolved.isCash ? "text-emerald-700 font-semibold" : "text-gray-600 font-medium"}>
                                {resolved.pricingLabel}
                              </span>
                              {' · '}
                              {hasDiscount && (
                                <span className="line-through text-gray-400 mr-1">
                                  ${resolved.normalUnitPrice.toLocaleString('es-AR')}
                                </span>
                              )}
                              <span className={resolved.isCash ? "text-emerald-800 font-bold" : "text-gray-900 font-semibold"}>
                                ${resolved.effectiveUnitPrice.toLocaleString('es-AR')} c/u
                              </span>
                            </span>
                          </div>
                        </div>
                        <strong className={resolved.isCash ? "text-emerald-800 shrink-0 text-xs font-bold text-right" : "text-gray-900 shrink-0 text-xs font-bold text-right"}>
                          ${resolved.effectiveTotalPrice.toLocaleString('es-AR')}
                        </strong>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Pricing Totals */}
              {(() => {
                const isCash = selectedOrder.paymentMethod === 'cash';
                let transferItemsTotal = 0;
                let cashItemsTotal = 0;

                selectedOrder.items.forEach((it) => {
                  const res = resolveOrderItemPrices(it, selectedOrder.paymentMethod, products);
                  transferItemsTotal += res.normalUnitPrice * it.quantity;
                  cashItemsTotal += res.cashUnitPrice * it.quantity;
                });

                const effectiveItemsTotal = isCash ? cashItemsTotal : transferItemsTotal;
                const shipping = selectedOrder.shippingCost || 0;
                const calculatedCashDiscount = isCash ? Math.max(0, transferItemsTotal - cashItemsTotal) : 0;
                const displayCashDiscount = isCash
                  ? (selectedOrder.cashDiscount > 0 ? selectedOrder.cashDiscount : calculatedCashDiscount)
                  : 0;
                const displaySubtotal = isCash && displayCashDiscount > 0
                  ? (transferItemsTotal > 0 ? transferItemsTotal : selectedOrder.subtotal)
                  : (selectedOrder.subtotal || effectiveItemsTotal);
                const displayTotal = isCash
                  ? (displaySubtotal - displayCashDiscount + shipping)
                  : (selectedOrder.total || displaySubtotal + shipping);

                return (
                  <div className="border-t border-gray-200 pt-2 space-y-1">
                    <div className="flex justify-between text-gray-600">
                      <span>Subtotal{isCash && displayCashDiscount > 0 ? ' (Lista / Transferencia)' : ''}:</span>
                      <span>${displaySubtotal.toLocaleString('es-AR')}</span>
                    </div>
                    {selectedOrder.wholesaleDiscount > 0 && (
                      <div className="hidden" style={{ display: 'none' }} aria-hidden="true">
                        <span>Ahorro Mayorista:</span>
                        <span>-${selectedOrder.wholesaleDiscount.toLocaleString('es-AR')}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-gray-600">
                      <span>Costo de Envío:</span>
                      <span>
                        {shipping === 0 ? 'Gratis' : `$${shipping.toLocaleString('es-AR')}`}
                      </span>
                    </div>
                    {isCash && displayCashDiscount > 0 && (
                      <div className="flex justify-between text-emerald-600 font-semibold">
                        <span>Descuento Efectivo:</span>
                        <span>-${displayCashDiscount.toLocaleString('es-AR')}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-sm text-gray-900 pt-2 border-t">
                      <span>Total Final{isCash ? ' (Efectivo)' : ''}:</span>
                      <span className="text-[#0058bb] text-base">${displayTotal.toLocaleString('es-AR')}</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-gray-200">
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={`https://wa.me/${selectedOrder.customerWhatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
                    `Hola ${selectedOrder.customerName}, te escribimos de SAN PEDRITO sobre tu pedido #${selectedOrder.orderNumber}.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  WhatsApp Cliente
                </a>
              </div>

              <button
                onClick={() => setSelectedOrder(null)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold px-4 py-2 rounded-lg text-xs cursor-pointer transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Product In-App Modal */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-100">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-gray-900 text-center font-['Montserrat']">
              ¿Eliminar esta publicación?
            </h3>
            <p className="text-xs text-gray-500 text-center mt-1">
              Esta acción eliminará el producto del catálogo y de la base de datos de manera definitiva.
            </p>

            {/* Product mini card preview */}
            <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200 flex items-center gap-3">
              <img
                src={(productToDelete.images && productToDelete.images[0]) || 'https://via.placeholder.com/100'}
                alt={productToDelete.title}
                className="w-12 h-12 object-contain rounded bg-white border border-gray-200 p-1 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-gray-900 truncate">{productToDelete.title}</p>
                <p className="text-[11px] text-gray-500">
                  Categoría: <span className="font-semibold text-gray-700">{productToDelete.category}</span>
                </p>
                <p className="text-[11px] text-gray-700 font-medium">
                  Mayorista: <span className="font-bold text-[#0058bb]">${productToDelete.wholesalePrice.toLocaleString('es-AR')}</span>
                  {' · '}
                  Minorista: <span className="font-bold text-gray-900">${productToDelete.retailPrice.toLocaleString('es-AR')}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-gray-100">
              <button
                type="button"
                disabled={isDeletingProduct}
                onClick={() => setProductToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                id="confirm-delete-product-btn"
                disabled={isDeletingProduct}
                onClick={confirmDeleteProduct}
                className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer shadow-sm transition-colors flex items-center gap-1.5"
              >
                {isDeletingProduct ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirmar Eliminación</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Order In-App Modal */}
      {orderToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-100">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-gray-900 text-center font-['Montserrat']">
              ¿Eliminar el pedido #{orderToDelete.orderNumber || orderToDelete.id}?
            </h3>
            <p className="text-xs text-gray-500 text-center mt-1">
              Esta acción eliminará el pedido del registro de ventas y del historial del panel.
            </p>

            <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs text-gray-700 space-y-1">
              <p>
                <span className="font-semibold text-gray-900">Cliente:</span> {orderToDelete.customerName}
              </p>
              <p>
                <span className="font-semibold text-gray-900">Total:</span> ${orderToDelete.total.toLocaleString('es-AR')}
              </p>
              <p>
                <span className="font-semibold text-gray-900">Artículos:</span> {orderToDelete.items?.length || 0} producto(s)
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-gray-100">
              <button
                type="button"
                disabled={isDeletingOrder}
                onClick={() => setOrderToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                id="confirm-delete-order-btn"
                disabled={isDeletingOrder}
                onClick={confirmDeleteOrder}
                className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer shadow-sm transition-colors flex items-center gap-1.5"
              >
                {isDeletingOrder ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirmar Eliminación</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Auditoría de Optimización de Imágenes */}
      <ImageOptimizationAuditor
        isOpen={isImageAuditorOpen}
        onClose={() => setIsImageAuditorOpen(false)}
      />
    </div>
  );
};
