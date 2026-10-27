import { useState, useEffect, useCallback } from 'react';
import { UserProfile } from '../types';
import {
  getLocalFavorites,
  fetchUserFavorites,
  toggleUserFavorite,
  isProductFavorite,
  FAVORITES_UPDATED_EVENT,
} from '../services/favorites';

export function useFavorites(currentUser?: UserProfile | null, onRequireAuth?: () => void) {
  const [favorites, setFavorites] = useState<string[]>(() => getLocalFavorites(currentUser?.id));
  const [isLoading, setIsLoading] = useState(false);

  // Sincronizar al montar y al cambiar el usuario actual
  useEffect(() => {
    let isMounted = true;
    setFavorites(getLocalFavorites(currentUser?.id));

    if (currentUser?.id) {
      setIsLoading(true);
      fetchUserFavorites(currentUser.id)
        .then((favs) => {
          if (isMounted) {
            setFavorites(favs);
            setIsLoading(false);
          }
        })
        .catch(() => {
          if (isMounted) setIsLoading(false);
        });
    }

    const handleUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<{ favorites?: string[]; userId?: string }>;
      if (customEvent.detail?.favorites) {
        setFavorites(customEvent.detail.favorites);
      } else {
        setFavorites(getLocalFavorites(currentUser?.id));
      }
    };

    window.addEventListener(FAVORITES_UPDATED_EVENT, handleUpdated);
    return () => {
      isMounted = false;
      window.removeEventListener(FAVORITES_UPDATED_EVENT, handleUpdated);
    };
  }, [currentUser?.id]);

  const toggle = useCallback(
    async (productId: string): Promise<boolean> => {
      if (!currentUser) {
        if (onRequireAuth) {
          onRequireAuth();
        }
        return false;
      }

      const res = await toggleUserFavorite(productId, currentUser.id);
      setFavorites(res.favorites);
      return res.isFavorite;
    },
    [currentUser, onRequireAuth]
  );

  const checkIsFavorite = useCallback(
    (productId: string): boolean => {
      return isProductFavorite(productId, favorites);
    },
    [favorites]
  );

  return {
    favorites,
    favoritesCount: favorites.length,
    toggleFavorite: toggle,
    isFavorite: checkIsFavorite,
    isLoading,
  };
}
