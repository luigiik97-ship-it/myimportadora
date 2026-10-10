import React from 'react';

interface WholesaleCategoryProgressCardProps {
  currentQty: number;
  minQty: number;
  isProductDetail?: boolean;
  className?: string;
  hideTitle?: boolean;
  frameless?: boolean;
}

export const WholesaleCategoryProgressCard: React.FC<WholesaleCategoryProgressCardProps> = ({
  currentQty,
  minQty,
  isProductDetail = false,
  className = '',
  hideTitle = false,
  frameless = false,
}) => {
  const safeMin = Math.max(1, minQty);
  const isReached = currentQty >= safeMin;
  const percentage = Math.min(100, Math.max(0, Math.round((currentQty / safeMin) * 100)));
  const remainingQty = Math.max(1, safeMin - currentQty);
  const remainingNoun = remainingQty === 1 ? 'producto' : 'productos';

  return (
    <div
      className={`${
        frameless
          ? 'space-y-1.5 transition-all select-none px-0.5 py-1'
          : 'bg-white border border-gray-200/90 rounded-xl p-2 sm:p-2.5 shadow-2xs space-y-1.5 transition-all select-none'
      } ${className}`}
    >
      {/* Título de estado con el mismo tamaño que la tarjeta de descuento en efectivo */}
      {!hideTitle && (
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold text-[14.5px] text-gray-900 leading-tight">
            {isReached ? 'Precio mayorista alcanzado' : 'Alcanza el precio mayorista en tu compra'}
          </span>
        </div>
      )}

      {/* Barra de progreso dinámica con círculo en el extremo estilo Mercado Libre */}
      <div
        className="relative w-full h-1.5 sm:h-2 bg-gray-200 rounded-full my-1 sm:my-1.5"
        role="progressbar"
        aria-valuenow={currentQty}
        aria-valuemin={0}
        aria-valuemax={safeMin}
      >
        {/* Relleno de la barra */}
        <div
          className={`h-full rounded-full transition-all duration-300 ease-out ${
            isReached ? 'bg-[#00a650]' : 'bg-[#0058bb]'
          }`}
          style={{ width: `${percentage}%` }}
        />

        {/* Círculo en el extremo de la barra estilo Mercado Libre */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full border-2 border-white shadow-xs pointer-events-none transition-all duration-300 ease-out ${
            isReached ? 'bg-[#00a650]' : 'bg-[#0058bb]'
          }`}
          style={{
            left: `clamp(6px, ${percentage}%, calc(100% - 6px))`,
          }}
        />
      </div>

      {/* Mensaje descriptivo con el mismo tamaño que la tarjeta de descuento en efectivo */}
      <p
        className={`text-xs sm:text-sm mt-0.5 leading-tight ${
          isReached ? 'text-[#00a650] font-semibold' : 'text-gray-600 font-normal'
        }`}
      >
        {isReached
          ? '¡Ya accedés al precio mayorista!'
          : isProductDetail
          ? 'Agregá este producto y productos de la misma categoría para conseguirlo'
          : `Agregá ${remainingQty} ${remainingNoun} de esta misma categoría para conseguir el precio mayorista`}
      </p>
    </div>
  );
};

