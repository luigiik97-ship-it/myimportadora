import { useState, useEffect } from 'react';

export type PurchaseModality = 'transfer' | 'cash';

export const PURCHASE_MODALITY_KEY = 'my_commerce_purchase_modality';
export const PURCHASE_MODALITY_EVENT = 'my_commerce_purchase_modality_changed';

/**
 * Gets the current purchase modality. Default is 'transfer'.
 */
export function getStoredPurchaseModality(): PurchaseModality {
  try {
    const val = localStorage.getItem(PURCHASE_MODALITY_KEY);
    if (val === 'cash' || val === 'transfer') return val;
  } catch (e) {}
  return 'transfer';
}

/**
 * Sets and synchronizes the purchase modality across the entire store.
 * - If 'cash': sets payment method to 'cash' and delivery option to 'pickup' (exclusivo para retiro en local).
 * - If 'transfer': sets payment method to 'transfer'.
 */
export function setStoredPurchaseModality(modality: PurchaseModality) {
  try {
    localStorage.setItem(PURCHASE_MODALITY_KEY, modality);
    if (modality === 'cash') {
      localStorage.setItem('my_commerce_checkout_payment_method', 'cash');
      localStorage.setItem('my_commerce_checkout_delivery_option', 'pickup');
      sessionStorage.setItem('quick_buy_cash_pickup_cart', 'true');
    } else {
      localStorage.setItem('my_commerce_checkout_payment_method', 'transfer');
      sessionStorage.removeItem('quick_buy_cash_pickup_cart');
    }
  } catch (e) {}

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PURCHASE_MODALITY_EVENT, { detail: modality }));
    // Also dispatch delivery & payment update events for any listening components
    window.dispatchEvent(new CustomEvent('my_commerce_checkout_delivery_changed', { detail: modality === 'cash' ? 'pickup' : undefined }));
    window.dispatchEvent(new CustomEvent('my_commerce_checkout_payment_changed', { detail: modality }));
  }
}

/**
 * React hook to read and update the active purchase modality synchronously anywhere in the app.
 */
export function usePurchaseModality(): [PurchaseModality, (m: PurchaseModality) => void] {
  const [modality, setModalityState] = useState<PurchaseModality>(() => getStoredPurchaseModality());

  useEffect(() => {
    const handleModalityChange = (e: any) => {
      const next = e?.detail || getStoredPurchaseModality();
      setModalityState(next);
    };

    window.addEventListener(PURCHASE_MODALITY_EVENT, handleModalityChange);
    window.addEventListener('storage', handleModalityChange);

    return () => {
      window.removeEventListener(PURCHASE_MODALITY_EVENT, handleModalityChange);
      window.removeEventListener('storage', handleModalityChange);
    };
  }, []);

  const changeModality = (next: PurchaseModality) => {
    setStoredPurchaseModality(next);
    setModalityState(next);
  };

  return [modality, changeModality];
}
