import { getSupabase, isSupabaseConfigured, safeLocalStorageSet } from './supabase';
import { getLocalAuthUser } from './auth';

export const FAVORITES_STORAGE_KEY_PREFIX = 'my_commerce_favorites_';
export const FAVORITES_UPDATED_EVENT = 'my_commerce_favorites_updated';

/**
 * Obtiene la lista local de IDs de publicaciones favoritas.
 * Si se especifica userId, lee la clave específica del usuario.
 */
export const getLocalFavorites = (userId?: string): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const user = userId ? { id: userId } : getLocalAuthUser();
    const key = user?.id ? `${FAVORITES_STORAGE_KEY_PREFIX}${user.id}` : 'my_commerce_favorites_guest';
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((id) => typeof id === 'string' && id.trim().length > 0);
      }
    }
  } catch (e) {
    console.warn('[Favorites] Error al leer favoritos locales:', e);
  }
  return [];
};

/**
 * Guarda los favoritos en localStorage y emite el evento global de sincronización.
 */
export const saveLocalFavorites = (favorites: string[], userId?: string) => {
  if (typeof window === 'undefined') return;
  const user = userId ? { id: userId } : getLocalAuthUser();
  const key = user?.id ? `${FAVORITES_STORAGE_KEY_PREFIX}${user.id}` : 'my_commerce_favorites_guest';
  const cleanList = Array.from(new Set(favorites.filter((id) => typeof id === 'string' && id.trim().length > 0)));
  safeLocalStorageSet(key, JSON.stringify(cleanList));
  window.dispatchEvent(
    new CustomEvent(FAVORITES_UPDATED_EVENT, {
      detail: { favorites: cleanList, userId: user?.id },
    })
  );
};

/**
 * Consulta y sincroniza los favoritos guardados en Supabase (auth.user_metadata) para el usuario activo.
 */
export const fetchUserFavorites = async (userId?: string): Promise<string[]> => {
  const localList = getLocalFavorites(userId);
  const supabase = getSupabase();

  if (!isSupabaseConfigured() || !supabase) {
    return localList;
  }

  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.warn('[Favorites] Error obteniendo usuario de Supabase:', error.message);
      return localList;
    }
    const user = data?.user;
    if (user) {
      const remoteFavorites = user.user_metadata?.favorites;
      if (Array.isArray(remoteFavorites)) {
        const cleanRemote = Array.from(
          new Set(remoteFavorites.filter((id: any) => typeof id === 'string' && id.trim().length > 0))
        );
        saveLocalFavorites(cleanRemote, user.id);
        return cleanRemote;
      } else if (localList.length > 0) {
        // Si el usuario tiene favoritos locales pero aún no en metadata de Supabase, subirlos
        await supabase.auth.updateUser({
          data: { favorites: localList },
        });
      }
    }
  } catch (e) {
    console.warn('[Favorites] Excepción al consultar favoritos en Supabase:', e);
  }

  return localList;
};

/**
 * Alterna el estado de favorito de una publicación completa.
 * Actualiza inmediatamente el estado local y sincroniza en Supabase si hay sesión iniciada.
 */
export const toggleUserFavorite = async (
  productId: string,
  userId?: string
): Promise<{ isFavorite: boolean; favorites: string[] }> => {
  const cleanId = String(productId).trim();
  if (!cleanId) return { isFavorite: false, favorites: [] };

  const currentList = getLocalFavorites(userId);
  const exists = currentList.includes(cleanId);
  const updatedList = exists
    ? currentList.filter((id) => id !== cleanId)
    : [cleanId, ...currentList.filter((id) => id !== cleanId)];

  // 1. Actualización optimista instantánea
  saveLocalFavorites(updatedList, userId);

  // 2. Persistencia en Supabase Auth metadata
  const supabase = getSupabase();
  if (isSupabaseConfigured() && supabase) {
    try {
      await supabase.auth.updateUser({
        data: {
          favorites: updatedList,
        },
      });
    } catch (e) {
      console.warn('[Favorites] Error al sincronizar favoritos con Supabase:', e);
    }
  }

  return { isFavorite: !exists, favorites: updatedList };
};

/**
 * Verifica si un producto específico está en la lista de favoritos.
 */
export const isProductFavorite = (productId: string, favorites: string[]): boolean => {
  if (!productId || !Array.isArray(favorites)) return false;
  return favorites.includes(String(productId).trim());
};
