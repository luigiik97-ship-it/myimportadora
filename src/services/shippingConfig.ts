import { getSupabase, isSupabaseConfigured } from './supabase';

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
          description: 'Envío a domicilio por Correo Argentino',
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
          description: 'Envío a domicilio por Correo Argentino',
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
          description: 'Envío a domicilio por Correo Argentino',
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
          description: 'Envío a domicilio por Correo Argentino',
          enabled: true,
        },
      ],
    },
  },
  customPostalCodeRules: [],
};

/**
 * Obtiene la configuración de envíos actual desde localStorage,
 * con fallback a los valores predeterminados de la tienda.
 */
export const getShippingConfig = (): ShippingConfig => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SHIPPING_CONFIG);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.zones) {
        // Combinar con defaults para asegurar que no falten campos
        return {
          ...DEFAULT_SHIPPING_CONFIG,
          ...parsed,
          zones: {
            caba: { ...DEFAULT_SHIPPING_CONFIG.zones.caba, ...parsed.zones.caba },
            gba: { ...DEFAULT_SHIPPING_CONFIG.zones.gba, ...parsed.zones.gba },
            pba_sf_cba: { ...DEFAULT_SHIPPING_CONFIG.zones.pba_sf_cba, ...parsed.zones.pba_sf_cba },
            resto_pais: { ...DEFAULT_SHIPPING_CONFIG.zones.resto_pais, ...parsed.zones.resto_pais },
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

/**
 * Consulta y sincroniza la configuración de envíos desde Supabase
 */
export const fetchShippingConfigFromSupabase = async (): Promise<ShippingConfig> => {
  const supabase = getSupabase();
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('description')
        .eq('id', SYSTEM_SHIPPING_CONFIG_ROW_ID)
        .maybeSingle();

      if (!error && data && data.description) {
        try {
          const parsed = JSON.parse(data.description);
          if (parsed && parsed.zones) {
            const merged: ShippingConfig = {
              ...DEFAULT_SHIPPING_CONFIG,
              ...parsed,
              zones: {
                caba: { ...DEFAULT_SHIPPING_CONFIG.zones.caba, ...parsed.zones.caba },
                gba: { ...DEFAULT_SHIPPING_CONFIG.zones.gba, ...parsed.zones.gba },
                pba_sf_cba: { ...DEFAULT_SHIPPING_CONFIG.zones.pba_sf_cba, ...parsed.zones.pba_sf_cba },
                resto_pais: { ...DEFAULT_SHIPPING_CONFIG.zones.resto_pais, ...parsed.zones.resto_pais },
              },
              customPostalCodeRules: Array.isArray(parsed.customPostalCodeRules)
                ? parsed.customPostalCodeRules
                : [],
            };
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
  return getShippingConfig();
};

/**
 * Restablece la configuración de envíos a los valores iniciales por defecto
 */
export const resetShippingConfigToDefault = async (): Promise<ShippingConfig> => {
  return await saveShippingConfig(DEFAULT_SHIPPING_CONFIG);
};
