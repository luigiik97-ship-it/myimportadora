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
 * Construye la URL completa del enlace
 */
export const buildQuickBuyUrl = (customToken?: string, origin?: string): string => {
  const config = getQuickBuyLinkConfig();
  const token = customToken || config.token;
  const baseUrl = origin || (typeof window !== 'undefined' ? window.location.origin : '');
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
 * Formatea el mensaje de WhatsApp conforme a los requerimientos:
 * - Comienza con el número de pedido
 * - Sigue con el listado completo de productos y cantidades
 * - Incluye el total
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

  // 1. Inicia estrictamente con el número de pedido
  lines.push(`*Pedido #${orderNumber}*`);
  lines.push('');

  // 2. Listado completo de productos, variantes y cantidades
  lines.push('*Detalle de productos:*');
  items.forEach((item) => {
    const variantDesc = item.variantText ? ` (${item.variantText})` : '';
    const itemTotal = item.totalPrice ?? item.unitPrice * item.quantity;
    lines.push(`• ${item.quantity}x ${item.title}${variantDesc} - $ ${itemTotal.toLocaleString('es-AR')}`);
  });
  lines.push('');

  // 3. Total general
  lines.push(`*Total:* $ ${total.toLocaleString('es-AR')}`);

  // 4. Datos adicionales de método de entrega y pago
  if (deliveryOption) {
    const deliveryText = deliveryOption === 'pickup' ? 'Retiro en local' : 'Envío a domicilio';
    lines.push(`*Entrega:* ${deliveryText}`);
  }
  if (paymentMethod) {
    const paymentText = paymentMethod === 'cash' ? 'Efectivo' : 'Transferencia Bancaria';
    lines.push(`*Método de pago:* ${paymentText}`);
  }

  lines.push('');
  lines.push('Hola, te paso el pedido generado desde la tienda para coordinar el pago y la entrega. ¡Muchas gracias!');

  return lines.join('\n');
};
