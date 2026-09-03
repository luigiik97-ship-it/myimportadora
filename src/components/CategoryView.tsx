import React, { useState, useMemo } from 'react';
import { Product, Category } from '../types';
import { getStorefrontCategories, filterProductsByCategory, slugifyCategory } from '../utils/categoryHelpers';
import { isProductCompletelyOutOfStock } from '../utils/variantHelpers';
import { ArrowLeft, Search, SlidersHorizontal, Sparkles, ShoppingBag, ArrowRight } from 'lucide-react';
import { ImageWithSkeleton } from './common/ImageWithSkeleton';
import { ProductGridSkeleton } from './common/ProductCardSkeleton';

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

  // Find current category object (to get its independent image and description)
  const currentCatObj = useMemo(() => {
    const targetClean = categoryName.trim().toLowerCase();
    const targetSlug = slugifyCategory(categoryName);
    return categories.find(
      (c) =>
        c.name.toLowerCase() === targetClean ||
        c.slug.toLowerCase() === targetSlug ||
        slugifyCategory(c.name) === targetSlug
    );
  }, [categories, categoryName]);

  // 1. Filter products belonging dynamically to this category or subcategory from database
  const categoryProducts = useMemo(() => {
    return filterProductsByCategory(products, categoryName);
  }, [products, categoryName]);

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
    <div className="max-w-[1240px] mx-auto px-4 py-6 space-y-8 animate-fadeIn">
      {/* Breadcrumb Navigation & Back button */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-3">
        <div className="flex items-center gap-2 text-xs md:text-sm text-gray-500">
          <button
            onClick={onBack}
            className="hover:text-[#0058bb] font-medium transition-colors flex items-center gap-1 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Inicio</span>
          </button>
          <span>/</span>
          <span className="text-gray-400">Categorías</span>
          <span>/</span>
          <span className="font-semibold text-gray-900 capitalize">{categoryName}</span>
        </div>
      </div>

      {/* Category Hero Header with Full Background Category Image */}
      <div className="bg-gray-950 rounded-2xl p-6 md:p-8 text-white shadow-md relative overflow-hidden flex flex-col justify-center min-h-[160px] md:min-h-[180px]">
        {/* Full Background Category Image with 50% opacity */}
        {(currentCatObj?.image || categoryProducts[0]?.images?.[0]) && (
          <div className="absolute inset-0 pointer-events-none">
            <img
              src={currentCatObj?.image || categoryProducts[0]?.images?.[0]}
              alt={categoryName}
              className="w-full h-full object-cover opacity-50"
            />
            {/* Subtle gradient overlay to enhance text readability */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
          </div>
        )}

        <div className="relative z-10 max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-xs text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
            <span>Categoría de Productos</span>
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black font-['Montserrat'] tracking-tight capitalize text-white drop-shadow-xs">
            {categoryName}
          </h1>

          <p className="text-sm md:text-base text-gray-100 font-medium max-w-xl drop-shadow-xs">
            {currentCatObj?.description ||
              `Mostrando todos los productos disponibles en ${categoryName} con precios mayoristas directos de fábrica.`}
          </p>
        </div>
      </div>

      {/* Quick Category Navigation Pills (Horizontal Row) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-gray-600">
          <span>Otras categorías</span>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
          <button
            onClick={() => onSelectCategory('Todo')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-full transition-all whitespace-nowrap cursor-pointer border ${
              categoryName.toLowerCase() === 'todo'
                ? 'bg-[#0058bb] text-white border-[#0058bb] shadow-xs font-semibold'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            Ver Todo
          </button>
          {storefrontCategories.map((cat) => {
            const isSelected =
              cat.name.toLowerCase() === categoryName.toLowerCase() ||
              cat.slug.toLowerCase() === slugifyCategory(categoryName);

            return (
              <button
                key={cat.id || cat.name}
                onClick={() => onSelectCategory(cat.name)}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-full transition-all whitespace-nowrap cursor-pointer border flex items-center gap-2 ${
                  isSelected
                    ? 'bg-[#0058bb] text-white border-[#0058bb] shadow-xs font-semibold'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-[#0058bb]/40'
                }`}
              >
                {cat.image && (
                  <img
                    src={cat.image}
                    alt={cat.name}
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
      <div className="bg-white rounded-xl border border-gray-200 p-3.5 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        {/* Search inside category */}
        <div className="relative w-full sm:w-72 md:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Buscar en ${categoryName}...`}
            className="w-full pl-9 pr-3 py-1.5 text-xs md:text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0058bb] focus:bg-white transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold"
            >
              ×
            </button>
          )}
        </div>

        {/* Sort Select */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <SlidersHorizontal className="w-3.5 h-3.5 text-gray-500 shrink-0" />
          <span className="text-xs text-gray-500 font-medium shrink-0">Ordenar por:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#0058bb]"
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
          <ProductGridSkeleton count={10} />
        </div>
      ) : displayedProducts.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200 p-8 space-y-3 shadow-xs">
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
          {displayedProducts.map((product) => {
            const isOutOfStock = isProductCompletelyOutOfStock(product);

            return (
              <div
                key={product.id}
                id={`category-product-${product.id}`}
                onClick={() => onSelectProduct(product)}
                className="group bg-white rounded-xl border border-gray-200/90 overflow-hidden shadow-xs hover:shadow-lg hover:border-[#0058bb]/50 transition-all cursor-pointer flex flex-col"
              >
                {/* Thumbnail with object-cover and zero margin */}
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
                <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2">
                  <h3 className="text-sm font-semibold text-gray-800 line-clamp-2 leading-snug group-hover:text-[#0058bb] transition-colors">
                    {product.title}
                  </h3>

                  <div className="pt-1">
                    {/* Wholesale Price Highlight */}
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span className="text-lg md:text-xl font-bold text-gray-900 font-['Montserrat']">
                        ${product.wholesalePrice.toLocaleString('es-AR')}
                      </span>
                      {isOutOfStock ? (
                        <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">
                          Sin stock
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-[#00a650]">
                          min. {product.minWholesaleQty} u.
                        </span>
                      )}
                    </div>
                    {/* Retail comparison */}
                    <div className="text-xs text-gray-500 font-medium mt-0.5">
                      ${product.retailPrice.toLocaleString('es-AR')} x1 unidad
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
