import React, { useMemo } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { ArrowLeft, ShoppingBag } from 'lucide-react';
import { Product, Category, SizeVariant, Order } from '../../types';
import { slugifyCategory, isObsoleteDefaultCategory } from '../../utils/categoryHelpers';
import { ProductDetailView } from '../ProductDetailView';
import { CategoryView } from '../CategoryView';
import { OrderConfirmationView } from '../OrderConfirmationView';
import { InfoPageView } from '../InfoPageView';

// Route wrapper for Product Detail (/producto/:productId)
export function ProductDetailRouteWrapper({
  products,
  isLoadingData,
  selectedProductVariants,
  selectedProductImage,
  previousView,
  onGoToCart,
  onAddToCart,
  onBuyNow,
  onSelectRelated,
}: {
  products: Product[];
  isLoadingData: boolean;
  selectedProductVariants?: Record<string, string>;
  selectedProductImage?: string;
  previousView?: string;
  onGoToCart: () => void;
  onAddToCart: (
    product: Product,
    selectedColor?: string,
    selectedSizeVariant?: SizeVariant,
    quantity?: number,
    selectedImage?: string,
    selectedVariants?: Record<string, string>,
    notify?: boolean
  ) => void;
  onBuyNow: (
    product: Product,
    selectedColor?: string,
    selectedSizeVariant?: SizeVariant,
    quantity?: number,
    selectedImage?: string,
    selectedVariants?: Record<string, string>
  ) => void;
  onSelectRelated: (product: Product, variants?: Record<string, string>, img?: string) => void;
}) {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();

  const product = useMemo(() => {
    return products.find((p) => String(p.id) === String(productId));
  }, [products, productId]);

  if (isLoadingData && products.length === 0) {
    return (
      <div className="max-w-[1240px] mx-auto px-4 py-12 animate-pulse">
        <div className="h-6 w-36 bg-gray-200 rounded mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 aspect-square bg-gray-200 rounded-2xl" />
          <div className="lg:col-span-5 space-y-4">
            <div className="h-8 bg-gray-200 rounded w-3/4" />
            <div className="h-6 bg-gray-200 rounded w-1/3" />
            <div className="h-28 bg-gray-200 rounded" />
            <div className="h-14 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-[1240px] mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-50 flex items-center justify-center text-[#0058bb]">
          <ShoppingBag className="w-8 h-8" />
        </div>
        <h2 className="text-xl md:text-2xl font-black text-gray-900 mb-2 font-['Montserrat']">
          Producto no disponible
        </h2>
        <p className="text-sm text-gray-600 mb-6 max-w-md mx-auto">
          El artículo que estás buscando no se encuentra disponible en el catálogo o cambió de enlace.
        </p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#0058bb] hover:bg-blue-800 text-white rounded-xl font-bold text-sm transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver al catálogo</span>
        </button>
      </div>
    );
  }

  const handleBack = () => {
    if (previousView === 'quick_buy') {
      navigate('/compra-rapida');
    } else if (previousView === 'cart') {
      navigate('/carrito');
    } else if (product.category) {
      navigate(`/categoria/${slugifyCategory(product.category)}`);
    } else {
      navigate('/');
    }
  };

  return (
    <ProductDetailView
      product={product}
      allProducts={products}
      initialSelectedVariants={selectedProductVariants}
      initialSelectedImage={selectedProductImage}
      backLabel={
        previousView === 'quick_buy'
          ? 'Volver a Compra Rápida'
          : previousView === 'cart'
          ? 'Volver al carrito'
          : undefined
      }
      onBack={handleBack}
      onGoToCart={onGoToCart}
      onAddToCart={onAddToCart}
      onBuyNow={onBuyNow}
      onSelectRelated={onSelectRelated}
    />
  );
}

// Route wrapper for Category view (/categoria/:categorySlug)
export function CategoryRouteWrapper({
  products,
  categories,
  isLoadingData,
  onSelectProduct,
  onGoHome,
}: {
  products: Product[];
  categories: Category[];
  isLoadingData?: boolean;
  onSelectProduct: (product: Product, variants?: Record<string, string>, img?: string) => void;
  onGoHome: () => void;
}) {
  const { categorySlug } = useParams<{ categorySlug: string }>();
  const navigate = useNavigate();

  if (categorySlug === 'todo' || categorySlug === 'todos' || (categorySlug && isObsoleteDefaultCategory(categorySlug))) {
    return <Navigate to="/" replace />;
  }

  const resolvedCategoryName = useMemo(() => {
    if (!categorySlug) return 'Todo';
    const cleanSlug = categorySlug.toLowerCase();

    // 1. Check custom categories
    const foundInCategories = categories.find(
      (c) => slugifyCategory(c.name) === cleanSlug || c.slug?.toLowerCase() === cleanSlug
    );
    if (foundInCategories) return foundInCategories.name;

    // 2. Check product categories
    const foundInProducts = products.find(
      (p) => slugifyCategory(p.category) === cleanSlug || (p.subcategory && slugifyCategory(p.subcategory) === cleanSlug)
    );
    if (foundInProducts) {
      if (slugifyCategory(foundInProducts.category) === cleanSlug) {
        return foundInProducts.category;
      }
      if (foundInProducts.subcategory && slugifyCategory(foundInProducts.subcategory) === cleanSlug) {
        return foundInProducts.subcategory;
      }
    }

    // Fallback: format slug nicely
    return decodeURIComponent(categorySlug)
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());
  }, [categorySlug, categories, products]);

  return (
    <CategoryView
      categoryName={resolvedCategoryName}
      products={products}
      categories={categories}
      isLoadingData={isLoadingData}
      onSelectProduct={onSelectProduct}
      onBack={onGoHome}
      onSelectCategory={(cat) => {
        if (cat === 'Todo') {
          onGoHome();
        } else {
          navigate(`/categoria/${slugifyCategory(cat)}`);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }}
    />
  );
}

// Route wrapper for Order Confirmation view (/confirmacion)
export function ConfirmationRouteWrapper({
  lastOrder,
  onContinueShopping,
}: {
  lastOrder: Order | null;
  onContinueShopping: () => void;
}) {
  if (!lastOrder) {
    return <Navigate to="/" replace />;
  }

  return (
    <OrderConfirmationView
      order={lastOrder}
      onContinueShopping={onContinueShopping}
    />
  );
}

// Route wrapper for Info Page view (/informacion/:sectionId)
export function InfoPageRouteWrapper({
  onGoHome,
  onOpenQuickBuy,
}: {
  onGoHome: () => void;
  onOpenQuickBuy: () => void;
}) {
  const { sectionId } = useParams<{ sectionId?: string }>();
  const navigate = useNavigate();

  return (
    <InfoPageView
      targetSection={sectionId}
      onGoHome={onGoHome}
      onOpenQuickBuy={onOpenQuickBuy}
      onSectionChange={(id) => navigate(`/informacion/${id}`, { replace: true })}
    />
  );
}
