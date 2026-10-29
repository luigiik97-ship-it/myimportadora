import React, { useState } from 'react';
import { X, Bell, CheckCircle2, Phone, User, ArrowRight } from 'lucide-react';
import { registerStockNotification } from '../../services/stockNotifications';
import { useModalScrollLock } from '../../utils/scrollLock';

interface StockNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  productTitle: string;
  variantId?: string;
  variantName: string;
  userId?: string;
  defaultPhone?: string;
  defaultName?: string;
  alreadyRegisteredDirectly?: boolean;
}

export const StockNotificationModal: React.FC<StockNotificationModalProps> = ({
  isOpen,
  onClose,
  productId,
  productTitle,
  variantId,
  variantName,
  userId,
  defaultPhone = '',
  defaultName = '',
  alreadyRegisteredDirectly = false,
}) => {
  const [phone, setPhone] = useState(defaultPhone);
  const [name, setName] = useState(defaultName);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(alreadyRegisteredDirectly);
  const [errorMessage, setErrorMessage] = useState('');

  // Limpiar y deduplicar nombres repetidos de variante (ej: "Dorado / Dorado" -> "Dorado")
  const displayVariantName = React.useMemo(() => {
    if (!variantName) return 'Estándar';
    const parts = variantName.split(/\s*[\/|,]\s*/).map((p) => p.trim()).filter(Boolean);
    const unique = Array.from(new Set(parts));
    return unique.join(' / ') || variantName;
  }, [variantName]);

  // Update success state when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setIsSuccess(alreadyRegisteredDirectly);
      setPhone(defaultPhone);
      setName(defaultName);
      setErrorMessage('');
    }
  }, [isOpen, alreadyRegisteredDirectly, defaultPhone, defaultName]);

  // Bloqueo de scroll del fondo mientras la ventana modal esté abierta
  useModalScrollLock(isOpen);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const clean = phone.replace(/\D/g, '');
    if (clean.length < 6) {
      setErrorMessage('Por favor ingresá un número de teléfono o WhatsApp válido.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await registerStockNotification({
        productId,
        productTitle,
        variantId,
        variantName,
        phone,
        customerName: name,
        userId,
      });

      if (res.success) {
        setIsSuccess(true);
      } else {
        setErrorMessage(res.error || 'Ocurrió un error al registrar la solicitud.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error al conectar. Intentá nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsSuccess(false);
    setErrorMessage('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botón cerrar */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-900 flex items-center justify-center transition-colors cursor-pointer"
          aria-label="Cerrar modal"
        >
          <X className="w-4 h-4" />
        </button>

        {isSuccess ? (
          /* Estado de confirmación breve */
          <div className="text-center py-4 space-y-3 sm:space-y-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-8 h-8 sm:w-9 sm:h-9" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900">
                ¡Solicitud registrada!
              </h3>
              <p className="text-sm text-gray-700 font-medium max-w-xs mx-auto leading-relaxed">
                Listo. Te avisaremos por WhatsApp cuando vuelva a estar disponible.
              </p>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-left text-gray-600 space-y-0.5">
              <p className="font-semibold text-gray-800 line-clamp-1">{productTitle}</p>
              <p className="text-emerald-700 font-medium">{displayVariantName}</p>
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="w-full py-3 px-4 rounded-xl bg-[#0058bb] hover:bg-[#004bb0] text-white font-bold text-sm transition-all shadow-sm active:scale-[0.99] cursor-pointer"
            >
              Entendido
            </button>
          </div>
        ) : (
          /* Formulario de ingreso de WhatsApp */
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
                <Bell className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base sm:text-lg font-bold text-gray-900 leading-tight">
                  Avísame cuando esté disponible
                </h3>
                <p className="text-xs text-gray-500 truncate">{productTitle}</p>
              </div>
            </div>

            {/* Variante seleccionada */}
            <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl px-3 py-2 text-xs flex items-center justify-between gap-2">
              <span className="text-gray-600 font-medium">Variante:</span>
              <span className="font-bold text-emerald-800 text-right truncate">{displayVariantName}</span>
            </div>

            {/* Teléfono / WhatsApp */}
            <div className="space-y-1.5">
              <label htmlFor="input-whatsapp-notify" className="block text-xs font-bold text-gray-700">
                Tu número de WhatsApp <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Phone className="w-4 h-4 text-emerald-600" />
                </div>
                <input
                  id="input-whatsapp-notify"
                  type="tel"
                  required
                  placeholder="Ej: 11 2345-6789"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all"
                />
              </div>
              <p className="text-[11px] text-gray-500">
                Ingresá tu código de área y número. Solo lo usaremos para avisarte cuando reingrese.
              </p>
            </div>

            {/* Nombre (opcional) */}
            <div className="space-y-1.5">
              <label htmlFor="input-name-notify" className="block text-xs font-semibold text-gray-700">
                Tu nombre (opcional)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="input-name-notify"
                  type="text"
                  placeholder="¿Cómo te llamás?"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all"
                />
              </div>
            </div>

            {errorMessage && (
              <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-semibold">
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Guardando...</span>
              ) : (
                <>
                  <span>Confirmar aviso</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
