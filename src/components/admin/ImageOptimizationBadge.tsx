import React, { useState, useEffect } from 'react';
import { Sparkles, CheckCircle2, Info } from 'lucide-react';
import { getOptimizationStatsForUrl, OptimizationResult } from '../../utils/imageOptimizer';

export interface ImageOptimizationInfo {
  originalSizeKB: number;
  optimizedSizeKB: number;
  savedPercent: number;
  width: number;
  height: number;
  format: 'webp' | 'jpeg' | string;
  isCover?: boolean;
}

interface ImageOptimizationBadgeProps {
  imageUrl?: string | null;
  stats?: ImageOptimizationInfo | OptimizationResult | null;
  className?: string;
  compact?: boolean;
  align?: 'left' | 'center' | 'right';
}

/**
 * Badge discreto exclusivo del Panel de Administración para mostrar
 * métricas reales de optimización: dimensiones, peso final, formato
 * y ahorro porcentual respecto al archivo original.
 */
export const ImageOptimizationBadge: React.FC<ImageOptimizationBadgeProps> = ({
  imageUrl,
  stats: directStats,
  className = '',
  compact = false,
  align = 'left',
}) => {
  const [resolvedStats, setResolvedStats] = useState<ImageOptimizationInfo | null>(
    (directStats as ImageOptimizationInfo) || null
  );

  useEffect(() => {
    if (directStats) {
      setResolvedStats(directStats as ImageOptimizationInfo);
      return;
    }

    if (imageUrl) {
      const cached = getOptimizationStatsForUrl(imageUrl);
      if (cached) {
        setResolvedStats(cached);
        return;
      }

      // Si no hay estadísticas de compresión en sesión, detectar dimensiones y formato de la URL
      if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        let isCancelled = false;
        const img = new Image();
        img.onload = () => {
          if (isCancelled) return;
          const w = img.naturalWidth || 0;
          const h = img.naturalHeight || 0;
          const ext = imageUrl.split('.').pop()?.split('?')[0]?.toLowerCase() || '';
          const format = ext === 'webp' ? 'webp' : ext === 'jpg' || ext === 'jpeg' ? 'jpeg' : 'webp';

          if (w > 0 && h > 0) {
            setResolvedStats({
              originalSizeKB: 0,
              optimizedSizeKB: 0,
              savedPercent: 0,
              width: w,
              height: h,
              format,
            });
          }
        };
        img.src = imageUrl;
        return () => {
          isCancelled = true;
        };
      }
    }

    setResolvedStats(null);
  }, [imageUrl, directStats]);

  if (!resolvedStats || (resolvedStats.width === 0 && resolvedStats.optimizedSizeKB === 0)) {
    return null;
  }

  const {
    originalSizeKB,
    optimizedSizeKB,
    savedPercent,
    width,
    height,
    format,
  } = resolvedStats;

  const formatLabel = (format || 'WEBP').toUpperCase();
  const formatOriginal = (kb: number) => {
    if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB`;
    return `${kb.toFixed(0)} KB`;
  };

  const justifyClass =
    align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start';

  if (compact) {
    return (
      <div className={`flex items-center ${justifyClass} ${className}`}>
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-50/90 text-emerald-800 border border-emerald-200/70 shadow-2xs"
          title={`Optimizado para admin: ${width}×${height}px, ${optimizedSizeKB > 0 ? `${optimizedSizeKB.toFixed(0)} KB` : ''} (${formatLabel})${
            originalSizeKB > 0 ? ` - Original: ${formatOriginal(originalSizeKB)} (-${savedPercent.toFixed(0)}%)` : ''
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          <span className="font-bold">{formatLabel}</span>
          {width > 0 && <span>{width}×{height}</span>}
          {optimizedSizeKB > 0 && (
            <>
              <span className="text-gray-300">•</span>
              <span className="font-semibold">{optimizedSizeKB.toFixed(0)}KB</span>
            </>
          )}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex items-center ${justifyClass} ${className}`}>
      <div className="inline-flex items-center flex-wrap gap-1.5 px-2 py-0.75 rounded-md bg-emerald-50/95 border border-emerald-200/80 text-[10.5px] font-mono text-emerald-900 shadow-2xs select-none">
        <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-100/80 px-1 py-0.2 rounded text-[9.5px] tracking-wide">
          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
          {formatLabel}
        </span>

        {width > 0 && height > 0 && (
          <span className="text-gray-700 font-medium">
            {width}×{height}px
          </span>
        )}

        {optimizedSizeKB > 0 && (
          <>
            <span className="text-emerald-300">•</span>
            <span className="font-bold text-emerald-900">
              {optimizedSizeKB.toFixed(0)} KB
            </span>
          </>
        )}

        {originalSizeKB > 0 && savedPercent > 0 && (
          <>
            <span className="text-emerald-300">•</span>
            <span className="text-emerald-700 font-normal">
              (-{savedPercent.toFixed(0)}% de {formatOriginal(originalSizeKB)})
            </span>
          </>
        )}
      </div>
    </div>
  );
};
