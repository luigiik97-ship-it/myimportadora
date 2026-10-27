import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, MapPin, Store } from 'lucide-react';
import { useModalScrollLock } from '../../utils/scrollLock';

export interface StoreLocationMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  mapImageSrc?: string;
}

export const StoreLocationMapModal: React.FC<StoreLocationMapModalProps> = ({
  isOpen,
  onClose,
  mapImageSrc = '/mapa-local-flores-ampliado.svg',
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const initialPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset zoom & pan when opening
  useEffect(() => {
    if (isOpen) {
      setZoomLevel(1);
      setPan({ x: 0, y: 0 });
      setIsDragging(false);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  // Bloqueo de scroll del fondo mientras el modal de mapa esté abierto
  useModalScrollLock(isOpen);

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 0.35, 2.5));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => {
      const next = Math.max(prev - 0.35, 1);
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
    setPan({ x: 0, y: 0 });
  };

  // Drag pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel <= 1) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    initialPanRef.current = { ...pan };
  };

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || zoomLevel <= 1) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setPan({
        x: initialPanRef.current.x + dx,
        y: initialPanRef.current.y + dy,
      });
    },
    [isDragging, zoomLevel]
  );

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch pan handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (zoomLevel <= 1 || e.touches.length !== 1) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    initialPanRef.current = { ...pan };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || zoomLevel <= 1 || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - dragStartRef.current.x;
    const dy = e.touches[0].clientY - dragStartRef.current.y;
    setPan({
      x: initialPanRef.current.x + dx,
      y: initialPanRef.current.y + dy,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  if (!isOpen) return null;

  return (
    <div
      id="store-map-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs transition-opacity animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="store-map-modal-title"
    >
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[92vh] animate-scaleUp">
        {/* Header */}
        <div className="px-4 sm:px-5 py-3 sm:py-3.5 border-b border-gray-100 flex items-center justify-between bg-white z-10 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <div className="w-8 h-8 rounded-full bg-blue-50 text-[#0058bb] flex items-center justify-center shrink-0">
              <Store className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3
                id="store-map-modal-title"
                className="text-sm sm:text-base font-bold text-gray-900 truncate"
              >
                Avenida San Pedrito 28, Flores
              </h3>
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className="font-semibold text-gray-700">Local 4</span>
                <span aria-hidden="true">·</span>
                <span className="text-[#0058bb] font-medium truncate">
                  A metros de Av. Rivadavia y Subte A
                </span>
              </div>
            </div>
          </div>

          <button
            id="close-store-map-modal-btn"
            type="button"
            onClick={onClose}
            className="p-1.5 sm:p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer shrink-0"
            aria-label="Cerrar mapa"
            title="Cerrar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Map Viewport Container */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className={`relative bg-[#f4f3f0] flex-1 min-h-[300px] sm:min-h-[380px] overflow-hidden select-none ${
            zoomLevel > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
          }`}
        >
          {/* Zoom controls floating in top-right */}
          <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5 bg-white/95 backdrop-blur-md p-1.5 rounded-xl shadow-md border border-gray-200/80">
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoomLevel >= 2.5}
              className="p-1.5 text-gray-700 hover:bg-gray-100 disabled:opacity-40 rounded-lg transition-colors cursor-pointer"
              title="Acercar mapa (+)"
              aria-label="Acercar mapa"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoomLevel <= 1}
              className="p-1.5 text-gray-700 hover:bg-gray-100 disabled:opacity-40 rounded-lg transition-colors cursor-pointer"
              title="Alejar mapa (-)"
              aria-label="Alejar mapa"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            {zoomLevel > 1 && (
              <button
                type="button"
                onClick={handleResetZoom}
                className="p-1.5 text-[#0058bb] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                title="Restablecer tamaño normal"
                aria-label="Restablecer zoom"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Indicator of zoom level if active */}
          {zoomLevel > 1 && (
            <div className="absolute bottom-3 left-3 z-20 bg-gray-900/80 text-white text-[11px] font-medium px-2 py-0.5 rounded-full backdrop-blur-xs">
              Zoom: {Math.round(zoomLevel * 100)}% (Arrastrá para moverte)
            </div>
          )}

          {/* Map Image Layer with transform */}
          <div
            className="w-full h-full flex items-center justify-center transition-transform duration-100 ease-out"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel})`,
              transformOrigin: 'center center',
            }}
          >
            <img
              src={mapImageSrc}
              alt="Plano geográfico de Flores: Av. San Pedrito 28 Local 4 y Estación Subte A"
              className="w-full h-full object-contain pointer-events-none max-h-[500px]"
              draggable={false}
              loading="eager"
            />
          </div>
        </div>

        {/* Footer info bar */}
        <div className="px-4 sm:px-5 py-2.5 sm:py-3 bg-gray-50/90 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs text-gray-600 shrink-0">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
            <span>
              <strong>Av. San Pedrito 28</strong>, Local 4, Flores, CABA
            </span>
          </div>
          <span className="text-gray-500 text-[11px] sm:text-xs">
            Lunes a sábados de 11:00 hs a 17:00 hs
          </span>
        </div>
      </div>
    </div>
  );
};
