import { Order } from '../types';
import { resolveWhatsAppPhone } from './quickBuyLink';

export interface GenerateReceiptOptions {
  mode: 'normal' | 'quick_buy';
}

export interface GeneratedReceipt {
  blob: Blob;
  file: File;
  dataUrl: string;
  orderNumber: string;
}

/**
 * Carga una imagen de forma segura manejando CORS y fallbacks
 */
const loadSafeImage = (src: string): Promise<HTMLImageElement | null> => {
  return new Promise((resolve) => {
    if (!src) return resolve(null);

    const img = new Image();
    img.crossOrigin = 'anonymous';

    // Timeout de 3.5 segundos para no demorar la generación del comprobante
    const timer = setTimeout(() => {
      resolve(null);
    }, 3500);

    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };

    img.onerror = () => {
      clearTimeout(timer);
      // Reintentar sin crossOrigin en caso de servidores que rechacen cabecera
      const fallbackImg = new Image();
      const fallbackTimer = setTimeout(() => resolve(null), 2000);
      fallbackImg.onload = () => {
        clearTimeout(fallbackTimer);
        resolve(fallbackImg);
      };
      fallbackImg.onerror = () => {
        clearTimeout(fallbackTimer);
        resolve(null);
      };
      fallbackImg.src = src;
    };

    img.src = src;
  });
};

/**
 * Dibuja un rectángulo con esquinas redondeadas
 */
const roundRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) => {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

/**
 * Dibuja una imagen centrada dentro de un contenedor cuadrado redondeado con "cover"
 */
const drawCoverImage = (
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  fallbackText: string,
  x: number,
  y: number,
  size: number,
  radius: number
) => {
  ctx.save();
  roundRect(ctx, x, y, size, size, radius);
  ctx.clip();

  if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, size, size);

    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    const aspect = nw / nh;

    let dw = size;
    let dh = size;
    let dx = x;
    let dy = y;

    if (aspect > 1) {
      // Imagen más ancha que alta
      dw = size * aspect;
      dx = x - (dw - size) / 2;
    } else {
      // Imagen más alta que ancha
      dh = size / aspect;
      dy = y - (dh - size) / 2;
    }

    try {
      ctx.drawImage(img, dx, dy, dw, dh);
    } catch {
      // Si la imagen contamina el canvas por CORS estricto, dibujar placeholder
      drawFallbackBox(ctx, fallbackText, x, y, size);
    }
  } else {
    drawFallbackBox(ctx, fallbackText, x, y, size);
  }

  ctx.restore();

  // Borde sutil
  ctx.save();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1.5;
  roundRect(ctx, x, y, size, size, radius);
  ctx.stroke();
  ctx.restore();
};

const drawFallbackBox = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number
) => {
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Montserrat", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const initial = (text || 'M').trim().charAt(0).toUpperCase();
  ctx.fillText(initial, x + size / 2, y + size / 2);
};

/**
 * Ajusta y divide texto en múltiples líneas según un ancho máximo
 */
const wrapText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] => {
  if (!text) return [];
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = words[0] || '';

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const testLine = currentLine + ' ' + word;
    const width = ctx.measureText(testLine).width;
    if (width < maxWidth) {
      currentLine = testLine;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
};

/**
 * Generador de imagen de comprobante de pedido
 * - Modo 'normal': Comprobante exhaustivo con detalles de productos con variantes, envío, pago y cliente.
 * - Modo 'quick_buy': Comprobante compacto y directo para enlace rápido de WhatsApp.
 */
export const generateOrderReceiptImage = async (
  order: Order,
  options: GenerateReceiptOptions = { mode: 'normal' }
): Promise<GeneratedReceipt> => {
  const isQuickBuy = options.mode === 'quick_buy';
  const items = Array.isArray(order.items) ? order.items : [];

  // 1. Precargar todas las imágenes de las variantes en paralelo
  const loadedImages = await Promise.all(
    items.map(async (item) => {
      const src = item.image;
      if (!src) return null;
      return await loadSafeImage(src);
    })
  );

  // 2. Definir dimensiones base optimizadas para lectura en smartphones
  const canvasWidth = 800;
  const padding = 32;
  const contentWidth = canvasWidth - padding * 2;

  // Medición dinámica de altura
  let estimatedHeight = 0;

  // Header
  estimatedHeight += isQuickBuy ? 140 : 165;

  // Productos (calculando filas)
  const itemHeightBase = isQuickBuy ? 84 : 96;
  estimatedHeight += 40; // Título de sección
  items.forEach((item) => {
    // Estimación de líneas para títulos largos
    const titleLines = Math.max(1, Math.ceil((item.title || '').length / 32));
    const extraLines = titleLines > 1 ? (titleLines - 1) * 20 : 0;
    estimatedHeight += itemHeightBase + extraLines + 12;
  });

  // Totales / Resumen
  estimatedHeight += isQuickBuy ? 160 : 210;

  // Entrega y Envío
  estimatedHeight += isQuickBuy ? 110 : 170;

  // Forma de Pago
  estimatedHeight += isQuickBuy ? 85 : 175;

  // Datos de cliente (en modo normal)
  if (!isQuickBuy) {
    estimatedHeight += 110;
  }

  // Footer
  estimatedHeight += 70;

  // 3. Crear canvas con escala 2x para nitidez Retina / HD en WhatsApp
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth * scale;
  canvas.height = estimatedHeight * scale;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('No se pudo inicializar el contexto 2D del canvas');
  }

  ctx.scale(scale, scale);

  // Fondo general
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, canvasWidth, estimatedHeight);

  // Tarjeta principal blanca
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, 16, 16, canvasWidth - 32, estimatedHeight - 32, 20);
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  let y = 36;

  // -------------------------------------------------------------
  // CABECERA
  // -------------------------------------------------------------
  // Banda decorativa superior
  ctx.fillStyle = '#0058bb';
  roundRect(ctx, 16, 16, canvasWidth - 32, 10, 20);
  ctx.fill();

  // Nombre de la tienda
  ctx.fillStyle = '#0058bb';
  ctx.font = '900 28px -apple-system, BlinkMacSystemFont, "Montserrat", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('MICHY', padding + 8, y);

  // Subtítulo
  ctx.fillStyle = '#64748b';
  ctx.font = '600 13px -apple-system, BlinkMacSystemFont, "Montserrat", sans-serif';
  const subtitle = isQuickBuy
    ? 'COMPRA RÁPIDA • PEDIDO OFICIAL'
    : 'COMPROBANTE DE PEDIDO';
  ctx.fillText(subtitle, padding + 8, y + 34);

  // Pill con Número de Pedido destacado arriba a la derecha
  const orderTagText = `PEDIDO #${order.orderNumber}`;
  ctx.font = '900 18px -apple-system, BlinkMacSystemFont, "Montserrat", sans-serif';
  const orderTagWidth = ctx.measureText(orderTagText).width + 28;
  const orderTagX = canvasWidth - padding - 8 - orderTagWidth;

  ctx.fillStyle = '#eff6ff';
  roundRect(ctx, orderTagX, y + 4, orderTagWidth, 42, 12);
  ctx.fill();
  ctx.strokeStyle = '#bfdbfe';
  ctx.lineWidth = 1.5;
  roundRect(ctx, orderTagX, y + 4, orderTagWidth, 42, 12);
  ctx.stroke();

  ctx.fillStyle = '#0058bb';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(orderTagText, orderTagX + orderTagWidth / 2, y + 25);

  // Fecha y hora
  const now = new Date();
  const dateStr = `${now.toLocaleDateString('es-AR')} • ${now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs`;
  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "Montserrat", sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText(dateStr, canvasWidth - padding - 8, y + 52);

  y += isQuickBuy ? 80 : 95;

  // Divisor sutil
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding + 8, y);
  ctx.lineTo(canvasWidth - padding - 8, y);
  ctx.stroke();
  y += 18;

  // -------------------------------------------------------------
  // SECCIÓN: PRODUCTOS Y VARIANTES CON FOTOS REALES
  // -------------------------------------------------------------
  ctx.fillStyle = '#0f172a';
  ctx.font = '800 15px -apple-system, BlinkMacSystemFont, "Montserrat", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`PRODUCTOS (${items.length})`, padding + 8, y);
  y += 26;

  items.forEach((item, idx) => {
    const img = loadedImages[idx];
    const thumbSize = isQuickBuy ? 64 : 72;
    const itemX = padding + 8;
    const itemW = contentWidth - 16;

    // Caja contenedor del producto
    ctx.fillStyle = '#f8fafc';
    roundRect(ctx, itemX, y, itemW, thumbSize + 16, 14);
    ctx.fill();
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    roundRect(ctx, itemX, y, itemW, thumbSize + 16, 14);
    ctx.stroke();

    // 1. Foto real de la variante
    drawCoverImage(
      ctx,
      img,
      item.title || 'P',
      itemX + 8,
      y + 8,
      thumbSize,
      10
    );

    // 2. Información del producto y variante
    const infoX = itemX + thumbSize + 20;
    const availableTextW = itemW - thumbSize - 170;

    // Título del producto
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Montserrat", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const titleLines = wrapText(ctx, item.title || 'Producto', availableTextW);
    let titleY = y + 10;
    titleLines.slice(0, 2).forEach((line) => {
      ctx.fillText(line, infoX, titleY);
      titleY += 18;
    });

    // Variante comprada (Badge destacado si tiene variante)
    const cleanVariant = (item.variantText || '').trim();
    if (cleanVariant) {
      ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Montserrat", sans-serif';
      const variantPillText = `Variante: ${cleanVariant}`;
      const pillW = Math.min(availableTextW, ctx.measureText(variantPillText).width + 16);

      ctx.fillStyle = '#e2e8f0';
      roundRect(ctx, infoX, titleY + 2, pillW, 20, 6);
      ctx.fill();

      ctx.fillStyle = '#1e293b';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(variantPillText, infoX + 8, titleY + 12);
      titleY += 24;
    }

    // Cantidad y precio unitario
    ctx.fillStyle = '#64748b';
    ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "Montserrat", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const wholesaleLabel = item.isWholesale ? ' • Mayorista' : '';
    ctx.fillText(
      `${item.quantity}x a $${Math.round(item.unitPrice || 0).toLocaleString('es-AR')}${wholesaleLabel}`,
      infoX,
      titleY + 4
    );

    // 3. Subtotal por ítem (a la derecha)
    const priceX = itemX + itemW - 14;
    const totalPrice = item.totalPrice ?? (item.unitPrice || 0) * item.quantity;
    ctx.fillStyle = '#0f172a';
    ctx.font = '800 17px -apple-system, BlinkMacSystemFont, "Montserrat", sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(`$${Math.round(totalPrice).toLocaleString('es-AR')}`, priceX, y + thumbSize / 2 + 8);

    y += thumbSize + 16 + 10;
  });

  y += 6;

  // -------------------------------------------------------------
  // SECCIÓN: RESUMEN DE IMPORTES Y TOTAL
  // -------------------------------------------------------------
  const summaryX = padding + 8;
  const summaryW = contentWidth - 16;

  ctx.fillStyle = '#ffffff';
  roundRect(ctx, summaryX, y, summaryW, isQuickBuy ? 92 : 118, 14);
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1.5;
  roundRect(ctx, summaryX, y, summaryW, isQuickBuy ? 92 : 118, 14);
  ctx.stroke();

  let sumRowY = y + 14;

  // Fila: Subtotal productos
  ctx.font = '500 14px -apple-system, BlinkMacSystemFont, "Montserrat", sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('Subtotal productos:', summaryX + 16, sumRowY);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#1e293b';
  ctx.font = '600 14px -apple-system, BlinkMacSystemFont, "Montserrat", sans-serif';
  ctx.fillText(`$${Math.round(order.subtotal || 0).toLocaleString('es-AR')}`, summaryX + summaryW - 16, sumRowY);
  sumRowY += 24;

  // Fila: Costo de envío
  ctx.font = '500 14px -apple-system, BlinkMacSystemFont, "Montserrat", sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'left';
  ctx.fillText('Envío:', summaryX + 16, sumRowY);
  ctx.textAlign = 'right';
  if (order.deliveryOption === 'pickup' || (order.shippingCost ?? 0) === 0) {
    ctx.fillStyle = '#00a650';
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Montserrat", sans-serif';
    ctx.fillText('Gratis', summaryX + summaryW - 16, sumRowY);
  } else {
    ctx.fillStyle = '#1e293b';
    ctx.font = '600 14px -apple-system, BlinkMacSystemFont, "Montserrat", sans-serif';
    ctx.fillText(`$${Math.round(order.shippingCost).toLocaleString('es-AR')}`, summaryX + summaryW - 16, sumRowY);
  }
  sumRowY += 24;

  // Descuento efectivo (si aplica en modo normal)
  if (!isQuickBuy && (order.cashDiscount ?? 0) > 0) {
    ctx.font = '500 14px -apple-system, BlinkMacSystemFont, "Montserrat", sans-serif';
    ctx.fillStyle = '#00a650';
    ctx.textAlign = 'left';
    ctx.fillText('Descuento en efectivo:', summaryX + 16, sumRowY);
    ctx.textAlign = 'right';
    ctx.font = '600 14px -apple-system, BlinkMacSystemFont, "Montserrat", sans-serif';
    ctx.fillText(`-$${Math.round(order.cashDiscount).toLocaleString('es-AR')}`, summaryX + summaryW - 16, sumRowY);
    sumRowY += 24;
  }

  // Divisor dentro del resumen
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(summaryX + 16, sumRowY);
  ctx.lineTo(summaryX + summaryW - 16, sumRowY);
  ctx.stroke();
  sumRowY += 10;

  // Fila Total Final Destacado
  ctx.fillStyle = '#0f172a';
  ctx.font = '800 18px -apple-system, BlinkMacSystemFont, "Montserrat", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('TOTAL A PAGAR:', summaryX + 16, sumRowY);

  ctx.fillStyle = '#00a650';
  ctx.font = '900 24px -apple-system, BlinkMacSystemFont, "Montserrat", sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`$${Math.round(order.total || 0).toLocaleString('es-AR')}`, summaryX + summaryW - 16, sumRowY - 2);

  y += (isQuickBuy ? 92 : 118) + 16;

  // -------------------------------------------------------------
  // SECCIÓN: ENTREGA Y ENVÍO
  // -------------------------------------------------------------
  const deliveryBoxH = isQuickBuy ? 94 : 110;
  ctx.fillStyle = '#f8fafc';
  roundRect(ctx, summaryX, y, summaryW, deliveryBoxH, 14);
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  roundRect(ctx, summaryX, y, summaryW, deliveryBoxH, 14);
  ctx.stroke();

  let delY = y + 14;
  ctx.fillStyle = '#0058bb';
  ctx.font = '800 14px -apple-system, BlinkMacSystemFont, "Montserrat", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  if (order.deliveryOption === 'pickup') {
    ctx.fillText('MODALIDAD: RETIRO EN EL LOCAL', summaryX + 16, delY);
    delY += 22;
    ctx.fillStyle = '#334155';
    ctx.font = '600 13px -apple-system, BlinkMacSystemFont, "Montserrat", sans-serif';
    ctx.fillText('Local Flores: Av. San Pedrito 28 local 4, CABA', summaryX + 16, delY);
    delY += 20;
    ctx.fillStyle = '#64748b';
    ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "Montserrat", sans-serif';
    ctx.fillText('Horario: Lunes a sábados de 11:00 hs a 17:00 hs', summaryX + 16, delY);
  } else {
    ctx.fillText('MODALIDAD: ENVÍO A DOMICILIO', summaryX + 16, delY);
    delY += 22;

    const method = order.shippingMethodName || 'Envío a coordinar';
    const addr = order.deliveryAddress;
    const cp = addr?.postalCode || 'A coordinar';

    ctx.fillStyle = '#334155';
    ctx.font = '600 13px -apple-system, BlinkMacSystemFont, "Montserrat", sans-serif';
    ctx.fillText(`Método: ${method} (CP: ${cp})`, summaryX + 16, delY);
    delY += 20;

    if (addr && addr.street) {
      ctx.fillStyle = '#64748b';
      ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "Montserrat", sans-serif';
      const addressLine = `${addr.street} ${addr.number || ''}${addr.floor ? ' ' + addr.floor : ''}, ${addr.city || ''}, ${addr.province || ''}`;
      ctx.fillText(addressLine, summaryX + 16, delY);
    } else {
      ctx.fillStyle = '#64748b';
      ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "Montserrat", sans-serif';
      ctx.fillText('Dirección exacta a coordinar por WhatsApp', summaryX + 16, delY);
    }
  }

  y += deliveryBoxH + 14;

  // -------------------------------------------------------------
  // SECCIÓN: FORMA DE PAGO
  // -------------------------------------------------------------
  const paymentBoxH = isQuickBuy
    ? 68
    : order.paymentMethod === 'transfer'
    ? 124
    : 80;

  ctx.fillStyle = '#ffffff';
  roundRect(ctx, summaryX, y, summaryW, paymentBoxH, 14);
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  roundRect(ctx, summaryX, y, summaryW, paymentBoxH, 14);
  ctx.stroke();

  let payY = y + 14;
  ctx.fillStyle = '#0f172a';
  ctx.font = '800 14px -apple-system, BlinkMacSystemFont, "Montserrat", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  const paymentTitle =
    order.paymentMethod === 'transfer'
      ? 'FORMA DE PAGO: TRANSFERENCIA BANCARIA'
      : 'FORMA DE PAGO: EFECTIVO';
  ctx.fillText(paymentTitle, summaryX + 16, payY);
  payY += 22;

  if (order.paymentMethod === 'transfer') {
    if (isQuickBuy) {
      ctx.fillStyle = '#475569';
      ctx.font = '500 13px -apple-system, BlinkMacSystemFont, "Montserrat", sans-serif';
      ctx.fillText('Alias: hola.retiro  •  CVU: 0000003100087788243612', summaryX + 16, payY);
    } else {
      ctx.fillStyle = '#334155';
      ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Montserrat", sans-serif';
      ctx.fillText('Alias: hola.retiro', summaryX + 16, payY);
      payY += 18;
      ctx.font = '500 13px -apple-system, BlinkMacSystemFont, "Montserrat", sans-serif';
      ctx.fillText('CVU: 0000003100087788243612', summaryX + 16, payY);
      payY += 18;
      ctx.fillStyle = '#64748b';
      ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "Montserrat", sans-serif';
      ctx.fillText('Titular: Silvia Lembo', summaryX + 16, payY);
    }
  } else {
    ctx.fillStyle = '#00a650';
    ctx.font = '600 13px -apple-system, BlinkMacSystemFont, "Montserrat", sans-serif';
    ctx.fillText('Abonás en efectivo al retirar tu pedido en el local.', summaryX + 16, payY);
  }

  y += paymentBoxH + 14;

  // -------------------------------------------------------------
  // SECCIÓN: DATOS DE CONTACTO (Solo en Compra Normal)
  // -------------------------------------------------------------
  if (!isQuickBuy) {
    const contactBoxH = 76;
    ctx.fillStyle = '#f8fafc';
    roundRect(ctx, summaryX, y, summaryW, contactBoxH, 14);
    ctx.fill();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    roundRect(ctx, summaryX, y, summaryW, contactBoxH, 14);
    ctx.stroke();

    let conY = y + 14;
    ctx.fillStyle = '#0f172a';
    ctx.font = '800 13px -apple-system, BlinkMacSystemFont, "Montserrat", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('DATOS DEL CLIENTE', summaryX + 16, conY);
    conY += 20;

    ctx.fillStyle = '#334155';
    ctx.font = '600 13px -apple-system, BlinkMacSystemFont, "Montserrat", sans-serif';
    const clientName = order.customerName || 'Cliente';
    ctx.fillText(`Nombre: ${clientName}`, summaryX + 16, conY);
    conY += 18;

    ctx.fillStyle = '#64748b';
    ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "Montserrat", sans-serif';
    const clientWa = order.customerWhatsapp ? `WhatsApp: ${order.customerWhatsapp}` : '';
    const clientEmail = order.customerEmail ? ` • Email: ${order.customerEmail}` : '';
    ctx.fillText(`${clientWa}${clientEmail}`, summaryX + 16, conY);

    y += contactBoxH + 14;
  }

  // -------------------------------------------------------------
  // PIE DE PÁGINA
  // -------------------------------------------------------------
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Montserrat", sans-serif';
  ctx.fillText('MICHY • TIENDA OFICIAL • www.michy.com.ar', canvasWidth / 2, y + 4);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 11px -apple-system, BlinkMacSystemFont, "Montserrat", sans-serif';
  ctx.fillText('Presentá este comprobante al coordinar tu pedido por WhatsApp', canvasWidth / 2, y + 22);

  // 4. Exportar a Blob, File y DataURL
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Fallo al crear Blob desde canvas'));
            return;
          }
          const fileName = `pedido-${order.orderNumber}.png`;
          const file = new File([blob], fileName, { type: 'image/png' });
          const dataUrl = canvas.toDataURL('image/png');

          resolve({
            blob,
            file,
            dataUrl,
            orderNumber: order.orderNumber,
          });
        },
        'image/png',
        0.95
      );
    } catch (err) {
      console.error('Error generando blob del comprobante:', err);
      reject(err);
    }
  });
};

/**
 * Descarga de respaldo de la imagen generada
 */
export const downloadReceiptImage = (receipt: GeneratedReceipt) => {
  try {
    const link = document.createElement('a');
    link.href = receipt.dataUrl;
    link.download = `pedido-${receipt.orderNumber}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (e) {
    console.warn('Error al descargar comprobante:', e);
  }
};

/**
 * Copia la imagen al portapapeles del sistema
 */
export const copyReceiptImageToClipboard = async (blob: Blob): Promise<boolean> => {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof ClipboardItem !== 'undefined') {
      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': blob,
        }),
      ]);
      return true;
    }
  } catch (e) {
    console.warn('No se pudo copiar la imagen al portapapeles:', e);
  }
  return false;
};

/**
 * Comparte el comprobante de imagen por WhatsApp:
 * 1. Intenta compartir el archivo de imagen directamente mediante Web Share API (WhatsApp en móvil y desktop compatible).
 * 2. Copia la imagen al portapapeles para que en caso de WhatsApp Web se pegue con Ctrl+V.
 * 3. Abre WhatsApp con un mensaje corto sin texto detallado (solo número de pedido y saludo breve).
 */
export const shareReceiptImageViaWhatsApp = async (params: {
  receipt: GeneratedReceipt;
  customWaDestination?: string;
  isQuickBuy?: boolean;
}): Promise<{
  sharedViaWebShare: boolean;
  copiedToClipboard: boolean;
  openedWhatsAppUrl: boolean;
}> => {
  const { receipt, customWaDestination, isQuickBuy } = params;
  let sharedViaWebShare = false;
  let copiedToClipboard = false;
  let openedWhatsAppUrl = false;

  // 1. Intentar copiar al portapapeles
  try {
    copiedToClipboard = await copyReceiptImageToClipboard(receipt.blob);
  } catch {}

  // 2. Intentar Web Share API con archivo nativo (iOS Safari, Android Chrome)
  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [receipt.file] })
  ) {
    try {
      await navigator.share({
        files: [receipt.file],
        title: `Pedido #${receipt.orderNumber} - Michy`,
        text: `Pedido #${receipt.orderNumber}`,
      });
      sharedViaWebShare = true;
      return { sharedViaWebShare, copiedToClipboard, openedWhatsAppUrl: false };
    } catch (shareError: any) {
      // Si el usuario canceló el selector nativo o no completó, continuamos con el fallback
      console.log('Web Share cancelado o no disponible:', shareError?.name);
    }
  }

  // 3. Fallback: Abrir WhatsApp con mensaje conciso (sin resumen de texto largo)
  const phone = resolveWhatsAppPhone(customWaDestination);
  const shortMessage = isQuickBuy
    ? `Pedido #${receipt.orderNumber} Hola buenas, te paso la imagen de mi pedido de compra rápida para coordinar. ¡Muchas gracias!`
    : `Pedido #${receipt.orderNumber} Hola buenas, acabo de realizar un pedido por la página michy.com.ar y te adjunto la imagen de mi comprobante. ¡Muchas gracias!`;

  const waUrl = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(shortMessage)}`;

  // En caso de desktop/fallback, descargar la imagen para que el usuario la adjunte fácilmente
  downloadReceiptImage(receipt);

  try {
    const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    if (isMobile) {
      window.location.href = waUrl;
    } else {
      const win = window.open(waUrl, '_blank', 'noopener,noreferrer');
      if (!win || win.closed || typeof win.closed === 'undefined') {
        window.location.href = waUrl;
      }
    }
    openedWhatsAppUrl = true;
  } catch (e) {
    window.location.href = waUrl;
    openedWhatsAppUrl = true;
  }

  return { sharedViaWebShare, copiedToClipboard, openedWhatsAppUrl };
};
