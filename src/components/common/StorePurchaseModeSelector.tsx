import React from 'react';
import { usePurchaseMode, PurchaseMode } from '../../context/PurchaseModeContext';
import { Banknote, ArrowLeftRight, Check } from 'lucide-react';

interface StorePurchaseModeSelectorProps {
  className?: string;
  onModeChange?: (mode: PurchaseMode) => void;
}

export const StorePurchaseModeSelector: React.FC<StorePurchaseModeSelectorProps> = ({
  className = '',
  onModeChange,
}) => {
  const { purchaseMode, setPurchaseMode, isCashMode } = usePurchaseMode();

  const handleSelectMode = (mode: PurchaseMode) => {
    if (mode === purchaseMode) return;
    setPurchaseMode(mode);
    onModeChange?.(mode);
  };

  return (
    <div
      id="store-purchase-mode-selector"
      className={`w-full !-mt-1.5 sm:!-mt-1 mb-2.5 sm:mb-3.5 ${className}`}
    >
      {/* Texto dentro de una tarjeta blanca compacta en un solo renglón */}
      <p className="w-full h-8 sm:h-9 bg-white border border-gray-200/90 rounded-xl px-2 sm:px-3 mb-1.5 sm:mb-2 shadow-2xs text-center text-[11px] min-[360px]:text-[11.5px] min-[390px]:text-[12.5px] sm:text-sm font-semibold text-gray-800 tracking-tight whitespace-nowrap overflow-hidden text-ellipsis flex items-center justify-center">
        Activa precio en efectivo, exclusivo para retiro en el local
      </p>

      {/* Barra de botones minimalista que se extiende hasta los márgenes */}
      <div className="w-full bg-[#f1f3f5] border border-gray-300 rounded-xl sm:rounded-2xl flex items-stretch overflow-hidden shadow-2xs">
        {/* Opción: Transferencia */}
        <button
          type="button"
          id="btn-mode-transfer"
          onClick={() => handleSelectMode('transfer')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 sm:py-2.5 px-3 sm:px-4 text-sm sm:text-base font-semibold transition-all cursor-pointer select-none ${
            !isCashMode
              ? 'bg-[#0058bb] text-white shadow-xs'
              : 'text-gray-700 hover:text-gray-900 hover:bg-gray-200/50'
          }`}
          aria-pressed={!isCashMode}
        >
          <ArrowLeftRight className={`w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0 ${!isCashMode ? 'text-white' : 'text-gray-500'}`} />
          <span>Transferencia</span>
        </button>

        {/* Opción: Efectivo */}
        <button
          type="button"
          id="btn-mode-cash"
          onClick={() => handleSelectMode('cash')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 sm:py-2.5 px-3 sm:px-4 text-sm sm:text-base font-semibold transition-all cursor-pointer select-none ${
            isCashMode
              ? 'bg-[#16a34a] text-white shadow-xs'
              : 'text-gray-700 hover:text-emerald-800 hover:bg-gray-200/50'
          }`}
          aria-pressed={isCashMode}
          title="Efectivo exclusivo para retiro en local"
        >
          <Banknote className={`w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0 ${isCashMode ? 'text-white' : 'text-gray-500'}`} />
          <span>Efectivo</span>
          <span
            className={`text-[11px] sm:text-xs font-medium px-2 py-0.5 rounded-full border leading-tight ${
              isCashMode
                ? 'border-white/80 text-white bg-white/10'
                : 'border-gray-500 text-gray-700 bg-transparent'
            }`}
          >
            en local
          </span>
        </button>
      </div>

      {/* Mensaje dinámico cuando el modo efectivo está activo */}
      {isCashMode && (
        <div className="mt-2 flex items-center text-[11px] sm:text-xs text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-3 py-1.5 rounded-lg animate-fadeIn">
          <div className="flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Precios en efectivo activados en toda la tienda.</span>
          </div>
        </div>
      )}
    </div>
  );
};
