import React from 'react';
import { Banknote } from 'lucide-react';
import { Product } from '../../types';
import { isProductCompletelyOutOfStock } from '../../utils/variantHelpers';
import { usePurchaseMode, PurchaseMode } from '../../context/PurchaseModeContext';

interface ProductCardPriceProps {
  product: Product;
  className?: string;
  theme?: 'light' | 'dark';
  modeOverride?: PurchaseMode;
}

export const ProductCardPrice: React.FC<ProductCardPriceProps> = ({
  product,
  className = '',
  theme = 'light',
  modeOverride,
}) => {
  const { purchaseMode: contextMode, isCashMode: contextIsCash } = usePurchaseMode();
  const effectiveMode = modeOverride || contextMode;
  const isCash = effectiveMode === 'cash';

  const isOutOfStock = isProductCompletelyOutOfStock(product);
  const isDark = theme === 'dark';

  // Compute wholesale price according to active purchase mode
  const effectiveWholesalePrice = isCash
    ? (product.wholesaleCashPrice !== undefined && product.wholesaleCashPrice > 0
        ? product.wholesaleCashPrice
        : product.cashPrice !== undefined && product.cashPrice > 0
        ? product.cashPrice
        : product.wholesalePrice)
    : product.wholesalePrice;

  // Compute retail price according to active purchase mode
  const effectiveRetailPrice = isCash
    ? (product.retailCashPrice !== undefined && product.retailCashPrice > 0
        ? product.retailCashPrice
        : product.cashPrice !== undefined && product.cashPrice > 0
        ? product.cashPrice
        : product.retailPrice)
    : product.retailPrice;

  return (
    <div className={`pt-0.5 sm:pt-1 ${className}`}>
      {/* Wholesale Price Highlight */}
      <div className="flex items-center gap-1 sm:gap-1.5 flex-nowrap min-w-0">
        <span
          className={`text-base sm:text-lg font-bold font-['Montserrat'] shrink-0 ${
            isDark
              ? 'text-white'
              : isCash
              ? 'text-emerald-700'
              : 'text-gray-900'
          }`}
        >
          ${effectiveWholesalePrice.toLocaleString('es-AR')}
        </span>
        {isOutOfStock ? (
          <span
            className={`text-xs font-bold px-1.5 py-0.5 rounded shrink-0 ${
              isDark
                ? 'text-red-300 bg-red-900/60 border border-red-700/60'
                : 'text-red-600 bg-red-50 border border-red-200'
            }`}
          >
            Sin stock
          </span>
        ) : (
          <span className="inline-flex items-center text-[11px] sm:text-[13.2px] font-semibold bg-[#00a650] text-white px-1.5 py-0.5 rounded leading-tight shrink min-w-0 shadow-xs">
            <span className="overflow-hidden whitespace-nowrap text-clip block min-w-0">
              desde {product.minWholesaleQty || 1} unids
            </span>
          </span>
        )}
      </div>

      {/* Retail Price line with mode indicator */}
      <div
        className={`text-xs font-normal mt-0.5 flex items-center justify-between gap-1 flex-wrap ${
          isDark ? 'text-white/70' : 'text-gray-500'
        }`}
      >
        <span>1 unidad ${effectiveRetailPrice.toLocaleString('es-AR')}</span>
        {isCash && (
          <span title="Precio en efectivo" className="inline-flex items-center text-emerald-600 shrink-0">
            <Banknote className="w-3.5 h-3.5 text-emerald-600" />
          </span>
        )}
      </div>
    </div>
  );
};
