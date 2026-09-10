/**
 * Servicio de Configuración y Gestión del Enlace Personalizado de Compra Rápida
 */

export interface QuickBuyLinkConfig {
  id: string;
  token: string;
  paramName: string;
  isActive: boolean;
  whatsappUrl: string;
  createdAt: string;
  lastUpdated: string;
  totalOrdersCount: number;
}

const STORAGE_KEY = 'my_commerce_quick_buy_link_config';
const SESSION_ACTIVE_KEY = 'my_commerce_quick_buy_link_session_active';

const DEFAULT_CONFIG: QuickBuyLinkConfig = {
  id: 'quick_buy_wa',
  token: 'whatsapp',
  paramName: 'cr',
  isActive: true,
  whatsappUrl: 'https://wa.me/message/TSF5H4YUIQJOC1',
  createdAt: '2026-01-01T00:00:00.000Z',
  lastUpdated: '2026-01-01T00:00:00.000Z',
  totalOrdersCount: 0,
};

/**
 * Obtiene la configuración actual del enlace
 */
export const getQuickBuyLinkConfig = (): QuickBuyLinkConfig => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
      };
    }
  } catch (e) {
    console.warn('Error leyendo configuración de enlace rápido:', e);
  }
  return { ...DEFAULT_CONFIG };
};

/**
 * Guarda la configuración del enlace
 */
export const saveQuickBuyLinkConfig = (config: Partial<QuickBuyLinkConfig>): QuickBuyLinkConfig => {
  try {
    const current = getQuickBuyLinkConfig();
    const updated: QuickBuyLinkConfig = {
      ...current,
      ...config,
      lastUpdated: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    // Notificar a componentes en tiempo real
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('my_commerce_quick_buy_config_updated', {
          detail: updated,
        })
      );
    }
    return updated;
  } catch (e) {
    console.error('Error guardando configuración de enlace rápido:', e);
    return { ...DEFAULT_CONFIG, ...config } as QuickBuyLinkConfig;
  }
};

/**
 * Genera un nuevo token único aleatorio
 */
export const generateUniqueToken = (): string => {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let rand = '';
  for (let i = 0; i < 6; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `wa-${rand}`;
};

/**
 * Construye la URL completa del enlace, asegurando compatibilidad pública en cualquier navegador o móvil
 */
export const buildQuickBuyUrl = (customToken?: string, origin?: string): string => {
  const config = getQuickBuyLinkConfig();
  const token = customToken || config.token;
  let baseUrl = origin || (typeof window !== 'undefined' ? window.location.origin : '');

  // Si la URL actual es el dominio privado de desarrollo de AI Studio (ais-dev-),
  // convertir automáticamente al dominio público compartido (ais-pre-)
  // para que cualquier usuario o navegador (móvil, incógnito, desktop) pueda abrirlo sin requerir login ni dar error 403.
  if (baseUrl.includes('ais-dev-')) {
    baseUrl = baseUrl.replace('ais-dev-', 'ais-pre-');
  }

  const cleanBase = baseUrl.replace(/\/+$/, '');
  return `${cleanBase}/compra-rapida?${config.paramName || 'cr'}=${encodeURIComponent(token)}`;
};

/**
 * Determina si la URL o la sesión actual corresponden al acceso por enlace personalizado
 */
export const isQuickBuyCustomLinkActive = (search?: string): boolean => {
  const config = getQuickBuyLinkConfig();
  if (!config.isActive) return false;

  if (typeof window === 'undefined') return false;

  const searchParams = new URLSearchParams(search || window.location.search);
  const activeToken = config.token.toLowerCase().trim();
  const paramName = config.paramName || 'cr';

  // 1. Revisar si la URL actual tiene el parámetro configurado
  const queryVal = searchParams.get(paramName);
  const refVal = searchParams.get('ref');
  const linkVal = searchParams.get('link');
  const waVal = searchParams.get('wa');

  const matchesUrl =
    (queryVal && queryVal.toLowerCase().trim() === activeToken) ||
    (refVal && refVal.toLowerCase().trim() === activeToken) ||
    (linkVal && linkVal.toLowerCase().trim() === activeToken) ||
    (waVal && (waVal === '1' || waVal.toLowerCase().trim() === activeToken));

  if (matchesUrl) {
    // Guardar en la sesión de navegación para que persista mientras navega o recarga en esta pestaña
    try {
      sessionStorage.setItem(SESSION_ACTIVE_KEY, 'true');
    } catch (e) {}
    return true;
  }

  // 2. Si no viene en la URL de la página actual, verificar si la sesión previa lo activó
  try {
    const sessionActive = sessionStorage.getItem(SESSION_ACTIVE_KEY);
    if (sessionActive === 'true') {
      return true;
    }
  } catch (e) {}

  return false;
};

/**
 * Incrementa el contador de pedidos realizados por este enlace
 */
export const recordQuickBuyOrderPlaced = (): void => {
  try {
    const config = getQuickBuyLinkConfig();
    saveQuickBuyLinkConfig({
      totalOrdersCount: (config.totalOrdersCount || 0) + 1,
    });
  } catch (e) {}
};

/**
 * Número telefónico oficial de WhatsApp de la importadora (WhatsApp Business)
 */
export const DEFAULT_WHATSAPP_PHONE = '5491166904678';

/**
 * Resuelve y normaliza el número de WhatsApp a partir de una URL o cadena configurada.
 * Si detecta el enlace corto conocido de la empresa (TSF5H4YUIQJOC1), lo mapea al número telefónico real (5491166904678).
 */
export const resolveWhatsAppPhone = (inputUrlOrPhone?: string): string => {
  if (!inputUrlOrPhone) return DEFAULT_WHATSAPP_PHONE;

  const trimmed = inputUrlOrPhone.trim();

  // El shortcode /message/TSF5H4YUIQJOC1 es el enlace de WhatsApp Business de MY Importadora, cuyo número es 5491166904678
  if (trimmed.includes('TSF5H4YUIQJOC1')) {
    return DEFAULT_WHATSAPP_PHONE;
  }

  // Extraer cualquier secuencia de dígitos
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length >= 8) {
    if (digits.startsWith('549')) return digits;
    if (digits.startsWith('54')) return `549${digits.slice(2)}`;
    if (digits.startsWith('11') && digits.length === 10) return `549${digits}`;
    if (digits.startsWith('911') && digits.length === 11) return `54${digits}`;
    return digits;
  }

  return DEFAULT_WHATSAPP_PHONE;
};

/**
 * Construye la URL oficial y universal de WhatsApp con el mensaje codificado correctamente.
 * Compatible al 100% con Android, iPhone (iOS Safari / Universal Links), Windows, Mac y WhatsApp Web.
 * Evita la pérdida del parámetro de texto (?text=) que provocaba el enlace corto /message/TSF5H4YUIQJOC1.
 */
export const buildUniversalWhatsAppUrl = (
  message: string,
  customWaDestination?: string
): string => {
  const phone = resolveWhatsAppPhone(customWaDestination);
  const encodedText = encodeURIComponent(message);

  // La API oficial de WhatsApp (api.whatsapp.com/send) es el estándar universal que abre directamente
  // la conversación con el texto prellenado en todas las plataformas (móvil y web) sin descartar parámetros.
  return `https://api.whatsapp.com/send?phone=${phone}&text=${encodedText}`;
};

export const buildQuickBuyWhatsAppUrl = (
  message: string,
  customWaDestination?: string
): string => {
  const config = getQuickBuyLinkConfig();
  const destination = customWaDestination || config.whatsappUrl;
  return buildUniversalWhatsAppUrl(message, destination);
};

/**
 * Normaliza el texto de variantes para que se muestre separado por coma y espacio ("Negro, L, 13mm")
 */
export const normalizeVariantText = (variantText?: string): string => {
  if (!variantText) return '';
  const parts = variantText
    .split(/[/•|,]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const uniqueParts: string[] = [];
  parts.forEach((p) => {
    if (!uniqueParts.some((u) => u.toLowerCase() === p.toLowerCase())) {
      uniqueParts.push(p);
    }
  });
  return uniqueParts.join(', ');
};

/**
 * Formatea el mensaje de WhatsApp conforme a la estructura requerida:
 * - Inicia con *Pedido #1001*
 * - *Detalle de productos:* con viñeta • por título de producto y cada variante en su línea (1x Variante - $ Precio)
 * - *Total:* $ Importe
 * - *Método de pago:* Efectivo / Transferencia
 * - *Entrega:* Retiro en el local (Flores) / Envío a coordinar
 * - Mensaje final de coordinación
 */
export const buildQuickBuyWhatsAppMessage = (params: {
  orderNumber: string;
  items: Array<{
    title: string;
    quantity: number;
    variantText?: string;
    unitPrice: number;
    totalPrice?: number;
  }>;
  total: number;
  deliveryOption?: 'pickup' | 'delivery';
  paymentMethod?: 'transfer' | 'cash';
}): string => {
  const { orderNumber, items, total, deliveryOption, paymentMethod } = params;

  const lines: string[] = [];

  // 1. Inicia con el número de pedido
  lines.push(`*Pedido #${orderNumber}*`);
  lines.push('');

  // 2. Detalle de productos agrupados por título con sus variantes
  lines.push('*Detalle de productos:*');
  if (items && items.length > 0) {
    const groups: Array<{ title: string; items: typeof items }> = [];
    items.forEach((item) => {
      const cleanTitle = (item.title || 'Producto').trim();
      let existingGroup = groups.find(
        (g) => g.title.toLowerCase() === cleanTitle.toLowerCase()
      );
      if (!existingGroup) {
        existingGroup = { title: cleanTitle, items: [] };
        groups.push(existingGroup);
      }
      existingGroup.items.push(item);
    });

    groups.forEach((group) => {
      lines.push(`•${group.title}`);
      group.items.forEach((item) => {
        const itemTotal = item.totalPrice ?? item.unitPrice * item.quantity;
        const formattedPrice = Math.round(itemTotal).toLocaleString('es-AR');
        const cleanVariant = normalizeVariantText(item.variantText);
        if (cleanVariant) {
          lines.push(`${item.quantity}x ${cleanVariant} - $ ${formattedPrice}`);
        } else {
          lines.push(`${item.quantity}x - $ ${formattedPrice}`);
        }
      });
    });
  } else {
    lines.push('•(Sin productos)');
  }
  lines.push('');

  // 3. Total general del pedido
  lines.push(`*Total:* $ ${Math.round(total).toLocaleString('es-AR')}`);

  // 4. Método de pago
  if (paymentMethod) {
    const paymentText =
      paymentMethod === 'cash'
        ? 'Efectivo'
        : 'Transferencia Bancaria';
    lines.push(`*Método de pago:* ${paymentText}`);
  }

  // 5. Entrega
  if (deliveryOption) {
    const deliveryText =
      deliveryOption === 'pickup'
        ? 'Retiro en el local (Flores)'
        : 'Envío a coordinar';
    lines.push(`*Entrega:* ${deliveryText}`);
  }

  lines.push('');
  lines.push('Hola buenas, te paso mi pedido por la pagina *MY* para coordinar el pago y la entrega. ¡Muchas gracias!');

  return lines.join('\n');
};
