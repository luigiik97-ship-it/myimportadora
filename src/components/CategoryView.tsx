import React, { useState, useMemo } from 'react';
import { Product, Category } from '../types';
import { getStorefrontCategories, filterProductsByCategory, slugifyCategory } from '../utils/categoryHelpers';
import { isProductCompletelyOutOfStock } from '../utils/variantHelpers';
import { ArrowLeft, Search, SlidersHorizontal, Sparkles, ShoppingBag, ArrowRight } from 'lucide-react';
import { ImageWithSkeleton } from './common/ImageWithSkeleton';
import { getOptimizedImageUrl } from '../utils/imageOptimizer';
import { ProductGridSkeleton } from './common/ProductCardSkeleton';
import { ProductCardPrice } from './common/ProductCardPrice';
import { ProductCardBadge } from './common/ProductCardBadge';

interface CategoryViewProps {
  categoryName: string;
  products: Product[];
  categories?: Category[];
  isLoadingData?: boolean;
  onSelectProduct: (product: Product) => void;
  onBack: () => void;
  onSelectCategory: (category: string) => void;
}

export const CategoryView: React.FC<CategoryViewProps> = ({
  categoryName,
  products,
  categories = [],
  isLoadingData = false,
  onSelectProduct,
  onBack,
  onSelectCategory,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recommended' | 'price-asc' | 'price-desc' | 'best-sellers'>('recommended');

  // Extract all visible storefront categories for quick navigation pills
  const storefrontCategories = useMemo(
    () => getStorefrontCategories(categories, products),
    [categories, products]
  );

  // 1. Filter products belonging dynamically to this category or subcategory from database
  const categoryProducts = useMemo(() => {
    return filterProductsByCategory(products, categoryName);
  }, [products, categoryName]);

  // Find current category object (to get its independent image and description)
  const currentCatObj = useMemo(() => {
    const targetClean = categoryName.trim().toLowerCase();
    const targetSlug = slugifyCategory(categoryName);
    const found =
      storefrontCategories.find(
        (c) =>
          c.name.toLowerCase() === targetClean ||
          c.slug.toLowerCase() === targetSlug ||
          slugifyCategory(c.name) === targetSlug
      ) ||
      categories.find(
        (c) =>
          c.name.toLowerCase() === targetClean ||
          c.slug.toLowerCase() === targetSlug ||
          slugifyCategory(c.name) === targetSlug
      );

    if (found?.image) return found;
    const prodWithImg = categoryProducts.find((p) => p.images && p.images.length > 0);
    if (prodWithImg?.images?.[0]) {
      return { ...(found || {}), image: prodWithImg.images[0] } as Partial<Category>;
    }
    return found;
  }, [storefrontCategories, categories, categoryName, categoryProducts]);

  // 2. Apply search within this category and sorting
  const displayedProducts = useMemo(() => {
    let result = categoryProducts.filter((p) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        (p.subcategory && p.subcategory.toLowerCase().includes(q))
      );
    });

    switch (sortBy) {
      case 'price-asc':
        result.sort((a, b) => a.wholesalePrice - b.wholesalePrice);
        break;
      case 'price-desc':
        result.sort((a, b) => b.wholesalePrice - a.wholesalePrice);
        break;
      case 'best-sellers':
        result.sort((a, b) => (b.isBestSeller ? 1 : 0) - (a.isBestSeller ? 1 : 0));
        break;
      default:
        break;
    }

    return result;
  }, [categoryProducts, searchQuery, sortBy]);

  return (
    <div className="max-w-[1240px] mx-auto px-2 sm:px-4 py-2 sm:py-3 space-y-1.5 sm:space-y-2.5 animate-fadeIn">
      {/* Category Hero Header with Clean Category Image (Sin fondo negro encima) */}
      <div className="relative rounded-xl sm:rounded-2xl overflow-hidden min-h-[60px] sm:min-h-[75px] md:min-h-[85px] flex items-center p-3 sm:p-4 md:p-4.5 border border-gray-100 shadow-2xs">
        {/* Category Image Background */}
        {currentCatObj?.image ? (
          <img
            src={getOptimizedImageUrl(currentCatObj.image, { width: 1200, quality: 85 })}
            alt={categoryName}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-r from-gray-800 to-gray-900" />
        )}

        {/* Category Title & Dynamic Indicator */}
        <div className="relative z-10 flex items-center gap-2.5 sm:gap-3">
          {/* Vibrant vertical accent bar */}
          <div className="w-1.5 h-5 sm:h-7 bg-gradient-to-b from-[#ff7733] to-[#ff5500] rounded-full shrink-0 shadow-xs" />

          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black font-['Montserrat'] tracking-tight capitalize text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]">
              {categoryName}
            </h1>
            {/* El texto "1 producto disponible" / contador se mantiene oculto */}
          </div>
        </div>
      </div>

      {/* Quick Category Navigation Pills (Horizontal Row) */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs font-semibold text-gray-600">
          <span>Otras categorías</span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-0.5 no-scrollbar">
          <button
            onClick={() => onSelectCategory('Todo')}
            className={`px-3 sm:px-3.5 py-1.5 text-xs font-medium rounded-full transition-all whitespace-nowrap cursor-pointer border ${
              categoryName.toLowerCase() === 'todo'
                ? 'bg-[#0058bb] text-white border-[#0058bb] shadow-xs font-semibold'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            Ver Todo
          </button>
          {storefrontCategories.map((cat, idx) => {
            const isSelected =
              cat.name.toLowerCase() === categoryName.toLowerCase() ||
              cat.slug.toLowerCase() === slugifyCategory(categoryName);

            return (
              <button
                key={cat.id ? `${cat.id}-${idx}` : `${cat.name}-${idx}`}
                onClick={() => onSelectCategory(cat.name)}
                className={`px-3 sm:px-3.5 py-1.5 text-xs font-medium rounded-full transition-all whitespace-nowrap cursor-pointer border flex items-center gap-1.5 sm:gap-2 ${
                  isSelected
                    ? 'bg-[#0058bb] text-white border-[#0058bb] shadow-xs font-semibold'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-[#0058bb]/40'
                }`}
              >
                {cat.image && (
                  <img
                    src={getOptimizedImageUrl(cat.image, { width: 48, quality: 75 })}
                    alt={cat.name}
                    loading="lazy"
                    decoding="async"
                    className="w-4 h-4 rounded-full object-cover shrink-0"
                  />
                )}
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Search & Sort Toolbar */}
      <div className="bg-white rounded-xl border border-gray-100 sm:border-gray-200 p-2 sm:p-2.5 shadow-2xs sm:shadow-xs flex flex-row gap-2 sm:gap-3 items-center justify-between">
        {/* Search inside category */}
        <div className="relative flex-1 min-w-0 sm:w-72 md:w-80 sm:flex-initial">
          <Search className="w-4 h-4 text-gray-400 absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Buscar en ${categoryName}...`}
            className="w-full pl-8 sm:pl-9 pr-6 sm:pr-7 py-1.5 sm:py-1.5 text-xs md:text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0058bb] focus:bg-white transition-all truncate"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold cursor-pointer"
            >
              ×
            </button>
          )}
        </div>

        {/* Sort Select */}
        <div className="flex items-center gap-1.5 sm:gap-2 w-auto shrink-0 justify-end">
          <SlidersHorizontal className="w-3.5 h-3.5 text-gray-500 shrink-0" />
          <span className="hidden sm:inline text-xs text-gray-500 font-medium shrink-0">Ordenar por:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 sm:px-2.5 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#0058bb] cursor-pointer"
          >
            <option value="recommended">Recomendados</option>
            <option value="price-asc">Menor precio</option>
            <option value="price-desc">Mayor precio</option>
            <option value="best-sellers">Más vendidos</option>
          </select>
        </div>
      </div>

      {/* Products Grid */}
      {isLoadingData && displayedProducts.length === 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3 md:gap-3.5">
          <ProductGridSkeleton count={10} />
        </div>
      ) : displayedProducts.length === 0 ? (
        <div className="text-center py-10 sm:py-14 bg-white rounded-xl border-0 sm:border border-gray-200 p-6 sm:p-8 space-y-3 shadow-xs">
          <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto" />
          <h3 className="text-base font-bold text-gray-800">
            No se encontraron productos en &ldquo;{categoryName}&rdquo;
          </h3>
          <p className="text-xs sm:text-sm text-gray-500 max-w-md mx-auto">
            {searchQuery
              ? `No hay resultados para "${searchQuery}". Intenta con otro término o limpia el buscador.`
              : 'Esta categoría aún no tiene productos registrados en la base de datos.'}
          </p>
          <div className="pt-2 flex items-center justify-center gap-3">
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery('')}
                className="text-xs font-semibold px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all cursor-pointer"
              >
                Limpiar búsqueda
              </button>
            ) : null}
            <button
              onClick={onBack}
              className="text-xs font-semibold px-4 py-2 bg-[#0058bb] text-white rounded-lg hover:bg-[#004494] transition-all cursor-pointer"
            >
              Volver al inicio
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3 md:gap-3.5">
          {displayedProducts.map((product) => {
            const isOutOfStock = isProductCompletelyOutOfStock(product);

            return (
              <div
                key={product.id}
                id={`category-product-${product.id}`}
                onClick={() => onSelectProduct(product)}
                className="group bg-white rounded-xl border border-gray-100 sm:border-gray-200/90 overflow-hidden shadow-2xs hover:shadow-lg hover:border-[#0058bb]/50 transition-all cursor-pointer flex flex-col"
              >
                {/* Thumbnail with object-cover and zero margin */}
                <div className="relative aspect-square w-full bg-gray-100 flex items-center justify-center overflow-hidden border-b border-gray-100">
                  <ImageWithSkeleton
                    src={(product.images && product.images[0]) || 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=400'}
                    alt={product.title}
                    targetWidth={480}
                    quality={75}
                    className={`w-full h-full object-cover ${
                      isOutOfStock ? 'opacity-60 grayscale-[30%]' : 'group-hover:scale-105'
                    } transition-transform duration-300`}
                  />
                  <ProductCardBadge product={product} />
                  {isOutOfStock && (
                    <span className="absolute top-2 right-2 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded shadow-xs z-10">
                      Sin stock
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="px-2 py-2 sm:px-2.5 sm:py-3 flex-1 flex flex-col justify-between space-y-1 sm:space-y-1.5">
                  <h3 className="text-xs sm:text-sm font-semibold text-gray-800 line-clamp-2 leading-snug group-hover:text-[#0058bb] transition-colors">
                    {product.title}
                  </h3>
                  <ProductCardPrice product={product} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
