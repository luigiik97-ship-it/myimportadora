import React, { useMemo } from 'react';
import { Heart, ShoppingBag, LogIn } from 'lucide-react';
import { Product, UserProfile } from '../types';
import { useFavorites } from '../hooks/useFavorites';
import { ImageWithSkeleton } from './common/ImageWithSkeleton';
import { ProductCardBadge } from './common/ProductCardBadge';
import { ProductCardPrice } from './common/ProductCardPrice';
import { ProductGridSkeleton } from './common/ProductCardSkeleton';
import { getProductCoverImage, isProductCompletelyOutOfStock } from '../utils/variantHelpers';

export interface FavoritesViewProps {
  products: Product[];
  isLoadingData?: boolean;
  onSelectProduct: (product: Product, selectedVariants?: Record<string, string>, selectedImage?: string) => void;
  onGoHome: () => void;
  onOpenQuickBuy?: () => void;
  currentUser?: UserProfile | null;
  onOpenAuth: () => void;
}

export const FavoritesView: React.FC<FavoritesViewProps> = ({
  products,
  isLoadingData = false,
  onSelectProduct,
  onGoHome,
  onOpenQuickBuy,
  currentUser,
  onOpenAuth,
}) => {
  const { favorites, toggleFavorite, isFavorite } = useFavorites(currentUser, onOpenAuth);

  // Filtrar productos guardados en favoritos ordenados por llegada (la última agregada aparece primera)
  const favoritedProducts = useMemo(() => {
    if (!favorites || favorites.length === 0) return [];
    const productMap = new Map<string, Product>();
    products.forEach((p) => productMap.set(String(p.id), p));

    return favorites
      .map((favId) => productMap.get(String(favId)))
      .filter((p): p is Product => p !== undefined);
  }, [products, favorites]);

  return (
    <div className="min-h-screen bg-[#fbf9f8] text-[#1b1c1c] pb-24 w-full max-w-full overflow-x-clip">
      {/* Header Banner */}
      <div className="bg-white border-b border-gray-200 shadow-2xs">
        <div className="max-w-[1240px] mx-auto px-2 sm:px-4 py-3 sm:py-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Left: Title */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 sm:gap-2.5">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center border border-rose-100 shadow-2xs shrink-0">
                  <Heart className="w-4 h-4 sm:w-5 sm:h-5 fill-rose-500" />
                </div>
                <div>
                  <h1 className="text-lg sm:text-2xl font-black font-['Montserrat'] tracking-tight text-gray-900 flex items-center gap-2">
                    <span>Mis favoritos</span>
                  </h1>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-gray-500 leading-snug">
                Tus publicaciones favoritas guardadas
                <br />
                agrega y quita publicaciones apretando el icono de corazón
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-[1240px] mx-auto px-2 sm:px-4 py-4 sm:py-6">
        {isLoadingData ? (
          <ProductGridSkeleton count={8} />
        ) : !currentUser ? (
          /* Estado sin sesión iniciada */
          <div className="max-w-md mx-auto my-8 sm:my-16 bg-white rounded-2xl border border-gray-200/90 p-6 sm:p-8 text-center shadow-xs space-y-4">
            <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto border border-rose-100 shadow-2xs">
              <Heart className="w-8 h-8 fill-rose-500" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg sm:text-xl font-bold font-['Montserrat'] text-gray-900">
                Iniciá sesión para ver tus favoritos
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">
                Guardá tus productos habituales y encontralos siempre sincronizados entre tu teléfono y tu computadora.
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                id="favorites-login-btn"
                onClick={onOpenAuth}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 sm:py-3 bg-[#0058bb] hover:bg-[#004bb0] text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-all cursor-pointer active:scale-95"
              >
                <LogIn className="w-4 h-4" />
                <span>Iniciar sesión</span>
              </button>
            </div>
          </div>
        ) : favoritedProducts.length === 0 ? (
          /* Estado con sesión pero sin favoritos guardados */
          <div className="max-w-md mx-auto my-8 sm:my-16 bg-white rounded-2xl border border-gray-200/90 p-6 sm:p-8 text-center shadow-xs space-y-4">
            <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto border border-rose-100 shadow-2xs">
              <Heart className="w-8 h-8 text-rose-500" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg sm:text-xl font-bold font-['Montserrat'] text-gray-900">
                Aún no tenés productos en favoritos
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">
                Tocá el ícono de corazón en cualquier producto o en Compra rápida para guardarlo aquí y tenerlo siempre a mano.
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                id="favorites-explore-btn"
                onClick={onGoHome}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 sm:py-3 bg-[#0058bb] hover:bg-[#004bb0] text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-all cursor-pointer active:scale-95"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Explorar catálogo</span>
              </button>
            </div>
          </div>
        ) : (
          /* Grid de Productos Favoritos */
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-4 md:gap-5">
              {favoritedProducts.map((product) => {
                const isOutOfStock = isProductCompletelyOutOfStock(product);
                const coverImage = getProductCoverImage(product);
                const favorited = isFavorite(product.id);

                return (
                  <div
                    key={product.id}
                    id={`favorites-product-${product.id}`}
                    onClick={() => onSelectProduct(product)}
                    className="group bg-white rounded-xl border border-gray-100 sm:border-gray-200/90 overflow-hidden shadow-2xs hover:shadow-lg hover:border-[#0058bb]/50 transition-all cursor-pointer flex flex-col relative"
                  >
                    {/* Botón de Quitar / Alternar Favorito */}
                    <button
                      type="button"
                      id={`fav-toggle-btn-${product.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(product.id);
                      }}
                      className="absolute top-2 right-2 z-20 w-8 h-8 rounded-full bg-white/95 hover:bg-white active:scale-90 text-rose-500 flex items-center justify-center shadow-md border border-gray-100 transition-all cursor-pointer"
                      title={favorited ? 'Quitar de favoritos' : 'Guardar en favoritos'}
                      aria-label={favorited ? 'Quitar de favoritos' : 'Guardar en favoritos'}
                    >
                      <Heart className={`w-4 h-4 ${favorited ? 'fill-rose-500 text-rose-500' : 'text-gray-400'}`} />
                    </button>

                    {/* Thumbnail */}
                    <div className="relative aspect-square w-full bg-gray-100 flex items-center justify-center overflow-hidden border-b border-gray-100">
                      <ImageWithSkeleton
                        src={coverImage}
                        alt={product.title}
                        targetWidth={480}
                        quality={75}
                        className={`w-full h-full object-cover ${
                          isOutOfStock ? 'opacity-60 grayscale-[30%]' : 'group-hover:scale-105'
                        } transition-transform duration-300`}
                      />
                      <ProductCardBadge product={product} />
                      {isOutOfStock && (
                        <span className="absolute top-2 left-2 bg-red-600 text-white text-[11px] font-bold px-2 py-0.5 rounded shadow-xs z-10">
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
          </div>
        )}
      </div>
    </div>
  );
};
