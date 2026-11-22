import React from 'react';
import { Banknote } from 'lucide-react';
import { Product } from '../../types';
import {
  isProductCompletelyOutOfStock,
  getResolvedProductPrices,
  isSetSaleActive,
  isTieredPricingActive,
  getSelectedVariantSetUnits,
  getInformativeUnitPrice,
  getNormalizedPriceTiers,
  resolveProductPricesForQuantity,
} from '../../utils/variantHelpers';
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
  const { purchaseMode: contextMode } = usePurchaseMode();
  const effectiveMode = modeOverride || contextMode;
  const isCash = effectiveMode === 'cash';

  const isOutOfStock = isProductCompletelyOutOfStock(product);
  const isDark = theme === 'dark';

  const isSet = isSetSaleActive(product);
  const isTiered = isTieredPricingActive(product);

  const resolved = getResolvedProductPrices(product);
  const effectiveWholesalePrice = isCash ? resolved.wholesaleCashPrice : resolved.wholesalePrice;
  const effectiveRetailPrice = isCash ? resolved.retailCashPrice : resolved.retailPrice;

  // Modalidad Venta por Set o Combo Obligatorio
  if (isSet) {
    const unitsPerSet = getSelectedVariantSetUnits(product);
    const setPrice = effectiveWholesalePrice;
    const informativeUnitPrice = getInformativeUnitPrice(setPrice, unitsPerSet);

    return (
      <div className={`pt-0 sm:pt-0.5 ${className}`}>
        <div className="flex items-center gap-1 sm:gap-1.5 flex-nowrap min-w-0">
          <span
            className={`text-base sm:text-lg font-bold font-['Montserrat'] shrink-0 ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}
          >
            ${informativeUnitPrice.toLocaleString('es-AR')}
            {unitsPerSet > 1 && (
              <span className="text-[11px] font-semibold ml-0.5 opacity-80">c/u</span>
            )}
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
            <span className="inline-flex items-center text-[12px] sm:text-[13.5px] font-medium bg-[#16a34a] text-white px-[3px] py-[2px] rounded leading-none shrink min-w-0 shadow-xs">
              <span className="overflow-hidden whitespace-nowrap text-clip block min-w-0">
                Set x {unitsPerSet} {unitsPerSet === 1 ? 'unid' : 'unids'}
              </span>
            </span>
          )}
        </div>

        <div
          className={`text-xs font-normal mt-0.5 flex items-center justify-between gap-1 flex-wrap ${
            isDark ? 'text-white/70' : 'text-gray-500'
          }`}
        >
          <span>Set completo ${setPrice.toLocaleString('es-AR')}</span>
          {isCash && (
            <span title="Precio en efectivo" className="inline-flex items-center text-[#16a34a] shrink-0">
              <Banknote className="w-3.5 h-3.5 text-[#16a34a]" />
            </span>
          )}
        </div>
      </div>
    );
  }

  // Modalidad Precios Escalonados por Cantidad
  if (isTiered) {
    const tiers = getNormalizedPriceTiers(product);
    const firstTier = tiers[0];
    const minWholesale = product.minWholesaleQty || 1;
    const tierResolved = firstTier
      ? resolveProductPricesForQuantity(product, {}, undefined, firstTier.minQty)
      : resolved;
    const isWholesaleAtFirstTier = firstTier ? firstTier.minQty >= minWholesale : true;
    const highlightPrice = firstTier
      ? isCash
        ? (isWholesaleAtFirstTier ? tierResolved.wholesaleCashPrice : tierResolved.retailCashPrice)
        : (isWholesaleAtFirstTier ? tierResolved.wholesalePrice : tierResolved.retailPrice)
      : effectiveWholesalePrice;
    const unit1Resolved = resolveProductPricesForQuantity(product, {}, undefined, 1);
    const unit1IsWholesale = 1 >= minWholesale;
    const unit1Price = isCash
      ? (unit1IsWholesale ? unit1Resolved.wholesaleCashPrice : unit1Resolved.retailCashPrice)
      : (unit1IsWholesale ? unit1Resolved.wholesalePrice : unit1Resolved.retailPrice);

    return (
      <div className={`pt-0 sm:pt-0.5 ${className}`}>
        <div className="flex items-center gap-1 sm:gap-1.5 flex-nowrap min-w-0">
          <span
            className={`text-base sm:text-lg font-bold font-['Montserrat'] shrink-0 ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}
          >
            ${highlightPrice.toLocaleString('es-AR')}
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
            <span className="inline-flex items-center text-[12.5px] sm:text-[14px] font-medium bg-[#16a34a] text-white px-[2px] py-[2px] rounded leading-none shrink min-w-0 shadow-xs">
              <span className="overflow-hidden whitespace-nowrap text-clip block min-w-0">
                desde {firstTier ? firstTier.minQty : minWholesale} unids
              </span>
            </span>
          )}
        </div>

        <div
          className={`text-xs font-normal mt-0.5 flex items-center justify-between gap-1 flex-wrap ${
            isDark ? 'text-white/70' : 'text-gray-500'
          }`}
        >
          <span>1 unidad ${unit1Price.toLocaleString('es-AR')}</span>
          {isCash && (
            <span title="Precio en efectivo" className="inline-flex items-center text-[#16a34a] shrink-0">
              <Banknote className="w-3.5 h-3.5 text-[#16a34a]" />
            </span>
          )}
        </div>
      </div>
    );
  }

  // Modalidad Normal (sin cambios)
  return (
    <div className={`pt-0 sm:pt-0.5 ${className}`}>
      {/* Wholesale Price Highlight */}
      <div className="flex items-center gap-1 sm:gap-1.5 flex-nowrap min-w-0">
        <span
          className={`text-base sm:text-lg font-bold font-['Montserrat'] shrink-0 ${
            isDark
              ? 'text-white'
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
          <span className="inline-flex items-center text-[12.5px] sm:text-[14px] font-medium bg-[#16a34a] text-white px-[2px] py-[2px] rounded leading-none shrink min-w-0 shadow-xs">
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
          <span title="Precio en efectivo" className="inline-flex items-center text-[#16a34a] shrink-0">
            <Banknote className="w-3.5 h-3.5 text-[#16a34a]" />
          </span>
        )}
      </div>
    </div>
  );
};
