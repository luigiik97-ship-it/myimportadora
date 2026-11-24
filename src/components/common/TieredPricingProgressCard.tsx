import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Check } from 'lucide-react';
import { PriceTier } from '../../types';
import { getTierProgress } from '../../utils/variantHelpers';

interface TieredPricingProgressCardProps {
  tiers: PriceTier[];
  currentQty: number;
  minWholesaleQty?: number;
  isCashMode: boolean;
  compact?: boolean;
  isProductDetail?: boolean;
  className?: string;
  frameless?: boolean;
  messageClassName?: string;
}

export const TieredPricingProgressCard: React.FC<TieredPricingProgressCardProps> = ({
  tiers,
  currentQty,
  minWholesaleQty = 1,
  isCashMode,
  compact = false,
  isProductDetail = false,
  className = '',
  frameless = false,
  messageClassName,
}) => {
  const effectiveMessageClassName =
    messageClassName ?? (isProductDetail ? 'text-sm sm:text-sm' : 'text-xs sm:text-sm');
  const [showAllTiers, setShowAllTiers] = useState(false);

  if (!tiers || tiers.length === 0) return null;

  const progress = getTierProgress(tiers, currentQty);
  const { activeTier, nextTier, missingForNext, progressPercent, isTopTierReached } = progress;

  const getTierDisplayPrice = (tier: PriceTier): number => {
    const isWholesaleAtTier = tier.minQty >= Math.max(1, minWholesaleQty);
    if (isCashMode) {
      return isWholesaleAtTier
        ? (tier.wholesaleCashPrice > 0 ? tier.wholesaleCashPrice : tier.wholesalePrice)
        : (tier.retailCashPrice > 0 ? tier.retailCashPrice : tier.retailPrice);
    }
    return isWholesaleAtTier
      ? (tier.wholesalePrice > 0 ? tier.wholesalePrice : tier.retailPrice)
      : (tier.retailPrice > 0 ? tier.retailPrice : tier.wholesalePrice);
  };

  const visibleTiers = showAllTiers ? tiers : tiers.slice(0, 3);
  const hasMoreTiers = tiers.length > 3;

  const nextTierPrice = nextTier ? getTierDisplayPrice(nextTier) : 0;
  const missingNoun = missingForNext === 1 ? 'unidad' : 'unidades';

  return (
    <div
      className={`${
        frameless
          ? 'space-y-2 transition-all select-none px-0.5 py-1'
          : 'bg-white border border-gray-200/90 rounded-xl p-2.5 sm:p-3 shadow-2xs space-y-2 transition-all select-none'
      } ${className}`}
    >
      {/* Encabezado de estado */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span
          className={`font-bold text-gray-900 leading-tight ${
            isProductDetail ? 'text-sm sm:text-[14.5px]' : 'text-[14px] sm:text-[14.5px]'
          }`}
        >
          {activeTier
            ? `Escalón alcanzado: desde ${activeTier.minQty} ${activeTier.minQty === 1 ? 'unidad' : 'unidades'}`
            : 'Precios escalonados por cantidad'}
        </span>
        {currentQty > 0 && (
          <span
            className={`font-semibold text-gray-500 ${
              isProductDetail ? 'hidden' : 'text-[11px]'
            }`}
          >
            {currentQty} {currentQty === 1 ? 'unidad' : 'unidades'}
          </span>
        )}
      </div>

      {/* Barra de progreso escalonada */}
      <div
        className="relative w-full h-1.5 sm:h-2 bg-gray-200 rounded-full my-1.5"
        role="progressbar"
        aria-valuenow={progressPercent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ease-out ${
            activeTier ? 'bg-[#00a650]' : 'bg-[#0058bb]'
          }`}
          style={{ width: `${progressPercent}%` }}
        />
        <div
          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full border-2 border-white shadow-xs pointer-events-none transition-all duration-300 ease-out ${
            activeTier ? 'bg-[#00a650]' : 'bg-[#0058bb]'
          }`}
          style={{
            left: `clamp(6px, ${progressPercent}%, calc(100% - 6px))`,
          }}
        />
      </div>

      {/* Mensaje de avance al siguiente escalón */}
      <p
        className={`${effectiveMessageClassName} leading-tight ${
          isTopTierReached
            ? 'text-[#00a650] font-semibold'
            : activeTier
            ? 'text-gray-700 font-medium'
            : 'text-gray-600 font-normal'
        }`}
      >
        {isTopTierReached ? (
          '¡Alcanzaste el mejor precio escalonado de esta publicación!'
        ) : nextTier ? (
          <>
            Te {missingForNext === 1 ? 'falta' : 'faltan'}{' '}
            <strong className="text-gray-900">
              {missingForNext} {missingNoun}
            </strong>{' '}
            para pasar a{' '}
            <strong className="text-[#00a650]">
              ${nextTierPrice.toLocaleString('es-AR')} c/u
            </strong>{' '}
            (desde {nextTier.minQty} u.)
          </>
        ) : null}
      </p>

      {/* Lista vertical de escalones (hasta 3 inicialmente) */}
      {!compact && (
        <div className="pt-1 border-t border-gray-100 space-y-1">
          {visibleTiers.map((tier) => {
            const isCurrentActive = activeTier?.minQty === tier.minQty;
            const isReached = currentQty >= tier.minQty;
            const tierPrice = getTierDisplayPrice(tier);

            return (
              <div
                key={tier.id || tier.minQty}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors ${
                  isProductDetail ? 'text-sm sm:text-xs' : 'text-xs'
                } ${
                  isCurrentActive
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold'
                    : isReached
                    ? 'bg-gray-50/80 text-gray-600'
                    : 'bg-white border border-gray-100 text-gray-700'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  {isCurrentActive && (
                    <Check className="w-3.5 h-3.5 text-[#00a650] shrink-0" />
                  )}
                  <span className="truncate">
                    Desde {tier.minQty} {tier.minQty === 1 ? 'unidad' : 'unidades'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={`font-['Montserrat'] ${
                      isCurrentActive ? 'text-[#00a650] font-bold' : 'text-gray-900 font-semibold'
                    }`}
                  >
                    ${tierPrice.toLocaleString('es-AR')}
                  </span>
                  <span
                    className={`text-gray-500 font-normal ${
                      isProductDetail ? 'text-sm sm:text-[10.5px]' : 'text-[10.5px]'
                    }`}
                  >
                    c/u
                  </span>
                </div>
              </div>
            );
          })}

          {hasMoreTiers && (
            <button
              type="button"
              onClick={() => setShowAllTiers((prev) => !prev)}
              className={`w-full pt-1 font-semibold text-[#0058bb] hover:text-[#004494] flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                isProductDetail ? 'text-sm sm:text-xs' : 'text-xs'
              }`}
            >
              <span>{showAllTiers ? 'Ver menos precios' : 'Ver todos los precios'}</span>
              {showAllTiers ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
