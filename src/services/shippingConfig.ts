import { getSupabase, isSupabaseConfigured } from './supabase';
import { requireAdminAuth } from './adminAuth';

export interface ShippingOptionConfig {
  id: string;
  name: string;
  price: number;
  deliveryTime: string;
  description: string;
  enabled: boolean;
}

export type ShippingZoneId = 'caba' | 'gba' | 'pba_sf_cba' | 'resto_pais';

export interface ShippingZoneConfig {
  id: ShippingZoneId;
  name: string;
  zoneLabel: string;
  description: string;
  enabled: boolean;
  minPostalCode?: number;
  maxPostalCode?: number;
  options: ShippingOptionConfig[];
}

export interface CustomPostalCodeRule {
  id: string;
  postalCode: string;
  zoneLabel: string;
  options: ShippingOptionConfig[];
  note?: string;
}

export interface ShippingConfig {
  version: number;
  lastUpdated: string;
  zones: Record<ShippingZoneId, ShippingZoneConfig>;
  customPostalCodeRules: CustomPostalCodeRule[];
}

export const STORAGE_KEY_SHIPPING_CONFIG = 'my_commerce_shipping_config_v1';
export const SYSTEM_SHIPPING_CONFIG_ROW_ID = '__system_shipping_config_v1__';

export const DEFAULT_SHIPPING_CONFIG: ShippingConfig = {
  version: 1,
  lastUpdated: new Date().toISOString(),
  zones: {
    caba: {
      id: 'caba',
      name: 'CABA',
      zoneLabel: 'CABA (Ciudad Autónoma de Buenos Aires)',
      description: 'Capital Federal y barrios aledaños (CPs 1000 a 1499)',
      enabled: true,
      minPostalCode: 1000,
      maxPostalCode: 1499,
      options: [
        {
          id: 'caba_uber_moto',
          name: 'Uber Moto (llega hoy)',
          price: 7950,
          deliveryTime: 'Llega hoy',
          description: 'Entrega en el día en moto',
          enabled: true,
        },
        {
          id: 'caba_envio_flex',
          name: 'Envío Flex (llega mañana)',
          price: 7150,
          deliveryTime: 'Llega mañana',
          description: 'Reparto express a tu puerta',
          enabled: true,
        },
        {
          id: 'caba_correo_argentino',
          name: 'Correo Argentino (llega 1 a 4 días)',
          price: 6520,
          deliveryTime: 'Llega 1 a 4 días',
          description: 'Envió a domicilio',
          enabled: true,
        },
        {
          id: 'caba_correo_sucursal',
          name: 'Sucursal de Correo Argentino',
          price: 5200,
          deliveryTime: 'Llega 1 a 4 días',
          description: 'Retiro en la sucursal',
          enabled: true,
        },
      ],
    },
    gba: {
      id: 'gba',
      name: 'Gran Buenos Aires',
      zoneLabel: 'Gran Buenos Aires (1er y 2do cordón)',
      description: 'Partidos del Conurbano Bonaerense (CPs 1600 a 1899)',
      enabled: true,
      minPostalCode: 1600,
      maxPostalCode: 1899,
      options: [
        {
          id: 'gba_envio_flex',
          name: 'Envío Flex (llega mañana)',
          price: 10250,
          deliveryTime: 'Llega mañana',
          description: 'Reparto express a domicilio en Gran Buenos Aires',
          enabled: true,
        },
        {
          id: 'gba_correo_argentino',
          name: 'Correo Argentino (llega 1 a 4 días)',
          price: 6520,
          deliveryTime: 'Llega 1 a 4 días',
          description: 'Envió a domicilio',
          enabled: true,
        },
        {
          id: 'gba_correo_sucursal',
          name: 'Sucursal de Correo Argentino',
          price: 5200,
          deliveryTime: 'Llega 1 a 4 días',
          description: 'Retiro en la sucursal',
          enabled: true,
        },
      ],
    },
    pba_sf_cba: {
      id: 'pba_sf_cba',
      name: 'PBA Interior / Santa Fe / Córdoba',
      zoneLabel: 'Provincia de Buenos Aires / Santa Fe / Córdoba',
      description: 'Resto de Provincia de Bs As, Santa Fe y Córdoba',
      enabled: true,
      options: [
        {
          id: 'pba_sf_cba_correo_argentino',
          name: 'Correo Argentino (llega 1 a 4 días)',
          price: 9850,
          deliveryTime: 'Llega 1 a 4 días',
          description: 'Envió a domicilio',
          enabled: true,
        },
        {
          id: 'pba_sf_cba_correo_sucursal',
          name: 'Sucursal de Correo Argentino',
          price: 7850,
          deliveryTime: 'Llega 1 a 4 días',
          description: 'Retiro en la sucursal',
          enabled: true,
        },
      ],
    },
    resto_pais: {
      id: 'resto_pais',
      name: 'Interior del País',
      zoneLabel: 'Interior del País (Otras Provincias)',
      description: 'Resto de provincias de la República Argentina',
      enabled: true,
      options: [
        {
          id: 'resto_pais_correo_argentino',
          name: 'Correo Argentino (llega 1 a 4 días)',
          price: 13500,
          deliveryTime: 'Llega 1 a 4 días',
          description: 'Envió a domicilio',
          enabled: true,
        },
        {
          id: 'resto_pais_correo_sucursal',
          name: 'Sucursal de Correo Argentino',
          price: 10850,
          deliveryTime: 'Llega 1 a 4 días',
          description: 'Retiro en la sucursal',
          enabled: true,
        },
      ],
    },
  },
  customPostalCodeRules: [],
};

/**
 * Combina las opciones guardadas de una zona con las opciones por defecto para
 * garantizar que opciones nuevas como 'Sucursal de Correo Argentino' aparezcan siempre.
 */
export const mergeZoneOptions = (
  defaultOptions: ShippingOptionConfig[],
  savedOptions?: ShippingOptionConfig[]
): ShippingOptionConfig[] => {
  if (!Array.isArray(savedOptions) || savedOptions.length === 0) {
    return defaultOptions;
  }
  const result = [...savedOptions];
  for (const defOpt of defaultOptions) {
    const exists = result.some(
      (o) => o.id === defOpt.id || (o.name && o.name.toLowerCase().includes('sucursal'))
    );
    if (!exists) {
      result.push({ ...defOpt });
    }
  }
  return result;
};

/**
 * Obtiene la configuración de envíos actual desde localStorage,
 * con fallback a los valores predeterminados de la tienda.
 */
export const getShippingConfig = (): ShippingConfig => {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_SHIPPING_CONFIG) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.zones) {
        // Combinar con defaults para asegurar que no falten campos ni opciones nuevas
        return {
          ...DEFAULT_SHIPPING_CONFIG,
          ...parsed,
          zones: {
            caba: {
              ...DEFAULT_SHIPPING_CONFIG.zones.caba,
              ...parsed.zones.caba,
              options: mergeZoneOptions(
                DEFAULT_SHIPPING_CONFIG.zones.caba.options,
                parsed.zones.caba?.options
              ),
            },
            gba: {
              ...DEFAULT_SHIPPING_CONFIG.zones.gba,
              ...parsed.zones.gba,
              options: mergeZoneOptions(
                DEFAULT_SHIPPING_CONFIG.zones.gba.options,
                parsed.zones.gba?.options
              ),
            },
            pba_sf_cba: {
              ...DEFAULT_SHIPPING_CONFIG.zones.pba_sf_cba,
              ...parsed.zones.pba_sf_cba,
              options: mergeZoneOptions(
                DEFAULT_SHIPPING_CONFIG.zones.pba_sf_cba.options,
                parsed.zones.pba_sf_cba?.options
              ),
            },
            resto_pais: {
              ...DEFAULT_SHIPPING_CONFIG.zones.resto_pais,
              ...parsed.zones.resto_pais,
              options: mergeZoneOptions(
                DEFAULT_SHIPPING_CONFIG.zones.resto_pais.options,
                parsed.zones.resto_pais?.options
              ),
            },
          },
          customPostalCodeRules: Array.isArray(parsed.customPostalCodeRules)
            ? parsed.customPostalCodeRules
            : [],
        };
      }
    }
  } catch (e) {
    console.warn('Error leyendo configuración local de envíos:', e);
  }
  return { ...DEFAULT_SHIPPING_CONFIG };
};

/**
 * Guarda la configuración de envíos tanto en localStorage como en Supabase
 * y emite un evento para actualizar inmediatamente el Checkout y Compra Rápida.
 */
export const saveShippingConfig = async (
  config: Partial<ShippingConfig>
): Promise<ShippingConfig> => {
  requireAdminAuth('guardar configuración de envíos');
  const current = getShippingConfig();
  const updated: ShippingConfig = {
    ...current,
    ...config,
    lastUpdated: new Date().toISOString(),
  };

  try {
    localStorage.setItem(STORAGE_KEY_SHIPPING_CONFIG, JSON.stringify(updated));
  } catch (err) {
    console.error('Error guardando configuración de envíos en localStorage:', err);
  }

  // Notificar a componentes en tiempo real (Checkout, QuickBuy, etc.)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('my_commerce_shipping_config_updated', {
        detail: updated,
      })
    );
  }

  // Sincronizar en Supabase
  const supabase = getSupabase();
  if (isSupabaseConfigured() && supabase) {
    try {
      const { error } = await supabase.from('products').upsert({
        id: SYSTEM_SHIPPING_CONFIG_ROW_ID,
        title: '__SYSTEM_SHIPPING_CONFIG__',
        description: JSON.stringify(updated),
        category: '__system__',
        wholesale_price: 0,
        retail_price: 0,
        stock: 0,
        specs: [{ key: 'updated_at', value: updated.lastUpdated }],
      });
      if (error) {
        console.warn('Error sincronizando configuración de envíos en Supabase:', error.message);
      }
    } catch (e) {
      console.warn('Error de red sincronizando configuración de envíos en Supabase:', e);
    }
  }

  return updated;
};

let activeFetchShippingPromise: Promise<ShippingConfig> | null = null;
let cachedShippingConfig: ShippingConfig | null = null;
let lastShippingFetchTime = 0;
const SHIPPING_CACHE_TTL = 30000; // 30 segundos

/**
 * Consulta y sincroniza la configuración de envíos desde Supabase
 */
export const fetchShippingConfigFromSupabase = async (force = false): Promise<ShippingConfig> => {
  const now = Date.now();
  if (!force && cachedShippingConfig && (now - lastShippingFetchTime < SHIPPING_CACHE_TTL)) {
    return cachedShippingConfig;
  }

  if (activeFetchShippingPromise) {
    return activeFetchShippingPromise;
  }

  activeFetchShippingPromise = (async () => {
    const supabase = getSupabase();
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('description')
          .eq('id', SYSTEM_SHIPPING_CONFIG_ROW_ID)
          .maybeSingle();

        if (!error && (!data || !data.description)) {
          saveShippingConfig(DEFAULT_SHIPPING_CONFIG).catch(() => {});
        }

        if (!error && data && data.description) {
          try {
            const parsed = JSON.parse(data.description);
            if (parsed && parsed.zones) {
              const merged: ShippingConfig = {
                ...DEFAULT_SHIPPING_CONFIG,
                ...parsed,
                zones: {
                  caba: {
                    ...DEFAULT_SHIPPING_CONFIG.zones.caba,
                    ...parsed.zones.caba,
                    options: mergeZoneOptions(
                      DEFAULT_SHIPPING_CONFIG.zones.caba.options,
                      parsed.zones.caba?.options
                    ),
                  },
                  gba: {
                    ...DEFAULT_SHIPPING_CONFIG.zones.gba,
                    ...parsed.zones.gba,
                    options: mergeZoneOptions(
                      DEFAULT_SHIPPING_CONFIG.zones.gba.options,
                      parsed.zones.gba?.options
                    ),
                  },
                  pba_sf_cba: {
                    ...DEFAULT_SHIPPING_CONFIG.zones.pba_sf_cba,
                    ...parsed.zones.pba_sf_cba,
                    options: mergeZoneOptions(
                      DEFAULT_SHIPPING_CONFIG.zones.pba_sf_cba.options,
                      parsed.zones.pba_sf_cba?.options
                    ),
                  },
                  resto_pais: {
                    ...DEFAULT_SHIPPING_CONFIG.zones.resto_pais,
                    ...parsed.zones.resto_pais,
                    options: mergeZoneOptions(
                      DEFAULT_SHIPPING_CONFIG.zones.resto_pais.options,
                      parsed.zones.resto_pais?.options
                    ),
                  },
                },
                customPostalCodeRules: Array.isArray(parsed.customPostalCodeRules)
                  ? parsed.customPostalCodeRules
                  : [],
              };
              cachedShippingConfig = merged;
              lastShippingFetchTime = Date.now();
              localStorage.setItem(STORAGE_KEY_SHIPPING_CONFIG, JSON.stringify(merged));
              if (typeof window !== 'undefined') {
                window.dispatchEvent(
                  new CustomEvent('my_commerce_shipping_config_updated', {
                    detail: merged,
                  })
                );
              }
              return merged;
            }
          } catch (parseErr) {
            console.warn('Error parseando configuración remota de envíos:', parseErr);
          }
        }
      } catch (e) {
        console.warn('Error consultando configuración de envíos en Supabase:', e);
      }
    }
    const local = getShippingConfig();
    cachedShippingConfig = local;
    lastShippingFetchTime = Date.now();
    return local;
  })().finally(() => {
    activeFetchShippingPromise = null;
  });

  return activeFetchShippingPromise;
};

/**
 * Restablece la configuración de envíos a los valores iniciales por defecto
 */
export const resetShippingConfigToDefault = async (): Promise<ShippingConfig> => {
  return await saveShippingConfig(DEFAULT_SHIPPING_CONFIG);
};
