import { getSupabase, isSupabaseConfigured } from './supabase';
import { UserProfile, Order } from '../types';

/**
 * Normaliza direcciones de correo electrónico:
 * - Elimina espacios antes y después
 * - Convierte a minúsculas
 * - Remueve caracteres invisibles
 */
export const normalizeEmail = (email: string): string => {
  if (!email || typeof email !== 'string') return '';
  return email
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '')
    .trim()
    .toLowerCase();
};

/**
 * Convierte un usuario de Supabase Auth en UserProfile de la tienda de forma instantánea.
 * Lee los metadatos almacenados directamente en Supabase Auth (sin necesidad de consultas adicionales).
 */
export const userToProfile = (user: any, dbProfile?: any): UserProfile => {
  const meta = user?.user_metadata || {};
  const email = normalizeEmail(user?.email || dbProfile?.email || '');

  return {
    id: user?.id || dbProfile?.id || '',
    email,
    fullName: dbProfile?.full_name || meta.full_name || email.split('@')[0] || 'Cliente',
    phone: dbProfile?.phone || meta.phone || '',
    dni: dbProfile?.dni || meta.dni || '',
    street: dbProfile?.street || meta.street || '',
    streetNumber: dbProfile?.street_number || meta.street_number || dbProfile?.streetNumber || meta.streetNumber || '',
    floor: dbProfile?.floor || meta.floor || '',
    city: dbProfile?.city || meta.city || '',
    province: dbProfile?.province || meta.province || '',
    postalCode: dbProfile?.postal_code || meta.postal_code || dbProfile?.postalCode || meta.postalCode || '',
    receiverName: dbProfile?.receiver_name || meta.receiver_name || dbProfile?.receiverName || meta.receiverName || '',
    favorites: Array.isArray(meta.favorites) ? meta.favorites : Array.isArray(dbProfile?.favorites) ? dbProfile.favorites : [],
    createdAt: dbProfile?.created_at || user?.created_at,
    updatedAt: dbProfile?.updated_at || user?.updated_at,
  };
};

/**
 * Obtiene el usuario activo a partir del token de sesión de Supabase Auth en el almacenamiento
 */
export const getLocalAuthUser = (): { id: string; email: string } | null => {
  if (typeof window === 'undefined') return null;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          const user = parsed?.user;
          if (user?.id) {
            return { id: user.id, email: user.email || '' };
          }
        }
      }
    }
  } catch {}
  return null;
};

/**
 * Mapa de perfiles en memoria/caché ligera para compatibilidad
 */
export const getLocalProfiles = (): Record<string, UserProfile> => {
  const user = getLocalAuthUser();
  if (!user) return {};
  const prof = userToProfile(user);
  return { [user.id]: prof, [user.email.toLowerCase()]: prof };
};

/**
 * Sincroniza o consulta los datos complementarios del perfil en la tabla 'profiles'
 */
export const fetchUserProfile = async (userId: string, email?: string): Promise<UserProfile | null> => {
  const cleanUserId = (userId || '').trim();
  const cleanEmail = email ? normalizeEmail(email) : '';
  const supabase = getSupabase();

  if (!isSupabaseConfigured() || !supabase) {
    return null;
  }

  try {
    const { data: authData } = await supabase.auth.getUser();
    const currentUser = authData?.user;

    let dbData: any = null;
    if (cleanUserId) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', cleanUserId)
        .maybeSingle();
      dbData = data;
    }

    if (currentUser && currentUser.id === cleanUserId) {
      return userToProfile(currentUser, dbData);
    }

    if (dbData) {
      return userToProfile({ id: dbData.id, email: dbData.email }, dbData);
    }
  } catch (e) {
    console.warn('[Auth] Error al consultar perfil:', e);
  }

  return null;
};

/**
 * Guarda o actualiza los datos del perfil tanto en Supabase Auth como en la tabla profiles
 */
export const saveUserProfile = async (profile: UserProfile): Promise<UserProfile> => {
  const supabase = getSupabase();
  const cleanEmail = normalizeEmail(profile.email);
  const now = new Date().toISOString();

  const fullProfile: UserProfile = {
    ...profile,
    email: cleanEmail,
    updatedAt: now,
  };

  if (isSupabaseConfigured() && supabase) {
    // 1. Actualizar metadatos en Supabase Auth (disponible inmediatamente en cualquier dispositivo)
    try {
      await supabase.auth.updateUser({
        data: {
          full_name: fullProfile.fullName,
          phone: fullProfile.phone || '',
          dni: fullProfile.dni || '',
          street: fullProfile.street || '',
          street_number: fullProfile.streetNumber || '',
          floor: fullProfile.floor || '',
          city: fullProfile.city || '',
          province: fullProfile.province || '',
          postal_code: fullProfile.postalCode || '',
          receiver_name: fullProfile.receiverName || '',
        },
      });
    } catch (e) {
      console.warn('[Auth] Error actualizando user_metadata:', e);
    }

    // 2. Persistir en la tabla profiles de la base de datos
    try {
      const dbPayload = {
        id: fullProfile.id,
        email: cleanEmail,
        full_name: fullProfile.fullName,
        phone: fullProfile.phone || null,
        dni: fullProfile.dni || null,
        street: fullProfile.street || null,
        street_number: fullProfile.streetNumber || null,
        floor: fullProfile.floor || null,
        city: fullProfile.city || null,
        province: fullProfile.province || null,
        postal_code: fullProfile.postalCode || null,
        receiver_name: fullProfile.receiverName || null,
        updated_at: now,
      };

      await supabase.from('profiles').upsert(dbPayload, { onConflict: 'id' });
    } catch (e) {
      console.warn('[Auth] Error al actualizar tabla profiles:', e);
    }
  }

  return fullProfile;
};

/**
 * INICIO DE SESIÓN DIRECTO
 * Utiliza signInWithPassword() de Supabase Auth
 */
export const signInWithEmail = async (
  email: string,
  pass: string
): Promise<{ success: boolean; profile?: UserProfile; error?: string }> => {
  const cleanEmail = normalizeEmail(email);

  if (!cleanEmail || !pass) {
    return { success: false, error: 'Por favor completa todos los campos.' };
  }

  const supabase = getSupabase();
  if (!isSupabaseConfigured() || !supabase) {
    return { success: false, error: 'Servicio de autenticación no disponible.' };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: pass,
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
        return { success: false, error: 'Credenciales inválidas. Verifica tu correo y contraseña.' };
      }
      if (msg.includes('email not confirmed')) {
        return { success: false, error: 'Tu correo aún no ha sido confirmado en Supabase.' };
      }
      return { success: false, error: error.message };
    }

    if (data?.user) {
      const profile = userToProfile(data.user);
      return { success: true, profile };
    }

    return { success: false, error: 'No se pudo iniciar sesión.' };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Error al iniciar sesión' };
  }
};

/**
 * REGISTRO DIRECTO DE CLIENTE
 * - Un correo = una cuenta
 * - Sin confirmación obligatoria por correo si está desactivada en Supabase
 * - Inicia sesión automáticamente tras el registro
 * - Impide duplicados
 */
export const signUpWithEmail = async (
  email: string,
  pass: string,
  userData: {
    fullName: string;
    phone?: string;
    dni?: string;
    street?: string;
    streetNumber?: string;
    floor?: string;
    city?: string;
    province?: string;
    postalCode?: string;
    receiverName?: string;
  }
): Promise<{
  success: boolean;
  profile?: UserProfile;
  error?: string;
  isDuplicate?: boolean;
  requiresEmailConfirmation?: boolean;
  message?: string;
}> => {
  const cleanEmail = normalizeEmail(email);

  if (!cleanEmail || !pass || !userData.fullName) {
    return { success: false, error: 'Por favor completa los campos obligatorios (*).' };
  }

  if (pass.length < 6) {
    return { success: false, error: 'La contraseña debe tener al menos 6 caracteres.' };
  }

  // Prevenir registro público con el correo administrativo
  const configuredAdminEmail = (
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ADMIN_EMAIL) ||
    'admin@myimportadora.com'
  ).toLowerCase();

  if (cleanEmail === configuredAdminEmail || cleanEmail.startsWith('admin@')) {
    return {
      success: false,
      error: 'Este correo electrónico está reservado para la administración del sistema.',
    };
  }

  const supabase = getSupabase();
  if (!isSupabaseConfigured() || !supabase) {
    return { success: false, error: 'Servicio de autenticación no disponible.' };
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password: pass,
      options: {
        data: {
          full_name: userData.fullName.trim(),
          phone: (userData.phone || '').trim(),
        },
      },
    });

    // Detección estricta de correo duplicado
    const isDuplicate =
      (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) ||
      (error && (
        error.message.toLowerCase().includes('already registered') ||
        error.message.toLowerCase().includes('already exists') ||
        error.message.toLowerCase().includes('user already registered') ||
        error.status === 422
      ));

    if (isDuplicate) {
      return {
        success: false,
        isDuplicate: true,
        error: 'Este correo ya está registrado. Iniciá sesión o recuperá tu contraseña.',
      };
    }

    if (error) {
      return { success: false, error: error.message };
    }

    if (data?.user) {
      // Si Supabase devuelve sesión activa (confirm email desactivado en Supabase),
      // el usuario ya quedó autenticado automáticamente.
      if (data.session) {
        const profile = userToProfile(data.user);
        saveUserProfile(profile).catch(() => {});
        return { success: true, profile };
      }

      // Si data.session es null, intentamos iniciar sesión de inmediato con las credenciales
      const signInRes = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: pass,
      });

      if (signInRes.data?.user) {
        const profile = userToProfile(signInRes.data.user);
        saveUserProfile(profile).catch(() => {});
        return { success: true, profile };
      }

      // Si requiere confirmación en Supabase Auth
      return {
        success: true,
        profile: userToProfile(data.user),
        requiresEmailConfirmation: true,
        message: '¡Cuenta creada con éxito! Si tu proyecto requiere confirmación por correo, por favor revisa tu bandeja de entrada para activarla.',
      };
    }

    return { success: false, error: 'Error al crear la cuenta.' };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Error al registrar la cuenta' };
  }
};

/**
 * CIERRE DE SESIÓN
 * Cierra la sesión en Supabase Auth sin borrar ningún pedido ni el carrito de compras.
 */
export const signOutUser = async (): Promise<void> => {
  const supabase = getSupabase();
  if (isSupabaseConfigured() && supabase) {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('[Auth] Error al cerrar sesión en Supabase:', e);
    }
  }
};

/**
 * RECUPERACIÓN DE CONTRASEÑA
 * Envía el correo seguro oficial de Supabase solo cuando el cliente lo solicita.
 */
export const sendPasswordReset = async (
  email: string
): Promise<{ success: boolean; error?: string; message?: string }> => {
  const cleanEmail = normalizeEmail(email);

  if (!cleanEmail) {
    return { success: false, error: 'Por favor ingresa tu correo electrónico.' };
  }

  const supabase = getSupabase();
  if (!isSupabaseConfigured() || !supabase) {
    return { success: false, error: 'Servicio de autenticación no disponible.' };
  }

  try {
    const redirectUrl = typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}`
      : 'https://myimportadora.vercel.app';

    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: redirectUrl,
    });

    if (error) {
      if (error.message.toLowerCase().includes('rate limit')) {
        return {
          success: false,
          error: 'Límite de solicitudes de correo alcanzado. Por favor espera unos minutos.',
        };
      }
      return { success: false, error: error.message };
    }

    return {
      success: true,
      message: 'Te hemos enviado un correo con el enlace seguro para restablecer tu contraseña. Revisa tu bandeja de entrada o spam.',
    };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Error al solicitar recuperación.' };
  }
};

/**
 * ACTUALIZACIÓN DE CONTRASEÑA
 * Utilizada cuando el cliente hace clic en el enlace de recuperación y define su nueva clave.
 */
export const updateUserPassword = async (
  newPassword: string
): Promise<{ success: boolean; error?: string; message?: string; profile?: UserProfile }> => {
  if (!newPassword || newPassword.length < 6) {
    return { success: false, error: 'La nueva contraseña debe tener al menos 6 caracteres.' };
  }

  const supabase = getSupabase();
  if (!isSupabaseConfigured() || !supabase) {
    return { success: false, error: 'Servicio de autenticación no disponible.' };
  }

  try {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (data?.user) {
      const profile = userToProfile(data.user);
      return {
        success: true,
        profile,
        message: '¡Contraseña actualizada exitosamente!',
      };
    }

    return { success: true, message: 'Contraseña actualizada.' };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Error al actualizar la contraseña.' };
  }
};

/**
 * CONSULTA DE PEDIDOS DE USUARIO
 * Consulta filtrada estrictamente por el id o email del cliente
 */
export const fetchUserOrders = async (userId: string, email: string): Promise<Order[]> => {
  const cleanEmail = normalizeEmail(email || '');
  const cleanUserId = (userId || '').trim();

  if (!cleanEmail && !cleanUserId) {
    return [];
  }

  const supabase = getSupabase();
  if (!isSupabaseConfigured() || !supabase) {
    return [];
  }

  try {
    let query = supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (cleanEmail && cleanUserId) {
      query = query.or(`customer_email.ilike.${cleanEmail},user_id.eq.${cleanUserId}`);
    } else if (cleanEmail) {
      query = query.ilike('customer_email', cleanEmail);
    } else {
      query = query.eq('user_id', cleanUserId);
    }

    const { data, error } = await query;
    if (error || !data || !Array.isArray(data)) {
      return [];
    }

    return data.map((item: any): Order => ({
      id: item.id,
      orderNumber: item.order_number || item.orderNumber || `M-${item.id}`,
      userId: item.user_id || item.userId || undefined,
      customerName: item.customer_name || item.customerName || 'Cliente',
      customerEmail: item.customer_email || item.customerEmail || '',
      customerWhatsapp: item.customer_whatsapp || item.customerWhatsapp || '',
      deliveryOption: item.delivery_option || item.deliveryOption || 'pickup',
      shippingMethodName: item.shipping_method_name || item.shippingMethodName || undefined,
      deliveryAddress: item.delivery_address || item.deliveryAddress || {},
      paymentMethod: item.payment_method || item.paymentMethod || 'transfer',
      items: Array.isArray(item.items)
        ? item.items
        : (item.items ? (typeof item.items === 'string' ? JSON.parse(item.items) : item.items) : []),
      subtotal: Number(item.subtotal || 0),
      wholesaleDiscount: Number(item.wholesale_discount || item.wholesaleDiscount || 0),
      cashDiscount: Number(item.cash_discount || item.cashDiscount || 0),
      shippingCost: Number(item.shipping_cost || item.shippingCost || 0),
      total: Number(item.total || 0),
      status: item.status || 'pending_payment',
      createdAt: item.created_at || item.createdAt || new Date().toISOString(),
      emailSentToCustomer: Boolean(item.email_sent_to_customer || item.emailSentToCustomer),
      emailSentToAdmin: Boolean(item.email_sent_to_admin || item.emailSentToAdmin),
    }));
  } catch (e) {
    console.warn('[Auth] Error al consultar pedidos del usuario:', e);
    return [];
  }
};
