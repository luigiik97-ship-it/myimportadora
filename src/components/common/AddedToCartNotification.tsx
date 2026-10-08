import React, { useEffect, useState, useRef } from 'react';
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
  // Obtiene el borde inferior de la fila principal del encabezado (logo, compra rápida y carrito)
  const getPrimaryNavBottom = (): number => {
    if (typeof window === 'undefined') return 58;
    const primaryRow = document.getElementById('main-nav-primary-row');
    if (primaryRow) {
      const rect = primaryRow.getBoundingClientRect();
      if (rect.bottom > 0) {
        return rect.bottom;
      }
    }
    const headerEl = document.getElementById('main-header');
    if (headerEl) {
      const rect = headerEl.getBoundingClientRect();
      return Math.max(rect.top + 54, 54);
    }
    return window.innerWidth < 640 ? 54 : 62;
  };

  // Posición dinámica para que aparezca justo abajo del logo, compra rápida y carrito,
  // y flote por encima de los botones de categorías y del resto del contenido
  const [topOffset, setTopOffset] = useState<number>(() => getPrimaryNavBottom() + 4);

  // Estado para el gesto de deslizamiento (swipe to dismiss) en móvil
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const [dismissDirection, setDismissDirection] = useState<'left' | 'right' | null>(null);

  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const isHorizontalGesture = useRef<boolean | null>(null);

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Actualizar dinámicamente la posición según el scroll o redimensionado
  useEffect(() => {
    if (!data) return;

    const updateHeaderPosition = () => {
      const bottom = getPrimaryNavBottom();
      setTopOffset(bottom + 4);
    };

    updateHeaderPosition();
    window.addEventListener('resize', updateHeaderPosition);
    window.addEventListener('scroll', updateHeaderPosition, { passive: true });
    return () => {
      window.removeEventListener('resize', updateHeaderPosition);
      window.removeEventListener('scroll', updateHeaderPosition);
    };
  }, [data?.id]);

  // Cierre automático estricto después de 3 segundos (basado en el ID de la notificación para no cancelarse por re-renders)
  const notificationId = data?.id;
  useEffect(() => {
    if (!notificationId) return;

    // Resetear estados al cambiar de producto/notificación
    setDragOffset(0);
    setIsDragging(false);
    setIsDismissing(false);
    setDismissDirection(null);
    isHorizontalGesture.current = null;

    const timer = setTimeout(() => {
      onCloseRef.current();
    }, 3000);

    return () => clearTimeout(timer);
  }, [notificationId]);

  // Controladores de eventos táctiles para deslizar (swipe left / right)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isDismissing) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isHorizontalGesture.current = null;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || isDismissing) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - touchStartX.current;
    const diffY = currentY - touchStartY.current;

    // Determinar la intención del usuario (gesto horizontal vs vertical)
    if (isHorizontalGesture.current === null) {
      if (Math.abs(diffX) > 6 || Math.abs(diffY) > 6) {
        // Solo capturamos si el movimiento horizontal supera al vertical
        isHorizontalGesture.current = Math.abs(diffX) > Math.abs(diffY);
      }
    }

    // Solo mover si el usuario está realizando un gesto horizontal,
    // permitiendo el scroll vertical nativo sin ninguna interferencia
    if (isHorizontalGesture.current === true) {
      setDragOffset(diffX);
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging || isDismissing) return;
    setIsDragging(false);

    const threshold = 70; // Umbral de píxeles para descartar
    if (isHorizontalGesture.current === true && Math.abs(dragOffset) > threshold) {
      // Descartar suavemente hacia el lado del deslizamiento
      const direction = dragOffset > 0 ? 'right' : 'left';
      setDismissDirection(direction);
      setIsDismissing(true);

      setTimeout(() => {
        onCloseRef.current();
      }, 200);
    } else {
      // Regresar al centro con animación elástica suave
      setDragOffset(0);
      isHorizontalGesture.current = null;
    }
  };

  if (!data) return null;

  // Transformación y opacidad calculadas para el swipe
  let transformValue = 'translate3d(-50%, 0, 0)';
  let opacityValue = 1;

  if (isDismissing) {
    transformValue =
      dismissDirection === 'right'
        ? 'translate3d(calc(-50% + 120vw), 0, 0)'
        : 'translate3d(calc(-50% - 120vw), 0, 0)';
    opacityValue = 0;
  } else if (dragOffset !== 0) {
    transformValue = `translate3d(calc(-50% + ${dragOffset}px), 0, 0)`;
    opacityValue = Math.max(0.15, 1 - Math.abs(dragOffset) / 280);
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      id="added-to-cart-toast"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      className={`fixed left-1/2 z-[70] w-[92%] max-w-md md:max-w-lg bg-white rounded-xl border border-gray-200/90 px-3 py-2 md:px-3.5 md:py-2.5 text-gray-900 ${
        isDragging ? '' : 'transition-all duration-200 ease-out'
      }`}
      style={{
        top: `${topOffset}px`,
        transform: transformValue,
        opacity: opacityValue,
        touchAction: 'pan-y', // Permite desplazamiento vertical del navegador sin interferencias
        boxShadow: '0 12px 36px -6px rgba(0, 0, 0, 0.18), 0 4px 12px -2px rgba(0, 0, 0, 0.08)',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      {/* Header with success badge and close button */}
      <div className="flex items-center justify-between gap-2 pb-1.5 mb-1.5 border-b border-gray-100">
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
      <div className="flex items-center gap-2.5">
        {/* Product Thumbnail */}
        <div className="w-12 h-12 md:w-13 md:h-13 bg-gray-50 rounded-lg p-1 border border-gray-100 shrink-0 flex items-center justify-center overflow-hidden">
          <img
            src={data.image}
            alt={data.product.title}
            className="w-full h-full object-contain pointer-events-none"
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

          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
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
