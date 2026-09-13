import { getSupabase, isSupabaseConfigured, uploadBannerImage } from './supabase';

/**
 * Servicio de Configuración y Gestión de Banners y Portada de la Tienda
 * Sincronizado automáticamente mediante Supabase Storage y base de datos relacional
 */

export interface StoreBannersConfig {
  // 1. Carrusel Principal (3 Banners / Slides)
  heroBanner1: string; // URL Banner 1 (Recomendado: 1920 x 700 px)
  heroBanner2: string; // URL Banner 2 (Recomendado: 1920 x 700 px)
  heroBanner3: string; // URL Banner 3 (Recomendado: 1920 x 700 px)
  heroBanner1ShowText?: boolean;
  heroBanner2ShowText?: boolean;
  heroBanner3ShowText?: boolean;

  // 2. Banners Secundarios Intermedios (2 Banners)
  secondaryBanner1: string; // URL Banner Izquierdo (Recomendado: 800 x 400 px)
  secondaryBanner2: string; // URL Banner Derecho (Recomendado: 800 x 400 px)

  // 3. Imagen de Exhibición Inferior (Showroom)
  showroomImage: string; // URL Imagen Exhibición (Recomendado: 800 x 500 px)

  lastUpdated: string;
}

export const STORAGE_KEY_BANNERS = 'my_commerce_store_banners_config';
export const SYSTEM_STORE_BANNERS_ROW_ID = '__system_store_banners_v1__';

export const DEFAULT_STORE_BANNERS: StoreBannersConfig = {
  heroBanner1: '', // Vacío: utiliza la composición/collage por defecto
  heroBanner2: '',
  heroBanner3: '',
  heroBanner1ShowText: true,
  heroBanner2ShowText: true,
  heroBanner3ShowText: true,
  secondaryBanner1: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800&auto=format&fit=crop&q=80',
  secondaryBanner2: 'https://images.unsplash.com/photo-1611591475152-47eac9806830?w=800&auto=format&fit=crop&q=80',
  showroomImage: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=600&auto=format&fit=crop&q=80',
  lastUpdated: '2026-01-01T00:00:00.000Z',
};

/**
 * Obtiene la configuración actual de banners desde localStorage con fallback a valores por defecto
 */
export const getStoreBannersConfig = (): StoreBannersConfig => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_BANNERS);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_STORE_BANNERS,
        ...parsed,
      };
    }
  } catch (e) {
    console.warn('Error leyendo configuración de banners de localStorage:', e);
  }
  return { ...DEFAULT_STORE_BANNERS };
};

/**
 * Consulta y sincroniza la configuración de Banners directamente desde Supabase
 */
export const fetchStoreBannersFromSupabase = async (): Promise<StoreBannersConfig> => {
  const supabase = getSupabase();
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('description')
        .eq('id', SYSTEM_STORE_BANNERS_ROW_ID)
        .maybeSingle();

      if (!error && data && data.description) {
        try {
          const parsed = JSON.parse(data.description);
          if (parsed && typeof parsed === 'object') {
            const merged: StoreBannersConfig = {
              ...DEFAULT_STORE_BANNERS,
              ...parsed,
            };
            localStorage.setItem(STORAGE_KEY_BANNERS, JSON.stringify(merged));
            if (typeof window !== 'undefined') {
              window.dispatchEvent(
                new CustomEvent('my_commerce_banners_updated', {
                  detail: merged,
                })
              );
            }
            return merged;
          }
        } catch (parseErr) {
          console.warn('Error parseando configuración remota de banners:', parseErr);
        }
      }
    } catch (e) {
      console.warn('Error consultando configuración de banners en Supabase:', e);
    }
  }
  return getStoreBannersConfig();
};

/**
 * Guarda la configuración de banners tanto en local como en la fila de sistema de Supabase
 */
export const saveStoreBannersConfig = async (
  config: Partial<StoreBannersConfig>
): Promise<StoreBannersConfig> => {
  const current = getStoreBannersConfig();
  const updated: StoreBannersConfig = {
    ...current,
    ...config,
    lastUpdated: new Date().toISOString(),
  };

  // 1. Guardar en almacenamiento local para carga instantánea
  localStorage.setItem(STORAGE_KEY_BANNERS, JSON.stringify(updated));

  // 2. Disparar evento para actualizar componentes locales inmediatamente
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('my_commerce_banners_updated', {
        detail: updated,
      })
    );
  }

  // 3. Persistir en Supabase para sincronización entre dispositivos
  const supabase = getSupabase();
  if (isSupabaseConfigured() && supabase) {
    try {
      const { error } = await supabase.from('products').upsert({
        id: SYSTEM_STORE_BANNERS_ROW_ID,
        title: '__SYSTEM_STORE_BANNERS__',
        description: JSON.stringify(updated),
        category: '__system__',
        wholesale_price: 0,
        retail_price: 0,
        stock: 0,
        specs: [{ key: 'updated_at', value: updated.lastUpdated }],
      });

      if (error) {
        console.warn('Advertencia al guardar configuración de banners en Supabase:', error.message);
      }
    } catch (err) {
      console.warn('Error de red al sincronizar banners con Supabase:', err);
    }
  }

  return updated;
};

export { uploadBannerImage };
