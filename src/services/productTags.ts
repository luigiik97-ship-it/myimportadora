import { ProductTag } from '../types';
import { getSupabase, isSupabaseConfigured } from './supabase';

export const SYSTEM_PRODUCT_TAGS_ROW_ID = '__system_product_tags_v1__';
export const STORAGE_KEY_PRODUCT_TAGS = 'my_commerce_product_tags_v1';

export interface TagColorPreset {
  name: string;
  color: string; // Background hex
  textColor: string; // Text hex
}

// Paleta amplia de colores profesionales
export const TAG_COLOR_PALETTE: TagColorPreset[] = [
  { name: 'Dorado Oro', color: '#d97706', textColor: '#ffffff' },
  { name: 'Verde Éxito', color: '#16a34a', textColor: '#ffffff' },
  { name: 'Rojo Oferta', color: '#dc2626', textColor: '#ffffff' },
  { name: 'Azul Michy', color: '#0058bb', textColor: '#ffffff' },
  { name: 'Púrpura Exclusivo', color: '#7c3aed', textColor: '#ffffff' },
  { name: 'Naranja Alerta', color: '#ea580c', textColor: '#ffffff' },
  { name: 'Rosa Fuerte', color: '#db2777', textColor: '#ffffff' },
  { name: 'Cian Fresco', color: '#0284c7', textColor: '#ffffff' },
  { name: 'Negro Elegante', color: '#18181b', textColor: '#ffffff' },
  { name: 'Gris Pizarra', color: '#475569', textColor: '#ffffff' },
  { name: 'Lima Vibrante', color: '#65a30d', textColor: '#ffffff' },
  { name: 'Bronce Cobre', color: '#854d0e', textColor: '#ffffff' },
  { name: 'Índigo Profundo', color: '#4338ca', textColor: '#ffffff' },
  { name: 'Teal Esmeralda', color: '#0f766e', textColor: '#ffffff' },
  { name: 'Blanco Nieve', color: '#ffffff', textColor: '#18181b' },
];

export const DEFAULT_PRODUCT_TAGS: ProductTag[] = [
  { id: 'tag-top-1', label: 'TOP 1', color: '#d97706', textColor: '#ffffff' },
  { id: 'tag-mas-vendido', label: 'Más vendido', color: '#16a34a', textColor: '#ffffff' },
  { id: 'tag-pocas-unidades', label: 'Pocas unidades', color: '#ea580c', textColor: '#ffffff' },
  { id: 'tag-nuevo', label: 'Nuevo', color: '#0284c7', textColor: '#ffffff' },
  { id: 'tag-oferta', label: 'Oferta', color: '#dc2626', textColor: '#ffffff' },
  { id: 'tag-destacado', label: 'Destacado', color: '#0058bb', textColor: '#ffffff' },
  { id: 'tag-exclusivo', label: 'Exclusivo', color: '#7c3aed', textColor: '#ffffff' },
  { id: 'tag-ultimas-unidades', label: 'Últimas unidades', color: '#db2777', textColor: '#ffffff' },
  { id: 'tag-liquidacion', label: 'Liquidación', color: '#18181b', textColor: '#ffffff' },
];

// In-memory cache
let cachedTags: ProductTag[] | null = null;

export const getLocalProductTags = (): ProductTag[] => {
  if (cachedTags && cachedTags.length > 0) {
    return cachedTags;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PRODUCT_TAGS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        cachedTags = parsed;
        return parsed;
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
  if (!force && cachedTags && cachedTags.length > 0) {
    return cachedTags;
  }

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
            cachedTags = loadedTags;
            try {
              localStorage.setItem(STORAGE_KEY_PRODUCT_TAGS, JSON.stringify(loadedTags));
            } catch (e) {}
            return loadedTags;
          }
        }
      }
    } catch (err) {
      console.warn('Error fetching product tags from Supabase:', err);
    }
  }

  return getLocalProductTags();
};

export const saveProductTags = async (tags: ProductTag[]): Promise<ProductTag[]> => {
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
  const current = getLocalProductTags();
  const filtered = current.filter((t) => t.id !== id);
  await saveProductTags(filtered);
};
