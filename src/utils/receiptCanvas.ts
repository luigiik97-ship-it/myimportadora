/**
 * Generador nativo de comprobante de compra en imagen (HTML5 Canvas 2D).
 * 
 * Replicación fiel del diseño oficial:
 * - Header con badge COMPRA RÁPIDA, Logo 'M' centralizado, badge PEDIDO #XXXX y fecha/hora.
 * - Listado de productos ultra-compacto a lo alto con fotos de producto/variante.
 * - Distribución adaptable en 1, 2 o 3 columnas según la cantidad de productos para máxima legibilidad.
 * - Bloque de Totales con desglose de Subtotal, Envío y TOTAL A PAGAR destacado en verde.
 * - Bloque de Modalidad (Retiro en local Flores / Envío a domicilio).
 * - Bloque de Forma de Pago (Efectivo con aviso verde / Transferencia con Alias y CVU).
 * - Pie de comprobante con leyenda para WhatsApp.
 * - Escala 2x Retina para nitidez perfecta en móviles y WhatsApp.
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
  items: Array<{
    title: string;
    quantity: number;
    unitPrice: number;
    totalPrice?: number;
    variantText?: string;
    image?: string;
    isWholesale?: boolean;
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

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let len = text.length;
  while (len > 0 && ctx.measureText(text.slice(0, len) + '…').width > maxWidth) {
    len--;
  }
  return text.slice(0, Math.max(1, len)) + '…';
}

/**
 * Carga segura de imágenes con crossOrigin y timeout rápido para evitar bloquear la generación.
 */
function loadImageSafely(url?: string): Promise<HTMLImageElement | null> {
  if (!url || typeof url !== 'string' || !url.trim()) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    let resolved = false;

    const finish = (result: HTMLImageElement | null) => {
      if (!resolved) {
        resolved = true;
        resolve(result);
      }
    };

    img.onload = () => finish(img);
    img.onerror = () => finish(null);
    setTimeout(() => finish(null), 1200); // 1.2s timeout máximo
    img.src = url;
  });
}

/**
 * Dibuja el logo oficial "M" estilizado con ojos recortados usando Path2D.
 */
function drawBrandLogo(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, targetSize: number) {
  ctx.save();
  ctx.translate(centerX - targetSize / 2, centerY - targetSize / 2);
  const scale = targetSize / 1000;
  ctx.scale(scale, scale);

  ctx.fillStyle = '#000000';
  // 1. Cuerpo superior de la M
  const pathM = new Path2D('M280 190 L130 710 L260 710 L395 670 L500 460 L605 670 L740 710 L865 710 L715 190 L500 460 Z');
  // 2. Mejilla/ojo izquierdo
  const pathLeftEye = new Path2D('M225 705 Q225 815 300 815 Q370 815 370 705 Z');
  // 3. Mejilla/ojo derecho
  const pathRightEye = new Path2D('M630 705 Q630 815 700 815 Q775 815 775 705 Z');

  ctx.fill(pathM);
  ctx.fill(pathLeftEye);
  ctx.fill(pathRightEye);

  ctx.restore();
}

/**
 * Dibuja la miniatura cuadrada redondeada con la foto del producto/variante en modo "cover".
 */
function drawRoundedImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  x: number,
  y: number,
  size: number,
  radius: number
) {
  ctx.save();
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, size, size, radius);
  } else {
    ctx.rect(x, y, size, size);
  }
  ctx.closePath();
  ctx.clip();

  if (img && img.width > 0 && img.height > 0) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, size, size);

    const imgAspect = img.width / img.height;
    let sx = 0;
    let sy = 0;
    let sw = img.width;
    let sh = img.height;
    if (imgAspect > 1) {
      sw = img.height;
      sx = (img.width - sw) / 2;
    } else {
      sh = img.width;
      sy = (img.height - sh) / 2;
    }
    try {
      ctx.drawImage(img, sx, sy, sw, sh, x, y, size, size);
    } catch {
      // Si la imagen lanza SecurityError al dibujar, usar fallback plano
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(x, y, size, size);
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🛍️', x + size / 2, y + size / 2);
    }
  } else {
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🛍️', x + size / 2, y + size / 2);
  }

  ctx.restore();
  // Borde sutil exterior
  drawRoundedRect(ctx, x, y, size, size, radius, undefined, '#e2e8f0', 1);
}

function formatReceiptDateTime(isoDate?: string): string {
  const d = isoDate ? new Date(isoDate) : new Date();
  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'p. m.' : 'a. m.';
  hours = hours % 12 || 12;
  return `${day}/${month}/${year} • ${hours}:${minutes} ${ampm} hs`;
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

/**
 * Función principal que genera el comprobante nativo y devuelve un Blob PNG.
 */
export const generateReceiptBlob = async (data: ReceiptData): Promise<Blob> => {
  const items = Array.isArray(data.items) ? data.items : [];
  const itemCount = items.length;

  // 1. Cargar todas las fotos de las variantes concurrentemente
  const loadedImages = await Promise.all(
    items.map((it) => loadImageSafely(it.image))
  );

  // 2. Determinar cantidad de columnas según cantidad de productos:
  // - Hasta 20 productos: 1 columna
  // - De 21 a 79 productos (ej. ~40 productos): 2 columnas (duplicando la capacidad vertical)
  // - 80 o más productos: 3 columnas (aprovechando al máximo el ancho para pedidos muy grandes)
  let numColumns = 1;
  let canvasWidth = 600;
  if (itemCount >= 80) {
    numColumns = 3;
    canvasWidth = 960;
  } else if (itemCount > 20) {
    numColumns = 2;
    canvasWidth = 760;
  } else {
    numColumns = 1;
    canvasWidth = 600;
  }

  const pad = 22;
  const contentWidth = canvasWidth - pad * 2;
  const colGap = 10;
  const cardWidth = Math.floor((contentWidth - (numColumns - 1) * colGap) / numColumns);

  // Fila de producto más compacta a lo alto (50px de alto en vez de 70px-90px)
  const cardHeight = 50;
  const gapY = 6;
  const rowsCount = Math.max(1, Math.ceil(itemCount / numColumns));
  const productsSectionHeight = rowsCount * (cardHeight + gapY) - gapY;

  // Altura de secciones fijas
  const headerHeight = 70;
  const productsTitleHeight = 26;
  const totalsBoxHeight = 92;
  const modalityBoxHeight = 68;
  const paymentBoxHeight = data.paymentMethod === 'transfer' ? 72 : 58;
  const footerHeight = 36;
  const spacingBetweenCards = 12;

  const totalHeight =
    pad +
    headerHeight +
    productsTitleHeight +
    productsSectionHeight +
    spacingBetweenCards +
    totalsBoxHeight +
    spacingBetweenCards +
    modalityBoxHeight +
    spacingBetweenCards +
    paymentBoxHeight +
    spacingBetweenCards +
    footerHeight +
    pad;

  // 3. Inicializar Canvas a escala 2x (Retina)
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth * scale;
  canvas.height = totalHeight * scale;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('No se pudo inicializar el contexto 2D del Canvas');
  }

  ctx.scale(scale, scale);

  // Fondo blanco puro
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasWidth, totalHeight);

  // Marco exterior sutil con esquinas redondeadas
  drawRoundedRect(ctx, 4, 4, canvasWidth - 8, totalHeight - 8, 16, '#ffffff', '#e2e8f0', 1.5);

  let currentY = pad;

  // ==========================================
  // 1. HEADER (Igual a la imagen subida)
  // ==========================================
  // A la izquierda: texto COMPRA RÁPIDA • PEDIDO
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
  ctx.fillText('COMPRA RÁPIDA • PEDIDO', pad, currentY + 12);

  // Al centro: Logo oficial 'M' estilizado con ojos recortados
  const logoSize = 44;
  drawBrandLogo(ctx, canvasWidth / 2, currentY + 16, logoSize);

  // A la derecha: Badge PEDIDO #XXXX y debajo fecha/hora
  const pillW = 142;
  const pillH = 32;
  const pillX = canvasWidth - pad - pillW;
  const pillY = currentY + 2;

  drawRoundedRect(ctx, pillX, pillY, pillW, pillH, 8, '#eff6ff', '#bfdbfe', 1.5);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#0058bb';
  ctx.font = '900 13px system-ui, -apple-system, sans-serif';
  ctx.fillText(`PEDIDO #${data.orderNumber}`, pillX + pillW / 2, pillY + pillH / 2);

  // Fecha y hora debajo del badge de pedido
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#94a3b8';
  ctx.font = '10px system-ui, -apple-system, sans-serif';
  const dateTimeStr = formatReceiptDateTime(data.createdAt);
  ctx.fillText(dateTimeStr, canvasWidth - pad, pillY + pillH + 5);

  // Línea divisoria suave bajo el header
  ctx.strokeStyle = '#f1f5f9';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, currentY + 54);
  ctx.lineTo(canvasWidth - pad, currentY + 54);
  ctx.stroke();

  currentY += headerHeight;

  // ==========================================
  // 2. TÍTULO DE PRODUCTOS
  // ==========================================
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#0f172a';
  ctx.font = '900 13px system-ui, -apple-system, sans-serif';
  ctx.fillText(`PRODUCTOS (${data.itemsCount})`, pad, currentY + 8);

  currentY += productsTitleHeight;

  // ==========================================
  // 3. PRODUCTOS EN FILAS COMPACTAS (1, 2 O 3 COLUMNAS)
  // ==========================================
  items.forEach((item, index) => {
    const col = index % numColumns;
    const row = Math.floor(index / numColumns);
    const cardX = pad + col * (cardWidth + colGap);
    const cardY = currentY + row * (cardHeight + gapY);

    // Tarjeta del producto
    drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 10, '#f8fafc', '#e2e8f0', 1);

    // Miniatura de foto del producto/variante (38x38 compacta)
    const imgSize = 38;
    const imgX = cardX + 6;
    const imgY = cardY + 6;
    const loadedImg = loadedImages[index] || null;
    drawRoundedImage(ctx, loadedImg, imgX, imgY, imgSize, 7);

    // Área de texto
    const textStartX = cardX + 50;
    const itemTotal = item.totalPrice ?? item.unitPrice * item.quantity;
    const formattedTotal = `$${Math.round(itemTotal).toLocaleString('es-AR')}`;

    // Medir precio para no encimar el texto
    ctx.font = '900 13px system-ui, -apple-system, sans-serif';
    const priceWidth = ctx.measureText(formattedTotal).width;
    const maxTextWidth = cardWidth - 56 - priceWidth - 8;

    // Renglón 1: Título del producto (compacto y legible)
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
    const truncatedTitle = truncateText(ctx, item.title, maxTextWidth);
    ctx.fillText(truncatedTitle, textStartX, cardY + 6);

    // Renglón 2: Cantidad y Variante en pastilla destacada (ej: 3x Pikachu)
    const variantLabel = item.variantText ? item.variantText.trim() : 'Unidad';
    const badgeText = `${item.quantity}x ${variantLabel}`;

    ctx.font = '900 10px system-ui, -apple-system, sans-serif';
    const badgeMetrics = ctx.measureText(badgeText);
    const badgeW = Math.min(badgeMetrics.width + 10, maxTextWidth);
    const badgeH = 15;
    const badgeY = cardY + 20;

    drawRoundedRect(ctx, textStartX, badgeY, badgeW, badgeH, 4, '#e2e8f0');

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#0f172a';
    const truncatedBadge = truncateText(ctx, badgeText, badgeW - 6);
    ctx.fillText(truncatedBadge, textStartX + 5, badgeY + badgeH / 2);

    // Renglón 3: Detalle de precio unitario y tipo
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#64748b';
    ctx.font = '9px system-ui, -apple-system, sans-serif';
    const unitPriceFormatted = Math.round(item.unitPrice).toLocaleString('es-AR');
    const priceType = item.isWholesale ? 'precio mayorista' : 'precio minorista';
    const detailText = `a $${unitPriceFormatted} · ${priceType}`;
    ctx.fillText(truncateText(ctx, detailText, maxTextWidth), textStartX, cardY + cardHeight - 4);

    // Precio total a la derecha del card (negrita grande)
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#0f172a';
    ctx.font = '900 14px monospace, system-ui';
    ctx.fillText(formattedTotal, cardX + cardWidth - 10, cardY + cardHeight / 2);
  });

  currentY += productsSectionHeight + spacingBetweenCards;

  // ==========================================
  // 4. BLOQUE DE TOTALES
  // ==========================================
  drawRoundedRect(ctx, pad, currentY, contentWidth, totalsBoxHeight, 12, '#ffffff', '#e2e8f0', 1);

  // Subtotal productos
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#64748b';
  ctx.font = '12px system-ui, -apple-system, sans-serif';
  ctx.fillText('Subtotal productos:', pad + 16, currentY + 20);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
  const subtotalVal = data.subtotal || data.total;
  ctx.fillText(`$${Math.round(subtotalVal).toLocaleString('es-AR')}`, canvasWidth - pad - 16, currentY + 20);

  // Envío
  ctx.textAlign = 'left';
  ctx.fillStyle = '#64748b';
  ctx.font = '12px system-ui, -apple-system, sans-serif';
  ctx.fillText('Envío:', pad + 16, currentY + 40);

  ctx.textAlign = 'right';
  const isFreeShipping = !data.shippingCost || data.shippingCost === 0 || data.deliveryOption === 'pickup';
  ctx.fillStyle = isFreeShipping ? '#00a650' : '#0f172a';
  ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
  ctx.fillText(
    isFreeShipping ? 'Gratis' : `$${Math.round(data.shippingCost || 0).toLocaleString('es-AR')}`,
    canvasWidth - pad - 16,
    currentY + 40
  );

  // Línea divisoria interior
  ctx.strokeStyle = '#f1f5f9';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad + 14, currentY + 54);
  ctx.lineTo(canvasWidth - pad - 14, currentY + 54);
  ctx.stroke();

  // TOTAL A PAGAR (Grande y Verde como en la imagen)
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#0f172a';
  ctx.font = '900 14px system-ui, -apple-system, sans-serif';
  ctx.fillText('TOTAL A PAGAR:', pad + 16, currentY + 72);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#00a650';
  ctx.font = '900 22px system-ui, -apple-system, sans-serif';
  ctx.fillText(`$${Math.round(data.total).toLocaleString('es-AR')}`, canvasWidth - pad - 16, currentY + 72);

  currentY += totalsBoxHeight + spacingBetweenCards;

  // ==========================================
  // 5. BLOQUE DE MODALIDAD (Retiro en local / Envío)
  // ==========================================
  drawRoundedRect(ctx, pad, currentY, contentWidth, modalityBoxHeight, 12, '#f8fbff', '#bfdbfe', 1.5);

  const isPickup = data.deliveryOption === 'pickup';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#0058bb';
  ctx.font = '900 12px system-ui, -apple-system, sans-serif';
  ctx.fillText(
    isPickup ? 'MODALIDAD: RETIRO EN EL LOCAL' : 'MODALIDAD: ENVÍO A DOMICILIO',
    pad + 16,
    currentY + 12
  );

  if (isPickup) {
    ctx.fillStyle = '#334155';
    ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
    ctx.fillText('Local Flores: Av. San Pedrito 28 local 4, CABA', pad + 16, currentY + 30);

    ctx.fillStyle = '#64748b';
    ctx.font = '10px system-ui, -apple-system, sans-serif';
    ctx.fillText('Horario: Lunes a sábados de 11:00 hs a 17:00 hs', pad + 16, currentY + 46);
  } else {
    const addr = data.deliveryAddress;
    const addressStr = addr
      ? `${addr.street || ''} ${addr.number || ''}${addr.floor ? ' ' + addr.floor : ''}, ${addr.city || ''}, ${addr.province || ''}`
      : 'Dirección a coordinar';
    ctx.fillStyle = '#334155';
    ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
    ctx.fillText(truncateText(ctx, addressStr, contentWidth - 32), pad + 16, currentY + 30);

    ctx.fillStyle = '#64748b';
    ctx.font = '10px system-ui, -apple-system, sans-serif';
    const methodStr = data.shippingMethodName || 'Envío por correo/mensajería';
    ctx.fillText(truncateText(ctx, methodStr, contentWidth - 32), pad + 16, currentY + 46);
  }

  currentY += modalityBoxHeight + spacingBetweenCards;

  // ==========================================
  // 6. BLOQUE FORMA DE PAGO
  // ==========================================
  const isCash = data.paymentMethod === 'cash';
  drawRoundedRect(ctx, pad, currentY, contentWidth, paymentBoxHeight, 12, '#ffffff', '#e2e8f0', 1);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#0f172a';
  ctx.font = '900 12px system-ui, -apple-system, sans-serif';
  ctx.fillText(isCash ? 'FORMA DE PAGO: EFECTIVO' : 'FORMA DE PAGO: TRANSFERENCIA', pad + 16, currentY + 12);

  if (isCash) {
    ctx.fillStyle = '#00a650';
    ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
    ctx.fillText('Abonás en efectivo al retirar tu pedido en el local.', pad + 16, currentY + 32);
  } else {
    ctx.fillStyle = '#0058bb';
    ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
    ctx.fillText('Alias: hola.retiro • Nombre: Silvia Lembo', pad + 16, currentY + 30);

    ctx.fillStyle = '#64748b';
    ctx.font = '10px system-ui, -apple-system, sans-serif';
    ctx.fillText('CVU: 0000003100087788243612', pad + 16, currentY + 48);
  }

  currentY += paymentBoxHeight + spacingBetweenCards;

  // ==========================================
  // 7. FOOTER
  // ==========================================
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#94a3b8';
  ctx.font = '10px system-ui, -apple-system, sans-serif';
  ctx.fillText(
    'Presentá este comprobante al coordinar tu pedido por WhatsApp',
    canvasWidth / 2,
    currentY + 12
  );

  // 4. Exportar a Blob PNG de alta fidelidad
  return new Promise<Blob>((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            try {
              const dataUrl = canvas.toDataURL('image/png');
              resolve(dataURLToBlob(dataUrl));
            } catch (err) {
              reject(err);
            }
          }
        },
        'image/png',
        0.96
      );
    } catch (e) {
      try {
        const dataUrl = canvas.toDataURL('image/png');
        resolve(dataURLToBlob(dataUrl));
      } catch (err) {
        reject(err);
      }
    }
  });
};
