import { getSupabase, isSupabaseConfigured } from './supabase';
import { requireAdminAuth } from './adminAuth';

export interface StoreSettings {
  showBuyNowButton: boolean;
  lastUpdated: string;
}

export const STORAGE_KEY_STORE_SETTINGS = 'my_commerce_store_settings_v1';
export const SYSTEM_STORE_SETTINGS_ROW_ID = '__system_store_settings_v1__';

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  showBuyNowButton: true,
  lastUpdated: new Date().toISOString(),
};

/**
 * Obtiene la configuración guardada localmente o por defecto
 */
export const getStoreSettings = (): StoreSettings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_STORE_SETTINGS);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_STORE_SETTINGS,
        ...parsed,
      };
    }
  } catch (e) {
    console.warn('Error leyendo storeSettings desde localStorage:', e);
  }
  return DEFAULT_STORE_SETTINGS;
};

/**
 * Guarda y propaga la configuración tanto localmente como en Supabase
 * garantizando persistencia en Vercel para todos los clientes y visitantes.
 */
export const saveStoreSettings = async (settings: Partial<StoreSettings>): Promise<StoreSettings> => {
  requireAdminAuth('guardar configuración de tienda');
  const current = getStoreSettings();
  const updated: StoreSettings = {
    ...current,
    ...settings,
    lastUpdated: new Date().toISOString(),
  };

  // Guardar en localStorage
  try {
    localStorage.setItem(STORAGE_KEY_STORE_SETTINGS, JSON.stringify(updated));
  } catch (e) {
    console.warn('Error guardando storeSettings en localStorage:', e);
  }

  // Notificar a toda la aplicación en tiempo real
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('my_commerce_store_settings_updated', {
        detail: updated,
      })
    );
  }

  // Sincronizar en Supabase para que aplique en la web publicada en Vercel
  const supabase = getSupabase();
  if (isSupabaseConfigured() && supabase) {
    try {
      const { error } = await supabase.from('products').upsert({
        id: SYSTEM_STORE_SETTINGS_ROW_ID,
        title: '__SYSTEM_STORE_SETTINGS__',
        description: JSON.stringify(updated),
        category: '__system__',
        wholesale_price: 0,
        retail_price: 0,
        stock: 0,
        specs: [{ key: 'updated_at', value: updated.lastUpdated }],
      });
      if (error) {
        console.warn('Error sincronizando storeSettings en Supabase:', error.message);
      }
    } catch (e) {
      console.warn('Error de red sincronizando storeSettings en Supabase:', e);
    }
  }

  return updated;
};

/**
 * Consulta y sincroniza la configuración de la tienda desde Supabase
 */
export const fetchStoreSettingsFromSupabase = async (): Promise<StoreSettings> => {
  const supabase = getSupabase();
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('description')
        .eq('id', SYSTEM_STORE_SETTINGS_ROW_ID)
        .maybeSingle();

      if (!error && data && data.description) {
        try {
          const parsed = JSON.parse(data.description);
          if (parsed && typeof parsed.showBuyNowButton === 'boolean') {
            const merged: StoreSettings = {
              ...DEFAULT_STORE_SETTINGS,
              ...parsed,
            };
            localStorage.setItem(STORAGE_KEY_STORE_SETTINGS, JSON.stringify(merged));
            if (typeof window !== 'undefined') {
              window.dispatchEvent(
                new CustomEvent('my_commerce_store_settings_updated', {
                  detail: merged,
                })
              );
            }
            return merged;
          }
        } catch (pe) {
          console.warn('Error parseando storeSettings desde Supabase:', pe);
        }
      } else if (!error && !data) {
        // Inicializar fila por defecto en Supabase si aún no existe
        saveStoreSettings(DEFAULT_STORE_SETTINGS).catch(() => {});
      }
    } catch (e) {
      console.warn('Error cargando storeSettings desde Supabase:', e);
    }
  }

  return getStoreSettings();
};
