import React from 'react';

interface MichyOfficialBadgeProps {
  className?: string;
}

export const MichyOfficialBadge: React.FC<MichyOfficialBadgeProps> = ({ className = '' }) => {
  return (
    <div
      className={`w-full flex items-center justify-start gap-3.5 py-2 px-1 select-none ${className}`}
      aria-label="Tienda oficial Michy +100mil ventas"
    >
      {/* Mascot Icon */}
      <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-lg bg-[#f0f0f2] flex items-center justify-center p-1.5 shrink-0">
        <svg viewBox="0 0 500 500" className="w-full h-full" fill="currentColor">
          {/* Stylized M Logo */}
          <path
            d="M 125 45 
               L 255 220 
               L 380 45 
               L 490 375 
               L 330 375 
               L 255 220 
               L 190 355 
               L 90 232 
               L 53 365 
               C 42 385 16 385 13 366 
               C 10 348 20 330 24 315 
               Z"
            fill="#111111"
          />
          {/* Left Eye */}
          <path
            d="M 75 380 
               L 168 412 
               C 168 438 145 452 121 452 
               C 97 452 75 438 75 380 
               Z"
            fill="#111111"
          />
          {/* Right Eye */}
          <path
            d="M 305 380 
               L 212 412 
               C 212 438 235 452 259 452 
               C 283 452 305 438 305 380 
               Z"
            fill="#111111"
          />
        </svg>
      </div>

      {/* Text block */}
      <div className="flex flex-col justify-center">
        <div className="flex items-center gap-1">
          <span className="text-gray-900 font-normal text-xs sm:text-[13px] tracking-tight">
            Tienda oficial <span className="text-[#1a73e8] font-normal">Michy</span>
          </span>
          {/* Verified Badge */}
          <svg className="w-3.5 h-3.5 text-[#1a73e8] shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.79-4-4-4-.495 0-.965.084-1.4.238C14.55 2.475 13.18 1.6 11.6 1.6c-1.58 0-2.95.875-3.6 2.148-.435-.154-.905-.238-1.4-.238-2.21 0-4 1.79-4 4 0 .495.084.965.238 1.4C1.475 9.55.6 10.92.6 12.5c0 1.58.875 2.95 2.148 3.6-.154.435-.238.905-.238 1.4 0 2.21 1.79 4 4 4 .495 0 .965-.084 1.4-.238.65 1.273 2.02 2.148 3.6 2.148 1.58 0 2.95-.875 3.6-2.148.435.154.905.238 1.4.238 2.21 0 4-1.79 4-4 0-.495-.084-.965-.238-1.4 1.273-.65 2.148-2.02 2.148-3.6zM10.2 16.2l-3.5-3.5 1.4-1.4 2.1 2.1 5.6-5.6 1.4 1.4-7 7z" />
          </svg>
        </div>
        <div className="text-gray-900 font-bold text-sm sm:text-base tracking-tight leading-tight">
          +100mil ventas
        </div>
      </div>
    </div>
  );
};

export default MichyOfficialBadge;
