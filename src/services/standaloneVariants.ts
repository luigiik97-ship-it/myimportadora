import { Product, VariantOption, VariantType } from '../types';
import { getSupabase, isSupabaseConfigured } from './supabase';
import { requireAdminAuth } from './adminAuth';
import { normalizeVariantTypes, getResolvedProductPrices, getOptionStock, isProductCompletelyOutOfStock } from '../utils/variantHelpers';

export interface StandaloneVariantItem {
  id: string; // Composite ID: "sv_<productId>_<optionId>"
  productId: string;
  variantTypeId: string;
  variantOptionId: string;
  variantOptionName: string;
  active: boolean;
  customOrder?: number;
  createdAt: string;
}

export interface StandaloneVariantsConfig {
  items: StandaloneVariantItem[];
  lastUpdated: string;
}

export interface StandaloneVariantCard {
  id: string; // e.g. "sv_<productId>_<optionId>"
  productId: string;
  originalProduct: Product;
  variantTypeId: string;
  variantTypeName: string;
  variantOptionId: string;
  variantOptionName: string;
  title: string; // General product title
  image: string; // Variant image
  retailPrice: number;
  wholesalePrice: number;
  cashPrice?: number;
  retailCashPrice?: number;
  wholesaleCashPrice?: number;
  minWholesaleQty: number;
  stock: number;
  category: string;
  isOutOfStock: boolean;
  isBestSeller?: boolean;
  virtualProduct: Product;
}

export const STORAGE_KEY_STANDALONE_VARIANTS = 'my_commerce_standalone_variants_v1';
export const SYSTEM_STANDALONE_VARIANTS_ROW_ID = '__system_standalone_variants_v1__';

export const DEFAULT_STANDALONE_VARIANTS_CONFIG: StandaloneVariantsConfig = {
  items: [],
  lastUpdated: new Date().toISOString(),
};

/**
 * Helper to generate a unique composite ID for a standalone variant
 */
export const buildStandaloneVariantId = (productId: string, optionId: string): string => {
  return `sv_${productId}_${optionId}`;
};

/**
 * Obtiene la configuración de variantes independientes guardada localmente o por defecto
 */
export const getStandaloneVariantsConfig = (): StandaloneVariantsConfig => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_STANDALONE_VARIANTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.items)) {
        return {
          items: parsed.items,
          lastUpdated: parsed.lastUpdated || new Date().toISOString(),
        };
      }
    }
  } catch (e) {
    console.warn('Error leyendo standaloneVariants desde localStorage:', e);
  }
  return DEFAULT_STANDALONE_VARIANTS_CONFIG;
};

/**
 * Guarda y propaga la configuración de variantes independientes tanto localmente como en Supabase,
 * garantizando persistencia en Vercel para todos los clientes y visitantes sin duplicar publicaciones.
 */
export const saveStandaloneVariantsConfig = async (
  config: Partial<StandaloneVariantsConfig>
): Promise<StandaloneVariantsConfig> => {
  requireAdminAuth('guardar variantes independientes');
  const current = getStandaloneVariantsConfig();
  const updated: StandaloneVariantsConfig = {
    items: config.items !== undefined ? config.items : current.items,
    lastUpdated: new Date().toISOString(),
  };

  // Guardar en localStorage
  try {
    localStorage.setItem(STORAGE_KEY_STANDALONE_VARIANTS, JSON.stringify(updated));
  } catch (e) {
    console.warn('Error guardando standaloneVariants en localStorage:', e);
  }

  // Notificar a toda la aplicación en tiempo real
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('my_commerce_standalone_variants_updated', {
        detail: updated,
      })
    );
  }

  // Sincronizar en Supabase para que aplique en la web publicada en Vercel
  const supabase = getSupabase();
  if (isSupabaseConfigured() && supabase) {
    try {
      const { error } = await supabase.from('products').upsert({
        id: SYSTEM_STANDALONE_VARIANTS_ROW_ID,
        title: '__SYSTEM_STANDALONE_VARIANTS__',
        description: JSON.stringify(updated),
        category: '__system__',
        wholesale_price: 0,
        retail_price: 0,
        stock: 0,
        specs: [{ key: 'updated_at', value: updated.lastUpdated }],
      });
      if (error) {
        console.warn('Error sincronizando standaloneVariants en Supabase:', error.message);
      } else {
        console.log('[StandaloneVariants] Configuración sincronizada exitosamente en Supabase');
      }
    } catch (e) {
      console.warn('Error de red sincronizando standaloneVariants en Supabase:', e);
    }
  }

  return updated;
};

/**
 * Consulta y sincroniza la configuración de variantes independientes desde Supabase
 */
export const fetchStandaloneVariantsFromSupabase = async (): Promise<StandaloneVariantsConfig> => {
  const supabase = getSupabase();
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('description')
        .eq('id', SYSTEM_STANDALONE_VARIANTS_ROW_ID)
        .maybeSingle();

      if (error) {
        console.warn('Error consultando standaloneVariants en Supabase:', error.message);
        return getStandaloneVariantsConfig();
      }

      if (data && data.description) {
        const parsed = JSON.parse(data.description);
        if (parsed && Array.isArray(parsed.items)) {
          const config: StandaloneVariantsConfig = {
            items: parsed.items,
            lastUpdated: parsed.lastUpdated || new Date().toISOString(),
          };
          try {
            localStorage.setItem(STORAGE_KEY_STANDALONE_VARIANTS, JSON.stringify(config));
          } catch (e) {}

          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('my_commerce_standalone_variants_updated', {
                detail: config,
              })
            );
          }
          return config;
        }
      }
    } catch (e) {
      console.warn('Error de red obteniendo standaloneVariants desde Supabase:', e);
    }
  }
  return getStandaloneVariantsConfig();
};

/**
 * Transforma los items configurados en tarjetas virtuales completas con imagen, precio y título general
 */
export const buildStandaloneVariantCards = (
  products: Product[],
  config?: StandaloneVariantsConfig
): StandaloneVariantCard[] => {
  const effectiveConfig = config || getStandaloneVariantsConfig();
  if (!effectiveConfig.items || effectiveConfig.items.length === 0) {
    return [];
  }

  const productsMap = new Map<string, Product>();
  products.forEach((p) => {
    if (p && p.id && !p.id.startsWith('__system_')) {
      productsMap.set(String(p.id), p);
    }
  });

  const cards: StandaloneVariantCard[] = [];

  for (const item of effectiveConfig.items) {
    if (!item.active) continue;

    const prod = productsMap.get(String(item.productId));
    if (!prod) continue;

    const variantTypes: VariantType[] = normalizeVariantTypes(prod);
    const targetType = variantTypes.find((vt) => vt.id === item.variantTypeId) || variantTypes[0];
    if (!targetType) continue;

    const targetOption =
      targetType.options.find((opt) => opt.id === item.variantOptionId) ||
      targetType.options.find((opt) => opt.name.toLowerCase() === item.variantOptionName.toLowerCase());

    if (!targetOption) continue;

    // Resolver precios específicos de la variante
    const resolvedPrices = getResolvedProductPrices(prod, {
      [targetType.id]: targetOption.name,
      [targetType.name]: targetOption.name,
    });

    // Resolver imagen de la variante (usa la imagen de la variante con fallback a la publicación)
    const variantImage =
      (targetOption.images && targetOption.images.length > 0 && targetOption.images[0]) ||
      (prod.images && prod.images.length > 0 && prod.images[0]) ||
      'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=400';

    // Resolver stock
    const optionStock = getOptionStock(prod, targetOption, targetType.id);
    const isOutOfStock = optionStock <= 0 && isProductCompletelyOutOfStock(prod);

    // Objeto de producto virtual para reutilizar componentes existentes (ProductCardPrice, etc.)
    const virtualProduct: Product = {
      ...prod,
      id: item.id, // ID virtual único
      title: prod.title, // Mantiene el título general de la publicación
      images: [variantImage, ...(prod.images || [])],
      retailPrice: resolvedPrices.retailPrice,
      wholesalePrice: resolvedPrices.wholesalePrice,
      cashPrice: resolvedPrices.cashPrice,
      retailCashPrice: resolvedPrices.retailCashPrice,
      wholesaleCashPrice: resolvedPrices.wholesaleCashPrice,
      stock: optionStock,
    };

    cards.push({
      id: item.id,
      productId: prod.id,
      originalProduct: prod,
      variantTypeId: targetType.id,
      variantTypeName: targetType.name,
      variantOptionId: targetOption.id,
      variantOptionName: targetOption.name,
      title: prod.title, // Mantiene el título general del producto
      image: variantImage,
      retailPrice: resolvedPrices.retailPrice,
      wholesalePrice: resolvedPrices.wholesalePrice,
      cashPrice: resolvedPrices.cashPrice,
      retailCashPrice: resolvedPrices.retailCashPrice,
      wholesaleCashPrice: resolvedPrices.wholesaleCashPrice,
      minWholesaleQty: prod.minWholesaleQty || 1,
      stock: optionStock,
      category: prod.category,
      isOutOfStock,
      isBestSeller: prod.isBestSeller,
      virtualProduct,
    });
  }

  return cards;
};
