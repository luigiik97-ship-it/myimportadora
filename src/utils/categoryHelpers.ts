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
 * Remove duplicate categories based on unique ID, slug, and normalized name.
 * Also cleanses fields and ensures valid fallback properties.
 */
export function deduplicateCategories(categories: Category[]): Category[] {
  if (!categories || !Array.isArray(categories)) return [];

  const result: Category[] = [];
  const seenIds = new Set<string>();
  const seenSlugs = new Set<string>();
  const seenNormalizedNames = new Set<string>();

  for (const cat of categories) {
    if (!cat) continue;
    const rawId = (cat.id || '').trim();
    const rawName = (cat.name || '').trim();
    if (!rawName) continue;

    const slug = (cat.slug || slugifyCategory(rawName)).trim().toLowerCase();
    const normalizedName = slugifyCategory(rawName);

    // If ID, slug, or normalized name already exists, skip duplicate
    if (rawId && seenIds.has(rawId)) continue;
    if (slug && seenSlugs.has(slug)) continue;
    if (normalizedName && seenNormalizedNames.has(normalizedName)) continue;

    const finalId = rawId || `cat-${slug || Date.now()}`;
    seenIds.add(finalId);
    if (slug) seenSlugs.add(slug);
    if (normalizedName) seenNormalizedNames.add(normalizedName);

    result.push({
      ...cat,
      id: finalId,
      name: rawName,
      slug: slug || slugifyCategory(rawName),
      sortOrder: cat.sortOrder !== undefined ? Number(cat.sortOrder) : 99,
      isVisible: cat.isVisible !== false,
      image: cat.image || 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600',
    });
  }

  return result;
}

/**
 * Reconcile a list of categories with INITIAL_CATEGORIES and any categories present in active products.
 * Guarantees that essential categories (like Bricks) and categories with active products are never lost,
 * and that duplicate entries (e.g. cat-bijuteria) are strictly eliminated.
 */
export function reconcileCategoriesWithProducts(
  categories: Category[] = [],
  products: Product[] = []
): Category[] {
  const baseSource = categories && categories.length > 0 ? categories : INITIAL_CATEGORIES;
  const list: Category[] = deduplicateCategories(baseSource);

  const seenIds = new Set<string>(list.map((c) => c.id.trim()));
  const seenSlugs = new Set<string>(list.map((c) => (c.slug || slugifyCategory(c.name)).trim().toLowerCase()));
  const seenNormalizedNames = new Set<string>(list.map((c) => slugifyCategory(c.name)));

  // 1. Ensure all INITIAL_CATEGORIES are present (self-healing for stale local caches)
  INITIAL_CATEGORIES.forEach((initCat) => {
    const id = initCat.id.trim();
    const slug = (initCat.slug || slugifyCategory(initCat.name)).trim().toLowerCase();
    const normalizedName = slugifyCategory(initCat.name);

    if (!seenIds.has(id) && !seenSlugs.has(slug) && !seenNormalizedNames.has(normalizedName)) {
      list.push({ ...initCat });
      seenIds.add(id);
      seenSlugs.add(slug);
      seenNormalizedNames.add(normalizedName);
    }
  });

  // 2. Discover any category present in active products that isn't yet in the list
  if (products && Array.isArray(products)) {
    products.forEach((prod) => {
      if (!prod.category) return;
      const catName = prod.category.trim();
      if (!catName || catName.toLowerCase() === 'todo') return;

      const slug = slugifyCategory(catName);
      const normalizedName = slugifyCategory(catName);

      const matchedInitial = INITIAL_CATEGORIES.find(
        (c) => slugifyCategory(c.name) === normalizedName || (c.slug && c.slug.toLowerCase() === slug)
      );
      const targetId = matchedInitial?.id || `cat-${slug}`;

      if (!seenIds.has(targetId) && !seenSlugs.has(slug) && !seenNormalizedNames.has(normalizedName)) {
        const prodImage = (prod.images && prod.images[0]) || '';
        const maxOrder = list.length > 0 ? Math.max(...list.map((c) => c.sortOrder || 0)) : 0;

        const newCat: Category = {
          id: targetId,
          name: matchedInitial?.name || catName,
          slug: matchedInitial?.slug || slug,
          image: matchedInitial?.image || prodImage || 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600',
          sortOrder: matchedInitial?.sortOrder !== undefined ? matchedInitial.sortOrder : maxOrder + 1,
          isVisible: matchedInitial?.isVisible !== undefined ? matchedInitial.isVisible : true,
          description: matchedInitial?.description || `Productos de la categoría ${catName}`,
        };

        list.push(newCat);
        seenIds.add(newCat.id);
        seenSlugs.add(newCat.slug);
        seenNormalizedNames.add(normalizedName);
      }
    });
  }

  return deduplicateCategories(list);
}

/**
 * Get the visible storefront categories ordered by sortOrder with dedicated custom images,
 * calculating the dynamic product count for each.
 */
export function getStorefrontCategories(
  categories: Category[],
  products: Product[]
): StorefrontCategory[] {
  const source = reconcileCategoriesWithProducts(categories, products);

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
