import { Product, ProductSpec, SizeVariant, VariantOption, VariantType } from '../types';

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
          wholesalePrice: opt.wholesalePrice !== undefined && opt.wholesalePrice !== null && !isNaN(Number(opt.wholesalePrice)) ? Number(opt.wholesalePrice) : undefined,
          retailPrice: opt.retailPrice !== undefined && opt.retailPrice !== null && !isNaN(Number(opt.retailPrice)) ? Number(opt.retailPrice) : undefined,
          cashPrice: opt.cashPrice !== undefined && opt.cashPrice !== null && !isNaN(Number(opt.cashPrice)) ? Number(opt.cashPrice) : undefined,
          retailCashPrice: opt.retailCashPrice !== undefined && opt.retailCashPrice !== null && !isNaN(Number(opt.retailCashPrice)) ? Number(opt.retailCashPrice) : undefined,
          wholesaleCashPrice: opt.wholesaleCashPrice !== undefined && opt.wholesaleCashPrice !== null && !isNaN(Number(opt.wholesaleCashPrice)) ? Number(opt.wholesaleCashPrice) : undefined,
          sku: opt.sku || undefined,
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
      options: cleanSizeVariants.map((sv: any, idx: number) => ({
        id: sv.id || `opt-size-${idx}`,
        name: sv.name || `Variante ${idx + 1}`,
        images: Array.isArray(sv.images) ? sv.images.filter(Boolean) : [],
        stock: sv.stock !== undefined && sv.stock !== null && !isNaN(Number(sv.stock)) ? Math.max(0, Number(sv.stock)) : undefined,
        wholesalePrice: sv.wholesalePrice !== undefined ? Number(sv.wholesalePrice) : undefined,
        retailPrice: sv.retailPrice !== undefined ? Number(sv.retailPrice) : undefined,
        cashPrice: sv.cashPrice !== undefined && sv.cashPrice !== null ? Number(sv.cashPrice) : undefined,
        retailCashPrice: sv.retailCashPrice !== undefined && sv.retailCashPrice !== null ? Number(sv.retailCashPrice) : undefined,
        wholesaleCashPrice: sv.wholesaleCashPrice !== undefined && sv.wholesaleCashPrice !== null ? Number(sv.wholesaleCashPrice) : undefined,
        sku: sv.sku || undefined,
      })),
    });
  }

  return result;
}

/**
 * Strips internal metadata items from sizeVariants so UI never displays them
 */
export function cleanSizeVariantsList(sizeVariants: SizeVariant[] | undefined | null): SizeVariant[] {
  if (!Array.isArray(sizeVariants)) return [];
  return sizeVariants.filter(
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
      return (
        keyOrLabel !== SPECS_VARIANT_TYPES_KEY &&
        keyOrLabel !== '__variant_types' &&
        keyOrLabel !== 'variantTypes' &&
        keyOrLabel !== '__cash_price' &&
        keyOrLabel !== 'cashPrice' &&
        keyOrLabel !== '__retail_cash_price' &&
        keyOrLabel !== 'retailCashPrice' &&
        keyOrLabel !== '__wholesale_cash_price' &&
        keyOrLabel !== 'wholesaleCashPrice'
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
        wholesalePrice: o.wholesalePrice !== undefined ? o.wholesalePrice : fallbackWholesalePrice,
        retailPrice: o.retailPrice !== undefined ? o.retailPrice : fallbackRetailPrice,
        cashPrice: o.cashPrice !== undefined ? o.cashPrice : fallbackCashPrice,
        retailCashPrice: o.retailCashPrice !== undefined ? o.retailCashPrice : fallbackRetailCashPrice,
        wholesaleCashPrice: o.wholesaleCashPrice !== undefined ? o.wholesaleCashPrice : fallbackWholesaleCashPrice,
        sku: o.sku,
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
        wholesalePrice: o.wholesalePrice !== undefined ? o.wholesalePrice : fallbackWholesalePrice,
        retailPrice: o.retailPrice !== undefined ? o.retailPrice : fallbackRetailPrice,
        cashPrice: o.cashPrice !== undefined ? o.cashPrice : fallbackCashPrice,
        retailCashPrice: o.retailCashPrice !== undefined ? o.retailCashPrice : fallbackRetailCashPrice,
        wholesaleCashPrice: o.wholesaleCashPrice !== undefined ? o.wholesaleCashPrice : fallbackWholesaleCashPrice,
        sku: o.sku,
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
        wholesalePrice: o.wholesalePrice !== undefined ? o.wholesalePrice : fallbackWholesalePrice,
        retailPrice: o.retailPrice !== undefined ? o.retailPrice : fallbackRetailPrice,
        cashPrice: o.cashPrice !== undefined ? o.cashPrice : fallbackCashPrice,
        retailCashPrice: o.retailCashPrice !== undefined ? o.retailCashPrice : fallbackRetailCashPrice,
        wholesaleCashPrice: o.wholesaleCashPrice !== undefined ? o.wholesaleCashPrice : fallbackWholesaleCashPrice,
        sku: o.sku,
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
 * Computes the active gallery of images for a product given the user's variant selections.
 * 
 * Rules:
 * 1. Shows the selected variant's image(s) first (as main showcase image).
 * 2. Retains all general/additional product images in the gallery, without hiding them.
 * 3. If the variant has only 1 image (or N images), merges them seamlessly with the base product images (deduplicating URLs).
 * 4. Fully compatible with products without variants (returns base product images).
 */
export function getActiveVariantImages(
  product: Product,
  selectedOptionNames: Record<string, string>, // { [variantTypeId or variantTypeName]: selectedOptionName }
  preferredVariantTypeId?: string
): string[] {
  if (!product) {
    return ['https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800'];
  }

  // 1. Gather all base product images
  const baseImages = Array.isArray(product.images)
    ? product.images.filter((img) => typeof img === 'string' && img.trim().length > 0)
    : [];

  const defaultPlaceholder = 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800';

  const variantTypes = normalizeVariantTypes(product);
  let variantCustomImages: string[] = [];

  // 2. Look for custom images from the selected variant options
  // Check preferred variant type first if user recently clicked/interacted with it
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

  // If no images found yet, check each variant type in order
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

  // Also check legacy sizeVariant images if applicable and still no images found
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

  // 3. Combine: Put variant custom images first, then append all remaining base product images
  if (variantCustomImages.length > 0) {
    const combined = [...variantCustomImages];
    for (const baseImg of baseImages) {
      if (!combined.includes(baseImg)) {
        combined.push(baseImg);
      }
    }
    return combined.length > 0 ? combined : [defaultPlaceholder];
  }

  // 4. Products without variants or variants without custom images -> return base images
  return baseImages.length > 0 ? baseImages : [defaultPlaceholder];
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

  const baseWholesale = checkPositiveNum(product.wholesalePrice) ?? 0;
  const baseRetail = checkPositiveNum(product.retailPrice) ?? baseWholesale;
  const baseWholesaleCash = checkPositiveNum(product.wholesaleCashPrice) ?? checkPositiveNum(product.cashPrice) ?? baseWholesale;
  const baseRetailCash = checkPositiveNum(product.retailCashPrice) ?? checkPositiveNum(product.cashPrice) ?? baseRetail;
  const baseCash = checkPositiveNum(product.cashPrice) ?? baseWholesaleCash;

  const variantTypes = normalizeVariantTypes(product);

  // Check which variant type(s) and selected options define custom prices
  let matchedOptionWithPrice: {
    option: VariantOption;
    variantType: VariantType;
  } | null = null;

  if (variantTypes.length > 0 && selectedOptionNames && Object.keys(selectedOptionNames).length > 0) {
    for (const vt of variantTypes) {
      const selectedName =
        selectedOptionNames[vt.id] ||
        selectedOptionNames[vt.name] ||
        Object.entries(selectedOptionNames).find(
          ([k]) => k.toLowerCase() === vt.id.toLowerCase() || k.toLowerCase() === vt.name.toLowerCase()
        )?.[1];

      if (selectedName) {
        const option = vt.options.find(
          (o) =>
            o.name.toLowerCase() === selectedName.toLowerCase() ||
            o.id.toLowerCase() === selectedName.toLowerCase()
        );

        if (option) {
          const hasWholesale = checkPositiveNum(option.wholesalePrice) !== null;
          const hasRetail = checkPositiveNum(option.retailPrice) !== null;
          const hasCash = checkPositiveNum(option.wholesaleCashPrice) !== null ||
                          checkPositiveNum(option.retailCashPrice) !== null ||
                          checkPositiveNum(option.cashPrice) !== null;

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
    const hasWholesale = checkPositiveNum(selectedSizeVariant.wholesalePrice) !== null;
    const hasRetail = checkPositiveNum(selectedSizeVariant.retailPrice) !== null;
    const hasCash = checkPositiveNum(selectedSizeVariant.wholesaleCashPrice) !== null ||
                    checkPositiveNum(selectedSizeVariant.retailCashPrice) !== null ||
                    checkPositiveNum(selectedSizeVariant.cashPrice) !== null;

    if (hasWholesale || hasRetail || hasCash) {
      const wholesalePrice = checkPositiveNum(selectedSizeVariant.wholesalePrice) ?? baseWholesale;
      const retailPrice = checkPositiveNum(selectedSizeVariant.retailPrice) ?? (checkPositiveNum(selectedSizeVariant.wholesalePrice) ?? baseRetail);
      const wholesaleCashPrice = checkPositiveNum(selectedSizeVariant.wholesaleCashPrice) ?? checkPositiveNum(selectedSizeVariant.cashPrice) ?? wholesalePrice;
      const retailCashPrice = checkPositiveNum(selectedSizeVariant.retailCashPrice) ?? checkPositiveNum(selectedSizeVariant.cashPrice) ?? retailPrice;
      const cashPrice = checkPositiveNum(selectedSizeVariant.cashPrice) ?? wholesaleCashPrice;

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
    const wholesalePrice = checkPositiveNum(opt.wholesalePrice) ?? baseWholesale;
    const retailPrice = checkPositiveNum(opt.retailPrice) ?? (checkPositiveNum(opt.wholesalePrice) ?? baseRetail);
    const wholesaleCashPrice = checkPositiveNum(opt.wholesaleCashPrice) ?? checkPositiveNum(opt.cashPrice) ?? wholesalePrice;
    const retailCashPrice = checkPositiveNum(opt.retailCashPrice) ?? checkPositiveNum(opt.cashPrice) ?? retailPrice;
    const cashPrice = checkPositiveNum(opt.cashPrice) ?? wholesaleCashPrice;

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

