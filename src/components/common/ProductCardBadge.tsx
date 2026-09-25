import React from 'react';
import { ProductTag, Product } from '../../types';
import { getProductTagById } from '../../services/productTags';

interface ProductCardBadgeProps {
  product?: Partial<Product>;
  tagId?: string;
  tag?: ProductTag;
  className?: string;
}

export const ProductCardBadge: React.FC<ProductCardBadgeProps> = ({
  product,
  tagId,
  tag,
  className = '',
}) => {
  // Resolve tag by direct tag prop, product.tag, product.tagId, or direct tagId
  const effectiveTagId = tagId || product?.tagId;
  const directTag = tag || product?.tag;
  const resolvedTag = directTag || (effectiveTagId ? getProductTagById(effectiveTagId) : undefined);

  if (!resolvedTag || !resolvedTag.label || !resolvedTag.label.trim()) {
    return null;
  }

  const bgColor = resolvedTag.color || '#0058bb';
  const textColor = resolvedTag.textColor || '#ffffff';

  return (
    <span
      className={`absolute top-1.5 left-1.5 sm:top-2 sm:left-2 z-10 px-2 py-0.5 sm:px-2.5 sm:py-0.5 rounded-md text-[10px] sm:text-[11px] font-bold tracking-wide uppercase shadow-sm select-none pointer-events-none transition-all drop-shadow-xs leading-tight ${className}`}
      style={{
        backgroundColor: bgColor,
        color: textColor,
      }}
    >
      {resolvedTag.label}
    </span>
  );
};
