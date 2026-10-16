import React, { useState, useEffect } from 'react';
import { X, Mail, Lock, User, Phone, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, ArrowLeft, KeyRound } from 'lucide-react';
import { signInWithEmail, signUpWithEmail, sendPasswordReset, updateUserPassword, normalizeEmail } from '../services/auth';
import { UserProfile } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (profile: UserProfile) => void;
  initialMode?: 'login' | 'register' | 'forgot_password' | 'reset_password';
  prefilledEmail?: string;
  errorMessageFromUrl?: string | null;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
  initialMode = 'login',
  prefilledEmail = '',
  errorMessageFromUrl = null,
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot_password' | 'reset_password'>(initialMode);
  
  // Fields
  const [email, setEmail] = useState(prefilledEmail);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  
  // UI states
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(errorMessageFromUrl || null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isDuplicateEmailError, setIsDuplicateEmailError] = useState(false);

  // Sync mode and prefilled email when initialMode or prefilledEmail prop changes
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      if (prefilledEmail) {
        setEmail(prefilledEmail);
      }
      if (errorMessageFromUrl) {
        setErrorMessage(errorMessageFromUrl);
      }
    }
  }, [initialMode, prefilledEmail, errorMessageFromUrl, isOpen]);

  if (!isOpen) return null;

  const resetFormState = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsDuplicateEmailError(false);
  };

  const handleSwitchMode = (newMode: 'login' | 'register' | 'forgot_password' | 'reset_password') => {
    resetFormState();
    setPassword('');
    setConfirmPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setMode(newMode);
  };

  // 1. INICIAR SESIÓN
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFormState();

    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail || !password) {
      setErrorMessage('Por favor completa todos los campos.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await signInWithEmail(cleanEmail, password);
      if (res.success && res.profile) {
        onAuthSuccess(res.profile);
        onClose();
      } else {
        setErrorMessage(res.error || 'Credenciales inválidas. Verifica tu correo y contraseña.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error al conectar con el servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. CREAR CUENTA (REGISTRO CON IMPEDIMENTO DE DUPLICADOS)
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFormState();

    const cleanEmail = normalizeEmail(email);
    if (!fullName.trim() || !cleanEmail || !password) {
      setErrorMessage('Por favor completa los campos obligatorios (*).');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Las contraseñas no coinciden. Por favor verifica ambos campos.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await signUpWithEmail(cleanEmail, password, {
        fullName: fullName.trim(),
        phone: phone.trim(),
      });

      if (res.isDuplicate) {
        setIsDuplicateEmailError(true);
        setErrorMessage(res.error || 'Este correo ya está registrado. Iniciá sesión o recuperá tu contraseña.');
        return;
      }

      if (res.success && res.profile) {
        if (res.requiresEmailConfirmation) {
          // Requiere confirmación por correo: mostrar aviso claro al usuario
          setSuccessMessage(
            res.message ||
              '¡Cuenta creada con éxito! Supabase ha enviado un enlace a tu correo. Revisa tu bandeja de entrada o spam para activarla antes de iniciar sesión.'
          );
        } else {
          // Sesión activa directa
          onAuthSuccess(res.profile);
          onClose();
        }
      } else {
        setErrorMessage(res.error || 'Error al registrar la cuenta. Por favor intenta nuevamente.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error inesperado al registrar la cuenta.');
    } finally {
      setIsLoading(false);
    }
  };

  // 3. SOLICITAR RECUPERACIÓN DE CONTRASEÑA
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFormState();

    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail) {
      setErrorMessage('Por favor ingresa tu correo electrónico.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await sendPasswordReset(cleanEmail);
      if (res.success) {
        setSuccessMessage(
          res.message ||
            'Si este correo está registrado en nuestro sistema, recibirás un enlace seguro para restablecer tu contraseña.'
        );
      } else {
        setErrorMessage(res.error || 'No se pudo procesar la solicitud.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error al solicitar recuperación.');
    } finally {
      setIsLoading(false);
    }
  };

  // 4. RESTABLECER CONTRASEÑA CON TOKEN RECIBIDO
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFormState();

    if (!newPassword || newPassword.length < 6) {
      setErrorMessage('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setErrorMessage('Las contraseñas no coinciden. Verifica ambos campos.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await updateUserPassword(newPassword);
      if (res.success) {
        setSuccessMessage('¡Contraseña actualizada con éxito! Ya puedes iniciar sesión con tus nuevas credenciales.');
        
        // Limpiar hash de la barra de direcciones para invalidar token en la vista
        if (typeof window !== 'undefined') {
          window.history.replaceState(null, '', window.location.pathname);
        }

        if (res.profile) {
          setTimeout(() => {
            onAuthSuccess(res.profile!);
            onClose();
          }, 1800);
        } else {
          setTimeout(() => {
            handleSwitchMode('login');
          }, 2000);
        }
      } else {
        setErrorMessage(res.error || 'No se pudo actualizar la contraseña. El enlace puede haber expirado.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error al actualizar la contraseña.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-[#0058bb] text-white px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {(mode === 'forgot_password' || mode === 'reset_password') && (
              <button 
                type="button"
                onClick={() => handleSwitchMode('login')}
                className="p-1 -ml-1 text-white/80 hover:text-white rounded-full hover:bg-white/10 transition-colors"
                title="Volver"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <h3 className="font-bold text-lg font-['Montserrat'] tracking-tight">
                {mode === 'login' && 'Iniciar Sesión'}
                {mode === 'register' && 'Crear Cuenta'}
                {mode === 'forgot_password' && 'Recuperar Contraseña'}
                {mode === 'reset_password' && 'Crear Nueva Contraseña'}
              </h3>
              <p className="text-xs text-blue-100">
                {mode === 'login' && 'Accede para ver tus pedidos, datos de envío y comprar más rápido'}
                {mode === 'register' && 'Regístrate para guardar tu carrito y gestionar tus pedidos'}
                {mode === 'forgot_password' && 'Te enviaremos un enlace seguro para restablecer tu clave'}
                {mode === 'reset_password' && 'Introduce y confirma tu nueva clave de acceso'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white rounded-full hover:bg-white/15 transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {/* Alerta de Correo Duplicado con acceso directo a Login y Recuperación */}
          {isDuplicateEmailError && (
            <div className="bg-amber-50 border border-amber-300 text-amber-900 p-4 rounded-xl space-y-3 text-xs animate-in fade-in duration-200">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-sm text-amber-950">Este correo ya está registrado</p>
                  <p className="mt-1 text-amber-800 leading-relaxed">
                    Ya existe una cuenta con la dirección <strong>{normalizeEmail(email)}</strong>. Podés iniciar sesión directamente o recuperar tu contraseña si la olvidaste.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    resetFormState();
                    setMode('login');
                  }}
                  className="flex-1 bg-[#0058bb] hover:bg-[#004799] text-white py-2 px-3 rounded-lg font-semibold text-xs transition-colors cursor-pointer text-center shadow-xs"
                >
                  Iniciá sesión
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetFormState();
                    setMode('forgot_password');
                  }}
                  className="flex-1 bg-white hover:bg-amber-100/70 border border-amber-300 text-amber-950 py-2 px-3 rounded-lg font-semibold text-xs transition-colors cursor-pointer text-center"
                >
                  Recuperar contraseña
                </button>
              </div>
            </div>
          )}

          {/* Mensajes de Error estándar */}
          {errorMessage && !isDuplicateEmailError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3.5 py-2.5 rounded-xl flex items-start gap-2.5 text-xs animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span>{errorMessage}</span>
                {errorMessage.toLowerCase().includes('credenciales') && (
                  <div className="mt-1.5">
                    <button
                      type="button"
                      onClick={() => handleSwitchMode('forgot_password')}
                      className="font-semibold underline text-[#0058bb] hover:text-[#004799] cursor-pointer"
                    >
                      ¿Olvidaste tu contraseña? Restablécela aquí
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Mensajes de Éxito */}
          {successMessage && (
            <div className="bg-green-50 border border-green-200 text-green-800 px-3.5 py-2.5 rounded-xl flex items-start gap-2.5 text-xs animate-in fade-in duration-200">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-green-600" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* MODE 1: LOGIN */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ejemplo@correo.com"
                    autoComplete="email"
                    className="w-full border border-gray-300 rounded-lg pl-10 pr-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0058bb] focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-gray-700">
                    Contraseña
                  </label>
                  <button
                    type="button"
                    onClick={() => handleSwitchMode('forgot_password')}
                    className="text-xs text-[#0058bb] hover:underline font-medium cursor-pointer"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full border border-gray-300 rounded-lg pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0058bb] focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#0058bb] hover:bg-[#004799] text-white font-semibold py-2.5 px-4 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 text-sm mt-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Iniciando sesión...</span>
                  </>
                ) : (
                  <span>Iniciar Sesión</span>
                )}
              </button>

              <div className="pt-2 text-center border-t border-gray-100 text-xs text-gray-600">
                ¿No tienes una cuenta?{' '}
                <button
                  type="button"
                  onClick={() => handleSwitchMode('register')}
                  className="text-[#0058bb] font-semibold hover:underline cursor-pointer"
                >
                  Regístrate aquí
                </button>
              </div>
            </form>
          )}

          {/* MODE 2: REGISTER */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Nombre y Apellido Completo *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ej: Alejandro Yugar"
                    autoComplete="name"
                    className="w-full border border-gray-300 rounded-lg pl-10 pr-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0058bb] focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Correo Electrónico *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="correo@ejemplo.com"
                    autoComplete="email"
                    className="w-full border border-gray-300 rounded-lg pl-10 pr-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0058bb] focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  WhatsApp (Opcional para avisos de entrega)
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="1123456789"
                    autoComplete="tel"
                    className="w-full border border-gray-300 rounded-lg pl-10 pr-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0058bb] focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Contraseña *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mín. 6 caracteres"
                      autoComplete="new-password"
                      className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#0058bb] focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Confirmar Contraseña *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repite la clave"
                      autoComplete="new-password"
                      className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#0058bb] focus:border-transparent transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500 pt-0.5">
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showPassword}
                    onChange={(e) => setShowPassword(e.target.checked)}
                    className="rounded text-[#0058bb] focus:ring-[#0058bb]"
                  />
                  <span>Mostrar contraseñas</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#0058bb] hover:bg-[#004799] text-white font-semibold py-2.5 px-4 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 text-sm mt-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Creando cuenta segura...</span>
                  </>
                ) : (
                  <span>Registrarme</span>
                )}
              </button>

              <div className="pt-2 text-center border-t border-gray-100 text-xs text-gray-600">
                ¿Ya tienes una cuenta?{' '}
                <button
                  type="button"
                  onClick={() => handleSwitchMode('login')}
                  className="text-[#0058bb] font-semibold hover:underline cursor-pointer"
                >
                  Inicia sesión aquí
                </button>
              </div>
            </form>
          )}

          {/* MODE 3: FORGOT PASSWORD */}
          {mode === 'forgot_password' && (
            <form onSubmit={handleForgotPassword} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Correo Electrónico de tu cuenta
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="correo@ejemplo.com"
                    autoComplete="email"
                    className="w-full border border-gray-300 rounded-lg pl-10 pr-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0058bb] focus:border-transparent transition-all"
                  />
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  Te enviaremos un enlace temporal seguro para crear una nueva clave sin exponer datos privados.
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#0058bb] hover:bg-[#004799] text-white font-semibold py-2.5 px-4 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 text-sm"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Enviando enlace seguro...</span>
                  </>
                ) : (
                  <span>Enviar correo de recuperación</span>
                )}
              </button>

              <div className="pt-2 text-center border-t border-gray-100 text-xs text-gray-600">
                <button
                  type="button"
                  onClick={() => handleSwitchMode('login')}
                  className="text-[#0058bb] font-semibold hover:underline flex items-center justify-center gap-1 mx-auto cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Volver a iniciar sesión
                </button>
              </div>
            </form>
          )}

          {/* MODE 4: RESET PASSWORD (FORMULARIO PARA ESTABLECER NUEVA CLAVE) */}
          {mode === 'reset_password' && (
            <form onSubmit={handleResetPassword} className="space-y-3.5 animate-in fade-in duration-200">
              <div className="bg-blue-50/70 border border-blue-200 text-blue-900 p-3 rounded-xl text-xs flex items-start gap-2">
                <KeyRound className="w-4 h-4 text-[#0058bb] shrink-0 mt-0.5" />
                <span>
                  Has verificado tu enlace de recuperación. Ingresa a continuación tu nueva contraseña segura.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Nueva Contraseña *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    autoComplete="new-password"
                    className="w-full border border-gray-300 rounded-lg pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0058bb] focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Confirmar Nueva Contraseña *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Repite la nueva contraseña"
                    autoComplete="new-password"
                    className="w-full border border-gray-300 rounded-lg pl-10 pr-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0058bb] focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#0058bb] hover:bg-[#004799] text-white font-semibold py-2.5 px-4 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 text-sm mt-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Guardando contraseña...</span>
                  </>
                ) : (
                  <span>Guardar nueva contraseña</span>
                )}
              </button>

              <div className="pt-2 text-center border-t border-gray-100 text-xs text-gray-600">
                <button
                  type="button"
                  onClick={() => handleSwitchMode('login')}
                  className="text-[#0058bb] font-semibold hover:underline flex items-center justify-center gap-1 mx-auto cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Ir a iniciar sesión
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
