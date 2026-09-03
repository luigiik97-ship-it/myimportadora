import emailjs from '@emailjs/browser';
import { Order } from '../types';

// Environment configurations
const env = (typeof import.meta !== 'undefined' && import.meta.env)
  ? import.meta.env
  : (typeof process !== 'undefined' && process.env ? process.env : {}) as any;

const serviceId = env.VITE_EMAILJS_SERVICE_ID || '';
const singleTemplate = env.VITE_EMAILJS_TEMPLATE_ID || '';
const templateCustomer = env.VITE_EMAILJS_TEMPLATE_ID_CUSTOMER || singleTemplate || 'template_customer';
const templateAdmin = env.VITE_EMAILJS_TEMPLATE_ID_ADMIN || singleTemplate || 'template_admin';
const publicKey = env.VITE_EMAILJS_PUBLIC_KEY || env.VITE_EMAILJS_USER_ID || '';
const adminEmail = env.VITE_ADMIN_EMAIL || 'admin@myimportadora.com';

// Local storage keys for custom edited templates (v5 to guarantee fresh defaults)
export const STORAGE_KEY_CUSTOMER_TEMPLATE = 'my_emailjs_template_customer_v5';
export const STORAGE_KEY_ADMIN_TEMPLATE = 'my_emailjs_template_admin_v5';

export const isEmailJsConfigured = (): boolean => {
  return !!(
    serviceId &&
    publicKey &&
    !serviceId.includes('service_default') &&
    !publicKey.includes('your_emailjs_public_key')
  );
};

export interface EmailSendResult {
  customerSuccess: boolean;
  adminSuccess: boolean;
  customerError?: string;
  adminError?: string;
  simulated?: boolean;
}

/**
 * Validates and sanitizes image URLs for HTML email templates.
 * Gmail and EmailJS strip huge base64 data URLs.
 * Only HTTP/HTTPS URLs under 300 characters are safely rendered.
 */
export const getSafeImageUrl = (url?: string): string | null => {
  if (!url) return null;
  const trimmed = String(url).trim();
  if (trimmed.startsWith('data:') || trimmed.length > 300) return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  return null;
};

/**
 * Escapes special HTML characters in plain text to prevent broken attributes or malformed tags.
 */
export const escapeHtml = (str?: string | number | null): string => {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

/**
 * Formats and normalizes HTML for email delivery:
 * - Strips HTML comments.
 * - Adds clean line breaks between tags to guarantee lines stay well below the 998-character SMTP limit.
 * - Avoids collapsing whitespace inside preformatted elements.
 */
export const cleanEmailHtml = (html: string): string => {
  if (!html) return '';
  return html
    .replace(/<!--[\s\S]*?-->/g, '') // remove comments
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ') // collapse repeated spaces
    .replace(/>\s*</g, '>\n<') // insert safe line breaks between tags to prevent SMTP line-wrap truncation
    .trim();
};

export const minifyHtml = cleanEmailHtml;

/**
 * Generates dynamic table rows iterating over order items.
 * Each item renders:
 * - Product image thumbnail
 * - Product name & title
 * - Selected variant (if any)
 * - Quantity
 * - Unit price
 * - Subtotal / total price
 */
export const generateProductsTableRowsHtml = (items: Order['items']): string => {
  if (!Array.isArray(items) || items.length === 0) {
    return `
      <tr>
        <td colspan="5" style="padding: 16px; text-align: center; color: #94a3b8; font-size: 13px;">
          No se registraron productos en este pedido.
        </td>
      </tr>
    `;
  }

  return items
    .map((item) => {
      const safeImg = getSafeImageUrl(item.image);
      const safeTitle = escapeHtml(item.title);
      const safeVariant = item.variantText ? escapeHtml(item.variantText) : '';
      const variantHtml = safeVariant
        ? `<div style="font-size: 12px; color: #94a3b8; margin-top: 3px; font-weight: 500;">Variante: ${safeVariant}</div>`
        : '';
      const pricingBadge = item.isWholesale
        ? `<span style="display: inline-block; background-color: #0369a1; color: #ffffff; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; margin-top: 4px;">Mayorista</span>`
        : `<span style="display: inline-block; background-color: #334155; color: #cbd5e1; font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 4px; margin-top: 4px;">Minorista</span>`;

      return `
        <tr style="border-bottom: 1px solid #1e293b;">
          <td style="padding: 12px 8px 12px 0; vertical-align: middle; width: 56px;">
            <div style="width: 52px; height: 52px; background-color: #ffffff; border-radius: 8px; border: 1px solid #334155; overflow: hidden; text-align: center; line-height: 52px;">
              ${
                safeImg
                  ? `<img src="${safeImg}" alt="${safeTitle}" width="52" height="52" style="width: 52px; height: 52px; object-fit: contain; display: block; border: 0;" />`
                  : `<span style="font-size: 18px;">📦</span>`
              }
            </div>
          </td>
          <td style="padding: 12px 8px; vertical-align: middle;">
            <div style="font-weight: 800; color: #ffffff; font-size: 14px; line-height: 1.3; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
              ${safeTitle}
            </div>
            ${variantHtml}
            <div>${pricingBadge}</div>
          </td>
          <td style="padding: 12px 8px; vertical-align: middle; text-align: center; font-size: 14px; color: #ffffff; font-weight: 800;">
            ${item.quantity}
          </td>
          <td style="padding: 12px 8px; vertical-align: middle; text-align: right; font-size: 13px; color: #cbd5e1; font-weight: 700; white-space: nowrap;">
            $${(item.unitPrice || 0).toLocaleString('es-AR')}
          </td>
          <td style="padding: 12px 0 12px 8px; vertical-align: middle; text-align: right; font-size: 14px; font-weight: 800; color: #60a5fa; white-space: nowrap;">
            $${(item.totalPrice || 0).toLocaleString('es-AR')}
          </td>
        </tr>
      `;
    })
    .join('\n');
};

/**
 * DEFAULT HTML TEMPLATE FOR CUSTOMER (template_customer)
 * Iterates through products with image, title, variant, quantity, unit price & subtotal.
 * Strict payment condition:
 * - Cash: displays ONLY "Forma de pago: Efectivo".
 * - Transfer: displays "Forma de pago: Transferencia", transfer amount and bank details.
 */
export const DEFAULT_CUSTOMER_TEMPLATE = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Comprobante de Compra #{{order_number}} - MY Importadora</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; -webkit-font-smoothing: antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0b0f19; padding: 32px 12px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.3); border: 1px solid #1e293b;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background-color: #0058bb; padding: 26px 24px; text-align: center;">
              <div style="font-size: 24px; font-weight: 900; color: #ffffff; letter-spacing: 0.5px; text-transform: uppercase; font-family: 'Montserrat', -apple-system, sans-serif;">
                MY IMPORTADORA
              </div>
              <div style="color: #bfdbfe; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px;">
                Mayorista & Minorista • Bazar y Tecnología
              </div>
            </td>
          </tr>

          <!-- Confirmation Title -->
          <tr>
            <td style="padding: 24px 24px 16px 24px;">
              <h1 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 800; color: #0f172a;">
                ¡Gracias por tu compra, {{customer_name}}! 🎉
              </h1>
              <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.5;">
                Hemos registrado tu pedido correctamente. A continuación encuentras el resumen detallado de tu compra:
              </p>

              <div style="margin-top: 16px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px;">
                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                  <tr>
                    <td>
                      <span style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700; display: block;">Número de Pedido</span>
                      <span style="font-size: 17px; font-weight: 900; color: #0058bb; font-family: monospace;">#{{order_number}}</span>
                    </td>
                    <td style="text-align: right;">
                      <span style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700; display: block;">Fecha y Hora</span>
                      <span style="font-size: 13px; font-weight: 700; color: #334155;">{{order_date}}</span>
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>

          <!-- DETALLE DE PRODUCTOS (Iteración con Imagen, Nombre, Variante, Cantidad, Precio y Subtotal) -->
          <tr>
            <td style="padding: 0 20px 16px 20px;">
              <div style="background-color: #0c1222; padding: 20px; border-radius: 14px; border: 1px solid #1e293b;">
                <h2 style="margin: 0 0 14px 0; font-size: 15px; font-weight: 900; color: #ffffff; text-transform: uppercase; letter-spacing: 0.5px;">
                  DETALLE DE PRODUCTOS
                </h2>

                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-collapse: collapse; margin-bottom: 16px;">
                  <thead>
                    <tr style="border-bottom: 1px solid #334155;">
                      <th style="padding: 0 8px 10px 0; text-align: left; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">FOTO</th>
                      <th style="padding: 0 8px 10px 8px; text-align: left; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">PRODUCTO</th>
                      <th style="padding: 0 8px 10px 8px; text-align: center; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">CANT.</th>
                      <th style="padding: 0 8px 10px 8px; text-align: right; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">PRECIO</th>
                      <th style="padding: 0 0 10px 8px; text-align: right; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">SUBTOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {{{products_html}}}
                  </tbody>
                </table>

                <!-- Totales Destacados -->
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #050b17; border: 1px solid #334155; border-radius: 12px; padding: 16px 18px;">
                  <tr>
                    <td style="padding: 4px 0; font-size: 14px; color: #94a3b8;">Subtotal Productos:</td>
                    <td style="padding: 4px 0; font-size: 15px; font-weight: 700; color: #ffffff; text-align: right;">{{subtotal}}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 0; font-size: 14px; color: #94a3b8;">Costo de Envío:</td>
                    <td style="padding: 4px 0; font-size: 15px; font-weight: 700; color: #ffffff; text-align: right;">
                      {{shipping_cost}}
                    </td>
                  </tr>
                  <tr style="border-top: 1px solid #1e293b;">
                    <td style="padding: 12px 0 4px 0; font-size: 15px; font-weight: 800; color: #ffffff;">Total Final a Pagar:</td>
                    <td style="padding: 12px 0 4px 0; font-size: 20px; font-weight: 900; color: #60a5fa; text-align: right;">{{total_amount}}</td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>

          <!-- FORMA DE PAGO CLIENTE (Dedicado y estilizado para compatibilidad total con Gmail) -->
          <tr>
            <td style="padding: 0 20px 16px 20px;">
              {{{customer_payment_info}}}
            </td>
          </tr>

          <!-- DATOS DE ENTREGA Y CLIENTE -->
          <tr>
            <td style="padding: 0 20px 20px 20px;">
              <div style="border-top: 1px dashed #e2e8f0; padding-top: 16px;">
                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                  <tr>
                    <td width="50%" style="vertical-align: top; padding-right: 10px;">
                      <span style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700; display: block;">Tus Datos:</span>
                      <strong style="font-size: 13px; color: #0f172a;">{{customer_name}}</strong><br/>
                      <span style="font-size: 12px; color: #475569;">📧 {{customer_email}}</span><br/>
                      <span style="font-size: 12px; color: #475569;">📱 {{customer_whatsapp}}</span>
                    </td>
                    <td width="50%" style="vertical-align: top; padding-left: 10px; border-left: 1px solid #f1f5f9;">
                      <span style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700; display: block;">Entrega:</span>
                      <div style="font-size: 12px; color: #334155; line-height: 1.4;">
                        {{{delivery_info}}}
                      </div>
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>

          <!-- WHATSAPP CONTACT BUTTON -->
          <tr>
            <td align="center" style="padding: 0 24px 24px 24px;">
              <a href="https://wa.me/5491166904678?text=Hola,%20tengo%20una%20consulta%20sobre%20mi%20pedido%20%23{{order_number}}"
                 target="_blank"
                 style="display: inline-block; background-color: #00a650; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 800; padding: 12px 24px; border-radius: 30px; box-shadow: 0 3px 10px rgba(0,166,80,0.25);">
                💬 Contactar por WhatsApp (+54 9 11 6690-4678)
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 18px 24px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0 0 4px 0; font-size: 12px; font-weight: 700; color: #475569;">
                MY Importadora • Ventas Mayoristas y Minoristas
              </p>
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                Av. San Pedrito 28, Local 4, Flores, CABA • Lunes a Sábados 11:00 a 17:00 hs
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

/**
 * DEFAULT HTML TEMPLATE FOR SELLER / ADMIN (template_admin)
 * Iterates through products with image, title, variant, quantity, unit price & subtotal.
 * Shows all order details, customer data, and if cash was chosen, shows equivalent transfer total.
 */
export const DEFAULT_ADMIN_TEMPLATE = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nuevo Pedido #{{order_number}} - Panel Vendedor</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; -webkit-font-smoothing: antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0b0f19; padding: 32px 12px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 620px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.35); border: 1px solid #1e293b;">
          
          <!-- Top Alert Header -->
          <tr>
            <td style="background-color: #1e293b; padding: 22px 24px; border-bottom: 3px solid #0058bb;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <span style="background-color: #00a650; color: #ffffff; font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.8px;">
                      Nuevo Pedido Recibido
                    </span>
                    <h1 style="margin: 8px 0 0 0; color: #ffffff; font-size: 22px; font-weight: 900; font-family: 'Montserrat', -apple-system, sans-serif;">
                      Pedido #{{order_number}}
                    </h1>
                    <div style="color: #94a3b8; font-size: 12px; margin-top: 4px;">
                      📅 {{order_date}}
                    </div>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <div style="background-color: #0058bb; color: #ffffff; padding: 8px 14px; border-radius: 8px; font-weight: 900; font-size: 16px;">
                      {{total_amount}}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Quick Action Buttons -->
          <tr>
            <td style="padding: 16px 24px; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td width="50%" style="padding-right: 6px;">
                    <a href="{{wa_chat_link}}" target="_blank" style="display: block; background-color: #25d366; color: #ffffff; text-align: center; text-decoration: none; font-size: 12px; font-weight: 800; padding: 10px 12px; border-radius: 8px;">
                      💬 Escribir por WhatsApp
                    </a>
                  </td>
                  <td width="50%" style="padding-left: 6px;">
                    <a href="mailto:{{customer_email}}?subject=Pedido%20%23{{order_number}}%20-%20MY%20Importadora" style="display: block; background-color: #0058bb; color: #ffffff; text-align: center; text-decoration: none; font-size: 12px; font-weight: 800; padding: 10px 12px; border-radius: 8px;">
                      ✉️ Responder por Email
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Customer and Delivery Information -->
          <tr>
            <td style="padding: 20px 24px 12px 24px;">
              <h2 style="margin: 0 0 10px 0; font-size: 13px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">
                👤 Información del Comprador
              </h2>
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px;">
                <tr>
                  <td width="50%" style="vertical-align: top; padding-right: 10px;">
                    <div style="font-size: 11px; color: #64748b; font-weight: 700;">NOMBRE:</div>
                    <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-bottom: 6px;">{{customer_name}}</div>
                    
                    <div style="font-size: 11px; color: #64748b; font-weight: 700;">WHATSAPP:</div>
                    <div style="font-size: 13px; font-weight: 700; color: #0058bb; margin-bottom: 6px;">
                      <a href="{{wa_chat_link}}" style="color: #0058bb; text-decoration: none;">{{customer_whatsapp}}</a>
                    </div>

                    <div style="font-size: 11px; color: #64748b; font-weight: 700;">EMAIL:</div>
                    <div style="font-size: 12px; color: #334155;">{{customer_email}}</div>
                  </td>
                  <td width="50%" style="vertical-align: top; padding-left: 10px; border-left: 1px solid #e2e8f0;">
                    <div style="font-size: 11px; color: #64748b; font-weight: 700;">FORMA DE ENTREGA:</div>
                    <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-bottom: 4px;">
                      {{forma_entrega}}
                    </div>
                    <div style="font-size: 12px; color: #334155; line-height: 1.4;">
                      {{{delivery_address}}}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- DETALLE DE PRODUCTOS (Iteración con Imagen, Nombre, Variante, Cantidad, Precio y Subtotal) -->
          <tr>
            <td style="padding: 0 20px 16px 20px;">
              <div style="background-color: #0c1222; padding: 20px; border-radius: 14px; border: 1px solid #1e293b;">
                <h2 style="margin: 0 0 16px 0; font-size: 15px; font-weight: 900; color: #ffffff; text-transform: uppercase; letter-spacing: 0.5px;">
                  DETALLE DE PRODUCTOS
                </h2>

                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-collapse: collapse; margin-bottom: 16px;">
                  <thead>
                    <tr style="border-bottom: 1px solid #334155;">
                      <th style="padding: 0 8px 10px 0; text-align: left; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">FOTO</th>
                      <th style="padding: 0 8px 10px 8px; text-align: left; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">PRODUCTO</th>
                      <th style="padding: 0 8px 10px 8px; text-align: center; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">CANT.</th>
                      <th style="padding: 0 8px 10px 8px; text-align: right; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">PRECIO</th>
                      <th style="padding: 0 0 10px 8px; text-align: right; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">SUBTOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {{{products_html}}}
                  </tbody>
                </table>

                <!-- Totales del Pedido -->
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #050b17; border: 1px solid #334155; border-radius: 12px; padding: 16px 18px;">
                  <tr>
                    <td style="padding: 4px 0; font-size: 14px; color: #94a3b8;">Subtotal del Pedido:</td>
                    <td style="padding: 4px 0; font-size: 15px; font-weight: 700; color: #ffffff; text-align: right;">{{subtotal}}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 0; font-size: 14px; color: #94a3b8;">Costo de Envío:</td>
                    <td style="padding: 4px 0; font-size: 15px; font-weight: 700; color: #ffffff; text-align: right;">
                      {{shipping_cost}}
                    </td>
                  </tr>
                  <tr style="border-top: 1px solid #1e293b;">
                    <td style="padding: 12px 0 4px 0; font-size: 15px; font-weight: 800; color: #ffffff;">TOTAL A COBRAR:</td>
                    <td style="padding: 12px 0 4px 0; font-size: 20px; font-weight: 900; color: #60a5fa; text-align: right;">
                      {{total_amount}}
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>

          <!-- FORMA DE PAGO VENDEDOR (Exclusivo: Doble referencia Efectivo y Equivalente Transferencia) -->
          <tr>
            <td style="padding: 0 20px 16px 20px;">
              {{{admin_payment_info}}}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f1f5f9; padding: 16px 24px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #64748b;">
                Notificación automática de nuevo pedido • <strong>MY Importadora Mayorista</strong>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

export const CUSTOMER_EMAILJS_TEMPLATE_CODE = DEFAULT_CUSTOMER_TEMPLATE;
export const ADMIN_EMAILJS_TEMPLATE_CODE = DEFAULT_ADMIN_TEMPLATE;

// -------------------------------------------------------------
// TEMPLATE STORAGE AND RETRIEVAL HELPERS
// -------------------------------------------------------------

/**
 * Cleanly normalizes and upgrades template code:
 * - Upgrades all HTML block variables from double curly braces {{...}} to triple curly braces {{{...}}}
 *   to ensure EmailJS treats them as unescaped raw HTML (e.g. {{payment_info}} -> {{{payment_info}}}).
 * - Removes legacy duplicate product loop blocks if {{{products_html}}} is already present.
 */
export const sanitizeAndUpgradeTemplateHtml = (html: string): string => {
  if (!html) return html;
  let cleaned = html;

  // 1. Remove duplicate product loop if products_html tag is also present
  if (
    cleaned.includes('{{#order_items}}') &&
    (cleaned.includes('{{{products_html}}}') || cleaned.includes('{{products_html}}'))
  ) {
    cleaned = cleaned.replace(/\{\{#order_items\}\}[\s\S]*?\{\{\/order_items\}\}\s*/g, '');
  }

  // 2. Automatically upgrade HTML-bearing variables to triple curly braces for unescaped HTML in EmailJS
  const htmlVariables = [
    'customer_payment_info',
    'admin_payment_info',
    'payment_info',
    'payment_details',
    'products_html',
    'detalle_productos_html',
    'delivery_info',
    'delivery_address',
    'message_html',
    'html_content',
    'order_html',
    'content',
  ];

  for (const v of htmlVariables) {
    // Regex matches {{var}} only when not preceded or followed by an extra brace
    const doubleBraceRegex = new RegExp(`(?<!\\{)\\{\\{${v}\\}\\}(?!\\})`, 'g');
    cleaned = cleaned.replace(doubleBraceRegex, `{{{${v}}}}`);
  }

  return cleaned;
};

export const getCustomerTemplate = (): string => {
  if (typeof window !== 'undefined' && window.localStorage) {
    const saved = localStorage.getItem(STORAGE_KEY_CUSTOMER_TEMPLATE);
    if (saved && saved.trim().length > 0) {
      const cleaned = sanitizeAndUpgradeTemplateHtml(saved);
      if (cleaned !== saved) {
        localStorage.setItem(STORAGE_KEY_CUSTOMER_TEMPLATE, cleaned);
      }
      return cleaned;
    }
  }
  return DEFAULT_CUSTOMER_TEMPLATE;
};

export const getAdminTemplate = (): string => {
  if (typeof window !== 'undefined' && window.localStorage) {
    const saved = localStorage.getItem(STORAGE_KEY_ADMIN_TEMPLATE);
    if (saved && saved.trim().length > 0) {
      const cleaned = sanitizeAndUpgradeTemplateHtml(saved);
      if (cleaned !== saved) {
        localStorage.setItem(STORAGE_KEY_ADMIN_TEMPLATE, cleaned);
      }
      return cleaned;
    }
  }
  return DEFAULT_ADMIN_TEMPLATE;
};

export const saveCustomerTemplate = (html: string): void => {
  if (typeof window !== 'undefined' && window.localStorage) {
    const cleaned = sanitizeAndUpgradeTemplateHtml(html);
    localStorage.setItem(STORAGE_KEY_CUSTOMER_TEMPLATE, cleaned);
  }
};

export const saveAdminTemplate = (html: string): void => {
  if (typeof window !== 'undefined' && window.localStorage) {
    const cleaned = sanitizeAndUpgradeTemplateHtml(html);
    localStorage.setItem(STORAGE_KEY_ADMIN_TEMPLATE, cleaned);
  }
};

export const resetCustomerTemplate = (): string => {
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.removeItem(STORAGE_KEY_CUSTOMER_TEMPLATE);
  }
  return DEFAULT_CUSTOMER_TEMPLATE;
};

export const resetAdminTemplate = (): string => {
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.removeItem(STORAGE_KEY_ADMIN_TEMPLATE);
  }
  return DEFAULT_ADMIN_TEMPLATE;
};

export const isCustomerTemplateCustomized = (): boolean => {
  if (typeof window !== 'undefined' && window.localStorage) {
    return !!localStorage.getItem(STORAGE_KEY_CUSTOMER_TEMPLATE);
  }
  return false;
};

export const isAdminTemplateCustomized = (): boolean => {
  if (typeof window !== 'undefined' && window.localStorage) {
    return !!localStorage.getItem(STORAGE_KEY_ADMIN_TEMPLATE);
  }
  return false;
};

// -------------------------------------------------------------
// INDEPENDENT PAYMENT BLOCK HTML GENERATORS
// -------------------------------------------------------------

/**
 * Generates the clean payment block HTML exclusively for the CUSTOMER receipt.
 * - Cash: shows ONLY cash title, notice to pay upon pickup, and total cash amount.
 * - Transfer: shows ONLY transfer title, exact amount to transfer, complete bank details, and WhatsApp receipt button.
 * Contains no merchant internals or equivalent transfer totals.
 */
export const generateCustomerPaymentInfoHtml = (order: Order): string => {
  const isCash = order.paymentMethod === 'cash' || String(order.paymentMethod || '').toLowerCase().includes('efectivo');

  if (isCash) {
    return `<table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#f8fafc" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-top: 6px;">
  <tr>
    <td bgcolor="#f8fafc" style="padding: 16px; background-color: #f8fafc;">
      <div style="font-weight: 900; color: #0f172a; font-size: 14px; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">
        💳 Forma de Pago: Efectivo
      </div>
      <p style="margin: 0 0 12px 0; font-size: 13px; color: #334155; line-height: 1.5;">
        💵 <strong>Abonas al retirar tu compra</strong> en nuestro local comercial (Av. San Pedrito 28, Local 4, Flores, CABA).
      </p>
      <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#ffffff" style="background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px;">
        <tr>
          <td bgcolor="#ffffff" style="padding: 12px 14px; font-size: 14px; color: #0f172a; font-weight: 800; background-color: #ffffff;">
            Total en Efectivo a Pagar: <span style="color: #00a650; font-size: 17px; font-weight: 900;">$${(order.total || 0).toLocaleString('es-AR')}</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
  }

  return `<table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#eff6ff" style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; margin-top: 6px;">
  <tr>
    <td bgcolor="#eff6ff" style="padding: 16px; background-color: #eff6ff;">
      <div style="font-weight: 900; color: #1e40af; font-size: 14px; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">
        💳 Forma de Pago: Transferencia Bancaria
      </div>
      <p style="margin: 0 0 12px 0; font-size: 13px; color: #1e3a8a; line-height: 1.5;">
        📲 <strong>Cuando realices la transferencia, envíanos el comprobante a nuestro WhatsApp 1166904678 para procesar tu pedido.</strong>
      </p>
      <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#ffffff" style="background-color: #ffffff; border: 1px solid #dbeafe; border-radius: 8px; margin-bottom: 12px;">
        <tr>
          <td bgcolor="#ffffff" style="padding: 14px; font-size: 13px; color: #1e3a8a; line-height: 1.6; background-color: #ffffff;">
            <div style="font-weight: 900; color: #1e40af; font-size: 12px; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px;">
              🏦 Datos Bancarios para Transferir:
            </div>
            • <strong>Titular:</strong> Silvia Lembo<br/>
            • <strong>Alias:</strong> <span style="font-family: monospace; font-weight: 700; color: #0058bb; background: #e0f2fe; padding: 2px 6px; border-radius: 4px;">hola.retiro</span><br/>
            • <strong>CVU:</strong> <span style="font-family: monospace; font-weight: 600; color: #374151;">0000003100087788243612</span><br/>
            • <strong>Banco / Billetera:</strong> Mercado Pago / Banco
          </td>
        </tr>
      </table>
      <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#ffffff" style="background-color: #ffffff; border: 1px solid #bfdbfe; border-radius: 8px; margin-bottom: 14px;">
        <tr>
          <td bgcolor="#ffffff" style="padding: 12px 14px; font-size: 14px; color: #1e40af; font-weight: 800; background-color: #ffffff;">
            Importe Exacto a Transferir: <span style="color: #0058bb; font-size: 17px; font-weight: 900;">$${(order.total || 0).toLocaleString('es-AR')}</span>
          </td>
        </tr>
      </table>
      <div style="text-align: center;">
        <a href="https://wa.me/5491166904678?text=Hola,%20adjunto%20comprobante%20de%20transferencia%20del%20pedido%20%23${escapeHtml(order.orderNumber)}"
           target="_blank"
           style="display: inline-block; background-color: #25d366; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 800; padding: 10px 20px; border-radius: 24px; box-shadow: 0 2px 6px rgba(37,211,102,0.3);">
          📤 Enviar Comprobante por WhatsApp (1166904678)
        </a>
      </div>
    </td>
  </tr>
</table>`;
};

/**
 * Generates the payment block HTML exclusively for the ADMIN / SELLER notification.
 * - If Cash: displays total in cash AND the equivalent transfer total, clearly labeled.
 * - If Transfer: displays total in transfer AND the equivalent cash total, clearly labeled, plus receiving bank account info.
 */
export const generateAdminPaymentInfoHtml = (order: Order): string => {
  const isCash = order.paymentMethod === 'cash' || String(order.paymentMethod || '').toLowerCase().includes('efectivo');

  const transferEquivalentSubtotal = isCash
    ? (order.cashDiscount && order.cashDiscount > 0
        ? (order.subtotal || 0) + order.cashDiscount
        : (Array.isArray(order.items) && order.items.length > 0
            ? order.items.reduce((sum, it) => sum + ((it.unitPrice || 0) * (it.quantity || 1)), 0)
            : Math.round((order.subtotal || 0) / 0.88)))
    : (order.subtotal || 0);

  const transferEquivalentTotal = isCash
    ? transferEquivalentSubtotal + (order.shippingCost || 0)
    : (order.total || 0);

  const cashEquivalentSubtotal = !isCash
    ? (Array.isArray(order.items) && order.items.length > 0
        ? order.items.reduce((sum, item) => {
            if (typeof item.totalCashPrice === 'number' && item.totalCashPrice > 0) {
              return sum + item.totalCashPrice;
            }
            if (typeof item.cashUnitPrice === 'number' && item.cashUnitPrice > 0) {
              return sum + item.cashUnitPrice * (item.quantity || 1);
            }
            const unit = item.unitPrice || 0;
            const fallbackCashUnit = Math.round(unit * 0.88);
            return sum + (fallbackCashUnit * (item.quantity || 1));
          }, 0)
        : Math.max(0, (order.subtotal || 0) * 0.88))
    : (order.subtotal || 0);

  const cashEquivalentTotal = !isCash
    ? cashEquivalentSubtotal + (order.shippingCost || 0)
    : (order.total || 0);

  if (isCash) {
    return `<table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#f8fafc" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-top: 6px;">
  <tr>
    <td bgcolor="#f8fafc" style="padding: 16px; background-color: #f8fafc;">
      <div style="font-weight: 900; color: #0f172a; font-size: 14px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">
        💳 Forma de Pago Seleccionada: Efectivo
      </div>
      
      <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#ffffff" style="background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; margin-bottom: 10px;">
        <tr>
          <td bgcolor="#ffffff" style="padding: 12px 14px; background-color: #ffffff;">
            <div style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase;">Total del Pedido en Efectivo (a cobrar en mano):</div>
            <div style="font-size: 20px; font-weight: 900; color: #00a650;">$${(order.total || 0).toLocaleString('es-AR')}</div>
          </td>
        </tr>
      </table>

      <!-- Seller Reference: Equivalent Transfer Total -->
      <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#eff6ff" style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px;">
        <tr>
          <td bgcolor="#eff6ff" style="padding: 12px 14px; background-color: #eff6ff;">
            <div style="font-size: 11px; color: #1e40af; font-weight: 800; text-transform: uppercase; margin-bottom: 2px;">
              🔄 Importe Equivalente por Transferencia Bancaria:
            </div>
            <div style="font-size: 18px; font-weight: 900; color: #0058bb;">
              $${Math.round(transferEquivalentTotal).toLocaleString('es-AR')}
            </div>
            <div style="font-size: 11px; color: #3b82f6; margin-top: 4px; line-height: 1.3;">
              (Subtotal lista: $${Math.round(transferEquivalentSubtotal).toLocaleString('es-AR')} + Envío: $${(order.shippingCost || 0).toLocaleString('es-AR')})
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
  }

  return `<table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#eff6ff" style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; margin-top: 6px;">
  <tr>
    <td bgcolor="#eff6ff" style="padding: 16px; background-color: #eff6ff;">
      <div style="font-weight: 900; color: #1e40af; font-size: 14px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">
        💳 Forma de Pago Seleccionada: Transferencia Bancaria
      </div>

      <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#ffffff" style="background-color: #ffffff; border: 1px solid #bfdbfe; border-radius: 8px; margin-bottom: 10px;">
        <tr>
          <td bgcolor="#ffffff" style="padding: 12px 14px; background-color: #ffffff;">
            <div style="font-size: 11px; color: #1e40af; font-weight: 700; text-transform: uppercase;">Total a verificar por Transferencia:</div>
            <div style="font-size: 20px; font-weight: 900; color: #0058bb;">$${(order.total || 0).toLocaleString('es-AR')}</div>
          </td>
        </tr>
      </table>

      <!-- Seller Reference: Equivalent Cash Total -->
      <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#f8fafc" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 10px;">
        <tr>
          <td bgcolor="#f8fafc" style="padding: 12px 14px; background-color: #f8fafc;">
            <div style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase;">Importe Equivalente en Efectivo (si abona en mano):</div>
            <div style="font-size: 18px; font-weight: 900; color: #00a650;">
              $${Math.round(cashEquivalentTotal).toLocaleString('es-AR')}
            </div>
            <div style="font-size: 11px; color: #64748b; margin-top: 4px; line-height: 1.3;">
              (Subtotal efectivo: $${Math.round(cashEquivalentSubtotal).toLocaleString('es-AR')} + Envío: $${(order.shippingCost || 0).toLocaleString('es-AR')})
            </div>
          </td>
        </tr>
      </table>

      <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#ffffff" style="background-color: #ffffff; border: 1px solid #dbeafe; border-radius: 8px;">
        <tr>
          <td bgcolor="#ffffff" style="padding: 12px 14px; font-size: 13px; color: #1e3a8a; line-height: 1.6; background-color: #ffffff;">
            <div style="font-weight: 900; color: #1e40af; font-size: 12px; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">
              🏦 Cuenta Receptora a Verificar:
            </div>
            • <strong>Titular:</strong> Silvia Lembo<br/>
            • <strong>Alias:</strong> <span style="font-family: monospace; font-weight: 700; color: #0058bb; background: #e0f2fe; padding: 2px 6px; border-radius: 4px;">hola.retiro</span><br/>
            • <strong>CVU:</strong> <span style="font-family: monospace; font-weight: 600; color: #374151;">0000003100087788243612</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
};

// -------------------------------------------------------------
// DYNAMIC TEMPLATE PARAMETER BUILDERS
// -------------------------------------------------------------

/**
 * Builds the template parameters dictionary EXCLUSIVELY for the CUSTOMER.
 * Contains no merchant internals or transfer equivalent metrics.
 */
export const buildCustomerTemplateParams = (order: Order): Record<string, any> => {
  const currentOrder: Order = JSON.parse(JSON.stringify(order));
  const orderItems = Array.isArray(currentOrder.items) ? currentOrder.items : [];

  const formattedDate = new Date(currentOrder.createdAt || Date.now()).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const isCash = currentOrder.paymentMethod === 'cash' || String(currentOrder.paymentMethod || '').toLowerCase().includes('efectivo');
  const isPickup = currentOrder.deliveryOption === 'pickup';

  const deliveryOptionText = isPickup
    ? 'Retiro en Local Comercial'
    : `Envío a Domicilio (${currentOrder.shippingMethodName || 'Envío'})`;

  const deliveryText = isPickup
    ? '<strong>Retiro en Local Comercial:</strong><br/>Av. San Pedrito 28, Local 4, Flores, CABA<br/><span style="color: #64748b; font-size: 11px;">(Lunes a sábados 11:00 a 17:00 hs)</span>'
    : `<strong>Envío a domicilio:</strong><br/>${escapeHtml(currentOrder.deliveryAddress?.street || '')} ${escapeHtml(currentOrder.deliveryAddress?.number || '')}${currentOrder.deliveryAddress?.floor ? ` (Piso/Dpto: ${escapeHtml(currentOrder.deliveryAddress.floor)})` : ''}<br/>${escapeHtml(currentOrder.deliveryAddress?.city || '')}, ${escapeHtml(currentOrder.deliveryAddress?.province || '')} (CP ${escapeHtml(currentOrder.deliveryAddress?.postalCode || '')})<br/><span style="color: #64748b; font-size: 11px;">Recibe: ${escapeHtml(currentOrder.deliveryAddress?.receiverName || currentOrder.customerName)}</span>`;

  const deliveryAddressText = isPickup
    ? 'Av. San Pedrito 28, Local 4, Flores, CABA.<br/><span style="color: #64748b; font-size: 11px;">(Horario: Lun a Sáb 11:00 a 17:00 hs)</span>'
    : `${escapeHtml(currentOrder.deliveryAddress?.street || '')} ${escapeHtml(currentOrder.deliveryAddress?.number || '')}${currentOrder.deliveryAddress?.floor ? ` (Piso/Dpto: ${escapeHtml(currentOrder.deliveryAddress.floor)})` : ''}<br/>${escapeHtml(currentOrder.deliveryAddress?.city || '')}, ${escapeHtml(currentOrder.deliveryAddress?.province || '')} (CP ${escapeHtml(currentOrder.deliveryAddress?.postalCode || '')})`;

  const paymentMethodText = isCash ? 'Efectivo' : 'Transferencia';
  const customerPaymentInfoHtml = generateCustomerPaymentInfoHtml(currentOrder);

  const rawPhone = currentOrder.customerWhatsapp || '';
  const cleanPhone = rawPhone.replace(/\D/g, '');
  const waChatLink = `https://wa.me/${cleanPhone.startsWith('54') ? cleanPhone : `549${cleanPhone}`}?text=Hola%20${encodeURIComponent(currentOrder.customerName || '')},%20nos%20comunicamos%20de%20MY%20Importadora%20por%20tu%20pedido%20%23${currentOrder.orderNumber}`;

  const productRowsHtml = generateProductsTableRowsHtml(orderItems);
  const totalItemsCount = orderItems.reduce((acc, it) => acc + (it.quantity || 0), 0);

  const structuredOrderItems = orderItems.map((item) => {
    const safeImg = getSafeImageUrl(item.image) || 'https://via.placeholder.com/60?text=Item';
    const safeTitle = escapeHtml(item.title);
    const variantStr = item.variantText ? `Variante: ${escapeHtml(item.variantText)}` : '';
    const unitPriceStr = `$${(item.unitPrice || 0).toLocaleString('es-AR')}`;
    const subtotalItemStr = `$${(item.totalPrice || 0).toLocaleString('es-AR')}`;

    return {
      image: safeImg,
      name: safeTitle,
      title: safeTitle,
      variant: variantStr,
      variant_text: variantStr,
      quantity: item.quantity,
      unit_price: unitPriceStr,
      price: unitPriceStr,
      subtotal: subtotalItemStr,
      total_price: subtotalItemStr,
      is_wholesale: item.isWholesale ? 'Mayorista' : 'Minorista',
    };
  });

  return {
    order_number: currentOrder.orderNumber,
    order_id: currentOrder.id,
    order_date: formattedDate,
    customer_name: currentOrder.customerName,
    customer_first_name: currentOrder.customerName.split(' ')[0] || currentOrder.customerName,
    customer_last_name: currentOrder.customerName.split(' ').slice(1).join(' ') || '',
    customer_email: currentOrder.customerEmail,
    customer_whatsapp: currentOrder.customerWhatsapp,
    customer_phone: currentOrder.customerWhatsapp,
    total_items_count: totalItemsCount,

    subtotal: `$${(currentOrder.subtotal || 0).toLocaleString('es-AR')}`,
    shipping_cost: (currentOrder.shippingCost || 0) > 0 ? `$${(currentOrder.shippingCost || 0).toLocaleString('es-AR')}` : 'Gratis (Retiro)',
    total_amount: `$${(currentOrder.total || 0).toLocaleString('es-AR')}`,
    total: `$${(currentOrder.total || 0).toLocaleString('es-AR')}`,

    shipping_method: currentOrder.shippingMethodName || deliveryOptionText,
    forma_entrega: deliveryOptionText,
    delivery_info: deliveryText,
    delivery_address: deliveryAddressText,
    payment_method: paymentMethodText,
    forma_pago: paymentMethodText,
    metodo_pago: paymentMethodText,
    customer_payment_info: customerPaymentInfoHtml,
    admin_payment_info: '',
    payment_info: customerPaymentInfoHtml,
    payment_details: customerPaymentInfoHtml,
    transfer_equivalent_total: '',
    cash_equivalent_total: '',
    internal_notes: '',
    payment_instructions: isCash
      ? 'Abonas al retirar tu compra en nuestro local comercial.'
      : 'Cuando realices la transferencia, envíanos el comprobante a nuestro WhatsApp 1166904678.',
    datos_bancarios: isCash
      ? ''
      : 'Titular: Silvia Lembo | Alias: hola.retiro | CVU: 0000003100087788243612',
    bank_details: isCash
      ? ''
      : 'Titular: Silvia Lembo | Alias: hola.retiro | CVU: 0000003100087788243612',

    wa_chat_link: waChatLink,
    company_name: 'MY Importadora Mayorista',
    company_whatsapp: '+54 9 11 6690-4678',
    company_address: 'Av. San Pedrito 28, Local 4, Flores, CABA',

    order_items: structuredOrderItems,
    products_html: productRowsHtml,
    detalle_productos_html: productRowsHtml,
  };
};

/**
 * Builds the template parameters dictionary EXCLUSIVELY for the ADMIN / SELLER.
 * Includes merchant details, dual reference calculations, and quick-action contacts.
 */
export const buildAdminTemplateParams = (order: Order): Record<string, any> => {
  const currentOrder: Order = JSON.parse(JSON.stringify(order));
  const orderItems = Array.isArray(currentOrder.items) ? currentOrder.items : [];

  const formattedDate = new Date(currentOrder.createdAt || Date.now()).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const isCash = currentOrder.paymentMethod === 'cash' || String(currentOrder.paymentMethod || '').toLowerCase().includes('efectivo');
  const isPickup = currentOrder.deliveryOption === 'pickup';

  const deliveryOptionText = isPickup
    ? 'Retiro en Local Comercial'
    : `Envío a Domicilio (${currentOrder.shippingMethodName || 'Envío'})`;

  const deliveryText = isPickup
    ? '<strong>Retiro en Local Comercial:</strong><br/>Av. San Pedrito 28, Local 4, Flores, CABA<br/><span style="color: #64748b; font-size: 11px;">(Lunes a sábados 11:00 a 17:00 hs)</span>'
    : `<strong>Envío a domicilio:</strong><br/>${escapeHtml(currentOrder.deliveryAddress?.street || '')} ${escapeHtml(currentOrder.deliveryAddress?.number || '')}${currentOrder.deliveryAddress?.floor ? ` (Piso/Dpto: ${escapeHtml(currentOrder.deliveryAddress.floor)})` : ''}<br/>${escapeHtml(currentOrder.deliveryAddress?.city || '')}, ${escapeHtml(currentOrder.deliveryAddress?.province || '')} (CP ${escapeHtml(currentOrder.deliveryAddress?.postalCode || '')})<br/><span style="color: #64748b; font-size: 11px;">Recibe: ${escapeHtml(currentOrder.deliveryAddress?.receiverName || currentOrder.customerName)}</span>`;

  const deliveryAddressText = isPickup
    ? 'Av. San Pedrito 28, Local 4, Flores, CABA.<br/><span style="color: #64748b; font-size: 11px;">(Horario: Lun a Sáb 11:00 a 17:00 hs)</span>'
    : `${escapeHtml(currentOrder.deliveryAddress?.street || '')} ${escapeHtml(currentOrder.deliveryAddress?.number || '')}${currentOrder.deliveryAddress?.floor ? ` (Piso/Dpto: ${escapeHtml(currentOrder.deliveryAddress.floor)})` : ''}<br/>${escapeHtml(currentOrder.deliveryAddress?.city || '')}, ${escapeHtml(currentOrder.deliveryAddress?.province || '')} (CP ${escapeHtml(currentOrder.deliveryAddress?.postalCode || '')})`;

  const paymentMethodText = isCash ? 'Efectivo' : 'Transferencia';

  const transferEquivalentSubtotal = isCash
    ? (currentOrder.cashDiscount && currentOrder.cashDiscount > 0
        ? (currentOrder.subtotal || 0) + currentOrder.cashDiscount
        : (Array.isArray(orderItems) && orderItems.length > 0
            ? orderItems.reduce((sum, it) => sum + ((it.unitPrice || 0) * (it.quantity || 1)), 0)
            : Math.round((currentOrder.subtotal || 0) / 0.88)))
    : (currentOrder.subtotal || 0);

  const transferEquivalentTotal = isCash
    ? transferEquivalentSubtotal + (currentOrder.shippingCost || 0)
    : (currentOrder.total || 0);

  const cashEquivalentSubtotal = !isCash
    ? (Array.isArray(orderItems) && orderItems.length > 0
        ? orderItems.reduce((sum, item) => {
            if (typeof item.totalCashPrice === 'number' && item.totalCashPrice > 0) {
              return sum + item.totalCashPrice;
            }
            if (typeof item.cashUnitPrice === 'number' && item.cashUnitPrice > 0) {
              return sum + item.cashUnitPrice * (item.quantity || 1);
            }
            const unit = item.unitPrice || 0;
            const fallbackCashUnit = Math.round(unit * 0.88);
            return sum + (fallbackCashUnit * (item.quantity || 1));
          }, 0)
        : Math.max(0, (currentOrder.subtotal || 0) * 0.88))
    : (currentOrder.subtotal || 0);

  const cashEquivalentTotal = !isCash
    ? cashEquivalentSubtotal + (currentOrder.shippingCost || 0)
    : (currentOrder.total || 0);

  const adminPaymentInfoHtml = generateAdminPaymentInfoHtml(currentOrder);
  const customerPaymentInfoHtml = generateCustomerPaymentInfoHtml(currentOrder);

  const rawPhone = currentOrder.customerWhatsapp || '';
  const cleanPhone = rawPhone.replace(/\D/g, '');
  const waChatLink = `https://wa.me/${cleanPhone.startsWith('54') ? cleanPhone : `549${cleanPhone}`}?text=Hola%20${encodeURIComponent(currentOrder.customerName || '')},%20nos%20comunicamos%20de%20MY%20Importadora%20por%20tu%20pedido%20%23${currentOrder.orderNumber}`;

  const productRowsHtml = generateProductsTableRowsHtml(orderItems);
  const totalItemsCount = orderItems.reduce((acc, it) => acc + (it.quantity || 0), 0);

  const structuredOrderItems = orderItems.map((item) => {
    const safeImg = getSafeImageUrl(item.image) || 'https://via.placeholder.com/60?text=Item';
    const safeTitle = escapeHtml(item.title);
    const variantStr = item.variantText ? `Variante: ${escapeHtml(item.variantText)}` : '';
    const unitPriceStr = `$${(item.unitPrice || 0).toLocaleString('es-AR')}`;
    const subtotalItemStr = `$${(item.totalPrice || 0).toLocaleString('es-AR')}`;

    return {
      image: safeImg,
      name: safeTitle,
      title: safeTitle,
      variant: variantStr,
      variant_text: variantStr,
      quantity: item.quantity,
      unit_price: unitPriceStr,
      price: unitPriceStr,
      subtotal: subtotalItemStr,
      total_price: subtotalItemStr,
      is_wholesale: item.isWholesale ? 'Mayorista' : 'Minorista',
    };
  });

  return {
    order_number: currentOrder.orderNumber,
    order_id: currentOrder.id,
    order_date: formattedDate,
    customer_name: currentOrder.customerName,
    customer_first_name: currentOrder.customerName.split(' ')[0] || currentOrder.customerName,
    customer_last_name: currentOrder.customerName.split(' ').slice(1).join(' ') || '',
    customer_email: currentOrder.customerEmail,
    customer_whatsapp: currentOrder.customerWhatsapp,
    customer_phone: currentOrder.customerWhatsapp,
    total_items_count: totalItemsCount,

    subtotal: `$${(currentOrder.subtotal || 0).toLocaleString('es-AR')}`,
    shipping_cost: (currentOrder.shippingCost || 0) > 0 ? `$${(currentOrder.shippingCost || 0).toLocaleString('es-AR')}` : 'Gratis (Retiro)',
    total_amount: `$${(currentOrder.total || 0).toLocaleString('es-AR')}`,
    total: `$${(currentOrder.total || 0).toLocaleString('es-AR')}`,

    shipping_method: currentOrder.shippingMethodName || deliveryOptionText,
    forma_entrega: deliveryOptionText,
    delivery_info: deliveryText,
    delivery_address: deliveryAddressText,
    payment_method: paymentMethodText,
    forma_pago: paymentMethodText,
    metodo_pago: paymentMethodText,
    admin_payment_info: adminPaymentInfoHtml,
    customer_payment_info: customerPaymentInfoHtml,
    payment_info: adminPaymentInfoHtml,
    payment_details: adminPaymentInfoHtml,

    transfer_equivalent_total: `$${Math.round(transferEquivalentTotal).toLocaleString('es-AR')}`,
    cash_equivalent_total: `$${Math.round(cashEquivalentTotal).toLocaleString('es-AR')}`,
    internal_notes: isCash
      ? `Total efectivo a cobrar: $${(currentOrder.total || 0).toLocaleString('es-AR')} | Importe equivalente por transferencia: $${Math.round(transferEquivalentTotal).toLocaleString('es-AR')} (Subtotal lista: $${Math.round(transferEquivalentSubtotal).toLocaleString('es-AR')} + Envío: $${(currentOrder.shippingCost || 0).toLocaleString('es-AR')})`
      : `Total a verificar por transferencia: $${(currentOrder.total || 0).toLocaleString('es-AR')} | Importe equivalente en efectivo: $${Math.round(cashEquivalentTotal).toLocaleString('es-AR')} (Subtotal efectivo: $${Math.round(cashEquivalentSubtotal).toLocaleString('es-AR')} + Envío: $${(currentOrder.shippingCost || 0).toLocaleString('es-AR')})`,

    wa_chat_link: waChatLink,
    company_name: 'MY Importadora Mayorista',
    company_whatsapp: '+54 9 11 6690-4678',
    company_address: 'Av. San Pedrito 28, Local 4, Flores, CABA',

    order_items: structuredOrderItems,
    products_html: productRowsHtml,
    detalle_productos_html: productRowsHtml,
  };
};

/**
 * Universal adapter for backward compatibility.
 */
export const buildOrderTemplateParams = (order: Order, isCustomer: boolean): Record<string, any> => {
  return isCustomer ? buildCustomerTemplateParams(order) : buildAdminTemplateParams(order);
};

/**
 * Helper to substitute template variables into HTML.
 */
const applyTemplateSubstitutions = (templateHtml: string, params: Record<string, any>): string => {
  let rendered = sanitizeAndUpgradeTemplateHtml(templateHtml);

  // 1. Process Handlebars loop {{#order_items}}...{{/order_items}} if present
  let hasProcessedItemsLoop = false;
  const loopRegex = /\{\{#order_items\}\}([\s\S]*?)\{\{\/order_items\}\}/g;
  if (rendered.includes('{{#order_items}}')) {
    hasProcessedItemsLoop = true;
    rendered = rendered.replace(loopRegex, (_, itemBlock) => {
      return (params.order_items || [])
        .map((it: any) => {
          let singleRow = itemBlock;
          singleRow = singleRow.replace(/\{\{\{?image\}\}\}?/g, it.image);
          singleRow = singleRow.replace(/\{\{\{?name\}\}\}?/g, it.name);
          singleRow = singleRow.replace(/\{\{\{?title\}\}\}?/g, it.title);
          singleRow = singleRow.replace(/\{\{\{?quantity\}\}\}?/g, String(it.quantity));
          singleRow = singleRow.replace(/\{\{\{?unit_price\}\}\}?/g, it.unit_price);
          singleRow = singleRow.replace(/\{\{\{?price\}\}\}?/g, it.price);
          singleRow = singleRow.replace(/\{\{\{?subtotal\}\}\}?/g, it.subtotal);
          singleRow = singleRow.replace(/\{\{\{?total_price\}\}\}?/g, it.total_price);
          singleRow = singleRow.replace(/\{\{\{?is_wholesale\}\}\}?/g, it.is_wholesale);

          if (it.variant && String(it.variant).trim()) {
            singleRow = singleRow.replace(/\{\{#variant\}\}([\s\S]*?)\{\{\/variant\}\}/g, (_2: any, varInner: string) => {
              return varInner.replace(/\{\{\{?variant\}\}\}?/g, it.variant);
            });
          } else {
            singleRow = singleRow.replace(/\{\{#variant\}\}[\s\S]*?\{\{\/variant\}\}/g, '');
          }

          return singleRow;
        })
        .join('\n');
    });
  }

  // 2. Direct replacements for products_html
  const productsReplacement = hasProcessedItemsLoop ? '' : params.products_html;
  rendered = rendered.replace(/\{\{\{products_html\}\}\}/g, productsReplacement);
  rendered = rendered.replace(/\{\{products_html\}\}/g, productsReplacement);
  rendered = rendered.replace(/\{\{\{detalle_productos_html\}\}\}/g, productsReplacement);
  rendered = rendered.replace(/\{\{detalle_productos_html\}\}/g, productsReplacement);

  // 3. Replace all remaining parameters:
  // First match triple braces {{{key}}}, then match double braces {{key}}
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && (typeof value === 'string' || typeof value === 'number')) {
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const valStr = String(value);

      const tripleRegex = new RegExp(`\\{\\{\\{${escapedKey}\\}\\}\\}`, 'g');
      rendered = rendered.replace(tripleRegex, valStr);

      const doubleRegex = new RegExp(`\\{\\{${escapedKey}\\}\\}`, 'g');
      rendered = rendered.replace(doubleRegex, valStr);
    }
  }

  return rendered;
};

/**
 * Replaces all placeholders and Handlebars-style iterations with customer order data.
 */
export const renderCustomerTemplate = (templateHtml: string, order: Order): string => {
  const params = buildCustomerTemplateParams(order);
  return applyTemplateSubstitutions(templateHtml, params);
};

/**
 * Replaces all placeholders and Handlebars-style iterations with admin order data.
 */
export const renderAdminTemplate = (templateHtml: string, order: Order): string => {
  const params = buildAdminTemplateParams(order);
  return applyTemplateSubstitutions(templateHtml, params);
};

/**
 * Universal renderOrderTemplate adapter.
 */
export const renderOrderTemplate = (templateHtml: string, order: Order, isCustomer: boolean): string => {
  return isCustomer ? renderCustomerTemplate(templateHtml, order) : renderAdminTemplate(templateHtml, order);
};

/**
 * Generates the customer HTML using the active customer template.
 */
export const generateCustomerEmailHtml = (order: Order): string => {
  const template = getCustomerTemplate();
  return cleanEmailHtml(renderCustomerTemplate(template, order));
};

/**
 * Generates the admin HTML using the active admin template.
 */
export const generateAdminEmailHtml = (order: Order): string => {
  const template = getAdminTemplate();
  return cleanEmailHtml(renderAdminTemplate(template, order));
};

/**
 * Sends order emails to customer and admin using EmailJS.
 */
export const sendOrderEmails = async (order: Order): Promise<EmailSendResult> => {
  const currentOrder: Order = JSON.parse(JSON.stringify(order));
  const isCash = currentOrder.paymentMethod === 'cash';

  const customerParams = buildCustomerTemplateParams(currentOrder);
  const adminParams = buildAdminTemplateParams(currentOrder);

  const customerEmailHtml = generateCustomerEmailHtml(currentOrder);
  const adminEmailHtml = generateAdminEmailHtml(currentOrder);

  // Prepare full parameter objects for EmailJS templates
  // Provides all individual variables AND full HTML aliases (message_html, html_content, content, order_html, message)
  const templateParamsCustomer: Record<string, any> = {
    ...customerParams,
    to_email: currentOrder.customerEmail,
    to_name: currentOrder.customerName,
    recipient_email: currentOrder.customerEmail,
    reply_to: adminEmail,
    message_html: customerEmailHtml,
    html_content: customerEmailHtml,
    order_html: customerEmailHtml,
    content: customerEmailHtml,
    message: customerEmailHtml,
  };

  const templateParamsAdmin: Record<string, any> = {
    ...adminParams,
    to_email: adminEmail,
    to_name: 'MY Importadora Admin',
    admin_email: adminEmail,
    reply_to: currentOrder.customerEmail,
    message_html: adminEmailHtml,
    html_content: adminEmailHtml,
    order_html: adminEmailHtml,
    content: adminEmailHtml,
    message: adminEmailHtml,
  };

  // Keep payload safe (<45KB) for EmailJS
  const prepareSafeParams = (params: Record<string, any>, maxSizeBytes = 45000): Record<string, any> => {
    const cloned = { ...params };
    let jsonStr = JSON.stringify(cloned);
    if (jsonStr.length <= maxSizeBytes) {
      return cloned;
    }
    // If oversized, drop redundant HTML aliases while retaining the primary HTML variable
    delete cloned.content;
    delete cloned.message;
    delete cloned.order_html;
    return cloned;
  };

  const safeCustomerParams = prepareSafeParams(templateParamsCustomer);
  const safeAdminParams = prepareSafeParams(templateParamsAdmin);

  // === AUDITORÍA Y LOGS DE DEPURACIÓN DE VARIABLES ANTES DEL ENVÍO ===
  console.group(`[EmailJS AUDIT & DEBUG] 📦 Envío de Notificaciones - Pedido #${currentOrder.orderNumber}`);
  
  console.info('%c1. Datos de Origen del Pedido (Supabase / App State):', 'font-weight: bold; color: #1e40af;', {
    id: currentOrder.id,
    orderNumber: currentOrder.orderNumber,
    createdAt: currentOrder.createdAt,
    customerName: currentOrder.customerName,
    customerEmail: currentOrder.customerEmail,
    customerWhatsapp: currentOrder.customerWhatsapp,
    paymentMethod: currentOrder.paymentMethod,
    deliveryOption: currentOrder.deliveryOption,
    shippingMethodName: currentOrder.shippingMethodName,
    deliveryAddress: currentOrder.deliveryAddress,
    subtotal: currentOrder.subtotal,
    shippingCost: currentOrder.shippingCost,
    cashDiscount: currentOrder.cashDiscount,
    wholesaleDiscount: currentOrder.wholesaleDiscount,
    total: currentOrder.total,
    itemsCount: currentOrder.items?.length || 0,
  });

  console.groupCollapsed('%c2. Desglose de Productos y Variantes:', 'font-weight: bold; color: #0284c7;');
  console.table(
    (currentOrder.items || []).map((it, idx) => ({
      '#': idx + 1,
      Producto: it.title,
      Variante: it.variantText || '(Sin variante)',
      Cantidad: it.quantity,
      'P. Unitario': `$${(it.unitPrice || 0).toLocaleString('es-AR')}`,
      'P. Unitario Efectivo': it.cashUnitPrice ? `$${it.cashUnitPrice.toLocaleString('es-AR')}` : 'N/A',
      Subtotal: `$${(it.totalPrice || 0).toLocaleString('es-AR')}`,
      'Subtotal Efectivo': it.totalCashPrice ? `$${it.totalCashPrice.toLocaleString('es-AR')}` : 'N/A',
      Tipo: it.isWholesale ? 'Mayorista' : 'Minorista',
    }))
  );
  console.groupEnd();

  console.groupCollapsed('%c3. Variables Completas para Plantilla CLIENTE (template_customer):', 'font-weight: bold; color: #16a34a;');
  console.info('Valores individuales de variables para el cliente:', {
    '{{order_number}}': safeCustomerParams.order_number,
    '{{order_id}}': safeCustomerParams.order_id,
    '{{order_date}}': safeCustomerParams.order_date,
    '{{customer_name}}': safeCustomerParams.customer_name,
    '{{customer_first_name}}': safeCustomerParams.customer_first_name,
    '{{customer_last_name}}': safeCustomerParams.customer_last_name,
    '{{customer_email}}': safeCustomerParams.customer_email,
    '{{customer_whatsapp}}': safeCustomerParams.customer_whatsapp,
    '{{customer_phone}}': safeCustomerParams.customer_phone,
    '{{subtotal}}': safeCustomerParams.subtotal,
    '{{shipping_cost}}': safeCustomerParams.shipping_cost,
    '{{total_amount}}': safeCustomerParams.total_amount,
    '{{total}}': safeCustomerParams.total,
    '{{forma_pago}}': safeCustomerParams.forma_pago,
    '{{payment_method}}': safeCustomerParams.payment_method,
    '{{forma_entrega}}': safeCustomerParams.forma_entrega,
    '{{shipping_method}}': safeCustomerParams.shipping_method,
    '{{{delivery_info}}}': safeCustomerParams.delivery_info,
    '{{{delivery_address}}}': safeCustomerParams.delivery_address,
    '{{{customer_payment_info}}}': safeCustomerParams.customer_payment_info,
    '{{wa_chat_link}}': safeCustomerParams.wa_chat_link,
    '{{total_items_count}}': safeCustomerParams.total_items_count,
  });
  console.info('Objeto de parámetros completo (Cliente):', safeCustomerParams);
  console.groupEnd();

  console.groupCollapsed('%c4. Variables Completas para Plantilla ADMINISTRADOR (template_admin):', 'font-weight: bold; color: #d97706;');
  console.info('Valores individuales de variables para el administrador:', {
    '{{order_number}}': safeAdminParams.order_number,
    '{{order_id}}': safeAdminParams.order_id,
    '{{order_date}}': safeAdminParams.order_date,
    '{{customer_name}}': safeAdminParams.customer_name,
    '{{customer_email}}': safeAdminParams.customer_email,
    '{{customer_whatsapp}}': safeAdminParams.customer_whatsapp,
    '{{subtotal}}': safeAdminParams.subtotal,
    '{{shipping_cost}}': safeAdminParams.shipping_cost,
    '{{total_amount}}': safeAdminParams.total_amount,
    '{{forma_pago}}': safeAdminParams.forma_pago,
    '{{payment_method}}': safeAdminParams.payment_method,
    '{{forma_entrega}}': safeAdminParams.forma_entrega,
    '{{shipping_method}}': safeAdminParams.shipping_method,
    '{{{delivery_info}}}': safeAdminParams.delivery_info,
    '{{{delivery_address}}}': safeAdminParams.delivery_address,
    '{{{admin_payment_info}}}': safeAdminParams.admin_payment_info,
    '{{transfer_equivalent_total}}': safeAdminParams.transfer_equivalent_total,
    '{{cash_equivalent_total}}': safeAdminParams.cash_equivalent_total,
    '{{internal_notes}}': safeAdminParams.internal_notes,
    '{{wa_chat_link}}': safeAdminParams.wa_chat_link,
    '{{total_items_count}}': safeAdminParams.total_items_count,
  });
  console.info('Objeto de parámetros completo (Administrador):', safeAdminParams);
  console.groupEnd();

  console.groupEnd();

  let customerSuccess = false;
  let adminSuccess = false;
  let customerError: string | undefined;
  let adminError: string | undefined;

  const targetCustomerTemplate = templateCustomer;
  const targetAdminTemplate = templateAdmin;

  if (isEmailJsConfigured()) {
    try {
      emailjs.init(publicKey);

      // 1. Send Email to Customer
      if (targetCustomerTemplate) {
        try {
          console.info(`[EmailJS] Enviando Recibo Cliente (${targetCustomerTemplate}) -> ${currentOrder.customerEmail}`);
          const resCustomer = await emailjs.send(
            serviceId,
            targetCustomerTemplate,
            safeCustomerParams,
            publicKey
          );
          console.info('[EmailJS] ✓ Recibo enviado al cliente:', resCustomer.status, resCustomer.text);
          customerSuccess = true;
        } catch (err: any) {
          console.error('[EmailJS] ✕ Error enviando al cliente:', err);
          customerError = err?.text || err?.message || 'Error al enviar email al cliente';
        }
      } else {
        customerError = 'Falta configurar VITE_EMAILJS_TEMPLATE_ID_CUSTOMER';
      }

      // 2. Send Email to Administrator
      if (targetAdminTemplate) {
        try {
          console.info(`[EmailJS] Enviando Aviso Administrador (${targetAdminTemplate}) -> ${adminEmail}`);
          const resAdmin = await emailjs.send(
            serviceId,
            targetAdminTemplate,
            safeAdminParams,
            publicKey
          );
          console.info('[EmailJS] ✓ Notificación enviada al administrador:', resAdmin.status, resAdmin.text);
          adminSuccess = true;
        } catch (err: any) {
          console.error('[EmailJS] ✕ Error enviando al admin:', err);
          adminError = err?.text || err?.message || 'Error al enviar email al administrador';
        }
      } else {
        adminError = 'Falta configurar VITE_EMAILJS_TEMPLATE_ID_ADMIN';
      }

      return {
        customerSuccess,
        adminSuccess,
        customerError,
        adminError,
        simulated: false,
      };
    } catch (e: any) {
      console.warn('[EmailJS] Error general inicializando EmailJS:', e);
      return {
        customerSuccess: false,
        adminSuccess: false,
        customerError: e?.message,
        adminError: e?.message,
        simulated: false,
      };
    }
  } else {
    // Development / preview simulation mode
    console.group(`[EmailJS Simulado] Generación de Correos Pedido #${currentOrder.orderNumber}`);
    console.info('%c✓ Recibo Cliente:', 'color: #0058bb; font-weight: bold;', {
      to: currentOrder.customerEmail,
      method: currentOrder.paymentMethod,
      total: customerParams.total_amount,
    });
    console.info('%c✓ Aviso Vendedor:', 'color: #00a650; font-weight: bold;', {
      to: adminEmail,
      method: currentOrder.paymentMethod,
      total: adminParams.total_amount,
      equivalent: isCash ? adminParams.transfer_equivalent_total : 'N/A',
    });
    console.groupEnd();

    return {
      customerSuccess: true,
      adminSuccess: true,
      simulated: true,
    };
  }
};
