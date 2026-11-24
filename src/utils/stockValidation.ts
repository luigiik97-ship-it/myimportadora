import { CartItem, Product } from '../types';
import {
  getSelectedVariantStock,
  getProductQuantityStep,
  getMaxValidQuantityForStock,
  normalizeQuantityToStep,
  isQuantityCompatibleWithStep,
} from './variantHelpers';

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
 * - Si un producto o variante está agotado (stock <= 0 o menor al incremento mínimo), se retira del carrito.
 * - Si el stock disminuyó pero queda disponibilidad (0 < stock < cantidad), se ajusta a la cantidad máxima válida.
 * - En productos con incremento de cantidad (precios escalonados), garantiza múltiplos exactos del incremento.
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
    const qtyStep = getProductQuantityStep(liveProduct);
    const maxValidStock = getMaxValidQuantityForStock(availableStock, qtyStep);

    const variantLabel =
      item.variantText ||
      (item.selectedVariants
        ? Object.values(item.selectedVariants).filter(Boolean).join(', ')
        : '');
    const variantDesc = variantLabel ? ` (${variantLabel})` : '';

    if (availableStock <= 0 || maxValidStock < qtyStep) {
      hasChanges = true;
      hasOutOfStock = true;
      alerts.push({
        id: `oos-${item.id}-${Date.now()}`,
        type: 'out_of_stock',
        message:
          availableStock <= 0
            ? `"${liveProduct.title}${variantDesc}" se encuentra agotado y fue retirado de tu carrito.`
            : `"${liveProduct.title}${variantDesc}" no cuenta con stock suficiente para el incremento mínimo de ${qtyStep} unidades y fue retirado de tu carrito.`,
        productTitle: liveProduct.title,
        variantText: variantLabel || undefined,
        productId: item.productId,
        availableStock: 0,
      });
      continue;
    }

    const isIncompatibleStep = !isQuantityCompatibleWithStep(liveProduct, item.quantity);

    if (item.quantity > maxValidStock || isIncompatibleStep) {
      const adjustedQty = normalizeQuantityToStep(item.quantity, qtyStep, availableStock, {
        roundMode: item.quantity > maxValidStock ? 'floor' : 'nearest',
      });
      hasChanges = true;
      hasReducedStock = true;
      alerts.push({
        id: `red-${item.id}-${Date.now()}`,
        type: 'reduced_stock',
        message:
          item.quantity > maxValidStock
            ? `El stock disponible de "${liveProduct.title}${variantDesc}" cambió. Ajustamos la cantidad en tu carrito a ${adjustedQty} unidad${adjustedQty > 1 ? 'es' : ''}.`
            : `"${liveProduct.title}${variantDesc}" se vende en incrementos de ${qtyStep} unidades. Ajustamos la cantidad a ${adjustedQty} unidades.`,
        productTitle: liveProduct.title,
        variantText: variantLabel || undefined,
        productId: item.productId,
        availableStock: maxValidStock,
      });

      updatedCart.push({
        ...item,
        product: liveProduct,
        quantity: adjustedQty,
        totalPrice: item.unitPrice * adjustedQty,
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
