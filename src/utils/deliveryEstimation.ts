import {
  ShippingCutoffTimes,
  DEFAULT_CUTOFF_TIMES,
} from '../services/shippingConfig';

export interface DeliveryTimelineStep {
  label: string; // 'Compra' | 'Envío' | 'Entrega'
  iconEmoji: string; // '🛍️' | '🛵' | '✓'
  statusText: string; // 'Hoy', 'Mañana', '20 de octubre', etc.
  subtext?: string;
}

export interface DeliveryTimelineData {
  steps: DeliveryTimelineStep[];
  headlineSummary: string; // e.g. "Llega mañana" o "Llega del 20 al 23 de octubre"
  cutoffTimeApplied: string;
  isPastCutoff: boolean;
  methodLabel: string;
}

const MONTH_NAMES_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

const DAY_NAMES_ES = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
];

/**
 * Obtiene la fecha y hora actual en la zona horaria oficial de Argentina (UTC-3).
 */
export function getArgentinaNow(customDate?: Date): Date {
  const base = customDate || new Date();
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
    });
    const parts = formatter.formatToParts(base);
    const m: Record<string, number> = {};
    for (const p of parts) {
      if (p.type !== 'literal') {
        m[p.type] = parseInt(p.value, 10);
      }
    }
    return new Date(m.year, m.month - 1, m.day, m.hour, m.minute, m.second);
  } catch {
    // Fallback restando 3 horas si Intl falla
    const utc = base.getTime() + base.getTimezoneOffset() * 60000;
    return new Date(utc - 3 * 3600000);
  }
}

/**
 * Suma días hábiles/laborables de entrega de lunes a sábado (excluyendo domingos).
 */
export function addActiveDispatchDays(startDate: Date, daysToAdd: number): Date {
  const result = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  let added = 0;
  while (added < daysToAdd) {
    result.setDate(result.getDate() + 1);
    // 0 = Domingo (se excluye)
    if (result.getDay() !== 0) {
      added++;
    }
  }
  return result;
}

/**
 * Avanza una fecha al siguiente día habilitado para despacho (lunes a sábado, excluyendo domingos).
 */
export function getNextActiveDispatchDay(startDate: Date): Date {
  const result = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  result.setDate(result.getDate() + 1);
  while (result.getDay() === 0) {
    result.setDate(result.getDate() + 1);
  }
  return result;
}

/**
 * Formatea una fecha en formato natural argentino: "20 de octubre"
 */
export function formatCalendarDate(d: Date, includeDayName = false): string {
  const dayNum = d.getDate();
  const monthName = MONTH_NAMES_ES[d.getMonth()] || '';
  if (includeDayName) {
    const dayName = DAY_NAMES_ES[d.getDay()] || '';
    return `${dayName} ${dayNum} de ${monthName}`;
  }
  return `${dayNum} de ${monthName}`;
}

/**
 * Detecta qué clave de horario de corte corresponde a la opción de envío.
 */
export function resolveMethodCutoffKey(
  methodId = '',
  methodName = ''
): keyof ShippingCutoffTimes {
  const s = `${methodId} ${methodName}`.toLowerCase();
  if (s.includes('uber') || s.includes('moto')) {
    return 'uber_moto';
  }
  if (s.includes('flex')) {
    return 'envio_flex';
  }
  if (s.includes('sucursal')) {
    return 'correo_sucursal';
  }
  if (s.includes('correo') || s.includes('argentino')) {
    return 'correo_argentino';
  }
  return 'envio_flex';
}

/**
 * Convierte los plazos de envío (ej. "Llega hoy", "Llega mañana", "Llega 1 a 4 días")
 * en una línea de tiempo informativa de 3 etapas inspirada en Rappi/PedidosYa:
 * 🛍️ Compra → 🛵 Envío → ✓ Entrega
 */
export function calculateDeliveryTimeline(
  shippingOption: { id?: string; name?: string; deliveryTime?: string },
  cutoffTimes?: Partial<ShippingCutoffTimes>,
  nowInArgentina?: Date
): DeliveryTimelineData {
  const now = getArgentinaNow(nowInArgentina);
  const cutoffKey = resolveMethodCutoffKey(shippingOption.id, shippingOption.name);
  const effectiveCutoff = cutoffTimes?.[cutoffKey] || DEFAULT_CUTOFF_TIMES[cutoffKey] || '14:00';

  const [cutoffH, cutoffM] = effectiveCutoff.split(':').map((x) => parseInt(x, 10) || 0);
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  const isSunday = now.getDay() === 0;
  const isPastCutoff =
    isSunday || currentHour > cutoffH || (currentHour === cutoffH && currentMinute >= cutoffM);

  // 1. ETAPA DE COMPRA
  const buyStep: DeliveryTimelineStep = {
    label: 'Compra',
    iconEmoji: '🛍️',
    statusText: 'Hoy',
  };

  // 2. ETAPA DE DESPACHO / ENVÍO
  let dispatchDate: Date;
  let dispatchStatusText = 'Hoy';

  if (!isPastCutoff) {
    // Pedido realizado dentro de la ventana horaria hábil de hoy
    dispatchDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    dispatchStatusText = 'Hoy';
  } else {
    // Pedido realizado después del corte o en domingo: se despacha el siguiente día hábil
    dispatchDate = getNextActiveDispatchDay(now);

    // Si el siguiente día hábil es mañana
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    if (
      dispatchDate.getDate() === tomorrow.getDate() &&
      dispatchDate.getMonth() === tomorrow.getMonth()
    ) {
      dispatchStatusText = 'Mañana';
    } else {
      const dayName = DAY_NAMES_ES[dispatchDate.getDay()];
      const capitalized = dayName.charAt(0).toUpperCase() + dayName.slice(1);
      dispatchStatusText = `${capitalized} ${dispatchDate.getDate()}`;
    }
  }

  const shipStep: DeliveryTimelineStep = {
    label: 'Envío',
    iconEmoji: '🛵',
    statusText: dispatchStatusText,
  };

  // 3. ETAPA DE ENTREGA ESTIMADA
  const rawText = `${shippingOption.deliveryTime || ''} ${shippingOption.name || ''}`.toLowerCase();
  let deliveryStatusText = '';
  let headline = '';

  const isSameDayMethod = rawText.includes('llega hoy') || rawText.includes('en el día');
  const isNextDayMethod = rawText.includes('llega mañana') || rawText.includes('mañana');

  // Buscar rango de días (ej. "1 a 4 días", "1 a 3 días", "2 a 5 días", etc.)
  const rangeMatch = rawText.match(/(\d+)\s*a\s*(\d+)\s*d[ií]as/);
  const singleDayMatch = !rangeMatch ? rawText.match(/(\d+)\s*d[ií]as/) : null;

  if (isSameDayMethod) {
    // Método en el día (ej. Uber Moto)
    if (!isPastCutoff) {
      deliveryStatusText = 'Hoy';
      headline = 'Llega hoy';
    } else {
      // Pasado el corte, llega en el próximo día de despacho
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      if (
        dispatchDate.getDate() === tomorrow.getDate() &&
        dispatchDate.getMonth() === tomorrow.getMonth()
      ) {
        deliveryStatusText = 'Mañana';
        headline = 'Llega mañana';
      } else {
        deliveryStatusText = formatCalendarDate(dispatchDate);
        headline = `Llega el ${formatCalendarDate(dispatchDate)}`;
      }
    }
  } else if (isNextDayMethod) {
    // Método que llega al día siguiente del despacho (ej. Envío Flex)
    const arrivalDate = addActiveDispatchDays(dispatchDate, 1);
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    if (
      arrivalDate.getDate() === tomorrow.getDate() &&
      arrivalDate.getMonth() === tomorrow.getMonth()
    ) {
      deliveryStatusText = 'Mañana';
      headline = 'Llega mañana';
    } else {
      deliveryStatusText = formatCalendarDate(arrivalDate);
      headline = `Llega el ${formatCalendarDate(arrivalDate)}`;
    }
  } else if (rangeMatch || singleDayMatch) {
    // Método por correo / transporte con rango o cantidad de días
    const minDays = rangeMatch
      ? parseInt(rangeMatch[1], 10) || 1
      : parseInt(singleDayMatch![1], 10) || 1;
    const maxDays = rangeMatch
      ? parseInt(rangeMatch[2], 10) || minDays
      : minDays;

    const minArrival = addActiveDispatchDays(dispatchDate, minDays);
    const maxArrival = addActiveDispatchDays(dispatchDate, maxDays);

    if (
      minArrival.getDate() === maxArrival.getDate() &&
      minArrival.getMonth() === maxArrival.getMonth()
    ) {
      deliveryStatusText = formatCalendarDate(minArrival);
      headline = `Llega el ${formatCalendarDate(minArrival)}`;
    } else if (minArrival.getMonth() === maxArrival.getMonth()) {
      const monthName = MONTH_NAMES_ES[minArrival.getMonth()];
      deliveryStatusText = `${minArrival.getDate()} al ${maxArrival.getDate()} de ${monthName}`;
      headline = `Llega del ${minArrival.getDate()} al ${maxArrival.getDate()} de ${monthName}`;
    } else {
      const m1 = MONTH_NAMES_ES[minArrival.getMonth()];
      const m2 = MONTH_NAMES_ES[maxArrival.getMonth()];
      deliveryStatusText = `${minArrival.getDate()} de ${m1} al ${maxArrival.getDate()} de ${m2}`;
      headline = `Llega del ${minArrival.getDate()} de ${m1} al ${maxArrival.getDate()} de ${m2}`;
    }
  } else {
    // Si falta información para calcular una fecha confiable, mostrar el plazo original
    deliveryStatusText =
      shippingOption.deliveryTime || shippingOption.name || 'Fecha a coordinar';
    headline = deliveryStatusText;
  }

  const deliveryStep: DeliveryTimelineStep = {
    label: 'Entrega',
    iconEmoji: '✓',
    statusText: deliveryStatusText,
  };

  const friendlyMethodNames: Record<keyof ShippingCutoffTimes, string> = {
    uber_moto: 'Uber Moto',
    envio_flex: 'Envío Flex',
    correo_argentino: 'Correo Argentino (Domicilio)',
    correo_sucursal: 'Correo Argentino (Sucursal)',
  };

  return {
    steps: [buyStep, shipStep, deliveryStep],
    headlineSummary: headline,
    cutoffTimeApplied: effectiveCutoff,
    isPastCutoff,
    methodLabel: friendlyMethodNames[cutoffKey],
  };
}
