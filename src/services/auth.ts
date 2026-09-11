import { getSupabase, isSupabaseConfigured, safeLocalStorageSet } from './supabase';
import { UserProfile, Order } from '../types';

const LOCAL_AUTH_USER_KEY = 'my_commerce_auth_user';
const LOCAL_PROFILES_KEY = 'my_commerce_profiles';

export interface AuthState {
  user: { id: string; email: string } | null;
  profile: UserProfile | null;
  isLoading: boolean;
}

// Read local active session
export const getLocalAuthUser = (): { id: string; email: string } | null => {
  try {
    const raw = localStorage.getItem(LOCAL_AUTH_USER_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading local auth user:', e);
  }
  return null;
};

export const saveLocalAuthUser = (user: { id: string; email: string } | null) => {
  if (user) {
    safeLocalStorageSet(LOCAL_AUTH_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(LOCAL_AUTH_USER_KEY);
  }
};

// Local profiles map
export const getLocalProfiles = (): Record<string, UserProfile> => {
  try {
    const raw = localStorage.getItem(LOCAL_PROFILES_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading local profiles:', e);
  }
  return {};
};

export const saveLocalProfile = (profile: UserProfile) => {
  const current = getLocalProfiles();
  current[profile.id] = profile;
  // Also key by email for easy lookup
  if (profile.email) {
    current[profile.email.toLowerCase()] = profile;
  }
  safeLocalStorageSet(LOCAL_PROFILES_KEY, JSON.stringify(current));
};

/**
 * Fetch profile from Supabase with local storage fallback
 */
export const fetchUserProfile = async (userId: string, email?: string): Promise<UserProfile | null> => {
  const supabase = getSupabase();

  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (!error && data) {
        const mapped: UserProfile = {
          id: data.id,
          email: data.email || email || '',
          fullName: data.full_name || data.fullName || '',
          phone: data.phone || '',
          dni: data.dni || '',
          street: data.street || '',
          streetNumber: data.street_number || data.streetNumber || '',
          floor: data.floor || '',
          city: data.city || '',
          province: data.province || '',
          postalCode: data.postal_code || data.postalCode || '',
          receiverName: data.receiver_name || data.receiverName || '',
          createdAt: data.created_at || data.createdAt,
          updatedAt: data.updated_at || data.updatedAt,
        };
        saveLocalProfile(mapped);
        return mapped;
      }

      // Si la tabla profiles no existe o no tiene el registro, leer metadata en Supabase Auth
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
          const meta = authData.user.user_metadata;
          if (meta?.profile_data) {
            saveLocalProfile(meta.profile_data);
            return meta.profile_data;
          }
        }
      } catch (authErr) {}
    } catch (e) {
      console.warn('Error fetching user profile from Supabase:', e);
    }
  }

  // Local fallback
  const localMap = getLocalProfiles();
  if (localMap[userId]) return localMap[userId];
  if (email && localMap[email.toLowerCase()]) return localMap[email.toLowerCase()];

  return null;
};

/**
 * Save / Update user profile
 */
export const saveUserProfile = async (profile: UserProfile): Promise<UserProfile> => {
  const supabase = getSupabase();
  const now = new Date().toISOString();
  const fullProfile: UserProfile = {
    ...profile,
    updatedAt: now,
  };

  if (isSupabaseConfigured() && supabase) {
    try {
      const dbPayload = {
        id: fullProfile.id,
        email: fullProfile.email,
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
      console.warn('Error updating profile in Supabase profiles table:', e);
    }

    // Persistir también en user_metadata de Supabase Auth para garantizar sincronización en la nube entre dispositivos
    try {
      await supabase.auth.updateUser({
        data: {
          full_name: fullProfile.fullName,
          phone: fullProfile.phone || '',
          profile_data: fullProfile,
        },
      });
    } catch (authErr) {}
  }

  saveLocalProfile(fullProfile);
  return fullProfile;
};

/**
 * Sign In with Email & Password
 */
export const signInWithEmail = async (
  email: string,
  pass: string
): Promise<{ success: boolean; profile?: UserProfile; error?: string }> => {
  const cleanEmail = email.trim().toLowerCase();
  const supabase = getSupabase();

  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: pass,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data?.user) {
        const userObj = { id: data.user.id, email: data.user.email || cleanEmail };
        saveLocalAuthUser(userObj);

        // Fetch or create profile
        let prof = await fetchUserProfile(data.user.id, cleanEmail);
        if (!prof) {
          prof = {
            id: data.user.id,
            email: cleanEmail,
            fullName: (data.user.user_metadata?.full_name as string) || cleanEmail.split('@')[0],
            phone: (data.user.user_metadata?.phone as string) || '',
            createdAt: new Date().toISOString(),
          };
          await saveUserProfile(prof);
        }

        return { success: true, profile: prof };
      }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error al iniciar sesión' };
    }
  }

  // Local storage mock authentication
  const localProfiles = getLocalProfiles();
  let existing = localProfiles[cleanEmail];

  if (!existing) {
    // Auto-create local user profile for prototype / local mode
    existing = {
      id: `usr_${Date.now()}`,
      email: cleanEmail,
      fullName: cleanEmail.split('@')[0],
      createdAt: new Date().toISOString(),
    };
    saveLocalProfile(existing);
  }

  const userObj = { id: existing.id, email: cleanEmail };
  saveLocalAuthUser(userObj);

  return { success: true, profile: existing };
};

/**
 * Sign Up (Register) with Email & Password
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
): Promise<{ success: boolean; profile?: UserProfile; error?: string; message?: string }> => {
  const cleanEmail = email.trim().toLowerCase();
  const supabase = getSupabase();

  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password: pass,
        options: {
          data: {
            full_name: userData.fullName,
            phone: userData.phone,
          },
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data?.user) {
        const userId = data.user.id;
        const newProfile: UserProfile = {
          id: userId,
          email: cleanEmail,
          fullName: userData.fullName,
          phone: userData.phone || '',
          dni: userData.dni || '',
          street: userData.street || '',
          streetNumber: userData.streetNumber || '',
          floor: userData.floor || '',
          city: userData.city || '',
          province: userData.province || '',
          postalCode: userData.postalCode || '',
          receiverName: userData.receiverName || userData.fullName,
          createdAt: new Date().toISOString(),
        };

        await saveUserProfile(newProfile);
        saveLocalAuthUser({ id: userId, email: cleanEmail });

        return {
          success: true,
          profile: newProfile,
          message: data.session ? undefined : 'Cuenta creada. Si se requiere confirmación por correo, revisa tu bandeja de entrada.',
        };
      }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error al registrar la cuenta' };
    }
  }

  // Local storage registration
  const userId = `usr_${Date.now()}`;
  const newProfile: UserProfile = {
    id: userId,
    email: cleanEmail,
    fullName: userData.fullName,
    phone: userData.phone || '',
    dni: userData.dni || '',
    street: userData.street || '',
    streetNumber: userData.streetNumber || '',
    floor: userData.floor || '',
    city: userData.city || '',
    province: userData.province || '',
    postalCode: userData.postalCode || '',
    receiverName: userData.receiverName || userData.fullName,
    createdAt: new Date().toISOString(),
  };

  saveLocalProfile(newProfile);
  saveLocalAuthUser({ id: userId, email: cleanEmail });

  return { success: true, profile: newProfile };
};

/**
 * Send Password Reset Email
 */
export const sendPasswordReset = async (
  email: string
): Promise<{ success: boolean; error?: string; message?: string }> => {
  const cleanEmail = email.trim().toLowerCase();
  const supabase = getSupabase();

  if (isSupabaseConfigured() && supabase) {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: window.location.origin,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        message: 'Te hemos enviado un enlace a tu correo electrónico para restablecer tu contraseña.',
      };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error al solicitar recuperación de contraseña' };
    }
  }

  // Local mock message
  return {
    success: true,
    message: 'Te hemos enviado un enlace a tu correo electrónico para restablecer tu contraseña.',
  };
};

/**
 * Sign Out
 */
export const signOutUser = async (): Promise<void> => {
  const supabase = getSupabase();
  if (isSupabaseConfigured() && supabase) {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Error signing out of Supabase:', e);
    }
  }
  saveLocalAuthUser(null);
};

/**
 * Fetch orders for a specific user (by user id or email)
 */
export const fetchUserOrders = async (userId: string, email: string): Promise<Order[]> => {
  const supabase = getSupabase();
  const cleanEmail = email.trim().toLowerCase();
  const orderMap = new Map<string, Order>();
  let supabaseSuccess = false;

  if (isSupabaseConfigured() && supabase) {
    try {
      // Query by user_id or customer_email
      let query = supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (cleanEmail) {
        query = query.ilike('customer_email', cleanEmail);
      }

      const { data, error } = await query;

      if (!error && data && Array.isArray(data)) {
        supabaseSuccess = true;
        data.forEach((item: any) => {
          const ord: Order = {
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
          };
          orderMap.set(ord.id, ord);
        });
      }
    } catch (e) {
      console.warn('Error fetching user orders from Supabase:', e);
    }
  }

  // Si Supabase tuvo éxito, es la fuente única autoritativa (no revivir pedidos borrados de localStorage)
  if (!supabaseSuccess) {
    try {
      const raw = localStorage.getItem('my_commerce_orders');
      if (raw) {
        const localOrders: Order[] = JSON.parse(raw);
        if (Array.isArray(localOrders)) {
          localOrders
            .filter(
              (o) =>
                (o.userId && o.userId === userId) ||
                (cleanEmail && o.customerEmail && o.customerEmail.toLowerCase() === cleanEmail)
            )
            .forEach((ord) => {
              if (!orderMap.has(ord.id)) {
                orderMap.set(ord.id, ord);
              }
            });
        }
      }
    } catch (e) {
      console.warn('Error filtering local user orders:', e);
    }
  }

  const userOrdersList = Array.from(orderMap.values());
  userOrdersList.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return userOrdersList;
};
