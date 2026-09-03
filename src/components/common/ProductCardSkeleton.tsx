import React from 'react';

interface ProductCardSkeletonProps {
  count?: number;
}

export const ProductCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white rounded-xl border border-gray-200/90 overflow-hidden shadow-xs flex flex-col animate-pulse select-none">
      {/* Aspect square thumbnail skeleton */}
      <div className="relative aspect-square w-full bg-gray-200" />

      {/* Product info skeleton */}
      <div className="p-3.5 flex-1 flex flex-col justify-between space-y-3">
        <div className="space-y-1.5">
          <div className="h-3.5 bg-gray-200 rounded w-11/12" />
          <div className="h-3.5 bg-gray-200 rounded w-7/12" />
        </div>

        <div className="pt-1 space-y-2">
          {/* Price badge */}
          <div className="flex items-center gap-2">
            <div className="h-6 bg-gray-200 rounded w-20" />
            <div className="h-4 bg-gray-200 rounded w-14" />
          </div>
          {/* Subtitle price */}
          <div className="h-3 bg-gray-200 rounded w-24" />
        </div>
      </div>
    </div>
  );
};

export const ProductGridSkeleton: React.FC<ProductCardSkeletonProps> = ({ count = 8 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={`skeleton-${i}`} />
      ))}
    </>
  );
};
