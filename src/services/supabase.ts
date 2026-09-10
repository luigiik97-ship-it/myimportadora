import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Product, Order, ProductSpec, Category } from '../types';
import { INITIAL_PRODUCTS } from '../data/initialProducts';
import { INITIAL_CATEGORIES } from '../data/initialCategories';
import {
  normalizeVariantTypes,
  cleanSizeVariantsList,
  cleanSpecsList,
  syncLegacyFields,
  SPECS_VARIANT_TYPES_KEY,
} from '../utils/variantHelpers';
import {
  reconcileCategoriesWithProducts,
  markCategoryAsDeleted,
  unmarkCategoryAsDeleted,
  mergeCategoriesLists,
  getDeletedCategories,
  DEFAULT_OTHERS_CATEGORY,
  slugifyCategory,
  isObsoleteDefaultCategory,
} from '../utils/categoryHelpers';
import {
  optimizeProductImage,
  ImageOptimizationOptions,
  OptimizationResult,
} from '../utils/imageOptimizer';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let supabaseInstance: SupabaseClient | null = null;

if (supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('your-project')) {
  try {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  } catch (error) {
    console.warn('Error inicializando cliente de Supabase:', error);
  }
}

export const isSupabaseConfigured = (): boolean => {
  return !!(supabaseInstance && supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('your-project'));
};

export const getSupabase = (): SupabaseClient | null => supabaseInstance;

// Local fallback keys
const LOCAL_PRODUCTS_KEY = 'my_commerce_products';
const LOCAL_ORDERS_KEY = 'my_commerce_orders';
const LOCAL_CATEGORIES_KEY = 'my_commerce_categories';

// Safe localStorage setter to prevent QuotaExceededError
export const safeLocalStorageSet = (key: string, value: string): boolean => {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e: any) {
    console.warn(`[Storage] Error al guardar "${key}" en localStorage:`, e?.name || e?.message);
    
    // If quota exceeded, try cleaning up old orders or cache
    try {
      if (key !== LOCAL_ORDERS_KEY) {
        // Truncate orders to keep only the 5 most recent ones
        const savedOrders = localStorage.getItem(LOCAL_ORDERS_KEY);
        if (savedOrders) {
          const parsed = JSON.parse(savedOrders);
          if (Array.isArray(parsed) && parsed.length > 5) {
            localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(parsed.slice(0, 5)));
          }
        }
      }
      // Retry saving
      localStorage.setItem(key, value);
      return true;
    } catch (retryError) {
      console.warn(`[Storage] No se pudo recuperar espacio en localStorage para "${key}".`);
      return false;
    }
  }
};

// ================= CACHING & DEDUPLICATION LAYER ================= //
let cachedProducts: Product[] | null = null;
let productsCacheTimestamp = 0;
let inFlightProductsPromise: Promise<Product[]> | null = null;

let cachedCategories: Category[] | null = null;
let categoriesCacheTimestamp = 0;
let inFlightCategoriesPromise: Promise<Category[]> | null = null;

const CACHE_TTL_MS = 1000 * 60 * 3; // 3 minutes in-memory freshness

export const getCachedProducts = (): Product[] => {
  if (cachedProducts && cachedProducts.length > 0) {
    return cachedProducts;
  }
  return getLocalProducts();
};

export const getCachedCategories = (): Category[] => {
  if (cachedCategories && cachedCategories.length > 0) {
    return cachedCategories;
  }
  return getLocalCategories();
};

export const invalidateProductsCache = () => {
  cachedProducts = null;
  productsCacheTimestamp = 0;
};

export const invalidateCategoriesCache = () => {
  cachedCategories = null;
  categoriesCacheTimestamp = 0;
};

export const getRawLocalCategories = (): Category[] => {
  try {
    const saved = localStorage.getItem(LOCAL_CATEGORIES_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter(
          (c) =>
            c &&
            c.name &&
            !isObsoleteDefaultCategory(c.id) &&
            !isObsoleteDefaultCategory(c.slug) &&
            !isObsoleteDefaultCategory(c.name)
        );
      }
    }
  } catch (e) {}
  return [];
};

// Initial loader for local storage categories
export const getLocalCategories = (): Category[] => {
  if (cachedCategories && cachedCategories.length > 0) {
    const reconciled = reconcileCategoriesWithProducts(cachedCategories, cachedProducts || undefined);
    const sorted = reconciled.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    cachedCategories = sorted;
    return sorted;
  }
  try {
    const saved = localStorage.getItem(LOCAL_CATEGORIES_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const reconciled = reconcileCategoriesWithProducts(parsed, cachedProducts || undefined);
        const sorted = reconciled.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        cachedCategories = sorted;
        safeLocalStorageSet(LOCAL_CATEGORIES_KEY, JSON.stringify(sorted));
        return sorted;
      }
    }
  } catch (e) {
    console.error('Error reading local categories', e);
  }
  const initialReconciled = reconcileCategoriesWithProducts(INITIAL_CATEGORIES, cachedProducts || undefined);
  const sortedInitial = initialReconciled.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  safeLocalStorageSet(LOCAL_CATEGORIES_KEY, JSON.stringify(sortedInitial));
  cachedCategories = sortedInitial;
  return sortedInitial;
};

export const saveLocalCategories = (categories: Category[]) => {
  const reconciled = reconcileCategoriesWithProducts(categories, cachedProducts || undefined);
  const sorted = reconciled.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  cachedCategories = sorted;
  categoriesCacheTimestamp = Date.now();
  safeLocalStorageSet(LOCAL_CATEGORIES_KEY, JSON.stringify(sorted));
};

export const LOCAL_DELETED_PRODUCTS_KEY = 'my_commerce_deleted_products';

/**
 * Returns a Set of product IDs that have been explicitly deleted.
 */
export const getDeletedProductIds = (): Set<string> => {
  try {
    if (typeof localStorage === 'undefined') return new Set();
    const saved = localStorage.getItem(LOCAL_DELETED_PRODUCTS_KEY);
    if (saved) {
      const arr = JSON.parse(saved);
      if (Array.isArray(arr)) {
        return new Set(arr.map((id: string) => String(id).trim()));
      }
    }
  } catch (e) {
    console.error('Error reading deleted products', e);
  }
  return new Set();
};

/**
 * Permanently registers a product ID as deleted so it is never auto-reseeded.
 */
export const markProductDeleted = (id: string): void => {
  try {
    if (typeof localStorage === 'undefined') return;
    const current = getDeletedProductIds();
    current.add(String(id).trim());
    localStorage.setItem(LOCAL_DELETED_PRODUCTS_KEY, JSON.stringify(Array.from(current)));
  } catch (e) {
    console.error('Error marking product as deleted', e);
  }
};

// Initial loader for local storage with deleted products exclusion
export const getLocalProducts = (): Product[] => {
  const deletedIds = getDeletedProductIds();
  if (cachedProducts && cachedProducts.length > 0) {
    return cachedProducts.filter((p) => !deletedIds.has(p.id) && !p.id.startsWith('__system_') && p.category !== '__system__');
  }
  try {
    const saved = localStorage.getItem(LOCAL_PRODUCTS_KEY);
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter((p: Product) => p && !deletedIds.has(p.id) && !p.id.startsWith('__system_') && p.category !== '__system__');
        cachedProducts = filtered;
        return filtered;
      }
    }
  } catch (e) {
    console.error('Error reading local products', e);
  }
  const initialFiltered = INITIAL_PRODUCTS.filter((p) => !deletedIds.has(p.id) && !p.id.startsWith('__system_') && p.category !== '__system__');
  safeLocalStorageSet(LOCAL_PRODUCTS_KEY, JSON.stringify(initialFiltered));
  cachedProducts = initialFiltered;
  return initialFiltered;
};

export const saveLocalProducts = (products: Product[]) => {
  cachedProducts = products;
  productsCacheTimestamp = Date.now();
  safeLocalStorageSet(LOCAL_PRODUCTS_KEY, JSON.stringify(products));
};

const getLocalOrders = (): Order[] => {
  try {
    const saved = localStorage.getItem(LOCAL_ORDERS_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Error reading local orders', e);
  }
  return [];
};

const saveLocalOrders = (orders: Order[]) => {
  // Store at most 30 most recent orders in local storage to conserve space
  const trimmed = orders.slice(0, 30);
  safeLocalStorageSet(LOCAL_ORDERS_KEY, JSON.stringify(trimmed));
};

// ---------------- PRODUCTS API ---------------- //

/**
 * Robustly parses and extracts up to 6 product images from any Supabase schema format
 * (supports JSONB array, JSON string, Postgres array literal {url1,url2}, comma-separated URLs,
 * and individual columns like image1..6, image_1..6, image_url_1..6, foto1..6).
 */
export const extractProductImages = (item: any): string[] => {
  if (!item) return ['https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800'];

  const imagesFound: string[] = [];

  const isValidImageUrl = (url: any): boolean => {
    if (typeof url !== 'string') return false;
    const trimmed = url.trim();
    return (
      trimmed.length > 0 &&
      (trimmed.startsWith('http://') ||
        trimmed.startsWith('https://') ||
        trimmed.startsWith('data:image/') ||
        trimmed.startsWith('blob:'))
    );
  };

  // 1. Check item.images first (Array, JSON string, or Postgres array literal '{url1,url2}')
  if (Array.isArray(item.images) && item.images.length > 0) {
    for (const u of item.images) {
      if (isValidImageUrl(u) && !imagesFound.includes(u.trim())) {
        imagesFound.push(u.trim());
      }
    }
  } else if (typeof item.images === 'string' && item.images.trim()) {
    const raw = item.images.trim();
    if (raw.startsWith('[') && raw.endsWith(']')) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          for (const u of parsed) {
            if (isValidImageUrl(u) && !imagesFound.includes(u.trim())) {
              imagesFound.push(u.trim());
            }
          }
        }
      } catch (e) {
        raw.split(/[\n,]+/).forEach((part) => {
          if (isValidImageUrl(part) && !imagesFound.includes(part.trim())) {
            imagesFound.push(part.trim());
          }
        });
      }
    } else if (raw.startsWith('{') && raw.endsWith('}')) {
      // Postgres array format e.g. '{https://url1,https://url2}'
      const inner = raw.slice(1, -1);
      inner.split(',').forEach((part) => {
        const clean = part.replace(/^["']|["']$/g, '').trim();
        if (isValidImageUrl(clean) && !imagesFound.includes(clean)) {
          imagesFound.push(clean);
        }
      });
    } else if (isValidImageUrl(raw)) {
      imagesFound.push(raw);
    }
  }

  // 2. If item.images was empty or missing, check individual numbered columns (image1..6, image_1..6)
  if (imagesFound.length === 0) {
    const individualColumnSets = [
      ['image1', 'image_1', 'image_url_1', 'image_url', 'image', 'foto1', 'foto_1', 'primary_image'],
      ['image2', 'image_2', 'image_url_2', 'secondary_image_url', 'foto2', 'foto_2', 'secondary_image'],
      ['image3', 'image_3', 'image_url_3', 'foto3', 'foto_3'],
      ['image4', 'image_4', 'image_url_4', 'foto4', 'foto_4'],
      ['image5', 'image_5', 'image_url_5', 'foto5', 'foto_5'],
      ['image6', 'image_6', 'image_url_6', 'foto6', 'foto_6']
    ];

    for (const columnAliases of individualColumnSets) {
      for (const key of columnAliases) {
        const val = item[key];
        if (isValidImageUrl(val) && !imagesFound.includes(val.trim())) {
          imagesFound.push(val.trim());
          break;
        }
      }
    }
  }

  // Limit to maximum 6 images
  const finalImages = imagesFound.slice(0, 6);

  // If completely empty, provide fallback
  if (finalImages.length === 0) {
    return ['https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800'];
  }

  return finalImages;
};

// Cache for known database columns discovered at runtime to avoid schema mismatches
let knownProductColumns: Set<string> | null = null;
const invalidColumnsBlacklist = new Set<string>();

/**
 * Adaptively executes Supabase INSERT / UPDATE / UPSERT for products.
 * If the database table does not have a specific column, it strips the column,
 * memorizes the blacklist, and retries seamlessly.
 */
async function executeAdaptiveProductWrite(
  operation: 'insert' | 'update' | 'upsert',
  payload: Record<string, any>,
  id?: string
): Promise<{ success: boolean; data?: any; error?: any }> {
  if (!supabaseInstance) {
    console.warn('[Supabase executeAdaptiveProductWrite] Cliente Supabase no disponible.');
    return { success: false, error: 'No client' };
  }

  // Filter out any known invalid columns immediately based on dynamic blacklist
  const currentPayload: Record<string, any> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (!invalidColumnsBlacklist.has(key)) {
      currentPayload[key] = value;
    }
  }

  const targetId = id || currentPayload.id;
  const maxAttempts = 12;

  console.log(`\n================== [SUPABASE ${operation.toUpperCase()} START] ==================`);
  console.log(`[Supabase ${operation.toUpperCase()}] ID objetivo:`, targetId);
  console.log(`[Supabase ${operation.toUpperCase()}] Payload enviado:`, JSON.stringify(currentPayload, null, 2));

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const query: any = supabaseInstance.from('products');

      if (operation === 'insert') {
        const { data, error } = await query.insert([currentPayload]).select();
        if (error) throw error;
        if (Array.isArray(data) && data.length > 0) {
          knownProductColumns = new Set(Object.keys(data[0]));
        }
        console.log(`================== [SUPABASE INSERT SUCCESS] ==================\n`);
        return { success: true, data };
      } else if (operation === 'update' && targetId) {
        const { data, error } = await query.update(currentPayload).eq('id', targetId).select();
        if (error) throw error;

        // Si data está vacío (0 registros modificados), el ID no existía aún en Supabase: hacer fallback a upsert
        if (Array.isArray(data) && data.length === 0) {
          console.warn(`[Supabase UPDATE] Registro "${targetId}" no existe en Supabase (0 filas). Ejecutando upsert...`);
          const upsertPayload = { ...currentPayload, id: targetId };
          const { data: upsertData, error: upsertError } = await supabaseInstance.from('products').upsert([upsertPayload], { onConflict: 'id' }).select();
          if (upsertError) throw upsertError;
          if (Array.isArray(upsertData) && upsertData.length > 0) {
            knownProductColumns = new Set(Object.keys(upsertData[0]));
          }
          console.log(`================== [SUPABASE RECOVERY UPSERT SUCCESS] ==================\n`);
          return { success: true, data: upsertData };
        }

        if (Array.isArray(data) && data.length > 0) {
          knownProductColumns = new Set(Object.keys(data[0]));
        }
        console.log(`================== [SUPABASE UPDATE SUCCESS] ==================\n`);
        return { success: true, data };
      } else if (operation === 'upsert') {
        const { data, error } = await query.upsert([currentPayload], { onConflict: 'id' }).select();
        if (error) throw error;
        if (Array.isArray(data) && data.length > 0) {
          knownProductColumns = new Set(Object.keys(data[0]));
        }
        console.log(`================== [SUPABASE UPSERT SUCCESS] ==================\n`);
        return { success: true, data };
      }
    } catch (err: any) {
      const msg: string = err?.message || err?.details || String(err);

      // 1. Detect missing column error from Postgres/PostgREST (e.g. PGRST204 "Could not find the 'xyz' column...")
      const postgrestMatch = msg.match(/Could not find the '([a-zA-Z0-9_-]+)' column/i);
      const postgresMatch = msg.match(/column\s+"?([a-zA-Z0-9_-]+)"?\s+(?:of relation "[^"]+"\s+)?does not exist/i);
      const genericMatch = msg.match(/(?:column|field)\s+['"]?([a-zA-Z0-9_-]+)['"]?\s+(?:is not valid|does not exist|not found)/i);
      const missingCol = postgrestMatch?.[1] || postgresMatch?.[1] || genericMatch?.[1];

      if (missingCol) {
        invalidColumnsBlacklist.add(missingCol);
        if (missingCol in currentPayload) {
          delete currentPayload[missingCol];
          continue;
        }
      }

      // 2. Detect JSON/TEXT type mismatch on images column
      if (msg.includes('invalid input syntax for type json') || msg.includes('column "images" is of type text')) {
        if (Array.isArray(currentPayload.images)) {
          currentPayload.images = JSON.stringify(currentPayload.images);
          continue;
        }
      }

      // 3. If images as string/array fails, fallback to JSONB array or stringify
      if (msg.includes('images') && typeof currentPayload.images === 'string') {
        try {
          currentPayload.images = JSON.parse(currentPayload.images);
          continue;
        } catch (parseErr) {
          delete currentPayload.images;
          continue;
        }
      }

      console.error(`[Supabase Adaptive Error] ${msg}`);
      return { success: false, error: err };
    }
  }

  return { success: false, error: 'Max retry attempts reached' };
}

export const fetchProducts = async (options?: { force?: boolean }): Promise<Product[]> => {
  const now = Date.now();

  // 1. Fast path: return in-memory cached products if fresh and not explicitly forced
  if (!options?.force && cachedProducts && cachedProducts.length > 0 && (now - productsCacheTimestamp < CACHE_TTL_MS)) {
    return cachedProducts;
  }

  // 2. Request deduplication: if a request is already running, join the existing promise
  if (inFlightProductsPromise) {
    return inFlightProductsPromise;
  }

  inFlightProductsPromise = (async () => {
    try {
      if (isSupabaseConfigured() && supabaseInstance) {
        try {
          const { data, error } = await supabaseInstance
            .from('products')
            .select('*')
            .order('created_at', { ascending: false });

          if (error) {
            console.warn('Supabase fetchProducts error, usando fallback local:', error.message);
            return getLocalProducts();
          }

          if (data && data.length > 0) {
            knownProductColumns = new Set(Object.keys(data[0]));

            // Map database columns to Product interface with robust variant and 6-image extraction
            const mappedProducts = data.map((item: any) => {
              const colors = Array.isArray(item.colors)
                ? item.colors
                : (item.colors
                ? (typeof item.colors === 'string' && item.colors.startsWith('[')
                    ? JSON.parse(item.colors)
                    : [item.colors])
                : []);

              // Robust variant types normalization (extracts from variant_types, size_variants meta, or specs meta)
              const variantTypes = normalizeVariantTypes(item);
              const sizeVariants = cleanSizeVariantsList(
                Array.isArray(item.size_variants)
                  ? item.size_variants
                  : (item.sizeVariants
                  ? (typeof item.sizeVariants === 'string' ? JSON.parse(item.sizeVariants) : item.sizeVariants)
                  : [])
              );
              const rawSpecs = Array.isArray(item.specs)
                ? item.specs
                : (item.specs
                ? (typeof item.specs === 'string' && item.specs.startsWith('[') ? JSON.parse(item.specs) : item.specs)
                : []);
              const specs = cleanSpecsList(rawSpecs);

              const prodImages = extractProductImages(item);

              let resolvedCashPrice: number | undefined = undefined;
              if (item.cash_price !== undefined && item.cash_price !== null && item.cash_price !== '') {
                resolvedCashPrice = Number(item.cash_price);
              } else if (item.cashPrice !== undefined && item.cashPrice !== null && item.cashPrice !== '') {
                resolvedCashPrice = Number(item.cashPrice);
              } else if (Array.isArray(rawSpecs)) {
                const cashSpec = rawSpecs.find(
                  (s: any) => s && (s.key === '__cash_price' || s.label === '__cash_price' || s.key === 'cashPrice' || s.label === 'cashPrice')
                );
                if (cashSpec && cashSpec.value && !isNaN(Number(cashSpec.value))) {
                  resolvedCashPrice = Number(cashSpec.value);
                }
              }

              let resolvedRetailCashPrice: number | undefined = undefined;
              if (item.retail_cash_price !== undefined && item.retail_cash_price !== null && item.retail_cash_price !== '') {
                resolvedRetailCashPrice = Number(item.retail_cash_price);
              } else if (item.retailCashPrice !== undefined && item.retailCashPrice !== null && item.retailCashPrice !== '') {
                resolvedRetailCashPrice = Number(item.retailCashPrice);
              } else if (Array.isArray(rawSpecs)) {
                const retailCashSpec = rawSpecs.find(
                  (s: any) => s && (s.key === '__retail_cash_price' || s.label === '__retail_cash_price' || s.key === 'retailCashPrice' || s.label === 'retailCashPrice')
                );
                if (retailCashSpec && retailCashSpec.value && !isNaN(Number(retailCashSpec.value))) {
                  resolvedRetailCashPrice = Number(retailCashSpec.value);
                }
              }
              // Fallback to resolvedCashPrice if specific retail cash price was not configured
              if (resolvedRetailCashPrice === undefined && resolvedCashPrice !== undefined) {
                resolvedRetailCashPrice = resolvedCashPrice;
              }

              let resolvedWholesaleCashPrice: number | undefined = undefined;
              if (item.wholesale_cash_price !== undefined && item.wholesale_cash_price !== null && item.wholesale_cash_price !== '') {
                resolvedWholesaleCashPrice = Number(item.wholesale_cash_price);
              } else if (item.wholesaleCashPrice !== undefined && item.wholesaleCashPrice !== null && item.wholesaleCashPrice !== '') {
                resolvedWholesaleCashPrice = Number(item.wholesaleCashPrice);
              } else if (Array.isArray(rawSpecs)) {
                const wholesaleCashSpec = rawSpecs.find(
                  (s: any) => s && (s.key === '__wholesale_cash_price' || s.label === '__wholesale_cash_price' || s.key === 'wholesaleCashPrice' || s.label === 'wholesaleCashPrice')
                );
                if (wholesaleCashSpec && wholesaleCashSpec.value && !isNaN(Number(wholesaleCashSpec.value))) {
                  resolvedWholesaleCashPrice = Number(wholesaleCashSpec.value);
                }
              }
              // Fallback to resolvedCashPrice if specific wholesale cash price was not configured
              if (resolvedWholesaleCashPrice === undefined && resolvedCashPrice !== undefined) {
                resolvedWholesaleCashPrice = resolvedCashPrice;
              }

              let resolvedAdditionalImage: string | undefined = undefined;
              if (item.additional_image || item.additionalImage || item.lifestyle_image || item.lifestyleImage) {
                resolvedAdditionalImage = item.additional_image || item.additionalImage || item.lifestyle_image || item.lifestyleImage;
              } else if (Array.isArray(rawSpecs)) {
                const addImgSpec = rawSpecs.find(
                  (s: any) => s && (s.key === '__additional_image' || s.label === '__additional_image' || s.key === 'additionalImage' || s.label === 'additionalImage')
                );
                if (addImgSpec && addImgSpec.value) {
                  resolvedAdditionalImage = addImgSpec.value;
                }
              }

              let resolvedRating: number = 5.0;
              if (item.rating !== undefined && item.rating !== null && !isNaN(Number(item.rating))) {
                resolvedRating = Number(item.rating);
              } else if (Array.isArray(rawSpecs)) {
                const ratingSpec = rawSpecs.find(
                  (s: any) => s && (s.key === '__rating' || s.label === '__rating')
                );
                if (ratingSpec && ratingSpec.value && !isNaN(Number(ratingSpec.value))) {
                  resolvedRating = Number(ratingSpec.value);
                }
              }

              let resolvedReviewsCount: number = 128;
              if (item.reviews_count !== undefined && item.reviews_count !== null && !isNaN(Number(item.reviews_count))) {
                resolvedReviewsCount = Number(item.reviews_count);
              } else if (item.reviewsCount !== undefined && item.reviewsCount !== null && !isNaN(Number(item.reviewsCount))) {
                resolvedReviewsCount = Number(item.reviewsCount);
              } else if (Array.isArray(rawSpecs)) {
                const reviewsCountSpec = rawSpecs.find(
                  (s: any) => s && (s.key === '__reviews_count' || s.label === '__reviews_count')
                );
                if (reviewsCountSpec && reviewsCountSpec.value && !isNaN(Number(reviewsCountSpec.value))) {
                  resolvedReviewsCount = Number(reviewsCountSpec.value);
                }
              }

              let resolvedReviews: any[] | undefined = undefined;
              if (Array.isArray(item.reviews) && item.reviews.length > 0) {
                resolvedReviews = item.reviews;
              } else if (typeof item.reviews === 'string' && item.reviews.trim().startsWith('[')) {
                try {
                  resolvedReviews = JSON.parse(item.reviews);
                } catch (e) {}
              } else if (Array.isArray(rawSpecs)) {
                const reviewsSpec = rawSpecs.find(
                  (s: any) => s && (s.key === '__reviews' || s.label === '__reviews')
                );
                if (reviewsSpec && reviewsSpec.value) {
                  try {
                    resolvedReviews = JSON.parse(reviewsSpec.value);
                  } catch (e) {}
                }
              }

              return {
                id: item.id || String(item.product_id),
                title: item.title,
                description: item.description || '',
                category: item.category || 'Bijuteria',
                subcategory: item.subcategory || '',
                images: prodImages,
                additionalImage: resolvedAdditionalImage,
                minWholesaleQty: Number(item.min_wholesale_qty || item.minWholesaleQty || 1),
                wholesalePrice: Number(item.wholesale_price || item.wholesalePrice || 0),
                retailPrice: Number(item.retail_price || item.retailPrice || 0),
                cashPrice: resolvedCashPrice,
                retailCashPrice: resolvedRetailCashPrice,
                wholesaleCashPrice: resolvedWholesaleCashPrice,
                colors,
                sizeVariants,
                variantTypes,
                stock: Number(item.stock || 0),
                soldCount: Number(item.sold_count || item.soldCount || 0),
                rating: resolvedRating,
                reviewsCount: resolvedReviewsCount,
                reviews: resolvedReviews,
                specs,
                isBestSeller: Boolean(item.is_best_seller ?? item.isBestSeller),
                createdAt: item.created_at || item.createdAt
              };
            });

            const deletedIds = getDeletedProductIds();
            const activeMapped = mappedProducts.filter(
              (p) => !deletedIds.has(p.id) && !p.id.startsWith('__system_') && p.category !== '__system__'
            );
            saveLocalProducts(activeMapped);
            return activeMapped;
          } else {
            // Seed initial products to Supabase if empty
            await seedInitialProducts();
            return getLocalProducts();
          }
        } catch (err) {
          console.warn('Error connecting to Supabase, fallback to local:', err);
          return getLocalProducts();
        }
      }

      return getLocalProducts();
    } finally {
      inFlightProductsPromise = null;
    }
  })();

  return inFlightProductsPromise;
};

export const createProduct = async (product: Omit<Product, 'id'> & { id?: string }): Promise<Product> => {
  console.log(`\n================== [createProduct INICIO] ==================`);
  const images = (product.images && product.images.length > 0)
    ? product.images.slice(0, 6)
    : ['https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800'];

  const newProduct: Product = {
    ...product,
    images,
    id: product.id || `prod-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    createdAt: new Date().toISOString()
  };

  const currentVariantTypes = newProduct.variantTypes || normalizeVariantTypes(newProduct);
  const targetRetailCashPrice = newProduct.retailCashPrice !== undefined && newProduct.retailCashPrice !== null
    ? Number(newProduct.retailCashPrice)
    : (newProduct.cashPrice !== undefined && newProduct.cashPrice !== null ? Number(newProduct.cashPrice) : undefined);

  const targetWholesaleCashPrice = newProduct.wholesaleCashPrice !== undefined && newProduct.wholesaleCashPrice !== null
    ? Number(newProduct.wholesaleCashPrice)
    : (newProduct.cashPrice !== undefined && newProduct.cashPrice !== null ? Number(newProduct.cashPrice) : undefined);

  const { colors, sizeVariants, sizeVariantsWithMeta, serializedVariantTypesMeta } = syncLegacyFields(
    currentVariantTypes,
    newProduct.wholesalePrice,
    newProduct.retailPrice,
    newProduct.cashPrice,
    targetRetailCashPrice,
    targetWholesaleCashPrice
  );

  const cleanUserSpecs = cleanSpecsList(newProduct.specs);
  const specsWithMeta: ProductSpec[] = [
    ...cleanUserSpecs,
    { label: SPECS_VARIANT_TYPES_KEY, value: serializedVariantTypesMeta },
    ...(newProduct.cashPrice !== undefined && newProduct.cashPrice !== null ? [{ label: '__cash_price', value: String(newProduct.cashPrice) }] : []),
    ...(targetRetailCashPrice !== undefined && targetRetailCashPrice !== null ? [{ label: '__retail_cash_price', value: String(targetRetailCashPrice) }] : []),
    ...(targetWholesaleCashPrice !== undefined && targetWholesaleCashPrice !== null ? [{ label: '__wholesale_cash_price', value: String(targetWholesaleCashPrice) }] : []),
    ...(newProduct.additionalImage ? [{ label: '__additional_image', value: newProduct.additionalImage }] : []),
    ...(newProduct.rating !== undefined ? [{ label: '__rating', value: String(newProduct.rating) }] : []),
    ...(newProduct.reviewsCount !== undefined ? [{ label: '__reviews_count', value: String(newProduct.reviewsCount) }] : []),
    ...(newProduct.reviews && newProduct.reviews.length > 0 ? [{ label: '__reviews', value: JSON.stringify(newProduct.reviews) }] : [])
  ];

  console.log(`[CASH & VARIANT DEBUG - PRE-SAVE] (createProduct) Título: "${newProduct.title}"`);
  console.log(`  └─ Precios efectivo: Min: ${targetRetailCashPrice !== undefined ? `$${targetRetailCashPrice}` : 'N/A'} | May: ${targetWholesaleCashPrice !== undefined ? `$${targetWholesaleCashPrice}` : 'N/A'}`);
  console.log(`  └─ Objeto completo de variantes antes de guardar:`, JSON.stringify(currentVariantTypes, null, 2));

  if (isSupabaseConfigured() && supabaseInstance) {
    try {
      // Clean payload matching PostgreSQL / Supabase standard schema with resilient metadata embedding
      const dbPayload: Record<string, any> = {
        id: newProduct.id,
        title: newProduct.title,
        description: newProduct.description || '',
        category: newProduct.category,
        subcategory: newProduct.subcategory || '',
        images: newProduct.images,
        image_1: newProduct.images[0] || null,
        image_2: newProduct.images[1] || null,
        image_3: newProduct.images[2] || null,
        image_4: newProduct.images[3] || null,
        image_5: newProduct.images[4] || null,
        image_6: newProduct.images[5] || null,
        additional_image: newProduct.additionalImage || null,
        lifestyle_image: newProduct.additionalImage || null,
        min_wholesale_qty: newProduct.minWholesaleQty,
        wholesale_price: newProduct.wholesalePrice,
        retail_price: newProduct.retailPrice,
        cash_price: newProduct.cashPrice !== undefined ? newProduct.cashPrice : (targetRetailCashPrice ?? null),
        retail_cash_price: targetRetailCashPrice !== undefined ? targetRetailCashPrice : null,
        wholesale_cash_price: targetWholesaleCashPrice !== undefined ? targetWholesaleCashPrice : null,
        colors: colors,
        size_variants: sizeVariantsWithMeta,
        variant_types: currentVariantTypes,
        stock: newProduct.stock,
        sold_count: newProduct.soldCount || 0,
        rating: newProduct.rating !== undefined ? newProduct.rating : 5.0,
        reviews_count: newProduct.reviewsCount !== undefined ? newProduct.reviewsCount : (newProduct.reviews?.length || 128),
        reviews: newProduct.reviews || null,
        specs: specsWithMeta,
        is_best_seller: newProduct.isBestSeller || false
      };

      console.log(`[VARIANT DEBUG - DB-PAYLOAD] (createProduct) Payload completo enviado a Supabase:`);
      console.log(JSON.stringify(dbPayload, null, 2));

      const result = await executeAdaptiveProductWrite('insert', dbPayload);
      console.log(`[VARIANT DEBUG - DB-RESPONSE] (createProduct) Respuesta del guardado en Supabase:`, result);

      if (result.success) {
        console.log(`[Supabase] Producto ${newProduct.id} creado con éxito con ${(newProduct.images || []).length} imágenes y ${(currentVariantTypes || []).length} tipos de variante.`);
      } else {
        console.warn('[Supabase] Advertencia al guardar producto:', result.error);
      }
    } catch (e) {
      console.warn('Error saving to Supabase, saving locally:', e);
    }
  }

  // Update object with cleaned fields
  newProduct.variantTypes = currentVariantTypes;
  newProduct.colors = colors;
  newProduct.sizeVariants = sizeVariants;
  newProduct.specs = cleanUserSpecs;
  newProduct.retailCashPrice = targetRetailCashPrice;
  newProduct.wholesaleCashPrice = targetWholesaleCashPrice;

  // Always update local cache
  const local = getLocalProducts();
  saveLocalProducts([newProduct, ...local.filter(p => p.id !== newProduct.id)]);
  console.log(`================== [createProduct FIN] ==================\n`);
  return newProduct;
};

export const updateProduct = async (id: string, updates: Partial<Product>): Promise<Product> => {
  console.log(`\n================== [updateProduct INICIO] ==================`);
  console.log(`[updateProduct] ID objetivo: "${id}"`);
  console.log('[updateProduct] Updates recibidos:', JSON.stringify(updates, null, 2));

  const current = getLocalProducts();
  const index = current.findIndex(p => p.id === id);
  const existingProduct = index !== -1 ? current[index] : null;

  const finalImages = updates.images !== undefined
    ? (Array.isArray(updates.images) ? updates.images.slice(0, 6) : [updates.images])
    : (existingProduct && Array.isArray(existingProduct.images) ? existingProduct.images : []);

  const currentVariantTypes = updates.variantTypes !== undefined
    ? updates.variantTypes
    : (existingProduct?.variantTypes ? existingProduct.variantTypes : normalizeVariantTypes(existingProduct || updates));

  const targetWholesalePrice = updates.wholesalePrice !== undefined
    ? updates.wholesalePrice
    : (existingProduct?.wholesalePrice || 0);

  const targetRetailPrice = updates.retailPrice !== undefined
    ? updates.retailPrice
    : (existingProduct?.retailPrice || 0);

  const targetCashPrice = updates.cashPrice !== undefined
    ? updates.cashPrice
    : (existingProduct?.cashPrice !== undefined ? existingProduct.cashPrice : undefined);

  const targetRetailCashPrice = updates.retailCashPrice !== undefined
    ? updates.retailCashPrice
    : (existingProduct?.retailCashPrice !== undefined ? existingProduct.retailCashPrice : targetCashPrice);

  const targetWholesaleCashPrice = updates.wholesaleCashPrice !== undefined
    ? updates.wholesaleCashPrice
    : (existingProduct?.wholesaleCashPrice !== undefined ? existingProduct.wholesaleCashPrice : targetCashPrice);

  const { colors, sizeVariants, sizeVariantsWithMeta, serializedVariantTypesMeta } = syncLegacyFields(
    currentVariantTypes,
    targetWholesalePrice,
    targetRetailPrice,
    targetCashPrice,
    targetRetailCashPrice,
    targetWholesaleCashPrice
  );

  const baseSpecs = cleanSpecsList(updates.specs !== undefined ? updates.specs : existingProduct?.specs);
  const targetAdditionalImage = updates.additionalImage !== undefined ? updates.additionalImage : existingProduct?.additionalImage;
  const targetRating = updates.rating !== undefined ? updates.rating : (existingProduct?.rating ?? 5.0);
  const targetReviewsCount = updates.reviewsCount !== undefined ? updates.reviewsCount : (existingProduct?.reviewsCount ?? 128);
  const targetReviews = updates.reviews !== undefined ? updates.reviews : existingProduct?.reviews;

  const specsWithMeta: ProductSpec[] = [
    ...baseSpecs,
    { label: SPECS_VARIANT_TYPES_KEY, value: serializedVariantTypesMeta },
    ...(targetCashPrice !== undefined && targetCashPrice !== null ? [{ label: '__cash_price', value: String(targetCashPrice) }] : []),
    ...(targetRetailCashPrice !== undefined && targetRetailCashPrice !== null ? [{ label: '__retail_cash_price', value: String(targetRetailCashPrice) }] : []),
    ...(targetWholesaleCashPrice !== undefined && targetWholesaleCashPrice !== null ? [{ label: '__wholesale_cash_price', value: String(targetWholesaleCashPrice) }] : []),
    ...(targetAdditionalImage ? [{ label: '__additional_image', value: targetAdditionalImage }] : []),
    ...(targetRating !== undefined ? [{ label: '__rating', value: String(targetRating) }] : []),
    ...(targetReviewsCount !== undefined ? [{ label: '__reviews_count', value: String(targetReviewsCount) }] : []),
    ...(targetReviews && targetReviews.length > 0 ? [{ label: '__reviews', value: JSON.stringify(targetReviews) }] : [])
  ];

  console.log(`\n================== [CASH & VARIANT DEBUG - PRE-SAVE] (updateProduct) ==================`);
  console.log(`[updateProduct] ID: "${id}" | Título: "${updates.title || existingProduct?.title}"`);
  console.log(`[updateProduct] Precios en efectivo antes de guardar: Min: ${targetRetailCashPrice !== undefined ? `$${targetRetailCashPrice}` : 'N/A'} | May: ${targetWholesaleCashPrice !== undefined ? `$${targetWholesaleCashPrice}` : 'N/A'}`);
  console.log(`[updateProduct] Objeto completo de variantes antes de guardar:`, JSON.stringify(currentVariantTypes, null, 2));

  if (isSupabaseConfigured() && supabaseInstance) {
    try {
      const dbPayload: Record<string, any> = { id };
      if (updates.title !== undefined) dbPayload.title = updates.title;
      if (updates.description !== undefined) dbPayload.description = updates.description;
      if (updates.category !== undefined) dbPayload.category = updates.category;
      if (updates.subcategory !== undefined) dbPayload.subcategory = updates.subcategory;
      
      if (updates.images !== undefined || (finalImages && finalImages.length > 0)) {
        dbPayload.images = finalImages;
        // Asignación directa a columnas image_1..image_6 y compatibilidad
        dbPayload.image_1 = finalImages[0] || null;
        dbPayload.image_2 = finalImages[1] || null;
        dbPayload.image_3 = finalImages[2] || null;
        dbPayload.image_4 = finalImages[3] || null;
        dbPayload.image_5 = finalImages[4] || null;
        dbPayload.image_6 = finalImages[5] || null;
      }

      if (updates.additionalImage !== undefined) {
        dbPayload.additional_image = updates.additionalImage || null;
        dbPayload.lifestyle_image = updates.additionalImage || null;
      }

      if (updates.rating !== undefined) dbPayload.rating = updates.rating;
      if (updates.reviewsCount !== undefined) dbPayload.reviews_count = updates.reviewsCount;
      if (updates.reviews !== undefined) dbPayload.reviews = updates.reviews;

      if (updates.minWholesaleQty !== undefined) dbPayload.min_wholesale_qty = updates.minWholesaleQty;
      if (updates.wholesalePrice !== undefined) dbPayload.wholesale_price = updates.wholesalePrice;
      if (updates.retailPrice !== undefined) dbPayload.retail_price = updates.retailPrice;
      dbPayload.cash_price = targetCashPrice !== undefined && targetCashPrice !== null ? targetCashPrice : (targetRetailCashPrice ?? null);
      dbPayload.retail_cash_price = targetRetailCashPrice !== undefined && targetRetailCashPrice !== null ? targetRetailCashPrice : null;
      dbPayload.wholesale_cash_price = targetWholesaleCashPrice !== undefined && targetWholesaleCashPrice !== null ? targetWholesaleCashPrice : null;
      
      // Resilient multi-layer variant persistence
      dbPayload.colors = colors;
      dbPayload.size_variants = sizeVariantsWithMeta;
      dbPayload.variant_types = currentVariantTypes;
      dbPayload.specs = specsWithMeta;

      if (updates.stock !== undefined) dbPayload.stock = updates.stock;
      if (updates.soldCount !== undefined) dbPayload.sold_count = updates.soldCount;
      if (updates.isBestSeller !== undefined) dbPayload.is_best_seller = updates.isBestSeller;

      console.log(`[CASH & VARIANT DEBUG - DB-PAYLOAD] (updateProduct) Payload enviado a Supabase:`);
      console.log(JSON.stringify(dbPayload, null, 2));

      const result = await executeAdaptiveProductWrite('update', dbPayload, id);
      console.log(`[VARIANT DEBUG - DB-RESPONSE] (updateProduct) Respuesta recibida de Supabase:`, result);

      if (result.success) {
        console.log(`[Supabase] Producto ${id} actualizado correctamente con ${(finalImages || []).length} imágenes y ${(currentVariantTypes || []).length} tipos de variante.`);
      } else {
        console.error('[Supabase] Error al actualizar producto en Supabase:', result.error);
      }
    } catch (e) {
      console.error('[Supabase] Excepción en updateProduct:', e);
    }
  }

  const updated: Product = existingProduct
    ? {
        ...existingProduct,
        ...updates,
        images: finalImages,
        additionalImage: targetAdditionalImage,
        rating: targetRating,
        reviewsCount: targetReviewsCount,
        reviews: targetReviews,
        variantTypes: currentVariantTypes,
        colors,
        sizeVariants,
        specs: baseSpecs,
        cashPrice: targetCashPrice,
        retailCashPrice: targetRetailCashPrice,
        wholesaleCashPrice: targetWholesaleCashPrice,
      }
    : {
        id,
        title: updates.title || '',
        description: updates.description || '',
        category: updates.category || 'Bijuteria',
        subcategory: updates.subcategory || '',
        images: finalImages,
        additionalImage: targetAdditionalImage,
        minWholesaleQty: updates.minWholesaleQty || 1,
        wholesalePrice: targetWholesalePrice,
        retailPrice: targetRetailPrice,
        cashPrice: targetCashPrice,
        colors,
        sizeVariants,
        variantTypes: currentVariantTypes,
        stock: updates.stock || 0,
        soldCount: updates.soldCount || 0,
        rating: targetRating,
        reviewsCount: targetReviewsCount,
        reviews: targetReviews,
        specs: baseSpecs,
        isBestSeller: updates.isBestSeller || false,
        createdAt: updates.createdAt || new Date().toISOString()
      };

  if (index !== -1) {
    current[index] = updated;
  } else {
    current.unshift(updated);
  }
  saveLocalProducts(current);
  console.log('[updateProduct SALIDA] Retornando producto actualizado a la interfaz:', updated);
  console.log(`================== [updateProduct FIN] ==================\n`);
  return updated;
};

export const deleteProduct = async (id: string): Promise<boolean> => {
  console.log('[deleteProduct] Eliminando publicación/producto:', id);
  markProductDeleted(id);

  if (isSupabaseConfigured() && supabaseInstance) {
    try {
      const { error } = await supabaseInstance.from('products').delete().eq('id', id);
      if (error) {
        console.warn('Supabase delete error con id, probando con product_id:', error.message);
        await supabaseInstance.from('products').delete().eq('product_id', id);
      }
    } catch (e) {
      console.warn('Error deleting from Supabase:', e);
    }
  }

  const current = getLocalProducts();
  const prodToDelete = current.find((p) => p.id === id);
  const filtered = current.filter((p) => p.id !== id);
  saveLocalProducts(filtered);

  // Limpieza segura de imágenes de Supabase Storage únicamente si no se usan en otros productos ni categorías
  if (prodToDelete) {
    const imagesToCheck: string[] = [
      ...(prodToDelete.images || []),
      ...(prodToDelete.additionalImage ? [prodToDelete.additionalImage] : []),
    ];
    imagesToCheck.forEach((imgUrl) => {
      deleteStorageImageIfUnused(imgUrl, filtered);
    });
  }

  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('products-updated', { detail: { deletedId: id } }));
    } catch (e) {}
  }

  return true;
};

// Seed initial products to Supabase if connected
export const seedInitialProducts = async (): Promise<void> => {
  if (!isSupabaseConfigured() || !supabaseInstance) return;
  try {
    for (const prod of INITIAL_PRODUCTS) {
      const dbPayload = {
        id: prod.id,
        title: prod.title,
        description: prod.description,
        category: prod.category,
        subcategory: prod.subcategory,
        images: prod.images,
        image_1: prod.images[0] || null,
        image_2: prod.images[1] || null,
        image_3: prod.images[2] || null,
        image_4: prod.images[3] || null,
        image_5: prod.images[4] || null,
        image_6: prod.images[5] || null,
        min_wholesale_qty: prod.minWholesaleQty,
        wholesale_price: prod.wholesalePrice,
        retail_price: prod.retailPrice,
        cash_price: prod.cashPrice !== undefined ? prod.cashPrice : null,
        colors: prod.colors,
        size_variants: prod.sizeVariants,
        stock: prod.stock,
        sold_count: prod.soldCount || 0,
        rating: prod.rating || 5.0,
        reviews_count: prod.reviewsCount || 0,
        specs: prod.specs || [],
        is_best_seller: prod.isBestSeller || false
      };
      await executeAdaptiveProductWrite('upsert', dbPayload);
    }
    console.log('Seeded initial products to Supabase successfully with multi-images');
  } catch (err) {
    console.warn('Error seeding Supabase:', err);
  }
};

// ---------------- SUPABASE STORAGE (Image Upload con Optimización Automática) ---------------- //

// Caché en memoria de archivos ya subidos para reutilizar URLs existentes y evitar duplicados en Supabase Storage
const uploadedFileCache = new Map<string, string>();

const getFileFingerprint = (file: File): string => {
  return `${file.name}_${file.size}_${file.lastModified}`;
};

export interface UploadProductImageOptions extends ImageOptimizationOptions {
  onOptimized?: (result: OptimizationResult) => void;
}

export const uploadProductImage = async (
  file: File,
  options?: UploadProductImageOptions
): Promise<string> => {
  // Evitar subir de nuevo si el archivo ya fue subido en esta sesión y no cambió
  const fingerprint = getFileFingerprint(file);
  if (uploadedFileCache.has(fingerprint)) {
    const cachedUrl = uploadedFileCache.get(fingerprint)!;
    console.log(`[IMAGE UPLOAD] Reutilizando URL existente para archivo no modificado: "${file.name}" -> ${cachedUrl}`);
    return cachedUrl;
  }

  console.log(`[IMAGE UPLOAD] Iniciando procesamiento de archivo: "${file.name}" (${file.type || 'desconocido'}, ${(file.size / 1024).toFixed(1)} KB)`);

  // 1. Optimizar automáticamente la imagen (redimensionado inteligente 1200-1600px, compresión WebP, pesos óptimos)
  const optimization = await optimizeProductImage(file, options);
  const fileToUpload = optimization.file;

  if (options?.onOptimized) {
    options.onOptimized(optimization);
  }

  console.log(
    `[IMAGE UPLOAD] Archivo listo para Supabase: "${fileToUpload.name}" ` +
    `(${fileToUpload.type}, ${(fileToUpload.size / 1024).toFixed(1)} KB) ` +
    `[Original: ${(file.size / 1024).toFixed(1)} KB, Reducción: ${optimization.savedPercent.toFixed(1)}%]`
  );

  if (isSupabaseConfigured() && supabaseInstance) {
    try {
      const fileExt = fileToUpload.name.split('.').pop() || (fileToUpload.type === 'image/webp' ? 'webp' : 'jpg');
      const cleanExt = fileExt.toLowerCase().replace(/[^a-z0-9]/g, '');
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${cleanExt}`;
      const filePath = `products/${fileName}`;

      console.log(`[IMAGE UPLOAD] Subiendo al bucket "product-images" en ruta: "${filePath}"`);
      const { error: uploadError } = await supabaseInstance.storage
        .from('product-images')
        .upload(filePath, fileToUpload, {
          cacheControl: '31536000',
          upsert: true,
          contentType: fileToUpload.type || 'image/webp',
        });

      if (!uploadError) {
        const { data } = supabaseInstance.storage
          .from('product-images')
          .getPublicUrl(filePath);

        if (data?.publicUrl) {
          console.log(`[IMAGE UPLOAD] ✓ Archivo optimizado subido con éxito. URL Pública:`, data.publicUrl);
          uploadedFileCache.set(fingerprint, data.publicUrl);
          return data.publicUrl;
        } else {
          console.warn('[IMAGE UPLOAD] Subida completada pero no se pudo obtener publicUrl.');
        }
      } else {
        console.warn('[IMAGE UPLOAD] Error en upload de Supabase Storage:', uploadError.message, uploadError);
      }
    } catch (e) {
      console.warn('[IMAGE UPLOAD] Excepción al subir a Supabase storage:', e);
    }
  } else {
    console.warn('[IMAGE UPLOAD] Supabase no está configurado o falló, usando archivo optimizado en almacenamiento local.');
  }

  // Fallback: Convertir el archivo ya optimizado a DataURL
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const resultUrl = reader.result as string;
      uploadedFileCache.set(fingerprint, resultUrl);
      resolve(resultUrl);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(fileToUpload);
  });
};

export interface UploadProductImagesOptions {
  isFirstImageCover?: boolean;
  areAllSecondary?: boolean;
  onProgress?: (current: number, total: number, stats?: OptimizationResult) => void;
}

export const uploadProductImages = async (
  files: File[],
  onProgress?: (current: number, total: number, stats?: OptimizationResult) => void,
  options?: {
    isFirstImageCover?: boolean;
    areAllSecondary?: boolean;
  }
): Promise<string[]> => {
  if (!files || !Array.isArray(files) || files.length === 0) {
    return [];
  }
  console.log(`[UPLOAD PRODUCT IMAGES] Procesando ${files.length} imágenes concurrentemente...`);

  let completed = 0;
  const uploadPromises = files.map((file, i) => {
    const isCover = options?.areAllSecondary
      ? false
      : options?.isFirstImageCover !== undefined
      ? (options.isFirstImageCover ? i === 0 : false)
      : i === 0;

    let lastResult: OptimizationResult | undefined;
    return uploadProductImage(file, {
      isCover,
      onOptimized: (res) => {
        lastResult = res;
      },
    }).then((url) => {
      completed++;
      if (onProgress) {
        onProgress(completed, files.length, lastResult);
      }
      return url;
    });
  });

  const urls = await Promise.all(uploadPromises);
  console.log('[UPLOAD PRODUCT IMAGES] Subida concurrente completada con éxito.');
  return urls;
};

/**
 * Extrae la ruta relativa dentro del bucket 'product-images' si la URL pertenece a Supabase Storage.
 */
export const extractStoragePath = (url?: string): string | null => {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/\/product-images\/(.+?)(?:\?.*)?$/);
  if (match && match[1]) {
    return decodeURIComponent(match[1]);
  }
  return null;
};

/**
 * Comprueba de forma conservadora si una URL de imagen está siendo utilizada en algún producto o categoría.
 */
export const isImageUrlInUse = (
  imageUrl: string,
  products?: Product[],
  categories?: Category[]
): boolean => {
  if (!imageUrl || typeof imageUrl !== 'string') return false;
  const targetUrl = imageUrl.trim();

  // Consultar productos si se proporcionan (o desde caché / local)
  const prodsToCheck = (products && products.length > 0) ? products : getLocalProducts();
  for (const prod of prodsToCheck) {
    if (prod.images && prod.images.includes(targetUrl)) return true;
    if (prod.additionalImage && prod.additionalImage === targetUrl) return true;
    if (prod.variantTypes) {
      for (const vt of prod.variantTypes) {
        if (vt.options) {
          for (const opt of vt.options) {
            if (opt.images && opt.images.includes(targetUrl)) return true;
          }
        }
      }
    }
    if (prod.sizeVariants) {
      for (const sv of prod.sizeVariants) {
        if (sv.images && sv.images.includes(targetUrl)) return true;
      }
    }
  }

  // Consultar categorías
  const catsToCheck = (categories && categories.length > 0) ? categories : getCachedCategories();
  for (const cat of catsToCheck) {
    if (cat.image && cat.image === targetUrl) return true;
  }

  return false;
};

/**
 * Elimina una imagen de Supabase Storage únicamente si ya no está en uso en ninguna parte.
 */
export const deleteStorageImageIfUnused = async (
  imageUrl: string,
  products?: Product[],
  categories?: Category[]
): Promise<boolean> => {
  if (!imageUrl || !isSupabaseConfigured() || !supabaseInstance) return false;

  const storagePath = extractStoragePath(imageUrl);
  if (!storagePath) return false; // No es una imagen alojada en Supabase Storage

  // Si la imagen todavía se utiliza en algún producto o categoría, no eliminarla
  if (isImageUrlInUse(imageUrl, products, categories)) {
    return false;
  }

  try {
    const { error } = await supabaseInstance.storage
      .from('product-images')
      .remove([storagePath]);

    if (error) {
      console.warn(`[STORAGE] Error eliminando imagen huérfana "${storagePath}":`, error.message);
      return false;
    }
    console.log(`[STORAGE] ✓ Imagen huérfana eliminada de Supabase Storage: "${storagePath}"`);
    return true;
  } catch (err) {
    console.warn(`[STORAGE] Excepción al eliminar imagen "${storagePath}":`, err);
    return false;
  }
};

// ---------------- ORDERS API ---------------- //

export const getNextCorrelativeOrderNumber = async (): Promise<string> => {
  let maxSeq = 1000;

  // 1. Revisar secuencia guardada en localStorage
  try {
    const savedSeq = localStorage.getItem('my_commerce_correlative_order_seq');
    if (savedSeq) {
      const parsed = parseInt(savedSeq, 10);
      if (!isNaN(parsed) && parsed >= maxSeq) {
        maxSeq = parsed;
      }
    }
  } catch (e) {}

  // 2. Escanear todos los pedidos locales existentes
  try {
    const localOrders = getLocalOrders();
    localOrders.forEach((o) => {
      if (o.orderNumber) {
        const digits = o.orderNumber.replace(/\D/g, '');
        if (digits) {
          const val = parseInt(digits, 10);
          if (!isNaN(val) && val >= maxSeq && val < 1000000) {
            maxSeq = val;
          }
        }
      }
    });
  } catch (e) {}

  // 3. Escanear pedidos en Supabase de forma liviana (últimos 10 en lugar de 50)
  if (isSupabaseConfigured() && supabaseInstance) {
    try {
      const { data } = await supabaseInstance
        .from('orders')
        .select('order_number')
        .order('created_at', { ascending: false })
        .limit(10);
      if (data && Array.isArray(data)) {
        data.forEach((row: any) => {
          if (row.order_number) {
            const digits = String(row.order_number).replace(/\D/g, '');
            if (digits) {
              const val = parseInt(digits, 10);
              if (!isNaN(val) && val >= maxSeq && val < 1000000) {
                maxSeq = val;
              }
            }
          }
        });
      }
    } catch (e) {}
  }

  const nextSeq = maxSeq + 1;
  try {
    localStorage.setItem('my_commerce_correlative_order_seq', nextSeq.toString());
  } catch (e) {}

  return String(nextSeq);
};

export const saveOrder = async (
  orderData: Omit<Order, 'id' | 'createdAt'> & { orderNumber?: string; id?: string }
): Promise<Order> => {
  let orderNumber = orderData.orderNumber;
  if (!orderNumber) {
    orderNumber = await getNextCorrelativeOrderNumber();
  }
  const orderId = orderData.id || `ord-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
  const createdAt = new Date().toISOString();

  const newOrder: Order = {
    ...orderData,
    id: orderId,
    orderNumber,
    createdAt,
  };

  if (isSupabaseConfigured() && supabaseInstance) {
    try {
      const dbPayload = {
        id: newOrder.id,
        order_number: newOrder.orderNumber,
        user_id: newOrder.userId || null,
        customer_name: newOrder.customerName,
        customer_email: newOrder.customerEmail,
        customer_whatsapp: newOrder.customerWhatsapp,
        delivery_option: newOrder.deliveryOption,
        delivery_address: newOrder.deliveryAddress || null,
        shipping_method_name: newOrder.shippingMethodName || null,
        payment_method: newOrder.paymentMethod,
        items: newOrder.items,
        subtotal: newOrder.subtotal,
        wholesale_discount: newOrder.wholesaleDiscount || 0,
        cash_discount: newOrder.cashDiscount || 0,
        shipping_cost: newOrder.shippingCost || 0,
        total: newOrder.total,
        status: newOrder.status || 'pending_payment',
        created_at: newOrder.createdAt,
        email_sent_to_customer: newOrder.emailSentToCustomer ?? false,
        email_sent_to_admin: newOrder.emailSentToAdmin ?? false,
      };

      const { error } = await supabaseInstance.from('orders').insert([dbPayload]);
      if (error) {
        console.warn('Supabase saveOrder error:', error.message);
      }
    } catch (e) {
      console.warn('Error saving order to Supabase:', e);
    }
  }

  // Always save to unified local storage, preventing duplicates
  const currentOrders = getLocalOrders();
  const filtered = currentOrders.filter(
    (o) => o.id !== newOrder.id && o.orderNumber !== newOrder.orderNumber
  );
  const updatedOrders = [newOrder, ...filtered];
  saveLocalOrders(updatedOrders);

  // Dispatch realtime event across components
  try {
    window.dispatchEvent(
      new CustomEvent('my_commerce_orders_updated', {
        detail: { order: newOrder, action: 'create' },
      })
    );
  } catch (e) {
    // Non-browser safe fallback
  }

  return newOrder;
};

export const fetchOrders = async (): Promise<Order[]> => {
  let dbOrders: Order[] | null = null;

  if (isSupabaseConfigured() && supabaseInstance) {
    try {
      const { data, error } = await supabaseInstance
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Supabase fetchOrders error, fallback local:', error.message);
      } else if (data && Array.isArray(data)) {
        dbOrders = data.map((item: any) => ({
          id: item.id,
          orderNumber: item.order_number || item.orderNumber || `M-${item.id}`,
          userId: item.user_id || item.userId || undefined,
          customerName: item.customer_name || item.customerName || 'Cliente',
          customerEmail: item.customer_email || item.customerEmail || '',
          customerWhatsapp: item.customer_whatsapp || item.customerWhatsapp || '',
          deliveryOption: item.delivery_option || item.deliveryOption || 'pickup',
          shippingMethodName: item.shipping_method_name || item.shippingMethodName || undefined,
          deliveryAddress: item.delivery_address || item.deliveryAddress,
          paymentMethod: item.payment_method || item.paymentMethod || 'transfer',
          items: Array.isArray(item.items)
            ? item.items
            : (item.items ? (typeof item.items === 'string' ? JSON.parse(item.items) : item.items) : []),
          subtotal: Number(item.subtotal || 0),
          wholesaleDiscount: Number(item.wholesale_discount || item.wholesaleDiscount || 0),
          cashDiscount: Number(item.cash_discount || item.cashDiscount || 0),
          shippingCost: Number(item.shipping_cost || item.shippingCost || 0),
          total: Number(item.total || 0),
          status: item.status || 'pending_payment',
          createdAt: item.created_at || item.createdAt || new Date().toISOString(),
          emailSentToCustomer: Boolean(item.email_sent_to_customer || item.emailSentToCustomer),
          emailSentToAdmin: Boolean(item.email_sent_to_admin || item.emailSentToAdmin),
        }));
      }
    } catch (e) {
      console.warn('Error fetching orders from Supabase:', e);
    }
  }

  const localOrders = getLocalOrders();

  // Merge database orders and local orders to ensure a single deduplicated source of truth
  const orderMap = new Map<string, Order>();

  if (dbOrders && dbOrders.length > 0) {
    for (const ord of dbOrders) {
      const key = ord.orderNumber || ord.id;
      orderMap.set(key, ord);
    }
  }

  for (const ord of localOrders) {
    const key = ord.orderNumber || ord.id;
    if (!orderMap.has(key)) {
      orderMap.set(key, ord);
    } else if (!dbOrders) {
      orderMap.set(key, ord);
    }
  }

  const combinedOrders = Array.from(orderMap.values());
  // Sort most recent first
  combinedOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Cache deduplicated list locally
  saveLocalOrders(combinedOrders);

  return combinedOrders;
};

export const updateOrderStatus = async (orderId: string, status: Order['status']): Promise<void> => {
  if (isSupabaseConfigured() && supabaseInstance) {
    try {
      const { error } = await supabaseInstance
        .from('orders')
        .update({ status })
        .eq('id', orderId);
      if (error) {
        console.warn('Error updating order status in Supabase:', error.message);
      }
    } catch (e) {
      console.warn('Error updating order status in Supabase:', e);
    }
  }

  const currentOrders = getLocalOrders();
  const updated = currentOrders.map((o) => (o.id === orderId ? { ...o, status } : o));
  saveLocalOrders(updated);

  try {
    window.dispatchEvent(
      new CustomEvent('my_commerce_orders_updated', {
        detail: { orderId, status, action: 'update' },
      })
    );
  } catch (e) {
    // Ignore in non-browser environment
  }
};

export const updateOrderEmailStatus = async (
  orderId: string,
  emailSentToCustomer: boolean,
  emailSentToAdmin: boolean
): Promise<void> => {
  if (isSupabaseConfigured() && supabaseInstance) {
    try {
      const { error } = await supabaseInstance
        .from('orders')
        .update({
          email_sent_to_customer: emailSentToCustomer,
          email_sent_to_admin: emailSentToAdmin,
        })
        .eq('id', orderId);
      if (error) {
        console.warn('Error updating email status in Supabase:', error.message);
      }
    } catch (e) {
      console.warn('Error updating email status in Supabase:', e);
    }
  }

  const currentOrders = getLocalOrders();
  const updated = currentOrders.map((o) =>
    o.id === orderId
      ? {
          ...o,
          emailSentToCustomer,
          emailSentToAdmin,
        }
      : o
  );
  saveLocalOrders(updated);

  try {
    window.dispatchEvent(
      new CustomEvent('my_commerce_orders_updated', {
        detail: { orderId, emailSentToCustomer, emailSentToAdmin, action: 'email_status' },
      })
    );
  } catch (e) {
    // Ignore
  }
};

export const updateOrder = async (orderId: string, fields: Partial<Order>): Promise<void> => {
  if (isSupabaseConfigured() && supabaseInstance) {
    try {
      const dbPayload: Record<string, any> = {};
      if (fields.status !== undefined) dbPayload.status = fields.status;
      if (fields.customerName !== undefined) dbPayload.customer_name = fields.customerName;
      if (fields.customerEmail !== undefined) dbPayload.customer_email = fields.customerEmail;
      if (fields.customerWhatsapp !== undefined) dbPayload.customer_whatsapp = fields.customerWhatsapp;
      if (fields.deliveryOption !== undefined) dbPayload.delivery_option = fields.deliveryOption;
      if (fields.shippingMethodName !== undefined) dbPayload.shipping_method_name = fields.shippingMethodName;
      if (fields.deliveryAddress !== undefined) dbPayload.delivery_address = fields.deliveryAddress;
      if (fields.paymentMethod !== undefined) dbPayload.payment_method = fields.paymentMethod;
      if (fields.items !== undefined) dbPayload.items = fields.items;
      if (fields.subtotal !== undefined) dbPayload.subtotal = fields.subtotal;
      if (fields.wholesaleDiscount !== undefined) dbPayload.wholesale_discount = fields.wholesaleDiscount;
      if (fields.cashDiscount !== undefined) dbPayload.cash_discount = fields.cashDiscount;
      if (fields.shippingCost !== undefined) dbPayload.shipping_cost = fields.shippingCost;
      if (fields.total !== undefined) dbPayload.total = fields.total;
      if (fields.emailSentToCustomer !== undefined) dbPayload.email_sent_to_customer = fields.emailSentToCustomer;
      if (fields.emailSentToAdmin !== undefined) dbPayload.email_sent_to_admin = fields.emailSentToAdmin;

      const { error } = await supabaseInstance
        .from('orders')
        .update(dbPayload)
        .eq('id', orderId);
      if (error) {
        console.warn('Error updating order in Supabase:', error.message);
      }
    } catch (e) {
      console.warn('Error updating order in Supabase:', e);
    }
  }

  const currentOrders = getLocalOrders();
  const updated = currentOrders.map((o) => (o.id === orderId ? { ...o, ...fields } : o));
  saveLocalOrders(updated);

  try {
    window.dispatchEvent(
      new CustomEvent('my_commerce_orders_updated', {
        detail: { orderId, fields, action: 'update' },
      })
    );
  } catch (e) {
    // Ignore
  }
};

export const deleteOrder = async (orderId: string): Promise<void> => {
  if (isSupabaseConfigured() && supabaseInstance) {
    try {
      const { error } = await supabaseInstance
        .from('orders')
        .delete()
        .eq('id', orderId);
      if (error) {
        console.warn('Error deleting order in Supabase:', error.message);
      }
    } catch (e) {
      console.warn('Error deleting order in Supabase:', e);
    }
  }

  const currentOrders = getLocalOrders();
  const updated = currentOrders.filter((o) => o.id !== orderId);
  saveLocalOrders(updated);

  try {
    window.dispatchEvent(
      new CustomEvent('my_commerce_orders_updated', {
        detail: { orderId, action: 'delete' },
      })
    );
  } catch (e) {
    // Ignore
  }
};

// ---------------- CATEGORIES API ---------------- //

export const SYSTEM_CATEGORIES_ROW_ID = '__system_store_categories_v1__';

/**
 * Persists category list to Supabase.
 * Uses a dual strategy:
 * 1. Stores complete structured categories payload in the products table under the reserved row '__system_store_categories_v1__',
 *    which guarantees 100% cloud persistence on Supabase and across Vercel without requiring extra SQL migrations.
 * 2. Simultaneously attempts upsert to 'public.categories' table if created.
 */
export const syncCategoriesToSupabase = async (categories: Category[]): Promise<void> => {
  if (!isSupabaseConfigured() || !supabaseInstance) return;

  const sorted = [...categories].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  // 1. Guaranteed cloud synchronization row in products
  try {
    const systemRowPayload = {
      id: SYSTEM_CATEGORIES_ROW_ID,
      title: '__SYSTEM_CATEGORIES_CONFIG__',
      description: JSON.stringify(sorted),
      category: '__system__',
      wholesale_price: 0,
      retail_price: 0,
      stock: 0,
      specs: [{ key: 'updated_at', value: new Date().toISOString() }],
    };
    const { error: sysErr } = await supabaseInstance.from('products').upsert(systemRowPayload);
    if (sysErr) {
      console.warn('[syncCategoriesToSupabase] Error saving to system row:', sysErr.message);
    }
  } catch (err) {
    console.warn('[syncCategoriesToSupabase] System row sync error:', err);
  }

  // 2. Also upsert into dedicated categories table if it exists in Supabase schema
  try {
    const tablePayloads = sorted.map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug || slugifyCategory(cat.name),
      image_url: cat.image,
      sort_order: typeof cat.sortOrder === 'number' ? cat.sortOrder : 0,
      is_visible: cat.isVisible !== false,
      description: cat.description || '',
      created_at: cat.createdAt || new Date().toISOString(),
    }));
    await supabaseInstance.from('categories').upsert(tablePayloads);
  } catch (err) {
    // If public.categories table doesn't exist, this fails silently while the system row above succeeded
  }
};

export const fetchCategories = async (options?: { force?: boolean }): Promise<Category[]> => {
  const now = Date.now();
  if (!options?.force && cachedCategories && cachedCategories.length > 0 && (now - categoriesCacheTimestamp < CACHE_TTL_MS)) {
    return cachedCategories;
  }

  if (inFlightCategoriesPromise) {
    return inFlightCategoriesPromise;
  }

  inFlightCategoriesPromise = (async () => {
    try {
      let loadedFromCloud: Category[] | null = null;

      if (isSupabaseConfigured() && supabaseInstance) {
        // Strategy A: Dedicated categories table
        try {
          const { data, error } = await supabaseInstance
            .from('categories')
            .select('*')
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: true });

          if (!error && data && Array.isArray(data) && data.length > 0) {
            loadedFromCloud = data.map((item: any) => ({
              id: item.id,
              name: item.name,
              slug: item.slug || slugifyCategory(item.name),
              image: item.image_url || item.image || 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600',
              sortOrder: typeof item.sort_order === 'number' ? item.sort_order : (item.sortOrder || 0),
              isVisible: item.is_visible !== undefined ? Boolean(item.is_visible) : (item.isVisible !== undefined ? Boolean(item.isVisible) : true),
              description: item.description || '',
              createdAt: item.created_at || item.createdAt,
            }));
          }
        } catch (e) {
          // Table may not exist yet
        }

        // Strategy B: Dedicated cloud config row in products table
        if (!loadedFromCloud || loadedFromCloud.length === 0) {
          try {
            const { data, error } = await supabaseInstance
              .from('products')
              .select('description')
              .eq('id', SYSTEM_CATEGORIES_ROW_ID)
              .maybeSingle();

            if (!error && data && data.description) {
              const parsed = JSON.parse(data.description);
              if (Array.isArray(parsed) && parsed.length > 0) {
                loadedFromCloud = parsed.map((item: any, idx: number) => ({
                  id: item.id || `cat-${item.slug || idx}`,
                  name: item.name,
                  slug: item.slug || slugifyCategory(item.name),
                  image: item.image || 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600',
                  sortOrder: typeof item.sortOrder === 'number' ? item.sortOrder : idx + 1,
                  isVisible: item.isVisible !== false,
                  description: item.description || '',
                  createdAt: item.createdAt,
                }));
              }
            }
          } catch (e) {
            console.warn('[fetchCategories] Error reading from system row:', e);
          }
        }
      }

      // If cloud returned categories (from either strategy A or B)
      if (loadedFromCloud && loadedFromCloud.length > 0) {
        const rawLocal = getRawLocalCategories();
        // Merge with any offline/local categories that haven't synced yet
        const merged = mergeCategoriesLists(loadedFromCloud, rawLocal);
        const reconciled = reconcileCategoriesWithProducts(merged, cachedProducts || undefined);
        const sorted = reconciled.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        saveLocalCategories(sorted);
        // Ensure cloud storage locations are fresh in background
        syncCategoriesToSupabase(sorted).catch(() => {});
        return sorted;
      }

      // Fallback to local / initial categories
      const local = getLocalCategories();
      if (isSupabaseConfigured() && supabaseInstance && local.length > 0) {
        // Seed initial categories to Supabase cloud storage so Vercel has them on first load
        syncCategoriesToSupabase(local).catch(() => {});
      }
      return local;
    } finally {
      inFlightCategoriesPromise = null;
    }
  })();

  return inFlightCategoriesPromise;
};

export const saveCategory = async (category: Partial<Category>): Promise<Category> => {
  const rawName = (category.name || 'Nueva Categoría').trim();
  const slug = (category.slug || slugifyCategory(rawName)).toLowerCase().trim();
  const catId = category.id || `cat-${slug || Date.now()}`;
  const now = new Date().toISOString();

  // 1. Unmark from deleted categories set
  unmarkCategoryAsDeleted(catId, rawName, slug);

  // 2. Determine current list
  const current = getLocalCategories();
  const existingIdx = current.findIndex(
    (c) =>
      (c.id && c.id.toLowerCase() === catId.toLowerCase()) ||
      (c.slug && c.slug.toLowerCase() === slug) ||
      (c.name && c.name.trim().toLowerCase() === rawName.toLowerCase())
  );

  let sortOrder = category.sortOrder;
  if (sortOrder === undefined) {
    if (existingIdx >= 0) {
      sortOrder = current[existingIdx].sortOrder;
    } else {
      const maxOrder = current.length > 0 ? Math.max(...current.map((c) => c.sortOrder || 0)) : 0;
      sortOrder = maxOrder + 1;
    }
  }

  const fullCategory: Category = {
    id: existingIdx >= 0 ? current[existingIdx].id : catId,
    name: rawName,
    slug: slug,
    image: category.image || 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600',
    sortOrder: typeof sortOrder === 'number' ? sortOrder : 99,
    isVisible: category.isVisible !== false,
    description: category.description || '',
    createdAt: (existingIdx >= 0 ? current[existingIdx].createdAt : category.createdAt) || now,
  };

  let updatedList: Category[];
  if (existingIdx >= 0) {
    updatedList = [...current];
    updatedList[existingIdx] = fullCategory;
  } else {
    updatedList = [...current, fullCategory];
  }

  // Sort and clean up sortOrder
  updatedList.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  // 3. Save locally
  saveLocalCategories(updatedList);

  // 4. Persist to Supabase cloud (both system row and public.categories table)
  await syncCategoriesToSupabase(updatedList);

  // 5. Broadcast update event
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('categories-updated', { detail: updatedList }));
    } catch (e) {}
  }

  return fullCategory;
};

export const deleteCategory = async (
  categoryId: string,
  categoryName?: string
): Promise<{ success: boolean; affectedProductsCount: number }> => {
  console.log(`[deleteCategory] Eliminando categoría: id=${categoryId}, name=${categoryName}`);

  // 1. Resolve category info
  const currentCategories = getLocalCategories();
  const targetCategory = currentCategories.find(
    (c) => c.id === categoryId || (categoryName && c.name.toLowerCase() === categoryName.toLowerCase())
  );
  const resolvedName = targetCategory?.name || categoryName || '';
  const resolvedSlug = targetCategory?.slug || (resolvedName ? slugifyCategory(resolvedName) : '');
  const nameClean = resolvedName.trim().toLowerCase();
  const slugClean = resolvedSlug.trim().toLowerCase();

  // 2. Mark category as permanently deleted so it is never auto-recreated
  markCategoryAsDeleted(categoryId, resolvedName, resolvedSlug);

  // 3. Find and update all products assigned to this category to "Otros"
  const currentProducts = getLocalProducts();
  let affectedCount = 0;

  const updatedProducts = currentProducts.map((prod) => {
    const prodCat = (prod.category || '').trim().toLowerCase();
    const prodSub = (prod.subcategory || '').trim().toLowerCase();
    const prodCatSlug = slugifyCategory(prodCat);

    const isMatch =
      (nameClean && (prodCat === nameClean || prodSub === nameClean)) ||
      (slugClean && (prodCatSlug === slugClean || prodCat === slugClean));

    if (isMatch) {
      affectedCount++;
      return {
        ...prod,
        category: 'Otros',
        subcategory: prodSub === nameClean ? '' : prod.subcategory,
      };
    }
    return prod;
  });

  // 4. Save updated products locally
  if (affectedCount > 0) {
    saveLocalProducts(updatedProducts);
  }

  // 5. If Supabase is configured, update affected products in database
  if (isSupabaseConfigured() && supabaseInstance) {
    try {
      if (affectedCount > 0) {
        if (resolvedName) {
          await supabaseInstance
            .from('products')
            .update({ category: 'Otros' })
            .ilike('category', resolvedName);
        }
        if (resolvedSlug) {
          await supabaseInstance
            .from('products')
            .update({ category: 'Otros' })
            .ilike('category', resolvedSlug);
        }
      }

      // Delete from Supabase categories table
      await supabaseInstance.from('categories').delete().eq('id', categoryId);
      if (resolvedSlug) {
        await supabaseInstance.from('categories').delete().eq('slug', resolvedSlug);
      }
    } catch (e) {
      console.warn('Error syncing category deletion to Supabase:', e);
    }
  }

  // 6. Update local categories list (excluding the deleted one, and ensuring 'Otros' is present)
  const remainingCategories = currentCategories.filter((c) => {
    const cId = (c.id || '').trim().toLowerCase();
    const cSlug = (c.slug || slugifyCategory(c.name)).trim().toLowerCase();
    const cName = (c.name || '').trim().toLowerCase();
    if (cId === categoryId.toLowerCase()) return false;
    if (slugClean && cSlug === slugClean) return false;
    if (nameClean && cName === nameClean) return false;
    return true;
  });

  // Ensure 'Otros' category is available
  const hasOtros = remainingCategories.some(
    (c) => c.slug?.toLowerCase() === 'otros' || c.name?.toLowerCase() === 'otros'
  );
  if (!hasOtros) {
    remainingCategories.push(DEFAULT_OTHERS_CATEGORY);
  }

  remainingCategories.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  saveLocalCategories(remainingCategories);

  // Sync updated remaining categories to Supabase
  await syncCategoriesToSupabase(remainingCategories);

  // Limpieza segura de la imagen de categoría si estaba en Storage y no se usa en productos ni otras categorías
  if (targetCategory?.image) {
    deleteStorageImageIfUnused(targetCategory.image, updatedProducts, remainingCategories);
  }

  // Dispatch events for real-time reactivity
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('categories-updated', { detail: remainingCategories }));
      if (affectedCount > 0) {
        window.dispatchEvent(new CustomEvent('products-updated', { detail: updatedProducts }));
      }
    } catch (e) {}
  }

  return { success: true, affectedProductsCount: affectedCount };
};

export const reorderCategories = async (orderedCategories: Category[]): Promise<void> => {
  const updated = orderedCategories.map((cat, idx) => ({
    ...cat,
    sortOrder: idx + 1,
  }));

  saveLocalCategories(updated);

  await syncCategoriesToSupabase(updated);

  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('categories-updated', { detail: updated }));
    } catch (e) {}
  }
};

export const uploadCategoryImage = async (file: File): Promise<string> => {
  // Evitar subir de nuevo si el archivo ya fue subido en esta sesión
  const fingerprint = `cat_${file.name}_${file.size}_${file.lastModified}`;
  if (uploadedFileCache.has(fingerprint)) {
    const cachedUrl = uploadedFileCache.get(fingerprint)!;
    console.log(`[CATEGORY IMAGE] Reutilizando URL existente para imagen de categoría: "${file.name}" -> ${cachedUrl}`);
    return cachedUrl;
  }

  // Optimizar automáticamente imagen de categoría (1200px, WebP, ~150-250KB)
  const optimization = await optimizeProductImage(file, { isCover: false, maxDimension: 1200 });
  const fileToUpload = optimization.file;

  if (isSupabaseConfigured() && supabaseInstance) {
    try {
      const fileExt = fileToUpload.name.split('.').pop() || (fileToUpload.type === 'image/webp' ? 'webp' : 'jpg');
      const cleanExt = fileExt.toLowerCase().replace(/[^a-z0-9]/g, '');
      const fileName = `category-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${cleanExt}`;
      const filePath = `categories/${fileName}`;

      const { error: uploadError } = await supabaseInstance.storage
        .from('product-images')
        .upload(filePath, fileToUpload, {
          cacheControl: '31536000',
          upsert: true,
          contentType: fileToUpload.type || 'image/webp',
        });

      if (!uploadError) {
        const { data } = supabaseInstance.storage.from('product-images').getPublicUrl(filePath);
        if (data?.publicUrl) {
          uploadedFileCache.set(fingerprint, data.publicUrl);
          return data.publicUrl;
        }
      }
    } catch (e) {
      console.warn('Error uploading category image to Supabase Storage, using data URL:', e);
    }
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      uploadedFileCache.set(fingerprint, res);
      resolve(res);
    };
    reader.onerror = reject;
    reader.readAsDataURL(fileToUpload);
  });
};

export const SUPABASE_MIGRATION_SQL = `-- ==============================================================================
-- SCRIPT DE MIGRACIÓN: SOPORTE DE HASTA 6 IMÁGENES, CATEGORÍAS Y PERFILES DE USUARIO
-- Ejecuta este script en el SQL Editor de tu proyecto Supabase
-- ==============================================================================

-- 1. Añadir columna 'images' JSONB si no existe (almacena el arreglo ordenado de hasta 6 URLs)
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;

-- 2. Añadir columnas individuales (image_1 a image_6) y cash_price para máxima compatibilidad
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS image_1 TEXT,
ADD COLUMN IF NOT EXISTS image_2 TEXT,
ADD COLUMN IF NOT EXISTS image_3 TEXT,
ADD COLUMN IF NOT EXISTS image_4 TEXT,
ADD COLUMN IF NOT EXISTS image_5 TEXT,
ADD COLUMN IF NOT EXISTS image_6 TEXT,
ADD COLUMN IF NOT EXISTS cash_price NUMERIC;

-- 3. Tabla de Categorías independientes con imagen y orden propio
CREATE TABLE IF NOT EXISTS public.categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  image_url TEXT,
  sort_order INT DEFAULT 0,
  is_visible BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lectura pública de categorías" ON public.categories;
DROP POLICY IF EXISTS "Gestión de categorías" ON public.categories;
CREATE POLICY "Lectura pública de categorías" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Gestión de categorías" ON public.categories FOR ALL USING (true);

-- 4. Tabla de Perfiles de Usuario vinculada a auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  dni TEXT,
  street TEXT,
  street_number TEXT,
  floor TEXT,
  city TEXT,
  province TEXT,
  postal_code TEXT,
  receiver_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lectura pública/propia de perfiles" ON public.profiles;
DROP POLICY IF EXISTS "Actualización de perfiles propios" ON public.profiles;
DROP POLICY IF EXISTS "Inserción de perfiles propios" ON public.profiles;
CREATE POLICY "Lectura pública/propia de perfiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Actualización de perfiles propios" ON public.profiles FOR ALL USING (true);
CREATE POLICY "Inserción de perfiles propios" ON public.profiles FOR INSERT WITH CHECK (true);

-- Añadir columna user_id en la tabla orders si no existe
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS shipping_method_name TEXT;

-- 5. Migración y consolidación de imágenes existentes (Backfill automático)
-- Transfiere fotos desde columnas antiguas (image_url, image_1, image_2, etc.) al arreglo 'images' sin perder datos
DO $$
BEGIN
  -- Si existía columna 'image_url' antigua, sincronizarla a image_1 si está vacía
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'image_url') THEN
    UPDATE public.products 
    SET image_1 = COALESCE(image_1, (to_jsonb(products)->>'image_url'))
    WHERE image_1 IS NULL AND (to_jsonb(products)->>'image_url') IS NOT NULL;
  END IF;

  -- Consolidar cualquier foto existente en el arreglo JSONB 'images'
  UPDATE public.products
  SET images = (
    SELECT jsonb_agg(DISTINCT url)
    FROM (
      SELECT jsonb_array_elements_text(
        CASE 
          WHEN images IS NOT NULL AND jsonb_typeof(images) = 'array' 
          THEN images 
          ELSE '[]'::jsonb 
        END
      ) AS url
      UNION ALL
      SELECT unnest(ARRAY[image_1, image_2, image_3, image_4, image_5, image_6]) AS url
    ) t
    WHERE url IS NOT NULL AND trim(url) <> '' AND trim(url) <> 'null'
  )
  WHERE (images IS NULL OR images = '[]'::jsonb)
    AND (image_1 IS NOT NULL OR image_2 IS NOT NULL OR image_3 IS NOT NULL OR image_4 IS NOT NULL OR image_5 IS NOT NULL OR image_6 IS NOT NULL);

  -- Si después de lo anterior 'images' sigue siendo nulo, asignar arreglo vacío
  UPDATE public.products SET images = '[]'::jsonb WHERE images IS NULL;

  -- Sincronizar las columnas 1 a 6 a partir del arreglo 'images'
  UPDATE public.products
  SET 
    image_1 = COALESCE(image_1, images->>0),
    image_2 = COALESCE(image_2, images->>1),
    image_3 = COALESCE(image_3, images->>2),
    image_4 = COALESCE(image_4, images->>3),
    image_5 = COALESCE(image_5, images->>4),
    image_6 = COALESCE(image_6, images->>5)
  WHERE images IS NOT NULL AND jsonb_array_length(images) > 0;
END $$;

-- 6. Índice GIN para búsquedas y consultas optimizadas sobre 'images'
CREATE INDEX IF NOT EXISTS idx_products_images_gin ON public.products USING gin (images);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_is_best_seller ON public.products(is_best_seller);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON public.orders(customer_email);

-- 7. Restricción de tipo para asegurar que 'images' sea siempre un arreglo JSON
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS check_products_images_is_array;
ALTER TABLE public.products 
ADD CONSTRAINT check_products_images_is_array 
CHECK (images IS NULL OR jsonb_typeof(images) = 'array');

-- 8. Trigger opcional para mantener sincronizadas las columnas individuales y el arreglo JSONB
CREATE OR REPLACE FUNCTION public.sync_product_images_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- Si se inserta o actualiza el arreglo 'images', sincronizar columnas individuales
  IF NEW.images IS NOT NULL AND jsonb_typeof(NEW.images) = 'array' THEN
    NEW.image_1 := NEW.images->>0;
    NEW.image_2 := NEW.images->>1;
    NEW.image_3 := NEW.images->>2;
    NEW.image_4 := NEW.images->>3;
    NEW.image_5 := NEW.images->>4;
    NEW.image_6 := NEW.images->>5;
  -- Si se actualizan columnas individuales y 'images' está vacío, construir el arreglo
  ELSIF (NEW.images IS NULL OR jsonb_array_length(NEW.images) = 0) AND (NEW.image_1 IS NOT NULL) THEN
    NEW.images := (
      SELECT COALESCE(jsonb_agg(val), '[]'::jsonb)
      FROM (
        SELECT unnest(ARRAY[NEW.image_1, NEW.image_2, NEW.image_3, NEW.image_4, NEW.image_5, NEW.image_6]) AS val
      ) s
      WHERE val IS NOT NULL AND trim(val) <> ''
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_product_images ON public.products;
CREATE TRIGGER trg_sync_product_images
BEFORE INSERT OR UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.sync_product_images_trigger();

-- 9. Trigger para creación automática de perfil al registrarse en auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'phone',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 10. Configuración de Storage Bucket 'product-images' con políticas públicas
INSERT INTO storage.buckets (id, name, public) 
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Lectura pública de imágenes" ON storage.objects;
DROP POLICY IF EXISTS "Subida de imágenes" ON storage.objects;
DROP POLICY IF EXISTS "Modificación de imágenes" ON storage.objects;
DROP POLICY IF EXISTS "Eliminación de imágenes" ON storage.objects;

CREATE POLICY "Lectura pública de imágenes" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');
CREATE POLICY "Subida de imágenes" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'product-images');
CREATE POLICY "Modificación de imágenes" ON storage.objects FOR UPDATE USING (bucket_id = 'product-images');
CREATE POLICY "Eliminación de imágenes" ON storage.objects FOR DELETE USING (bucket_id = 'product-images');

-- 11. Políticas RLS para productos y órdenes
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lectura pública de productos" ON public.products;
DROP POLICY IF EXISTS "Gestión de productos" ON public.products;
CREATE POLICY "Lectura pública de productos" ON public.products FOR SELECT USING (true);
CREATE POLICY "Gestión de productos" ON public.products FOR ALL USING (true);
`;

export const SUPABASE_SQL_SETUP_SCHEMA = `-- SCHEMA SQL COMPLETO PARA SUPABASE (PROYECTOS NUEVOS O REINICIO)
-- Copia y pega este script en el SQL Editor de tu proyecto Supabase:

-- 1. Tabla de Productos con soporte para 6 imágenes (JSONB y columnas 1..6)
CREATE TABLE IF NOT EXISTS public.products (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  subcategory TEXT,
  images JSONB DEFAULT '[]'::jsonb,
  image_1 TEXT,
  image_2 TEXT,
  image_3 TEXT,
  image_4 TEXT,
  image_5 TEXT,
  image_6 TEXT,
  min_wholesale_qty INT DEFAULT 1,
  wholesale_price NUMERIC NOT NULL,
  retail_price NUMERIC NOT NULL,
  cash_price NUMERIC,
  colors JSONB DEFAULT '[]'::jsonb,
  size_variants JSONB DEFAULT '[]'::jsonb,
  stock INT DEFAULT 0,
  sold_count INT DEFAULT 0,
  rating NUMERIC DEFAULT 5.0,
  reviews_count INT DEFAULT 0,
  specs JSONB DEFAULT '[]'::jsonb,
  is_best_seller BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabla de Pedidos
CREATE TABLE IF NOT EXISTS public.orders (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_whatsapp TEXT NOT NULL,
  delivery_option TEXT NOT NULL,
  shipping_method_name TEXT,
  delivery_address JSONB,
  payment_method TEXT NOT NULL,
  items JSONB NOT NULL,
  subtotal NUMERIC NOT NULL,
  wholesale_discount NUMERIC DEFAULT 0,
  cash_discount NUMERIC DEFAULT 0,
  shipping_cost NUMERIC DEFAULT 0,
  total NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending_payment',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  email_sent_to_customer BOOLEAN DEFAULT false,
  email_sent_to_admin BOOLEAN DEFAULT false
);

-- 3. Tabla de Categorías independientes
CREATE TABLE IF NOT EXISTS public.categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  image_url TEXT,
  sort_order INT DEFAULT 0,
  is_visible BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Tabla de Perfiles vinculada a auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  dni TEXT,
  street TEXT,
  street_number TEXT,
  floor TEXT,
  city TEXT,
  province TEXT,
  postal_code TEXT,
  receiver_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Habilitar RLS y políticas públicas para e-commerce
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura pública de productos" ON public.products;
DROP POLICY IF EXISTS "Gestión de productos" ON public.products;
DROP POLICY IF EXISTS "Creación y lectura de pedidos" ON public.orders;
DROP POLICY IF EXISTS "Lectura pública de categorías" ON public.categories;
DROP POLICY IF EXISTS "Gestión de categorías" ON public.categories;
DROP POLICY IF EXISTS "Gestión de perfiles" ON public.profiles;

CREATE POLICY "Lectura pública de productos" ON public.products FOR SELECT USING (true);
CREATE POLICY "Gestión de productos" ON public.products FOR ALL USING (true);
CREATE POLICY "Creación y lectura de pedidos" ON public.orders FOR ALL USING (true);
CREATE POLICY "Lectura pública de categorías" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Gestión de categorías" ON public.categories FOR ALL USING (true);
CREATE POLICY "Gestión de perfiles" ON public.profiles FOR ALL USING (true);

-- 6. Trigger para auto-crear perfil al registrarse en Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'phone',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. Storage Bucket para Imágenes de Productos y Categorías
INSERT INTO storage.buckets (id, name, public) 
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Lectura pública de imágenes" ON storage.objects;
DROP POLICY IF EXISTS "Subida de imágenes" ON storage.objects;
DROP POLICY IF EXISTS "Modificación de imágenes" ON storage.objects;
DROP POLICY IF EXISTS "Eliminación de imágenes" ON storage.objects;

CREATE POLICY "Lectura pública de imágenes" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');
CREATE POLICY "Subida de imágenes" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'product-images');
CREATE POLICY "Modificación de imágenes" ON storage.objects FOR UPDATE USING (bucket_id = 'product-images');
-- 8. Tabla de Registro de Visitas y Analítica
CREATE TABLE IF NOT EXISTS public.site_visits (
  id TEXT PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  path TEXT NOT NULL,
  page_title TEXT,
  referrer TEXT,
  source TEXT NOT NULL,
  device TEXT NOT NULL,
  is_new_visitor BOOLEAN DEFAULT true,
  is_new_session BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lectura pública de visitas" ON public.site_visits;
DROP POLICY IF EXISTS "Inserción de visitas" ON public.site_visits;
CREATE POLICY "Lectura pública de visitas" ON public.site_visits FOR SELECT USING (true);
CREATE POLICY "Inserción de visitas" ON public.site_visits FOR ALL USING (true);
`;

/**
 * Diagnostic tool to check Supabase table column capabilities and image persistence
 */
export const testSupabaseImagesPersistence = async (): Promise<{
  connected: boolean;
  hasImagesColumn: boolean;
  hasNumberedColumns: boolean;
  imageCountDetected: number;
  message: string;
}> => {
  if (!isSupabaseConfigured() || !supabaseInstance) {
    return {
      connected: false,
      hasImagesColumn: false,
      hasNumberedColumns: false,
      imageCountDetected: 0,
      message: 'Supabase no está configurado. Usando almacenamiento local (LocalStorage).'
    };
  }

  try {
    const { data, error } = await supabaseInstance
      .from('products')
      .select('*')
      .limit(1);

    if (error) {
      return {
        connected: false,
        hasImagesColumn: false,
        hasNumberedColumns: false,
        imageCountDetected: 0,
        message: `Error al consultar Supabase: ${error.message}`
      };
    }

    if (data && data.length > 0) {
      const sample = data[0];
      const hasImages = sample.images !== undefined;
      const hasCols = sample.image_1 !== undefined || sample.image1 !== undefined;
      const extracted = extractProductImages(sample);

      return {
        connected: true,
        hasImagesColumn: hasImages,
        hasNumberedColumns: hasCols,
        imageCountDetected: extracted.length,
        message: hasImages
          ? `Conexión exitosa. Columna 'images' (JSONB) activa. Recupera hasta 6 imágenes por producto.`
          : hasCols
          ? `Conexión exitosa con columnas de respaldo. Se recomienda ejecutar el script de migración SQL para habilitar la columna JSONB.`
          : `Conexión exitosa pero tu tabla no tiene columnas de imágenes. Ejecuta el script de migración SQL.`
      };
    }

    return {
      connected: true,
      hasImagesColumn: true,
      hasNumberedColumns: true,
      imageCountDetected: 6,
      message: 'Conexión exitosa. La tabla está lista.'
    };
  } catch (err: any) {
    return {
      connected: false,
      hasImagesColumn: false,
      hasNumberedColumns: false,
      imageCountDetected: 0,
      message: `Fallo de conexión: ${err?.message || err}`
    };
  }
};
