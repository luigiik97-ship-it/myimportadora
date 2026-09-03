import React, { useState, useMemo } from 'react';
import { Order, Product } from '../../types';
import {
  isEmailJsConfigured,
  getCustomerTemplate,
  getAdminTemplate,
  saveCustomerTemplate,
  saveAdminTemplate,
  resetCustomerTemplate,
  resetAdminTemplate,
  isCustomerTemplateCustomized,
  isAdminTemplateCustomized,
  renderOrderTemplate,
  cleanEmailHtml,
  sendOrderEmails,
} from '../../services/emailjs';
import {
  Mail,
  Check,
  Copy,
  RotateCcw,
  Save,
  Eye,
  Code2,
  Send,
  AlertCircle,
  HelpCircle,
  Sparkles,
} from 'lucide-react';

interface EmailTemplateManagerProps {
  orders: Order[];
  products: Product[];
}

export const EmailTemplateManager: React.FC<EmailTemplateManagerProps> = ({ orders, products }) => {
  const [activeTemplateTab, setActiveTemplateTab] = useState<'customer' | 'admin'>('customer');
  const [viewMode, setViewMode] = useState<'preview' | 'editor'>('preview');

  // Working code state for customer and admin templates
  const [customerCode, setCustomerCode] = useState<string>(() => getCustomerTemplate());
  const [adminCode, setAdminCode] = useState<string>(() => getAdminTemplate());

  // Customization indicators
  const [hasCustomerCustom, setHasCustomerCustom] = useState<boolean>(() => isCustomerTemplateCustomized());
  const [hasAdminCustom, setHasAdminCustom] = useState<boolean>(() => isAdminTemplateCustomized());

  // Preview test settings
  const [previewPaymentMethod, setPreviewPaymentMethod] = useState<'transfer' | 'cash'>('cash');
  const [previewOrderId, setPreviewOrderId] = useState<string | null>(null);

  // Status and feedback
  const [saveSuccessFeedback, setSaveSuccessFeedback] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Active code being edited/previewed
  const currentCode = activeTemplateTab === 'customer' ? customerCode : adminCode;
  const isCustomized = activeTemplateTab === 'customer' ? hasCustomerCustom : hasAdminCustom;

  // Build a realistic mock or real order for live preview testing
  const sampleOrder: Order = useMemo(() => {
    if (previewOrderId) {
      const real = orders.find((o) => o.id === previewOrderId);
      if (real) {
        return {
          ...real,
          paymentMethod: previewPaymentMethod,
        };
      }
    }

    const firstProd = products[0];
    const secondProd = products[1];

    const item1NormalPrice = firstProd?.retailPrice || firstProd?.wholesalePrice || 16500;
    const item1CashPrice = firstProd?.cashPrice || firstProd?.wholesaleCashPrice || 14500;
    const item1Price = previewPaymentMethod === 'cash' ? item1CashPrice : item1NormalPrice;

    const item2NormalPrice = secondProd?.retailPrice || secondProd?.wholesalePrice || 9900;
    const item2CashPrice = secondProd?.cashPrice || secondProd?.wholesaleCashPrice || 8900;
    const item2Price = previewPaymentMethod === 'cash' ? item2CashPrice : item2NormalPrice;

    const subtotal = item1Price * 2 + (secondProd ? item2Price : 0);
    const shipping = 3500;
    const total = subtotal + shipping;

    return {
      id: 'preview-sample-order',
      orderNumber: 'MY-84920',
      customerName: 'Lucía Fernández',
      customerEmail: 'lucia.fernandez@ejemplo.com',
      customerWhatsapp: '+54 9 11 4455-6677',
      deliveryOption: 'delivery',
      shippingMethodName: 'Envío Flex CABA',
      deliveryAddress: {
        street: 'Av. Corrientes',
        number: '2450',
        floor: '6 A',
        city: 'CABA',
        province: 'Buenos Aires',
        postalCode: '1046',
        receiverName: 'Lucía Fernández',
      },
      paymentMethod: previewPaymentMethod,
      items: [
        {
          id: 'item-preview-1',
          productId: firstProd?.id || 'prod-1',
          title: firstProd?.title || 'Reloj Smartwatch Pro Resistente al Agua',
          image: firstProd?.images?.[0] || firstProd?.image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200&auto=format&fit=crop&q=80',
          variantText: firstProd?.variants?.[0]?.name || 'Color Negro Space',
          quantity: 2,
          unitPrice: item1Price,
          cashUnitPrice: item1CashPrice,
          totalPrice: item1Price * 2,
          totalCashPrice: item1CashPrice * 2,
          isWholesale: true,
        },
        ...(secondProd
          ? [
              {
                id: 'item-preview-2',
                productId: secondProd.id,
                title: secondProd.title,
                image: secondProd.images?.[0] || secondProd.image || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200&auto=format&fit=crop&q=80',
                variantText: secondProd.variants?.[0]?.name || 'Blanco Mate',
                quantity: 1,
                unitPrice: item2Price,
                cashUnitPrice: item2CashPrice,
                totalPrice: item2Price,
                totalCashPrice: item2CashPrice,
                isWholesale: false,
              },
            ]
          : []),
      ],
      subtotal,
      wholesaleDiscount: 0,
      cashDiscount: previewPaymentMethod === 'cash' ? (item1NormalPrice - item1CashPrice) * 2 + (secondProd ? item2NormalPrice - item2CashPrice : 0) : 0,
      shippingCost: shipping,
      total,
      status: 'pending_payment',
      createdAt: new Date().toISOString(),
    };
  }, [previewOrderId, previewPaymentMethod, orders, products]);

  // Live rendered HTML calculated from active editor code and sample order
  const liveRenderedHtml = useMemo(() => {
    try {
      const rendered = renderOrderTemplate(currentCode, sampleOrder, activeTemplateTab === 'customer');
      return cleanEmailHtml(rendered);
    } catch (err: any) {
      return `<div style="padding: 20px; color: red; font-family: sans-serif;">Error al renderizar plantilla: ${err?.message}</div>`;
    }
  }, [currentCode, sampleOrder, activeTemplateTab]);

  // Handle Save
  const handleSave = () => {
    if (activeTemplateTab === 'customer') {
      saveCustomerTemplate(customerCode);
      setHasCustomerCustom(true);
    } else {
      saveAdminTemplate(adminCode);
      setHasAdminCustom(true);
    }
    setSaveSuccessFeedback(`✓ Plantilla del ${activeTemplateTab === 'customer' ? 'Cliente' : 'Vendedor'} guardada con éxito.`);
    setTimeout(() => setSaveSuccessFeedback(null), 3000);
  };

  // Handle Reset to Default
  const handleReset = () => {
    const isCustomer = activeTemplateTab === 'customer';
    if (window.confirm(`¿Restaurar la plantilla predeterminada del ${isCustomer ? 'Cliente' : 'Vendedor'}? Se perderán los cambios personalizados.`)) {
      if (isCustomer) {
        const defaultCode = resetCustomerTemplate();
        setCustomerCode(defaultCode);
        setHasCustomerCustom(false);
      } else {
        const defaultCode = resetAdminTemplate();
        setAdminCode(defaultCode);
        setHasAdminCustom(false);
      }
      setSaveSuccessFeedback('✓ Plantilla restaurada al diseño predeterminado.');
      setTimeout(() => setSaveSuccessFeedback(null), 3000);
    }
  };

  // Handle Copy Code
  const handleCopy = () => {
    navigator.clipboard.writeText(currentCode);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  // Handle Send Test Email
  const handleSendTest = async () => {
    setIsSendingTest(true);
    setTestResult(null);
    try {
      await sendOrderEmails(sampleOrder);
      setTestResult({
        success: true,
        message: `✓ Envío de prueba procesado para Pedido #${sampleOrder.orderNumber} (${sampleOrder.paymentMethod === 'cash' ? 'Efectivo' : 'Transferencia'}). Revisa la consola para más detalles.`,
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `✕ Error: ${err.message || 'Fallo en envío de prueba'}`,
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  const customerVariables = [
    { tag: '{{order_number}}', desc: 'Número de pedido (ej: MY-84920)' },
    { tag: '{{customer_name}}', desc: 'Nombre completo del cliente' },
    { tag: '{{customer_email}}', desc: 'Email del cliente' },
    { tag: '{{customer_whatsapp}}', desc: 'WhatsApp del cliente' },
    { tag: '{{order_date}}', desc: 'Fecha y hora formateada' },
    { tag: '{{{products_html}}}', desc: 'Iteración completa de productos con foto, nombre, variante, cantidad, precio unitario y subtotal' },
    { tag: '{{subtotal}}', desc: 'Subtotal formateado en moneda' },
    { tag: '{{shipping_cost}}', desc: 'Costo de envío o Gratis' },
    { tag: '{{total_amount}}', desc: 'Monto total a pagar por el cliente' },
    { tag: '{{{customer_payment_info}}}', desc: 'Bloque HTML exclusivo del cliente: muestra Efectivo limpio o Transferencia con datos bancarios (sin datos de vendedor ni equivalentes)' },
    { tag: '{{{payment_info}}}', desc: 'Alias compatible para el bloque de pago del cliente' },
    { tag: '{{{delivery_info}}}', desc: 'Detalle de retiro en local o dirección de envío formateada' },
    { tag: '{{{delivery_address}}}', desc: 'Dirección de entrega o local con horario' },
    { tag: '{{forma_entrega}}', desc: 'Texto simple: Retiro en Local o Envío a Domicilio' },
    { tag: '{{forma_pago}}', desc: 'Texto simple: Efectivo o Transferencia' },
  ];

  const adminVariables = [
    { tag: '{{order_number}}', desc: 'Número de pedido (ej: MY-84920)' },
    { tag: '{{customer_name}}', desc: 'Nombre completo del cliente' },
    { tag: '{{customer_email}}', desc: 'Email del cliente' },
    { tag: '{{customer_whatsapp}}', desc: 'WhatsApp del cliente' },
    { tag: '{{order_date}}', desc: 'Fecha y hora formateada' },
    { tag: '{{{products_html}}}', desc: 'Iteración completa de productos con foto, nombre, variante, cantidad, precio unitario y subtotal' },
    { tag: '{{subtotal}}', desc: 'Subtotal formateado en moneda' },
    { tag: '{{shipping_cost}}', desc: 'Costo de envío o Gratis' },
    { tag: '{{total_amount}}', desc: 'Monto principal del pedido' },
    { tag: '{{{admin_payment_info}}}', desc: 'Bloque HTML exclusivo del vendedor: si es Efectivo calcula el equivalente por Transferencia, y si es Transferencia calcula el equivalente en Efectivo tomando los precios en efectivo de las publicaciones' },
    { tag: '{{{payment_info}}}', desc: 'Alias compatible para el bloque de pago del vendedor' },
    { tag: '{{transfer_equivalent_total}}', desc: 'Monto total equivalente a cobrar por transferencia (cuando el pedido es en efectivo)' },
    { tag: '{{cash_equivalent_total}}', desc: 'Monto total equivalente en efectivo calculado con los precios en efectivo de las publicaciones (cuando el pedido es por transferencia)' },
    { tag: '{{internal_notes}}', desc: 'Nota interna con detalle y desglose de equivalencia' },
    { tag: '{{wa_chat_link}}', desc: 'Enlace directo de chat de WhatsApp con el cliente' },
    { tag: '{{{delivery_info}}}', desc: 'Detalle de retiro en local o dirección de envío formateada' },
    { tag: '{{{delivery_address}}}', desc: 'Dirección de entrega o local con horario' },
    { tag: '{{forma_entrega}}', desc: 'Texto simple: Retiro en Local o Envío a Domicilio' },
    { tag: '{{forma_pago}}', desc: 'Texto simple: Efectivo o Transferencia' },
  ];

  const dynamicVariables = activeTemplateTab === 'customer' ? customerVariables : adminVariables;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 md:p-6 shadow-xs space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-[#0058bb] rounded-xl border border-blue-100">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 font-['Montserrat'] text-base flex items-center gap-2">
              Gestor de Plantillas EmailJS
              <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                Nuevo Sistema
              </span>
            </h3>
            <p className="text-xs text-gray-500">
              Personaliza, edita el código HTML y previsualiza en vivo las plantillas independientes para Cliente y Vendedor.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-bold px-3 py-1 rounded-full ${
              isEmailJsConfigured()
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                : 'bg-amber-100 text-amber-800 border border-amber-200'
            }`}
          >
            {isEmailJsConfigured() ? '✓ EmailJS Conectado' : '⚡ Modo Simulación en Vivo'}
          </span>
        </div>
      </div>

      {/* Main Tabs (Cliente vs Vendedor) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setActiveTemplateTab('customer')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
            activeTemplateTab === 'customer'
              ? 'border-[#0058bb] bg-blue-50/50 ring-2 ring-blue-200/60 shadow-xs'
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-900 bg-blue-100 px-2.5 py-0.5 rounded-full">
                1. Plantilla para el Cliente
              </span>
              <span className="text-[10px] font-mono text-gray-500">template_customer</span>
            </div>
            <h4 className="font-bold text-sm text-gray-900 pt-1">Recibo de Compra</h4>
            <p className="text-[11px] text-gray-600 leading-relaxed">
              Muestra productos con foto, cantidades, subtotales y total final. Si es <strong>Efectivo</strong>, muestra únicamente "Forma de pago: Efectivo". Si es <strong>Transferencia</strong>, muestra el importe y datos bancarios.
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-blue-100/60 flex items-center justify-between text-[11px]">
            <span className="font-semibold text-blue-800">
              {hasCustomerCustom ? '✏️ Personalizada' : '⭐ Predeterminada'}
            </span>
            <span className="text-blue-600 font-bold">Configurar y Editar →</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveTemplateTab('admin')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
            activeTemplateTab === 'admin'
              ? 'border-[#00a650] bg-emerald-50/50 ring-2 ring-emerald-200/60 shadow-xs'
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-900 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                2. Plantilla para el Vendedor
              </span>
              <span className="text-[10px] font-mono text-gray-500">template_admin</span>
            </div>
            <h4 className="font-bold text-sm text-gray-900 pt-1">Aviso de Nuevo Pedido</h4>
            <p className="text-[11px] text-gray-600 leading-relaxed">
              Desglose completo con fotos de productos, datos del comprador, WhatsApp directo y cálculo del <strong>total equivalente para transferencia</strong> cuando el cliente eligió abonar en efectivo.
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-emerald-100/60 flex items-center justify-between text-[11px]">
            <span className="font-semibold text-emerald-800">
              {hasAdminCustom ? '✏️ Personalizada' : '⭐ Predeterminada'}
            </span>
            <span className="text-emerald-600 font-bold">Configurar y Editar →</span>
          </div>
        </button>
      </div>

      {/* Editor & Preview Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
        <div className="flex items-center gap-2">
          {/* Mode Switcher */}
          <div className="inline-flex bg-white p-1 rounded-lg border border-gray-200 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('preview')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'preview'
                  ? 'bg-[#0058bb] text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              Vista Previa en Vivo
            </button>
            <button
              type="button"
              onClick={() => setViewMode('editor')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'editor'
                  ? 'bg-[#0058bb] text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              Editor HTML
            </button>
          </div>

          {/* Test Payment Switcher */}
          <div className="flex items-center gap-1.5 text-xs bg-white px-2.5 py-1 rounded-lg border border-gray-200">
            <span className="font-bold text-gray-700">Probar con:</span>
            <button
              type="button"
              onClick={() => setPreviewPaymentMethod('cash')}
              className={`px-2 py-0.5 rounded font-bold cursor-pointer transition-colors ${
                previewPaymentMethod === 'cash'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              💵 Efectivo
            </button>
            <span className="text-gray-300">|</span>
            <button
              type="button"
              onClick={() => setPreviewPaymentMethod('transfer')}
              className={`px-2 py-0.5 rounded font-bold cursor-pointer transition-colors ${
                previewPaymentMethod === 'transfer'
                  ? 'bg-blue-100 text-[#0058bb]'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              💳 Transferencia
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="text-xs font-bold text-gray-700 hover:text-gray-900 bg-white hover:bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            {isCopied ? '¡Copiado!' : 'Copiar HTML'}
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="text-xs font-bold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg border border-rose-200 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restaurar Predeterminada
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <Save className="w-3.5 h-3.5" />
            Guardar Cambios
          </button>
        </div>
      </div>

      {/* Success feedback alert */}
      {saveSuccessFeedback && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{saveSuccessFeedback}</span>
        </div>
      )}

      {/* Workspace Area: Live Preview or Code Editor */}
      {viewMode === 'preview' ? (
        <div className="space-y-4">
          <div className="bg-slate-900 rounded-xl p-4 md:p-6 overflow-hidden flex flex-col items-center">
            <div className="w-full max-w-[620px] bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-700">
              <iframe
                title="Email Preview"
                srcDoc={liveRenderedHtml}
                className="w-full min-h-[640px] border-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex items-center gap-2 text-xs text-slate-700">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>
                Previsualización en vivo generada con iteración de productos, fotos y{' '}
                <strong>
                  {previewPaymentMethod === 'cash' ? 'Modo Efectivo' : 'Modo Transferencia'}
                </strong>
                .
              </span>
            </div>

            <button
              type="button"
              disabled={isSendingTest}
              onClick={handleSendTest}
              className="bg-[#0058bb] hover:bg-[#004799] disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              {isSendingTest ? 'Enviando...' : '🧪 Probar Envío en Vivo'}
            </button>
          </div>

          {testResult && (
            <div
              className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                testResult.success
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border border-rose-200 text-rose-800'
              }`}
            >
              <span>{testResult.success ? '✓' : '✕'}</span>
              <span>{testResult.message}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-600">
              <label htmlFor="html-template-editor" className="font-bold text-gray-800 flex items-center gap-1.5">
                <Code2 className="w-4 h-4 text-[#0058bb]" />
                Código HTML de la Plantilla ({activeTemplateTab === 'customer' ? 'Cliente' : 'Vendedor'})
              </label>
              <span className="font-mono text-[11px] text-gray-500">
                {currentCode.length} caracteres
              </span>
            </div>

            <textarea
              id="html-template-editor"
              value={currentCode}
              onChange={(e) => {
                const val = e.target.value;
                if (activeTemplateTab === 'customer') {
                  setCustomerCode(val);
                } else {
                  setAdminCode(val);
                }
              }}
              rows={22}
              className="w-full font-mono text-xs p-4 bg-gray-900 text-gray-100 rounded-xl border border-gray-800 focus:ring-2 focus:ring-[#0058bb] focus:border-transparent leading-relaxed"
              spellCheck={false}
            />
          </div>

          {/* Quick Dynamic Variables Chips */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-blue-600" />
              <h5 className="text-xs font-bold text-gray-900">Variables Dinámicas Disponibles</h5>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {dynamicVariables.map((v) => (
                <button
                  key={v.tag}
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(v.tag);
                    setSaveSuccessFeedback(`Copiada variable: ${v.tag}`);
                    setTimeout(() => setSaveSuccessFeedback(null), 2000);
                  }}
                  className="text-left p-2 bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg transition-colors cursor-pointer group"
                >
                  <code className="text-xs font-bold text-[#0058bb] font-mono group-hover:underline">
                    {v.tag}
                  </code>
                  <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-1">{v.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Guide & Environment variables */}
      <div className="space-y-2 pt-2 border-t border-gray-100">
        <div className="bg-gray-900 text-emerald-400 p-3.5 rounded-xl font-mono text-xs space-y-1 overflow-x-auto">
          <p className="text-gray-400 text-[10px]"># Configuración de variables de entorno (.env):</p>
          <p>VITE_EMAILJS_SERVICE_ID="service_default"</p>
          <p>VITE_EMAILJS_TEMPLATE_ID_CUSTOMER="template_customer"</p>
          <p>VITE_EMAILJS_TEMPLATE_ID_ADMIN="template_admin"</p>
          <p>VITE_EMAILJS_PUBLIC_KEY="tu_public_key"</p>
          <p>VITE_ADMIN_EMAIL="admin@myimportadora.com"</p>
        </div>
      </div>
    </div>
  );
};
