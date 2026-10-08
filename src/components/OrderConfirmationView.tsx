import React, { useState } from 'react';
import { Order } from '../types';
import {
  CheckCircle2,
  Copy,
  Check,
  Truck,
  Store,
  CreditCard,
  Mail,
  Download,
  Share2,
  Loader2,
  AlertCircle,
  FileText
} from 'lucide-react';
import { getDirectWhatsAppChatUrl, triggerWhatsAppOpen, normalizeVariantText } from '../services/quickBuyLink';
import { OfficialWhatsAppIcon } from './admin/QuickBuyLinkManager';
import { getOptimizedImageUrl } from '../utils/imageOptimizer';
import { generateReceiptPdfBlob, ReceiptData } from '../utils/receiptCanvas';

interface OrderConfirmationViewProps {
  order: Order;
  onContinueShopping: () => void;
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

export const OrderConfirmationView: React.FC<OrderConfirmationViewProps> = ({
  order,
  onContinueShopping,
}) => {
  const [copiedAlias, setCopiedAlias] = useState(false);
  const [copiedCvu, setCopiedCvu] = useState(false);
  const [isGenerating, setIsGenerating] = useState<'summary' | 'detail' | 'share' | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Interceptar el botón "Atrás" del navegador o celular para llevar siempre a inicio ('/')
  // e impedir volver al checkout anterior
  React.useEffect(() => {
    window.history.pushState(null, '', window.location.href);

    const handlePopState = () => {
      window.location.replace('/');
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const safeItems = Array.isArray(order?.items) ? order.items : [];

  const handleCopyAlias = () => {
    navigator.clipboard.writeText('hola.retiro');
    setCopiedAlias(true);
    setTimeout(() => setCopiedAlias(false), 2000);
  };

  const handleCopyCvu = () => {
    navigator.clipboard.writeText('0000003100087788243612');
    setCopiedCvu(true);
    setTimeout(() => setCopiedCvu(false), 2000);
  };

  const handleContactWhatsApp = () => {
    triggerWhatsAppOpen(getDirectWhatsAppChatUrl());
  };

  // Construir datos del comprobante para el generador nativo de PDF multipágina
  const buildReceiptData = (): ReceiptData => {
    const totalUnits =
      order.totalUnits ??
      safeItems.reduce((acc, it) => acc + (it.quantity || 1), 0);

    return {
      orderNumber: order.orderNumber,
      total: order.total,
      subtotal: order.subtotal,
      totalUnits,
      itemsCount: safeItems.length,
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

  // Descargar comprobante en formato PDF
  const handleDownloadPdf = async (mode: 'summary' | 'detail' = 'summary') => {
    try {
      setIsGenerating(mode);
      setToast(null);

      const receiptData = buildReceiptData();
      const pdfBlob = await generateReceiptPdfBlob(receiptData, { mode });
      const fileName = `Pedido-${order.orderNumber}-${mode === 'detail' ? 'Detalle' : 'Resumen'}.pdf`;
      triggerDownloadBlob(pdfBlob, fileName);

      setToast({
        type: 'success',
        text: `¡${mode === 'detail' ? 'Detalle' : 'Resumen'} en PDF descargado con éxito!`,
      });
      setTimeout(() => setToast(null), 4500);
    } catch (err) {
      console.error('Error generando PDF de comprobante:', err);
      setToast({
        type: 'error',
        text: 'No se pudo generar el archivo PDF. Por favor, reintenta.',
      });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setIsGenerating(null);
    }
  };

  // Compartir resumen en PDF (mediante Web Share en celulares o descarga + WhatsApp en PC)
  const handleSharePdf = async () => {
    try {
      setIsGenerating('share');
      setToast(null);

      const receiptData = buildReceiptData();
      const pdfBlob = await generateReceiptPdfBlob(receiptData, { mode: 'summary' });
      const fileName = `Pedido-${order.orderNumber}-Resumen.pdf`;
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

      // Web Share API con soporte nativo de archivos (móviles Android / iOS)
      if (
        typeof navigator !== 'undefined' &&
        navigator.canShare &&
        navigator.canShare({ files: [file] })
      ) {
        try {
          await navigator.share({
            files: [file],
            title: `Resumen Pedido #${order.orderNumber}`,
            text: `Hola, te comparto el comprobante/resumen en PDF de mi Pedido #${order.orderNumber}.`,
          });
          return;
        } catch (err: any) {
          if (err?.name === 'AbortError') return;
          console.warn('Error en navigator.share:', err);
        }
      }

      // En computadoras o navegadores sin Web Share: descarga y abre WhatsApp
      triggerDownloadBlob(pdfBlob, fileName);
      setToast({
        type: 'success',
        text: '¡PDF descargado! Abriendo WhatsApp para que lo envíes.',
      });
      setTimeout(() => setToast(null), 5000);
      setTimeout(() => {
        triggerWhatsAppOpen(getDirectWhatsAppChatUrl());
      }, 400);
    } catch (err) {
      console.error('Error al compartir resumen PDF:', err);
      setToast({
        type: 'error',
        text: 'No se pudo preparar el PDF para compartir. Por favor, reintenta.',
      });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setIsGenerating(null);
    }
  };

  return (
    <div className="max-w-[1240px] mx-auto px-1 sm:px-4 py-3 sm:py-8 space-y-4 sm:space-y-8">
      {/* 1. Header Section */}
      <div className="text-center space-y-2.5 sm:space-y-3 max-w-2xl mx-auto px-2">
        <div className="w-16 h-16 sm:w-16 sm:h-16 bg-emerald-100 text-[#00a650] rounded-full flex items-center justify-center mx-auto shadow-xs">
          <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
        </div>
        <h1 id="order-thankyou-title" className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900 font-['Montserrat'] tracking-tight">
          ¡Gracias por tu compra!
        </h1>
        <p className="text-sm sm:text-base text-gray-600">
          Tu pedido <strong className="text-[#0058bb] font-bold">#{order.orderNumber}</strong> ha sido reservado y está en proceso de preparación.
        </p>

        {/* Email receipt status notification */}
        <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-800 text-xs sm:text-sm px-3.5 py-1.5 rounded-full font-medium shadow-2xs text-left sm:text-center">
          <Mail className="w-4 h-4 text-[#0058bb] shrink-0" />
          <span>
            Hemos enviado el recibo de compra y comprobante a <strong>{order.customerEmail}</strong>
          </span>
        </div>
      </div>

      {/* 2. Three Sections: Flat native on mobile with subtle dividers, cards on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-0 md:gap-6 divide-y md:divide-y-0 divide-gray-200">
        {/* Section 1: Datos de envío */}
        <div className="bg-transparent md:bg-white rounded-none md:rounded-xl border-0 md:border md:border-gray-200 p-2 md:p-5 shadow-none md:shadow-xs flex flex-col justify-between space-y-3.5 sm:space-y-4 py-4 md:py-5">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-gray-900 font-bold font-['Montserrat'] text-base border-b border-gray-100 pb-2">
              {order.deliveryOption === 'pickup' ? (
                <>
                  <Store className="w-5 h-5 text-[#0058bb]" />
                  <h3>Dirección del local</h3>
                </>
              ) : (
                <>
                  <Truck className="w-5 h-5 text-[#0058bb]" />
                  <h3>Datos de envío</h3>
                </>
              )}
            </div>

            {order.deliveryOption === 'delivery' && order.deliveryAddress ? (
              <div className="text-sm text-gray-600 space-y-2">
                <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-[#0058bb] font-bold text-xs sm:text-sm flex items-center justify-between">
                  <span>{order.shippingMethodName || 'Envío a domicilio'}</span>
                  <span>${order.shippingCost.toLocaleString('es-AR')}</span>
                </div>
                {(order.deliveryAddress?.correoBranch || order.correoBranch) && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-900 space-y-0.5">
                    <span className="font-bold block text-amber-950 uppercase tracking-wide text-[11px]">
                      Sucursal de Correo Argentino para retiro:
                    </span>
                    <span className="font-semibold text-gray-900 block text-xs sm:text-sm">
                      {order.deliveryAddress?.correoBranch || order.correoBranch}
                    </span>
                  </div>
                )}
                <p className="font-semibold text-gray-800 text-sm">
                  {order.deliveryAddress.street} {order.deliveryAddress.number}
                  {order.deliveryAddress.floor ? `, ${order.deliveryAddress.floor}` : ''}
                </p>
                <p>{order.deliveryAddress.city}, {order.deliveryAddress.province}, CP {order.deliveryAddress.postalCode}, Argentina</p>
              </div>
            ) : (
              <div className="text-sm text-gray-600 space-y-1">
                <p className="font-bold text-gray-800">Retiro gratis en Local</p>
                <p>Av. San Pedrito 28 local 4, CABA, Argentina - Lunes a sábados de 11hs a 17hs</p>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-gray-100">
            <p className="text-sm font-bold text-[#0058bb]">
              Recibe: {order.deliveryAddress?.receiverName || order.customerName}
            </p>
            <p className="text-xs text-gray-500">WhatsApp: {order.customerWhatsapp}</p>
          </div>
        </div>

        {/* Section 2: Pago */}
        <div className="bg-transparent md:bg-white rounded-none md:rounded-xl border-0 md:border md:border-gray-200 p-2 md:p-5 shadow-none md:shadow-xs flex flex-col justify-between space-y-3.5 sm:space-y-4 py-4 md:py-5">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-gray-900 font-bold font-['Montserrat'] text-base border-b border-gray-100 pb-2">
              <CreditCard className="w-5 h-5 text-[#0058bb]" />
              <h3>Pago</h3>
            </div>

            {order.paymentMethod === 'transfer' ? (
              <div className="space-y-2.5 text-xs sm:text-sm">
                <span className="font-bold text-[#0058bb] block text-base">Transferencia bancaria</span>
                <p className="text-gray-600 leading-relaxed text-xs sm:text-sm">
                  Realice el pago para poder enviar su compra lo antes posible. Enviar el comprobante al WhatsApp <strong>1166904678</strong>.
                </p>

                {/* Bank details */}
                <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3.5 space-y-2.5 text-xs sm:text-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs text-gray-500 block">Alias:</span>
                      <span className="font-black text-gray-900 text-base">hola.retiro</span>
                    </div>
                    <button
                      id="copy-alias-btn"
                      onClick={handleCopyAlias}
                      className="bg-[#0058bb] hover:bg-[#004bb0] text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer min-h-[34px]"
                    >
                      {copiedAlias ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copiedAlias ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-blue-200/60">
                    <div>
                      <span className="text-xs text-gray-500 block">CVU:</span>
                      <span className="font-mono font-bold text-gray-800 text-xs sm:text-sm">0000003100087788243612</span>
                    </div>
                    <button
                      id="copy-cvu-btn"
                      onClick={handleCopyCvu}
                      className="text-[#0058bb] hover:underline text-xs font-bold cursor-pointer min-h-[34px] flex items-center"
                    >
                      {copiedCvu ? '✓ Copiado' : 'Copiar CVU'}
                    </button>
                  </div>

                  <div className="pt-2 border-t border-blue-200/60">
                    <span className="text-xs text-gray-500 block">Titular:</span>
                    <span className="font-semibold text-gray-900 text-xs sm:text-sm">Silvia Lembo</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5 text-xs sm:text-sm">
                <span className="font-bold text-[#00a650] text-base block">Pago en Efectivo</span>
                <p className="text-gray-600 leading-relaxed text-xs sm:text-sm">
                  Abonás directamente en el local al momento de retirar tu pedido. Presentá tu número de pedido <strong>#{order.orderNumber}</strong>.
                </p>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 space-y-1 text-xs sm:text-sm">
                  <span className="text-xs text-emerald-800 font-semibold block">Total correspondiente al pago en efectivo:</span>
                  <span className="text-2xl font-bold text-[#00a650] font-['Montserrat'] block">
                    ${order.total.toLocaleString('es-AR')}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-gray-100 font-bold text-sm text-gray-900 flex justify-between items-center">
            <span>Total:</span>
            <span className="text-xl font-bold text-gray-900 font-['Montserrat']">${order.total.toLocaleString('es-AR')}</span>
          </div>
        </div>

        {/* Section 3: Resumen de compra */}
        <div className="bg-transparent md:bg-white rounded-none md:rounded-xl border-0 md:border md:border-gray-200 p-2 md:p-5 shadow-none md:shadow-xs flex flex-col justify-between space-y-4 py-4 md:py-5">
          <div className="space-y-3">
            <h3 className="text-gray-900 font-bold font-['Montserrat'] text-base border-b border-gray-100 pb-2">
              Resumen de compra
            </h3>

            <div className="space-y-2.5 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>Productos</span>
                <span className="font-normal text-gray-800">${order.subtotal.toLocaleString('es-AR')}</span>
              </div>

              <div className="flex justify-between items-start">
                <div>
                  <span>Envío</span>
                  {order.deliveryOption === 'delivery' && order.shippingMethodName && (
                    <p className="text-xs text-gray-500 font-normal">{order.shippingMethodName}</p>
                  )}
                </div>
                <span className={order.shippingCost === 0 ? 'text-[#00a650] font-bold' : 'font-normal text-gray-800'}>
                  {order.shippingCost === 0 ? 'Gratis' : `$${order.shippingCost.toLocaleString('es-AR')}`}
                </span>
              </div>

              {order.cashDiscount > 0 && (
                <div className="flex justify-between text-[#00a650] font-semibold">
                  <span>Descuento Efectivo</span>
                  <span>-${order.cashDiscount.toLocaleString('es-AR')}</span>
                </div>
              )}

              <div className="pt-2 border-t border-gray-200 flex justify-between items-baseline">
                <span className="text-base font-bold text-gray-900">Total</span>
                <span className="text-2xl font-bold text-gray-900 font-['Montserrat']">
                  ${order.total.toLocaleString('es-AR')}
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-2 pt-2">
            {/* BOTÓN 1: Contactar por WhatsApp */}
            <button
              id="whatsapp-direct-btn"
              type="button"
              onClick={handleContactWhatsApp}
              className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold py-3.5 px-4 rounded-xl text-sm uppercase tracking-wide transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer text-center min-h-[46px]"
            >
              <OfficialWhatsAppIcon className="w-5 h-5 text-white shrink-0" />
              <span>Contactar por WhatsApp</span>
            </button>

            {/* BOTÓN 2: Descargar Resumen en PDF */}
            <button
              id="download-summary-pdf-btn"
              type="button"
              disabled={isGenerating !== null}
              onClick={() => handleDownloadPdf('summary')}
              className="w-full bg-[#0058bb] hover:bg-[#004bb0] text-white font-bold py-3 px-4 rounded-xl text-xs sm:text-sm uppercase tracking-wide transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer min-h-[44px] disabled:opacity-60"
            >
              {isGenerating === 'summary' ? (
                <Loader2 className="w-4 h-4 text-white animate-spin shrink-0" />
              ) : (
                <Download className="w-4 h-4 text-white shrink-0" />
              )}
              <span>{isGenerating === 'summary' ? 'Generando PDF...' : 'Descargar Resumen (PDF)'}</span>
            </button>

            {/* BOTÓN 3: Compartir Resumen en PDF */}
            <button
              id="share-summary-pdf-btn"
              type="button"
              disabled={isGenerating !== null}
              onClick={handleSharePdf}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-4 rounded-xl text-xs sm:text-sm uppercase tracking-wide transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer min-h-[44px] disabled:opacity-60"
            >
              {isGenerating === 'share' ? (
                <Loader2 className="w-4 h-4 text-white animate-spin shrink-0" />
              ) : (
                <Share2 className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
              <span>{isGenerating === 'share' ? 'Preparando PDF...' : 'Compartir Resumen (PDF)'}</span>
            </button>

            {/* BOTÓN 4: Seguir comprando */}
            <button
              id="continue-shopping-btn"
              type="button"
              onClick={onContinueShopping}
              className="w-full bg-white hover:bg-gray-100 text-gray-800 border border-gray-300 font-bold py-2.5 px-4 rounded-xl text-xs sm:text-sm uppercase tracking-wide transition-colors shadow-xs cursor-pointer min-h-[40px] text-center"
            >
              Seguir comprando
            </button>

            {/* Opción secundaria: Detalle completo de productos */}
            <button
              type="button"
              disabled={isGenerating !== null}
              onClick={() => handleDownloadPdf('detail')}
              className="w-full text-center text-xs text-gray-500 hover:text-[#0058bb] hover:underline pt-1.5 cursor-pointer flex items-center justify-center gap-1.5 transition-colors disabled:opacity-60"
            >
              {isGenerating === 'detail' ? (
                <Loader2 className="w-3.5 h-3.5 text-gray-500 animate-spin shrink-0" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-gray-500 shrink-0" />
              )}
              <span>{isGenerating === 'detail' ? 'Generando detalle completo...' : 'Descargar detalle completo con todos los productos (PDF)'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Bottom Section: Resumen de productos - Flat native on mobile */}
      <div className="bg-transparent md:bg-white rounded-none md:rounded-xl border-0 md:border md:border-gray-200 p-2 md:p-5 shadow-none md:shadow-xs space-y-4 pt-4 border-t border-gray-200 md:border-t-0">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <h3 className="text-base sm:text-lg font-bold text-gray-900 font-['Montserrat']">
            Resumen de productos
          </h3>
          <span className="text-xs sm:text-sm text-gray-500 font-medium">
            {safeItems.length} {safeItems.length === 1 ? 'producto' : 'productos'}
          </span>
        </div>

        <div className="divide-y divide-gray-100">
          {safeItems.map((item) => {
            const variantSuffix = item.variantText ? `, ${item.variantText}` : '';
            const pricingSuffix = ` (${item.isWholesale ? 'mayorista' : 'minorista'})`;
            const fullItemLabel = `${item.quantity}x ${item.title}${variantSuffix}${pricingSuffix}`;

            return (
              <div key={item.id} className="py-3 sm:py-3.5 flex items-center justify-between gap-3 sm:gap-4">
                <div className="flex items-center gap-3">
                  <img
                    src={getOptimizedImageUrl(item.image, { width: 160, quality: 70 })}
                    alt={item.title}
                    loading="lazy"
                    decoding="async"
                    className="w-16 h-16 sm:w-14 sm:h-14 object-contain rounded-xl border border-gray-200 p-1 bg-white shrink-0 shadow-2xs"
                  />
                  <div>
                    <h4 className="text-xs sm:text-sm md:text-base font-semibold text-gray-900 leading-snug">
                      {fullItemLabel}
                    </h4>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Precio unitario: ${item.unitPrice.toLocaleString('es-AR')} c/u
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-base md:text-lg font-bold text-gray-900 font-['Montserrat'] block">
                    ${item.totalPrice.toLocaleString('es-AR')}
                  </span>
                  <span className="text-xs text-gray-400 block">
                    (${item.unitPrice.toLocaleString('es-AR')} c/u)
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating feedback notification for PDF actions */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg border text-xs sm:text-sm font-semibold flex items-center gap-2 animate-fadeIn max-w-[90vw] sm:max-w-md ${
            toast.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-700'
              : 'bg-red-600 text-white border-red-700'
          }`}
        >
          {toast.type === 'success' ? (
            <Check className="w-4 h-4 shrink-0 text-white" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-white" />
          )}
          <span>{toast.text}</span>
        </div>
      )}
    </div>
  );
};
