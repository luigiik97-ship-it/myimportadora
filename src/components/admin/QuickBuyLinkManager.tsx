import React, { useState, useEffect } from 'react';
import {
  Link2,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  Zap,
  ShoppingBag,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Clock,
  Sparkles,
  Sliders,
  CheckCircle2
} from 'lucide-react';
import { Order } from '../../types';
import {
  getQuickBuyLinkConfig,
  fetchQuickBuyLinkConfigFromSupabase,
  saveQuickBuyLinkConfig,
  generateUniqueToken,
  buildQuickBuyUrl,
  QuickBuyLinkConfig,
  buildQuickBuyWhatsAppMessage,
  buildQuickBuyWhatsAppUrl,
  resolveWhatsAppPhone,
  isQuickBuyOrder
} from '../../services/quickBuyLink';

// Ícono Oficial SVG de WhatsApp (Vector fiel oficial)
export const OfficialWhatsAppIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.05 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
  </svg>
);

interface QuickBuyLinkManagerProps {
  orders: Order[];
  onViewOrder?: (order: Order) => void;
}

export const QuickBuyLinkManager: React.FC<QuickBuyLinkManagerProps> = ({
  orders,
  onViewOrder
}) => {
  const [config, setConfig] = useState<QuickBuyLinkConfig>(getQuickBuyLinkConfig());
  const [copied, setCopied] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [customTokenInput, setCustomTokenInput] = useState(config.token);
  const [whatsappUrlInput, setWhatsappUrlInput] = useState(config.whatsappUrl);
  const [isEditingSettings, setIsEditingSettings] = useState(false);

  useEffect(() => {
    fetchQuickBuyLinkConfigFromSupabase().then((remoteConfig) => {
      setConfig(remoteConfig);
    });
  }, []);

  useEffect(() => {
    setCustomTokenInput(config.token);
    setWhatsappUrlInput(config.whatsappUrl);
  }, [config]);

  // Construir la URL completa del enlace
  const generatedUrl = buildQuickBuyUrl(config.token);

  // Copiar al portapapeles
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(generatedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      // Fallback manual
      const textArea = document.createElement('textarea');
      textArea.value = generatedUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  // Toggle activo / pausado
  const handleToggleActive = () => {
    const updated = saveQuickBuyLinkConfig({
      isActive: !config.isActive,
    });
    setConfig(updated);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  // Regenerar un nuevo identificador único
  const handleRegenerateToken = () => {
    if (
      window.confirm(
        '¿Deseas generar un nuevo enlace único? El enlace anterior dejará de abrir la tienda en modo WhatsApp.'
      )
    ) {
      const newToken = generateUniqueToken();
      const updated = saveQuickBuyLinkConfig({
        token: newToken,
      });
      setConfig(updated);
      setCustomTokenInput(newToken);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    }
  };

  // Guardar configuración manual
  const handleSaveCustomSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanToken = customTokenInput.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'whatsapp';
    const cleanWa = whatsappUrlInput.trim() || 'https://wa.me/message/TSF5H4YUIQJOC1';

    const updated = saveQuickBuyLinkConfig({
      token: cleanToken,
      whatsappUrl: cleanWa,
    });
    setConfig(updated);
    setIsEditingSettings(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  // Filtrar pedidos generados por Compra Rápida WhatsApp de forma exhaustiva
  const safeOrders = Array.isArray(orders) ? orders : [];
  const quickBuyOrders = safeOrders.filter(isQuickBuyOrder);

  // Mensaje de WhatsApp de ejemplo para la vista previa
  const sampleOrderNumber = '1001';
  const sampleItems = [
    { title: 'Remera Algodón Premium', quantity: 1, variantText: 'Negro, L, 13mm', unitPrice: 10000, totalPrice: 10000 },
    { title: 'Remera Algodón Premium', quantity: 1, variantText: 'Negro, M', unitPrice: 15000, totalPrice: 15000 },
    { title: 'Gorra Clásica Gabardina', quantity: 1, variantText: 'Azul Marino', unitPrice: 8500, totalPrice: 8500 },
  ];
  const sampleTotal = 33500;
  const sampleMessage = buildQuickBuyWhatsAppMessage({
    orderNumber: sampleOrderNumber,
    items: sampleItems,
    total: sampleTotal,
    deliveryOption: 'pickup',
    paymentMethod: 'cash',
  });

  return (
    <div className="space-y-6">
      {/* Header Informativo */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200/80 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100 shadow-xs">
              <OfficialWhatsAppIcon className="w-7 h-7 text-[#25D366]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black text-gray-900 font-['Montserrat'] tracking-tight">
                  Enlace Personalizado para Compra Rápida
                </h2>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                    config.isActive
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-amber-100 text-amber-800 border border-amber-200'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${config.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                  {config.isActive ? 'Activo' : 'Pausado'}
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-1 max-w-2xl leading-relaxed">
                Genera y comparte un enlace único que abre la tienda en modo <strong>Compra Rápida</strong>.
                Solo los clientes que ingresen mediante este enlace verán el botón verde oficial de <strong>WhatsApp</strong> para enviar su pedido directo,
                con número correlativo automático y registro instantáneo en la base de datos.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleToggleActive}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer flex items-center gap-2 shadow-xs ${
                config.isActive
                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              <Zap className="w-4 h-4" />
              {config.isActive ? 'Pausar Enlace' : 'Activar Enlace'}
            </button>
          </div>
        </div>
      </div>

      {/* Alerta de Éxito al Guardar */}
      {saveSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl flex items-center gap-2 text-sm animate-fade-in shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>Configuración del enlace actualizada exitosamente.</span>
        </div>
      )}

      {/* Tarjeta Principal: Generador y Copiado de Enlace */}
      <div className="bg-white p-5 sm:p-7 rounded-2xl border border-gray-200/90 shadow-xs space-y-6">
        <div>
          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
            <label className="text-xs sm:text-sm font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
              <Link2 className="w-4 h-4 text-[#0058bb]" />
              Tu Enlace Único de Compra Rápida
            </label>
            <span className="text-xs text-gray-500">
              Compatible con Instagram, WhatsApp, TikTok y campañas
            </span>
          </div>

          {/* Caja con la URL y botones de acción rápida */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 p-2 bg-gray-50 rounded-2xl border border-gray-200">
            <div className="flex-1 px-3 py-2 text-xs sm:text-sm font-mono text-gray-800 break-all select-all font-medium bg-white rounded-xl border border-gray-200/80 shadow-inner">
              {generatedUrl}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Botón Copiar */}
              <button
                type="button"
                onClick={handleCopyLink}
                className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs ${
                  copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[#0058bb] hover:bg-[#004bb0] text-white active:scale-95'
                }`}
                title="Copiar enlace al portapapeles"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>¡Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copiar Enlace</span>
                  </>
                )}
              </button>

              {/* Botón Probar Enlace */}
              <a
                href={generatedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                title="Abrir y probar cómo lo ve el cliente"
              >
                <ExternalLink className="w-4 h-4 text-gray-600" />
                <span className="hidden sm:inline">Probar</span>
              </a>

              {/* Botón Regenerar Token */}
              <button
                type="button"
                onClick={handleRegenerateToken}
                className="px-3 py-2.5 rounded-xl text-gray-500 hover:text-gray-800 hover:bg-gray-200/70 transition-colors cursor-pointer"
                title="Generar un nuevo código/token único"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Indicador de compatibilidad de enlace público */}
          <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50/80 px-3 py-1.5 rounded-lg border border-emerald-100 mt-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>Enlace Público Universal:</strong> Compatible para abrir en cualquier navegador móvil (Safari, Chrome, etc.), ventana de incógnito o escritorio sin requerir login ni arrojar error 403.
            </span>
          </div>
        </div>

        {/* Opciones de Administración Avanzada (Colapsable / Toggle) */}
        <div className="pt-3 border-t border-gray-100">
          <button
            type="button"
            onClick={() => setIsEditingSettings(!isEditingSettings)}
            className="text-xs sm:text-sm font-bold text-[#0058bb] hover:text-[#004bb0] flex items-center gap-1.5 cursor-pointer"
          >
            <Sliders className="w-4 h-4" />
            <span>{isEditingSettings ? 'Ocultar Opciones de Configuración' : 'Personalizar Código y Destino WhatsApp'}</span>
          </button>

          {isEditingSettings && (
            <form onSubmit={handleSaveCustomSettings} className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-4 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Identificador / Token Personalizado (slug):
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 font-mono">?cr=</span>
                    <input
                      type="text"
                      value={customTokenInput}
                      onChange={(e) => setCustomTokenInput(e.target.value)}
                      placeholder="whatsapp"
                      className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0058bb]"
                    />
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Define la palabra o código único en la URL. Ej: <code>whatsapp</code>, <code>vip</code>, <code>promo</code>.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Enlace de Destino WhatsApp:
                  </label>
                  <input
                    type="url"
                    value={whatsappUrlInput}
                    onChange={(e) => setWhatsappUrlInput(e.target.value)}
                    placeholder="https://wa.me/message/TSF5H4YUIQJOC1"
                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0058bb]"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    Predeterminado: <code>https://wa.me/message/TSF5H4YUIQJOC1</code> (Número resuelto: <code>+{resolveWhatsAppPhone(whatsappUrlInput)}</code>)
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditingSettings(false)}
                  className="px-3.5 py-1.5 text-xs font-bold text-gray-600 hover:text-gray-800 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-[#0058bb] hover:bg-[#004bb0] text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Grid: Comparativa Visual de Botones y Vista Previa de WhatsApp */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Columna Izquierda: Comparativa Visual de la Tienda */}
        <div className="lg:col-span-6 bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h3 className="text-base font-bold text-gray-900 font-['Montserrat']">
              Comparativa Visual del Botón "Comprar"
            </h3>
          </div>
          <p className="text-xs text-gray-600">
            Asegura que el enlace personalizado funcione de forma 100% independiente, sin alterar la experiencia del resto de usuarios:
          </p>

          <div className="space-y-3 pt-2">
            {/* Caso 1: Resto de la tienda (Normal) */}
            <div className="p-4 rounded-xl border border-gray-200 bg-gray-50 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-gray-700">1. Resto de la tienda / Acceso normal:</span>
                <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-semibold text-[10px]">
                  Flujo Estándar
                </span>
              </div>
              <p className="text-[11px] text-gray-500">
                Mantiene el botón azul actual y dirige al checkout habitual con formulario completo.
              </p>
              <div className="pt-2 flex justify-center">
                <div className="bg-[#0058bb] text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-xs cursor-default">
                  <span>Comprar</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Caso 2: Mediante el enlace personalizado */}
            <div className="p-4 rounded-xl border-2 border-emerald-200 bg-emerald-50/50 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-black text-emerald-950 flex items-center gap-1.5">
                  <OfficialWhatsAppIcon className="w-4 h-4 text-[#25D366]" />
                  2. Accediendo con tu enlace único:
                </span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-200 text-emerald-900 font-black text-[10px]">
                  Modo WhatsApp
                </span>
              </div>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                Solo con este enlace se activa el fondo verde oficial de WhatsApp. Al hacer clic, genera el número correlativo, guarda el pedido en la base de datos y abre WhatsApp con el mensaje listo.
              </p>
              <div className="pt-2 flex justify-center">
                <div className="bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-sm cursor-default transition-all">
                  <OfficialWhatsAppIcon className="w-5 h-5 text-white shrink-0" />
                  <span>Comprar</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Columna Derecha: Vista Previa del Mensaje de WhatsApp Generado */}
        <div className="lg:col-span-6 bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <OfficialWhatsAppIcon className="w-5 h-5 text-[#25D366]" />
              <h3 className="text-base font-bold text-gray-900 font-['Montserrat']">
                Mensaje Automático de WhatsApp
              </h3>
            </div>
            <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
              Preformateado
            </span>
          </div>

          <p className="text-xs text-gray-600">
            Comienza estrictamente con el número de pedido único, seguido del listado completo de productos, cantidades y el total:
          </p>

          {/* Simulación visual de burbuja de chat de WhatsApp */}
          <div className="bg-[#e5ddd5] p-3 sm:p-4 rounded-2xl border border-[#d1c7b7] shadow-inner font-sans">
            <div className="max-w-[380px] bg-[#dcf8c6] p-3.5 rounded-xl rounded-tr-none shadow-xs text-xs sm:text-sm text-gray-900 whitespace-pre-line leading-relaxed border border-[#c2e4a8]">
              {sampleMessage}
              <div className="text-right text-[10px] text-gray-500 mt-2 flex items-center justify-end gap-1">
                <span>12:45</span>
                <span className="text-blue-500 font-bold">✓✓</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
            <div className="flex items-center gap-2 text-[11px] text-gray-500">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>El pedido se guarda inmediatamente en el sistema antes de abrir WhatsApp.</span>
            </div>
            <a
              href={buildQuickBuyWhatsAppUrl(sampleMessage, config.whatsappUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold transition-colors cursor-pointer border border-emerald-200 shrink-0 w-fit"
              title="Abre WhatsApp en nueva pestaña con el mensaje de prueba codificado"
            >
              <OfficialWhatsAppIcon className="w-4 h-4 text-[#25D366]" />
              <span>Probar en WhatsApp</span>
              <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
            </a>
          </div>
        </div>
      </div>

      {/* Historial de Pedidos de Compra Rápida / WhatsApp */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-[#0058bb]" />
            <h3 className="text-base font-bold text-gray-900 font-['Montserrat']">
              Pedidos Recibidos por Compra Rápida ({quickBuyOrders.length})
            </h3>
          </div>
          <span className="text-xs text-gray-500">
            Registrados con número correlativo en la base de datos
          </span>
        </div>

        {quickBuyOrders.length === 0 ? (
          <div className="text-center py-8 px-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-[#25D366] flex items-center justify-center mx-auto mb-3">
              <OfficialWhatsAppIcon className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-gray-800">Aún no hay pedidos registrados por este enlace</p>
            <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
              Comparte tu enlace único de Compra Rápida. Cuando los clientes hagan clic en el botón verde "Comprar", sus pedidos aparecerán aquí automáticamente con su correlativo.
            </p>
            <button
              type="button"
              onClick={handleCopyLink}
              className="mt-4 inline-flex items-center gap-2 bg-[#0058bb] hover:bg-[#004bb0] text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copiar Enlace para Compartir</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-600 uppercase tracking-wider font-semibold border-b border-gray-200">
                  <th className="p-3"># Pedido</th>
                  <th className="p-3">Fecha</th>
                  <th className="p-3">Origen</th>
                  <th className="p-3">Productos</th>
                  <th className="p-3">Total</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {quickBuyOrders.map((ord) => {
                  const itemsCount = ord.items ? ord.items.reduce((acc, i) => acc + i.quantity, 0) : 0;
                  return (
                    <tr key={ord.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="p-3 font-bold text-gray-900 font-mono">
                        #{ord.orderNumber}
                      </td>
                      <td className="p-3 text-gray-600 whitespace-nowrap">
                        {new Date(ord.createdAt).toLocaleDateString('es-AR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          <OfficialWhatsAppIcon className="w-3 h-3 text-[#25D366]" />
                          WhatsApp
                        </span>
                      </td>
                      <td className="p-3 text-gray-700 max-w-[200px] truncate" title={ord.items?.map(i => `${i.quantity}x ${i.title}`).join(', ')}>
                        <span className="font-semibold">{itemsCount} unids.</span> ({ord.items?.[0]?.title || 'Productos'})
                      </td>
                      <td className="p-3 font-bold text-gray-900 font-mono">
                        $ {ord.total.toLocaleString('es-AR')}
                      </td>
                      <td className="p-3">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-50 text-amber-800 border border-amber-200">
                          {ord.status === 'pending_payment' ? 'Pendiente' : ord.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        {onViewOrder && (
                          <button
                            type="button"
                            onClick={() => onViewOrder(ord)}
                            className="text-[#0058bb] hover:underline font-bold text-xs cursor-pointer"
                          >
                            Ver Detalle
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
