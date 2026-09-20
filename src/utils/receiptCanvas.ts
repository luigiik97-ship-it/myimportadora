/**
 * Generador nativo de imagen de comprobante de compra usando HTML5 Canvas 2D.
 * 
 * Ventajas:
 * 1. 100% libre de fallos por CSS moderno (Tailwind v4 oklch / lab).
 * 2. No depende del DOM externo ni de coordenadas negativas (-9999px).
 * 3. Escala nítida 2x (Retina) para legibilidad perfecta en celulares y WhatsApp.
 * 4. Generación instantánea y determinista sin dependencias externas propensas a fallos.
 */

export interface ReceiptData {
  orderNumber: string;
  total: number;
  subtotal?: number;
  totalUnits: number;
  itemsCount: number;
  paymentMethod?: 'transfer' | 'cash';
  deliveryOption?: 'pickup' | 'delivery' | null;
  shippingMethodName?: string;
  shippingCost?: number;
  cashDiscount?: number;
  customerName?: string;
  customerWhatsapp?: string;
  items: Array<{
    title: string;
    quantity: number;
    unitPrice: number;
    totalPrice?: number;
    variantText?: string;
  }>;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fillColor?: string,
  strokeColor?: string,
  strokeWidth: number = 1
) {
  ctx.save();
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, width, height, radius);
  } else {
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
  }
  ctx.closePath();

  if (fillColor) {
    ctx.fillStyle = fillColor;
    ctx.fill();
  }
  if (strokeColor) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.stroke();
  }
  ctx.restore();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number {
  const words = text.split(' ');
  let line = '';
  let currentY = y;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line.trim(), x, currentY);
      line = words[n] + ' ';
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line.trim(), x, currentY);
  return currentY + lineHeight;
}

function dataURLToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
  const binary = atob(parts[1]);
  const len = binary.length;
  const u8arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    u8arr[i] = binary.charCodeAt(i);
  }
  return new Blob([u8arr], { type: mime });
}

export const generateReceiptBlob = async (data: ReceiptData): Promise<Blob> => {
  const width = 560; // Ancho móvil óptimo vertical
  const pad = 24;
  const contentWidth = width - pad * 2;

  // 1. Calcular altura necesaria para todos los productos
  let itemsHeight = 0;
  const itemRowHeights: number[] = [];

  // Canvas temporal para medir texto
  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d');
  if (measureCtx) {
    measureCtx.font = 'bold 13px system-ui, -apple-system, sans-serif';
  }

  for (const item of data.items) {
    let rowH = 68; // Alto base con badge y precio
    if (measureCtx) {
      const words = item.title.split(' ');
      let line = '';
      let linesCount = 1;
      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const testWidth = measureCtx.measureText(testLine).width;
        if (testWidth > contentWidth - 16 && n > 0) {
          line = words[n] + ' ';
          linesCount++;
        } else {
          line = testLine;
        }
      }
      if (linesCount > 1) {
        rowH += (linesCount - 1) * 16;
      }
    }
    if (item.variantText) {
      rowH += 22; // Espacio para la variante
    }
    itemRowHeights.push(rowH);
    itemsHeight += rowH + 8; // 8px de margen entre productos
  }

  // Altura total estimada
  let totalHeight =
    pad + // padding top
    85 + // Header de la tienda
    72 + // Banner del Pedido
    115 + // Datos del cliente y entrega
    30 + // Título de detalle de productos
    itemsHeight + // Productos
    115 + // Totales
    (data.paymentMethod === 'transfer' ? 80 : 0) + // Datos bancarios
    60 + // Footer
    pad; // padding bottom

  // 2. Crear Canvas con escala 2x para resolución Retina
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = totalHeight * scale;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('No se pudo inicializar el contexto 2D del Canvas');
  }

  ctx.scale(scale, scale);

  // Fondo blanco nítido
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, totalHeight);

  // Borde exterior sutil del comprobante
  drawRoundedRect(ctx, 4, 4, width - 8, totalHeight - 8, 16, undefined, '#e2e8f0', 1.5);

  let currentY = pad;

  // ==========================
  // HEADER DE LA TIENDA
  // ==========================
  // Puntos de color
  ctx.beginPath();
  ctx.arc(width / 2 - 110, currentY + 12, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#0058bb';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(width / 2 + 110, currentY + 12, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#00a650';
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#0f172a';
  ctx.font = '900 22px system-ui, -apple-system, sans-serif';
  ctx.fillText('MY IMPORTADORA', width / 2, currentY + 18);

  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
  ctx.fillText('Av. San Pedrito 28 local 4, CABA • WhatsApp: 1166904678', width / 2, currentY + 36);

  // Línea divisoria
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, currentY + 48);
  ctx.lineTo(width - pad, currentY + 48);
  ctx.stroke();

  currentY += 60;

  // ==========================
  // BANNER DEL PEDIDO
  // ==========================
  drawRoundedRect(ctx, pad, currentY, contentWidth, 62, 10, '#0f172a');

  ctx.textAlign = 'left';
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
  ctx.fillText('COMPROBANTE DE COMPRA', pad + 16, currentY + 22);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 20px system-ui, -apple-system, sans-serif';
  ctx.fillText(`Pedido #${data.orderNumber}`, pad + 16, currentY + 46);

  // Fecha y hora a la derecha
  const now = new Date();
  const dateStr = now.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = `${now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs`;

  ctx.textAlign = 'right';
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
  ctx.fillText(dateStr, width - pad - 16, currentY + 25);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px system-ui, -apple-system, sans-serif';
  ctx.fillText(timeStr, width - pad - 16, currentY + 44);

  currentY += 74;

  // ==========================
  // DATOS DEL CLIENTE Y MODALIDAD
  // ==========================
  const infoBoxHeight = 100;
  drawRoundedRect(ctx, pad, currentY, contentWidth, infoBoxHeight, 10, '#f8fafc', '#e2e8f0', 1);

  ctx.textAlign = 'left';

  // Columna Izquierda: Cliente y Entrega
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 9px system-ui, -apple-system, sans-serif';
  ctx.fillText('CLIENTE:', pad + 14, currentY + 20);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
  const customerDisplay = (data.customerName || 'Cliente').substring(0, 24);
  ctx.fillText(customerDisplay, pad + 14, currentY + 36);

  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 9px system-ui, -apple-system, sans-serif';
  ctx.fillText('ENTREGA:', pad + 14, currentY + 62);

  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
  const deliveryDisplay =
    data.deliveryOption === 'pickup'
      ? 'Retiro en Local San Pedrito'
      : `Envío (${data.shippingMethodName || 'A coordinar'})`;
  ctx.fillText(deliveryDisplay.substring(0, 28), pad + 14, currentY + 78);

  // Columna Derecha: Pago y Unidades Totales
  const colRightX = width / 2 + 10;
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 9px system-ui, -apple-system, sans-serif';
  ctx.fillText('FORMA DE PAGO:', colRightX, currentY + 20);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
  const paymentTitle = data.paymentMethod === 'transfer' ? 'Transferencia Bancaria' : 'Efectivo';
  ctx.fillText(paymentTitle, colRightX, currentY + 36);

  if (data.paymentMethod === 'transfer') {
    ctx.fillStyle = '#0058bb';
    ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
    ctx.fillText('Alias: hola.retiro (Silvia Lembo)', colRightX, currentY + 48);
  }

  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 9px system-ui, -apple-system, sans-serif';
  ctx.fillText('TOTAL UNIDADES:', colRightX, currentY + 66);

  ctx.fillStyle = '#0058bb';
  ctx.font = '900 15px system-ui, -apple-system, sans-serif';
  ctx.fillText(`${data.totalUnits} un.`, colRightX, currentY + 84);

  currentY += infoBoxHeight + 16;

  // ==========================
  // DETALLE DE PRODUCTOS
  // ==========================
  ctx.textAlign = 'left';
  ctx.fillStyle = '#0f172a';
  ctx.font = '900 11px system-ui, -apple-system, sans-serif';
  ctx.fillText(`DETALLE DE PRODUCTOS (${data.itemsCount})`, pad, currentY + 10);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
  ctx.fillText(`${data.totalUnits} unidades en total`, width - pad, currentY + 10);

  currentY += 20;

  // Lista de items
  data.items.forEach((item, idx) => {
    const rowH = itemRowHeights[idx];
    drawRoundedRect(ctx, pad, currentY, contentWidth, rowH, 8, '#ffffff', '#e2e8f0', 1);

    // 1. Badge de Unidades de alto contraste
    const unitBadgeText = `${item.quantity} UNIDAD${item.quantity > 1 ? 'ES' : ''}`;
    ctx.font = '900 11px system-ui, -apple-system, sans-serif';
    const badgeMetrics = ctx.measureText(unitBadgeText);
    const badgeW = badgeMetrics.width + 16;
    drawRoundedRect(ctx, pad + 10, currentY + 8, badgeW, 20, 4, '#0058bb');

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(unitBadgeText, pad + 10 + badgeW / 2, currentY + 22);

    // 2. Precio total del ítem a la derecha
    const itemTotal = item.totalPrice ?? item.unitPrice * item.quantity;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#0f172a';
    ctx.font = '900 13px monospace, system-ui';
    ctx.fillText(`$${Math.round(itemTotal).toLocaleString('es-AR')}`, width - pad - 12, currentY + 22);

    // 3. Título del producto
    ctx.textAlign = 'left';
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
    const titleNextY = wrapText(ctx, item.title, pad + 12, currentY + 44, contentWidth - 24, 16);

    let nextY = titleNextY;

    // 4. Variante si existe
    if (item.variantText) {
      const cleanVar = item.variantText.trim();
      const varText = `Variante: ${cleanVar}`;
      ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
      const varW = Math.min(ctx.measureText(varText).width + 14, contentWidth - 24);
      drawRoundedRect(ctx, pad + 12, nextY - 4, varW, 18, 4, '#fef3c7', '#fde68a', 1);

      ctx.fillStyle = '#92400e';
      ctx.fillText(varText, pad + 18, nextY + 9);
      nextY += 20;
    }

    // 5. Precio unitario
    ctx.textAlign = 'left';
    ctx.fillStyle = '#64748b';
    ctx.font = '10px system-ui, -apple-system, sans-serif';
    ctx.fillText(`Unitario: $${Math.round(item.unitPrice).toLocaleString('es-AR')}`, pad + 12, currentY + rowH - 8);

    currentY += rowH + 8;
  });

  currentY += 8;

  // ==========================
  // TOTALES Y FORMA DE PAGO
  // ==========================
  const totalsBoxHeight = 100;
  drawRoundedRect(ctx, pad, currentY, contentWidth, totalsBoxHeight, 10, '#f1f5f9', '#cbd5e1', 1);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#475569';
  ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
  ctx.fillText('Subtotal Productos:', pad + 16, currentY + 24);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
  const subtotalVal = data.subtotal || data.total;
  ctx.fillText(`$${Math.round(subtotalVal).toLocaleString('es-AR')}`, width - pad - 16, currentY + 24);

  if (data.shippingCost !== undefined && data.deliveryOption === 'delivery') {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#475569';
    ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
    ctx.fillText('Costo de Envío:', pad + 16, currentY + 44);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#1e293b';
    const shipText = data.shippingCost === 0 ? 'Gratis' : `$${Math.round(data.shippingCost).toLocaleString('es-AR')}`;
    ctx.fillText(shipText, width - pad - 16, currentY + 44);
  }

  // Línea divisoria dentro del cuadro de totales
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pad + 16, currentY + 58);
  ctx.lineTo(width - pad - 16, currentY + 58);
  ctx.stroke();

  // TOTAL GRANDE
  ctx.textAlign = 'left';
  ctx.fillStyle = '#0f172a';
  ctx.font = '900 13px system-ui, -apple-system, sans-serif';
  ctx.fillText('TOTAL A PAGAR:', pad + 16, currentY + 84);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#0f172a';
  ctx.font = '900 22px system-ui, -apple-system, sans-serif';
  ctx.fillText(`$${Math.round(data.total).toLocaleString('es-AR')}`, width - pad - 16, currentY + 84);

  currentY += totalsBoxHeight + 14;

  // ==========================
  // DATOS DE TRANSFERENCIA (si aplica)
  // ==========================
  if (data.paymentMethod === 'transfer') {
    const transferH = 68;
    drawRoundedRect(ctx, pad, currentY, contentWidth, transferH, 10, '#eff6ff', '#bfdbfe', 1);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#1e40af';
    ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
    ctx.fillText('DATOS PARA TRANSFERIR:', width / 2, currentY + 18);

    ctx.fillStyle = '#1e3a8a';
    ctx.font = '900 15px system-ui, -apple-system, sans-serif';
    ctx.fillText('Alias: hola.retiro', width / 2, currentY + 38);

    ctx.fillStyle = '#1d4ed8';
    ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
    ctx.fillText('Titular: Silvia Lembo • CVU: 0000003100087788243612', width / 2, currentY + 54);

    currentY += transferH + 14;
  }

  // ==========================
  // FOOTER
  // ==========================
  ctx.textAlign = 'center';
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
  ctx.fillText('michy.com.ar • WhatsApp oficial: 1166904678', width / 2, currentY + 12);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '10px system-ui, -apple-system, sans-serif';
  ctx.fillText('Envía esta imagen a nuestro WhatsApp para procesar tu pedido de inmediato.', width / 2, currentY + 28);

  // 3. Exportar Canvas a Blob PNG con fallback
  return new Promise<Blob>((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            try {
              const dataUrl = canvas.toDataURL('image/png');
              const fallbackBlob = dataURLToBlob(dataUrl);
              resolve(fallbackBlob);
            } catch (err) {
              reject(err);
            }
          }
        },
        'image/png',
        0.95
      );
    } catch (e) {
      try {
        const dataUrl = canvas.toDataURL('image/png');
        const fallbackBlob = dataURLToBlob(dataUrl);
        resolve(fallbackBlob);
      } catch (err) {
        reject(err);
      }
    }
  });
};
