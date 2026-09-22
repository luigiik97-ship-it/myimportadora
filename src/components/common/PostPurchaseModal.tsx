import React, { useState } from 'react';
import { Download, Share2, Loader2, CheckCircle2, Info, X, AlertCircle } from 'lucide-react';
import { OfficialWhatsAppIcon } from '../admin/QuickBuyLinkManager';
import {
  getDirectWhatsAppChatUrl,
  triggerWhatsAppOpen,
  normalizeVariantText,
} from '../../services/quickBuyLink';
import { generateReceiptBlob, ReceiptData } from '../../utils/receiptCanvas';

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
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [shareSuccessToast, setShareSuccessToast] = useState<string | null>(null);
  const [shareErrorToast, setShareErrorToast] = useState<string | null>(null);

  if (!isOpen || !order) return null;

  const safeItems = Array.isArray(order.items) ? order.items : [];
  const totalUnits =
    order.totalUnits ??
    safeItems.reduce((acc, item) => acc + (item.quantity || 1), 0);
  const itemsCount = order.itemsCount ?? safeItems.length;

  // Preparar datos para el generador nativo de comprobantes en Canvas 2D
  const buildReceiptData = (): ReceiptData => {
    return {
      orderNumber: order.orderNumber,
      total: order.total,
      subtotal: order.subtotal,
      totalUnits,
      itemsCount,
      paymentMethod: order.paymentMethod,
      deliveryOption: order.deliveryOption,
      shippingMethodName: order.shippingMethodName,
      shippingCost: order.shippingCost,
      cashDiscount: order.cashDiscount,
      customerName: order.customerName,
      customerWhatsapp: order.customerWhatsapp,
      deliveryAddress: order.deliveryAddress,
      createdAt: order.createdAt,
      items: safeItems.map((it) => ({
        title: it.title,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        totalPrice: it.totalPrice,
        variantText: normalizeVariantText(it.variantText),
        image: it.image,
        isWholesale: it.isWholesale,
      })),
    };
  };

  // Botón 1: Contactar por WhatsApp (abre directamente a 1166904678 sin mensajes prellenados)
  const handleContactWhatsApp = () => {
    const waUrl = getDirectWhatsAppChatUrl();
    triggerWhatsAppOpen(waUrl);
  };

  // Botón 2: Descargar imagen del resumen
  const handleDownloadImage = async () => {
    try {
      setIsGeneratingImage(true);
      setShareErrorToast(null);

      const receiptData = buildReceiptData();
      const blob = await generateReceiptBlob(receiptData);

      const fileName = `Pedido-${order.orderNumber}-Resumen.png`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 2000);

      setShareSuccessToast('¡Imagen descargada con éxito! Ya puedes enviarla.');
      setTimeout(() => setShareSuccessToast(null), 4500);
    } catch (err) {
      console.error('Error al generar la imagen del resumen:', err);
      setShareErrorToast('No se pudo generar la imagen. Por favor reintenta.');
      setTimeout(() => setShareErrorToast(null), 4000);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // Botón 3: Compartir imagen del resumen por WhatsApp
  const handleShareImage = async () => {
    try {
      setIsGeneratingImage(true);
      setShareErrorToast(null);

      const receiptData = buildReceiptData();
      const blob = await generateReceiptBlob(receiptData);

      const fileName = `Pedido-${order.orderNumber}-Resumen.png`;
      const file = new File([blob], fileName, { type: 'image/png' });

      // En móviles compatibles (Android / iOS), navigator.share permite adjuntar el archivo directamente a WhatsApp
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
            return; // El usuario cerró el diálogo nativo de compartir
          }
          console.warn('Error en navigator.share:', err);
        }
      }

      // En computadoras o navegadores sin soporte directo de Web Share de archivos:
      // 1. Se descarga la imagen automáticamente al dispositivo
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 2000);

      // 2. Notificación en pantalla
      setShareSuccessToast('¡Imagen descargada! Ya abrimos WhatsApp para que la adjuntes.');
      setTimeout(() => setShareSuccessToast(null), 5000);

      // 3. Abrir WhatsApp directamente al 1166904678
      setTimeout(() => {
        triggerWhatsAppOpen(getDirectWhatsAppChatUrl());
      }, 400);
    } catch (err) {
      console.error('Error al compartir la imagen del resumen:', err);
      setShareErrorToast('No se pudo procesar la imagen para compartir. Por favor reintenta.');
      setTimeout(() => setShareErrorToast(null), 4000);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleClose = () => {
    onClose();
    if (onContinueShopping) {
      onContinueShopping();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      {/* Tarjeta Modal Post-Compra */}
      <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 text-center shadow-2xl space-y-4 animate-scale-up border border-emerald-100 my-auto relative">
        {/* Botón "X" en la parte superior derecha (solicitado) */}
        <button
          type="button"
          id="modal-btn-close-x"
          onClick={handleClose}
          className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full p-2 transition-colors cursor-pointer z-10"
          aria-label="Cerrar ventana"
          title="Cerrar ventana"
        >
          <X className="w-5 h-5 text-gray-500 hover:text-gray-800" />
        </button>

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

        {/* Aviso instructivo claro */}
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

        {/* Notificación de feedback (toast éxito) */}
        {shareSuccessToast && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-2.5 rounded-xl font-medium flex items-center justify-center gap-1.5 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{shareSuccessToast}</span>
          </div>
        )}

        {/* Notificación de error si ocurre */}
        {shareErrorToast && (
          <div className="bg-red-50 border border-red-200 text-red-800 text-xs p-2.5 rounded-xl font-medium flex items-center justify-center gap-1.5 animate-fade-in">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{shareErrorToast}</span>
          </div>
        )}

        {/* Los 3 Botones Solicitados */}
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

          {/* Botón de cierre alternativo */}
          <button
            type="button"
            id="modal-btn-close"
            onClick={handleClose}
            className="w-full py-2.5 text-xs text-gray-500 hover:text-gray-800 font-semibold transition-colors cursor-pointer"
          >
            Cerrar y seguir explorando
          </button>
        </div>
      </div>
    </div>
  );
};
