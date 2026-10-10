import { ProductTag } from '../types';
import { getSupabase, isSupabaseConfigured } from './supabase';
import { requireAdminAuth } from './adminAuth';

export const SYSTEM_PRODUCT_TAGS_ROW_ID = '__system_product_tags_v1__';
export const STORAGE_KEY_PRODUCT_TAGS = 'my_commerce_product_tags_v1';

export interface TagColorPreset {
  name: string;
  color: string; // Background hex
  textColor: string; // Text hex
}

// Mapa de colores heredados/apagados a colores vivos estilo Mercado Libre
export const VIVID_COLOR_MAP: Record<string, string> = {
  // Verdes -> Verde vibrante Mercado Libre (#00A650)
  '#16a34a': '#00A650',
  '#15803d': '#00A650',
  '#0f766e': '#00A650',
  '#059669': '#00A650',

  // Dorados/Ámbar -> Dorado Solar / Oro brillante
  '#d97706': '#F59E0B',
  '#b45309': '#F59E0B',
  '#854d0e': '#F59E0B',

  // Naranjas -> Naranja Mercado Libre / Flama
  '#ea580c': '#FF7733',
  '#c2410c': '#FF5722',
  '#f97316': '#FF7733',

  // Azules -> Azul eléctrico Mercado Libre (#3483FA)
  '#0058bb': '#3483FA',
  '#1d4ed8': '#3483FA',
  '#2563eb': '#3483FA',
  '#1e40af': '#3483FA',

  // Rojos -> Rojo Fuego / Oferta Relámpago vibrante
  '#dc2626': '#FF2B2B',
  '#b91c1c': '#FF2B2B',
  '#ef4444': '#FF2B2B',

  // Púrpuras/Violetas -> Violeta / Púrpura Neón
  '#7c3aed': '#8B5CF6',
  '#6d28d9': '#8B5CF6',
  '#4338ca': '#6366F1',

  // Rosas/Fucsias -> Fucsia Neón / Rosa Vivo
  '#db2777': '#FF2D78',
  '#be185d': '#FF2D78',

  // Cianos/Celestes -> Cian Vibrante
  '#0284c7': '#0EA5E9',
  '#0369a1': '#0EA5E9',

  // Limas -> Lima Eléctrico
  '#65a30d': '#84CC16',
  '#4d7c0f': '#84CC16',

  // Oscuros
  '#18181b': '#111827',
  '#27272a': '#111827',
  '#475569': '#334155',
};

/**
 * Convierte un color de etiqueta a un color vivo e impactante estilo Mercado Libre
 */
export const toVividTagColor = (color?: string, id?: string, label?: string): string => {
  const cleanLabel = (label || '').toLowerCase();
  const cleanId = (id || '').toLowerCase();

  // En Mercado Libre, la etiqueta "MÁS VENDIDO" es siempre el naranja icónico (#FF7733)
  if (cleanId === 'tag-mas-vendido' || cleanLabel.includes('vendido') || cleanLabel.includes('bestseller')) {
    return '#FF7733';
  }

  if (!color) return '#3483FA';

  const lower = color.toLowerCase().trim();
  if (VIVID_COLOR_MAP[lower]) {
    return VIVID_COLOR_MAP[lower];
  }

  return color;
};

// Paleta amplia de colores vivos inspirada en Mercado Libre y comercio electrónico moderno
export const TAG_COLOR_PALETTE: TagColorPreset[] = [
  { name: 'Naranja Mercado Libre', color: '#FF7733', textColor: '#ffffff' }, // Ícono "MÁS VENDIDO"
  { name: 'Verde Mercado Libre', color: '#00A650', textColor: '#ffffff' }, // "LLEGA MAÑANA / FULL / GRATIS"
  { name: 'Azul Mercado Libre', color: '#3483FA', textColor: '#ffffff' }, // Azul oficial de ML
  { name: 'Rojo Fuego', color: '#FF2B2B', textColor: '#ffffff' }, // Oferta Relámpago
  { name: 'Dorado Solar', color: '#F59E0B', textColor: '#ffffff' }, // TOP 1 / Destacado
  { name: 'Naranja Flama', color: '#FF5722', textColor: '#ffffff' }, // Pocas unidades
  { name: 'Púrpura Neón', color: '#8B5CF6', textColor: '#ffffff' }, // Exclusivo
  { name: 'Fucsia Vivo', color: '#FF2D78', textColor: '#ffffff' }, // Últimas unidades
  { name: 'Cian Vibrante', color: '#0EA5E9', textColor: '#ffffff' }, // Nuevo
  { name: 'Lima Eléctrico', color: '#84CC16', textColor: '#ffffff' }, // Lanzamiento
  { name: 'Verde Esmeralda', color: '#10B981', textColor: '#ffffff' }, // Disponible
  { name: 'Violeta Intenso', color: '#7C3AED', textColor: '#ffffff' }, // Edición Especial
  { name: 'Amarillo ML', color: '#FFE600', textColor: '#18181b' }, // Amarillo clásico Mercado Libre
  { name: 'Negro Carbón', color: '#111827', textColor: '#ffffff' }, // Liquidación / Black
  { name: 'Blanco Puro', color: '#ffffff', textColor: '#111827' },
];

export const DEFAULT_PRODUCT_TAGS: ProductTag[] = [
  { id: 'tag-top-1', label: 'TOP 1', color: '#F59E0B', textColor: '#ffffff' },
  { id: 'tag-mas-vendido', label: 'Más vendido', color: '#FF7733', textColor: '#ffffff' },
  { id: 'tag-pocas-unidades', label: 'Pocas unidades', color: '#FF5722', textColor: '#ffffff' },
  { id: 'tag-nuevo', label: 'Nuevo', color: '#3483FA', textColor: '#ffffff' },
  { id: 'tag-oferta', label: 'Oferta', color: '#FF2B2B', textColor: '#ffffff' },
  { id: 'tag-destacado', label: 'Destacado', color: '#00A650', textColor: '#ffffff' },
  { id: 'tag-exclusivo', label: 'Exclusivo', color: '#8B5CF6', textColor: '#ffffff' },
  { id: 'tag-ultimas-unidades', label: 'Últimas unidades', color: '#FF2D78', textColor: '#ffffff' },
  { id: 'tag-liquidacion', label: 'Liquidación', color: '#DC2626', textColor: '#ffffff' },
];

// In-memory cache
let cachedTags: ProductTag[] | null = null;
let activeFetchTagsPromise: Promise<ProductTag[]> | null = null;
let lastTagsFetchTime = 0;
const TAGS_CACHE_TTL = 30000;

export const getLocalProductTags = (): ProductTag[] => {
  if (cachedTags && cachedTags.length > 0) {
    return cachedTags;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PRODUCT_TAGS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const upgraded: ProductTag[] = parsed.map((t: ProductTag) => {
          const vividColor = toVividTagColor(t.color, t.id, t.label);
          const isLight = vividColor === '#FFE600' || vividColor.toLowerCase() === '#ffffff';
          return {
            ...t,
            color: vividColor,
            textColor: isLight ? '#18181b' : (t.textColor && t.textColor !== '#ffffff' ? t.textColor : '#ffffff'),
          };
        });
        cachedTags = upgraded;
        try {
          localStorage.setItem(STORAGE_KEY_PRODUCT_TAGS, JSON.stringify(upgraded));
        } catch (e) {}
        return upgraded;
      }
    }
  } catch (e) {
    console.warn('Error reading product tags from localStorage:', e);
  }
  cachedTags = [...DEFAULT_PRODUCT_TAGS];
  try {
    localStorage.setItem(STORAGE_KEY_PRODUCT_TAGS, JSON.stringify(DEFAULT_PRODUCT_TAGS));
  } catch (e) {}
  return cachedTags;
};

export const getProductTagById = (id?: string): ProductTag | undefined => {
  if (!id) return undefined;
  const tags = getLocalProductTags();
  return tags.find((t) => t.id === id);
};

export const fetchProductTags = async (force = false): Promise<ProductTag[]> => {
  const now = Date.now();
  if (!force && cachedTags && cachedTags.length > 0 && (now - lastTagsFetchTime < TAGS_CACHE_TTL)) {
    return cachedTags;
  }

  if (activeFetchTagsPromise) {
    return activeFetchTagsPromise;
  }

  activeFetchTagsPromise = (async () => {
    // 1. Try fetching from Supabase system row
    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabase();
        if (supabase) {
          const { data, error } = await supabase
            .from('products')
            .select('description, specs')
            .eq('id', SYSTEM_PRODUCT_TAGS_ROW_ID)
            .maybeSingle();

          if (!error && data) {
            let loadedTags: ProductTag[] | null = null;
            if (data.description && typeof data.description === 'string' && data.description.startsWith('[')) {
              try {
                loadedTags = JSON.parse(data.description);
              } catch (e) {}
            }
            if (!loadedTags && Array.isArray(data.specs)) {
              const spec = data.specs.find((s: any) => s && s.label === '__product_tags_json');
              if (spec?.value) {
                try {
                  loadedTags = JSON.parse(spec.value);
                } catch (e) {}
              }
            }

            if (Array.isArray(loadedTags) && loadedTags.length > 0) {
              const upgraded: ProductTag[] = loadedTags.map((t: ProductTag) => {
                const vividColor = toVividTagColor(t.color, t.id, t.label);
                const isLight = vividColor === '#FFE600' || vividColor.toLowerCase() === '#ffffff';
                return {
                  ...t,
                  color: vividColor,
                  textColor: isLight ? '#18181b' : (t.textColor && t.textColor !== '#ffffff' ? t.textColor : '#ffffff'),
                };
              });
              cachedTags = upgraded;
              lastTagsFetchTime = Date.now();
              try {
                localStorage.setItem(STORAGE_KEY_PRODUCT_TAGS, JSON.stringify(upgraded));
              } catch (e) {}
              return upgraded;
            }
          }
        }
      } catch (err) {
        console.warn('Error fetching product tags from Supabase:', err);
      }
    }

    const localTags = getLocalProductTags();
    cachedTags = localTags;
    lastTagsFetchTime = Date.now();
    return localTags;
  })().finally(() => {
    activeFetchTagsPromise = null;
  });

  return activeFetchTagsPromise;
};

export const saveProductTags = async (tags: ProductTag[]): Promise<ProductTag[]> => {
  requireAdminAuth('guardar etiquetas de producto');
  cachedTags = [...tags];
  try {
    localStorage.setItem(STORAGE_KEY_PRODUCT_TAGS, JSON.stringify(tags));
    window.dispatchEvent(new CustomEvent('product_tags_updated', { detail: tags }));
  } catch (e) {
    console.warn('Error saving product tags to localStorage:', e);
  }

  // Sync to Supabase system row
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabase();
      if (supabase) {
        const payload = {
          id: SYSTEM_PRODUCT_TAGS_ROW_ID,
          title: '__SYSTEM_PRODUCT_TAGS__',
          description: JSON.stringify(tags),
          category: '__system__',
          wholesale_price: 0,
          retail_price: 0,
          stock: 0,
          images: [],
          specs: [{ label: '__product_tags_json', value: JSON.stringify(tags) }],
        };

        const { error } = await supabase.from('products').upsert([payload], { onConflict: 'id' });
        if (error) {
          console.warn('Could not persist product tags to Supabase (continuing with local persistence):', error.message);
        }
      }
    } catch (err) {
      console.warn('Exception persisting product tags to Supabase:', err);
    }
  }

  return cachedTags;
};

export const createProductTag = async (
  label: string,
  color: string,
  textColor = '#ffffff'
): Promise<ProductTag> => {
  requireAdminAuth('crear etiqueta de producto');
  const current = getLocalProductTags();
  const slug = label
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const id = `tag-${slug || Date.now()}`;
  
  // If already exists with same id or label, update color
  const existingIndex = current.findIndex((t) => t.id === id || t.label.trim().toLowerCase() === label.trim().toLowerCase());
  if (existingIndex >= 0) {
    const updatedTag: ProductTag = {
      ...current[existingIndex],
      label: label.trim(),
      color,
      textColor,
    };
    current[existingIndex] = updatedTag;
    await saveProductTags(current);
    return updatedTag;
  }

  const newTag: ProductTag = {
    id,
    label: label.trim(),
    color,
    textColor,
  };

  const updated = [...current, newTag];
  await saveProductTags(updated);
  return newTag;
};

export const deleteProductTag = async (id: string): Promise<void> => {
  requireAdminAuth('eliminar etiqueta de producto');
  const current = getLocalProductTags();
  const filtered = current.filter((t) => t.id !== id);
  await saveProductTags(filtered);
};
