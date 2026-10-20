import React from 'react';

interface MichyOfficialBadgeProps {
  className?: string;
}

export const MichyOfficialBadge: React.FC<MichyOfficialBadgeProps> = ({ className = '' }) => {
  return (
    <div
      className={`w-full flex items-center justify-start gap-2.5 sm:gap-3 py-1.5 select-none ${className}`}
      aria-label="Tienda oficial Michy - 10 años establecido - +100mil ventas - Importador directo"
    >
      {/* Michy Mascot Icon (Black cat silhouette on light gray rounded square) */}
      <div className="w-11 h-11 min-[380px]:w-12 min-[380px]:h-12 sm:w-13 sm:h-13 rounded-xl sm:rounded-2xl bg-[#f2f2f4] flex items-center justify-center p-1.5 sm:p-2 shrink-0 shadow-2xs">
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

      {/* 2-Row / 2-Column Information Grid */}
      <div className="grid grid-cols-[auto_1px_auto] items-center gap-x-2 sm:gap-x-2.5 gap-y-1 sm:gap-y-1.5">
        {/* ROW 1 - LEFT: Tienda oficial Michy + Verified Badge */}
        <div className="flex items-center gap-1 sm:gap-1.5 whitespace-nowrap">
          <span className="text-gray-900 font-normal text-[11px] min-[360px]:text-[12px] min-[400px]:text-[13px] sm:text-sm tracking-tight leading-tight">
            Tienda oficial <span className="text-[#2f83ff] font-bold">Michy</span>
          </span>
          {/* Blue Scalloped Rosette with White Checkmark */}
          <svg className="w-3.5 h-3.5 min-[380px]:w-4 min-[380px]:h-4 shrink-0" viewBox="0 0 24 24">
            <path
              d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.79-4-4-4-.495 0-.965.084-1.4.238C14.55 2.475 13.18 1.6 11.6 1.6c-1.58 0-2.95.875-3.6 2.148-.435-.154-.905-.238-1.4-.238-2.21 0-4 1.79-4 4 0 .495.084.965.238 1.4C1.475 9.55.6 10.92.6 12.5c0 1.58.875 2.95 2.148 3.6-.154.435-.238.905-.238 1.4 0 2.21 1.79 4 4 4 .495 0 .965-.084 1.4-.238.65 1.273 2.02 2.148 3.6 2.148 1.58 0 2.95-.875 3.6-2.148.435.154.905.238 1.4.238 2.21 0 4-1.79 4-4 0-.495-.084-.965-.238-1.4 1.273-.65 2.148-2.02 2.148-3.6z"
              fill="#2f83ff"
            />
            <path
              d="M10.2 16.2l-3.5-3.5 1.4-1.4 2.1 2.1 5.6-5.6 1.4 1.4-7 7z"
              fill="#ffffff"
            />
          </svg>
        </div>

        {/* ROW 1 - DIVIDER */}
        <div className="h-3.5 sm:h-4 w-px bg-gray-300 shrink-0 self-center" />

        {/* ROW 1 - RIGHT: Calendar Icon + 10 años establecido */}
        <div className="flex items-center gap-1 sm:gap-1.5 whitespace-nowrap">
          {/* Black Outline Calendar Icon with Rings and 6 Grid Dots */}
          <svg
            className="w-3.5 h-3.5 min-[380px]:w-4 min-[380px]:h-4 text-gray-900 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="4" width="18" height="18" rx="3" ry="3" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
            <circle cx="8" cy="14" r="0.8" fill="currentColor" stroke="none" />
            <circle cx="12" cy="14" r="0.8" fill="currentColor" stroke="none" />
            <circle cx="16" cy="14" r="0.8" fill="currentColor" stroke="none" />
            <circle cx="8" cy="18" r="0.8" fill="currentColor" stroke="none" />
            <circle cx="12" cy="18" r="0.8" fill="currentColor" stroke="none" />
            <circle cx="16" cy="18" r="0.8" fill="currentColor" stroke="none" />
          </svg>
          <span className="text-gray-900 font-normal text-[11px] min-[360px]:text-[12px] min-[400px]:text-[13px] sm:text-sm tracking-tight leading-tight">
            <span className="text-[#2f83ff] font-bold">10 años</span> establecido
          </span>
        </div>

        {/* ROW 2 - LEFT: +100mil ventas */}
        <div className="flex items-center gap-1 sm:gap-1.5 whitespace-nowrap">
          <span className="text-gray-950 font-extrabold text-[13px] min-[360px]:text-[14px] min-[400px]:text-[15px] sm:text-[15.5px] md:text-[16.5px] tracking-tight leading-none">
            +100mil ventas
          </span>
        </div>

        {/* ROW 2 - DIVIDER */}
        <div className="h-4 sm:h-4.5 w-px bg-gray-300 shrink-0 self-center -translate-x-6 min-[380px]:-translate-x-3.5 sm:translate-x-0" />

        {/* ROW 2 - RIGHT: Speed Delivery Box Icon + Importador directo */}
        <div className="flex items-center gap-1.5 sm:gap-2 whitespace-nowrap shrink-0 -translate-x-6 min-[380px]:-translate-x-3.5 sm:translate-x-0">
          {/* Blue Isometric Delivery Box with 3 Speed Motion Lines */}
          <svg
            className="w-4.5 h-4.5 min-[380px]:w-5 min-[380px]:h-5 sm:w-5.5 sm:h-5.5 text-[#2f83ff] shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* 3 Speed Motion Lines on the Left */}
            <line x1="1" y1="9" x2="6" y2="9" />
            <line x1="0" y1="13" x2="7" y2="13" />
            <line x1="2" y1="17" x2="6" y2="17" />
            {/* Isometric Package Box */}
            <path d="M15.5 3.5L22 7L15.5 10.5L9 7Z" />
            <path d="M9 7V14.5L15.5 18V10.5" />
            <path d="M22 7V14.5L15.5 18" />
            {/* Top Tape Line */}
            <path d="M12.5 5.25L19 8.75" />
          </svg>
          <span className="text-gray-950 font-extrabold text-[13px] min-[360px]:text-[14px] min-[400px]:text-[15px] sm:text-[15.5px] md:text-[16.5px] tracking-tight leading-none">
            Importador directo
          </span>
        </div>
      </div>
    </div>
  );
};

export default MichyOfficialBadge;
