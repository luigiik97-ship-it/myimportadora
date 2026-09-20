import React, { useRef, useState } from 'react';
import { Download, Share2, Loader2, CheckCircle2, Info, Store, Truck, CreditCard, Banknote } from 'lucide-react';
import html2canvas from 'html2canvas';
import { OfficialWhatsAppIcon } from '../admin/QuickBuyLinkManager';
import {
  getDirectWhatsAppChatUrl,
  triggerWhatsAppOpen,
  normalizeVariantText,
} from '../../services/quickBuyLink';

export interface PostPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: {
    orderNumber: string;
    total: number;
    subtotal?: number;
    itemsCount?: number;
    totalUnits?: number;
    paymentMethod?: 'transfer' | 'cash';
    deliveryOption?: 'pickup' | 'delivery' | null;
    shippingMethodName?: string;
    shippingCost?: number;
    cashDiscount?: number;
    customerName?: string;
    customerWhatsapp?: string;
    customerEmail?: string;
    deliveryAddress?: {
      street?: string;
      number?: string;
      floor?: string;
      city?: string;
      province?: string;
      postalCode?: string;
      receiverName?: string;
    };
    items?: Array<{
      id?: string;
      title: string;
      image?: string;
      variantText?: string;
      quantity: number;
      unitPrice: number;
      totalPrice?: number;
      isWholesale?: boolean;
    }>;
  };
  onContinueShopping?: () => void;
}

export const PostPurchaseModal: React.FC<PostPurchaseModalProps> = ({
  isOpen,
  onClose,
  order,
  onContinueShopping,
}) => {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [shareSuccessToast, setShareSuccessToast] = useState<string | null>(null);

  if (!isOpen || !order) return null;

  const safeItems = Array.isArray(order.items) ? order.items : [];
  const totalUnits =
    order.totalUnits ??
    safeItems.reduce((acc, item) => acc + (item.quantity || 1), 0);
  const itemsCount = order.itemsCount ?? safeItems.length;

  // Botón 1: Contactar por WhatsApp (abre directamente a 1166904678 sin mensajes prellenados)
  const handleContactWhatsApp = () => {
    const waUrl = getDirectWhatsAppChatUrl();
    triggerWhatsAppOpen(waUrl);
  };

  // Helper para generar el canvas y blob de la imagen del resumen
  const generateReceiptBlob = async (): Promise<Blob | null> => {
    if (!receiptRef.current) return null;
    try {
      setIsGeneratingImage(true);
      const canvas = await html2canvas(receiptRef.current, {
        scale: 2, // 2x para nitidez Retina en celulares y WhatsApp
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        imageTimeout: 6000,
      });

      return new Promise<Blob | null>((resolve) => {
        canvas.toBlob(
          (blob) => {
            resolve(blob);
          },
          'image/png',
          0.95
        );
      });
    } catch (err) {
      console.error('Error generando imagen de resumen con html2canvas:', err);
      return null;
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // Botón 2: Descargar imagen del resumen
  const handleDownloadImage = async () => {
    const blob = await generateReceiptBlob();
    if (!blob) {
      alert('No se pudo generar la imagen del resumen. Por favor intenta nuevamente.');
      return;
    }

    const fileName = `Pedido-${order.orderNumber}-Resumen.png`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    setShareSuccessToast('¡Imagen descargada con éxito! Ya puedes compartirla.');
    setTimeout(() => setShareSuccessToast(null), 4000);
  };

  // Botón 3: Compartir imagen del resumen por WhatsApp
  const handleShareImage = async () => {
    const blob = await generateReceiptBlob();
    if (!blob) {
      alert('No se pudo procesar la imagen del resumen. Por favor intenta nuevamente.');
      return;
    }

    const fileName = `Pedido-${order.orderNumber}-Resumen.png`;
    const file = new File([blob], fileName, { type: 'image/png' });

    // En móviles (Android / iOS), navigator.share permite compartir directamente a WhatsApp con la imagen adjunta
    if (
      typeof navigator !== 'undefined' &&
      navigator.canShare &&
      navigator.canShare({ files: [file] })
    ) {
      try {
        await navigator.share({
          files: [file],
          title: `Resumen Pedido #${order.orderNumber}`,
          text: `Hola, te comparto el resumen de mi Pedido #${order.orderNumber}.`,
        });
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          return; // Usuario canceló el modal nativo
        }
        console.warn('Error en navigator.share:', err);
      }
    }

    // Fallback para escritorio / navegadores sin soporte de share con archivos:
    // Descarga la imagen y abre automáticamente el chat de WhatsApp oficial
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    setShareSuccessToast('¡Imagen descargada! Ya abrimos WhatsApp para que la adjuntes.');
    setTimeout(() => setShareSuccessToast(null), 5000);

    // Abrir WhatsApp directamente
    setTimeout(() => {
      triggerWhatsAppOpen(getDirectWhatsAppChatUrl());
    }, 400);
  };

  // Determinar distribución adaptable en el resumen según la cantidad de productos
  // Pocos productos (<=4): 1 columna amplia
  // Medianos (5-10): 2 columnas compactas
  // Muchos (>10): 3 columnas extra compactas
  const itemsGridCols =
    safeItems.length <= 4
      ? 'grid-cols-1 gap-2.5'
      : safeItems.length <= 10
      ? 'grid-cols-2 gap-2'
      : 'grid-cols-3 gap-1.5';

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      {/* Tarjeta Modal Post-Compra */}
      <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 text-center shadow-2xl space-y-4 animate-scale-up border border-emerald-100 my-auto">
        {/* Ícono Oficial de WhatsApp */}
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-[#25D366] flex items-center justify-center mx-auto border border-emerald-100 shadow-xs">
          <OfficialWhatsAppIcon className="w-10 h-10" />
        </div>

        <div>
          <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full uppercase tracking-wider mb-2">
            ¡Pedido Registrado con Éxito!
          </span>
          <h3 className="text-2xl font-black text-gray-900 font-['Montserrat']">
            Pedido #{order.orderNumber}
          </h3>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            Tu pedido ha quedado registrado con su número correlativo asignado.
          </p>
        </div>

        {/* Resumen numérico rápido */}
        <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-700 flex justify-between items-center font-medium border border-gray-200/80">
          <span>
            {totalUnits} {totalUnits === 1 ? 'unidad' : 'unidades'} ({itemsCount}{' '}
            {itemsCount === 1 ? 'producto' : 'productos'})
          </span>
          <span className="font-bold text-sm text-gray-900 font-mono">
            $ {Math.round(order.total).toLocaleString('es-AR')}
          </span>
        </div>

        {/* Aviso instructivo claro (Requisito 4) */}
        <div className="bg-blue-50/90 border border-blue-200/90 rounded-xl p-3 text-left text-xs sm:text-sm text-blue-950 space-y-1 shadow-2xs">
          <div className="flex items-center gap-1.5 font-bold text-blue-900 text-xs sm:text-sm">
            <Info className="w-4 h-4 text-[#0058bb] shrink-0" />
            <span>¿Querés enviar el resumen completo?</span>
          </div>
          <p className="text-blue-800 text-[11px] sm:text-xs leading-relaxed">
            Tu pedido ya fue notificado con un mensaje corto. Si deseas enviarnos el listado completo con variantes y cantidades,{' '}
            <strong>descargá la imagen del resumen</strong> y <strong>compartila por WhatsApp</strong>.
          </p>
        </div>

        {/* Notificación de feedback (toast) */}
        {shareSuccessToast && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-2.5 rounded-xl font-medium flex items-center justify-center gap-1.5 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{shareSuccessToast}</span>
          </div>
        )}

        {/* Los 3 Botones Solicitados (Requisito 2) */}
        <div className="space-y-2.5 pt-1">
          {/* BOTÓN 1: Contactar por WhatsApp (Abre directamente sin mensajes escritos) */}
          <button
            type="button"
            id="modal-btn-contact-whatsapp"
            onClick={handleContactWhatsApp}
            className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-sm py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition-all cursor-pointer min-h-[46px]"
          >
            <OfficialWhatsAppIcon className="w-5 h-5 text-white shrink-0" />
            <span>Contactar por WhatsApp</span>
          </button>

          {/* BOTÓN 2: Descargar imagen del resumen */}
          <button
            type="button"
            id="modal-btn-download-receipt"
            onClick={handleDownloadImage}
            disabled={isGeneratingImage}
            className="w-full bg-[#0058bb] hover:bg-[#004bb0] text-white font-bold text-sm py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition-all cursor-pointer disabled:opacity-60 min-h-[46px]"
          >
            {isGeneratingImage ? (
              <Loader2 className="w-5 h-5 animate-spin text-white" />
            ) : (
              <Download className="w-5 h-5 text-white shrink-0" />
            )}
            <span>{isGeneratingImage ? 'Generando imagen...' : 'Descarga imagen del resumen'}</span>
          </button>

          {/* BOTÓN 3: Compartir imagen del resumen por WhatsApp */}
          <button
            type="button"
            id="modal-btn-share-receipt"
            onClick={handleShareImage}
            disabled={isGeneratingImage}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition-all cursor-pointer disabled:opacity-60 min-h-[46px]"
          >
            {isGeneratingImage ? (
              <Loader2 className="w-5 h-5 animate-spin text-white" />
            ) : (
              <Share2 className="w-5 h-5 text-emerald-400 shrink-0" />
            )}
            <span>Compartir imagen del resumen por WhatsApp</span>
          </button>

          {/* Botón de cierre */}
          <button
            type="button"
            id="modal-btn-close"
            onClick={() => {
              onClose();
              if (onContinueShopping) onContinueShopping();
            }}
            className="w-full py-2.5 text-xs text-gray-500 hover:text-gray-800 font-semibold transition-colors cursor-pointer"
          >
            Cerrar y seguir explorando
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PLANTILLA DE IMAGEN DEL RESUMEN (Mobile-First, Adaptable, No de Escritorio) */}
      {/* Ubicada fuera de la pantalla visible para captura perfecta con html2canvas   */}
      {/* ========================================================================= */}
      <div
        style={{
          position: 'fixed',
          left: '-9999px',
          top: 0,
          width: '540px',
          maxWidth: '540px',
          zIndex: -1,
        }}
        aria-hidden="true"
      >
        <div
          ref={receiptRef}
          style={{ width: '540px' }}
          className="bg-white text-gray-900 p-5 rounded-none border border-gray-300 font-sans shadow-none space-y-4"
        >
          {/* Header de la tienda */}
          <div className="border-b-2 border-gray-900 pb-3 text-center space-y-1">
            <div className="flex items-center justify-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#0058bb]" />
              <h1 className="text-xl font-black text-gray-900 tracking-tight font-['Montserrat']">
                MY IMPORTADORA
              </h1>
              <span className="w-3 h-3 rounded-full bg-[#00a650]" />
            </div>
            <p className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">
              Av. San Pedrito 28 local 4, CABA • WhatsApp: 1166904678
            </p>
          </div>

          {/* Encabezado del Pedido */}
          <div className="bg-slate-900 text-white rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                COMPROBANTE DE COMPRA
              </span>
              <h2 className="text-xl font-black text-white font-['Montserrat']">
                Pedido #{order.orderNumber}
              </h2>
            </div>
            <div className="text-right text-[11px] text-slate-300">
              <span className="block font-bold">
                {new Date().toLocaleDateString('es-AR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })}
              </span>
              <span>
                {new Date().toLocaleTimeString('es-AR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                hs
              </span>
            </div>
          </div>

          {/* Datos del Cliente y Modalidad */}
          <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50 rounded-xl p-3 border border-gray-200">
            <div>
              <span className="text-[10px] uppercase text-gray-500 font-bold block">Cliente:</span>
              <p className="font-bold text-gray-900 truncate">
                {order.customerName || 'Cliente'}
              </p>
              {order.customerWhatsapp && (
                <p className="text-[11px] text-gray-600">WA: {order.customerWhatsapp}</p>
              )}
            </div>

            <div>
              <span className="text-[10px] uppercase text-gray-500 font-bold block">Forma de Pago:</span>
              <p className="font-bold text-gray-900">
                {order.paymentMethod === 'transfer' ? 'Transferencia Bancaria' : 'Efectivo'}
              </p>
              {order.paymentMethod === 'transfer' && (
                <p className="text-[10px] text-[#0058bb] font-bold">
                  Alias: hola.retiro (Silvia Lembo)
                </p>
              )}
            </div>

            <div className="col-span-2 pt-1 border-t border-gray-200/80 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase text-gray-500 font-bold block">Entrega:</span>
                <p className="font-semibold text-gray-800">
                  {order.deliveryOption === 'pickup'
                    ? 'Retiro en Local (San Pedrito 28 local 4, Flores)'
                    : `Envío a domicilio (${order.shippingMethodName || 'A coordinar'})`}
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase text-gray-500 font-bold block">Total Unidades:</span>
                <span className="text-sm font-black text-[#0058bb]">{totalUnits} un.</span>
              </div>
            </div>
          </div>

          {/* LISTADO DE PRODUCTOS (Destaca unidades y variantes con distribución adaptable) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b border-gray-200 pb-1.5">
              <h3 className="text-xs font-black uppercase text-gray-800 tracking-wider font-['Montserrat']">
                Detalle de Productos ({safeItems.length})
              </h3>
              <span className="text-[11px] font-bold text-gray-500">
                {totalUnits} unidades en total
              </span>
            </div>

            {/* Grid adaptable: 1, 2 o 3 columnas según cantidad de productos */}
            <div className={`grid ${itemsGridCols}`}>
              {safeItems.map((item, idx) => {
                const itemTotal = item.totalPrice ?? item.unitPrice * item.quantity;
                const cleanVariant = normalizeVariantText(item.variantText);

                return (
                  <div
                    key={item.id || idx}
                    className="bg-gray-50/90 rounded-lg p-2 border border-gray-200/90 flex flex-col justify-between space-y-1.5"
                  >
                    <div className="space-y-1">
                      {/* Destacar unidades con badge de alto contraste */}
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="bg-[#0058bb] text-white text-[11px] font-black px-2 py-0.5 rounded tracking-wide shrink-0">
                          {item.quantity} UNIDAD{item.quantity > 1 ? 'ES' : ''}
                        </span>
                        <span className="font-mono text-xs font-bold text-gray-900">
                          ${Math.round(itemTotal).toLocaleString('es-AR')}
                        </span>
                      </div>

                      {/* Título del producto */}
                      <p className="text-[11px] font-bold text-gray-900 leading-snug line-clamp-2">
                        {item.title}
                      </p>

                      {/* Destacar variante claramente */}
                      {cleanVariant && (
                        <div className="bg-amber-100/90 border border-amber-300/80 rounded px-1.5 py-0.5">
                          <span className="text-[10px] font-bold text-amber-950 block">
                            Var: {cleanVariant}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="pt-1 border-t border-gray-200/60 text-[10px] text-gray-500 flex justify-between">
                      <span>Unitario:</span>
                      <span className="font-semibold text-gray-700">
                        ${Math.round(item.unitPrice).toLocaleString('es-AR')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* TOTALES Y FORMA DE PAGO */}
          <div className="bg-gray-100/90 rounded-xl p-3 space-y-2 border border-gray-200">
            <div className="flex justify-between text-xs text-gray-700">
              <span>Subtotal Productos:</span>
              <span className="font-semibold">
                ${Math.round(order.subtotal || order.total).toLocaleString('es-AR')}
              </span>
            </div>

            {order.shippingCost !== undefined && order.deliveryOption === 'delivery' && (
              <div className="flex justify-between text-xs text-gray-700">
                <span>Costo de Envío:</span>
                <span className="font-semibold">
                  {order.shippingCost === 0 ? 'Gratis' : `$${Math.round(order.shippingCost).toLocaleString('es-AR')}`}
                </span>
              </div>
            )}

            {order.cashDiscount && order.cashDiscount > 0 ? (
              <div className="flex justify-between text-xs text-emerald-700 font-semibold">
                <span>Descuento Efectivo:</span>
                <span>-${Math.round(order.cashDiscount).toLocaleString('es-AR')}</span>
              </div>
            ) : null}

            {/* Total Grande */}
            <div className="pt-2 border-t-2 border-gray-900 flex justify-between items-baseline">
              <div>
                <span className="text-xs uppercase font-black tracking-wider text-gray-900 block">
                  TOTAL A PAGAR:
                </span>
                <span className="text-[10px] font-bold text-gray-500">
                  {totalUnits} unidades • Pedido #{order.orderNumber}
                </span>
              </div>
              <span className="text-2xl font-black text-gray-900 font-['Montserrat']">
                ${Math.round(order.total).toLocaleString('es-AR')}
              </span>
            </div>
          </div>

          {/* Datos Bancarios si corresponde transferencia */}
          {order.paymentMethod === 'transfer' && (
            <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-2.5 text-center text-xs space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-blue-900 block">
                DATOS PARA TRANSFERIR:
              </span>
              <p className="font-black text-blue-950 text-sm">Alias: hola.retiro</p>
              <p className="text-[11px] text-blue-800">
                Titular: <strong>Silvia Lembo</strong> • CVU: 0000003100087788243612
              </p>
            </div>
          )}

          {/* Footer del Comprobante */}
          <div className="pt-2 border-t border-gray-200 text-center space-y-0.5 text-[10px] text-gray-500">
            <p className="font-bold text-gray-700">
              Generado en michy.com.ar • WhatsApp oficial: 1166904678
            </p>
            <p>Envía esta imagen a nuestro WhatsApp para procesar tu pedido de inmediato.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
