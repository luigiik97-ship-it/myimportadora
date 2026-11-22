import { Product, ProductSpec, SizeVariant, VariantOption, VariantType, CartItem, PriceTier, ProductPricingMode } from '../types';

export const META_VARIANT_TYPES_KEY = '__meta_variant_types__';
export const SPECS_VARIANT_TYPES_KEY = '__variant_types';

/**
 * Extracts and normalizes variant types from any source (API DB item, partial product, or local item).
 * Safely recovers per-option image galleries from:
 * 1. Dedicated `variantTypes` / `variant_types` field
 * 2. Embedded metadata inside `size_variants` (JSONB)
 * 3. Embedded metadata inside `specs`
 * 4. Rich sizeVariants array with images
 * 5. Legacy colors and sizeVariants lists
 */
export function normalizeVariantTypes(product: Partial<Product> | any): VariantType[] {
  if (!product) return [];

  // 1. Direct variantTypes or variant_types array/string
  let rawVariantTypes = product.variantTypes ?? product.variant_types;
  if (typeof rawVariantTypes === 'string') {
    try {
      rawVariantTypes = JSON.parse(rawVariantTypes);
    } catch {
      rawVariantTypes = undefined;
    }
  }

  if (Array.isArray(rawVariantTypes) && rawVariantTypes.length > 0) {
    const valid = rawVariantTypes
      .filter((vt) => vt && typeof vt === 'object' && vt.name)
      .map((vt: any, vtIdx: number) => ({
        id: vt.id || `vt-${vtIdx + 1}`,
        name: vt.name || (vtIdx === 0 ? 'Color / Modelo' : 'Tamaño / Medida'),
        options: (Array.isArray(vt.options) ? vt.options : []).map((opt: any, optIdx: number) => ({
          id: opt.id || `opt-${vtIdx}-${optIdx}-${Date.now()}`,
          name: opt.name || `Opción ${optIdx + 1}`,
          images: Array.isArray(opt.images) ? opt.images.filter((img: any) => typeof img === 'string' && img.trim().length > 0) : [],
          stock: opt.stock !== undefined && opt.stock !== null && !isNaN(Number(opt.stock)) ? Math.max(0, Number(opt.stock)) : undefined,
          unitsPerSet:
            opt.unitsPerSet !== undefined && opt.unitsPerSet !== null && !isNaN(Number(opt.unitsPerSet)) && Number(opt.unitsPerSet) >= 1
              ? Math.floor(Number(opt.unitsPerSet))
              : opt.units_per_set !== undefined && opt.units_per_set !== null && !isNaN(Number(opt.units_per_set)) && Number(opt.units_per_set) >= 1
              ? Math.floor(Number(opt.units_per_set))
              : undefined,
          wholesalePrice: opt.wholesalePrice !== undefined && opt.wholesalePrice !== null && !isNaN(Number(opt.wholesalePrice))
            ? Number(opt.wholesalePrice)
            : opt.wholesale_price !== undefined && opt.wholesale_price !== null && !isNaN(Number(opt.wholesale_price))
            ? Number(opt.wholesale_price)
            : undefined,
          retailPrice: opt.retailPrice !== undefined && opt.retailPrice !== null && !isNaN(Number(opt.retailPrice))
            ? Number(opt.retailPrice)
            : opt.retail_price !== undefined && opt.retail_price !== null && !isNaN(Number(opt.retail_price))
            ? Number(opt.retail_price)
            : undefined,
          cashPrice: opt.cashPrice !== undefined && opt.cashPrice !== null && !isNaN(Number(opt.cashPrice))
            ? Number(opt.cashPrice)
            : opt.cash_price !== undefined && opt.cash_price !== null && !isNaN(Number(opt.cash_price))
            ? Number(opt.cash_price)
            : undefined,
          retailCashPrice: opt.retailCashPrice !== undefined && opt.retailCashPrice !== null && !isNaN(Number(opt.retailCashPrice))
            ? Number(opt.retailCashPrice)
            : opt.retail_cash_price !== undefined && opt.retail_cash_price !== null && !isNaN(Number(opt.retail_cash_price))
            ? Number(opt.retail_cash_price)
            : undefined,
          wholesaleCashPrice: opt.wholesaleCashPrice !== undefined && opt.wholesaleCashPrice !== null && !isNaN(Number(opt.wholesaleCashPrice))
            ? Number(opt.wholesaleCashPrice)
            : opt.wholesale_cash_price !== undefined && opt.wholesale_cash_price !== null && !isNaN(Number(opt.wholesale_cash_price))
            ? Number(opt.wholesale_cash_price)
            : undefined,
          sku: opt.sku || undefined,
          outOfStockBadge: opt.outOfStockBadge || undefined,
          customBadgeText: opt.customBadgeText || undefined,
        })),
      }));

    if (valid.length > 0) {
      return valid;
    }
  }

  // 2. Check embedded metadata inside size_variants / sizeVariants
  let rawSizeVariants = product.sizeVariants ?? product.size_variants;
  if (typeof rawSizeVariants === 'string') {
    try {
      rawSizeVariants = JSON.parse(rawSizeVariants);
    } catch {
      rawSizeVariants = [];
    }
  }

  if (Array.isArray(rawSizeVariants) && rawSizeVariants.length > 0) {
    // Look for meta record
    const metaItem = rawSizeVariants.find(
      (item: any) =>
        item &&
        (item.id === META_VARIANT_TYPES_KEY ||
          item.name === META_VARIANT_TYPES_KEY ||
          item.__isVariantTypesMeta ||
          item.variantTypes)
    );

    if (metaItem) {
      let metaData = metaItem.variantTypes;
      if (!metaData && metaItem.sku && typeof metaItem.sku === 'string' && metaItem.sku.startsWith('[')) {
        try {
          metaData = JSON.parse(metaItem.sku);
        } catch {
          metaData = undefined;
        }
      }
      if (Array.isArray(metaData) && metaData.length > 0) {
        return normalizeVariantTypes({ variantTypes: metaData });
      }
    }
  }

  // 3. Check embedded metadata in specs
  let rawSpecs = product.specs;
  if (typeof rawSpecs === 'string') {
    try {
      rawSpecs = JSON.parse(rawSpecs);
    } catch {
      rawSpecs = [];
    }
  }

  if (Array.isArray(rawSpecs)) {
    const specMeta = rawSpecs.find(
      (s: any) =>
        s &&
        (s.key === SPECS_VARIANT_TYPES_KEY ||
          s.label === SPECS_VARIANT_TYPES_KEY ||
          s.key === '__variant_types' ||
          s.key === 'variantTypes')
    );
    if (specMeta && specMeta.value) {
      try {
        const parsed = JSON.parse(specMeta.value);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return normalizeVariantTypes({ variantTypes: parsed });
        }
      } catch {
        // ignore JSON parse error
      }
    }
  }

  // 4. Fallback: Reconstruct from legacy `colors` and `sizeVariants`
  const result: VariantType[] = [];

  // Filter out any meta items from sizeVariants
  const cleanSizeVariants = Array.isArray(rawSizeVariants)
    ? rawSizeVariants.filter((sv: any) => sv && sv.id !== META_VARIANT_TYPES_KEY && sv.name !== META_VARIANT_TYPES_KEY)
    : [];

  let rawColors = product.colors;
  if (typeof rawColors === 'string') {
    try {
      rawColors = JSON.parse(rawColors);
    } catch {
      rawColors = rawColors.trim() ? [rawColors] : [];
    }
  }
  const cleanColors = Array.isArray(rawColors) ? rawColors.filter(Boolean) : [];

  // If there are colors, create Variant Type 1 (Color / Modelo)
  if (cleanColors.length > 0) {
    result.push({
      id: 'vt-color',
      name: 'Color / Modelo',
      options: cleanColors.map((colorItem: any, idx: number) => {
        const isObj = colorItem && typeof colorItem === 'object';
        const name = isObj ? colorItem.name || `Color ${idx + 1}` : String(colorItem);
        const images = isObj && Array.isArray(colorItem.images) ? colorItem.images.filter(Boolean) : [];
        return {
          id: `opt-color-${idx}-${name.toLowerCase().replace(/\s+/g, '-')}`,
          name,
          images,
        };
      }),
    });
  }

  // If there are size variants, create Variant Type 2 (Tamaño / Medida)
  if (cleanSizeVariants.length > 0) {
    // If there were NO colors, this is a 1-variant product (e.g. Size or Model)
    const typeName = cleanColors.length === 0 ? 'Opción / Modelo' : 'Tamaño / Medida';
    const typeId = cleanColors.length === 0 ? 'vt-option' : 'vt-size';

    result.push({
      id: typeId,
      name: typeName,
      options: cleanSizeVariants.map((sv: any, idx: number) => {
        const wholesalePrice =
          sv.wholesalePrice !== undefined && sv.wholesalePrice !== null && !isNaN(Number(sv.wholesalePrice))
            ? Number(sv.wholesalePrice)
            : sv.wholesale_price !== undefined && sv.wholesale_price !== null && !isNaN(Number(sv.wholesale_price))
            ? Number(sv.wholesale_price)
            : undefined;

        const retailPrice =
          sv.retailPrice !== undefined && sv.retailPrice !== null && !isNaN(Number(sv.retailPrice))
            ? Number(sv.retailPrice)
            : sv.retail_price !== undefined && sv.retail_price !== null && !isNaN(Number(sv.retail_price))
            ? Number(sv.retail_price)
            : undefined;

        const cashPrice =
          sv.cashPrice !== undefined && sv.cashPrice !== null && !isNaN(Number(sv.cashPrice))
            ? Number(sv.cashPrice)
            : sv.cash_price !== undefined && sv.cash_price !== null && !isNaN(Number(sv.cash_price))
            ? Number(sv.cash_price)
            : undefined;

        const retailCashPrice =
          sv.retailCashPrice !== undefined && sv.retailCashPrice !== null && !isNaN(Number(sv.retailCashPrice))
            ? Number(sv.retailCashPrice)
            : sv.retail_cash_price !== undefined && sv.retail_cash_price !== null && !isNaN(Number(sv.retail_cash_price))
            ? Number(sv.retail_cash_price)
            : undefined;

        const wholesaleCashPrice =
          sv.wholesaleCashPrice !== undefined && sv.wholesaleCashPrice !== null && !isNaN(Number(sv.wholesaleCashPrice))
            ? Number(sv.wholesaleCashPrice)
            : sv.wholesale_cash_price !== undefined && sv.wholesale_cash_price !== null && !isNaN(Number(sv.wholesale_cash_price))
            ? Number(sv.wholesale_cash_price)
            : undefined;

        return {
          id: sv.id || `opt-size-${idx}`,
          name: sv.name || `Variante ${idx + 1}`,
          images: Array.isArray(sv.images) ? sv.images.filter(Boolean) : [],
          stock: sv.stock !== undefined && sv.stock !== null && !isNaN(Number(sv.stock)) ? Math.max(0, Number(sv.stock)) : undefined,
          unitsPerSet:
            sv.unitsPerSet !== undefined && sv.unitsPerSet !== null && !isNaN(Number(sv.unitsPerSet)) && Number(sv.unitsPerSet) >= 1
              ? Math.floor(Number(sv.unitsPerSet))
              : sv.units_per_set !== undefined && sv.units_per_set !== null && !isNaN(Number(sv.units_per_set)) && Number(sv.units_per_set) >= 1
              ? Math.floor(Number(sv.units_per_set))
              : undefined,
          wholesalePrice,
          retailPrice,
          cashPrice,
          retailCashPrice,
          wholesaleCashPrice,
          sku: sv.sku || undefined,
          outOfStockBadge: sv.outOfStockBadge || undefined,
          customBadgeText: sv.customBadgeText || undefined,
        };
      }),
    });
  }

  return result;
}

/**
 * Strips internal metadata items from sizeVariants so UI never displays them
 */
export function cleanSizeVariantsList(sizeVariants: any): SizeVariant[] {
  let list = sizeVariants;
  if (typeof list === 'string') {
    try {
      list = JSON.parse(list);
    } catch {
      list = [];
    }
  }
  if (!Array.isArray(list)) return [];
  return list.filter(
    (sv) => sv && sv.id !== META_VARIANT_TYPES_KEY && sv.name !== META_VARIANT_TYPES_KEY
  );
}

/**
 * Strips internal metadata entries from specs so UI never displays them
 */
export function cleanSpecsList(specs: any[] | undefined | null): ProductSpec[] {
  if (!Array.isArray(specs)) return [];
  return specs
    .filter((s: any) => {
      if (!s) return false;
      const keyOrLabel = s.key || s.label;
      if (!keyOrLabel || typeof keyOrLabel !== 'string') return false;
      if (keyOrLabel.startsWith('__')) return false;
      return (
        keyOrLabel !== SPECS_VARIANT_TYPES_KEY &&
        keyOrLabel !== 'variantTypes' &&
        keyOrLabel !== 'cashPrice' &&
        keyOrLabel !== 'retailCashPrice' &&
        keyOrLabel !== 'wholesaleCashPrice' &&
        keyOrLabel !== 'videoUrl' &&
        keyOrLabel !== 'additionalImage' &&
        keyOrLabel !== 'rating' &&
        keyOrLabel !== 'reviewsCount' &&
        keyOrLabel !== 'reviews' &&
        keyOrLabel !== 'tagId' &&
        keyOrLabel !== 'tag'
      );
    })
    .map((s: any) => ({
      label: s.label || s.key || 'Especificación',
      value: String(s.value || ''),
    }));
}

/**
 * Synchronizes legacy `colors` and `sizeVariants` from `variantTypes`
 * and generates durable fallback persistence payloads (metadata in size_variants and specs)
 * to maintain 100% data fidelity and backwards compatibility across all database schemas.
 */
export function syncLegacyFields(
  variantTypes: VariantType[],
  fallbackWholesalePrice: number = 0,
  fallbackRetailPrice: number = 0,
  fallbackCashPrice?: number,
  fallbackRetailCashPrice?: number,
  fallbackWholesaleCashPrice?: number
): {
  colors: string[];
  sizeVariants: SizeVariant[];
  sizeVariantsWithMeta: any[];
  serializedVariantTypesMeta: string;
} {
  let colors: string[] = [];
  let sizeVariants: SizeVariant[] = [];

  if (!variantTypes || variantTypes.length === 0) {
    return {
      colors: [],
      sizeVariants: [],
      sizeVariantsWithMeta: [],
      serializedVariantTypesMeta: JSON.stringify([]),
    };
  }

  // Deep clone to ensure clean serialization
  const serializedVariantTypesMeta = JSON.stringify(variantTypes);

  if (variantTypes.length === 1) {
    const singleType = variantTypes[0];
    const isSizeType =
      singleType.name.toLowerCase().includes('tamaño') ||
      singleType.name.toLowerCase().includes('medida') ||
      singleType.name.toLowerCase().includes('talle') ||
      singleType.options.some((o) => o.wholesalePrice !== undefined || o.cashPrice !== undefined || o.retailCashPrice !== undefined || o.wholesaleCashPrice !== undefined);

    if (isSizeType) {
      sizeVariants = singleType.options.map((o) => ({
        id: o.id,
        name: o.name,
        images: o.images || [],
        stock: o.stock !== undefined ? o.stock : undefined,
        unitsPerSet: o.unitsPerSet !== undefined ? o.unitsPerSet : undefined,
        wholesalePrice: o.wholesalePrice !== undefined ? o.wholesalePrice : fallbackWholesalePrice,
        retailPrice: o.retailPrice !== undefined ? o.retailPrice : fallbackRetailPrice,
        cashPrice: o.cashPrice !== undefined ? o.cashPrice : fallbackCashPrice,
        retailCashPrice: o.retailCashPrice !== undefined ? o.retailCashPrice : fallbackRetailCashPrice,
        wholesaleCashPrice: o.wholesaleCashPrice !== undefined ? o.wholesaleCashPrice : fallbackWholesaleCashPrice,
        sku: o.sku,
        outOfStockBadge: o.outOfStockBadge,
        customBadgeText: o.customBadgeText,
      }));
      colors = [];
    } else {
      colors = singleType.options.map((o) => o.name).filter(Boolean);
      // Map options to sizeVariants too so per-option images and stock are saved in size_variants JSONB
      sizeVariants = singleType.options.map((o) => ({
        id: o.id,
        name: o.name,
        images: o.images || [],
        stock: o.stock !== undefined ? o.stock : undefined,
        unitsPerSet: o.unitsPerSet !== undefined ? o.unitsPerSet : undefined,
        wholesalePrice: o.wholesalePrice !== undefined ? o.wholesalePrice : fallbackWholesalePrice,
        retailPrice: o.retailPrice !== undefined ? o.retailPrice : fallbackRetailPrice,
        cashPrice: o.cashPrice !== undefined ? o.cashPrice : fallbackCashPrice,
        retailCashPrice: o.retailCashPrice !== undefined ? o.retailCashPrice : fallbackRetailCashPrice,
        wholesaleCashPrice: o.wholesaleCashPrice !== undefined ? o.wholesaleCashPrice : fallbackWholesaleCashPrice,
        sku: o.sku,
        outOfStockBadge: o.outOfStockBadge,
        customBadgeText: o.customBadgeText,
      }));
    }
  } else if (variantTypes.length >= 2) {
    const type1 = variantTypes[0];
    const type2 = variantTypes[1];

    if (type1 && type1.options) {
      colors = type1.options.map((o) => o.name).filter(Boolean);
    }
    if (type2 && type2.options) {
      sizeVariants = type2.options.map((o) => ({
        id: o.id,
        name: o.name,
        images: o.images || [],
        stock: o.stock !== undefined ? o.stock : undefined,
        unitsPerSet: o.unitsPerSet !== undefined ? o.unitsPerSet : undefined,
        wholesalePrice: o.wholesalePrice !== undefined ? o.wholesalePrice : fallbackWholesalePrice,
        retailPrice: o.retailPrice !== undefined ? o.retailPrice : fallbackRetailPrice,
        cashPrice: o.cashPrice !== undefined ? o.cashPrice : fallbackCashPrice,
        retailCashPrice: o.retailCashPrice !== undefined ? o.retailCashPrice : fallbackRetailCashPrice,
        wholesaleCashPrice: o.wholesaleCashPrice !== undefined ? o.wholesaleCashPrice : fallbackWholesaleCashPrice,
        sku: o.sku,
        outOfStockBadge: o.outOfStockBadge,
        customBadgeText: o.customBadgeText,
      }));
    }
  }

  // Create sizeVariantsWithMeta containing full variant metadata to survive schema limitations
  const metaItem = {
    id: META_VARIANT_TYPES_KEY,
    name: META_VARIANT_TYPES_KEY,
    images: [],
    wholesalePrice: fallbackWholesalePrice,
    retailPrice: fallbackRetailPrice,
    cashPrice: fallbackCashPrice,
    retailCashPrice: fallbackRetailCashPrice,
    wholesaleCashPrice: fallbackWholesaleCashPrice,
    sku: serializedVariantTypesMeta,
    __isVariantTypesMeta: true,
    variantTypes: variantTypes,
  };

  const sizeVariantsWithMeta = [...sizeVariants, metaItem];

  return {
    colors,
    sizeVariants,
    sizeVariantsWithMeta,
    serializedVariantTypesMeta,
  };
}

/**
 * Checks if a variant type manages independent stock across any of its options.
 */
export function isVariantTypeControllingStock(
  product: Partial<Product> | null | undefined,
  vtIdOrName: string
): boolean {
  if (!product) return false;
  const variantTypes = normalizeVariantTypes(product);
  const vt = variantTypes.find(
    (t) =>
      t.id.toLowerCase() === vtIdOrName.toLowerCase() ||
      t.name.toLowerCase() === vtIdOrName.toLowerCase()
  );
  if (!vt) return false;
  return vt.options.some(
    (opt) => opt.stock !== undefined && opt.stock !== null && !isNaN(Number(opt.stock))
  );
}

/**
 * Returns all variant types that have at least one option with an explicit independent stock defined.
 */
export function getStockControllingVariantTypes(
  product: Partial<Product> | null | undefined
): VariantType[] {
  if (!product) return [];
  const variantTypes = normalizeVariantTypes(product);
  return variantTypes.filter((vt) =>
    vt.options.some(
      (opt) => opt.stock !== undefined && opt.stock !== null && !isNaN(Number(opt.stock))
    )
  );
}

/**
 * Returns the effective stock of a specific variant option.
 * 
 * Rules:
 * 1. If this option has its own explicit numeric stock, returns that value.
 * 2. If this option does NOT have explicit stock (it does not manage independent inventory):
 *    - If other variant type(s) control inventory (e.g. "Tamaño" has 20 units and "Color" doesn't manage stock),
 *      this option shares the available stock of the controlling variant.
 *    - If no variant type controls stock, shares the general product.stock.
 */
export function getOptionStock(
  product: Partial<Product> | null | undefined,
  option: VariantOption,
  variantTypeIdOrName?: string
): number {
  if (option.stock !== undefined && option.stock !== null && !isNaN(Number(option.stock))) {
    return Math.max(0, Number(option.stock));
  }

  if (!product) return 0;

  const controllingTypes = getStockControllingVariantTypes(product);
  if (controllingTypes.length > 0) {
    // This option belongs to a non-controlling variant (or an option without specific stock).
    // It shares the inventory with the controlling variant type.
    const primaryControlling = controllingTypes[0];
    const totalControllingStock = primaryControlling.options.reduce((sum, o) => {
      if (o.stock !== undefined && o.stock !== null && !isNaN(Number(o.stock))) {
        return sum + Math.max(0, Number(o.stock));
      }
      return sum;
    }, 0);

    if (totalControllingStock > 0) {
      return totalControllingStock;
    }
  }

  // Fallback to base product general stock
  if (product.stock !== undefined && product.stock !== null && !isNaN(Number(product.stock))) {
    return Math.max(0, Number(product.stock));
  }

  return 0;
}

/**
 * Checks if a specific variant option is out of stock (stock <= 0).
 */
export function isOptionOutOfStock(
  product: Partial<Product> | null | undefined,
  option: VariantOption,
  variantTypeIdOrName?: string
): boolean {
  return getOptionStock(product, option, variantTypeIdOrName) <= 0;
}

/**
 * Returns the effective available stock for the currently selected combination of variants.
 * 
 * Rules:
 * - If only ONE variant controls the inventory (e.g., "Tamaño: 45 cm" has 20 units; Color and Chain Thickness have no stock):
 *   all combinations with "45 cm" share those 20 units.
 * - If multiple variants define independent stocks, takes the minimum of explicit stocks.
 * - If no variants define independent stocks, falls back to general product.stock.
 */
export function getSelectedVariantStock(
  product: Product | Partial<Product> | null | undefined,
  selectedOptionNames: Record<string, string> = {}
): number {
  if (!product) return 0;

  const variantTypes = normalizeVariantTypes(product);
  if (variantTypes.length === 0) {
    return Math.max(0, Number(product.stock ?? 0));
  }

  const controllingTypes = getStockControllingVariantTypes(product);

  if (controllingTypes.length > 0) {
    const matchedStocks: number[] = [];

    controllingTypes.forEach((vt) => {
      const selectedName =
        selectedOptionNames[vt.id] ||
        selectedOptionNames[vt.name] ||
        Object.entries(selectedOptionNames).find(
          ([k]) => k.toLowerCase() === vt.id.toLowerCase() || k.toLowerCase() === vt.name.toLowerCase()
        )?.[1];

      if (selectedName) {
        const opt = vt.options.find(
          (o) =>
            o.name.toLowerCase() === selectedName.toLowerCase() ||
            o.id.toLowerCase() === selectedName.toLowerCase()
        );
        if (opt && opt.stock !== undefined && opt.stock !== null && !isNaN(Number(opt.stock))) {
          matchedStocks.push(Math.max(0, Number(opt.stock)));
        }
      } else {
        // If no option explicitly selected for this controlling variant, take first in-stock or first option
        const firstOpt = vt.options.find((o) => (o.stock ?? 0) > 0) || vt.options[0];
        if (firstOpt && firstOpt.stock !== undefined && firstOpt.stock !== null) {
          matchedStocks.push(Math.max(0, Number(firstOpt.stock)));
        }
      }
    });

    if (matchedStocks.length > 0) {
      return Math.min(...matchedStocks);
    }
  }

  // Check legacy sizeVariants if applicable
  if (product.sizeVariants && product.sizeVariants.length > 0) {
    const selectedSizeName =
      selectedOptionNames['vt-size'] ||
      selectedOptionNames['Tamaño / Medida'] ||
      selectedOptionNames['size'];
    if (selectedSizeName) {
      const matchedSv = product.sizeVariants.find(
        (sv) =>
          sv.name.toLowerCase() === selectedSizeName.toLowerCase() ||
          sv.id.toLowerCase() === selectedSizeName.toLowerCase()
      );
      if (matchedSv && matchedSv.stock !== undefined && matchedSv.stock !== null && !isNaN(Number(matchedSv.stock))) {
        return Math.max(0, Number(matchedSv.stock));
      }
    }
  }

  // If no variant options defined a specific stock, return product general stock
  return Math.max(0, Number(product.stock ?? 0));
}

/**
 * Resolves the visual badge to display over the product image when the actively selected variant is out of stock.
 * Supports per-variant settings:
 * - "Sin stock" (red #dc2626)
 * - "Próximamente" (amber #d97706)
 * - "Disponible 25/10" / Custom arrival date (indigo/blue #2563eb)
 * Returns null if the selected variant is in stock.
 */
export function getActiveVariantOutOfStockBadge(
  product: Product | Partial<Product> | null | undefined,
  selectedOptionNames: Record<string, string> = {}
): { label: string; color: string; badgeType: 'sin_stock' | 'proximamente' | 'custom_date' } | null {
  if (!product) return null;

  const currentStock = getSelectedVariantStock(product, selectedOptionNames);
  if (currentStock > 0) {
    return null; // In stock: no out-of-stock badge
  }

  // Find the controlling or selected variant options
  const variantTypes = normalizeVariantTypes(product);
  for (const vt of variantTypes) {
    const selectedName =
      selectedOptionNames[vt.id] ||
      selectedOptionNames[vt.name] ||
      Object.entries(selectedOptionNames).find(
        ([k]) => k.toLowerCase() === vt.id.toLowerCase() || k.toLowerCase() === vt.name.toLowerCase()
      )?.[1];

    if (selectedName) {
      const opt = vt.options.find(
        (o) =>
          o.name.toLowerCase() === selectedName.toLowerCase() ||
          o.id.toLowerCase() === selectedName.toLowerCase()
      );
      if (opt && isOptionOutOfStock(product, opt, vt.id)) {
        if (opt.outOfStockBadge === 'none') {
          return null;
        }
        if (opt.outOfStockBadge === 'proximamente') {
          return { label: 'Próximamente', color: '#000000', badgeType: 'proximamente' };
        }
        if (opt.outOfStockBadge === 'custom_date' && opt.customBadgeText && opt.customBadgeText.trim()) {
          return { label: opt.customBadgeText.trim(), color: '#000000', badgeType: 'custom_date' };
        }
        return { label: 'Sin stock', color: '#000000', badgeType: 'sin_stock' };
      }
    }
  }

  // Legacy sizeVariants check
  if (product.sizeVariants && product.sizeVariants.length > 0) {
    const selectedSizeName =
      selectedOptionNames['vt-size'] ||
      selectedOptionNames['Tamaño / Medida'] ||
      selectedOptionNames['size'];
    if (selectedSizeName) {
      const sv = product.sizeVariants.find(
        (s) =>
          s.name.toLowerCase() === selectedSizeName.toLowerCase() ||
          s.id.toLowerCase() === selectedSizeName.toLowerCase()
      );
      if (sv && (sv.stock === undefined || sv.stock <= 0)) {
        if (sv.outOfStockBadge === 'none') {
          return null;
        }
        if (sv.outOfStockBadge === 'proximamente') {
          return { label: 'Próximamente', color: '#000000', badgeType: 'proximamente' };
        }
        if (sv.outOfStockBadge === 'custom_date' && sv.customBadgeText && sv.customBadgeText.trim()) {
          return { label: sv.customBadgeText.trim(), color: '#000000', badgeType: 'custom_date' };
        }
        return { label: 'Sin stock', color: '#000000', badgeType: 'sin_stock' };
      }
    }
  }

  // Default out of stock badge
  return { label: 'Sin stock', color: '#000000', badgeType: 'sin_stock' };
}

/**
 * Checks if a publication/product has available stock:
 * - If product has variants: returns true if AT LEAST ONE variant option has stock > 0, or product.stock > 0.
 * - If product has no variants: returns true if product.stock > 0.
 */
export function isProductInStock(product: Partial<Product> | null | undefined): boolean {
  if (!product) return false;
  return getProductTotalStock(product as Product) > 0;
}

/**
 * Checks if a publication/product is completely out of stock.
 */
export function isProductCompletelyOutOfStock(product: Partial<Product> | null | undefined): boolean {
  return !isProductInStock(product);
}

/**
 * Calculates the total aggregate stock of a product.
 * - If product has stock-controlling variants: sums individual stocks of the primary stock-controlling variant type.
 * - If product has no stock-controlling variants: returns the general product stock.
 */
export function getProductTotalStock(product: Product | null | undefined): number {
  if (!product) return 0;

  const variantTypes = normalizeVariantTypes(product);
  if (variantTypes.length === 0) {
    return Math.max(0, Number(product.stock ?? 0));
  }

  const controllingTypes = getStockControllingVariantTypes(product);
  if (controllingTypes.length > 0) {
    const primaryControlling = controllingTypes[0];
    return primaryControlling.options.reduce((acc, o) => {
      if (o.stock !== undefined && o.stock !== null && !isNaN(Number(o.stock))) {
        return acc + Math.max(0, Number(o.stock));
      }
      return acc;
    }, 0);
  }

  return Math.max(0, Number(product.stock ?? 0));
}

/**
 * Deducts stock from a product when an order is completed.
 * 
 * Logic:
 * - Only variant options with explicit, independent stock defined will have their stock deducted.
 * - Non-stock-controlling variants (options without independent stock) do NOT manage independent counts.
 * - If no variant has independent stock, deducts from general product.stock.
 */
export function deductStockFromProduct(
  product: Product,
  quantity: number,
  selectedVariants: Record<string, string> = {},
  selectedSizeVariant?: SizeVariant
): Product {
  const cloned = JSON.parse(JSON.stringify(product)) as Product;
  const variantTypes = normalizeVariantTypes(cloned);
  const controllingTypes = getStockControllingVariantTypes(cloned);

  let variantStockDeducted = false;

  if (controllingTypes.length > 0) {
    // Only deduct stock from variant types that have independent stock defined!
    controllingTypes.forEach((vt) => {
      const selectedName =
        selectedVariants[vt.id] ||
        selectedVariants[vt.name] ||
        Object.entries(selectedVariants).find(
          ([k]) => k.toLowerCase() === vt.id.toLowerCase() || k.toLowerCase() === vt.name.toLowerCase()
        )?.[1];

      if (selectedName) {
        const opt = vt.options.find(
          (o) =>
            o.name.toLowerCase() === selectedName.toLowerCase() ||
            o.id.toLowerCase() === selectedName.toLowerCase()
        );
        if (opt && opt.stock !== undefined && opt.stock !== null && !isNaN(Number(opt.stock))) {
          opt.stock = Math.max(0, Number(opt.stock) - quantity);
          variantStockDeducted = true;
        }
      }
    });

    cloned.variantTypes = variantTypes;

    // Sync legacy sizeVariants if applicable
    if (cloned.sizeVariants && cloned.sizeVariants.length > 0) {
      const selectedSizeName =
        selectedVariants['vt-size'] ||
        selectedVariants['Tamaño / Medida'] ||
        selectedVariants['size'] ||
        selectedSizeVariant?.name;

      if (selectedSizeName) {
        const sv = cloned.sizeVariants.find(
          (s) =>
            s.name.toLowerCase() === selectedSizeName.toLowerCase() ||
            s.id.toLowerCase() === selectedSizeName.toLowerCase()
        );
        if (sv && sv.stock !== undefined && sv.stock !== null && !isNaN(Number(sv.stock))) {
          sv.stock = Math.max(0, Number(sv.stock) - quantity);
        }
      }
    }

    // Update aggregate product stock
    cloned.stock = getProductTotalStock(cloned);
  }

  // If no variant had independent stock, deduct from base product stock
  if (!variantStockDeducted) {
    const currentBaseStock = Math.max(0, Number(cloned.stock ?? 0));
    cloned.stock = Math.max(0, currentBaseStock - quantity);
  }

  // Update sold count
  cloned.soldCount = (cloned.soldCount || 0) + quantity;

  return cloned;
}

/**
 * Finds the first available in-stock options for a product to avoid defaulting to an out-of-stock variant.
 */
export function getFirstInStockVariantOptions(product: Product): Record<string, string> {
  const initial: Record<string, string> = {};
  const variantTypes = normalizeVariantTypes(product);

  variantTypes.forEach((vt) => {
    // Find first option that has stock > 0
    const inStockOpt = vt.options.find((o) => getOptionStock(product, o) > 0);
    const chosen = inStockOpt || vt.options[0];
    if (chosen) {
      initial[vt.id] = chosen.name;
      initial[vt.name] = chosen.name;
    }
  });

  return initial;
}

/**
 * Obtiene la imagen de portada de una publicación.
 * Regla: La portada proviene ÚNICAMENTE de la primera imagen de la primera variante con foto (sin duplicarla).
 * Si ninguna variante tiene foto o el producto no tiene variantes, retorna la primera imagen de base o placeholder.
 */
export function getProductCoverImage(product: Partial<Product> | any): string {
  if (!product) {
    return 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800';
  }

  // 1. Priorizar Foto 1 / Portada de la publicación (imágenes del producto)
  if (Array.isArray(product.images) && product.images.length > 0) {
    const firstImg = product.images.find(
      (img: any) => typeof img === 'string' && img.trim().length > 0
    );
    if (firstImg) return firstImg;
  }

  if (typeof product.image === 'string' && product.image.trim().length > 0) {
    return product.image;
  }

  // 2. Si no hay imágenes en la galería base, buscar en las variantes con foto
  const variantTypes = normalizeVariantTypes(product);
  for (const vt of variantTypes) {
    if (vt && Array.isArray(vt.options)) {
      for (const opt of vt.options) {
        if (opt && Array.isArray(opt.images)) {
          const firstValid = opt.images.find(
            (img: any) => typeof img === 'string' && img.trim().length > 0
          );
          if (firstValid) {
            return firstValid;
          }
        }
      }
    }
  }

  return 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800';
}

/**
 * Computes the active gallery of images for a product given the user's variant selections.
 * 
 * Rules:
 * 1. Cada variante que tiene fotos propias muestra exclusivamente sus fotos.
 * 2. Si la variante seleccionada no tiene fotos propias específicas o el producto no tiene variantes,
 *    se exhibe la galería completa de la publicación (hasta 6 fotos del producto).
 * 3. Fallback a portada o placeholder en caso de publicación sin fotos.
 */
export function getActiveVariantImages(
  product: Product,
  selectedOptionNames: Record<string, string>, // { [variantTypeId or variantTypeName]: selectedOptionName }
  preferredVariantTypeId?: string
): string[] {
  if (!product) {
    return ['https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800'];
  }

  const defaultPlaceholder = 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800';
  const variantTypes = normalizeVariantTypes(product);
  let variantCustomImages: string[] = [];

  // 1. Buscar fotos específicas de la opción de variante actualmente seleccionada
  if (preferredVariantTypeId) {
    const preferredVt = variantTypes.find(
      (vt) =>
        vt.id === preferredVariantTypeId ||
        vt.name.toLowerCase() === preferredVariantTypeId.toLowerCase()
    );
    if (preferredVt) {
      const selectedName = selectedOptionNames[preferredVt.id] || selectedOptionNames[preferredVt.name];
      if (selectedName) {
        const option = preferredVt.options.find(
          (o) => o.name.toLowerCase() === selectedName.toLowerCase() || o.id === selectedName
        );
        if (option && option.images && option.images.length > 0) {
          variantCustomImages = option.images.filter(
            (img) => img && typeof img === 'string' && img.trim().length > 0
          );
        }
      }
    }
  }

  // Si no se encontraron por preferred, recorrer los tipos de variante
  if (variantCustomImages.length === 0) {
    for (const vt of variantTypes) {
      const selectedName = selectedOptionNames[vt.id] || selectedOptionNames[vt.name];
      if (selectedName) {
        const option = vt.options.find(
          (o) => o.name.toLowerCase() === selectedName.toLowerCase() || o.id === selectedName
        );
        if (option && option.images && option.images.length > 0) {
          const validImages = option.images.filter(
            (img) => img && typeof img === 'string' && img.trim().length > 0
          );
          if (validImages.length > 0) {
            variantCustomImages = validImages;
            break;
          }
        }
      }
    }
  }

  // Compatibilidad con sizeVariants legacy
  if (variantCustomImages.length === 0 && product.sizeVariants && product.sizeVariants.length > 0) {
    const selectedSizeName =
      selectedOptionNames['vt-size'] ||
      selectedOptionNames['Tamaño / Medida'] ||
      selectedOptionNames['size'];
    if (selectedSizeName) {
      const matchedSv = product.sizeVariants.find(
        (sv) => sv.name.toLowerCase() === selectedSizeName.toLowerCase() || sv.id === selectedSizeName
      );
      if (matchedSv && matchedSv.images && matchedSv.images.length > 0) {
        variantCustomImages = matchedSv.images.filter(
          (img) => img && typeof img === 'string' && img.trim().length > 0
        );
      }
    }
  }

  // Si la variante tiene fotos personalizadas, mostrarlas
  if (variantCustomImages.length > 0) {
    return variantCustomImages;
  }

  // Si la variante no tiene fotos específicas, o el producto no tiene variantes:
  // Exhibir la galería completa de la publicación (hasta 6 imágenes del producto)
  if (Array.isArray(product.images) && product.images.length > 0) {
    const validBaseImages = product.images.filter(
      (img) => img && typeof img === 'string' && img.trim().length > 0
    );
    if (validBaseImages.length > 0) {
      return validBaseImages;
    }
  }

  // Fallback a portada o placeholder
  const cover = getProductCoverImage(product);
  return cover ? [cover] : [defaultPlaceholder];
}

/**
 * Obtiene la imagen principal de referencia obligatoria para una variante.
 * 
 * Reglas mandatorias:
 * 1. Corresponde SIEMPRE a la primera posición (posición 0) de la variante seleccionada,
 *    según el orden de imágenes establecido en el editor.
 * 2. NUNCA utiliza la imagen que el cliente esté mirando en la galería en ese momento (imagen visualizada).
 * 3. Si el cliente cambia de variante, retorna la primera imagen de esa nueva variante.
 * 4. Si la variante no posee imágenes propias o el producto no tiene variantes, retorna la portada principal.
 */
export function getVariantPrimaryImage(
  product: Product | Partial<Product> | null | undefined,
  selectedOptionNames: Record<string, string> = {},
  preferredVariantTypeId?: string
): string {
  if (!product) {
    return 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800';
  }

  const variantImages = getActiveVariantImages(
    product as Product,
    selectedOptionNames,
    preferredVariantTypeId
  );

  if (Array.isArray(variantImages) && variantImages.length > 0 && variantImages[0]) {
    return variantImages[0];
  }

  return getProductCoverImage(product);
}

export interface ResolvedProductPrices {
  wholesalePrice: number;
  retailPrice: number;
  wholesaleCashPrice: number;
  retailCashPrice: number;
  cashPrice: number;
  hasCustomVariantPrice: boolean;
  priceControllingVariantName?: string;
  priceControllingOptionName?: string;
}

/**
 * Resolves the effective prices for a product according to its selected variant options:
 * - Rule 1: If product has NO variants with custom prices, returns the base product prices.
 * - Rule 2: If product has 1 variant type with prices, updates prices when changing that option.
 * - Rule 3: If product has 2 variant types but only 1 defines prices (e.g. Size has prices, Color has none),
 *   the price-defining variant controls price changes, while the other only changes the visual/option.
 * - Rule 4: If multiple variants define prices, prioritizes the active price-defining option.
 * - Rule 5: Fully resolves wholesale, retail, cash wholesale, and cash retail prices.
 */
export function getResolvedProductPrices(
  product: Product | Partial<Product> | null | undefined,
  selectedOptionNames: Record<string, string> = {},
  selectedSizeVariant?: SizeVariant
): ResolvedProductPrices {
  if (!product) {
    return {
      wholesalePrice: 0,
      retailPrice: 0,
      wholesaleCashPrice: 0,
      retailCashPrice: 0,
      cashPrice: 0,
      hasCustomVariantPrice: false,
    };
  }

  const checkPositiveNum = (val: any): number | null => {
    if (val !== undefined && val !== null && !isNaN(Number(val)) && Number(val) > 0) {
      return Number(val);
    }
    return null;
  };

  const rawProd = product as any;
  const rawBaseWholesale = checkPositiveNum(rawProd.wholesalePrice ?? rawProd.wholesale_price);
  const baseWholesale = rawBaseWholesale ?? 0;
  const rawBaseRetail = checkPositiveNum(rawProd.retailPrice ?? rawProd.retail_price);
  const baseRetail = rawBaseRetail ?? baseWholesale;

  const rawBaseWholesaleCash = checkPositiveNum(rawProd.wholesaleCashPrice ?? rawProd.wholesale_cash_price);
  const rawBaseRetailCash = checkPositiveNum(rawProd.retailCashPrice ?? rawProd.retail_cash_price);
  const rawBaseCash = checkPositiveNum(rawProd.cashPrice ?? rawProd.cash_price);

  // Compute resolved base wholesale cash
  let baseWholesaleCash = rawBaseWholesaleCash ?? rawBaseCash;
  if (!baseWholesaleCash && rawBaseRetailCash && baseRetail > 0 && rawBaseRetailCash < baseRetail) {
    baseWholesaleCash = Math.round(baseWholesale * (rawBaseRetailCash / baseRetail));
  }
  if (!baseWholesaleCash) {
    baseWholesaleCash = baseWholesale;
  }

  // Compute resolved base retail cash with proportional discount if only wholesale cash was configured
  let baseRetailCash = rawBaseRetailCash;
  if (!baseRetailCash && rawBaseWholesaleCash && baseWholesale > 0 && rawBaseWholesaleCash < baseWholesale) {
    baseRetailCash = Math.round(baseRetail * (rawBaseWholesaleCash / baseWholesale));
  } else if (!baseRetailCash && rawBaseCash && baseWholesale > 0 && rawBaseCash < baseWholesale) {
    baseRetailCash = Math.round(baseRetail * (rawBaseCash / baseWholesale));
  } else if (!baseRetailCash && rawBaseCash) {
    baseRetailCash = rawBaseCash;
  }
  if (!baseRetailCash) {
    baseRetailCash = baseRetail;
  }

  const baseCash = rawBaseCash ?? baseWholesaleCash;

  const variantTypes = normalizeVariantTypes(product);

  // Check which variant type(s) and selected options define custom prices
  let matchedOptionWithPrice: {
    option: VariantOption;
    variantType: VariantType;
  } | null = null;

  if (variantTypes.length > 0 && selectedOptionNames && Object.keys(selectedOptionNames).length > 0) {
    for (const vt of variantTypes) {
      let selectedName =
        selectedOptionNames[vt.id] ||
        selectedOptionNames[vt.name] ||
        Object.entries(selectedOptionNames).find(
          ([k]) => k.toLowerCase() === vt.id.toLowerCase() || k.toLowerCase() === vt.name.toLowerCase()
        )?.[1];

      // Fallback: Si no coincide por clave exacta, buscar si algún valor entrante coincide directamente con una opción de este tipo
      if (!selectedName) {
        const directMatch = Object.values(selectedOptionNames).find((val) => {
          const clean = String(val || '').toLowerCase().trim();
          return vt.options.some(
            (o) => o.name.toLowerCase() === clean || o.id.toLowerCase() === clean
          );
        });
        if (directMatch) {
          selectedName = String(directMatch);
        }
      }

      if (selectedName) {
        const option = vt.options.find(
          (o) =>
            o.name.toLowerCase() === selectedName!.toLowerCase() ||
            o.id.toLowerCase() === selectedName!.toLowerCase()
        );

        if (option) {
          const rawOpt = option as any;
          const hasWholesale = checkPositiveNum(rawOpt.wholesalePrice ?? rawOpt.wholesale_price) !== null;
          const hasRetail = checkPositiveNum(rawOpt.retailPrice ?? rawOpt.retail_price) !== null;
          const hasCash = checkPositiveNum(rawOpt.wholesaleCashPrice ?? rawOpt.wholesale_cash_price) !== null ||
                          checkPositiveNum(rawOpt.retailCashPrice ?? rawOpt.retail_cash_price) !== null ||
                          checkPositiveNum(rawOpt.cashPrice ?? rawOpt.cash_price) !== null;

          if (hasWholesale || hasRetail || hasCash) {
            matchedOptionWithPrice = { option, variantType: vt };
            break; // Found the controlling variant option with pricing
          }
        }
      }
    }
  }

  // If no variant option matched with custom prices, check legacy sizeVariant
  if (!matchedOptionWithPrice && selectedSizeVariant) {
    const rawSv = selectedSizeVariant as any;
    const hasWholesale = checkPositiveNum(rawSv.wholesalePrice ?? rawSv.wholesale_price) !== null;
    const hasRetail = checkPositiveNum(rawSv.retailPrice ?? rawSv.retail_price) !== null;
    const hasCash = checkPositiveNum(rawSv.wholesaleCashPrice ?? rawSv.wholesale_cash_price) !== null ||
                    checkPositiveNum(rawSv.retailCashPrice ?? rawSv.retail_cash_price) !== null ||
                    checkPositiveNum(rawSv.cashPrice ?? rawSv.cash_price) !== null;

    if (hasWholesale || hasRetail || hasCash) {
      const svWholesalePrice = checkPositiveNum(rawSv.wholesalePrice ?? rawSv.wholesale_price);
      const wholesalePrice = svWholesalePrice ?? baseWholesale;
      const retailPrice = checkPositiveNum(rawSv.retailPrice ?? rawSv.retail_price) ?? (svWholesalePrice ?? baseRetail);
      const wholesaleCashPrice =
        checkPositiveNum(rawSv.wholesaleCashPrice ?? rawSv.wholesale_cash_price) ??
        checkPositiveNum(rawSv.cashPrice ?? rawSv.cash_price) ??
        (svWholesalePrice && svWholesalePrice !== baseWholesale
          ? (baseWholesale > 0 && baseWholesaleCash < baseWholesale
              ? Math.round(svWholesalePrice * (baseWholesaleCash / baseWholesale))
              : wholesalePrice)
          : baseWholesaleCash);
      const retailCashPrice =
        checkPositiveNum(rawSv.retailCashPrice ?? rawSv.retail_cash_price) ??
        checkPositiveNum(rawSv.cashPrice ?? rawSv.cash_price) ??
        (rawSv.retailPrice && checkPositiveNum(rawSv.retailPrice ?? rawSv.retail_price) !== baseRetail
          ? (baseRetail > 0 && baseRetailCash < baseRetail
              ? Math.round(checkPositiveNum(rawSv.retailPrice ?? rawSv.retail_price)! * (baseRetailCash / baseRetail))
              : retailPrice)
          : (retailPrice !== baseRetail && baseRetail > 0 && baseRetailCash < baseRetail
              ? Math.round(retailPrice * (baseRetailCash / baseRetail))
              : baseRetailCash));
      const cashPrice = checkPositiveNum(rawSv.cashPrice ?? rawSv.cash_price) ?? wholesaleCashPrice;

      return {
        wholesalePrice,
        retailPrice,
        wholesaleCashPrice,
        retailCashPrice,
        cashPrice,
        hasCustomVariantPrice: true,
        priceControllingVariantName: 'Tamaño / Medida',
        priceControllingOptionName: selectedSizeVariant.name,
      };
    }
  }

  // If matched variant option with price was found
  if (matchedOptionWithPrice) {
    const opt = matchedOptionWithPrice.option;
    const rawOpt = opt as any;
    const optWholesalePrice = checkPositiveNum(rawOpt.wholesalePrice ?? rawOpt.wholesale_price);
    const optRetailPrice = checkPositiveNum(rawOpt.retailPrice ?? rawOpt.retail_price);
    const wholesalePrice = optWholesalePrice ?? baseWholesale;
    const retailPrice = optRetailPrice ?? (optWholesalePrice ?? baseRetail);
    const wholesaleCashPrice =
      checkPositiveNum(rawOpt.wholesaleCashPrice ?? rawOpt.wholesale_cash_price) ??
      checkPositiveNum(rawOpt.cashPrice ?? rawOpt.cash_price) ??
      (optWholesalePrice && optWholesalePrice !== baseWholesale
        ? (baseWholesale > 0 && baseWholesaleCash < baseWholesale
            ? Math.round(optWholesalePrice * (baseWholesaleCash / baseWholesale))
            : wholesalePrice)
        : baseWholesaleCash);
    const retailCashPrice =
      checkPositiveNum(rawOpt.retailCashPrice ?? rawOpt.retail_cash_price) ??
      checkPositiveNum(rawOpt.cashPrice ?? rawOpt.cash_price) ??
      (optRetailPrice && optRetailPrice !== baseRetail
        ? (baseRetail > 0 && baseRetailCash < baseRetail
            ? Math.round(optRetailPrice * (baseRetailCash / baseRetail))
            : retailPrice)
        : (retailPrice !== baseRetail && baseRetail > 0 && baseRetailCash < baseRetail
            ? Math.round(retailPrice * (baseRetailCash / baseRetail))
            : baseRetailCash));
    const cashPrice = checkPositiveNum(rawOpt.cashPrice ?? rawOpt.cash_price) ?? wholesaleCashPrice;

    return {
      wholesalePrice,
      retailPrice,
      wholesaleCashPrice,
      retailCashPrice,
      cashPrice,
      hasCustomVariantPrice: true,
      priceControllingVariantName: matchedOptionWithPrice.variantType.name,
      priceControllingOptionName: opt.name,
    };
  }

  // Default: Return base product prices
  return {
    wholesalePrice: baseWholesale,
    retailPrice: baseRetail,
    wholesaleCashPrice: baseWholesaleCash,
    retailCashPrice: baseRetailCash,
    cashPrice: baseCash,
    hasCustomVariantPrice: false,
  };
}

/**
 * Calculates the effective normal price (wholesale or retail) for a product or item.
 * - Accurately resolves price based on selected variant options and wholesale/retail tier.
 */
export function getItemEffectiveNormalPrice(
  product: Product | null | undefined,
  selectedVariants?: Record<string, string>,
  selectedSizeVariant?: SizeVariant,
  isWholesale: boolean = true
): number {
  if (!product) return 0;
  const resolved = getResolvedProductPrices(product, selectedVariants, selectedSizeVariant);
  return isWholesale ? resolved.wholesalePrice : resolved.retailPrice;
}

/**
 * Calculates the effective cash price for a product or item according to wholesale / retail tier.
 * - Accurately resolves cash price based on selected variant options and wholesale/retail tier.
 */
export function getItemEffectiveCashPrice(
  product: Product | null | undefined,
  selectedVariants?: Record<string, string>,
  selectedSizeVariant?: SizeVariant,
  fallbackPrice?: number,
  isWholesale: boolean = true
): number {
  if (!product) return fallbackPrice || 0;
  const resolved = getResolvedProductPrices(product, selectedVariants, selectedSizeVariant);
  const cashPrice = isWholesale ? resolved.wholesaleCashPrice : resolved.retailCashPrice;
  if (cashPrice > 0) return cashPrice;
  return fallbackPrice !== undefined && fallbackPrice > 0 ? fallbackPrice : (isWholesale ? resolved.wholesalePrice : resolved.retailPrice);
}

// ============================================================================
// PRECIOS ESCALONADOS & VENTA POR SET — MOTOR CANÓNICO DE CÁLCULO
// ============================================================================

/**
 * Normaliza y ordena ascendentemente por minQty los escalones válidos de una publicación.
 */
export function getNormalizedPriceTiers(product: Product | Partial<Product> | null | undefined): PriceTier[] {
  if (!product || !Array.isArray(product.priceTiers)) return [];
  const valid = product.priceTiers
    .filter((t) => t && Number(t.minQty) >= 1)
    .map((t, idx) => ({
      id: t.id || `tier-${idx + 1}`,
      minQty: Math.max(1, Math.floor(Number(t.minQty))),
      wholesalePrice: Math.max(0, Number(t.wholesalePrice) || 0),
      retailPrice: Math.max(0, Number(t.retailPrice) || 0),
      wholesaleCashPrice: Math.max(0, Number(t.wholesaleCashPrice) || 0),
      retailCashPrice: Math.max(0, Number(t.retailCashPrice) || 0),
    }))
    .filter((t) => t.wholesalePrice > 0 || t.retailPrice > 0 || t.wholesaleCashPrice > 0 || t.retailCashPrice > 0);

  // Deduplicate by minQty keeping the last configured entry and sort ascending
  const byQty = new Map<number, PriceTier>();
  valid.forEach((t) => byQty.set(t.minQty, t));
  return Array.from(byQty.values()).sort((a, b) => a.minQty - b.minQty);
}

/**
 * Indica si la modalidad de precios escalonados está activa y tiene al menos 1 escalón válido.
 */
export function isTieredPricingActive(product: Product | Partial<Product> | null | undefined): boolean {
  if (!product || product.pricingMode !== 'tiered') return false;
  return getNormalizedPriceTiers(product).length > 0;
}

/**
 * Indica si la modalidad de venta por set o combo obligatorio está activa.
 */
export function isSetSaleActive(product: Product | Partial<Product> | null | undefined): boolean {
  if (!product) return false;
  return product.pricingMode === 'set';
}

/**
 * Devuelve la modalidad efectiva de precios de una publicación ('normal' | 'tiered' | 'set').
 */
export function getEffectivePricingMode(product: Product | Partial<Product> | null | undefined): ProductPricingMode {
  if (isSetSaleActive(product)) return 'set';
  if (isTieredPricingActive(product)) return 'tiered';
  return 'normal';
}

/**
 * Resuelve la cantidad de unidades incluidas por set para la variante seleccionada.
 * Prioriza la opción seleccionada con `unitsPerSet`, luego `selectedSizeVariant`, luego `defaultSetUnits`, y por defecto 1.
 */
export function getSelectedVariantSetUnits(
  product: Product | Partial<Product> | null | undefined,
  selectedOptionNames: Record<string, string> = {},
  selectedSizeVariant?: SizeVariant
): number {
  if (!product) return 1;

  const parseValidUnits = (val: any): number | null => {
    if (val !== undefined && val !== null && !isNaN(Number(val)) && Number(val) >= 1) {
      return Math.floor(Number(val));
    }
    return null;
  };

  const variantTypes = normalizeVariantTypes(product);
  if (variantTypes.length > 0 && selectedOptionNames && Object.keys(selectedOptionNames).length > 0) {
    for (const vt of variantTypes) {
      let selectedName =
        selectedOptionNames[vt.id] ||
        selectedOptionNames[vt.name] ||
        Object.entries(selectedOptionNames).find(
          ([k]) => k.toLowerCase() === vt.id.toLowerCase() || k.toLowerCase() === vt.name.toLowerCase()
        )?.[1];

      if (!selectedName) {
        const directMatch = Object.values(selectedOptionNames).find((val) => {
          const clean = String(val || '').toLowerCase().trim();
          return vt.options.some(
            (o) => o.name.toLowerCase() === clean || o.id.toLowerCase() === clean
          );
        });
        if (directMatch) selectedName = String(directMatch);
      }

      if (selectedName) {
        const option = vt.options.find(
          (o) =>
            o.name.toLowerCase() === selectedName!.toLowerCase() ||
            o.id.toLowerCase() === selectedName!.toLowerCase()
        );
        const optUnits = option ? parseValidUnits((option as any).unitsPerSet ?? (option as any).units_per_set) : null;
        if (optUnits !== null) return optUnits;
      }
    }
  }

  if (selectedSizeVariant) {
    const svUnits = parseValidUnits((selectedSizeVariant as any).unitsPerSet ?? (selectedSizeVariant as any).units_per_set);
    if (svUnits !== null) return svUnits;
  }

  const defaultUnits = parseValidUnits((product as any).defaultSetUnits ?? (product as any).default_set_units);
  if (defaultUnits !== null) return defaultUnits;

  // Fallback: si no se seleccionó variante aún, usar la primera opción con unitsPerSet definida
  for (const vt of variantTypes) {
    for (const opt of vt.options) {
      const u = parseValidUnits((opt as any).unitsPerSet ?? (opt as any).units_per_set);
      if (u !== null) return u;
    }
  }

  return 1;
}

/**
 * Calcula el precio unitario informativo para venta por set (precio total del set / unidades del set).
 */
export function getInformativeUnitPrice(setTotalPrice: number, unitsPerSet: number): number {
  const safeUnits = Math.max(1, Math.floor(Number(unitsPerSet) || 1));
  if (!setTotalPrice || setTotalPrice <= 0) return 0;
  return Math.round(setTotalPrice / safeUnits);
}

export interface TierProgressInfo {
  tiers: PriceTier[];
  activeTier: PriceTier | null;
  nextTier: PriceTier | null;
  activeTierIndex: number;
  missingForNext: number;
  progressPercent: number;
  isTopTierReached: boolean;
}

/**
 * Calcula el escalón actual alcanzado, el siguiente escalón y las unidades faltantes.
 */
export function getTierProgress(tiers: PriceTier[], publicationQty: number): TierProgressInfo {
  const safeQty = Math.max(0, Math.floor(Number(publicationQty) || 0));
  if (!tiers || tiers.length === 0) {
    return {
      tiers: [],
      activeTier: null,
      nextTier: null,
      activeTierIndex: -1,
      missingForNext: 0,
      progressPercent: 0,
      isTopTierReached: false,
    };
  }

  let activeTierIndex = -1;
  for (let i = 0; i < tiers.length; i++) {
    if (safeQty >= tiers[i].minQty) {
      activeTierIndex = i;
    } else {
      break;
    }
  }

  const activeTier = activeTierIndex >= 0 ? tiers[activeTierIndex] : null;
  const nextTier = activeTierIndex + 1 < tiers.length ? tiers[activeTierIndex + 1] : null;
  const missingForNext = nextTier ? Math.max(0, nextTier.minQty - safeQty) : 0;
  const isTopTierReached = activeTierIndex === tiers.length - 1 && tiers.length > 0;

  let progressPercent = 0;
  if (isTopTierReached) {
    progressPercent = 100;
  } else if (nextTier) {
    const prevThreshold = activeTier ? activeTier.minQty : 0;
    const span = Math.max(1, nextTier.minQty - prevThreshold);
    const segmentProgress = Math.min(1, Math.max(0, (safeQty - prevThreshold) / span));
    const totalSegments = tiers.length;
    const completedSegments = activeTierIndex + 1;
    progressPercent = Math.min(100, Math.round(((completedSegments + segmentProgress) / totalSegments) * 100));
  }

  return {
    tiers,
    activeTier,
    nextTier,
    activeTierIndex,
    missingForNext,
    progressPercent,
    isTopTierReached,
  };
}

/**
 * Resuelve los 4 precios efectivos de un producto considerando su variante y, si corresponde,
 * el escalón alcanzado por la cantidad acumulada de la misma publicación.
 */
export function resolveProductPricesForQuantity(
  product: Product | Partial<Product> | null | undefined,
  selectedOptionNames: Record<string, string> = {},
  selectedSizeVariant?: SizeVariant,
  publicationQty: number = 1
): ResolvedProductPrices & { activeTier: PriceTier | null } {
  const baseResolved = getResolvedProductPrices(product, selectedOptionNames, selectedSizeVariant);

  if (!isTieredPricingActive(product)) {
    return { ...baseResolved, activeTier: null };
  }

  const tiers = getNormalizedPriceTiers(product);
  const { activeTier } = getTierProgress(tiers, publicationQty);

  if (!activeTier) {
    return { ...baseResolved, activeTier: null };
  }

  const wholesalePrice = activeTier.wholesalePrice > 0 ? activeTier.wholesalePrice : baseResolved.wholesalePrice;
  const retailPrice =
    activeTier.retailPrice > 0
      ? activeTier.retailPrice
      : activeTier.wholesalePrice > 0
      ? activeTier.wholesalePrice
      : baseResolved.retailPrice;
  const wholesaleCashPrice =
    activeTier.wholesaleCashPrice > 0
      ? activeTier.wholesaleCashPrice
      : wholesalePrice;
  const retailCashPrice =
    activeTier.retailCashPrice > 0
      ? activeTier.retailCashPrice
      : retailPrice;

  return {
    ...baseResolved,
    wholesalePrice,
    retailPrice,
    wholesaleCashPrice,
    retailCashPrice,
    cashPrice: wholesaleCashPrice,
    activeTier,
  };
}

export interface CartQuantitiesIndex {
  categoryQuantities: Record<string, number>;
  publicationQuantities: Record<string, number>;
}

/**
 * Construye los acumuladores de cantidad del carrito:
 * - `categoryQuantities`: acumula únicamente publicaciones normales por categoría (para mínimo mayorista).
 * - `publicationQuantities`: acumula unidades por publicación (sumando todas sus variantes, sin mezclar publicaciones).
 */
export function buildCartQuantitiesIndex(
  items: Array<{ productId?: string; product?: Product; quantity: number }>
): CartQuantitiesIndex {
  const categoryQuantities: Record<string, number> = {};
  const publicationQuantities: Record<string, number> = {};

  (items || []).forEach((item) => {
    const qty = Math.max(0, Math.floor(Number(item.quantity) || 0));
    if (qty <= 0) return;

    const prod = item.product;
    const pid = item.productId || prod?.id;
    if (pid) {
      publicationQuantities[pid] = (publicationQuantities[pid] || 0) + qty;
    }

    if (prod && getEffectivePricingMode(prod) === 'normal') {
      const cat = prod.category || 'General';
      categoryQuantities[cat] = (categoryQuantities[cat] || 0) + qty;
    }
  });

  return { categoryQuantities, publicationQuantities };
}

export interface CalculatedCartItemPricing {
  pricingMode: ProductPricingMode;
  isSet: boolean;
  isTiered: boolean;
  isWholesale: boolean;
  minQty: number;
  categoryQty: number;
  publicationQty: number;
  unitsPerSet: number;
  totalUnitsIncluded: number;
  activeTier: PriceTier | null;
  nextTier: PriceTier | null;
  missingForNextTier: number;
  wholesaleUnitPrice: number;
  retailUnitPrice: number;
  wholesaleCashUnitPrice: number;
  retailCashUnitPrice: number;
  normalUnitPrice: number;
  cashUnitPrice: number;
  effectiveUnitPrice: number;
  informativeUnitPrice: number;
  informativeCashUnitPrice: number;
  informativeEffectiveUnitPrice: number;
  totalPrice: number;
  cashTotalPrice: number;
  effectiveTotalPrice: number;
  savings: number;
  cashSavings: number;
}

/**
 * Motor único de precios para una línea del carrito, compra rápida, checkout y validación de pedidos.
 */
export function calculateCartItemPricing(
  item: {
    productId?: string;
    product: Product;
    selectedVariants?: Record<string, string>;
    selectedSizeVariant?: SizeVariant;
    quantity: number;
  },
  allItemsOrIndex: Array<{ productId?: string; product?: Product; quantity: number }> | CartQuantitiesIndex,
  options?: { isCashMode?: boolean; forceWholesalePreview?: boolean }
): CalculatedCartItemPricing {
  const isCashMode = options?.isCashMode === true;
  const forceWholesalePreview = options?.forceWholesalePreview === true;
  const product = item.product;
  const qty = Math.max(0, Math.floor(Number(item.quantity) || 0));

  const index: CartQuantitiesIndex = Array.isArray(allItemsOrIndex)
    ? buildCartQuantitiesIndex(allItemsOrIndex)
    : allItemsOrIndex;

  const pid = item.productId || product.id;
  const cat = product.category || 'General';
  const pricingMode = getEffectivePricingMode(product);
  const isSet = pricingMode === 'set';
  const isTiered = pricingMode === 'tiered';

  const publicationQty = index.publicationQuantities[pid] || qty;
  const categoryQty = index.categoryQuantities[cat] || 0;
  const minQty = isSet ? 1 : (product.minWholesaleQty || 1);

  const unitsPerSet = isSet
    ? getSelectedVariantSetUnits(product, item.selectedVariants, item.selectedSizeVariant)
    : 1;
  const totalUnitsIncluded = qty * unitsPerSet;

  // Base prices (without tier) for retail comparison / savings calculation
  const baseResolved = getResolvedProductPrices(product, item.selectedVariants, item.selectedSizeVariant);

  let resolved = baseResolved;
  let activeTier: PriceTier | null = null;
  let nextTier: PriceTier | null = null;
  let missingForNextTier = 0;

  if (isTiered) {
    const tiers = getNormalizedPriceTiers(product);
    const tierProgress = getTierProgress(tiers, publicationQty);
    activeTier = tierProgress.activeTier;
    nextTier = tierProgress.nextTier;
    missingForNextTier = tierProgress.missingForNext;
    const tieredResolved = resolveProductPricesForQuantity(
      product,
      item.selectedVariants,
      item.selectedSizeVariant,
      publicationQty
    );
    resolved = tieredResolved;
  }

  // Wholesale eligibility rules:
  // 1. Set sale: ALWAYS wholesale from 1 complete set (ignores minWholesaleQty).
  // 2. Tiered pricing: evaluates publicationQty against product.minWholesaleQty (never accumulates across publications).
  // 3. Normal product: evaluates categoryQty against product.minWholesaleQty (unchanged legacy behavior).
  const isWholesale = forceWholesalePreview
    ? true
    : isSet
    ? qty >= 1
    : isTiered
    ? publicationQty >= minQty
    : categoryQty >= minQty;

  const wholesaleUnitPrice = resolved.wholesalePrice;
  const retailUnitPrice = resolved.retailPrice;
  const wholesaleCashUnitPrice = resolved.wholesaleCashPrice > 0 ? resolved.wholesaleCashPrice : wholesaleUnitPrice;
  const retailCashUnitPrice = resolved.retailCashPrice > 0 ? resolved.retailCashPrice : retailUnitPrice;

  const normalUnitPrice = isWholesale ? wholesaleUnitPrice : retailUnitPrice;
  const cashUnitPrice = isWholesale ? wholesaleCashUnitPrice : retailCashUnitPrice;
  const effectiveUnitPrice = isCashMode ? cashUnitPrice : normalUnitPrice;

  const totalPrice = normalUnitPrice * qty;
  const cashTotalPrice = cashUnitPrice * qty;
  const effectiveTotalPrice = effectiveUnitPrice * qty;

  // Wholesale / tiered savings vs base retail price
  const compareRetailNormal = Math.max(baseResolved.retailPrice, retailUnitPrice);
  const compareRetailCash = Math.max(
    baseResolved.retailCashPrice > 0 ? baseResolved.retailCashPrice : baseResolved.retailPrice,
    retailCashUnitPrice
  );
  const savings = (isWholesale || activeTier !== null) ? Math.max(0, (compareRetailNormal - normalUnitPrice) * qty) : 0;
  const cashSavings = (isWholesale || activeTier !== null) ? Math.max(0, (compareRetailCash - cashUnitPrice) * qty) : 0;

  const informativeUnitPrice = isSet ? getInformativeUnitPrice(normalUnitPrice, unitsPerSet) : normalUnitPrice;
  const informativeCashUnitPrice = isSet ? getInformativeUnitPrice(cashUnitPrice, unitsPerSet) : cashUnitPrice;
  const informativeEffectiveUnitPrice = isCashMode ? informativeCashUnitPrice : informativeUnitPrice;

  return {
    pricingMode,
    isSet,
    isTiered,
    isWholesale,
    minQty,
    categoryQty,
    publicationQty,
    unitsPerSet,
    totalUnitsIncluded,
    activeTier,
    nextTier,
    missingForNextTier,
    wholesaleUnitPrice,
    retailUnitPrice,
    wholesaleCashUnitPrice,
    retailCashUnitPrice,
    normalUnitPrice,
    cashUnitPrice,
    effectiveUnitPrice,
    informativeUnitPrice,
    informativeCashUnitPrice,
    informativeEffectiveUnitPrice,
    totalPrice,
    cashTotalPrice,
    effectiveTotalPrice,
    savings,
    cashSavings,
  };
}

/**
 * Calculates cart summary totals and wholesale savings consistently across the application.
 * Honors normal category-level wholesale thresholds, tiered per-publication pricing,
 * mandatory set sales (wholesale from 1 set), and active purchase mode (cash vs transfer).
 */
export function calculateCartSummary(cartItems: CartItem[] = [], isCashMode: boolean = false) {
  if (!cartItems || cartItems.length === 0) {
    return {
      totalQuantity: 0,
      subtotalProducts: 0,
      cashSubtotalProducts: 0,
      activeSubtotal: 0,
      totalSavings: 0,
    };
  }

  const quantitiesIndex = buildCartQuantitiesIndex(cartItems);

  let subtotalProducts = 0;
  let cashSubtotalProducts = 0;
  let totalSavings = 0;
  let totalQuantity = 0;

  cartItems.forEach((item) => {
    if (!item.product) return;
    const calc = calculateCartItemPricing(item, quantitiesIndex, { isCashMode });
    subtotalProducts += calc.totalPrice;
    cashSubtotalProducts += calc.cashTotalPrice;
    totalSavings += calc.savings;
    totalQuantity += item.quantity;
  });

  const activeSubtotal = isCashMode ? cashSubtotalProducts : subtotalProducts;

  return {
    totalQuantity,
    subtotalProducts,
    cashSubtotalProducts,
    activeSubtotal,
    totalSavings,
  };
}

/**
 * Returns the exact current active total of the cart.
 */
export function calculateCartTotal(cartItems: CartItem[] = [], isCashMode: boolean = false): number {
  return calculateCartSummary(cartItems, isCashMode).activeSubtotal;
}

