import { CartItem, Product } from '../types';
import { getSelectedVariantStock } from './variantHelpers';

export interface CartStockAlert {
  id: string;
  type: 'out_of_stock' | 'reduced_stock';
  message: string;
  productTitle: string;
  variantText?: string;
  productId: string;
  availableStock: number;
}

export interface StockValidationResult {
  updatedCart: CartItem[];
  alerts: CartStockAlert[];
  hasChanges: boolean;
  hasOutOfStock: boolean;
  hasReducedStock: boolean;
}

/**
 * Valida de forma estricta el stock del carrito contra el catálogo actual.
 * - Si un producto o variante está agotado (stock <= 0), se retira del carrito.
 * - Si el stock disminuyó pero queda disponibilidad (0 < stock < cantidad), se ajusta a la cantidad máxima disponible.
 * - Genera avisos descriptivos que permanecen visibles en el carrito hasta que el cliente los cierre con la X.
 * - No reserva stock en base de datos.
 */
export function validateCartStock(
  cart: CartItem[],
  products: Product[]
): StockValidationResult {
  const prodMap = new Map<string, Product>();
  products.forEach((p) => prodMap.set(p.id, p));

  const updatedCart: CartItem[] = [];
  const alerts: CartStockAlert[] = [];
  let hasChanges = false;
  let hasOutOfStock = false;
  let hasReducedStock = false;

  for (const item of cart) {
    const liveProduct = prodMap.get(item.productId) || item.product;
    if (!liveProduct) {
      hasChanges = true;
      hasOutOfStock = true;
      alerts.push({
        id: `oos-${item.id}-${Date.now()}`,
        type: 'out_of_stock',
        message: `El producto "${item.product?.title || 'Artículo'}" ya no está disponible en el catálogo y fue retirado del carrito.`,
        productTitle: item.product?.title || 'Artículo',
        variantText: item.variantText,
        productId: item.productId,
        availableStock: 0,
      });
      continue;
    }

    const availableStock = getSelectedVariantStock(liveProduct, item.selectedVariants || {});

    const variantLabel =
      item.variantText ||
      (item.selectedVariants
        ? Object.values(item.selectedVariants).filter(Boolean).join(', ')
        : '');
    const variantDesc = variantLabel ? ` (${variantLabel})` : '';

    if (availableStock <= 0) {
      hasChanges = true;
      hasOutOfStock = true;
      alerts.push({
        id: `oos-${item.id}-${Date.now()}`,
        type: 'out_of_stock',
        message: `"${liveProduct.title}${variantDesc}" se encuentra agotado y fue retirado de tu carrito.`,
        productTitle: liveProduct.title,
        variantText: variantLabel || undefined,
        productId: item.productId,
        availableStock: 0,
      });
      continue;
    }

    if (item.quantity > availableStock) {
      hasChanges = true;
      hasReducedStock = true;
      alerts.push({
        id: `red-${item.id}-${Date.now()}`,
        type: 'reduced_stock',
        message: `El stock disponible de "${liveProduct.title}${variantDesc}" cambió. Ajustamos la cantidad en tu carrito a ${availableStock} unidad${availableStock > 1 ? 'es' : ''}.`,
        productTitle: liveProduct.title,
        variantText: variantLabel || undefined,
        productId: item.productId,
        availableStock,
      });

      updatedCart.push({
        ...item,
        product: liveProduct,
        quantity: availableStock,
        totalPrice: item.unitPrice * availableStock,
      });
    } else {
      updatedCart.push({
        ...item,
        product: liveProduct,
      });
    }
  }

  return {
    updatedCart,
    alerts,
    hasChanges,
    hasOutOfStock,
    hasReducedStock,
  };
}
