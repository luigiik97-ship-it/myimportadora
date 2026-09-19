import { getSupabase, isSupabaseConfigured, uploadBannerImage } from './supabase';

/**
 * Servicio de Configuración y Gestión de Banners y Portada de la Tienda
 * Sincronizado automáticamente mediante Supabase Storage y base de datos relacional
 */

export interface StoreBannerItem {
  id: string;
  imageUrl: string;
  linkUrl?: string; // Enlace / categoría / URL destino al hacer clic
  title?: string;
  showText?: boolean;
}

export interface StoreBannersConfig {
  // 1. Lista Dinámica de Banners Principales (1 = estático, 2 o más = carrusel animado)
  heroBanners?: StoreBannerItem[];

  // Campos legacy para compatibilidad
  heroBanner1: string; // URL Banner 1 (Recomendado: 1920 x 700 px)
  heroBanner2: string; // URL Banner 2 (Recomendado: 1920 x 700 px)
  heroBanner3: string; // URL Banner 3 (Recomendado: 1920 x 700 px)
  heroBanner1ShowText?: boolean;
  heroBanner2ShowText?: boolean;
  heroBanner3ShowText?: boolean;
  heroBanner1Link?: string;
  heroBanner2Link?: string;
  heroBanner3Link?: string;

  // 2. Banners Secundarios Intermedios Dinámicos (Izquierdo y Derecho independientes)
  secondaryBanners1?: StoreBannerItem[];
  secondaryBanners2?: StoreBannerItem[];

  // Campos legacy secundarios para compatibilidad
  secondaryBanner1: string; // URL Banner Izquierdo (Recomendado: 800 x 400 px)
  secondaryBanner2: string; // URL Banner Derecho (Recomendado: 800 x 400 px)
  secondaryBanner1Link?: string;
  secondaryBanner2Link?: string;

  // 3. Imagen de Exhibición Inferior (Showroom)
  showroomImage: string; // URL Imagen Exhibición (Recomendado: 800 x 500 px)
  showroomImageLink?: string;

  lastUpdated: string;
}

export const STORAGE_KEY_BANNERS = 'my_commerce_store_banners_config';
export const SYSTEM_STORE_BANNERS_ROW_ID = '__system_store_banners_v1__';

export const DEFAULT_STORE_BANNERS: StoreBannersConfig = {
  heroBanners: [
    {
      id: 'banner-default-1',
      imageUrl: '',
      linkUrl: 'Todo',
      showText: true,
      title: 'Precios en efectivo',
    },
    {
      id: 'banner-default-2',
      imageUrl: '',
      linkUrl: 'Todo',
      showText: true,
      title: 'Despacho Inmediato',
    },
    {
      id: 'banner-default-3',
      imageUrl: '',
      linkUrl: 'Todo',
      showText: true,
      title: 'Ventas por Bulto y Surtido',
    },
  ],
  heroBanner1: '', // Vacío: utiliza la composición/collage por defecto
  heroBanner2: '',
  heroBanner3: '',
  heroBanner1ShowText: true,
  heroBanner2ShowText: true,
  heroBanner3ShowText: true,
  heroBanner1Link: '',
  heroBanner2Link: '',
  heroBanner3Link: '',
  secondaryBanners1: [
    {
      id: 'sec-1-default',
      imageUrl: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800&auto=format&fit=crop&q=80',
      linkUrl: '',
      title: 'Banner Intermedio 1',
    },
  ],
  secondaryBanners2: [
    {
      id: 'sec-2-default',
      imageUrl: 'https://images.unsplash.com/photo-1611591475152-47eac9806830?w=800&auto=format&fit=crop&q=80',
      linkUrl: '',
      title: 'Banner Intermedio 2',
    },
  ],
  secondaryBanner1: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800&auto=format&fit=crop&q=80',
  secondaryBanner2: 'https://images.unsplash.com/photo-1611591475152-47eac9806830?w=800&auto=format&fit=crop&q=80',
  secondaryBanner1Link: '',
  secondaryBanner2Link: '',
  showroomImage: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=600&auto=format&fit=crop&q=80',
  showroomImageLink: '',
  lastUpdated: '2026-01-01T00:00:00.000Z',
};

/**
 * Normaliza la lista de banners principales asegurando compatibilidad total
 */
export const getNormalizedHeroBanners = (config: StoreBannersConfig): StoreBannerItem[] => {
  if (Array.isArray(config.heroBanners) && config.heroBanners.length > 0) {
    return config.heroBanners;
  }

  // Reconstruir desde los campos clásicos si existen
  const list: StoreBannerItem[] = [];
  if (config.heroBanner1) {
    list.push({
      id: 'banner-1',
      imageUrl: config.heroBanner1,
      linkUrl: config.heroBanner1Link || '',
      showText: config.heroBanner1ShowText !== false,
      title: 'Precios en efectivo',
    });
  }
  if (config.heroBanner2) {
    list.push({
      id: 'banner-2',
      imageUrl: config.heroBanner2,
      linkUrl: config.heroBanner2Link || '',
      showText: config.heroBanner2ShowText !== false,
      title: 'Despacho Inmediato',
    });
  }
  if (config.heroBanner3) {
    list.push({
      id: 'banner-3',
      imageUrl: config.heroBanner3,
      linkUrl: config.heroBanner3Link || '',
      showText: config.heroBanner3ShowText !== false,
      title: 'Ventas por Bulto y Surtido',
    });
  }

  if (list.length > 0) {
    return list;
  }

  return DEFAULT_STORE_BANNERS.heroBanners || [];
};

/**
 * Normaliza la lista de imágenes para el Banner Intermedio 1 (Izquierdo)
 */
export const getNormalizedSecondaryBanners1 = (config: StoreBannersConfig): StoreBannerItem[] => {
  if (Array.isArray(config.secondaryBanners1) && config.secondaryBanners1.length > 0) {
    return config.secondaryBanners1;
  }
  if (config.secondaryBanner1) {
    return [
      {
        id: 'sec-1-1',
        imageUrl: config.secondaryBanner1,
        linkUrl: config.secondaryBanner1Link || '',
        title: 'Banner Intermedio 1',
      },
    ];
  }
  return DEFAULT_STORE_BANNERS.secondaryBanners1 || [];
};

/**
 * Normaliza la lista de imágenes para el Banner Intermedio 2 (Derecho)
 */
export const getNormalizedSecondaryBanners2 = (config: StoreBannersConfig): StoreBannerItem[] => {
  if (Array.isArray(config.secondaryBanners2) && config.secondaryBanners2.length > 0) {
    return config.secondaryBanners2;
  }
  if (config.secondaryBanner2) {
    return [
      {
        id: 'sec-2-1',
        imageUrl: config.secondaryBanner2,
        linkUrl: config.secondaryBanner2Link || '',
        title: 'Banner Intermedio 2',
      },
    ];
  }
  return DEFAULT_STORE_BANNERS.secondaryBanners2 || [];
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
