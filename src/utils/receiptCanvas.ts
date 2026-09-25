import { jsPDF } from 'jspdf';

/**
 * Generador nativo de comprobante / resumen de pedido en formato PDF.
 * 
 * Características:
 * - Soporte multipágina para pedidos pequeños, medianos y masivos (100, 200 o más productos).
 * - Calidad PDF estándar, nítida, legible y ultra liviana (~60-90 KB por página).
 * - Diseño idéntico al comprobante oficial:
 *   • Header oficial con logo 'M' estilizado, badge PEDIDO #XXXX y fecha/hora.
 *   • Listado de productos en tarjetas compactas con fotos/miniaturas de variantes.
 *   • Bloque de Totales (Subtotal, Envío y TOTAL A PAGAR en verde).
 *   • Bloque de Modalidad (Retiro en local / Envío a domicilio con dirección).
 *   • Bloque de Forma de Pago (Efectivo / Transferencia con Alias y CVU).
 *   • Numeración de páginas "Página X de Y" y pie instructivo para WhatsApp.
 * - 100% cliente: no guarda archivos en Supabase ni ningún servidor.
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
 * Carga segura de imágenes con crossOrigin y timeout rápido (800ms) para evitar demoras en pedidos grandes.
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
    setTimeout(() => finish(null), 850);
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
  // 2. Ojo izquierdo
  const pathLeftEye = new Path2D('M225 705 Q225 815 300 815 Q370 815 370 705 Z');
  // 3. Ojo derecho
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
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(x, y, size, size);
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🛍️', x + size / 2, y + size / 2);
    }
  } else {
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🛍️', x + size / 2, y + size / 2);
  }

  ctx.restore();
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

/**
 * Dibuja los bloques de cierre (Totales, Modalidad de entrega y Forma de pago).
 */
function drawBottomBlocks(
  ctx: CanvasRenderingContext2D,
  startY: number,
  data: ReceiptData,
  contentWidth: number,
  pad: number,
  canvasWidth: number
): number {
  let currentY = startY;
  const spacingBetweenCards = 10;
  const totalsBoxHeight = 88;
  const modalityBoxHeight = 64;
  const paymentBoxHeight = data.paymentMethod === 'transfer' ? 70 : 58;

  // 1. BLOQUE DE TOTALES
  drawRoundedRect(ctx, pad, currentY, contentWidth, totalsBoxHeight, 10, '#ffffff', '#e2e8f0', 1);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#64748b';
  ctx.font = '11px system-ui, -apple-system, sans-serif';
  ctx.fillText('Subtotal productos:', pad + 14, currentY + 18);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
  const subtotalVal = data.subtotal || data.total;
  ctx.fillText(`$${Math.round(subtotalVal).toLocaleString('es-AR')}`, canvasWidth - pad - 14, currentY + 18);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#64748b';
  ctx.font = '11px system-ui, -apple-system, sans-serif';
  ctx.fillText('Envío:', pad + 14, currentY + 38);

  ctx.textAlign = 'right';
  const isFreeShipping = !data.shippingCost || data.shippingCost === 0 || data.deliveryOption === 'pickup';
  ctx.fillStyle = isFreeShipping ? '#00a650' : '#0f172a';
  ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
  ctx.fillText(
    isFreeShipping ? 'Gratis' : `$${Math.round(data.shippingCost || 0).toLocaleString('es-AR')}`,
    canvasWidth - pad - 14,
    currentY + 38
  );

  // Línea divisoria interior
  ctx.strokeStyle = '#f1f5f9';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad + 12, currentY + 52);
  ctx.lineTo(canvasWidth - pad - 12, currentY + 52);
  ctx.stroke();

  // TOTAL A PAGAR (Grande y Verde)
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#0f172a';
  ctx.font = '900 13px system-ui, -apple-system, sans-serif';
  ctx.fillText('TOTAL A PAGAR:', pad + 14, currentY + 68);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#00a650';
  ctx.font = '900 20px system-ui, -apple-system, sans-serif';
  ctx.fillText(`$${Math.round(data.total).toLocaleString('es-AR')}`, canvasWidth - pad - 14, currentY + 68);

  currentY += totalsBoxHeight + spacingBetweenCards;

  // 2. BLOQUE DE MODALIDAD
  drawRoundedRect(ctx, pad, currentY, contentWidth, modalityBoxHeight, 10, '#f8fbff', '#bfdbfe', 1.2);

  const isPickup = data.deliveryOption === 'pickup';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#0058bb';
  ctx.font = '900 11px system-ui, -apple-system, sans-serif';
  ctx.fillText(
    isPickup ? 'MODALIDAD: RETIRO EN EL LOCAL' : 'MODALIDAD: ENVÍO A DOMICILIO',
    pad + 14,
    currentY + 10
  );

  if (isPickup) {
    ctx.fillStyle = '#334155';
    ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
    ctx.fillText('Local Flores: Av. San Pedrito 28, CABA', pad + 14, currentY + 28);

    ctx.fillStyle = '#64748b';
    ctx.font = '10px system-ui, -apple-system, sans-serif';
    ctx.fillText('Horario: Lunes a sábados de 11:00 hs a 17:00 hs', pad + 14, currentY + 44);
  } else {
    const addr = data.deliveryAddress;
    const addressStr = addr
      ? `${addr.street || ''} ${addr.number || ''}${addr.floor ? ' ' + addr.floor : ''}, ${addr.city || ''}, ${addr.province || ''}`
      : 'Dirección a coordinar';
    ctx.fillStyle = '#334155';
    ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
    ctx.fillText(truncateText(ctx, addressStr, contentWidth - 28), pad + 14, currentY + 28);

    ctx.fillStyle = '#64748b';
    ctx.font = '10px system-ui, -apple-system, sans-serif';
    const methodStr = data.shippingMethodName || 'Envío por correo/mensajería';
    ctx.fillText(truncateText(ctx, methodStr, contentWidth - 28), pad + 14, currentY + 44);
  }

  currentY += modalityBoxHeight + spacingBetweenCards;

  // 3. BLOQUE FORMA DE PAGO
  const isCash = data.paymentMethod === 'cash';
  drawRoundedRect(ctx, pad, currentY, contentWidth, paymentBoxHeight, 10, '#ffffff', '#e2e8f0', 1);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#0f172a';
  ctx.font = '900 11px system-ui, -apple-system, sans-serif';
  ctx.fillText(isCash ? 'FORMA DE PAGO: EFECTIVO' : 'FORMA DE PAGO: TRANSFERENCIA', pad + 14, currentY + 10);

  if (isCash) {
    ctx.fillStyle = '#00a650';
    ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
    ctx.fillText('Abonás en efectivo al retirar tu pedido en el local.', pad + 14, currentY + 30);
  } else {
    ctx.fillStyle = '#0058bb';
    ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
    ctx.fillText('Alias: hola.retiro • Nombre: Silvia Lembo', pad + 14, currentY + 28);

    ctx.fillStyle = '#64748b';
    ctx.font = '10px system-ui, -apple-system, sans-serif';
    ctx.fillText('CVU: 0000003100087788243612', pad + 14, currentY + 45);
  }

  currentY += paymentBoxHeight;
  return currentY;
}

interface PagePlan {
  pageNumber: number;
  itemStartIndex: number;
  itemEndIndex: number;
  isFirstPage: boolean;
  hasBottomBlocks: boolean;
}

/**
 * Generador principal de comprobantes en PDF multipágina.
 */
export const generateReceiptPdfBlob = async (
  data: ReceiptData,
  options: { mode?: 'detail' | 'summary' } = {}
): Promise<Blob> => {
  const mode = options.mode || 'summary';
  const items = Array.isArray(data.items) ? data.items : [];

  // 1. Carga concurrente de imágenes con timeout protector
  const loadedImages = await Promise.all(
    items.map((it) => loadImageSafely(it.image))
  );

  // 2. Geometría estándar A4
  const PAGE_WIDTH = 800;
  const PAGE_HEIGHT = 1130;
  const PAD = 28;
  const contentWidth = PAGE_WIDTH - PAD * 2; // 744px

  // Columnas: 1 columna si hay muy pocos ítems (<= 6), sino 2 columnas compactas
  const numCols = items.length <= 6 ? 1 : 2;
  const colGap = 12;
  const cardWidth = Math.floor((contentWidth - (numCols - 1) * colGap) / numCols);
  const cardHeight = 50;
  const gapY = 6;
  const rowHeight = cardHeight + gapY; // 56px

  // Alturas de secciones fijas
  const headerHeightP1 = 76;
  const titleHeight = 28;
  const runningHeaderHeight = 44;
  const bottomBlocksHeight = 250;
  const pageFooterHeight = 34;

  // Capacidad de filas por página
  const availH_P1_withBottom = PAGE_HEIGHT - PAD * 2 - headerHeightP1 - titleHeight - bottomBlocksHeight - pageFooterHeight;
  const maxRows_P1_withBottom = Math.max(1, Math.floor(availH_P1_withBottom / rowHeight));
  const maxItems_P1_withBottom = maxRows_P1_withBottom * numCols;

  const availH_P1_full = PAGE_HEIGHT - PAD * 2 - headerHeightP1 - titleHeight - pageFooterHeight;
  const maxRows_P1_full = Math.max(1, Math.floor(availH_P1_full / rowHeight));
  const maxItems_P1_full = maxRows_P1_full * numCols;

  const availH_later_withBottom = PAGE_HEIGHT - PAD * 2 - runningHeaderHeight - bottomBlocksHeight - pageFooterHeight;
  const maxRows_later_withBottom = Math.max(1, Math.floor(availH_later_withBottom / rowHeight));
  const maxItems_later_withBottom = maxRows_later_withBottom * numCols;

  const availH_later_full = PAGE_HEIGHT - PAD * 2 - runningHeaderHeight - pageFooterHeight;
  const maxRows_later_full = Math.max(1, Math.floor(availH_later_full / rowHeight));
  const maxItems_later_full = maxRows_later_full * numCols;

  // Planificación de páginas (paginación precisa)
  const pages: PagePlan[] = [];

  if (items.length <= maxItems_P1_withBottom) {
    // Todos los productos y los totales caben en la Página 1
    pages.push({
      pageNumber: 1,
      itemStartIndex: 0,
      itemEndIndex: items.length,
      isFirstPage: true,
      hasBottomBlocks: true,
    });
  } else {
    // La Página 1 toma el máximo posible de productos sin totales
    const p1End = Math.min(items.length, maxItems_P1_full);
    pages.push({
      pageNumber: 1,
      itemStartIndex: 0,
      itemEndIndex: p1End,
      isFirstPage: true,
      hasBottomBlocks: false,
    });

    let currentIndex = p1End;

    while (currentIndex < items.length) {
      const remaining = items.length - currentIndex;
      const pageNum = pages.length + 1;

      if (remaining <= maxItems_later_withBottom) {
        // Los productos restantes caben en esta página con los bloques finales
        pages.push({
          pageNumber: pageNum,
          itemStartIndex: currentIndex,
          itemEndIndex: items.length,
          isFirstPage: false,
          hasBottomBlocks: true,
        });
        currentIndex = items.length;
      } else {
        // Llenar esta página al máximo sin bloques finales
        const take = Math.min(remaining, maxItems_later_full);
        pages.push({
          pageNumber: pageNum,
          itemStartIndex: currentIndex,
          itemEndIndex: currentIndex + take,
          isFirstPage: false,
          hasBottomBlocks: false,
        });
        currentIndex += take;
      }
    }

    // Si la última página no tiene espacio para los totales, agregar una página de cierre
    const last = pages[pages.length - 1];
    if (!last.hasBottomBlocks) {
      pages.push({
        pageNumber: pages.length + 1,
        itemStartIndex: items.length,
        itemEndIndex: items.length,
        isFirstPage: false,
        hasBottomBlocks: true,
      });
    }
  }

  const totalPages = pages.length;

  // 3. Inicializar jsPDF (formato A4 estándar)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
    compress: true,
  });

  // Factor de escala Retina moderado (1.5x) para máxima nitidez y peso liviano
  const scale = 1.5;

  // 4. Renderizar cada página
  for (let pIdx = 0; pIdx < pages.length; pIdx++) {
    const pagePlan = pages[pIdx];

    const canvas = document.createElement('canvas');
    canvas.width = PAGE_WIDTH * scale;
    canvas.height = PAGE_HEIGHT * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    ctx.scale(scale, scale);

    // Fondo blanco
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);

    // Borde perimetral redondeado
    drawRoundedRect(ctx, 4, 4, PAGE_WIDTH - 8, PAGE_HEIGHT - 8, 14, '#ffffff', '#e2e8f0', 1);

    let currentY = PAD;

    // A. HEADER DE LA PÁGINA
    if (pagePlan.isFirstPage) {
      // Izquierda: Tipo de documento
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
      const docBadgeTitle = mode === 'detail' ? 'DETALLE DE PEDIDO' : 'RESUMEN DE PEDIDO';
      ctx.fillText(docBadgeTitle, PAD, currentY + 12);

      // Centro: Logo 'M' estilizado
      drawBrandLogo(ctx, PAGE_WIDTH / 2, currentY + 16, 42);

      // Derecha: Badge PEDIDO #XXXX y fecha/hora
      const pillW = 144;
      const pillH = 32;
      const pillX = PAGE_WIDTH - PAD - pillW;
      const pillY = currentY + 2;

      drawRoundedRect(ctx, pillX, pillY, pillW, pillH, 8, '#eff6ff', '#bfdbfe', 1.5);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#0058bb';
      ctx.font = '900 13px system-ui, -apple-system, sans-serif';
      ctx.fillText(`PEDIDO #${data.orderNumber}`, pillX + pillW / 2, pillY + pillH / 2);

      // Fecha y hora
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px system-ui, -apple-system, sans-serif';
      ctx.fillText(formatReceiptDateTime(data.createdAt), PAGE_WIDTH - PAD, pillY + pillH + 5);

      // Línea divisoria suave
      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD, currentY + 54);
      ctx.lineTo(PAGE_WIDTH - PAD, currentY + 54);
      ctx.stroke();

      currentY += headerHeightP1;

      // Título de la sección de productos
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#0f172a';
      ctx.font = '900 13px system-ui, -apple-system, sans-serif';
      const itemsLabel = `${data.itemsCount} ${data.itemsCount === 1 ? 'producto' : 'productos'}`;
      const unitsLabel = `${data.totalUnits} ${data.totalUnits === 1 ? 'unidad' : 'unidades'}`;
      ctx.fillText(`PRODUCTOS (${itemsLabel} • ${unitsLabel})`, PAD, currentY + 8);

      currentY += titleHeight;
    } else {
      // Running header compacto para páginas 2, 3, etc.
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#0058bb';
      ctx.font = '900 12px system-ui, -apple-system, sans-serif';
      const subTitle = mode === 'detail' ? 'DETALLE' : 'RESUMEN';
      ctx.fillText(`PEDIDO #${data.orderNumber} • ${subTitle} (CONTINUACIÓN)`, PAD, currentY + 14);

      // Mini logo central
      drawBrandLogo(ctx, PAGE_WIDTH / 2, currentY + 14, 28);

      // Fecha/hora compacta a la derecha
      ctx.textAlign = 'right';
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px system-ui, -apple-system, sans-serif';
      ctx.fillText(formatReceiptDateTime(data.createdAt), PAGE_WIDTH - PAD, currentY + 14);

      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD, currentY + 30);
      ctx.lineTo(PAGE_WIDTH - PAD, currentY + 30);
      ctx.stroke();

      currentY += runningHeaderHeight;
    }

    // B. PRODUCTOS DE ESTA PÁGINA
    const pageItemsCount = pagePlan.itemEndIndex - pagePlan.itemStartIndex;
    if (pageItemsCount > 0) {
      for (let i = pagePlan.itemStartIndex; i < pagePlan.itemEndIndex; i++) {
        const item = items[i];
        const localIdx = i - pagePlan.itemStartIndex;
        const col = localIdx % numCols;
        const row = Math.floor(localIdx / numCols);

        const cardX = PAD + col * (cardWidth + colGap);
        const cardY = currentY + row * (cardHeight + gapY);

        // Tarjeta
        drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 8, '#f8fafc', '#e2e8f0', 1);

        // Miniatura foto
        const imgSize = 38;
        const imgX = cardX + 6;
        const imgY = cardY + 6;
        const loadedImg = loadedImages[i] || null;
        drawRoundedImage(ctx, loadedImg, imgX, imgY, imgSize, 6);

        // Textos
        const textStartX = cardX + 50;
        const itemTotal = item.totalPrice ?? item.unitPrice * item.quantity;
        const formattedTotal = `$${Math.round(itemTotal).toLocaleString('es-AR')}`;

        ctx.font = '900 13px system-ui, -apple-system, sans-serif';
        const priceWidth = ctx.measureText(formattedTotal).width;
        const maxTextWidth = cardWidth - 56 - priceWidth - 8;

        // Renglón 1: Título
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
        ctx.fillText(truncateText(ctx, item.title, maxTextWidth), textStartX, cardY + 6);

        // Renglón 2: Cantidad y Variante en pastilla
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
        ctx.fillText(truncateText(ctx, badgeText, badgeW - 6), textStartX + 5, badgeY + badgeH / 2);

        // Renglón 3: Detalle de precio unitario
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = '#64748b';
        ctx.font = '9px system-ui, -apple-system, sans-serif';
        const unitPriceFormatted = Math.round(item.unitPrice).toLocaleString('es-AR');
        const priceType = item.isWholesale ? 'precio mayorista' : 'precio minorista';
        const detailText = `a $${unitPriceFormatted} · ${priceType}`;
        ctx.fillText(truncateText(ctx, detailText, maxTextWidth), textStartX, cardY + cardHeight - 4);

        // Precio total a la derecha
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#0f172a';
        ctx.font = '900 13.5px monospace, system-ui';
        ctx.fillText(formattedTotal, cardX + cardWidth - 8, cardY + cardHeight / 2);
      }

      const totalRowsThisPage = Math.ceil(pageItemsCount / numCols);
      currentY += totalRowsThisPage * rowHeight + 10;
    }

    // C. BLOQUES DE CIERRE (Totales, Modalidad, Pago)
    if (pagePlan.hasBottomBlocks) {
      currentY = drawBottomBlocks(ctx, currentY, data, contentWidth, PAD, PAGE_WIDTH);
    }

    // D. PIE DE PÁGINA (Paginación oficial y nota de WhatsApp)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px system-ui, -apple-system, sans-serif';
    ctx.fillText(
      `Página ${pIdx + 1} de ${totalPages} • Presentá este comprobante al coordinar tu pedido por WhatsApp`,
      PAGE_WIDTH / 2,
      PAGE_HEIGHT - PAD + 8
    );

    // E. AGREGAR AL DOCUMENTO PDF
    const imgData = canvas.toDataURL('image/jpeg', 0.85);
    if (pIdx > 0) {
      doc.addPage('a4', 'portrait');
    }
    // A4 dimensions in pt: 595.28 x 841.89
    doc.addImage(imgData, 'JPEG', 0, 0, 595.28, 841.89, undefined, 'FAST');
  }

  // 5. Devolver Blob PDF
  try {
    return doc.output('blob');
  } catch {
    const buffer = doc.output('arraybuffer');
    return new Blob([buffer], { type: 'application/pdf' });
  }
};

/**
 * Alias retrocompatible para cualquier llamada preexistente.
 */
export const generateReceiptBlob = async (data: ReceiptData): Promise<Blob> => {
  return generateReceiptPdfBlob(data, { mode: 'summary' });
};
