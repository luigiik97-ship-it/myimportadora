import React from 'react';
import { usePurchaseMode, PurchaseMode } from '../../context/PurchaseModeContext';
import { Banknote, Check } from 'lucide-react';

interface StorePurchaseModeSelectorProps {
  className?: string;
  onModeChange?: (mode: PurchaseMode) => void;
}

export const StorePurchaseModeSelector: React.FC<StorePurchaseModeSelectorProps> = ({
  className = '',
  onModeChange,
}) => {
  const { setPurchaseMode, isCashMode } = usePurchaseMode();

  const handleToggle = () => {
    const nextMode: PurchaseMode = isCashMode ? 'transfer' : 'cash';
    setPurchaseMode(nextMode);
    onModeChange?.(nextMode);
  };

  return (
    <div
      id="store-purchase-mode-selector"
      className={`w-full ${className}`}
    >
      {/* Tarjeta compacta: fondo blanco limpio, texto a la izquierda en dos renglones y botón único 'efectivo' a la derecha */}
      <div className="w-full bg-white border border-gray-300 rounded-2xl overflow-hidden shadow-2xs flex items-stretch justify-between">
        <div className="py-1.5 sm:py-3.5 pl-3.5 sm:pl-5 pr-2 flex flex-col justify-center min-w-0">
          <span className="font-bold text-gray-950 text-xs sm:text-[14px] leading-tight tracking-tight">
            Activa precio en efectivo
          </span>
          <span className="text-[11px] sm:text-xs text-gray-500 font-normal leading-tight mt-0.5">
            exclusivo para retiro en local
          </span>
        </div>

        <button
          type="button"
          id="btn-mode-cash"
          onClick={handleToggle}
          className={`shrink-0 flex items-center justify-center gap-2 sm:gap-2.5 px-4.5 sm:px-7 py-2 sm:py-3.5 rounded-l-2xl border-l transition-all cursor-pointer select-none ${
            isCashMode
              ? 'bg-[#16a34a] text-white border-[#15803d] shadow-xs'
              : 'bg-[#f1f3f5] hover:bg-[#e9ecef] text-gray-900 border-gray-300'
          }`}
          aria-pressed={isCashMode}
          title="Activar o desactivar precio en efectivo"
        >
          <Banknote
            className={`w-4 h-4 sm:w-5 sm:h-5 shrink-0 stroke-[1.9] ${
              isCashMode ? 'text-white' : 'text-gray-800'
            }`}
          />
          <span className="text-xs sm:text-[14px] font-bold tracking-tight leading-none">Efectivo</span>
        </button>
      </div>

      {/* Mensaje existente cuando el modo efectivo está activo */}
      {isCashMode && (
        <div className="mt-2 flex items-center text-[11px] sm:text-xs text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-3 py-1.5 rounded-lg animate-fadeIn">
          <div className="flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Precio en efectivo activado en toda la tienda</span>
          </div>
        </div>
      )}
    </div>
  );
};
