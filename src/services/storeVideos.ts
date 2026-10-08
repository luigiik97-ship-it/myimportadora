import { StoreVideo, Product } from '../types';
import { getSupabase, isSupabaseConfigured } from './supabase';
import { requireAdminAuth } from './adminAuth';

/**
 * Servicio de Gestión y Sincronización de Videos Cloudinary MP4
 * Almacena la lista de videos en Supabase y en localStorage para persistencia instantánea.
 */

export const STORAGE_KEY_STORE_VIDEOS = 'my_commerce_store_videos_config';
export const SYSTEM_STORE_VIDEOS_ROW_ID = '__system_store_videos_v1__';

// Lista predeterminada vacía: los videos provienen exclusivamente de Supabase y del panel
export const DEFAULT_STORE_VIDEOS: StoreVideo[] = [];

/**
 * Obtiene los videos guardados en localStorage con fallback a valores iniciales
 */
export const getLocalStoreVideos = (): StoreVideo[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_STORE_VIDEOS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Error leyendo videos locales:', e);
  }
  return DEFAULT_STORE_VIDEOS;
};

/**
 * Guarda los videos en localStorage y despacha eventos para reactividad instantánea
 */
export const saveLocalStoreVideos = (videos: StoreVideo[]) => {
  try {
    localStorage.setItem(STORAGE_KEY_STORE_VIDEOS, JSON.stringify(videos));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('store-videos-updated', { detail: videos }));
      window.dispatchEvent(new CustomEvent('my_commerce_videos_updated', { detail: videos }));
    }
  } catch (e) {
    console.error('Error guardando videos en localStorage:', e);
  }
};

let activeFetchVideosPromise: Promise<StoreVideo[]> | null = null;
let cachedVideosList: StoreVideo[] | null = null;
let lastVideosFetchTime = 0;
const VIDEOS_CACHE_TTL = 30000; // 30 segundos

/**
 * Consulta y sincroniza los videos desde Supabase
 */
export const fetchStoreVideosFromSupabase = async (force = false): Promise<StoreVideo[]> => {
  const now = Date.now();
  if (!force && cachedVideosList && (now - lastVideosFetchTime < VIDEOS_CACHE_TTL)) {
    return cachedVideosList;
  }

  if (activeFetchVideosPromise) {
    return activeFetchVideosPromise;
  }

  activeFetchVideosPromise = (async () => {
    const supabase = getSupabase();
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('description')
          .eq('id', SYSTEM_STORE_VIDEOS_ROW_ID)
          .maybeSingle();

        if (!error && (!data || !data.description)) {
          saveStoreVideos(DEFAULT_STORE_VIDEOS).catch(() => {});
        }

        if (!error && data && data.description) {
          try {
            const parsed = JSON.parse(data.description);
            if (Array.isArray(parsed)) {
              cachedVideosList = parsed;
              lastVideosFetchTime = Date.now();
              saveLocalStoreVideos(parsed);
              return parsed;
            }
          } catch (parseErr) {
            console.warn('Error decodificando videos de Supabase:', parseErr);
          }
        }
      } catch (err) {
        console.warn('Error consultando videos en Supabase:', err);
      }
    }
    const local = getLocalStoreVideos();
    cachedVideosList = local;
    lastVideosFetchTime = Date.now();
    return local;
  })().finally(() => {
    activeFetchVideosPromise = null;
  });

  return activeFetchVideosPromise;
};

/**
 * Persiste la lista de videos en Supabase y localStorage
 */
export const saveStoreVideos = async (videos: StoreVideo[]): Promise<boolean> => {
  requireAdminAuth('guardar videos de tienda');
  saveLocalStoreVideos(videos);

  const supabase = getSupabase();
  if (!isSupabaseConfigured() || !supabase) {
    return true;
  }

  try {
    const payload = {
      id: SYSTEM_STORE_VIDEOS_ROW_ID,
      title: '__SYSTEM_STORE_VIDEOS__',
      description: JSON.stringify(videos),
      category: '__system__',
      subcategory: 'Config',
      images: [],
      wholesale_price: 0,
      retail_price: 0,
      stock: 0,
      specs: [{ key: 'updated_at', value: new Date().toISOString() }],
    };

    const { error } = await supabase
      .from('products')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.warn('Advertencia al guardar videos en Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Excepción al guardar videos en Supabase:', err);
    return false;
  }
};

/**
 * Combina videos del panel general y videos asociados directamente a productos
 * para generar la cola completa de Reels 9:16
 */
export const getCombinedReelsList = (
  storeVideos: StoreVideo[],
  products: Product[]
): StoreVideo[] => {
  const list: StoreVideo[] = [...storeVideos];
  const existingUrls = new Set(storeVideos.map((v) => v.videoUrl.trim()));

  // Añadir videos de productos individuales si tienen videoUrl configurado y no están duplicados
  for (const prod of products) {
    if (prod.videoUrl && prod.videoUrl.trim() && !existingUrls.has(prod.videoUrl.trim())) {
      existingUrls.add(prod.videoUrl.trim());
      list.push({
        id: `prod-vid-${prod.id}`,
        title: prod.title,
        videoUrl: prod.videoUrl.trim(),
        productId: prod.id,
        productTitle: prod.title,
        productPrice: prod.wholesalePrice,
        productImage: prod.images?.[0],
        thumbnailUrl: prod.images?.[0],
        createdAt: prod.createdAt || new Date().toISOString(),
      });
    }
  }

  return list;
};
