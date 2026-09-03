export interface ShippingOption {
  id: string;
  name: string;
  price: number;
  deliveryTime: string;
  description: string;
}

export type ShippingZone = 'caba' | 'gba' | 'pba_sf_cba' | 'resto_pais';

export interface ShippingZoneInfo {
  zone: ShippingZone;
  zoneLabel: string;
  options: ShippingOption[];
}

export const getShippingZoneInfo = (
  postalCode: string,
  province: string = '',
  city: string = ''
): ShippingZoneInfo | null => {
  const cleanCp = (postalCode || '').trim().toUpperCase();
  const cpDigits = cleanCp.replace(/\D/g, '');
  const num = parseInt(cpDigits, 10);

  const cleanProvince = (province || '').trim().toLowerCase();
  const cleanCity = (city || '').trim().toLowerCase();

  // If no CP digits and no province/city, return null
  if (!cleanCp && !cleanProvince && !cleanCity) {
    return null;
  }

  // 1. CABA (Capital Federal) - CPs 1000 a 1499
  const isCabaByCp = !isNaN(num) && num >= 1000 && num <= 1499;
  const isCabaByText =
    cleanProvince.includes('caba') ||
    cleanProvince.includes('capital federal') ||
    cleanProvince.includes('buenos aires (caba)') ||
    cleanCity.includes('caba') ||
    cleanCity.includes('capital federal') ||
    cleanCp.startsWith('C1');

  if (isCabaByCp || isCabaByText) {
    return {
      zone: 'caba',
      zoneLabel: 'CABA (Ciudad Autónoma de Buenos Aires)',
      options: [
        {
          id: 'caba_uber_moto',
          name: 'Uber Moto (llega hoy)',
          price: 7950,
          deliveryTime: 'Llega hoy',
          description: 'Entrega en el día en moto',
        },
        {
          id: 'caba_envio_flex',
          name: 'Envío Flex (llega mañana)',
          price: 7150,
          deliveryTime: 'Llega mañana',
          description: 'Reparto express a tu puerta',
        },
        {
          id: 'caba_correo_argentino',
          name: 'Correo Argentino (llega 1 a 4 días)',
          price: 6520,
          deliveryTime: 'Llega 1 a 4 días',
          description: 'Envío a domicilio por Correo Argentino',
        },
      ],
    };
  }

  // 2. Gran Buenos Aires (primer y segundo cordón) - CPs 1600 a 1899
  const isGbaByCp = !isNaN(num) && num >= 1600 && num <= 1899;
  const isGbaByText =
    cleanCp.startsWith('B16') ||
    cleanCp.startsWith('B17') ||
    cleanCp.startsWith('B18');

  if (isGbaByCp || isGbaByText) {
    return {
      zone: 'gba',
      zoneLabel: 'Gran Buenos Aires (1er y 2do cordón)',
      options: [
        {
          id: 'gba_envio_flex',
          name: 'Envío Flex (llega mañana)',
          price: 10250,
          deliveryTime: 'Llega mañana',
          description: 'Reparto express a domicilio en Gran Buenos Aires',
        },
        {
          id: 'gba_correo_argentino',
          name: 'Correo Argentino (llega 1 a 4 días)',
          price: 6520,
          deliveryTime: 'Llega 1 a 4 días',
          description: 'Envío a domicilio por Correo Argentino',
        },
      ],
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
    let zoneName = 'Provincia de Buenos Aires / Santa Fe / Córdoba';
    if (isSantaFe) zoneName = 'Provincia de Santa Fe';
    else if (isCordoba) zoneName = 'Provincia de Córdoba';
    else if (isPbaResto) zoneName = 'Resto de Provincia de Buenos Aires';

    return {
      zone: 'pba_sf_cba',
      zoneLabel: zoneName,
      options: [
        {
          id: 'pba_sf_cba_correo_argentino',
          name: 'Correo Argentino (llega 1 a 4 días)',
          price: 9850,
          deliveryTime: 'Llega 1 a 4 días',
          description: 'Envío a domicilio por Correo Argentino',
        },
      ],
    };
  }

  // 4. Resto de provincias que no se mencionaron
  if (cpDigits.length >= 3 || cleanCp.length >= 3 || cleanProvince.length >= 3) {
    return {
      zone: 'resto_pais',
      zoneLabel: 'Interior del País (Otras Provincias)',
      options: [
        {
          id: 'resto_pais_correo_argentino',
          name: 'Correo Argentino (llega 1 a 4 días)',
          price: 13500,
          deliveryTime: 'Llega 1 a 4 días',
          description: 'Envío a domicilio por Correo Argentino',
        },
      ],
    };
  }

  return null;
};
