import {
  getShippingConfig,
  ShippingConfig,
  ShippingOptionConfig,
  ShippingZoneId,
} from '../services/shippingConfig';

export interface ShippingOption {
  id: string;
  name: string;
  price: number;
  deliveryTime: string;
  description: string;
  enabled?: boolean;
}

export type ShippingZone = 'caba' | 'gba' | 'pba_sf_cba' | 'resto_pais';

export interface ShippingZoneInfo {
  zone: ShippingZone;
  zoneLabel: string;
  options: ShippingOption[];
}

/**
 * Determina las opciones de envío disponibles y sus tarifas vigentes
 * según el Código Postal, Provincia y Ciudad ingresados por el usuario,
 * consultando la configuración central administrada.
 */
export const getShippingZoneInfo = (
  postalCode: string,
  province: string = '',
  city: string = '',
  customConfig?: ShippingConfig
): ShippingZoneInfo | null => {
  const cleanCp = (postalCode || '').trim().toUpperCase();
  const cpDigits = cleanCp.replace(/\D/g, '');
  const num = parseInt(cpDigits, 10);

  const cleanProvince = (province || '').trim().toLowerCase();
  const cleanCity = (city || '').trim().toLowerCase();

  // Si no hay dígitos de CP ni provincia/ciudad, retorna null
  if (!cleanCp && !cleanProvince && !cleanCity) {
    return null;
  }

  const config = customConfig || getShippingConfig();

  // 0. Reglas personalizadas específicas por Código Postal (Overrides del administrador)
  if (config.customPostalCodeRules && config.customPostalCodeRules.length > 0) {
    const matchedRule = config.customPostalCodeRules.find(
      (r) =>
        r.postalCode.trim().toUpperCase() === cleanCp ||
        (cpDigits && r.postalCode.trim().replace(/\D/g, '') === cpDigits)
    );

    if (matchedRule && matchedRule.options && matchedRule.options.length > 0) {
      const activeOptions = matchedRule.options.filter((o) => o.enabled !== false);
      if (activeOptions.length > 0) {
        return {
          zone: 'caba', // default zone anchor
          zoneLabel: matchedRule.zoneLabel || `Tarifa especial CP ${cleanCp}`,
          options: activeOptions.map((o) => ({
            id: o.id,
            name: o.name,
            price: Number(o.price) || 0,
            deliveryTime: o.deliveryTime || '',
            description: o.description || '',
          })),
        };
      }
    }
  }

  // 1. CABA (Capital Federal) - CPs 1000 a 1499
  const cabaZone = config.zones.caba;
  const minCaba = cabaZone.minPostalCode ?? 1000;
  const maxCaba = cabaZone.maxPostalCode ?? 1499;

  const isCabaByCp = !isNaN(num) && num >= minCaba && num <= maxCaba;
  const isCabaByText =
    cleanProvince.includes('caba') ||
    cleanProvince.includes('capital federal') ||
    cleanProvince.includes('buenos aires (caba)') ||
    cleanCity.includes('caba') ||
    cleanCity.includes('capital federal') ||
    cleanCp.startsWith('C1');

  if (isCabaByCp || isCabaByText) {
    const activeOptions = cabaZone.options.filter((o) => o.enabled !== false);
    return {
      zone: 'caba',
      zoneLabel: cabaZone.zoneLabel || 'CABA (Ciudad Autónoma de Buenos Aires)',
      options: activeOptions.map((o) => ({
        id: o.id,
        name: o.name,
        price: Number(o.price) || 0,
        deliveryTime: o.deliveryTime,
        description: o.description,
      })),
    };
  }

  // 2. Gran Buenos Aires (primer y segundo cordón) - CPs 1600 a 1899
  const gbaZone = config.zones.gba;
  const minGba = gbaZone.minPostalCode ?? 1600;
  const maxGba = gbaZone.maxPostalCode ?? 1899;

  const isGbaByCp = !isNaN(num) && num >= minGba && num <= maxGba;
  const isGbaByText =
    cleanCp.startsWith('B16') ||
    cleanCp.startsWith('B17') ||
    cleanCp.startsWith('B18');

  if (isGbaByCp || isGbaByText) {
    const activeOptions = gbaZone.options.filter((o) => o.enabled !== false);
    return {
      zone: 'gba',
      zoneLabel: gbaZone.zoneLabel || 'Gran Buenos Aires (1er y 2do cordón)',
      options: activeOptions.map((o) => ({
        id: o.id,
        name: o.name,
        price: Number(o.price) || 0,
        deliveryTime: o.deliveryTime,
        description: o.description,
      })),
    };
  }

  // 3. Resto de la provincia de Buenos Aires, provincia de Santa Fe y provincia de Córdoba
  const isPbaResto =
    (!isNaN(num) &&
      ((num >= 1900 && num <= 1999) ||
        (num >= 2700 && num <= 2999) ||
        (num >= 6000 && num <= 8199))) ||
    cleanProvince.includes('buenos aires') ||
    cleanCp.startsWith('B');

  const isSantaFe =
    (!isNaN(num) &&
      ((num >= 2000 && num <= 2699) || (num >= 3000 && num <= 3099))) ||
    cleanProvince.includes('santa fe') ||
    cleanCp.startsWith('S');

  const isCordoba =
    (!isNaN(num) && num >= 5000 && num <= 5999) ||
    cleanProvince.includes('cordoba') ||
    cleanProvince.includes('córdoba') ||
    cleanCp.startsWith('X');

  if (isPbaResto || isSantaFe || isCordoba) {
    const pbaZone = config.zones.pba_sf_cba;
    let zoneName = pbaZone.zoneLabel || 'Provincia de Buenos Aires / Santa Fe / Córdoba';
    if (isSantaFe) zoneName = 'Provincia de Santa Fe';
    else if (isCordoba) zoneName = 'Provincia de Córdoba';
    else if (isPbaResto) zoneName = 'Resto de Provincia de Buenos Aires';

    const activeOptions = pbaZone.options.filter((o) => o.enabled !== false);
    return {
      zone: 'pba_sf_cba',
      zoneLabel: zoneName,
      options: activeOptions.map((o) => ({
        id: o.id,
        name: o.name,
        price: Number(o.price) || 0,
        deliveryTime: o.deliveryTime,
        description: o.description,
      })),
    };
  }

  // 4. Resto de provincias que no se mencionaron
  if (cpDigits.length >= 3 || cleanCp.length >= 3 || cleanProvince.length >= 3) {
    const restoZone = config.zones.resto_pais;
    const activeOptions = restoZone.options.filter((o) => o.enabled !== false);
    return {
      zone: 'resto_pais',
      zoneLabel: restoZone.zoneLabel || 'Interior del País (Otras Provincias)',
      options: activeOptions.map((o) => ({
        id: o.id,
        name: o.name,
        price: Number(o.price) || 0,
        deliveryTime: o.deliveryTime,
        description: o.description,
      })),
    };
  }

  return null;
};
