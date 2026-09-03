import { Product, Category } from '../types';
import { INITIAL_CATEGORIES } from '../data/initialCategories';

export interface StorefrontCategory extends Category {
  productCount: number;
}

/**
 * Generate a clean URL-friendly slug from a category name
 */
export function slugifyCategory(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Count how many products belong to a specific category or subcategory
 */
export function countProductsInCategory(
  categoryName: string,
  products: Product[],
  slug?: string
): number {
  if (!categoryName) return 0;
  const nameClean = categoryName.trim().toLowerCase();
  const slugClean = (slug || slugifyCategory(categoryName)).toLowerCase();

  return products.filter((prod) => {
    const prodCat = (prod.category || '').trim().toLowerCase();
    const prodSub = (prod.subcategory || '').trim().toLowerCase();

    return (
      prodCat === nameClean ||
      prodSub === nameClean ||
      (slugClean && (slugifyCategory(prodCat) === slugClean || slugifyCategory(prodSub) === slugClean))
    );
  }).length;
}

/**
 * Get the visible storefront categories ordered by sortOrder with dedicated custom images,
 * calculating the dynamic product count for each.
 */
export function getStorefrontCategories(
  categories: Category[],
  products: Product[]
): StorefrontCategory[] {
  const source = categories && categories.length > 0 ? categories : INITIAL_CATEGORIES;

  return source
    .filter((cat) => cat.isVisible !== false)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    .map((cat) => ({
      ...cat,
      productCount: countProductsInCategory(cat.name, products, cat.slug),
    }));
}

/**
 * Dynamically filter products by category or subcategory name/slug.
 * Prevents duplicates and handles case-insensitive matching accurately.
 */
export function filterProductsByCategory(products: Product[], categoryNameOrSlug: string): Product[] {
  if (!categoryNameOrSlug || categoryNameOrSlug.trim().toLowerCase() === 'todo') {
    return products;
  }

  const targetClean = categoryNameOrSlug.trim().toLowerCase();
  const targetSlug = slugifyCategory(categoryNameOrSlug);

  return products.filter((prod) => {
    const prodCat = (prod.category || '').trim().toLowerCase();
    const prodSub = (prod.subcategory || '').trim().toLowerCase();

    const catSlug = slugifyCategory(prodCat);
    const subSlug = slugifyCategory(prodSub);

    return (
      prodCat === targetClean ||
      prodSub === targetClean ||
      (targetSlug && (catSlug === targetSlug || subSlug === targetSlug))
    );
  });
}
