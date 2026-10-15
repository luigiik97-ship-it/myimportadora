import { getSupabase, isSupabaseConfigured, safeLocalStorageSet } from './supabase';
import { StockNotification } from '../types';
import { isAdminAuthenticated } from './adminAuth';

const LOCAL_STOCK_NOTIFICATIONS_KEY = 'my_commerce_stock_notifications';

/**
 * Recupera las notificaciones locales guardadas en caché / fallback offline.
 */
export const getLocalStockNotifications = (): StockNotification[] => {
  try {
    const raw = localStorage.getItem(LOCAL_STOCK_NOTIFICATIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Error al leer avisos de stock locales:', e);
  }
  return [];
};

/**
 * Guarda el array de notificaciones en almacenamiento local.
 */
export const saveLocalStockNotifications = (items: StockNotification[]) => {
  safeLocalStorageSet(LOCAL_STOCK_NOTIFICATIONS_KEY, JSON.stringify(items));
};

/**
 * Limpia y normaliza un número de teléfono o WhatsApp eliminando caracteres no numéricos.
 */
export const sanitizePhoneNumber = (phone: string): string => {
  if (!phone) return '';
  return phone.replace(/[^\d+]/g, '').trim();
};

/**
 * Da formato estándar para enviar enlace a WhatsApp (wa.me/{phone}).
 * Agrega código de país 549 (Argentina) si es un número móvil nacional de 10 dígitos.
 */
export const formatWhatsAppLink = (phone: string, message: string): string => {
  let clean = phone.replace(/\D/g, '');
  if (clean.startsWith('0')) {
    clean = clean.substring(1);
  }
  if (!clean.startsWith('54') && clean.length === 10) {
    clean = `549${clean}`;
  } else if (clean.startsWith('54') && !clean.startsWith('549') && clean.length === 12) {
    clean = `549${clean.substring(2)}`;
  }
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
};

/**
 * Registra una nueva solicitud de "Avísame cuando esté disponible".
 * - Valida teléfono.
 * - Evita duplicados innecesarios para el mismo contacto y variante.
 * - Guarda en Supabase bajo RLS público para INSERT.
 * - Guarda copia en caché local.
 */
export const registerStockNotification = async (params: {
  productId: string;
  productTitle: string;
  variantId?: string;
  variantName: string;
  phone: string;
  customerName?: string;
  userId?: string;
}): Promise<{ success: boolean; alreadyRegistered?: boolean; error?: string }> => {
  const cleanPhone = sanitizePhoneNumber(params.phone);
  if (!cleanPhone || cleanPhone.replace(/\D/g, '').length < 6) {
    return { success: false, error: 'Por favor ingresá un número de teléfono válido.' };
  }

  const localList = getLocalStockNotifications();

  // Comprobar si ya existe una solicitud pendiente idéntica para este teléfono y variante
  const isDuplicate = localList.some(
    (item) =>
      item.productId === params.productId &&
      item.variantName.toLowerCase().trim() === params.variantName.toLowerCase().trim() &&
      item.phone.replace(/\D/g, '') === cleanPhone.replace(/\D/g, '') &&
      item.status === 'pending'
  );

  if (isDuplicate) {
    return {
      success: true,
      alreadyRegistered: true,
    };
  }

  const now = new Date().toISOString();
  const newNotification: StockNotification = {
    id: `sn_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    productId: params.productId,
    productTitle: params.productTitle,
    variantId: params.variantId,
    variantName: params.variantName,
    phone: cleanPhone,
    customerName: params.customerName?.trim() || undefined,
    userId: params.userId || undefined,
    status: 'pending',
    createdAt: now,
  };

  // Guardar en Supabase si está disponible
  const supabase = getSupabase();
  if (isSupabaseConfigured() && supabase) {
    try {
      const dbPayload: any = {
        product_id: newNotification.productId,
        product_title: newNotification.productTitle,
        variant_id: newNotification.variantId || null,
        variant_name: newNotification.variantName,
        phone: newNotification.phone,
        customer_name: newNotification.customerName || null,
        user_id: params.userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.userId) ? params.userId : null,
        status: 'pending',
      };

      const { error } = await supabase.from('stock_notifications').insert(dbPayload);
      if (error) {
        console.warn('[StockNotifications] Nota al guardar en Supabase (usando respaldo local):', error.message);
      }
    } catch (err) {
      console.warn('[StockNotifications] Excepción al guardar en Supabase:', err);
    }
  }

  // Guardar copia local segura
  const updatedList = [newNotification, ...localList];
  saveLocalStockNotifications(updatedList);

  return { success: true, alreadyRegistered: false };
};

/**
 * Obtiene todas las solicitudes de aviso de stock.
 * SEGURIDAD ESTRICTA: Solo permitido para el administrador autenticado.
 */
export const fetchStockNotifications = async (): Promise<StockNotification[]> => {
  if (!isAdminAuthenticated()) {
    console.warn('[SEGURIDAD] Intento denegado: solo el administrador autenticado puede consultar avisos de stock.');
    return [];
  }

  const localItems = getLocalStockNotifications();
  const supabase = getSupabase();

  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase
        .from('stock_notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        const mapped: StockNotification[] = data.map((d: any) => ({
          id: String(d.id),
          productId: String(d.product_id),
          productTitle: String(d.product_title || 'Producto'),
          variantId: d.variant_id ? String(d.variant_id) : undefined,
          variantName: String(d.variant_name || 'Variante'),
          phone: String(d.phone || ''),
          customerName: d.customer_name ? String(d.customer_name) : undefined,
          userId: d.user_id ? String(d.user_id) : undefined,
          status: (d.status === 'notified' ? 'notified' : 'pending') as 'pending' | 'notified',
          createdAt: d.created_at || new Date().toISOString(),
          notifiedAt: d.notified_at || undefined,
        }));

        // Sincronizar / combinar con locales para no perder registros offline
        const dbIds = new Set(mapped.map((m) => m.id));
        const merged = [...mapped];
        localItems.forEach((loc) => {
          if (!dbIds.has(loc.id)) {
            merged.push(loc);
          }
        });

        saveLocalStockNotifications(merged);
        return merged;
      }
    } catch (e) {
      console.warn('[StockNotifications] Error consultando Supabase, usando respaldo local:', e);
    }
  }

  return localItems;
};

/**
 * Marca una solicitud de aviso como "Avisado" con fecha y hora.
 * SEGURIDAD ESTRICTA: Solo permitido para el administrador autenticado.
 */
export const markStockNotificationAsNotified = async (notificationId: string): Promise<boolean> => {
  if (!isAdminAuthenticated()) {
    console.warn('[SEGURIDAD] Intento denegado: solo el administrador puede actualizar avisos.');
    return false;
  }

  const now = new Date().toISOString();
  const localList = getLocalStockNotifications();
  const updatedList = localList.map((item) =>
    item.id === notificationId
      ? { ...item, status: 'notified' as const, notifiedAt: now }
      : item
  );
  saveLocalStockNotifications(updatedList);

  const supabase = getSupabase();
  if (isSupabaseConfigured() && supabase) {
    try {
      await supabase
        .from('stock_notifications')
        .update({ status: 'notified', notified_at: now })
        .eq('id', notificationId);
    } catch (e) {
      console.warn('[StockNotifications] Error al actualizar estado en Supabase:', e);
    }
  }

  return true;
};

/**
 * Elimina una solicitud de aviso de stock.
 * SEGURIDAD ESTRICTA: Solo permitido para el administrador autenticado.
 */
export const deleteStockNotification = async (notificationId: string): Promise<boolean> => {
  if (!isAdminAuthenticated()) {
    console.warn('[SEGURIDAD] Intento denegado: solo el administrador puede eliminar avisos.');
    return false;
  }

  const localList = getLocalStockNotifications();
  const updatedList = localList.filter((item) => item.id !== notificationId);
  saveLocalStockNotifications(updatedList);

  const supabase = getSupabase();
  if (isSupabaseConfigured() && supabase) {
    try {
      await supabase.from('stock_notifications').delete().eq('id', notificationId);
    } catch (e) {
      console.warn('[StockNotifications] Error al eliminar registro en Supabase:', e);
    }
  }

  return true;
};

/**
 * Comprueba cuántas personas están esperando una variante específica.
 */
export const getWaitingClientsCountForVariant = (
  notifications: StockNotification[],
  productId: string,
  variantName?: string,
  variantId?: string
): number => {
  return notifications.filter((n) => {
    if (n.status !== 'pending' || n.productId !== productId) return false;
    if (variantId && n.variantId && n.variantId === variantId) return true;
    if (variantName && n.variantName.toLowerCase().trim() === variantName.toLowerCase().trim()) return true;
    if (variantName && n.variantName.toLowerCase().includes(variantName.toLowerCase().trim())) return true;
    return false;
  }).length;
};
