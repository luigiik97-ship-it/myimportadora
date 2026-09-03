import React, { useEffect, useState } from 'react';
import {
  Briefcase,
  FileText,
  TrendingUp,
  Factory,
  Truck,
  ShoppingBag,
  ArrowLeft,
  CheckCircle2,
  MapPin,
  ShieldCheck,
  PackageCheck,
  ChevronRight,
  Sparkles,
  Layers,
  Phone,
} from 'lucide-react';

interface InfoPageViewProps {
  targetSection?: string | null;
  onGoHome: () => void;
  onOpenQuickBuy?: () => void;
}

export const InfoPageView: React.FC<InfoPageViewProps> = ({
  targetSection,
  onGoHome,
  onOpenQuickBuy,
}) => {
  const [activeTab, setActiveTab] = useState<string>(targetSection || 'trabaja-con-nosotros');

  // Scroll to target section when requested or on mount
  useEffect(() => {
    const sectionToScroll = targetSection || activeTab;
    if (sectionToScroll) {
      setActiveTab(sectionToScroll);
      const timer = setTimeout(() => {
        const el = document.getElementById(sectionToScroll);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [targetSection]);

  const scrollToSection = (id: string) => {
    setActiveTab(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const navItems = [
    { id: 'trabaja-con-nosotros', label: 'Trabajá con nosotros', icon: Briefcase },
    { id: 'terminos-y-condiciones', label: 'Términos y condiciones', icon: FileText },
    { id: 'venta-mayorista', label: 'Venta al por mayor', icon: TrendingUp },
    { id: 'fabrica', label: 'Fábrica', icon: Factory },
    { id: 'logistica-envio', label: 'Logística de envío', icon: Truck },
    { id: 'minorista', label: 'Minorista', icon: ShoppingBag },
  ];

  return (
    <div className="min-h-screen bg-gray-50/70 pb-20">
      {/* Top Header Banner */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-[1240px] mx-auto px-4 py-4 md:py-6">
          {/* Breadcrumbs & Return Button */}
          <div className="flex items-center justify-between gap-4 mb-3">
            <button
              type="button"
              id="info-back-to-store-btn"
              onClick={onGoHome}
              className="inline-flex items-center gap-2 text-xs md:text-sm font-semibold text-[#0058bb] hover:text-blue-800 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver a la tienda</span>
            </button>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="hover:text-gray-900 cursor-pointer" onClick={onGoHome}>Inicio</span>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-gray-900 font-medium">Información institucional</span>
            </div>
          </div>

          <h1 className="text-2xl md:text-3xl font-black font-['Montserrat'] text-gray-900 tracking-tight">
            Centro de Información y Servicios
          </h1>
          <p className="mt-1 text-xs md:text-sm text-gray-600 max-w-2xl">
            Conocé nuestras políticas, formas de compra mayorista y minorista, logística de entregas y oportunidades laborales.
          </p>
        </div>
      </div>

      {/* Sticky Tab Navigation Bar */}
      <div className="sticky top-[52px] md:top-[60px] z-20 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-xs">
        <div className="max-w-[1240px] mx-auto px-4">
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto py-2.5 no-scrollbar scroll-smooth">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-tab-${item.id}`}
                  type="button"
                  onClick={() => scrollToSection(item.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#0058bb] text-white shadow-xs'
                      : 'bg-gray-100/90 text-gray-700 hover:bg-gray-200/90 hover:text-gray-900'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content Container */}
      <div className="max-w-[1040px] mx-auto px-4 py-8 space-y-8 md:space-y-10">

        {/* 1. TRABAJÁ CON NOSOTROS */}
        <section
          id="trabaja-con-nosotros"
          className="scroll-mt-32 bg-white rounded-2xl border border-gray-200 p-5 md:p-8 shadow-xs transition-all hover:border-gray-300"
        >
          <div className="flex items-center gap-3 border-b border-gray-100 pb-4 mb-5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#0058bb]">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#0058bb]">Alianzas Comerciales y Distribución</span>
              <h2 className="text-xl md:text-2xl font-black font-['Montserrat'] text-gray-900 tracking-tight">
                Trabajá con nosotros
              </h2>
            </div>
          </div>

          <div className="space-y-4 text-xs md:text-sm text-gray-700 leading-relaxed">
            <p className="font-semibold text-gray-900 text-sm md:text-base">
              Somos tu proveedor de confianza para hacer crecer tu negocio.
            </p>
            <p>
              En <strong>MYImportadora S.R.L.</strong> contamos con productos importados directos de fábrica sin intermediarios, ofreciéndote los mejores precios del mercado para maximizar tus ganancias y potenciar la rentabilidad de tu local, showroom o emprendimiento.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-2">
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-1.5">
                <div className="font-bold text-gray-900 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  <span>Importación Directa de Fábrica</span>
                </div>
                <p className="text-xs text-gray-600">
                  Somos tus proveedores directos sin intermediarios, garantizándote los mejores precios mayoristas del país para maximizar tus ganancias desde la primera compra.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-1.5">
                <div className="font-bold text-gray-900 flex items-center gap-1.5">
                  <PackageCheck className="w-4 h-4 text-[#0058bb]" />
                  <span>Impulso para Crecer tu Negocio</span>
                </div>
                <p className="text-xs text-gray-600">
                  Te abastecemos con stock permanente y reposición inmediata para que tu local, showroom o emprendimiento nunca pierda ventas y aumente su rentabilidad.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-1.5">
                <div className="font-bold text-gray-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-purple-600" />
                  <span>Tu Proveedor de Confianza</span>
                </div>
                <p className="text-xs text-gray-600">
                  Te acompañamos con atención personalizada, asesoramiento en artículos de alta rotación y condiciones comerciales pensadas para que ganes más.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-100 mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <p className="font-bold text-gray-900 text-xs md:text-sm">¿Buscás un proveedor confiable para hacer crecer tu negocio?</p>
                <p className="text-xs text-gray-600">Contactate con nosotros hoy mismo para acceder a los mejores precios importados directos de fábrica y potenciar tu rentabilidad.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <a
                  href="https://wa.me/5491123456789"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  <Phone className="w-4 h-4" />
                  <span>WhatsApp Mayorista</span>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* 2. TÉRMINOS Y CONDICIONES */}
        <section
          id="terminos-y-condiciones"
          className="scroll-mt-32 bg-white rounded-2xl border border-gray-200 p-5 md:p-8 shadow-xs transition-all hover:border-gray-300"
        >
          <div className="flex items-center gap-3 border-b border-gray-100 pb-4 mb-5">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-700">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Marco Legal y Políticas</span>
              <h2 className="text-xl md:text-2xl font-black font-['Montserrat'] text-gray-900 tracking-tight">
                Términos y condiciones
              </h2>
            </div>
          </div>

          <div className="space-y-4 text-xs md:text-sm text-gray-700 leading-relaxed">
            <p>
              El acceso y uso de este sitio web implican la aceptación plena de las siguientes condiciones generales de contratación y navegación establecidas por <strong>MYImportadora S.R.L.</strong>:
            </p>

            <div className="space-y-3.5">
              <div className="border-l-2 border-[#0058bb] pl-3.5 space-y-1">
                <h3 className="font-bold text-gray-900 text-xs md:text-sm">1. Precios y Vigencia</h3>
                <p className="text-xs text-gray-600">
                  Todos los precios publicados en la plataforma están expresados en moneda de curso legal ($ ARS). Debido al origen importado de los productos y la dinámica arancelaria, nos reservamos la facultad de modificar las listas de precios sin previo aviso. Los precios confirmados en un pedido quedan congelados por el plazo de reserva correspondiente.
                </p>
              </div>

              <div className="border-l-2 border-[#0058bb] pl-3.5 space-y-1">
                <h3 className="font-bold text-gray-900 text-xs md:text-sm">2. Métodos de Pago y Reservas de Mercadería</h3>
                <p className="text-xs text-gray-600">
                  Los pedidos con retiro presencial en nuestro local comercial de Flores, CABA, pueden abonarse en efectivo con descuento especial o mediante transferencia bancaria (Alias / CVU). Los pedidos con envío a domicilio o transporte interurbano deben abonarse y acreditarse en su totalidad previamente al despacho. Los pedidos pendientes de pago se reservan por un máximo de 48 horas hábiles.
                </p>
              </div>

              <div className="border-l-2 border-[#0058bb] pl-3.5 space-y-1">
                <h3 className="font-bold text-gray-900 text-xs md:text-sm">3. Envíos Seguros y Política de Despacho</h3>
                <p className="text-xs text-gray-600">
                  Garantizamos envíos seguros a través de Correo Argentino, servicio Flex y Uber Moto según el destino. No realizamos pagos contra entrega bajo ninguna modalidad: todos los pedidos deben estar abonados y acreditados en su totalidad previo al despacho. Por motivos de seguridad y resguardo operativo, no se brinda información interna ni detalles sensibles de nuestra logística a terceros, ya que es información privada e infringe nuestras políticas de venta.
                </p>
              </div>

              <div className="border-l-2 border-[#0058bb] pl-3.5 space-y-1">
                <h3 className="font-bold text-gray-900 text-xs md:text-sm">4. Protección de Datos del Cliente</h3>
                <p className="text-xs text-gray-600">
                  Toda la información personal suministrada para fines de facturación y coordinación de envíos se maneja de manera confidencial de acuerdo a la Ley Nacional de Protección de Datos Personales N° 25.326.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 3. VENTA AL POR MAYOR */}
        <section
          id="venta-mayorista"
          className="scroll-mt-32 bg-white rounded-2xl border border-gray-200 p-5 md:p-8 shadow-xs transition-all hover:border-gray-300"
        >
          <div className="flex items-center gap-3 border-b border-gray-100 pb-4 mb-5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Comercios y Distribuidores</span>
              <h2 className="text-xl md:text-2xl font-black font-['Montserrat'] text-gray-900 tracking-tight">
                Venta al por mayor
              </h2>
            </div>
          </div>

          <div className="space-y-4 text-xs md:text-sm text-gray-700 leading-relaxed">
            <p>
              Somos importadores directos, lo que nos permite ofrecer una lista de precios mayorista altamente competitiva pensada para maximizar el margen de ganancia de revendedores, locales a la calle, emprendedores y bazares en todo el territorio argentino.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
              <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100 space-y-2">
                <div className="flex items-center gap-2 font-bold text-gray-900 text-xs sm:text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Mínimos Mayoristas Accesibles</span>
                </div>
                <p className="text-xs text-gray-600">
                  No exigimos montos mínimos exorbitantes: podés acceder a precio mayorista a partir de tan solo <strong>3 unidades</strong> (por artículo o acumulables por categoría según el producto).
                </p>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100 space-y-2">
                <div className="flex items-center gap-2 font-bold text-gray-900 text-xs sm:text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Descuento Adicional en Efectivo</span>
                </div>
                <p className="text-xs text-gray-600">
                  Abonando en efectivo al retirar en nuestro local comercial podés acceder a nuestra tarifa diferencial con el mayor margen de ahorro.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100 space-y-2">
                <div className="flex items-center gap-2 font-bold text-gray-900 text-xs sm:text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Stock y Reposición Rápida</span>
                </div>
                <p className="text-xs text-gray-600">
                  Mantenemos volumen disponible en almacén para despachos urgentes y reposiciones continuas de los artículos más vendidos.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100 space-y-2">
                <div className="flex items-center gap-2 font-bold text-gray-900 text-xs sm:text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Herramienta de Compra Rápida</span>
                </div>
                <p className="text-xs text-gray-600">
                  Diseñamos una vista especializada para mayoristas que permite sumar decenas de productos por categoría y calcular precios en segundos.
                </p>
              </div>
            </div>

            {onOpenQuickBuy && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onOpenQuickBuy}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Abrir Catálogo de Compra Rápida Mayorista</span>
                </button>
              </div>
            )}
          </div>
        </section>

        {/* 4. FÁBRICA */}
        <section
          id="fabrica"
          className="scroll-mt-32 bg-white rounded-2xl border border-gray-200 p-5 md:p-8 shadow-xs transition-all hover:border-gray-300"
        >
          <div className="flex items-center gap-3 border-b border-gray-100 pb-4 mb-5">
            <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-700">
              <Factory className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700">Producción e Importación</span>
              <h2 className="text-xl md:text-2xl font-black font-['Montserrat'] text-gray-900 tracking-tight">
                Fábrica
              </h2>
            </div>
          </div>

          <div className="space-y-4 text-xs md:text-sm text-gray-700 leading-relaxed">
            <p>
              Nuestra estructura se basa en alianzas directas con fábricas productoras líderes internacionales y talleres nacionales especializados, garantizando una cadena de valor sólida sin intermediarios innecesarios:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-2">
                <h3 className="font-bold text-gray-900 text-xs md:text-sm flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-purple-600" />
                  <span>Control de Calidad en Origen</span>
                </h3>
                <p className="text-xs text-gray-600">
                  Inspectores técnicos verifican los estándares de manufactura, terminaciones, resistencia de materiales y presentación de empaque antes del embarque hacia Argentina.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-2">
                <h3 className="font-bold text-gray-900 text-xs md:text-sm flex items-center gap-1.5">
                  <PackageCheck className="w-4 h-4 text-purple-600" />
                  <span>Pedidos por Bulto Cerrado o Contenedor</span>
                </h3>
                <p className="text-xs text-gray-600">
                  Contamos con capacidad operativa para suministrar grandes volúmenes a cadenas comerciales, licitaciones y empresas distribuidoras con tarifas de escala preferenciales.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-purple-50/50 border border-purple-100 space-y-2">
              <h4 className="font-bold text-gray-900 text-xs md:text-sm">Principales Familias de Fabricación:</h4>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-700">
                <li className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
                  <span>Bijuterie fina y accesorios de moda</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
                  <span>Juguetes didácticos y sets de bloques (Bricks)</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
                  <span>Tecnología, audio y periféricos electrónicos</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
                  <span>Textiles de confección y artículos de temporada</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* 5. LOGÍSTICA DE ENVÍO */}
        <section
          id="logistica-envio"
          className="scroll-mt-32 bg-white rounded-2xl border border-gray-200 p-5 md:p-8 shadow-xs transition-all hover:border-gray-300"
        >
          <div className="flex items-center gap-3 border-b border-gray-100 pb-4 mb-5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#0058bb]">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#0058bb]">Distribución y Entregas</span>
              <h2 className="text-xl md:text-2xl font-black font-['Montserrat'] text-gray-900 tracking-tight">
                Logística de envío
              </h2>
            </div>
          </div>

          <div className="space-y-4 text-xs md:text-sm text-gray-700 leading-relaxed">
            <p>
              Diseñamos una red logística ágil y confiable para que tus pedidos lleguen rápidamente y en óptimas condiciones a cualquier punto del país.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-gray-900 text-xs sm:text-sm">
                  <MapPin className="w-4 h-4 text-emerald-600" />
                  <span>Retiro en Local (Flores, CABA)</span>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  <strong>100% GRATIS.</strong> Podés retirar tu pedido previa confirmación en nuestro local comercial de Flores, CABA. Horarios: Lunes a Viernes de 9:00 a 18:00 hs y Sábados de 9:00 a 13:00 hs.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-gray-900 text-xs sm:text-sm">
                  <Truck className="w-4 h-4 text-[#0058bb]" />
                  <span>Envíos en el Día (CABA y GBA)</span>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Mediante servicio de mensajería Express / Flex en moto o utilitario. Las compras confirmadas antes de las 14:00 hs se entregan en el transcurso del mismo día.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-gray-900 text-xs sm:text-sm">
                  <PackageCheck className="w-4 h-4 text-blue-700" />
                  <span>Envíos Nacionales</span>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Despachos a todo el país por Correo Argentino, Andreani y empresas de encomiendas de confianza. Te proveemos número de seguimiento en tiempo real.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200/80 space-y-1 text-xs text-amber-900">
              <p className="font-bold">📦 Embalaje seguro garantizado</p>
              <p className="text-amber-800">
                Todos los productos se embalan con film alveolar de alta densidad y cajas rígidas precintadas para evitar daños durante el traslado.
              </p>
            </div>
          </div>
        </section>

        {/* 6. MINORISTA */}
        <section
          id="minorista"
          className="scroll-mt-32 bg-white rounded-2xl border border-gray-200 p-5 md:p-8 shadow-xs transition-all hover:border-gray-300"
        >
          <div className="flex items-center gap-3 border-b border-gray-100 pb-4 mb-5">
            <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600">Consumidor Final</span>
              <h2 className="text-xl md:text-2xl font-black font-['Montserrat'] text-gray-900 tracking-tight">
                Minorista
              </h2>
            </div>
          </div>

          <div className="space-y-4 text-xs md:text-sm text-gray-700 leading-relaxed">
            <p>
              En <strong>MYImportadora S.R.L.</strong> los compradores individuales también son bienvenidos. Podés comprar para uso personal, regalos o renovar tus artículos favoritos sin necesidad de compras en volumen:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-1.5">
                <div className="font-bold text-gray-900 text-xs sm:text-sm flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-rose-600" />
                  <span>Sin Mínimo de Unidades</span>
                </div>
                <p className="text-xs text-gray-600">
                  Podés comprar desde <strong>1 sola unidad</strong> de cualquier producto de nuestra tienda online con entrega o retiro inmediato.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-1.5">
                <div className="font-bold text-gray-900 text-xs sm:text-sm flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-rose-600" />
                  <span>Precios Claros y Transparentes</span>
                </div>
                <p className="text-xs text-gray-600">
                  Visualizás siempre el precio minorista regular y el precio con descuento especial si optás por abonar en efectivo o por transferencia.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-1.5">
                <div className="font-bold text-gray-900 text-xs sm:text-sm flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-rose-600" />
                  <span>Garantía y Confianza</span>
                </div>
                <p className="text-xs text-gray-600">
                  Atención postventa y garantía directa de 30 días para tu total tranquilidad al comprar.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-1.5">
                <div className="font-bold text-gray-900 text-xs sm:text-sm flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-rose-600" />
                  <span>Experiencia Ágil de Compra</span>
                </div>
                <p className="text-xs text-gray-600">
                  Navegá por categorías, agregá al carrito fácilmente y coordiná el retiro o envío en pocos clics.
                </p>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={onGoHome}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0058bb] hover:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Explorar Productos de la Tienda</span>
              </button>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
};
