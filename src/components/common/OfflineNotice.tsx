import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

interface OfflineNoticeProps {
  onRetry?: () => void;
  isChecking?: boolean;
}

/**
 * Pantalla minimalista estilo Mercado Libre para pérdida de conexión a internet.
 * Mantiene la estética limpia, profesional y ultraliviana sin elementos rotos.
 */
export const OfflineNotice: React.FC<OfflineNoticeProps> = ({
  onRetry,
  isChecking = false,
}) => {
  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex-1 w-full bg-white flex flex-col items-center justify-center px-4 py-16 sm:py-24 text-center select-none min-h-[60vh]"
    >
      <div className="max-w-md w-full mx-auto flex flex-col items-center space-y-4 sm:space-y-5 animate-fadeIn">
        {/* Ícono de conexión perdida en pastilla sobria */}
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
          <WifiOff className="w-8 h-8 sm:w-10 sm:h-10 stroke-[1.8]" />
        </div>

        {/* Mensaje principal */}
        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 font-['Montserrat'] tracking-tight">
            Sin conexión a internet
          </h1>
          <p className="text-sm sm:text-base text-gray-500 max-w-sm mx-auto leading-relaxed">
            Revisa tu conexión para seguir navegando. Se reanudará automáticamente cuando vuelva la señal.
          </p>
        </div>

        {/* Botón de reintento manual */}
        <div className="pt-2">
          <button
            type="button"
            onClick={onRetry}
            disabled={isChecking}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-800 font-semibold text-xs sm:text-sm transition-colors shadow-2xs cursor-pointer disabled:opacity-60 min-h-[42px]"
          >
            <RefreshCw className={`w-4 h-4 text-gray-600 ${isChecking ? 'animate-spin' : ''}`} />
            <span>{isChecking ? 'Comprobando conexión...' : 'Reintentar conexión'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
