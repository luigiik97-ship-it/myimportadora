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

export const DEFAULT_OTHERS_CATEGORY: Category = {
  id: 'cat-otros',
  name: 'Otros',
  slug: 'otros',
  image: 'https://images.unsplash.com/photo-1513094735237-8f2714d57c13?w=600&auto=format&fit=crop&q=80',
  sortOrder: 99,
  isVisible: true,
  description: 'Publicaciones y artículos varios',
};

export const LOCAL_DELETED_CATEGORIES_KEY = 'my_commerce_deleted_categories';

/**
 * Returns a normalized Set of category IDs, names and slugs that have been explicitly deleted.
 */
export function getDeletedCategories(): Set<string> {
  try {
    if (typeof localStorage === 'undefined') return new Set();
    const saved = localStorage.getItem(LOCAL_DELETED_CATEGORIES_KEY);
    if (saved) {
      const arr = JSON.parse(saved);
      if (Array.isArray(arr)) {
        return new Set(arr.map((s: string) => String(s).trim().toLowerCase()));
      }
    }
  } catch (e) {
    console.error('Error reading deleted categories', e);
  }
  return new Set();
}

/**
 * Permanently registers a category as deleted so it is never auto-recreated.
 */
export function markCategoryAsDeleted(id?: string, name?: string, slug?: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const current = getDeletedCategories();
    if (id) current.add(id.trim().toLowerCase());
    if (name) {
      current.add(name.trim().toLowerCase());
      current.add(slugifyCategory(name));
    }
    if (slug) {
      current.add(slug.trim().toLowerCase());
    }
    localStorage.setItem(LOCAL_DELETED_CATEGORIES_KEY, JSON.stringify(Array.from(current)));
  } catch (e) {
    console.error('Error marking category as deleted', e);
  }
}

/**
 * Removes a category from the deleted registry so it can be re-created or re-activated without being filtered out.
 */
export function unmarkCategoryAsDeleted(id?: string, name?: string, slug?: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const current = getDeletedCategories();
    let changed = false;
    if (id && current.delete(id.trim().toLowerCase())) changed = true;
    if (name) {
      if (current.delete(name.trim().toLowerCase())) changed = true;
      if (current.delete(slugifyCategory(name))) changed = true;
    }
    if (slug && current.delete(slug.trim().toLowerCase())) changed = true;
    if (changed) {
      localStorage.setItem(LOCAL_DELETED_CATEGORIES_KEY, JSON.stringify(Array.from(current)));
    }
  } catch (e) {
    console.error('Error unmarking category as deleted', e);
  }
}

/**
 * Merges two category lists preserving existing order and prioritizing cloud definitions.
 */
export function mergeCategoriesLists(cloudCategories: Category[], localCategories: Category[]): Category[] {
  if (!cloudCategories || cloudCategories.length === 0) return localCategories || [];
  if (!localCategories || localCategories.length === 0) return cloudCategories;

  const result = [...cloudCategories];
  const seenIds = new Set(cloudCategories.map((c) => (c.id || '').trim().toLowerCase()));
  const seenSlugs = new Set(cloudCategories.map((c) => (c.slug || slugifyCategory(c.name)).trim().toLowerCase()));
  const seenNames = new Set(cloudCategories.map((c) => c.name.trim().toLowerCase()));

  for (const localCat of localCategories) {
    if (!localCat || !localCat.name) continue;
    const idClean = (localCat.id || '').trim().toLowerCase();
    const slugClean = (localCat.slug || slugifyCategory(localCat.name)).trim().toLowerCase();
    const nameClean = localCat.name.trim().toLowerCase();

    if (!seenIds.has(idClean) && !seenSlugs.has(slugClean) && !seenNames.has(nameClean)) {
      result.push(localCat);
      if (idClean) seenIds.add(idClean);
      if (slugClean) seenSlugs.add(slugClean);
      seenNames.add(nameClean);
    }
  }

  return result.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}

/**
 * Checks if a given category identifier has been marked as deleted.
 */
export function isCategoryDeleted(idOrNameOrSlug: string): boolean {
  if (!idOrNameOrSlug) return false;
  const deleted = getDeletedCategories();
  const clean = idOrNameOrSlug.trim().toLowerCase();
  return deleted.has(clean) || deleted.has(slugifyCategory(idOrNameOrSlug));
}

/**
 * Reconcile a list of categories with INITIAL_CATEGORIES and any categories present in active products.
 * Guarantees that deleted categories are NEVER resurrected, and that active products
 * always have a valid corresponding category entry in the storefront navigation.
 */
export function reconcileCategoriesWithProducts(
  categories: Category[] = [],
  products: Product[] = []
): Category[] {
  const deletedSet = getDeletedCategories();

  // Filter out any explicitly deleted categories from the input
  const filteredInput = (categories || []).filter((c) => {
    if (!c || !c.name) return false;
    const idClean = (c.id || '').trim().toLowerCase();
    const slugClean = (c.slug || slugifyCategory(c.name)).trim().toLowerCase();
    const nameClean = c.name.trim().toLowerCase();
    const nameNorm = slugifyCategory(c.name);
    return !deletedSet.has(idClean) && !deletedSet.has(slugClean) && !deletedSet.has(nameClean) && !deletedSet.has(nameNorm);
  });

  const baseSource = filteredInput.length > 0
    ? filteredInput
    : INITIAL_CATEGORIES.filter((c) => {
        const idClean = (c.id || '').trim().toLowerCase();
        const slugClean = (c.slug || slugifyCategory(c.name)).trim().toLowerCase();
        const nameClean = c.name.trim().toLowerCase();
        const nameNorm = slugifyCategory(c.name);
        return !deletedSet.has(idClean) && !deletedSet.has(slugClean) && !deletedSet.has(nameClean) && !deletedSet.has(nameNorm);
      });

  const list: Category[] = deduplicateCategories(baseSource);

  const seenIds = new Set<string>(list.map((c) => c.id.trim().toLowerCase()));
  const seenSlugs = new Set<string>(list.map((c) => (c.slug || slugifyCategory(c.name)).trim().toLowerCase()));
  const seenNormalizedNames = new Set<string>(list.map((c) => slugifyCategory(c.name)));

  // 1. Only backfill from INITIAL_CATEGORIES if the list was completely empty,
  // preventing user-deleted initial categories from reappearing.
  if (filteredInput.length === 0) {
    INITIAL_CATEGORIES.forEach((initCat) => {
      const id = initCat.id.trim().toLowerCase();
      const slug = (initCat.slug || slugifyCategory(initCat.name)).trim().toLowerCase();
      const normalizedName = slugifyCategory(initCat.name);
      const nameClean = initCat.name.trim().toLowerCase();

      if (deletedSet.has(id) || deletedSet.has(slug) || deletedSet.has(nameClean) || deletedSet.has(normalizedName)) {
        return;
      }

      if (!seenIds.has(id) && !seenSlugs.has(slug) && !seenNormalizedNames.has(normalizedName)) {
        list.push({ ...initCat });
        seenIds.add(id);
        seenSlugs.add(slug);
        seenNormalizedNames.add(normalizedName);
      }
    });
  }

  // 2. Discover any category present in active products that isn't yet in the list
  if (products && Array.isArray(products)) {
    products.forEach((prod) => {
      if (!prod.category) return;
      const catName = prod.category.trim();
      if (!catName || catName.toLowerCase() === 'todo' || catName.toLowerCase() === '__system__' || prod.id.startsWith('__system_')) return;

      const slug = slugifyCategory(catName);
      const normalizedName = slugifyCategory(catName);
      const idToCheck = `cat-${slug}`;
      const nameClean = catName.toLowerCase();

      // If marked as deleted, do not re-add
      if (deletedSet.has(idToCheck) || deletedSet.has(slug) || deletedSet.has(nameClean) || deletedSet.has(normalizedName)) {
        return;
      }

      if (!seenIds.has(idToCheck) && !seenSlugs.has(slug) && !seenNormalizedNames.has(normalizedName)) {
        if (slug === 'otros' || nameClean === 'otros') {
          list.push({ ...DEFAULT_OTHERS_CATEGORY });
          seenIds.add(DEFAULT_OTHERS_CATEGORY.id.toLowerCase());
          seenSlugs.add('otros');
          seenNormalizedNames.add('otros');
          return;
        }

        const matchedInitial = INITIAL_CATEGORIES.find(
          (c) => slugifyCategory(c.name) === normalizedName || (c.slug && c.slug.toLowerCase() === slug)
        );
        const targetId = matchedInitial?.id || `cat-${slug}`;
        const prodImage = (prod.images && prod.images[0]) || '';
        const maxOrder = list.length > 0 ? Math.max(...list.map((c) => c.sortOrder || 0)) : 0;

        const newCat: Category = {
          id: targetId,
          name: matchedInitial?.name || catName,
          slug: matchedInitial?.slug || slug,
          image: matchedInitial?.image || prodImage || 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600',
          sortOrder: maxOrder + 1,
          isVisible: matchedInitial?.isVisible !== undefined ? matchedInitial.isVisible : true,
          description: matchedInitial?.description || `Productos de la categoría ${catName}`,
        };

        list.push(newCat);
        seenIds.add(newCat.id.toLowerCase());
        seenSlugs.add(newCat.slug.toLowerCase());
        seenNormalizedNames.add(normalizedName);
      }
    });
  }

  return deduplicateCategories(list).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
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
