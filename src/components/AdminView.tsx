import React, { useState, useEffect, useMemo } from 'react';
import { Product, Order, SizeVariant, VariantType, ProductReview } from '../types';
import {
  normalizeVariantTypes,
  syncLegacyFields,
  getProductTotalStock,
  isProductCompletelyOutOfStock,
  getOptionStock,
} from '../utils/variantHelpers';
import { VariantManager } from './admin/VariantManager';
import { BulkPriceUpdate } from './admin/BulkPriceUpdate';
import { CategoryManager } from './admin/CategoryManager';
import { ClassicStar } from './common/ClassicStar';
import {
  fetchProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  uploadProductImage,
  uploadProductImages,
  fetchOrders,
  updateOrderStatus,
  updateOrderEmailStatus,
  deleteOrder,
  isSupabaseConfigured,
  SUPABASE_SQL_SETUP_SCHEMA,
  SUPABASE_MIGRATION_SQL,
  testSupabaseImagesPersistence,
} from '../services/supabase';
import {
  isEmailJsConfigured,
  sendOrderEmails,
} from '../services/emailjs';
import { OptimizationResult } from '../utils/imageOptimizer';
import { EmailTemplateManager } from './admin/EmailTemplateManager';
import { AnalyticsDashboard } from './admin/AnalyticsDashboard';
import { QuickBuyLinkManager, OfficialWhatsAppIcon } from './admin/QuickBuyLinkManager';
import {
  Lock,
  Package,
  ShoppingBag,
  Settings,
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
} from 'lucide-react';

interface AdminViewProps {
  onExitAdmin: () => void;
}

export const AdminView: React.FC<AdminViewProps> = ({ onExitAdmin }) => {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('my_admin_auth') === 'true';
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<'products' | 'categories' | 'orders' | 'bulk_price_update' | 'integrations' | 'analytics' | 'quick_buy_link'>('products');

  // Data states
  const [products, setProducts] = useState<Product[]>([]);
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

  // Product edit/create modal
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [imageInputUrl, setImageInputUrl] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
    stats?: OptimizationResult;
  } | null>(null);
  const [lastOptimizationSummary, setLastOptimizationSummary] = useState<string | null>(null);

  // Additional image & reviews states
  const [additionalImageInputUrl, setAdditionalImageInputUrl] = useState('');
  const [isUploadingAdditionalImage, setIsUploadingAdditionalImage] = useState(false);
  const [newReviewText, setNewReviewText] = useState('');
  const [newReviewAuthor, setNewReviewAuthor] = useState('');
  const [newReviewRating, setNewReviewRating] = useState(5);

  const MAX_PRODUCT_IMAGES = 6;

  // Selected order details modal
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // SQL schema copied notifications
  const [schemaCopied, setSchemaCopied] = useState(false);
  const [migrationCopied, setMigrationCopied] = useState(false);
  const [activeSqlTab, setActiveSqlTab] = useState<'migration' | 'full'>('migration');
  const [diagnosticResult, setDiagnosticResult] = useState<{
    connected: boolean;
    hasImagesColumn: boolean;
    hasNumberedColumns: boolean;
    imageCountDetected: number;
    message: string;
  } | null>(null);
  const [isTestingDiagnostic, setIsTestingDiagnostic] = useState(false);
  const [isResendingOrderEmail, setIsResendingOrderEmail] = useState(false);

  const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD || 'admin';

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === adminPassword || passwordInput === 'admin') {
      setIsAuthenticated(true);
      sessionStorage.setItem('my_admin_auth', 'true');
      setAuthError(null);
    } else {
      setAuthError('Contraseña de administrador incorrecta. (Por defecto: admin)');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('my_admin_auth');
  };

  // Load data on mount / auth
  const loadData = async () => {
    setLoading(true);
    try {
      const [prods, ords] = await Promise.all([fetchProducts(), fetchOrders()]);
      setProducts(prods);
      setOrders(ords);
    } catch (e) {
      console.error('Error cargando datos del admin:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }

    const handleOrdersUpdated = (event?: any) => {
      // Optimistic update if order is included in the event detail
      if (event?.detail?.order) {
        const incomingOrder = event.detail.order as Order;
        setOrders((prev) => {
          const exists = prev.some((o) => o.id === incomingOrder.id || o.orderNumber === incomingOrder.orderNumber);
          if (exists) {
            return prev.map((o) => (o.id === incomingOrder.id || o.orderNumber === incomingOrder.orderNumber ? incomingOrder : o));
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

    window.addEventListener('my_commerce_orders_updated', handleOrdersUpdated);
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('my_commerce_orders_updated', handleOrdersUpdated);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [isAuthenticated]);

  // Filtered and Sorted Orders (single source of truth, most recent first)
  const filteredOrders = useMemo(() => {
    return orders
      .filter((order) => {
        // 1. Search Query: Matches #orderNumber, customer name, email, whatsapp, or product title/variant
        if (orderSearchTerm.trim()) {
          const query = orderSearchTerm.trim().toLowerCase();
          const matchesNumber = order.orderNumber?.toLowerCase().includes(query);
          const matchesName = order.customerName?.toLowerCase().includes(query);
          const matchesEmail = order.customerEmail?.toLowerCase().includes(query);
          const matchesWhatsapp = order.customerWhatsapp?.toLowerCase().includes(query);
          const matchesProducts = order.items?.some(
            (item) =>
              item.title?.toLowerCase().includes(query) ||
              item.variantText?.toLowerCase().includes(query)
          );
          if (!matchesNumber && !matchesName && !matchesEmail && !matchesWhatsapp && !matchesProducts) {
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
  ]);

  const hasActiveOrderFilters = Boolean(
    orderSearchTerm.trim() ||
    orderStatusFilter !== 'all' ||
    orderDateFilter !== 'all' ||
    orderPaymentFilter !== 'all' ||
    orderDeliveryFilter !== 'all'
  );

  const handleResetOrderFilters = () => {
    setOrderSearchTerm('');
    setOrderStatusFilter('all');
    setOrderDateFilter('all');
    setOrderCustomDate('');
    setOrderPaymentFilter('all');
    setOrderDeliveryFilter('all');
  };

  // Product CRUD
  const handleOpenCreateProduct = () => {
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
      category: 'Bijuteria',
      subcategory: '',
      images: [],
      additionalImage: '',
      rating: 5.0,
      reviewsCount: 128,
      reviews: [
        {
          id: `rev-1-${Date.now()}`,
          rating: 5,
          author: 'Comprador verificado',
          text: 'Excelente calidad, no se ponen negros y se venden súper rápido.',
        },
        {
          id: `rev-2-${Date.now()}`,
          rating: 5,
          author: 'Revendedora Flores',
          text: 'Muy buen cierre, el dorado es muy lindo y natural.',
        },
      ],
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
      soldCount: Math.random() > 0.5 ? 1000 : 500,
      isBestSeller: false,
    });
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
    if (cloned.reviewsCount === undefined || cloned.reviewsCount === null) cloned.reviewsCount = 128;
    if (!cloned.reviews || cloned.reviews.length === 0) {
      cloned.reviews = [
        {
          id: `rev-1-${Date.now()}`,
          rating: 5,
          author: 'Comprador verificado',
          text: 'Excelente calidad, no se ponen negros y se venden súper rápido.',
        },
        {
          id: `rev-2-${Date.now()}`,
          rating: 5,
          author: 'Revendedora Flores',
          text: 'Muy buen cierre, el dorado es muy lindo y natural.',
        },
      ];
    }
    console.log(`\n================== [CASH & VARIANT DEBUG - POST-LOAD (Admin Edit Open)] ==================`);
    console.log(`[Admin Edit Open] Abriendo edición para producto "${cloned.title}" (ID: ${cloned.id})`);
    console.log(`[Admin Edit Open] Precios en efectivo cargados: Min: ${cloned.retailCashPrice !== undefined ? `$${cloned.retailCashPrice}` : 'N/A'} | May: ${cloned.wholesaleCashPrice !== undefined ? `$${cloned.wholesaleCashPrice}` : 'N/A'}`);
    console.log(`[Admin Edit Open] Variantes cargadas en el modal:`, JSON.stringify(cloned.variantTypes, null, 2));
    setEditingProduct(cloned);
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
    setEditingProduct({
      ...editingProduct,
      variantTypes: newVariantTypes,
      colors,
      sizeVariants,
    });
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || !editingProduct.title) {
      console.warn('[AdminView handleSaveProduct] Formulario inválido o sin título.');
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
    const productPayload: Partial<Product> = {
      ...editingProduct,
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
        // Update
        console.log('[AdminView handleSaveProduct] Ejecutando UPDATE para ID:', productPayload.id);
        const updated = await updateProduct(productPayload.id, productPayload);
        console.log('[AdminView handleSaveProduct] Producto actualizado retornado:', updated);
        setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      } else {
        // Create
        console.log('[AdminView handleSaveProduct] Ejecutando CREATE');
        const created = await createProduct(productPayload as any);
        console.log('[AdminView handleSaveProduct] Producto creado retornado:', created);
        setProducts((prev) => [created, ...prev]);
      }
      setIsProductModalOpen(false);
      setEditingProduct(null);
    } catch (err: any) {
      console.error('[AdminView handleSaveProduct] Error capturado:', err);
      alert('Error al guardar el producto: ' + err.message);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar esta publicación?')) {
      await deleteProduct(id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
    }
  };

  // Image handling in product modal (up to 6 images)
  const handleAddImageUrl = () => {
    if (!editingProduct) return;
    const currentImages = editingProduct.images || [];

    if (currentImages.length >= MAX_PRODUCT_IMAGES) {
      alert(`Solo se pueden agregar hasta ${MAX_PRODUCT_IMAGES} imágenes por publicación.`);
      return;
    }

    if (imageInputUrl.trim()) {
      setEditingProduct({
        ...editingProduct,
        images: [...currentImages, imageInputUrl.trim()],
      });
      setImageInputUrl('');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !editingProduct) return;

    const currentImages = editingProduct.images || [];
    const availableSlots = MAX_PRODUCT_IMAGES - currentImages.length;

    if (availableSlots <= 0) {
      alert(`Ya has alcanzado el límite máximo de ${MAX_PRODUCT_IMAGES} imágenes para esta publicación.`);
      e.target.value = '';
      return;
    }

    const filesArray = (Array.from(files) as File[]).slice(0, availableSlots);
    if (files.length > availableSlots) {
      alert(`Solo se subieron las primeras ${availableSlots} imágenes para no superar el límite de ${MAX_PRODUCT_IMAGES}.`);
    }

    setIsUploadingImage(true);
    setUploadProgress({ current: 1, total: filesArray.length });

    try {
      const isFirstCover = currentImages.length === 0;
      const uploadedUrls = await uploadProductImages(
        filesArray,
        (current, total, stats) => {
          setUploadProgress({ current, total, stats });
        },
        {
          isFirstImageCover: isFirstCover,
          areAllSecondary: !isFirstCover,
        }
      );

      setEditingProduct({
        ...editingProduct,
        images: [...currentImages, ...uploadedUrls],
      });
      setLastOptimizationSummary(
        `✓ ${uploadedUrls.length} ${uploadedUrls.length === 1 ? 'imagen procesada y optimizada' : 'imágenes procesadas y optimizadas'} automáticamente en formato WebP antes de guardar.`
      );
      setTimeout(() => setLastOptimizationSummary(null), 5000);
    } catch (err: any) {
      alert('Error subiendo imágenes a Supabase Storage: ' + err.message);
    } finally {
      setIsUploadingImage(false);
      setUploadProgress(null);
      e.target.value = '';
    }
  };

  const handleSetCoverImage = (index: number) => {
    if (!editingProduct || !editingProduct.images || index === 0) return;
    const images = [...editingProduct.images];
    const [selected] = images.splice(index, 1);
    images.unshift(selected);
    setEditingProduct({ ...editingProduct, images });
  };

  const handleMoveImage = (fromIndex: number, toIndex: number) => {
    if (!editingProduct || !editingProduct.images) return;
    if (toIndex < 0 || toIndex >= editingProduct.images.length) return;
    const images = [...editingProduct.images];
    const [moved] = images.splice(fromIndex, 1);
    images.splice(toIndex, 0, moved);
    setEditingProduct({ ...editingProduct, images });
  };

  const handleRemoveImage = (index: number) => {
    if (editingProduct && editingProduct.images) {
      const updatedImages = editingProduct.images.filter((_, i) => i !== index);
      setEditingProduct({ ...editingProduct, images: updatedImages });
    }
  };

  const handleReplaceImageFile = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingProduct || !editingProduct.images) return;

    setIsUploadingImage(true);
    setUploadProgress({ current: 1, total: 1 });

    try {
      const isCover = index === 0;
      const [uploadedUrl] = await uploadProductImages(
        [file],
        (current, total, stats) => {
          setUploadProgress({ current, total, stats });
        },
        {
          isFirstImageCover: isCover,
          areAllSecondary: !isCover,
        }
      );
      if (uploadedUrl) {
        const newImages = [...editingProduct.images];
        newImages[index] = uploadedUrl;
        setEditingProduct({ ...editingProduct, images: newImages });
        setLastOptimizationSummary('✓ Imagen reemplazada y optimizada automáticamente en formato WebP.');
        setTimeout(() => setLastOptimizationSummary(null), 4000);
      }
    } catch (err: any) {
      alert('Error reemplazando imagen: ' + err.message);
    } finally {
      setIsUploadingImage(false);
      setUploadProgress(null);
      e.target.value = '';
    }
  };

  // Additional Image handling (Banner inferior de la publicación)
  const handleUploadAdditionalImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingProduct) return;

    setIsUploadingAdditionalImage(true);
    try {
      const uploadedUrl = await uploadProductImage(file, { isCover: true, maxDimension: 1600 });
      if (uploadedUrl) {
        setEditingProduct({ ...editingProduct, additionalImage: uploadedUrl });
        setAdditionalImageInputUrl(uploadedUrl);
        setLastOptimizationSummary('✓ Imagen adicional / banner optimizada automáticamente en formato WebP.');
        setTimeout(() => setLastOptimizationSummary(null), 4000);
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
    setEditingProduct({
      ...editingProduct,
      additionalImage: additionalImageInputUrl.trim(),
    });
  };

  const handleRemoveAdditionalImage = () => {
    if (!editingProduct) return;
    setEditingProduct({
      ...editingProduct,
      additionalImage: '',
    });
    setAdditionalImageInputUrl('');
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

  const handleDeleteOrder = async (orderId: string) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este pedido del registro?')) {
      await deleteOrder(orderId);
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(null);
      }
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
            <p className="text-xs text-gray-500">
              Ruta protegida para gestión de catálogo, pedidos y sincronización con Supabase.
            </p>
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
                Contraseña de Administrador
              </label>
              <input
                id="admin-password-input"
                type="password"
                required
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Ingresa la clave (ej: admin)"
                className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0058bb]"
              />
            </div>

            <button
              id="admin-login-btn"
              type="submit"
              className="w-full bg-[#0058bb] hover:bg-[#004bb0] text-white font-bold py-2.5 px-4 rounded-lg text-sm transition-colors cursor-pointer"
            >
              Acceder al Panel
            </button>
          </form>

          <div className="text-center pt-2">
            <button
              onClick={onExitAdmin}
              className="text-xs text-gray-500 hover:text-gray-800 underline cursor-pointer"
            >
              Volver a la tienda pública
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
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Database className="w-3.5 h-3.5 text-[#0058bb]" />
                Supabase: {isSupabaseConfigured() ? 'Conectado ✓' : 'Modo Local / Storage'}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-[#00a650]" />
                EmailJS: {isEmailJsConfigured() ? 'Activo ✓' : 'Simulación Activa'}
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
          onClick={() => setActiveTab('quick_buy_link')}
          className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 cursor-pointer transition-colors border-b-2 whitespace-nowrap ${
            activeTab === 'quick_buy_link'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <OfficialWhatsAppIcon className="w-4 h-4 text-[#25D366]" />
          Enlace Compra Rápida
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
          Supabase & EmailJS
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
                              <p className="font-semibold text-gray-900 line-clamp-1 max-w-xs">{prod.title}</p>
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
                              onClick={() => handleDeleteProduct(prod.id)}
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

      {/* TAB 2: PEDIDOS FINALIZADOS */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          {/* Header & Metric Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs">
              <span className="text-[11px] font-semibold text-gray-500 block">Total Pedidos</span>
              <span className="text-xl font-bold text-gray-900">{orders.length}</span>
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
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
              {/* Search input */}
              <div className="relative flex-1">
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
                            <button
                              onClick={() => setSelectedOrder(order)}
                              className="hover:underline font-bold text-left cursor-pointer"
                              title="Ver detalle del pedido"
                            >
                              #{order.orderNumber}
                            </button>
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
                          </td>
                          <td className="p-3">
                            {order.deliveryOption === 'pickup' ? (
                              <span className="text-gray-700 font-medium">Retiro Local</span>
                            ) : (
                              <div>
                                <span className="text-blue-700 font-medium block">Envío Domicilio</span>
                                {order.shippingMethodName && (
                                  <span className="text-[10px] text-gray-500 block truncate max-w-[130px]" title={order.shippingMethodName}>
                                    {order.shippingMethodName}
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
                                onClick={() => handleDeleteOrder(order.id)}
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

      {/* TAB 3: INTEGRACIONES SUPABASE & EMAILJS */}
      {activeTab === 'integrations' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    1. Migración 6 Fotos (Recomendado)
                  </button>
                  <button
                    onClick={() => setActiveSqlTab('full')}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      activeSqlTab === 'full'
                        ? 'bg-white text-[#0058bb] shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    2. Schema Completo
                  </button>
                </div>

                {activeSqlTab === 'migration' ? (
                  <button
                    onClick={copyMigrationToClipboard}
                    className="text-xs bg-[#0058bb] text-white px-2.5 py-1 rounded font-semibold flex items-center gap-1 hover:bg-[#004bb0] cursor-pointer"
                  >
                    {migrationCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {migrationCopied ? '¡Copiado!' : 'Copiar Migración'}
                  </button>
                ) : (
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
                {activeSqlTab === 'migration' ? SUPABASE_MIGRATION_SQL : SUPABASE_SQL_SETUP_SCHEMA}
              </pre>
            </div>

            {/* Test de Compatibilidad y Diagnóstico */}
            <div className="pt-2 border-t border-gray-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-800">Diagnóstico de Base de Datos y Fotos:</span>
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
          </div>

          {/* EmailJS Modern Template Manager */}
          <EmailTemplateManager orders={orders} products={products} />
        </div>
      )}

      {/* TAB 2: GESTIÓN DE CATEGORÍAS INDEPENDIENTES */}
      {activeTab === 'categories' && (
        <CategoryManager
          products={products}
          onCategoriesUpdated={() => {
            // Updated categories
          }}
        />
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
                  <label className="font-semibold text-gray-700 block mb-1">Categoría *</label>
                  <input
                    type="text"
                    required
                    list="admin-categories-datalist"
                    value={editingProduct.category || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                    placeholder="Ej: Bijuteria, Collares, Dijes, Tecnología..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-[#0058bb]"
                  />
                  <datalist id="admin-categories-datalist">
                    {Array.from(new Set(['Bijuteria', 'Tecnología', 'Juguetes', 'Perfumes', 'Collares', 'Dijes', 'Aros', ...products.map((p) => p.category).filter(Boolean)])).map((cat) => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
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

              {/* Galería de Imágenes (Supabase Storage / URL - Hasta 6 fotos) */}
              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50 space-y-3.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-[#0058bb]" />
                    <span className="font-bold text-gray-900 text-xs md:text-sm">
                      Fotos de la Publicación (Hasta 6 imágenes)
                    </span>
                  </div>
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                      (editingProduct.images || []).length === MAX_PRODUCT_IMAGES
                        ? 'bg-blue-100 text-blue-800'
                        : (editingProduct.images || []).length > 0
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {(editingProduct.images || []).length} / {MAX_PRODUCT_IMAGES} fotos
                  </span>
                </div>

                {/* 6 Visual Slots Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
                  {Array.from({ length: MAX_PRODUCT_IMAGES }).map((_, slotIndex) => {
                    const currentImages = editingProduct.images || [];
                    const imgUrl = currentImages[slotIndex];
                    const isCover = slotIndex === 0;

                    if (imgUrl) {
                      return (
                        <div
                          key={slotIndex}
                          className={`group relative rounded-lg border-2 bg-white flex flex-col overflow-hidden shadow-2xs transition-all ${
                            isCover ? 'border-[#0058bb] ring-2 ring-[#0058bb]/20' : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {/* Slot Tag */}
                          <div className="absolute top-1.5 left-1.5 z-10">
                            {isCover ? (
                              <span className="bg-[#0058bb] text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shadow-xs">
                                <Star className="w-2.5 h-2.5 fill-amber-300 text-amber-300" /> Portada
                              </span>
                            ) : (
                              <span className="bg-gray-900/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md shadow-xs">
                                #{slotIndex + 1}
                              </span>
                            )}
                          </div>

                          {/* Image preview */}
                          <div className="h-24 w-full bg-white flex items-center justify-center p-1 overflow-hidden">
                            <img
                              src={imgUrl}
                              alt={`Foto ${slotIndex + 1}`}
                              className="max-h-full max-w-full object-contain transition-transform group-hover:scale-105"
                            />
                          </div>

                          {/* Action Toolbar */}
                          <div className="bg-gray-100 border-t border-gray-200 p-1 flex items-center justify-between gap-0.5 text-gray-600">
                            <div className="flex items-center gap-0.5">
                              {!isCover && (
                                <button
                                  type="button"
                                  title="Establecer como foto de portada"
                                  onClick={() => handleSetCoverImage(slotIndex)}
                                  className="p-1 hover:bg-amber-100 hover:text-amber-700 rounded transition-colors cursor-pointer"
                                >
                                  <Star className="w-3 h-3" />
                                </button>
                              )}
                              {slotIndex > 0 && (
                                <button
                                  type="button"
                                  title="Mover a la izquierda"
                                  onClick={() => handleMoveImage(slotIndex, slotIndex - 1)}
                                  className="p-1 hover:bg-blue-100 hover:text-blue-700 rounded transition-colors cursor-pointer"
                                >
                                  <ArrowLeftIcon className="w-3 h-3" />
                                </button>
                              )}
                              {slotIndex < currentImages.length - 1 && (
                                <button
                                  type="button"
                                  title="Mover a la derecha"
                                  onClick={() => handleMoveImage(slotIndex, slotIndex + 1)}
                                  className="p-1 hover:bg-blue-100 hover:text-blue-700 rounded transition-colors cursor-pointer"
                                >
                                  <ArrowRightIcon className="w-3 h-3" />
                                </button>
                              )}

                              {/* Reemplazar imagen directamente */}
                              <label
                                title="Reemplazar esta foto"
                                className="p-1 hover:bg-gray-200 hover:text-gray-900 rounded transition-colors cursor-pointer"
                              >
                                <Upload className="w-3 h-3 text-[#0058bb]" />
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handleReplaceImageFile(slotIndex, e)}
                                  disabled={isUploadingImage}
                                  className="hidden"
                                />
                              </label>
                            </div>

                            <button
                              type="button"
                              title="Eliminar imagen"
                              onClick={() => handleRemoveImage(slotIndex)}
                              className="p-1 text-red-500 hover:bg-red-100 hover:text-red-700 rounded transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    }

                    // Empty slot
                    return (
                      <label
                        key={slotIndex}
                        className={`h-32 rounded-lg border-2 border-dashed border-gray-300 hover:border-[#0058bb] bg-white/70 hover:bg-blue-50/30 flex flex-col items-center justify-center p-2 text-center transition-all cursor-pointer group ${
                          isUploadingImage ? 'opacity-50 pointer-events-none' : ''
                        }`}
                      >
                        <div className="w-7 h-7 rounded-full bg-gray-100 group-hover:bg-blue-100 group-hover:text-[#0058bb] text-gray-400 flex items-center justify-center mb-1 transition-colors">
                          <Plus className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] font-bold text-gray-500 group-hover:text-[#0058bb]">
                          {slotIndex === 0 ? 'Foto #1 (Portada)' : `Foto #${slotIndex + 1}`}
                        </span>
                        <span className="text-[9px] text-gray-400">Clic para subir</span>
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={handleFileUpload}
                          disabled={isUploadingImage || (editingProduct.images || []).length >= MAX_PRODUCT_IMAGES}
                          className="hidden"
                        />
                      </label>
                    );
                  })}
                </div>

                {/* Upload & Optimization Progress Notification */}
                {isUploadingImage && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2 text-xs text-blue-900">
                    <div className="flex items-center justify-between font-semibold">
                      <span className="flex items-center gap-1.5">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#0058bb]" />
                        Optimizando y subiendo a Supabase Storage...
                      </span>
                      {uploadProgress && (
                        <span className="font-mono text-[11px] bg-blue-100 px-2 py-0.5 rounded text-blue-800">
                          {uploadProgress.current} de {uploadProgress.total}
                        </span>
                      )}
                    </div>
                    <div className="w-full bg-blue-200 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-[#0058bb] h-full transition-all duration-300"
                        style={{
                          width: uploadProgress
                            ? `${(uploadProgress.current / uploadProgress.total) * 100}%`
                            : '50%',
                        }}
                      />
                    </div>
                    {uploadProgress?.stats && (
                      <div className="text-[11px] text-blue-700 flex items-center justify-between font-mono bg-white/70 p-1.5 rounded border border-blue-100">
                        <span>
                          Foto #{uploadProgress.current}: {uploadProgress.stats.width}x{uploadProgress.stats.height}px ({uploadProgress.stats.format.toUpperCase()})
                        </span>
                        <span className="font-bold text-emerald-700">
                          {uploadProgress.stats.originalSizeKB.toFixed(0)} KB ➔ {uploadProgress.stats.optimizedSizeKB.toFixed(0)} KB
                          {uploadProgress.stats.savedPercent > 0 && ` (-${uploadProgress.stats.savedPercent.toFixed(0)}%)`}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Last Optimization Success Notification */}
                {lastOptimizationSummary && !isUploadingImage && (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 font-semibold flex items-center justify-between animate-fade-in">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      {lastOptimizationSummary}
                    </span>
                    <button
                      type="button"
                      onClick={() => setLastOptimizationSummary(null)}
                      className="text-emerald-600 hover:text-emerald-800 text-[10px] underline ml-2"
                    >
                      Cerrar
                    </button>
                  </div>
                )}

                {/* Add Photo Controls */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                  {/* File Upload Button */}
                  <div>
                    <label
                      className={`w-full flex items-center justify-center gap-2 bg-[#0058bb] hover:bg-[#004bb0] text-white px-3 py-2 rounded-lg font-bold text-xs transition-colors cursor-pointer shadow-xs ${
                        isUploadingImage || (editingProduct.images || []).length >= MAX_PRODUCT_IMAGES
                          ? 'opacity-50 pointer-events-none'
                          : ''
                      }`}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>
                        {(editingProduct.images || []).length >= MAX_PRODUCT_IMAGES
                          ? 'Límite de 6 fotos alcanzado'
                          : 'Subir fotos desde la PC / Celular (Múltiple)'}
                      </span>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleFileUpload}
                        disabled={isUploadingImage || (editingProduct.images || []).length >= MAX_PRODUCT_IMAGES}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* Add via URL Input */}
                  <div className="flex gap-1.5">
                    <input
                      type="url"
                      value={imageInputUrl}
                      onChange={(e) => setImageInputUrl(e.target.value)}
                      placeholder="O pega URL de imagen (https://...)"
                      disabled={(editingProduct.images || []).length >= MAX_PRODUCT_IMAGES}
                      className="flex-1 border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:ring-1 focus:ring-[#0058bb] disabled:bg-gray-100"
                    />
                    <button
                      type="button"
                      onClick={handleAddImageUrl}
                      disabled={!imageInputUrl.trim() || (editingProduct.images || []).length >= MAX_PRODUCT_IMAGES}
                      className="bg-gray-200 hover:bg-gray-300 disabled:opacity-50 text-gray-800 font-bold px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-colors"
                    >
                      Agregar
                    </button>
                  </div>
                </div>

                <div className="p-2 bg-emerald-50/60 border border-emerald-200/80 rounded-lg text-[11px] text-emerald-900 space-y-0.5">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Optimización automática de imágenes activa</span>
                  </div>
                  <p className="text-[10px] text-emerald-700 leading-relaxed">
                    Las fotos se redimensionan inteligentemente (1200-1600px) y se convierten a formato WebP de alta fidelidad (portada ~200-300 KB, secundarias ~150-250 KB) antes de guardarse en Supabase Storage. Sin pasos manuales, ahorrando hasta un 80% de almacenamiento y acelerando la tienda.
                  </p>
                </div>

                <p className="text-[11px] text-gray-500 italic">
                  💡 La primera foto (#1) será la portada principal que se ve en la tienda. Puedes reordenar o cambiar la portada usando las flechas y la estrella.
                </p>
              </div>

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

                <p className="text-[11px] text-gray-500">
                  Esta imagen se exhibe debajo de la descripción en la página del producto. Si no se carga ninguna, se mostrará el banner predeterminado.
                </p>

                {/* Preview de la imagen adicional */}
                {editingProduct.additionalImage ? (
                  <div className="relative rounded-xl overflow-hidden border border-gray-300 bg-gray-900 max-h-48 group flex items-center justify-center">
                    <img
                      src={editingProduct.additionalImage}
                      alt="Banner adicional"
                      className="w-full h-44 object-cover opacity-85 group-hover:scale-102 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
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
                      onChange={(e) => setAdditionalImageInputUrl(e.target.value)}
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
                      value={editingProduct.reviewsCount ?? 128}
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
                <h3 className="text-lg font-bold text-gray-900 font-['Montserrat'] flex items-center gap-2">
                  <span>Pedido #{selectedOrder.orderNumber}</span>
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
              <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-lg border border-gray-100">
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
                  <a
                    href={`https://wa.me/${selectedOrder.customerWhatsapp.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-600 font-bold underline flex items-center gap-1"
                  >
                    <MessageSquare className="w-3 h-3" />
                    {selectedOrder.customerWhatsapp}
                  </a>
                </div>
                <div>
                  <span className="text-gray-400 block">Medio de Pago:</span>
                  <strong className="text-gray-900">
                    {selectedOrder.paymentMethod === 'transfer' ? 'Transferencia Bancaria' : 'Efectivo'}
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
                  <div className="pt-2 text-gray-700 space-y-0.5 border-t border-blue-100/80">
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
                <span className="font-bold text-gray-800 block text-xs">
                  Productos del Pedido ({selectedOrder.items.reduce((acc, it) => acc + it.quantity, 0)} u.):
                </span>
                <div className="divide-y divide-gray-100">
                  {selectedOrder.items.map((it) => {
                    const variantSuffix = it.variantText ? `, ${it.variantText}` : '';
                    const pricingSuffix = ` (${it.isWholesale ? 'Mayorista' : 'Minorista'})`;
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
                              {variantSuffix ? variantSuffix.replace(/^, /, '') : ''}
                              {pricingSuffix} - ${it.unitPrice.toLocaleString('es-AR')} c/u
                            </span>
                          </div>
                        </div>
                        <strong className="text-gray-900 shrink-0 text-xs font-bold text-right">
                          ${it.totalPrice.toLocaleString('es-AR')}
                        </strong>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Pricing Totals */}
              <div className="border-t border-gray-200 pt-2 space-y-1">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal:</span>
                  <span>${selectedOrder.subtotal.toLocaleString('es-AR')}</span>
                </div>
                {selectedOrder.wholesaleDiscount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>Ahorro Mayorista:</span>
                    <span>-${selectedOrder.wholesaleDiscount.toLocaleString('es-AR')}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-600">
                  <span>Costo de Envío:</span>
                  <span>
                    {selectedOrder.shippingCost === 0
                      ? 'Gratis'
                      : `$${selectedOrder.shippingCost.toLocaleString('es-AR')}`}
                  </span>
                </div>
                {selectedOrder.cashDiscount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-semibold">
                    <span>Descuento Efectivo:</span>
                    <span>-${selectedOrder.cashDiscount.toLocaleString('es-AR')}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm text-gray-900 pt-2 border-t">
                  <span>Total Final:</span>
                  <span className="text-[#0058bb] text-base">${selectedOrder.total.toLocaleString('es-AR')}</span>
                </div>
              </div>
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

                <button
                  type="button"
                  disabled={isResendingOrderEmail}
                  onClick={async () => {
                    setIsResendingOrderEmail(true);
                    try {
                      const emailResult = await sendOrderEmails(selectedOrder);
                      await updateOrderEmailStatus(selectedOrder.id, emailResult.customerSuccess, emailResult.adminSuccess);
                      alert(`✓ Emails de notificación reenviados para el Pedido #${selectedOrder.orderNumber}`);
                    } catch (err: any) {
                      alert(`✕ Error al reenviar: ${err.message}`);
                    } finally {
                      setIsResendingOrderEmail(false);
                    }
                  }}
                  className="bg-blue-50 hover:bg-blue-100 text-[#0058bb] border border-blue-200 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Mail className="w-3.5 h-3.5" />
                  {isResendingOrderEmail ? 'Reenviando...' : 'Reenviar Notificaciones'}
                </button>
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
    </div>
  );
};
