import React, { useState } from 'react';
import { Download, FileText, Loader2, CheckCircle2, Info, X, AlertCircle, MessageCircle } from 'lucide-react';
import { OfficialWhatsAppIcon } from '../admin/QuickBuyLinkManager';
import {
  getDirectWhatsAppChatUrl,
  triggerWhatsAppOpen,
  normalizeVariantText,
} from '../../services/quickBuyLink';
import { generateReceiptPdfBlob, ReceiptData } from '../../utils/receiptCanvas';

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
    createdAt?: string;
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

function triggerDownloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const PostPurchaseModal: React.FC<PostPurchaseModalProps> = ({
  isOpen,
  onClose,
  order,
  onContinueShopping,
}) => {
  const [generatingAction, setGeneratingAction] = useState<'detail' | 'summary' | 'whatsapp' | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen || !order) return null;

  const safeItems = Array.isArray(order.items) ? order.items : [];
  const totalUnits =
    order.totalUnits ??
    safeItems.reduce((acc, item) => acc + (item.quantity || 1), 0);
  const itemsCount = order.itemsCount ?? safeItems.length;

  // Preparar datos para el generador nativo de comprobantes PDF multipágina
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

  // OPCIÓN 1: Descargar detalle (PDF completo con todos los productos, variantes y precios unitarios)
  const handleDownloadDetail = async () => {
    try {
      setGeneratingAction('detail');
      setToastMessage(null);

      const receiptData = buildReceiptData();
      const pdfBlob = await generateReceiptPdfBlob(receiptData, { mode: 'detail' });
      const fileName = `Pedido-${order.orderNumber}-Detalle.pdf`;
      triggerDownloadBlob(pdfBlob, fileName);

      setToastMessage({
        type: 'success',
        text: '¡Detalle del pedido descargado en PDF con éxito!',
      });
      setTimeout(() => setToastMessage(null), 4500);
    } catch (err) {
      console.error('Error al generar el PDF de detalle:', err);
      setToastMessage({
        type: 'error',
        text: 'No se pudo generar el detalle en PDF. Por favor reintenta.',
      });
      setTimeout(() => setToastMessage(null), 4000);
    } finally {
      setGeneratingAction(null);
    }
  };

  // OPCIÓN 2: Descargar resumen de pedido (PDF oficial con totales, modalidad y resumen)
  const handleDownloadSummary = async () => {
    try {
      setGeneratingAction('summary');
      setToastMessage(null);

      const receiptData = buildReceiptData();
      const pdfBlob = await generateReceiptPdfBlob(receiptData, { mode: 'summary' });
      const fileName = `Pedido-${order.orderNumber}-Resumen.pdf`;
      triggerDownloadBlob(pdfBlob, fileName);

      setToastMessage({
        type: 'success',
        text: '¡Resumen de pedido descargado en PDF con éxito!',
      });
      setTimeout(() => setToastMessage(null), 4500);
    } catch (err) {
      console.error('Error al generar el PDF de resumen:', err);
      setToastMessage({
        type: 'error',
        text: 'No se pudo generar el resumen en PDF. Por favor reintenta.',
      });
      setTimeout(() => setToastMessage(null), 4000);
    } finally {
      setGeneratingAction(null);
    }
  };

  // OPCIÓN 3: Enviar resumen de pedido por WhatsApp (Genera PDF y comparte directamente o descarga + abre WhatsApp)
  const handleShareSummaryWhatsApp = async () => {
    try {
      setGeneratingAction('whatsapp');
      setToastMessage(null);

      const receiptData = buildReceiptData();
      const pdfBlob = await generateReceiptPdfBlob(receiptData, { mode: 'summary' });
      const fileName = `Pedido-${order.orderNumber}-Resumen.pdf`;
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

      // Si el navegador soporta compartir archivos por Web Share API (Móviles Android / iOS)
      if (
        typeof navigator !== 'undefined' &&
        navigator.canShare &&
        navigator.canShare({ files: [file] })
      ) {
        try {
          await navigator.share({
            files: [file],
            title: `Resumen Pedido #${order.orderNumber}`,
            text: `Hola, te comparto el resumen en PDF de mi Pedido #${order.orderNumber}.`,
          });
          return;
        } catch (err: any) {
          if (err?.name === 'AbortError') {
            return; // Usuario canceló el share
          }
          console.warn('Error en navigator.share:', err);
        }
      }

      // En computadoras o navegadores sin soporte Web Share de archivos:
      // 1. Descarga el archivo PDF
      triggerDownloadBlob(pdfBlob, fileName);

      // 2. Feedback en pantalla
      setToastMessage({
        type: 'success',
        text: '¡PDF descargado! Ya abrimos WhatsApp para que lo adjuntes al chat.',
      });
      setTimeout(() => setToastMessage(null), 5000);

      // 3. Abrir WhatsApp directamente
      setTimeout(() => {
        triggerWhatsAppOpen(getDirectWhatsAppChatUrl());
      }, 400);
    } catch (err) {
      console.error('Error al compartir el resumen por WhatsApp:', err);
      setToastMessage({
        type: 'error',
        text: 'No se pudo preparar el PDF para compartir. Por favor reintenta.',
      });
      setTimeout(() => setToastMessage(null), 4000);
    } finally {
      setGeneratingAction(null);
    }
  };

  // Contactar directamente por WhatsApp sin archivo
  const handleContactWhatsAppDirect = () => {
    const waUrl = getDirectWhatsAppChatUrl();
    triggerWhatsAppOpen(waUrl);
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
        {/* Botón "X" en la parte superior derecha */}
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

        {/* Aviso instructivo claro sobre el PDF */}
        <div className="bg-blue-50/90 border border-blue-200/90 rounded-xl p-3 text-left text-xs sm:text-sm text-blue-950 space-y-1 shadow-2xs">
          <div className="flex items-center gap-1.5 font-bold text-blue-900 text-xs sm:text-sm">
            <Info className="w-4 h-4 text-[#0058bb] shrink-0" />
            <span>Comprobante en PDF</span>
          </div>
          <p className="text-blue-800 text-[11px] sm:text-xs leading-relaxed">
            Podés <strong>descargar el detalle</strong>, <strong>descargar el resumen de pedido en PDF</strong> (soporta pedidos grandes en múltiples páginas) o <strong>enviar el resumen por WhatsApp</strong>.
          </p>
        </div>

        {/* Notificación de feedback (toast) */}
        {toastMessage && (
          <div
            className={`text-xs p-2.5 rounded-xl font-medium flex items-center justify-center gap-1.5 animate-fade-in ${
              toastMessage.type === 'success'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        )}

        {/* Las 3 Opciones Solicitadas */}
        <div className="space-y-2.5 pt-1">
          {/* OPCIÓN 1: Descargar detalle */}
          <button
            type="button"
            id="modal-btn-download-detail"
            onClick={handleDownloadDetail}
            disabled={generatingAction !== null}
            className="w-full bg-[#0058bb] hover:bg-[#004bb0] text-white font-bold text-sm py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition-all cursor-pointer disabled:opacity-60 min-h-[46px]"
          >
            {generatingAction === 'detail' ? (
              <Loader2 className="w-5 h-5 animate-spin text-white shrink-0" />
            ) : (
              <FileText className="w-5 h-5 text-white shrink-0" />
            )}
            <span>
              {generatingAction === 'detail' ? 'Generando PDF...' : 'Descargar detalle'}
            </span>
          </button>

          {/* OPCIÓN 2: Descargar resumen de pedido */}
          <button
            type="button"
            id="modal-btn-download-summary"
            onClick={handleDownloadSummary}
            disabled={generatingAction !== null}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition-all cursor-pointer disabled:opacity-60 min-h-[46px]"
          >
            {generatingAction === 'summary' ? (
              <Loader2 className="w-5 h-5 animate-spin text-white shrink-0" />
            ) : (
              <Download className="w-5 h-5 text-white shrink-0" />
            )}
            <span>
              {generatingAction === 'summary' ? 'Generando PDF...' : 'Descargar resumen de pedido'}
            </span>
          </button>

          {/* OPCIÓN 3: Enviar resumen de pedido por WhatsApp */}
          <button
            type="button"
            id="modal-btn-share-whatsapp"
            onClick={handleShareSummaryWhatsApp}
            disabled={generatingAction !== null}
            className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-sm py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition-all cursor-pointer disabled:opacity-60 min-h-[46px]"
          >
            {generatingAction === 'whatsapp' ? (
              <Loader2 className="w-5 h-5 animate-spin text-white shrink-0" />
            ) : (
              <OfficialWhatsAppIcon className="w-5 h-5 text-white shrink-0" />
            )}
            <span>
              {generatingAction === 'whatsapp' ? 'Preparando PDF...' : 'Enviar resumen de pedido por WhatsApp'}
            </span>
          </button>

          {/* Contactar directamente por WhatsApp si solo desea chatear */}
          <button
            type="button"
            id="modal-btn-contact-whatsapp-direct"
            onClick={handleContactWhatsAppDirect}
            className="w-full text-xs text-[#0058bb] hover:text-[#004bb0] font-semibold py-1.5 flex items-center justify-center gap-1.5 cursor-pointer hover:underline"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>O abrir chat de WhatsApp directo</span>
          </button>

          {/* Botón de cierre */}
          <button
            type="button"
            id="modal-btn-close"
            onClick={handleClose}
            className="w-full py-2 text-xs text-gray-500 hover:text-gray-800 font-medium transition-colors cursor-pointer"
          >
            Cerrar y seguir explorando
          </button>
        </div>
      </div>
    </div>
  );
};
