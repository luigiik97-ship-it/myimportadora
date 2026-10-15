import { jsPDF } from 'jspdf';

/**
 * Generador nativo de comprobante / resumen de pedido en formato PDF.
 * 
 * - Texto 100% vectorial, nítido y de máxima definición (sin borrosidad ni artefactos de compresión).
 * - Formas vectoriales nativas (tarjetas, bordes, pastillas, divisores) escalables a cualquier resolución.
 * - Miniaturas de productos optimizadas a calidad moderada (~1.5-2 KB por foto) para mantener el archivo ultra liviano.
 * - Diseño oficial idéntico:
 *   • Header con logo 'M' estilizado, badge PEDIDO #XXXX y fecha/hora.
 *   • Listado de productos en tarjetas compactas con fotos/miniaturas de variantes.
 *   • Bloque de Totales (Subtotal, Envío y TOTAL A PAGAR en verde).
 *   • Bloque de Modalidad (Retiro en local / Envío a domicilio con dirección).
 *   • Bloque de Forma de Pago (Efectivo / Transferencia con Alias y CVU).
 *   • Numeración "Página X de Y" y pie instructivo para WhatsApp.
 * - 100% cliente: compatible con descarga directa y compartición en Web Share / WhatsApp.
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
  correoBranch?: string;
  shippingCost?: number;
  cashDiscount?: number;
  customerName?: string;
  customerWhatsapp?: string;
  customerEmail?: string;
  source?: string;
  createdAt?: string;
  deliveryAddress?: {
    street?: string;
    number?: string;
    floor?: string;
    city?: string;
    province?: string;
    postalCode?: string;
    receiverName?: string;
    correoBranch?: string;
  };
  items: Array<{
    title: string;
    quantity: number;
    unitPrice: number;
    cashUnitPrice?: number;
    totalPrice?: number;
    totalCashPrice?: number;
    variantText?: string;
    image?: string;
    isWholesale?: boolean;
  }>;
}

function truncateText(doc: jsPDF, text: string, maxWidth: number): string {
  if (!text) return '';
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let len = text.length;
  while (len > 0 && doc.getTextWidth(text.slice(0, len) + '…') > maxWidth) {
    len--;
  }
  return text.slice(0, Math.max(1, len)) + '…';
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
 * Carga segura de imágenes con crossOrigin y timeout rápido (850ms) para evitar demoras en pedidos grandes.
 */
function loadImageSafely(url?: string): Promise<HTMLImageElement | null> {
  if (typeof window === 'undefined' || !url || typeof url !== 'string' || !url.trim()) {
    return Promise.resolve(null);
  }
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
 * Genera el logo oficial 'M' estilizado como DataURL PNG de alta definición pero liviano (~1 KB).
 */
function createBrandLogoDataUrl(size: number = 140): string | null {
  if (typeof document === 'undefined') return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.clearRect(0, 0, size, size);
    ctx.save();
    const scale = size / 1000;
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

    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

/**
 * Convierte una imagen de producto cargada en una miniatura optimizada de tamaño moderado (~1.5-2.5 KB).
 */
function createThumbnailDataUrl(
  img: HTMLImageElement | null,
  targetSize: number = 80
): string | null {
  if (typeof document === 'undefined') return null;
  if (!img || img.width <= 0 || img.height <= 0) return null;

  try {
    const canvas = document.createElement('canvas');
    canvas.width = targetSize;
    canvas.height = targetSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Fondo blanco
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetSize, targetSize);

    // Ajuste proporcional centrado (cover)
    const imgAspect = img.width / img.height;
    let sx = 0, sy = 0, sw = img.width, sh = img.height;
    if (imgAspect > 1) {
      sw = img.height;
      sx = (img.width - sw) / 2;
    } else {
      sh = img.width;
      sy = (img.height - sh) / 2;
    }

    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetSize, targetSize);
    return canvas.toDataURL('image/jpeg', 0.82);
  } catch {
    return null;
  }
}

interface PagePlan {
  pageNumber: number;
  itemStartIndex: number;
  itemEndIndex: number;
  isFirstPage: boolean;
  hasBottomBlocks: boolean;
}

/**
 * Generador principal de comprobantes en PDF multipágina con texto y formas 100% vectoriales.
 */
export const generateReceiptPdfBlob = async (
  data: ReceiptData,
  options: { mode?: 'detail' | 'summary' } = {}
): Promise<Blob> => {
  const mode = options.mode || 'summary';
  const items = Array.isArray(data.items) ? data.items : [];

  // 1. Carga concurrente de imágenes de productos y logo
  const [loadedImages, brandLogoDataUrl] = await Promise.all([
    Promise.all(items.map((it) => loadImageSafely(it.image))),
    Promise.resolve(createBrandLogoDataUrl(140)),
  ]);

  // Convertir imágenes cargadas en miniaturas optimizadas para el PDF
  const thumbnailDataUrls = loadedImages.map((img) => createThumbnailDataUrl(img, 80));

  // 2. Geometría estándar A4 en puntos (595.28 x 841.89 pt)
  const PAGE_WIDTH = 595.28;
  const PAGE_HEIGHT = 841.89;
  const PAD = 20;
  const contentWidth = PAGE_WIDTH - PAD * 2; // 555.28 pt

  // Columnas: 1 columna si hay muy pocos ítems (<= 6), sino 2 columnas compactas
  const numCols = items.length <= 6 ? 1 : 2;
  const colGap = 10;
  const cardWidth = Math.floor((contentWidth - (numCols - 1) * colGap) / numCols);
  const cardHeight = 38;
  const gapY = 5;
  const rowHeight = cardHeight + gapY; // 43 pt

  // Alturas de secciones fijas
  const headerHeightP1 = 58;
  const titleHeight = 22;
  const runningHeaderHeight = 34;
  const bottomBlocksHeight = 195;
  const pageFooterHeight = 24;

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

  // 4. Renderizar cada página en gráficos y tipografía vectorial nativa
  for (let pIdx = 0; pIdx < pages.length; pIdx++) {
    const pagePlan = pages[pIdx];
    if (pIdx > 0) {
      doc.addPage('a4', 'portrait');
    }

    // Borde perimetral suave
    doc.setDrawColor('#e2e8f0');
    doc.setLineWidth(0.8);
    doc.roundedRect(6, 6, PAGE_WIDTH - 12, PAGE_HEIGHT - 12, 8, 8, 'D');

    let currentY = PAD;

    // A. HEADER DE LA PÁGINA
    if (pagePlan.isFirstPage) {
      // Izquierda: Tipo de documento
      doc.setTextColor('#64748b');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      const docBadgeTitle = mode === 'detail' ? 'DETALLE DE PEDIDO' : 'RESUMEN DE PEDIDO';
      doc.text(docBadgeTitle, PAD, currentY + 11);

      // Datos del cliente según el flujo utilizado (sin inventar datos)
      const hasRealCustomerName = data.customerName && !data.customerName.startsWith('Cliente #');
      const hasRealWhatsapp = data.customerWhatsapp && data.customerWhatsapp !== 'WhatsApp';

      if (hasRealCustomerName) {
        doc.setTextColor('#0f172a');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.text(truncateText(doc, `Cliente: ${data.customerName}`, 160), PAD, currentY + 22);

        if (hasRealWhatsapp) {
          doc.setTextColor('#64748b');
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          doc.text(`WhatsApp: ${data.customerWhatsapp}`, PAD, currentY + 32);
        } else if (data.customerEmail && !data.customerEmail.includes('@comprarapida')) {
          doc.setTextColor('#64748b');
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          doc.text(truncateText(doc, `${data.customerEmail}`, 160), PAD, currentY + 32);
        }
      } else if (data.source === 'quick_buy') {
        doc.setTextColor('#0058bb');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.text('Compra rápida WhatsApp', PAD, currentY + 22);
      }

      // Centro: Logo 'M' estilizado
      const logoSize = 28;
      const logoX = PAGE_WIDTH / 2 - logoSize / 2;
      const logoY = currentY + 2;
      if (brandLogoDataUrl) {
        try {
          doc.addImage(brandLogoDataUrl, 'PNG', logoX, logoY, logoSize, logoSize);
        } catch {
          doc.setTextColor('#000000');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(16);
          doc.text('MY', PAGE_WIDTH / 2, currentY + 18, { align: 'center' });
        }
      } else {
        doc.setTextColor('#000000');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text('MY', PAGE_WIDTH / 2, currentY + 18, { align: 'center' });
      }

      // Derecha: Badge PEDIDO #XXXX y fecha/hora
      const pillW = 116;
      const pillH = 26;
      const pillX = PAGE_WIDTH - PAD - pillW;
      const pillY = currentY + 2;

      doc.setFillColor('#eff6ff');
      doc.setDrawColor('#bfdbfe');
      doc.setLineWidth(1.2);
      doc.roundedRect(pillX, pillY, pillW, pillH, 6, 6, 'FD');

      doc.setTextColor('#0058bb');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text(`PEDIDO #${data.orderNumber}`, pillX + pillW / 2, pillY + pillH / 2 + 3, { align: 'center' });

      // Fecha y hora
      doc.setTextColor('#94a3b8');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(formatReceiptDateTime(data.createdAt), PAGE_WIDTH - PAD, pillY + pillH + 9, { align: 'right' });

      // Línea divisoria suave
      doc.setDrawColor('#f1f5f9');
      doc.setLineWidth(0.8);
      doc.line(PAD, currentY + 44, PAGE_WIDTH - PAD, currentY + 44);

      currentY += headerHeightP1;

      // Título de la sección de productos con indicación de modalidad
      doc.setTextColor('#0f172a');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      const itemsLabel = `${data.itemsCount} ${data.itemsCount === 1 ? 'producto' : 'productos'}`;
      const unitsLabel = `${data.totalUnits} ${data.totalUnits === 1 ? 'unidad' : 'unidades'}`;
      const hasWholesale = items.some((it) => it.isWholesale);
      const hasRetail = items.some((it) => !it.isWholesale);
      const modalityBadge = hasWholesale && !hasRetail ? ' • MAYORISTA' : !hasWholesale && hasRetail ? ' • MINORISTA' : hasWholesale && hasRetail ? ' • MIXTO' : '';
      doc.text(`PRODUCTOS (${itemsLabel} • ${unitsLabel}${modalityBadge})`, PAD, currentY + 6);

      currentY += titleHeight;
    } else {
      // Running header compacto para páginas 2, 3, etc.
      doc.setTextColor('#0058bb');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      const subTitle = mode === 'detail' ? 'DETALLE' : 'RESUMEN';
      doc.text(`PEDIDO #${data.orderNumber} • ${subTitle} (CONTINUACIÓN)`, PAD, currentY + 12);

      // Mini logo central
      const miniLogoSize = 20;
      const miniLogoX = PAGE_WIDTH / 2 - miniLogoSize / 2;
      const miniLogoY = currentY;
      if (brandLogoDataUrl) {
        try {
          doc.addImage(brandLogoDataUrl, 'PNG', miniLogoX, miniLogoY, miniLogoSize, miniLogoSize);
        } catch {
          doc.setTextColor('#000000');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(12);
          doc.text('MY', PAGE_WIDTH / 2, currentY + 12, { align: 'center' });
        }
      } else {
        doc.setTextColor('#000000');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('MY', PAGE_WIDTH / 2, currentY + 12, { align: 'center' });
      }

      // Fecha/hora compacta a la derecha
      doc.setTextColor('#94a3b8');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(formatReceiptDateTime(data.createdAt), PAGE_WIDTH - PAD, currentY + 12, { align: 'right' });

      doc.setDrawColor('#f1f5f9');
      doc.setLineWidth(0.8);
      doc.line(PAD, currentY + 24, PAGE_WIDTH - PAD, currentY + 24);

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
        doc.setFillColor('#f8fafc');
        doc.setDrawColor('#e2e8f0');
        doc.setLineWidth(0.8);
        doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 5, 5, 'FD');

        // Miniatura foto
        const imgSize = 28;
        const imgX = cardX + 5;
        const imgY = cardY + 5;
        const thumbUrl = thumbnailDataUrls[i];

        if (thumbUrl) {
          try {
            doc.addImage(thumbUrl, 'JPEG', imgX, imgY, imgSize, imgSize);
            doc.setDrawColor('#e2e8f0');
            doc.setLineWidth(0.6);
            doc.roundedRect(imgX, imgY, imgSize, imgSize, 3.5, 3.5, 'D');
          } catch {
            doc.setFillColor('#f1f5f9');
            doc.setDrawColor('#e2e8f0');
            doc.roundedRect(imgX, imgY, imgSize, imgSize, 3.5, 3.5, 'FD');
            doc.setTextColor('#94a3b8');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.text('MY', imgX + imgSize / 2, imgY + imgSize / 2 + 2.5, { align: 'center' });
          }
        } else {
          doc.setFillColor('#f1f5f9');
          doc.setDrawColor('#e2e8f0');
          doc.roundedRect(imgX, imgY, imgSize, imgSize, 3.5, 3.5, 'FD');
          doc.setTextColor('#94a3b8');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.5);
          doc.text('MY', imgX + imgSize / 2, imgY + imgSize / 2 + 2.5, { align: 'center' });
        }

        // Textos
        const isCash = data.paymentMethod === 'cash';
        const appliedUnitPrice = (isCash && item.cashUnitPrice !== undefined && item.cashUnitPrice !== null && item.cashUnitPrice > 0)
          ? item.cashUnitPrice
          : item.unitPrice;

        const appliedItemTotal = (isCash && item.totalCashPrice !== undefined && item.totalCashPrice !== null && item.totalCashPrice > 0)
          ? item.totalCashPrice
          : (item.totalPrice !== undefined && item.totalPrice !== null && !isCash)
          ? item.totalPrice
          : appliedUnitPrice * item.quantity;

        const textStartX = cardX + 38;
        const formattedTotal = `$${Math.round(appliedItemTotal).toLocaleString('es-AR')}`;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        const priceWidth = doc.getTextWidth(formattedTotal);
        const maxTextWidth = cardWidth - 42 - priceWidth - 6;

        // Renglón 1: Título
        doc.setTextColor('#0f172a');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text(truncateText(doc, item.title, maxTextWidth), textStartX, cardY + 9);

        // Renglón 2: Cantidad y Variante en pastilla
        const variantLabel = item.variantText ? item.variantText.trim() : 'Unidad';
        const badgeText = `${item.quantity}x ${variantLabel}`;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        const badgeTextWidth = doc.getTextWidth(badgeText);
        const badgeW = Math.min(badgeTextWidth + 8, maxTextWidth);
        const badgeH = 11;
        const badgeY = cardY + 14;

        doc.setFillColor('#e2e8f0');
        doc.roundedRect(textStartX, badgeY, badgeW, badgeH, 3, 3, 'F');

        doc.setTextColor('#0f172a');
        doc.text(truncateText(doc, badgeText, badgeW - 4), textStartX + 4, badgeY + 8);

        // Renglón 3: Detalle de precio unitario y modalidad exacta
        doc.setTextColor('#64748b');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        const unitPriceFormatted = Math.round(appliedUnitPrice).toLocaleString('es-AR');
        const paymentLabel = isCash ? 'en efectivo' : 'por transferencia';
        const modalityLabel = item.isWholesale ? 'precio mayorista' : 'precio minorista';
        const detailText = `a $${unitPriceFormatted} · ${modalityLabel} ${paymentLabel}`;
        doc.text(truncateText(doc, detailText, maxTextWidth), textStartX, cardY + cardHeight - 4);

        // Precio total a la derecha
        doc.setTextColor('#0f172a');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.text(formattedTotal, cardX + cardWidth - 6, cardY + cardHeight / 2 + 3, { align: 'right' });
      }

      const totalRowsThisPage = Math.ceil(pageItemsCount / numCols);
      currentY += totalRowsThisPage * rowHeight + 8;
    }

    // C. BLOQUES DE CIERRE (Totales, Modalidad, Pago)
    if (pagePlan.hasBottomBlocks) {
      const isCash = data.paymentMethod === 'cash';
      const isPickup = data.deliveryOption === 'pickup';
      const isBranchPickup = !isPickup && Boolean(
        data.correoBranch ||
        data.deliveryAddress?.correoBranch ||
        (data.shippingMethodName && data.shippingMethodName.toLowerCase().includes('sucursal'))
      );

      const totalsBoxHeight = 68;
      const modalityBoxHeight = 48;
      const paymentBoxHeight = isCash ? 44 : 52;
      const spacing = 7;

      // 1. BLOQUE DE TOTALES
      doc.setFillColor('#ffffff');
      doc.setDrawColor('#e2e8f0');
      doc.setLineWidth(0.8);
      doc.roundedRect(PAD, currentY, contentWidth, totalsBoxHeight, 6, 6, 'FD');

      // Calcular subtotal real de los productos mostrado en el documento
      const calculatedItemsSubtotal = items.reduce((acc, it) => {
        const uPrice = (isCash && it.cashUnitPrice !== undefined && it.cashUnitPrice !== null && it.cashUnitPrice > 0)
          ? it.cashUnitPrice
          : it.unitPrice;
        const lineTotal = (isCash && it.totalCashPrice !== undefined && it.totalCashPrice !== null && it.totalCashPrice > 0)
          ? it.totalCashPrice
          : (it.totalPrice !== undefined && it.totalPrice !== null && !isCash)
          ? it.totalPrice
          : uPrice * it.quantity;
        return acc + lineTotal;
      }, 0);

      const subtotalVal = (isCash && calculatedItemsSubtotal > 0)
        ? calculatedItemsSubtotal
        : (data.subtotal !== undefined && data.subtotal !== null ? data.subtotal : calculatedItemsSubtotal);

      doc.setTextColor('#64748b');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      const subtotalLabel = isCash ? 'Subtotal productos (efectivo):' : 'Subtotal productos:';
      doc.text(subtotalLabel, PAD + 10, currentY + 14);

      doc.setTextColor('#0f172a');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(`$${Math.round(subtotalVal).toLocaleString('es-AR')}`, PAGE_WIDTH - PAD - 10, currentY + 14, { align: 'right' });

      doc.setTextColor('#64748b');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      const shippingLabel = isPickup ? 'Envío:' : (data.shippingMethodName ? `Envío (${data.shippingMethodName}):` : 'Envío:');
      doc.text(truncateText(doc, shippingLabel, contentWidth - 120), PAD + 10, currentY + 30);

      const isFreeShipping = isPickup || !data.shippingCost || data.shippingCost === 0;
      doc.setTextColor(isFreeShipping ? '#00a650' : '#0f172a');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(
        isFreeShipping ? 'Gratis' : `$${Math.round(data.shippingCost || 0).toLocaleString('es-AR')}`,
        PAGE_WIDTH - PAD - 10,
        currentY + 30,
        { align: 'right' }
      );

      // Línea divisoria interior
      doc.setDrawColor('#f1f5f9');
      doc.setLineWidth(0.8);
      doc.line(PAD + 8, currentY + 40, PAGE_WIDTH - PAD - 8, currentY + 40);

      // TOTAL A PAGAR (Grande y Verde)
      doc.setTextColor('#0f172a');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      const totalLabel = isCash ? 'TOTAL A PAGAR (EFECTIVO):' : 'TOTAL A PAGAR:';
      doc.text(totalLabel, PAD + 10, currentY + 54);

      doc.setTextColor('#00a650');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(`$${Math.round(data.total).toLocaleString('es-AR')}`, PAGE_WIDTH - PAD - 10, currentY + 55, { align: 'right' });

      currentY += totalsBoxHeight + spacing;

      // 2. BLOQUE DE FORMA DE ENTREGA
      doc.setFillColor('#f8fbff');
      doc.setDrawColor('#bfdbfe');
      doc.setLineWidth(1);
      doc.roundedRect(PAD, currentY, contentWidth, modalityBoxHeight, 6, 6, 'FD');

      if (isPickup) {
        doc.setTextColor('#0058bb');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text('FORMA DE ENTREGA: RETIRO EN EL LOCAL (GRATIS)', PAD + 10, currentY + 11);

        doc.setTextColor('#334155');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text('Local Flores: Av. San Pedrito 28 local 4, CABA', PAD + 10, currentY + 25);

        doc.setTextColor('#64748b');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        const pickupReceiver = data.customerName && !data.customerName.startsWith('Cliente #') ? ` • Retira: ${data.customerName}` : '';
        doc.text(truncateText(doc, `Horario: Lunes a sábados de 11:00 hs a 17:00 hs${pickupReceiver}`, contentWidth - 20), PAD + 10, currentY + 37);
      } else if (isBranchPickup) {
        const branchName = data.correoBranch || data.deliveryAddress?.correoBranch || 'Sucursal Correo Argentino';
        doc.setTextColor('#0058bb');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text('FORMA DE ENTREGA: RETIRO EN SUCURSAL DE CORREO ARGENTINO', PAD + 10, currentY + 11);

        doc.setTextColor('#334155');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text(truncateText(doc, `Sucursal de retiro: ${branchName}`, contentWidth - 20), PAD + 10, currentY + 25);

        doc.setTextColor('#64748b');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        const recipient = data.deliveryAddress?.receiverName || (data.customerName && !data.customerName.startsWith('Cliente #') ? data.customerName : '');
        const recipientStr = recipient ? `Destinatario: ${recipient}` : '';
        const phoneStr = data.customerWhatsapp && data.customerWhatsapp !== 'WhatsApp' ? ` • WA: ${data.customerWhatsapp}` : '';
        const methodStr = data.shippingMethodName || 'Correo Argentino a Sucursal';
        doc.text(truncateText(doc, `${methodStr}${recipientStr ? ` • ${recipientStr}` : ''}${phoneStr}`, contentWidth - 20), PAD + 10, currentY + 37);
      } else {
        const addr = data.deliveryAddress;
        const methodName = data.shippingMethodName || 'Envío a domicilio';
        doc.setTextColor('#0058bb');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text(`FORMA DE ENTREGA: ${methodName.toUpperCase()}`, PAD + 10, currentY + 11);

        const addressParts = [
          addr?.street ? `${addr.street} ${addr.number || ''}${addr.floor ? ' ' + addr.floor : ''}` : '',
          addr?.city || '',
          addr?.province || '',
          addr?.postalCode ? `CP ${addr.postalCode}` : '',
        ].filter(Boolean).join(', ');

        const addressStr = addressParts || 'Dirección a coordinar por WhatsApp';
        doc.setTextColor('#334155');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text(truncateText(doc, addressStr, contentWidth - 20), PAD + 10, currentY + 25);

        doc.setTextColor('#64748b');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        const recipient = addr?.receiverName || (data.customerName && !data.customerName.startsWith('Cliente #') ? data.customerName : '');
        const recipientStr = recipient ? `Recibe: ${recipient}` : '';
        const phoneStr = data.customerWhatsapp && data.customerWhatsapp !== 'WhatsApp' ? ` • WA: ${data.customerWhatsapp}` : '';
        doc.text(truncateText(doc, `${recipientStr}${phoneStr}`, contentWidth - 20), PAD + 10, currentY + 37);
      }

      currentY += modalityBoxHeight + spacing;

      // 3. BLOQUE FORMA DE PAGO
      doc.setFillColor('#ffffff');
      doc.setDrawColor('#e2e8f0');
      doc.setLineWidth(0.8);
      doc.roundedRect(PAD, currentY, contentWidth, paymentBoxHeight, 6, 6, 'FD');

      doc.setTextColor('#0f172a');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text(isCash ? 'FORMA DE PAGO: EFECTIVO' : 'FORMA DE PAGO: TRANSFERENCIA BANCARIA', PAD + 10, currentY + 11);

      if (isCash) {
        doc.setTextColor('#00a650');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text('Abonás en efectivo al retirar tu pedido en el local.', PAD + 10, currentY + 26);
      } else {
        doc.setTextColor('#0058bb');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text('Alias: hola.retiro • Titular: Silvia Lembo', PAD + 10, currentY + 25);

        doc.setTextColor('#64748b');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.text('CVU: 0000003100087788243612 • Enviar comprobante al WhatsApp 1166904678', PAD + 10, currentY + 38);
      }
    }

    // D. PIE DE PÁGINA (Paginación oficial y nota de WhatsApp)
    doc.setTextColor('#94a3b8');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(
      `Página ${pIdx + 1} de ${totalPages} • Presentá este comprobante al coordinar tu pedido por WhatsApp`,
      PAGE_WIDTH / 2,
      PAGE_HEIGHT - PAD + 8,
      { align: 'center' }
    );
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

