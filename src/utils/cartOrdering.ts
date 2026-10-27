import { CartItem } from '../types';

/**
 * Reordena los artículos del carrito para que:
 * 1. La categoría de la publicación recién agregada suba completa al primer lugar del carrito conservando todos sus productos y su barra progresiva.
 * 2. Dentro de esa categoría, la publicación recién agregada aparezca primero.
 * 3. Las demás publicaciones de la categoría y las demás categorías mantengan su orden relativo.
 * 4. No afecta precios, cálculos ni mínimos mayoristas.
 */
export function reorderCartOnProductAdd(
  cartItems: CartItem[],
  addedProductId: string,
  addedCategory: string,
  addedItemId?: string
): CartItem[] {
  if (!cartItems || cartItems.length <= 1) return cartItems;

  const normalizeCat = (cat?: string) => (cat || 'General').trim().toLowerCase();
  const targetCatNorm = normalizeCat(addedCategory);
  const targetProdId = String(addedProductId);

  // 1. Separar artículos pertenecientes a la categoría objetivo vs. otras categorías
  const targetCatItems: CartItem[] = [];
  const otherCatItems: CartItem[] = [];
  const otherCatsOrder: string[] = [];

  cartItems.forEach((item) => {
    const itemCat = normalizeCat(item.product?.category);
    if (itemCat === targetCatNorm) {
      targetCatItems.push(item);
    } else {
      otherCatItems.push(item);
      if (!otherCatsOrder.includes(itemCat)) {
        otherCatsOrder.push(itemCat);
      }
    }
  });

  // 2. Dentro de la categoría objetivo, la publicación recién agregada debe aparecer primero
  const targetProdItems = targetCatItems.filter((i) => String(i.productId) === targetProdId);
  const otherProdItemsInCat = targetCatItems.filter((i) => String(i.productId) !== targetProdId);

  // Si se especificó el itemId exacto agregado o actualizado, posicionarlo al principio de la publicación
  if (addedItemId && targetProdItems.length > 1) {
    targetProdItems.sort((a, b) => {
      if (a.id === addedItemId) return -1;
      if (b.id === addedItemId) return 1;
      return 0;
    });
  }

  // Agrupar los artículos de la categoría activa: la publicación agregada primero, seguida por las demás
  const orderedTargetCatItems = [...targetProdItems, ...otherProdItemsInCat];

  // 3. Mantener el orden relativo de las demás categorías
  const orderedOtherItems: CartItem[] = [];
  otherCatsOrder.forEach((catKey) => {
    const catItems = otherCatItems.filter((i) => normalizeCat(i.product?.category) === catKey);
    orderedOtherItems.push(...catItems);
  });

  // La categoría completa sube al primer lugar del carrito
  return [...orderedTargetCatItems, ...orderedOtherItems];
}
