import React, { useEffect } from 'react';
import { CheckCircle2, ShoppingBag, X, ArrowRight } from 'lucide-react';
import { Product } from '../../types';

export interface CartNotificationData {
  id: string;
  product: Product;
  variantSummary?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  image: string;
}

interface AddedToCartNotificationProps {
  data: CartNotificationData | null;
  onClose: () => void;
  onGoToCart: () => void;
}

export const AddedToCartNotification: React.FC<AddedToCartNotificationProps> = ({
  data,
  onClose,
  onGoToCart,
}) => {
  useEffect(() => {
    if (!data) return;

    // Auto-dismiss after 3 seconds
    const timer = setTimeout(() => {
      onClose();
    }, 3000);

    return () => clearTimeout(timer);
  }, [data, onClose]);

  if (!data) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      id="added-to-cart-toast"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] w-[92%] max-w-md md:max-w-lg bg-white rounded-xl shadow-2xl border border-gray-200/90 p-3.5 md:p-4 text-gray-900 transition-all duration-300 animate-in fade-in slide-in-from-top-4"
      style={{
        boxShadow: '0 12px 36px -6px rgba(0, 0, 0, 0.18), 0 4px 12px -2px rgba(0, 0, 0, 0.08)',
      }}
    >
      {/* Header with success badge and close button */}
      <div className="flex items-center justify-between gap-2 pb-2 mb-2.5 border-b border-gray-100">
        <div className="flex items-center gap-1.5 text-emerald-600">
          <CheckCircle2 className="w-4 h-4 md:w-4.5 md:h-4.5 shrink-0 text-emerald-500" />
          <span className="font-bold text-xs md:text-sm tracking-tight text-emerald-700">
            ¡Agregado al carrito!
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar notificación"
          className="p-1 -mr-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main product content */}
      <div className="flex items-center gap-3">
        {/* Product Thumbnail */}
        <div className="w-14 h-14 md:w-16 md:h-16 bg-gray-50 rounded-lg p-1.5 border border-gray-100 shrink-0 flex items-center justify-center overflow-hidden">
          <img
            src={data.image}
            alt={data.product.title}
            className="w-full h-full object-contain"
          />
        </div>

        {/* Product Info */}
        <div className="flex-1 min-w-0">
          <h4 className="text-xs md:text-sm font-bold text-gray-900 leading-snug line-clamp-1">
            {data.product.title}
          </h4>

          {data.variantSummary && (
            <p className="text-[11px] md:text-xs text-gray-500 line-clamp-1 mt-0.5 font-medium">
              {data.variantSummary}
            </p>
          )}

          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[11px] md:text-xs text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded font-semibold">
              {data.quantity} {data.quantity === 1 ? 'unidad' : 'unidades'}
            </span>
            <span className="text-xs md:text-sm font-bold text-gray-900">
              ${data.totalPrice.toLocaleString('es-AR')}
            </span>
            {data.quantity > 1 && (
              <span className="text-[10px] md:text-[11px] text-gray-400">
                (${data.unitPrice.toLocaleString('es-AR')} c/u)
              </span>
            )}
          </div>
        </div>

        {/* Action Button: Go to Cart */}
        <button
          type="button"
          onClick={() => {
            onClose();
            onGoToCart();
          }}
          className="shrink-0 bg-[#0058bb] hover:bg-[#004bb0] text-white text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          title="Ver carrito"
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Ver carrito</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
