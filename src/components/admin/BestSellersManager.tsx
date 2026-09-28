import React, { useState, useMemo } from 'react';
import { Product } from '../../types';
import { Search, X, Check, Flame, Clock, Filter, AlertCircle, ArrowUpDown } from 'lucide-react';
import { ProductCardBadge } from '../common/ProductCardBadge';

interface BestSellersManagerProps {
  products: Product[];
  onToggleBestSeller: (product: Product) => Promise<void> | void;
  isUpdatingId?: string | null;
}

export const BestSellersManager: React.FC<BestSellersManagerProps> = ({
  products,
  onToggleBestSeller,
  isUpdatingId = null,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'marked' | 'unmarked'>('all');

  // Conteo de productos
  const bestSellersCount = useMemo(() => {
    return products.filter((p) => Boolean(p.isBestSeller)).length;
  }, [products]);

  const unmarkedCount = products.length - bestSellersCount;

  // Filtrado de productos por búsqueda y pestaña
  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      // Filtro de búsqueda por nombre, categoría o ID
      const matchesSearch =
        !searchTerm.trim() ||
        prod.title.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
        prod.category.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
        (prod.subcategory && prod.subcategory.toLowerCase().includes(searchTerm.toLowerCase().trim()));

      if (!matchesSearch) return false;

      if (filterMode === 'marked') {
        return Boolean(prod.isBestSeller);
      }
      if (filterMode === 'unmarked') {
        return !prod.isBestSeller;
      }

      return true;
    });
  }, [products, searchTerm, filterMode]);

  return (
    <div className="space-y-6">
      {/* Encabezado y Explicación de la Sección */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <Flame className="w-5 h-5 fill-amber-500/20" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                Gestión de Más Vendidos
              </h2>
            </div>
            <p className="text-sm text-gray-600 max-w-2xl">
              Marcá con una palomita <span className="font-semibold text-emerald-700">✓</span> los productos que pertenecen a la sección <span className="font-semibold">“Más vendidos”</span>. Los productos marcados son los únicos que aparecerán en la tienda.
            </p>
          </div>

          {/* Badges de Información y Regla de 24 Horas */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold text-emerald-800">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>{bestSellersCount} {bestSellersCount === 1 ? 'producto activo' : 'productos activos'}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium text-blue-800" title="El orden se baraja automáticamente cada 24 horas y se mantiene igual durante ese periodo">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>Rotación aleatoria: cada 24 hs</span>
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Búsqueda y Filtros Rápidos */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Input de búsqueda por nombre */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar producto por nombre o categoría..."
              className="w-full pl-10 pr-9 py-2.5 bg-gray-50 hover:bg-gray-100/60 focus:bg-white text-sm text-gray-900 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0058bb]/30 focus:border-[#0058bb] transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer p-0.5"
                title="Limpiar búsqueda"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filtros de estado */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                filterMode === 'all'
                  ? 'bg-gray-900 text-white shadow-2xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
              }`}
            >
              Todos ({products.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('marked')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                filterMode === 'marked'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              <span>En Más Vendidos ({bestSellersCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('unmarked')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                filterMode === 'unmarked'
                  ? 'bg-gray-700 text-white shadow-2xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Sin marcar ({unmarkedCount})
            </button>
          </div>
        </div>

        {/* Resumen del filtro actual */}
        {searchTerm && (
          <div className="flex items-center gap-2 text-xs text-gray-500 pt-1 border-t border-gray-100">
            <span>Resultados para «{searchTerm}»: {filteredProducts.length} {filteredProducts.length === 1 ? 'producto encontrado' : 'productos encontrados'}</span>
          </div>
        )}
      </div>

      {/* Listado de Productos */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-2xs overflow-hidden">
        {filteredProducts.length === 0 ? (
          <div className="p-8 sm:p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-400 mx-auto flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-gray-900">
                {searchTerm
                  ? 'No se encontraron productos'
                  : filterMode === 'marked'
                  ? 'No hay productos marcados en Más Vendidos'
                  : 'No hay productos para mostrar'}
              </h3>
              <p className="text-xs sm:text-sm text-gray-500 max-w-md mx-auto">
                {searchTerm
                  ? 'Probá buscando con otro nombre o limpiá el filtro de búsqueda.'
                  : filterMode === 'marked'
                  ? 'Hacé clic en la palomita de cualquier producto para agregarlo a la sección Más vendidos.'
                  : 'Todos los productos ya se encuentran incluidos.'}
              </p>
            </div>
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0058bb] hover:underline cursor-pointer"
              >
                Limpiar búsqueda
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredProducts.map((prod) => {
              const isSelected = Boolean(prod.isBestSeller);
              const isProcessing = isUpdatingId === prod.id;
              const imageSrc =
                (prod.images && prod.images[0]) ||
                'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=150';

              return (
                <div
                  key={prod.id}
                  className={`p-3.5 sm:p-4 flex items-center justify-between gap-3 sm:gap-4 transition-colors ${
                    isSelected ? 'bg-emerald-50/40 hover:bg-emerald-50/70' : 'hover:bg-gray-50/80'
                  }`}
                >
                  {/* Izquierda: Palomita de selección + Miniatura + Datos del producto */}
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                    {/* Botón de Palomita (Checkbox interactivo grande) */}
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={isSelected}
                      disabled={isProcessing}
                      onClick={() => onToggleBestSeller(prod)}
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl border flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#16a34a] border-[#16a34a] text-white shadow-xs'
                          : 'bg-white border-gray-300 hover:border-[#16a34a] text-transparent hover:text-gray-300'
                      } ${isProcessing ? 'opacity-50 cursor-wait' : ''}`}
                      title={isSelected ? 'Hacé clic para quitar de Más vendidos' : 'Hacé clic para incluir en Más vendidos'}
                    >
                      <Check className={`w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5] ${isSelected ? 'text-white' : 'text-gray-300'}`} />
                    </button>

                    {/* Miniatura del producto */}
                    <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gray-100 border border-gray-200 overflow-hidden shrink-0">
                      <img
                        src={imageSrc}
                        alt={prod.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <ProductCardBadge product={prod} />
                    </div>

                    {/* Información del producto */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4
                          onClick={() => onToggleBestSeller(prod)}
                          className="font-bold text-gray-900 text-xs sm:text-sm line-clamp-1 cursor-pointer hover:text-[#0058bb] transition-colors"
                        >
                          {prod.title}
                        </h4>
                        {isSelected && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100/90 border border-emerald-300 px-2 py-0.5 rounded-md shrink-0">
                            <Flame className="w-3 h-3 text-emerald-600" />
                            En Más Vendidos
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 sm:gap-3 text-xs text-gray-500 mt-0.5 flex-wrap">
                        <span className="bg-gray-100 text-gray-700 font-medium px-2 py-0.5 rounded text-[11px]">
                          {prod.category} {prod.subcategory ? `› ${prod.subcategory}` : ''}
                        </span>
                        <span className="font-semibold text-gray-900">
                          Mayorista: ${(prod.wholesalePrice || 0).toLocaleString('es-AR')}
                        </span>
                        <span className="text-gray-600 hidden sm:inline">
                          Minorista: ${(prod.retailPrice || 0).toLocaleString('es-AR')}
                        </span>
                        {prod.stock !== undefined && (
                          <span className={`text-[11px] font-medium ${prod.stock <= 5 ? 'text-amber-600 font-bold' : 'text-gray-500'}`}>
                            Stock: {prod.stock}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Derecha: Botón de acción explícito */}
                  <div className="shrink-0 flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => onToggleBestSeller(prod)}
                      className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer select-none flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
                          : 'bg-[#16a34a] hover:bg-[#15803d] text-white shadow-xs'
                      } ${isProcessing ? 'opacity-50 cursor-wait' : ''}`}
                    >
                      {isSelected ? (
                        <>
                          <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          <span className="hidden sm:inline">Quitar</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
                          <span>Incluir</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
