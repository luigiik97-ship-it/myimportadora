import { Product, CartItem, Order, OrderItem, SizeVariant } from '../types';
import {
  normalizeVariantTypes,
  getSelectedVariantStock,
  getItemEffectiveNormalPrice,
} from '../utils/variantHelpers';

export interface ReorderItemResult {
  title: string;
  variantText?: string;
  image?: string;
  requestedQuantity: number;
  addedQuantity: number;
  status: 'added' | 'partial' | 'out_of_stock' | 'not_found' | 'already_max_in_cart';
  message: string;
}

export interface ReorderResult {
  success: boolean;
  updatedCart: CartItem[];
  itemsAddedCount: number;
  totalUnitsAdded: number;
  details: ReorderItemResult[];
  summaryMessage: string;
  hasUnavailableItems: boolean;
  orderNumber: string;
}

/**
 * Reconstruye la selección de variantes a partir de la información almacenada en el OrderItem.
 */
function resolveItemVariants(
  product: Product,
  orderItem: OrderItem
): {
  selectedVariants: Record<string, string>;
  selectedSizeVariant?: SizeVariant;
  selectedColor?: string;
  selectedImage?: string;
} {
  const selectedVariants: Record<string, string> = {};
  let selectedSizeVariant: SizeVariant | undefined = undefined;
  let selectedColor: string | undefined = undefined;
  let selectedImage: string | undefined = orderItem.image;

  const variantTypes = normalizeVariantTypes(product);

  // 1. Intentar extraer del id del item si contiene pares clave-valor (ej: prodId-Color:Rojo|Tamaño:L)
  if (orderItem.id && orderItem.id.includes('|')) {
    const rawSuffix = orderItem.id.replace(`${orderItem.productId}-`, '');
    const pairs = rawSuffix.split('|');
    pairs.forEach((pair) => {
      const [k, v] = pair.split(':');
      if (k && v) {
        selectedVariants[k] = v;
      }
    });
  }

  // 2. Extraer a partir de variantText (ej: "Dorado, Talle M" o "Negro / L")
  const rawText = orderItem.variantText || '';
  if (rawText.trim().length > 0) {
    // Dividir en tokens comunes
    const tokens = rawText
      .split(/[,/•|]/)
      .map((t) => t.trim())
      .filter(Boolean);

    // Mapear opciones de variantTypes
    if (variantTypes.length > 0) {
      variantTypes.forEach((vt) => {
        // Buscar si alguna opción coincide con los tokens o con el texto
        const matchedOpt = vt.options.find((opt) => {
          const optNameLower = opt.name.toLowerCase();
          return (
            tokens.some((token) => {
              const cleanToken = token.replace(/^(color|talle|tamaño|medida|modelo):\s*/i, '').trim().toLowerCase();
              return cleanToken === optNameLower || token.toLowerCase() === optNameLower;
            }) ||
            rawText.toLowerCase().includes(optNameLower)
          );
        });

        if (matchedOpt) {
          selectedVariants[vt.id] = matchedOpt.name;
          selectedVariants[vt.name] = matchedOpt.name;
          if (matchedOpt.images && matchedOpt.images.length > 0 && !selectedImage) {
            selectedImage = matchedOpt.images[0];
          }
        }
      });
    }

    // Mapear sizeVariants heredados si existen
    if (product.sizeVariants && product.sizeVariants.length > 0) {
      const matchedSv = product.sizeVariants.find((sv) =>
        tokens.some((token) => token.toLowerCase() === sv.name.toLowerCase()) ||
        rawText.toLowerCase().includes(sv.name.toLowerCase())
      );
      if (matchedSv) {
        selectedSizeVariant = matchedSv;
        if (matchedSv.images && matchedSv.images.length > 0 && !selectedImage) {
          selectedImage = matchedSv.images[0];
        }
      }
    }

    // Mapear colors heredados si existen
    if (product.colors && product.colors.length > 0) {
      const matchedColor = product.colors.find((col) =>
        tokens.some((token) => token.toLowerCase() === col.toLowerCase()) ||
        rawText.toLowerCase().includes(col.toLowerCase())
      );
      if (matchedColor) {
        selectedColor = matchedColor;
      }
    }
  }

  // Si tiene tipos de variantes pero ninguno coincidió, seleccionar la primera opción con stock si es posible
  if (variantTypes.length > 0 && Object.keys(selectedVariants).length === 0) {
    variantTypes.forEach((vt) => {
      const firstWithStock = vt.options.find((o) => (o.stock ?? 0) > 0) || vt.options[0];
      if (firstWithStock) {
        selectedVariants[vt.id] = firstWithStock.name;
        selectedVariants[vt.name] = firstWithStock.name;
      }
    });
  }

  return {
    selectedVariants,
    selectedSizeVariant,
    selectedColor,
    selectedImage: selectedImage || (product.images && product.images[0]) || '',
  };
}

/**
 * Función principal para procesar "Volver a pedir":
 * Carga automáticamente todos los productos de un pedido anterior al carrito,
 * respetando cantidades, stock disponible y avisando si alguno no existe o no tiene stock.
 */
export function reorderOrderItems(
  order: Order,
  catalogProducts: Product[],
  currentCart: CartItem[]
): ReorderResult {
  const details: ReorderItemResult[] = [];
  const updatedCart: CartItem[] = currentCart.map((c) => ({ ...c }));

  let itemsAddedCount = 0;
  let totalUnitsAdded = 0;
  let hasUnavailableItems = false;

  order.items.forEach((orderItem) => {
    // 1. Buscar el producto en el catálogo actual
    const product = catalogProducts.find(
      (p) =>
        p.id === orderItem.productId ||
        p.title.trim().toLowerCase() === orderItem.title.trim().toLowerCase()
    );

    // Caso A: El producto fue eliminado o ya no existe
    if (!product) {
      hasUnavailableItems = true;
      details.push({
        title: orderItem.title,
        variantText: orderItem.variantText,
        image: orderItem.image,
        requestedQuantity: orderItem.quantity,
        addedQuantity: 0,
        status: 'not_found',
        message: `El producto «${orderItem.title}» ya no está disponible en la tienda.`,
      });
      return;
    }

    // 2. Reconstruir variantes y evaluar disponibilidad de stock
    const { selectedVariants, selectedSizeVariant, selectedColor, selectedImage } = resolveItemVariants(
      product,
      orderItem
    );

    // Stock máximo para esta variante/producto
    const maxAvailableStock = getSelectedVariantStock(product, selectedVariants);

    // Caso B: El producto o variante no tiene stock (agotado)
    if (maxAvailableStock <= 0) {
      hasUnavailableItems = true;
      details.push({
        title: product.title,
        variantText: orderItem.variantText,
        image: selectedImage || orderItem.image,
        requestedQuantity: orderItem.quantity,
        addedQuantity: 0,
        status: 'out_of_stock',
        message: `«${product.title}»${orderItem.variantText ? ` (${orderItem.variantText})` : ''} está sin stock actualmente.`,
      });
      return;
    }

    // 3. Generar clave compuesta del item para el carrito
    const variantSuffix =
      selectedVariants && Object.keys(selectedVariants).length > 0
        ? Object.entries(selectedVariants)
            .filter(([k]) => !k.startsWith('vt-') || !selectedVariants[k.replace('vt-', '')])
            .map(([k, v]) => `${k}:${v}`)
            .sort()
            .join('|')
        : `${selectedColor || 'none'}-${selectedSizeVariant?.id || 'none'}`;

    const itemKey = `${product.id}-${variantSuffix}`;

    // 4. Verificar qué cantidad ya existe en el carrito
    const existingIdx = updatedCart.findIndex((c) => c.id === itemKey);
    const alreadyInCart = existingIdx !== -1 ? updatedCart[existingIdx].quantity : 0;
    const remainingStock = Math.max(0, maxAvailableStock - alreadyInCart);

    // Caso C: Ya tiene el stock máximo permitido en el carrito
    if (remainingStock <= 0) {
      hasUnavailableItems = true;
      details.push({
        title: product.title,
        variantText: orderItem.variantText,
        image: selectedImage || orderItem.image,
        requestedQuantity: orderItem.quantity,
        addedQuantity: 0,
        status: 'already_max_in_cart',
        message: `«${product.title}»${orderItem.variantText ? ` (${orderItem.variantText})` : ''}: ya tienes el stock máximo disponible (${maxAvailableStock} un.) en el carrito.`,
      });
      return;
    }

    // Cantidad efectiva a agregar respetando el stock disponible
    const qtyToAdd = Math.min(orderItem.quantity, remainingStock);

    if (qtyToAdd < orderItem.quantity) {
      hasUnavailableItems = true;
      details.push({
        title: product.title,
        variantText: orderItem.variantText,
        image: selectedImage || orderItem.image,
        requestedQuantity: orderItem.quantity,
        addedQuantity: qtyToAdd,
        status: 'partial',
        message: `«${product.title}»${orderItem.variantText ? ` (${orderItem.variantText})` : ''}: se agregaron ${qtyToAdd} de ${orderItem.quantity} un. por límite de stock.`,
      });
    } else {
      details.push({
        title: product.title,
        variantText: orderItem.variantText,
        image: selectedImage || orderItem.image,
        requestedQuantity: orderItem.quantity,
        addedQuantity: qtyToAdd,
        status: 'added',
        message: `«${product.title}»${orderItem.variantText ? ` (${orderItem.variantText})` : ''}: ${qtyToAdd} un. agregadas al carrito.`,
      });
    }

    // 5. Agregar o actualizar en el carrito
    const wholesaleUnitPrice = getItemEffectiveNormalPrice(
      product,
      selectedVariants,
      selectedSizeVariant,
      true
    );

    const resolvedImage =
      selectedImage ||
      orderItem.image ||
      (product.images && product.images[0]) ||
      'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800';

    if (existingIdx !== -1) {
      updatedCart[existingIdx].quantity += qtyToAdd;
      updatedCart[existingIdx].totalPrice = updatedCart[existingIdx].unitPrice * updatedCart[existingIdx].quantity;
    } else {
      updatedCart.push({
        id: itemKey,
        productId: product.id,
        product,
        selectedColor,
        selectedSizeVariant,
        selectedVariants,
        selectedImage: resolvedImage,
        quantity: qtyToAdd,
        unitPrice: wholesaleUnitPrice,
        isWholesale: true,
        totalPrice: wholesaleUnitPrice * qtyToAdd,
      });
    }

    itemsAddedCount += 1;
    totalUnitsAdded += qtyToAdd;
  });

  // Resumen textual para la interfaz
  let summaryMessage = '';
  if (totalUnitsAdded > 0) {
    if (hasUnavailableItems) {
      summaryMessage = `Se agregaron ${totalUnitsAdded} unidades al carrito. Algunos productos no pudieron cargarse completos por stock o disponibilidad.`;
    } else {
      summaryMessage = `¡Todos los productos del pedido #${order.orderNumber} se cargaron al carrito con éxito! (${totalUnitsAdded} unidades).`;
    }
  } else {
    summaryMessage = `No fue posible cargar productos de este pedido porque ya no cuentan con stock disponible o fueron retirados del catálogo.`;
  }

  return {
    success: totalUnitsAdded > 0,
    updatedCart,
    itemsAddedCount,
    totalUnitsAdded,
    details,
    summaryMessage,
    hasUnavailableItems,
    orderNumber: order.orderNumber,
  };
}
