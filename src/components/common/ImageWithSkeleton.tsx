import React, { useState, useEffect, useRef } from 'react';
import { getOptimizedImageUrl, getOptimizedSrcSet } from '../../utils/imageOptimizer';

// In-memory set of already loaded image URLs to prevent re-shimmering when navigating
const loadedImageUrls = new Set<string>();

interface ImageWithSkeletonProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  aspectRatio?: string;
  fallbackSrc?: string;
  showShimmer?: boolean;
  targetWidth?: number;
  quality?: number;
  priority?: boolean;
}

const NEUTRAL_FALLBACK_SVG = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" fill="%23f8fafc" viewBox="0 0 400 400"><rect width="400" height="400" fill="%23f8fafc"/><path d="M160 180 L200 230 L230 200 L270 250 L130 250 Z" fill="%23cbd5e1"/><circle cx="165" cy="155" r="15" fill="%23cbd5e1"/></svg>';

export const ImageWithSkeleton: React.FC<ImageWithSkeletonProps> = ({
  src,
  alt,
  className = '',
  imgClassName = '',
  aspectRatio,
  fallbackSrc = NEUTRAL_FALLBACK_SVG,
  showShimmer = true,
  loading,
  decoding = 'async',
  fetchPriority,
  targetWidth,
  quality,
  priority = false,
  onError,
  onLoad,
  ...restProps
}) => {
  const resolvedLoading: 'eager' | 'lazy' = priority ? 'eager' : (loading || 'lazy');
  const resolvedFetchPriority: 'high' | 'low' | 'auto' | undefined = priority
    ? 'high'
    : (fetchPriority as 'high' | 'low' | 'auto' | undefined);
  const optimizedSrc = getOptimizedImageUrl(src, { width: targetWidth || 600, quality: quality || 75 });
  const isPreloaded = loadedImageUrls.has(optimizedSrc) || loadedImageUrls.has(src);
  const [isLoaded, setIsLoaded] = useState<boolean>(isPreloaded);
  const [hasError, setHasError] = useState<boolean>(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (loadedImageUrls.has(optimizedSrc) || loadedImageUrls.has(src)) {
      setIsLoaded(true);
      return;
    }

    setHasError(false);
    // Check if the browser has already cached/completed the image
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      loadedImageUrls.add(optimizedSrc);
      setIsLoaded(true);
    } else {
      setIsLoaded(false);
    }
  }, [optimizedSrc, src]);

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    loadedImageUrls.add(optimizedSrc);
    setIsLoaded(true);
    if (onLoad) {
      onLoad(e);
    }
  };

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setHasError(true);
    setIsLoaded(true);
    if (onError) {
      onError(e);
    }
  };

  const displaySrc = hasError ? getOptimizedImageUrl(fallbackSrc, { width: targetWidth || 400 }) : optimizedSrc;
  const responsiveSrcSet = !hasError && !restProps.srcSet ? getOptimizedSrcSet(src) : restProps.srcSet;

  // Ensure object-fit is properly applied to the <img> tag so images never distort on zoom or responsive layout
  const hasExplicitCover = className.includes('object-cover') || imgClassName.includes('object-cover');
  const hasExplicitContain = className.includes('object-contain') || imgClassName.includes('object-contain');
  const resolvedObjectFit = hasExplicitCover
    ? 'object-cover'
    : hasExplicitContain
    ? 'object-contain'
    : 'object-contain';

  // Clean wrapper className so object-fit isn't placed on a container div
  const cleanedContainerClass = className
    .replace(/\bobject-(contain|cover|fill|none|scale-down)\b/g, '')
    .trim();

  return (
    <div
      className={`relative overflow-hidden flex items-center justify-center ${aspectRatio || ''} ${cleanedContainerClass}`}
      style={aspectRatio ? undefined : { width: '100%', height: '100%' }}
    >
      {/* Shimmer skeleton shown while loading */}
      {!isLoaded && showShimmer && (
        <div
          className="absolute inset-0 bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 animate-pulse z-0"
          aria-hidden="true"
        />
      )}

      {/* Actual image - aspect ratio preserved under all zoom levels */}
      <img
        ref={imgRef}
        src={displaySrc}
        srcSet={responsiveSrcSet || undefined}
        alt={alt}
        loading={loading}
        decoding={decoding}
        fetchPriority={fetchPriority}
        onLoad={handleLoad}
        onError={handleError}
        className={`w-full h-full max-w-full max-h-full ${resolvedObjectFit} transition-opacity duration-300 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        } ${imgClassName}`}
        {...restProps}
      />
    </div>
  );
};
