import React, { useState, useEffect, useRef } from 'react';

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
}

export const ImageWithSkeleton: React.FC<ImageWithSkeletonProps> = ({
  src,
  alt,
  className = '',
  imgClassName = '',
  aspectRatio,
  fallbackSrc = 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800',
  showShimmer = true,
  loading = 'lazy',
  decoding = 'async',
  fetchPriority,
  onError,
  onLoad,
  ...restProps
}) => {
  const isPreloaded = loadedImageUrls.has(src);
  const [isLoaded, setIsLoaded] = useState<boolean>(isPreloaded);
  const [hasError, setHasError] = useState<boolean>(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (loadedImageUrls.has(src)) {
      setIsLoaded(true);
      return;
    }

    setHasError(false);
    // Check if the browser has already cached/completed the image
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      loadedImageUrls.add(src);
      setIsLoaded(true);
    } else {
      setIsLoaded(false);
    }
  }, [src]);

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    loadedImageUrls.add(src);
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

  const displaySrc = hasError ? fallbackSrc : src;

  return (
    <div
      className={`relative overflow-hidden ${aspectRatio || ''} ${className}`}
      style={aspectRatio ? undefined : { width: '100%', height: '100%' }}
    >
      {/* Shimmer skeleton shown while loading */}
      {!isLoaded && showShimmer && (
        <div
          className="absolute inset-0 bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 animate-pulse z-0"
          aria-hidden="true"
        />
      )}

      {/* Actual image */}
      <img
        ref={imgRef}
        src={displaySrc}
        alt={alt}
        loading={loading}
        decoding={decoding}
        fetchPriority={fetchPriority}
        onLoad={handleLoad}
        onError={handleError}
        className={`w-full h-full transition-opacity duration-300 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        } ${imgClassName}`}
        {...restProps}
      />
    </div>
  );
};
