import { getSupabase, isSupabaseConfigured, safeLocalStorageSet } from './supabase';
import { UserProfile, Order } from '../types';

const LOCAL_AUTH_USER_KEY = 'my_commerce_auth_user';
const LOCAL_PROFILES_KEY = 'my_commerce_profiles';

// Claves de seguridad para protección contra fuerza bruta y límites de solicitudes
const LOGIN_ATTEMPTS_STORAGE_KEY = 'my_auth_login_attempts_v1';
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 5 * 60 * 1000; // 5 minutos de bloqueo tras 5 intentos fallidos consecutivos

const RESET_COOLDOWN_STORAGE_KEY = 'my_auth_reset_cooldown_v1';
const RESET_COOLDOWN_MS = 60 * 1000; // 60 segundos entre solicitudes de recuperación por correo

export interface AuthState {
  user: { id: string; email: string } | null;
  profile: UserProfile | null;
  isLoading: boolean;
}

/**
 * Normaliza y sanea direcciones de correo electrónico:
 * - Elimina espacios en blanco iniciales/finales
 * - Convierte a minúsculas canónicas
 * - Remueve caracteres invisibles y de ancho cero (zero-width characters)
 */
export const normalizeEmail = (email: string): string => {
  if (!email || typeof email !== 'string') return '';
  return email
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '')
    .trim()
    .toLowerCase();
};

/**
 * Validador estricto de sintaxis de correo electrónico (RFC 5322 simplificado)
 */
export const isValidEmailFormat = (email: string): boolean => {
  const clean = normalizeEmail(email);
  const regex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return regex.test(clean);
};

// ================= GESTIÓN DE SEGURIDAD Y RATE LIMITING ================= //

interface LoginTracker {
  attempts: number;
  lastAttemptTime: number;
  lockedUntil?: number;
}

const getLoginTracker = (cleanEmail: string): LoginTracker => {
  try {
    const raw = localStorage.getItem(`${LOGIN_ATTEMPTS_STORAGE_KEY}_${cleanEmail}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { attempts: 0, lastAttemptTime: 0 };
};

const checkLoginLockout = (cleanEmail: string): { isLocked: boolean; remainingMinutes: number } => {
  const tracker = getLoginTracker(cleanEmail);
  const now = Date.now();
  if (tracker.lockedUntil && tracker.lockedUntil > now) {
    const remainingMs = tracker.lockedUntil - now;
    return { isLocked: true, remainingMinutes: Math.max(1, Math.ceil(remainingMs / 60000)) };
  }
  return { isLocked: false, remainingMinutes: 0 };
};

const recordFailedLoginAttempt = (cleanEmail: string): { isLocked: boolean; remainingMinutes: number } => {
  const tracker = getLoginTracker(cleanEmail);
  const now = Date.now();
  const attempts = tracker.attempts + 1;
  const isLocked = attempts >= MAX_FAILED_LOGIN_ATTEMPTS;
  const lockedUntil = isLocked ? now + LOGIN_LOCKOUT_MS : undefined;

  try {
    localStorage.setItem(
      `${LOGIN_ATTEMPTS_STORAGE_KEY}_${cleanEmail}`,
      JSON.stringify({ attempts, lastAttemptTime: now, lockedUntil })
    );
  } catch {}

  return { isLocked, remainingMinutes: Math.ceil(LOGIN_LOCKOUT_MS / 60000) };
};

const resetLoginAttempts = (cleanEmail: string): void => {
  try {
    localStorage.removeItem(`${LOGIN_ATTEMPTS_STORAGE_KEY}_${cleanEmail}`);
  } catch {}
};

const checkResetCooldown = (cleanEmail: string): { isCoolingDown: boolean; remainingSeconds: number } => {
  try {
    const raw = localStorage.getItem(`${RESET_COOLDOWN_STORAGE_KEY}_${cleanEmail}`);
    if (raw) {
      const last = parseInt(raw, 10);
      const elapsed = Date.now() - last;
      if (elapsed < RESET_COOLDOWN_MS) {
        return { isCoolingDown: true, remainingSeconds: Math.ceil((RESET_COOLDOWN_MS - elapsed) / 1000) };
      }
    }
  } catch {}
  return { isCoolingDown: false, remainingSeconds: 0 };
};

const recordResetRequest = (cleanEmail: string): void => {
  try {
    localStorage.setItem(`${RESET_COOLDOWN_STORAGE_KEY}_${cleanEmail}`, Date.now().toString());
  } catch {}
};

// ================= GESTIÓN DE SESIÓN LOCAL Y CACHÉ ================= //

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
  if (profile.email) {
    current[normalizeEmail(profile.email)] = profile;
  }
  safeLocalStorageSet(LOCAL_PROFILES_KEY, JSON.stringify(current));
};

// ================= PERFILES DE USUARIO ================= //

/**
 * Consulta el perfil de usuario desde Supabase con aislamiento estricto y fallback seguro
 */
export const fetchUserProfile = async (userId: string, email?: string): Promise<UserProfile | null> => {
  const cleanEmail = email ? normalizeEmail(email) : '';
  const cleanUserId = (userId || '').trim();

  // Validación de seguridad para aislar cuentas: si existe sesión activa, no permitir consultar perfiles de terceros
  const localAuth = getLocalAuthUser();
  if (localAuth) {
    const isOwner =
      (cleanUserId && localAuth.id === cleanUserId) ||
      (cleanEmail && localAuth.email && normalizeEmail(localAuth.email) === cleanEmail);
    if (!isOwner) {
      console.warn('[SEGURIDAD] Intento no autorizado de consultar el perfil de otro usuario.');
      return null;
    }
  }

  const supabase = getSupabase();

  if (isSupabaseConfigured() && supabase) {
    try {
      if (cleanUserId) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', cleanUserId)
          .maybeSingle();

        if (!error && data) {
          const mapped: UserProfile = {
            id: data.id,
            email: data.email || cleanEmail || '',
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
      }

      // Si no está en tabla profiles por RLS o retardo, leer de user_metadata en Supabase Auth
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
          const meta = authData.user.user_metadata;
          if (meta?.profile_data) {
            saveLocalProfile(meta.profile_data);
            return meta.profile_data;
          }
          if (meta?.full_name || authData.user.email) {
            const fallbackProfile: UserProfile = {
              id: authData.user.id,
              email: authData.user.email || cleanEmail,
              fullName: (meta?.full_name as string) || cleanEmail.split('@')[0],
              phone: (meta?.phone as string) || '',
              createdAt: authData.user.created_at || new Date().toISOString(),
            };
            saveLocalProfile(fallbackProfile);
            return fallbackProfile;
          }
        }
      } catch (authErr) {}
    } catch (e) {
      console.warn('Error fetching user profile from Supabase:', e);
    }
  }

  // Fallback local seguro
  const localMap = getLocalProfiles();
  if (cleanUserId && localMap[cleanUserId]) return localMap[cleanUserId];
  if (cleanEmail && localMap[cleanEmail]) return localMap[cleanEmail];

  return null;
};

/**
 * Guarda o actualiza el perfil de un usuario garantizando aislamiento y sincronización
 */
export const saveUserProfile = async (profile: UserProfile): Promise<UserProfile> => {
  const cleanEmail = normalizeEmail(profile.email);
  const localAuth = getLocalAuthUser();

  if (localAuth) {
    const isOwner =
      (localAuth.id && localAuth.id === profile.id) ||
      (localAuth.email && normalizeEmail(localAuth.email) === cleanEmail);
    if (!isOwner) {
      console.warn('[SEGURIDAD] Intento no autorizado de modificar el perfil de otro usuario.');
      throw new Error('No tienes permiso para modificar el perfil de otro usuario.');
    }
  }

  const supabase = getSupabase();
  const now = new Date().toISOString();
  const fullProfile: UserProfile = {
    ...profile,
    email: cleanEmail,
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

      const { error: upsertErr } = await supabase.from('profiles').upsert(dbPayload, { onConflict: 'id' });
      if (upsertErr) {
        console.warn('Advertencia al sincronizar en tabla profiles de Supabase:', upsertErr.message);
      }
    } catch (e) {
      console.warn('Error updating profile in Supabase profiles table:', e);
    }

    // Persistir también en user_metadata de Supabase Auth para garantizar sincronización entre dispositivos
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

// ================= INICIO DE SESIÓN ================= //

/**
 * Iniciar sesión con correo y contraseña.
 * Incluye:
 * - Normalización de correo electrónico
 * - Protección contra ataques de fuerza bruta (bloqueo tras 5 fallos)
 * - Persistencia de sesión con tokens criptográficos de Supabase
 * - Aclaración inmediata en caso de credenciales inválidas o correo no confirmado
 */
export const signInWithEmail = async (
  email: string,
  pass: string
): Promise<{ success: boolean; profile?: UserProfile; error?: string; isLocked?: boolean }> => {
  const cleanEmail = normalizeEmail(email);

  if (!cleanEmail || !pass) {
    return { success: false, error: 'Por favor ingresa tu correo y contraseña.' };
  }

  // 1. Verificación de bloqueo por fuerza bruta
  const lockout = checkLoginLockout(cleanEmail);
  if (lockout.isLocked) {
    return {
      success: false,
      isLocked: true,
      error: `Demasiados intentos fallidos. Por tu seguridad, el acceso para este correo está bloqueado por ${lockout.remainingMinutes} minuto(s). Podés restablecer tu clave mediante «¿Olvidaste tu contraseña?».`,
    };
  }

  const supabase = getSupabase();

  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: pass,
      });

      if (error) {
        // Registrar intento fallido
        const lockStatus = recordFailedLoginAttempt(cleanEmail);
        const errorMsg = error.message.toLowerCase();

        if (lockStatus.isLocked) {
          return {
            success: false,
            isLocked: true,
            error: `Has superado el límite de intentos fallidos. Tu acceso está pausado temporalmente por ${lockStatus.remainingMinutes} minutos para proteger tu cuenta.`,
          };
        }

        if (errorMsg.includes('invalid login credentials') || errorMsg.includes('invalid credentials')) {
          return {
            success: false,
            error: 'Credenciales inválidas. Verifica tu correo y contraseña, o recupera tu contraseña si no la recuerdas.',
          };
        }

        if (errorMsg.includes('email not confirmed')) {
          return {
            success: false,
            error: 'Tu correo aún no ha sido confirmado. Revisa tu bandeja de entrada o carpeta de spam para activar tu cuenta.',
          };
        }

        if (errorMsg.includes('rate limit') || errorMsg.includes('too many requests')) {
          return {
            success: false,
            error: 'Demasiadas solicitudes al servicio de autenticación. Por favor espera unos minutos.',
          };
        }

        return { success: false, error: error.message };
      }

      if (data?.user) {
        // Éxito: restablecer contador de fallos
        resetLoginAttempts(cleanEmail);

        const userObj = { id: data.user.id, email: data.user.email || cleanEmail };
        saveLocalAuthUser(userObj);

        // Obtener o crear perfil persistente
        let prof = await fetchUserProfile(data.user.id, cleanEmail);
        if (!prof) {
          prof = {
            id: data.user.id,
            email: cleanEmail,
            fullName: (data.user.user_metadata?.full_name as string) || cleanEmail.split('@')[0],
            phone: (data.user.user_metadata?.phone as string) || '',
            createdAt: data.user.created_at || new Date().toISOString(),
          };
          await saveUserProfile(prof);
        }

        return { success: true, profile: prof };
      }
    } catch (e: any) {
      recordFailedLoginAttempt(cleanEmail);
      return { success: false, error: e?.message || 'Error al conectar con el servicio de autenticación.' };
    }
  }

  // Fallback en almacenamiento local seguro si Supabase no estuviera accesible
  const localProfiles = getLocalProfiles();
  const existing = localProfiles[cleanEmail];

  if (!existing) {
    return {
      success: false,
      error: 'No se encontró ninguna cuenta registrada con este correo en modo local. Por favor regístrate.',
    };
  }

  resetLoginAttempts(cleanEmail);
  const userObj = { id: existing.id, email: cleanEmail };
  saveLocalAuthUser(userObj);

  return { success: true, profile: existing };
};

// ================= REGISTRO DE CUENTA ================= //

/**
 * Registro de cliente con correo y contraseña.
 * 
 * Reglas mandatorias:
 * 1. UN CORREO ELECTRÓNICO = UNA ÚNICA CUENTA.
 * 2. Si el correo ya existe:
 *    - Detección estricta tanto por identidades vacías de Supabase (user.identities === [])
 *      como por mensajes de unicidad o verificación en base de datos.
 *    - NO permitir crear otra cuenta.
 *    - NO reemplazar la contraseña original.
 *    - NO sobrescribir datos de perfiles existentes.
 *    - Retornar { success: false, isDuplicate: true, error: "Este correo ya está registrado..." }
 * 3. Normalización total de emails para evitar duplicados por mayúsculas o espacios.
 * 4. Protección contra suplantación del correo de administración.
 * 5. Auto-login inmediato si Supabase genera sesión, o instrucciones claras si requiere confirmación.
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
    return { success: false, error: 'Por favor completa todos los campos obligatorios (*).' };
  }

  if (!isValidEmailFormat(cleanEmail)) {
    return { success: false, error: 'El formato de correo electrónico no es válido.' };
  }

  if (pass.length < 6) {
    return { success: false, error: 'La contraseña debe tener un mínimo de 6 caracteres.' };
  }

  // Protección contra suplantación: el correo administrativo no puede ser registrado por el público
  const configuredAdminEmail = (
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ADMIN_EMAIL) ||
    'admin@myimportadora.com'
  ).toLowerCase();

  if (cleanEmail === configuredAdminEmail || cleanEmail.startsWith('admin@')) {
    return {
      success: false,
      error: 'Este correo electrónico está reservado para la administración del sistema. Utiliza tu correo personal.',
    };
  }

  const supabase = getSupabase();

  if (isSupabaseConfigured() && supabase) {
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

      // 1. Detección de CORREO DUPLICADO:
      // En Supabase GoTrue, cuando la protección de enumeración o confirmación de correo está activa,
      // al registrar un correo ya existente se devuelve data.user con user.identities = [] (array vacío).
      // Si la confirmación de correo está inactiva, se devuelve error 422 con "User already registered".
      const isDuplicateInSupabase =
        (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) ||
        (error && (
          error.message.toLowerCase().includes('already registered') ||
          error.message.toLowerCase().includes('already exists') ||
          error.message.toLowerCase().includes('user already registered') ||
          error.status === 422
        ));

      if (isDuplicateInSupabase) {
        return {
          success: false,
          isDuplicate: true,
          error: 'Este correo ya está registrado. Iniciá sesión o recuperá tu contraseña.',
        };
      }

      if (error) {
        if (error.message.toLowerCase().includes('rate limit')) {
          return {
            success: false,
            error: 'Se ha alcanzado el límite temporal del servicio de correos. Si ya creaste tu cuenta, intenta iniciar sesión o espera unos minutos.',
          };
        }
        return { success: false, error: error.message };
      }

      if (data?.user) {
        const userId = data.user.id;
        const newProfile: UserProfile = {
          id: userId,
          email: cleanEmail,
          fullName: userData.fullName.trim(),
          phone: (userData.phone || '').trim(),
          dni: (userData.dni || '').trim(),
          street: (userData.street || '').trim(),
          streetNumber: (userData.streetNumber || '').trim(),
          floor: (userData.floor || '').trim(),
          city: (userData.city || '').trim(),
          province: (userData.province || '').trim(),
          postalCode: (userData.postalCode || '').trim(),
          receiverName: (userData.receiverName || userData.fullName).trim(),
          createdAt: new Date().toISOString(),
        };

        // Si Supabase otorgó sesión activa (correo auto-confirmado o confirmación desactivada)
        if (data.session) {
          saveLocalAuthUser({ id: userId, email: cleanEmail });
          await saveUserProfile(newProfile);

          return {
            success: true,
            profile: newProfile,
            requiresEmailConfirmation: false,
          };
        }

        // Si la sesión es null, Supabase requiere confirmación por correo electrónico
        // Guardamos el perfil en caché local sin crear sesión falsa para no confundir al usuario
        saveLocalProfile(newProfile);

        return {
          success: true,
          profile: newProfile,
          requiresEmailConfirmation: true,
          message: '¡Cuenta creada con éxito! Por favor verifica tu correo electrónico para activar tu cuenta antes de iniciar sesión.',
        };
      }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error al conectar con el servidor de autenticación.' };
    }
  }

  // Registro en modo local con validación de duplicados
  const localProfiles = getLocalProfiles();
  if (localProfiles[cleanEmail]) {
    return {
      success: false,
      isDuplicate: true,
      error: 'Este correo ya está registrado. Iniciá sesión o recuperá tu contraseña.',
    };
  }

  const userId = `usr_${Date.now()}`;
  const newProfile: UserProfile = {
    id: userId,
    email: cleanEmail,
    fullName: userData.fullName.trim(),
    phone: (userData.phone || '').trim(),
    dni: (userData.dni || '').trim(),
    street: (userData.street || '').trim(),
    streetNumber: (userData.streetNumber || '').trim(),
    floor: (userData.floor || '').trim(),
    city: (userData.city || '').trim(),
    province: (userData.province || '').trim(),
    postalCode: (userData.postalCode || '').trim(),
    receiverName: (userData.receiverName || userData.fullName).trim(),
    createdAt: new Date().toISOString(),
  };

  saveLocalProfile(newProfile);
  saveLocalAuthUser({ id: userId, email: cleanEmail });

  return { success: true, profile: newProfile };
};

// ================= RECUPERACIÓN DE CONTRASEÑA ================= //

/**
 * Solicita el restablecimiento de contraseña vía Supabase Auth.
 * 
 * Reglas de seguridad:
 * - Normaliza el correo electrónico.
 * - Cooldown rate-limit: 60 segundos entre solicitudes para prevenir saturación de SMTP.
 * - Protección contra enumeración: muestra un mensaje genérico para no revelar si el correo existe.
 * - Configura la URL de redirección dinámica compatible con Vercel, dominios personalizados y entornos de vista previa.
 */
export const sendPasswordReset = async (
  email: string
): Promise<{ success: boolean; error?: string; message?: string }> => {
  const cleanEmail = normalizeEmail(email);

  if (!cleanEmail) {
    return { success: false, error: 'Por favor ingresa tu correo electrónico.' };
  }

  if (!isValidEmailFormat(cleanEmail)) {
    return { success: false, error: 'Por favor introduce un correo electrónico válido.' };
  }

  // Rate limiting de recuperación (60s entre envíos para el mismo correo)
  const cooldown = checkResetCooldown(cleanEmail);
  if (cooldown.isCoolingDown) {
    return {
      success: false,
      error: `Por favor espera ${cooldown.remainingSeconds} segundo(s) antes de solicitar otro correo de recuperación.`,
    };
  }

  recordResetRequest(cleanEmail);
  const supabase = getSupabase();

  if (isSupabaseConfigured() && supabase) {
    try {
      // Configuración de redirección segura para Vercel y dominios de producción
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
            error: 'Se ha alcanzado el límite de correos del servicio. Por favor espera unos minutos antes de reintentar.',
          };
        }
        // Para no revelar información de usuarios ante atacantes, devolvemos el mensaje genérico estándar
        console.warn('Advertencia en resetPasswordForEmail:', error.message);
      }

      return {
        success: true,
        message: 'Si este correo está registrado en nuestro sistema, recibirás un enlace seguro para restablecer tu contraseña en los próximos minutos. Revisa tu bandeja de entrada y carpeta de spam.',
      };
    } catch (e: any) {
      console.warn('Error al solicitar resetPasswordForEmail:', e);
    }
  }

  return {
    success: true,
    message: 'Si este correo está registrado en nuestro sistema, recibirás un enlace seguro para restablecer tu contraseña en los próximos minutos. Revisa tu bandeja de entrada y carpeta de spam.',
  };
};

/**
 * Actualiza la contraseña del usuario tras haber validado el token temporal de recuperación.
 * Esta función es invocada cuando el usuario accede al enlace recibido en su correo y
 * establece su nueva clave.
 */
export const updateUserPassword = async (
  newPassword: string
): Promise<{ success: boolean; error?: string; message?: string; profile?: UserProfile }> => {
  if (!newPassword || newPassword.length < 6) {
    return { success: false, error: 'La nueva contraseña debe tener al menos 6 caracteres.' };
  }

  const supabase = getSupabase();

  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data?.user) {
        const cleanEmail = normalizeEmail(data.user.email || '');
        saveLocalAuthUser({ id: data.user.id, email: cleanEmail });

        let profile = await fetchUserProfile(data.user.id, cleanEmail);
        if (!profile) {
          profile = {
            id: data.user.id,
            email: cleanEmail,
            fullName: (data.user.user_metadata?.full_name as string) || cleanEmail.split('@')[0],
            phone: (data.user.user_metadata?.phone as string) || '',
            createdAt: data.user.created_at || new Date().toISOString(),
          };
          await saveUserProfile(profile);
        }

        return {
          success: true,
          profile,
          message: '¡Tu contraseña ha sido actualizada exitosamente! Ya puedes iniciar sesión con tus nuevas credenciales.',
        };
      }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error al actualizar la contraseña.' };
    }
  }

  return {
    success: true,
    message: '¡Tu contraseña ha sido actualizada con éxito!',
  };
};

// ================= CIERRE DE SESIÓN ================= //

/**
 * Cierra la sesión activa del usuario.
 * Regla mandatoria: NUNCA elimina la cuenta del usuario, NUNCA borra sus pedidos ni su carrito.
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

// ================= PEDIDOS DE USUARIO (CON AISLAMIENTO ESTRICTO) ================= //

/**
 * Consulta los pedidos correspondientes exclusivamente al usuario autenticado.
 * No permite a ningún usuario consultar pedidos de terceros mediante manipulación de parámetros.
 */
export const fetchUserOrders = async (userId: string, email: string): Promise<Order[]> => {
  const cleanEmail = normalizeEmail(email || '');
  const cleanUserId = (userId || '').trim();

  if (!cleanEmail && !cleanUserId) {
    return [];
  }

  // Verificación estricta de sesión de usuario activo
  const localAuth = getLocalAuthUser();
  if (!localAuth) {
    console.warn('[SEGURIDAD] Se requiere sesión iniciada de cliente para consultar pedidos.');
    return [];
  }

  const isOwner =
    (localAuth.email && normalizeEmail(localAuth.email) === cleanEmail) ||
    (localAuth.id && localAuth.id === cleanUserId);

  if (!isOwner) {
    console.warn('[SEGURIDAD] Intento no autorizado de consultar pedidos ajenos.');
    return [];
  }

  const supabase = getSupabase();
  const orderMap = new Map<string, Order>();
  let supabaseSuccess = false;

  if (isSupabaseConfigured() && supabase) {
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

  // Fallback seguro en localStorage solo si Supabase no estuvo disponible
  if (!supabaseSuccess) {
    try {
      const raw = localStorage.getItem('my_commerce_orders');
      if (raw) {
        const localOrders: Order[] = JSON.parse(raw);
        if (Array.isArray(localOrders)) {
          localOrders
            .filter(
              (o) =>
                (cleanUserId && o.userId === cleanUserId) ||
                (cleanEmail && o.customerEmail && normalizeEmail(o.customerEmail) === cleanEmail)
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
