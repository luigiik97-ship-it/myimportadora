import React from 'react';
import { CartItem, Product } from '../types';
import { Trash2, Plus, Minus, ArrowRight, ArrowLeft, ShieldCheck, Truck, ShoppingBag, Info, CheckCircle2 } from 'lucide-react';
import { getItemEffectiveNormalPrice, getSelectedVariantStock } from '../utils/variantHelpers';

interface CartViewProps {
  cartItems: CartItem[];
  onUpdateQuantity: (id: string, delta: number) => void;
  onRemoveItem: (id: string) => void;
  onProceedToCheckout: () => void;
  onContinueShopping: () => void;
  onSelectProduct?: (product: Product, selectedVariants?: Record<string, string>, selectedImage?: string) => void;
  onSelectCategory?: (category: string) => void;
}

export const CartView: React.FC<CartViewProps> = ({
  cartItems,
  onUpdateQuantity,
  onRemoveItem,
  onProceedToCheckout,
  onContinueShopping,
  onSelectProduct,
  onSelectCategory,
}) => {
  // 1. Calculate total quantity per category in cart
  const categoryQuantities: Record<string, number> = {};
  cartItems.forEach((item) => {
    const cat = item.product.category || 'General';
    categoryQuantities[cat] = (categoryQuantities[cat] || 0) + item.quantity;
  });

  // 2. Compute item prices based on whether category threshold is reached
  const processedItems = cartItems.map((item) => {
    const cat = item.product.category || 'General';
    const totalInCat = categoryQuantities[cat] || 0;
    const minQty = item.product.minWholesaleQty || 1;
    const isWholesale = totalInCat >= minQty;

    // Determine base prices from selected variant option, selected size variant or product base
    const wholesaleUnitPrice = getItemEffectiveNormalPrice(
      item.product,
      item.selectedVariants,
      item.selectedSizeVariant,
      true
    );

    const retailUnitPrice = getItemEffectiveNormalPrice(
      item.product,
      item.selectedVariants,
      item.selectedSizeVariant,
      false
    );

    const unitPrice = isWholesale ? wholesaleUnitPrice : retailUnitPrice;
    const totalPrice = unitPrice * item.quantity;
    const retailTotal = retailUnitPrice * item.quantity;
    const savings = isWholesale ? retailTotal - totalPrice : 0;
    const remainingToWholesale = Math.max(0, minQty - totalInCat);
    const availableStock = getSelectedVariantStock(item.product, item.selectedVariants || {});

    return {
      ...item,
      isWholesale,
      unitPrice,
      wholesaleUnitPrice,
      retailUnitPrice,
      totalPrice,
      savings,
      remainingToWholesale,
      minQty,
      cat,
      availableStock,
    };
  });

  const totalQuantity = processedItems.reduce((acc, i) => acc + i.quantity, 0);
  const subtotalProducts = processedItems.reduce((acc, i) => acc + i.totalPrice, 0);
  const totalSavings = processedItems.reduce((acc, i) => acc + i.savings, 0);

  if (cartItems.length === 0) {
    return (
      <div className="max-w-[1240px] mx-auto px-2 sm:px-4 py-12 sm:py-16 text-center space-y-4 sm:space-y-5">
        <div className="w-18 h-18 sm:w-20 sm:h-20 bg-blue-50 text-[#0058bb] rounded-full flex items-center justify-center mx-auto shadow-inner">
          <ShoppingBag className="w-9 h-9 sm:w-10 sm:h-10" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 font-['Montserrat']">Tu carrito está vacío</h2>
        <p className="text-xs sm:text-sm text-gray-500 max-w-md mx-auto">
          Explora nuestro catálogo mayorista y añade productos para aprovechar los mejores precios directos de fábrica.
        </p>
        <button
          onClick={onContinueShopping}
          className="bg-[#0058bb] hover:bg-[#004bb0] text-white font-bold px-6 sm:px-8 py-3 rounded-lg text-sm sm:text-base transition-colors cursor-pointer inline-flex items-center gap-2 min-h-[44px]"
        >
          Ver Catálogo Mayorista
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-[1240px] mx-auto px-1 sm:px-4 py-2 sm:py-6 space-y-3 sm:space-y-6">
      <div className="flex items-center justify-between gap-3 px-1 sm:px-0">
        <h1 id="cart-title" className="text-xl sm:text-2xl md:text-3xl font-black text-gray-900 font-['Montserrat']">
          Carrito
        </h1>
        <button
          type="button"
          id="cart-continue-shopping-top-btn"
          onClick={onContinueShopping}
          className="inline-flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-bold text-[#0058bb] hover:text-[#004bb0] bg-blue-50 hover:bg-blue-100/80 px-3 sm:px-3.5 py-2 rounded-xl transition-colors cursor-pointer min-h-[38px]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Seguir comprando</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
        {/* Left: Product List (Cols 8) - Flat native rows on mobile */}
        <div className="lg:col-span-8 divide-y divide-gray-100 md:divide-y-0 md:space-y-2.5">
          {processedItems.map((item) => {
            const variantSummary = item.selectedVariants && Object.keys(item.selectedVariants).length > 0
              ? Object.entries(item.selectedVariants)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(' | ')
              : [
                  item.selectedColor ? `Color: ${item.selectedColor}` : null,
                  item.selectedSizeVariant ? `Talle/Tamaño: ${item.selectedSizeVariant.name}` : null,
                ]
                  .filter(Boolean)
                  .join(' | ');

            const itemDisplayImage = item.selectedImage || item.product.images[0] || 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=400';

            return (
              <div
                key={item.id}
                id={`cart-item-${item.id}`}
                className="bg-transparent md:bg-white rounded-none md:rounded-xl border-0 md:border md:border-gray-200 p-1 py-3 md:p-3.5 shadow-none md:shadow-xs space-y-2"
              >
                <div className="flex gap-3 sm:gap-3.5">
                  {/* Thumbnail - Enlarged for mobile readability */}
                  <button
                    type="button"
                    onClick={() => onSelectProduct?.(item.product, item.selectedVariants, itemDisplayImage)}
                    className="w-20 h-20 sm:w-20 sm:h-20 bg-white md:bg-gray-50 rounded-xl p-1 flex items-center justify-center shrink-0 border border-gray-200/90 cursor-pointer hover:border-blue-400 transition-all focus:outline-none focus:ring-2 focus:ring-[#0058bb]/20 group/thumb self-center shadow-2xs"
                    title={`Ver detalle de ${item.product.title}`}
                  >
                    <img
                      src={itemDisplayImage}
                      alt={item.product.title}
                      className="w-full h-full object-contain group-hover/thumb:scale-105 transition-transform duration-200"
                    />
                  </button>

                  {/* Title and details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3
                        onClick={() => onSelectProduct?.(item.product, item.selectedVariants, itemDisplayImage)}
                        className="text-sm sm:text-base font-bold text-gray-900 leading-snug cursor-pointer hover:text-[#0058bb] transition-colors line-clamp-2 sm:truncate"
                        title={`Ver detalle de ${item.product.title}`}
                      >
                        {item.product.title}
                      </h3>
                      <button
                        id={`remove-item-${item.id}`}
                        onClick={() => onRemoveItem(item.id)}
                        className="text-gray-400 hover:text-red-500 p-1.5 transition-colors cursor-pointer shrink-0"
                        title="Eliminar producto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {variantSummary && (
                      <p className="text-xs text-gray-500 mt-0.5 font-medium truncate">
                        {variantSummary}
                      </p>
                    )}

                    {/* Quantity Modifier, Wholesale Tag & Line Price */}
                    <div className="flex items-center justify-between gap-1.5 sm:gap-2 mt-2 min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                        <div className="flex items-center border border-gray-300 rounded-xl bg-white overflow-hidden shadow-2xs shrink-0">
                          <button
                            onClick={() => onUpdateQuantity(item.id, -1)}
                            className="w-8 h-8 sm:w-8 sm:h-8 text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer flex items-center justify-center active:bg-gray-200"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="px-2.5 text-sm sm:text-base font-bold text-gray-900 min-w-[28px] text-center">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => onUpdateQuantity(item.id, 1)}
                            disabled={item.availableStock > 0 && item.quantity >= item.availableStock}
                            className={`w-8 h-8 sm:w-8 sm:h-8 text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer flex items-center justify-center active:bg-gray-200 ${
                              item.availableStock > 0 && item.quantity >= item.availableStock
                                ? 'opacity-40 cursor-not-allowed'
                                : ''
                            }`}
                            title={
                              item.availableStock > 0 && item.quantity >= item.availableStock
                                ? 'Stock máximo disponible alcanzado'
                                : 'Añadir unidad'
                            }
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {item.isWholesale && (
                          <span className="inline-flex items-center justify-center text-[10px] sm:text-[11px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded-full text-center leading-none overflow-hidden whitespace-nowrap [text-overflow:clip] shrink">
                            Mayorista
                          </span>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-base sm:text-lg font-bold text-gray-900 font-['Montserrat'] whitespace-nowrap block">
                          $ {item.totalPrice.toLocaleString('es-AR')}
                        </span>
                        <span className="text-xs text-gray-500 block whitespace-nowrap">
                          ($ {item.unitPrice.toLocaleString('es-AR')} c/u)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status: Pending Units (only shown when wholesale not reached) */}
                {!item.isWholesale && (
                  <div className="bg-blue-50/70 md:bg-gray-50 text-blue-950 md:text-gray-700 text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 border border-blue-100 md:border-gray-200/80">
                    <Info className="w-3.5 h-3.5 text-[#0058bb] md:text-gray-500 shrink-0" />
                    <span className="leading-snug">
                      Te faltan <strong className="text-gray-900">{item.remainingToWholesale} unidades</strong> (dentro la{' '}
                      {onSelectCategory ? (
                        <button
                          type="button"
                          onClick={() => onSelectCategory(item.cat)}
                          className="text-[#0058bb] hover:underline font-bold cursor-pointer inline-block"
                        >
                          categoría {item.cat}
                        </button>
                      ) : (
                        <span className="text-[#0058bb] font-bold">categoría {item.cat}</span>
                      )}
                      ) para alcanzar el precio al por mayor.
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Right: Resumen de compra (Cols 4) - Native flat container on mobile */}
        <div className="lg:col-span-4 bg-transparent md:bg-white rounded-none md:rounded-xl border-0 md:border md:border-gray-200 p-1 md:p-5 shadow-none md:shadow-xs space-y-4 lg:sticky lg:top-28 pt-3 md:pt-5 border-t border-gray-200 md:border-t-0">
          <h2 className="text-base sm:text-lg font-bold text-gray-900 font-['Montserrat'] border-b border-gray-100 pb-2.5">
            Resumen de compra
          </h2>

          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between text-gray-600 font-medium">
              <span>Productos ({totalQuantity} unidades)</span>
            </div>

            {/* Itemized summary */}
            <div className="space-y-2 pt-1 text-sm text-gray-600 border-b border-gray-100 pb-3">
              {processedItems.map((item) => {
                const rawVariantList: string[] =
                  item.selectedVariants && Object.keys(item.selectedVariants).length > 0
                    ? (Object.values(item.selectedVariants).filter(Boolean) as string[])
                    : ([item.selectedColor, item.selectedSizeVariant?.name].filter(Boolean) as string[]);

                const uniqueVariantList = Array.from(new Set(rawVariantList));
                const variantDetails = uniqueVariantList.join(', ');

                const itemLabel = `${item.quantity}x ${item.product.title}${
                  variantDetails ? `, ${variantDetails}` : ''
                } (${item.isWholesale ? 'mayorista' : 'minorista'})`;

                return (
                  <div key={item.id} className="flex justify-between items-start gap-2">
                    <span className="text-gray-700 leading-snug break-words">
                      {itemLabel}
                    </span>
                    <span className="font-normal text-gray-900 shrink-0">
                      ${item.totalPrice.toLocaleString('es-AR')}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Wholesale discount if applied */}
            {totalSavings > 0 && (
              <div className="flex justify-between text-[#00a650] font-semibold text-sm pt-1">
                <span>Descuento Mayorista Aplicado</span>
                <span>- ${totalSavings.toLocaleString('es-AR')}</span>
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 pt-3">
            <div className="flex items-baseline justify-between">
              <span className="text-base font-bold text-gray-900">Total</span>
              <div className="text-right">
                <span id="cart-total-amount" className="text-2xl font-bold text-gray-900 font-['Montserrat']">
                  $ {subtotalProducts.toLocaleString('es-AR')}
                </span>
                <span className="text-xs text-gray-400 block">* sin envío</span>
              </div>
            </div>
          </div>

          {/* Action CTA Button - Enlarged full touch target */}
          <button
            id="proceed-to-checkout-btn"
            onClick={onProceedToCheckout}
            className="w-full bg-[#0058bb] hover:bg-[#004bb0] text-white font-bold py-3.5 px-4 rounded-xl text-sm md:text-base uppercase tracking-wide transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer min-h-[48px]"
          >
            <span>REALIZAR ENVÍO Y PAGO</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          {/* Continue Shopping Button */}
          <button
            type="button"
            id="cart-continue-shopping-summary-btn"
            onClick={onContinueShopping}
            className="w-full bg-white md:bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold py-2.5 px-4 rounded-xl text-xs md:text-sm border border-gray-200 transition-colors flex items-center justify-center gap-2 cursor-pointer min-h-[42px]"
          >
            <ArrowLeft className="w-4 h-4 text-gray-500" />
            <span>Seguir comprando</span>
          </button>

          {/* Trust Guarantees */}
          <div className="space-y-2 pt-2 border-t border-gray-100 text-xs sm:text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-gray-400 shrink-0" />
              <span>Envíos a todo el país vía Correo Argentino.</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Compra 100% segura y protegida.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
