import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Product } from '../types';

export type PurchaseMode = 'transfer' | 'cash';

export const PURCHASE_MODE_STORAGE_KEY = 'my_commerce_purchase_mode';
export const PURCHASE_MODE_EVENT = 'my_commerce_purchase_mode_changed';

export interface PurchaseModeContextType {
  purchaseMode: PurchaseMode;
  setPurchaseMode: (mode: PurchaseMode) => void;
  isCashMode: boolean;
  togglePurchaseMode: () => void;
  getEffectiveWholesalePrice: (product: Product) => number;
  getEffectiveRetailPrice: (product: Product) => number;
}

const PurchaseModeContext = createContext<PurchaseModeContextType | undefined>(undefined);

export function getStoredPurchaseMode(): PurchaseMode {
  try {
    const saved = localStorage.getItem(PURCHASE_MODE_STORAGE_KEY);
    if (saved === 'cash' || saved === 'transfer') {
      return saved;
    }
  } catch (e) {}
  // Default is 'transfer' as required by user
  return 'transfer';
}

export function calculateEffectivePrices(product: Product, mode: PurchaseMode) {
  const isCash = mode === 'cash';
  const wholesale = isCash
    ? (product.wholesaleCashPrice !== undefined && product.wholesaleCashPrice > 0
        ? product.wholesaleCashPrice
        : product.cashPrice !== undefined && product.cashPrice > 0
        ? product.cashPrice
        : product.wholesalePrice)
    : product.wholesalePrice;

  const retail = isCash
    ? (product.retailCashPrice !== undefined && product.retailCashPrice > 0
        ? product.retailCashPrice
        : product.cashPrice !== undefined && product.cashPrice > 0
        ? product.cashPrice
        : product.retailPrice)
    : product.retailPrice;

  return { wholesale, retail };
}

interface PurchaseModeProviderProps {
  children: ReactNode;
  onModeChangeExternal?: (mode: PurchaseMode) => void;
}

export const PurchaseModeProvider: React.FC<PurchaseModeProviderProps> = ({
  children,
  onModeChangeExternal,
}) => {
  const [purchaseMode, setPurchaseModeState] = useState<PurchaseMode>(getStoredPurchaseMode);

  const setPurchaseMode = useCallback(
    (newMode: PurchaseMode) => {
      setPurchaseModeState(newMode);
      try {
        localStorage.setItem(PURCHASE_MODE_STORAGE_KEY, newMode);
        localStorage.setItem('my_commerce_checkout_payment_method', newMode);
        if (newMode === 'cash') {
          // Cash mode activates local pickup automatically
          localStorage.setItem('my_commerce_checkout_delivery_option', 'pickup');
        }
      } catch (e) {}

      // Dispatch event for cross-component sync
      window.dispatchEvent(
        new CustomEvent(PURCHASE_MODE_EVENT, { detail: newMode })
      );

      if (onModeChangeExternal) {
        onModeChangeExternal(newMode);
      }
    },
    [onModeChangeExternal]
  );

  const togglePurchaseMode = useCallback(() => {
    setPurchaseMode(purchaseMode === 'transfer' ? 'cash' : 'transfer');
  }, [purchaseMode, setPurchaseMode]);

  // Listen to custom events and storage changes
  useEffect(() => {
    const handleCustomEvent = (e: any) => {
      const mode = e?.detail;
      if ((mode === 'transfer' || mode === 'cash') && mode !== purchaseMode) {
        setPurchaseModeState(mode);
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === PURCHASE_MODE_STORAGE_KEY && (e.newValue === 'transfer' || e.newValue === 'cash')) {
        setPurchaseModeState(e.newValue as PurchaseMode);
      }
    };

    window.addEventListener(PURCHASE_MODE_EVENT, handleCustomEvent);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(PURCHASE_MODE_EVENT, handleCustomEvent);
      window.removeEventListener('storage', handleStorage);
    };
  }, [purchaseMode]);

  const getEffectiveWholesalePrice = useCallback(
    (product: Product) => {
      return calculateEffectivePrices(product, purchaseMode).wholesale;
    },
    [purchaseMode]
  );

  const getEffectiveRetailPrice = useCallback(
    (product: Product) => {
      return calculateEffectivePrices(product, purchaseMode).retail;
    },
    [purchaseMode]
  );

  const value: PurchaseModeContextType = {
    purchaseMode,
    setPurchaseMode,
    isCashMode: purchaseMode === 'cash',
    togglePurchaseMode,
    getEffectiveWholesalePrice,
    getEffectiveRetailPrice,
  };

  return (
    <PurchaseModeContext.Provider value={value}>
      {children}
    </PurchaseModeContext.Provider>
  );
};

export function usePurchaseMode(): PurchaseModeContextType {
  const context = useContext(PurchaseModeContext);
  if (!context) {
    // Graceful fallback if used outside provider
    const mode = getStoredPurchaseMode();
    return {
      purchaseMode: mode,
      setPurchaseMode: (newMode: PurchaseMode) => {
        try {
          localStorage.setItem(PURCHASE_MODE_STORAGE_KEY, newMode);
          window.dispatchEvent(new CustomEvent(PURCHASE_MODE_EVENT, { detail: newMode }));
        } catch (e) {}
      },
      isCashMode: mode === 'cash',
      togglePurchaseMode: () => {},
      getEffectiveWholesalePrice: (p) => calculateEffectivePrices(p, mode).wholesale,
      getEffectiveRetailPrice: (p) => calculateEffectivePrices(p, mode).retail,
    };
  }
  return context;
}
