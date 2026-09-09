import React, { useState } from 'react';
import { Order } from '../types';
import { CheckCircle2, Copy, Check, MessageSquare, ShoppingBag, Truck, Store, CreditCard, Mail } from 'lucide-react';

interface OrderConfirmationViewProps {
  order: Order;
  onContinueShopping: () => void;
}

export const OrderConfirmationView: React.FC<OrderConfirmationViewProps> = ({
  order,
  onContinueShopping,
}) => {
  const [copiedAlias, setCopiedAlias] = useState(false);
  const [copiedCvu, setCopiedCvu] = useState(false);

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

  // Build WhatsApp Message URL
  const buildWhatsAppUrl = () => {
    const itemsSummary = safeItems
      .map((i) => {
        const variantSuffix = i.variantText ? `, ${i.variantText}` : '';
        const pricingSuffix = ` (${i.isWholesale ? 'mayorista' : 'minorista'})`;
        return `• ${i.quantity}x ${i.title}${variantSuffix}${pricingSuffix} - $${i.totalPrice.toLocaleString('es-AR')}`;
      })
      .join('%0A');

    const deliveryDetail =
      order.deliveryOption === 'pickup'
        ? 'Retiro en Local San Pedrito'
        : `Envío a domicilio (${order.shippingMethodName || 'Envío'} - $${order.shippingCost.toLocaleString('es-AR')})`;

    const msg = `¡Hola MY Importadora! 👋 Acabo de realizar el pedido *#${order.orderNumber}*.%0A%0A*Detalle:*%0A${itemsSummary}%0A%0A*Total:* $${order.total.toLocaleString('es-AR')}%0A*Método de Pago:* ${order.paymentMethod === 'transfer' ? 'Transferencia Bancaria' : 'Efectivo'}%0A*Entrega:* ${deliveryDetail}%0A*Nombre:* ${order.customerName}%0A%0AAdjunto el comprobante de pago para coordinar la entrega. ¡Muchas gracias!`;

    // WhatsApp business number: 5491166904678
    return `https://wa.me/5491166904678?text=${msg}`;
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

          {/* Action buttons - Prominent on mobile */}
          <div className="space-y-2.5 pt-2">
            <a
              id="whatsapp-receipt-btn"
              href={buildWhatsAppUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-[#00a650] hover:bg-[#009246] text-white font-black py-4 px-4 rounded-xl text-base uppercase tracking-wide transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer text-center min-h-[50px]"
            >
              <MessageSquare className="w-5 h-5 fill-white" />
              <span>COORDINAR COMPRA POR WHATSAPP</span>
            </a>

            <button
              id="continue-shopping-btn"
              onClick={onContinueShopping}
              className="w-full bg-[#0058bb] hover:bg-[#004bb0] text-white font-bold py-3 px-4 rounded-xl text-sm sm:text-base uppercase tracking-wide transition-colors shadow-sm cursor-pointer min-h-[44px]"
            >
              SEGUIR COMPRANDO
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
                    src={item.image}
                    alt={item.title}
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
    </div>
  );
};
