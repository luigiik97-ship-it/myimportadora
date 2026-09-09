import React, { useState, useEffect, useRef } from 'react';
import { CartItem, Order, UserProfile } from '../types';
import { ShieldCheck, ArrowLeft, Loader2, Truck, Store, CreditCard, Banknote, AlertCircle, MapPin, Zap, User } from 'lucide-react';
import confetti from 'canvas-confetti';
import { getShippingZoneInfo, ShippingOption } from '../utils/shipping';
import { getItemEffectiveCashPrice, getItemEffectiveNormalPrice } from '../utils/variantHelpers';
import { AuthModal } from './AuthModal';

interface CheckoutViewProps {
  cartItems: CartItem[];
  onBackToCart: () => void;
  onOrderCompleted: (order: Order) => void;
  onSaveOrderToSupabaseAndEmail: (orderData: any) => Promise<Order>;
  currentUser?: UserProfile | null;
  onAuthSuccess?: (profile: UserProfile) => void;
  initialDeliveryOption?: 'pickup' | 'delivery' | null;
  initialPaymentMethod?: 'transfer' | 'cash';
  onDeliveryOptionChange?: (option: 'pickup' | 'delivery') => void;
  onPaymentMethodChange?: (method: 'transfer' | 'cash') => void;
}

export const CheckoutView: React.FC<CheckoutViewProps> = ({
  cartItems,
  onBackToCart,
  onOrderCompleted,
  onSaveOrderToSupabaseAndEmail,
  currentUser,
  onAuthSuccess,
  initialDeliveryOption,
  initialPaymentMethod,
  onDeliveryOptionChange,
  onPaymentMethodChange,
}) => {
  // Auth Modal State
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Form fields
  const [customerWhatsapp, setCustomerWhatsapp] = useState(currentUser?.phone || '');
  const [customerEmail, setCustomerEmail] = useState(currentUser?.email || '');
  const [customerName, setCustomerName] = useState(currentUser?.fullName || '');

  // Delivery options: 'pickup' | 'delivery' | null (persisted across page reloads)
  const [deliveryOption, setDeliveryOption] = useState<'pickup' | 'delivery' | null>(() => {
    if (initialDeliveryOption === 'pickup' || initialDeliveryOption === 'delivery') {
      return initialDeliveryOption;
    }
    try {
      const saved = localStorage.getItem('my_commerce_checkout_delivery_option');
      if (saved === 'pickup' || saved === 'delivery') return saved;
    } catch (e) {}
    return null;
  });

  const [deliveryOptionError, setDeliveryOptionError] = useState<string | null>(null);
  const deliverySectionRef = useRef<HTMLDivElement>(null);

  // Delivery address fields
  const [street, setStreet] = useState(currentUser?.street || '');
  const [number, setNumber] = useState(currentUser?.streetNumber || '');
  const [floor, setFloor] = useState(currentUser?.floor || '');
  const [city, setCity] = useState(currentUser?.city || '');
  const [postalCode, setPostalCode] = useState(currentUser?.postalCode || '');
  const [province, setProvince] = useState(currentUser?.province || '');
  const [receiverName, setReceiverName] = useState(currentUser?.receiverName || currentUser?.fullName || '');

  // Auto-fill form fields whenever currentUser changes or logs in
  useEffect(() => {
    if (currentUser) {
      if (currentUser.fullName) setCustomerName(currentUser.fullName);
      if (currentUser.email) setCustomerEmail(currentUser.email);
      if (currentUser.phone) setCustomerWhatsapp(currentUser.phone);
      if (currentUser.street) setStreet(currentUser.street);
      if (currentUser.streetNumber) setNumber(currentUser.streetNumber);
      if (currentUser.floor) setFloor(currentUser.floor);
      if (currentUser.city) setCity(currentUser.city);
      if (currentUser.province) setProvince(currentUser.province);
      if (currentUser.postalCode) setPostalCode(currentUser.postalCode);
      if (currentUser.receiverName) setReceiverName(currentUser.receiverName);
    }
  }, [currentUser]);

  const handleModalAuthSuccess = (profile: UserProfile) => {
    if (onAuthSuccess) {
      onAuthSuccess(profile);
    }
    // Auto populate directly
    if (profile.fullName) setCustomerName(profile.fullName);
    if (profile.email) setCustomerEmail(profile.email);
    if (profile.phone) setCustomerWhatsapp(profile.phone);
    if (profile.street) setStreet(profile.street);
    if (profile.streetNumber) setNumber(profile.streetNumber);
    if (profile.floor) setFloor(profile.floor);
    if (profile.city) setCity(profile.city);
    if (profile.province) setProvince(profile.province);
    if (profile.postalCode) setPostalCode(profile.postalCode);
    if (profile.receiverName) setReceiverName(profile.receiverName);
  };

  // Selected Shipping Option ID
  const [selectedShippingOptionId, setSelectedShippingOptionId] = useState<string | null>(null);

  // Payment method: 'transfer' | 'cash' (persisted across page reloads)
  const [paymentMethod, setPaymentMethod] = useState<'transfer' | 'cash'>(() => {
    if (initialPaymentMethod === 'cash' || initialPaymentMethod === 'transfer') {
      return initialPaymentMethod;
    }
    try {
      const saved = localStorage.getItem('my_commerce_checkout_payment_method');
      if (saved === 'cash' || saved === 'transfer') return saved;
    } catch (e) {}
    return 'transfer';
  });

  // Sync props changes if passed
  useEffect(() => {
    if (initialDeliveryOption && initialDeliveryOption !== deliveryOption) {
      setDeliveryOption(initialDeliveryOption);
    }
  }, [initialDeliveryOption]);

  useEffect(() => {
    if (initialPaymentMethod && initialPaymentMethod !== paymentMethod) {
      setPaymentMethod(initialPaymentMethod);
    }
  }, [initialPaymentMethod]);

  // Persist deliveryOption and paymentMethod whenever changed
  useEffect(() => {
    try {
      if (deliveryOption) {
        localStorage.setItem('my_commerce_checkout_delivery_option', deliveryOption);
      } else {
        localStorage.removeItem('my_commerce_checkout_delivery_option');
      }
    } catch (e) {}
  }, [deliveryOption]);

  useEffect(() => {
    try {
      localStorage.setItem('my_commerce_checkout_payment_method', paymentMethod);
    } catch (e) {}
  }, [paymentMethod]);

  const handleSelectDeliveryOption = (option: 'pickup' | 'delivery') => {
    setDeliveryOption(option);
    onDeliveryOptionChange?.(option);
    if (option === 'pickup') {
      setDeliveryOptionError(null);
    } else if (option === 'delivery') {
      setPaymentMethod('transfer');
      onPaymentMethodChange?.('transfer');
      if (selectedShippingOption) {
        setDeliveryOptionError(null);
      }
    }
  };

  const handleSelectShippingOption = (optionId: string) => {
    setSelectedShippingOptionId(optionId);
    setDeliveryOptionError(null);
  };

  // Determine available shipping options based on Postal Code, Province and City
  const shippingZoneInfo = deliveryOption === 'delivery' ? getShippingZoneInfo(postalCode, province, city) : null;
  const availableShippingOptions: ShippingOption[] = shippingZoneInfo?.options || [];

  // Active selected shipping option object
  const selectedShippingOption = availableShippingOptions.find((opt) => opt.id === selectedShippingOptionId) || null;

  // Auto-handle selection when zone changes
  useEffect(() => {
    if (availableShippingOptions.length > 0) {
      // If previous selection is not in new zone
      if (!selectedShippingOptionId || !availableShippingOptions.some((o) => o.id === selectedShippingOptionId)) {
        if (availableShippingOptions.length === 1) {
          // If only 1 option exists for this zone, auto-select it
          setSelectedShippingOptionId(availableShippingOptions[0].id);
        } else {
          // If multiple options, reset or keep unselected until user clicks
          setSelectedShippingOptionId(null);
        }
      }
    } else {
      setSelectedShippingOptionId(null);
    }
  }, [postalCode, province, city, availableShippingOptions.length]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Compute wholesale logic and subtotals
  const categoryQuantities: Record<string, number> = {};
  cartItems.forEach((item) => {
    const cat = item.product.category || 'General';
    categoryQuantities[cat] = (categoryQuantities[cat] || 0) + item.quantity;
  });

  const processedItems = cartItems.map((item) => {
    const cat = item.product.category || 'General';
    const totalInCat = categoryQuantities[cat] || 0;
    const minQty = item.product.minWholesaleQty || 1;
    const isWholesale = totalInCat >= minQty;

    // Normal unit prices (wholesale or retail) resolved from variant options or sizeVariants
    const wholesaleUnitPrice = getItemEffectiveNormalPrice(
      item.product,
      item.selectedVariants,
      item.selectedSizeVariant,
      true
    );

    const retailUnitPrice = getItemEffectiveNormalPrice(
      item.product,
      item.selectedVariants,
      item.selectedSizeVariant,
      false
    );

    const normalUnitPrice = isWholesale ? wholesaleUnitPrice : retailUnitPrice;

    // Cash unit price from configured fields (wholesaleCashPrice if isWholesale, else retailCashPrice, with legacy fallbacks)
    const cashUnitPrice = getItemEffectiveCashPrice(
      item.product,
      item.selectedVariants,
      item.selectedSizeVariant,
      normalUnitPrice,
      isWholesale
    );

    // If paymentMethod is cash, replace unit price and total price in real time with cash price
    const unitPrice = paymentMethod === 'cash' ? cashUnitPrice : normalUnitPrice;
    const totalPrice = unitPrice * item.quantity;

    const normalTotalPrice = normalUnitPrice * item.quantity;
    const cashTotalPrice = cashUnitPrice * item.quantity;

    const rawVariantList: string[] =
      item.selectedVariants && Object.keys(item.selectedVariants).length > 0
        ? (Object.values(item.selectedVariants).filter(Boolean) as string[])
        : ([item.selectedColor, item.selectedSizeVariant?.name].filter(Boolean) as string[]);
    const variantText = Array.from(new Set(rawVariantList)).join(', ');

    return {
      ...item,
      isWholesale,
      normalUnitPrice,
      cashUnitPrice,
      unitPrice,
      totalPrice,
      normalTotalPrice,
      cashTotalPrice,
      variantText,
    };
  });

  const totalQuantity = processedItems.reduce((acc, i) => acc + i.quantity, 0);
  const productsSubtotal = processedItems.reduce((acc, i) => acc + i.totalPrice, 0);

  // Totals for comparison in payment selection cards
  const transferProductsSubtotal = processedItems.reduce((acc, i) => acc + i.normalTotalPrice, 0);
  const cashProductsSubtotal = processedItems.reduce((acc, i) => acc + i.cashTotalPrice, 0);

  // Dynamic Shipping cost: only modified when CP is entered and an option is selected
  const shippingCost = deliveryOption === 'delivery' && selectedShippingOption ? selectedShippingOption.price : 0;

  const totalFinal = Math.max(0, productsSubtotal + shippingCost);
  const transferTotal = transferProductsSubtotal + shippingCost;
  const cashTotal = cashProductsSubtotal + shippingCost;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Form validation
    if (!customerWhatsapp.trim()) {
      setErrorMessage('Por favor ingresa tu número de WhatsApp para coordinar la entrega.');
      return;
    }
    if (!customerEmail.trim() || !customerEmail.includes('@')) {
      setErrorMessage('Por favor ingresa un correo Gmail válido donde recibirás el comprobante.');
      return;
    }
    if (!customerName.trim()) {
      setErrorMessage('Por favor ingresa tu nombre y apellido.');
      return;
    }

    if (!deliveryOption) {
      setDeliveryOptionError('elija una opción de envió');
      deliverySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (deliveryOption === 'delivery') {
      if (!street.trim() || !number.trim() || !city.trim()) {
        setErrorMessage('Por favor completa la dirección completa de envío a domicilio (Calle, Número y Ciudad).');
        deliverySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      if (!postalCode.trim()) {
        setErrorMessage('Por favor ingresa tu Código Postal para calcular las opciones de envío.');
        deliverySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      if (!selectedShippingOption) {
        setDeliveryOptionError('elija una opción de envió');
        deliverySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const orderPayload = {
        userId: currentUser?.id,
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        customerWhatsapp: customerWhatsapp.trim(),
        deliveryOption,
        shippingMethodName: deliveryOption === 'delivery' && selectedShippingOption ? selectedShippingOption.name : undefined,
        deliveryAddress:
          deliveryOption === 'delivery'
            ? {
                street: street.trim(),
                number: number.trim(),
                floor: floor.trim(),
                city: city.trim(),
                postalCode: postalCode.trim(),
                province: province.trim(),
                receiverName: receiverName.trim() || customerName.trim(),
              }
            : undefined,
        paymentMethod,
        items: processedItems.map((item) => ({
          id: item.id,
          productId: item.productId,
          title: item.product.title,
          image: item.selectedImage || (item.product.images && item.product.images[0]) || 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800',
          variantText: item.variantText,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          cashUnitPrice: item.cashUnitPrice,
          totalPrice: item.totalPrice,
          totalCashPrice: item.cashTotalPrice,
          isWholesale: item.isWholesale,
        })),
        subtotal: productsSubtotal,
        wholesaleDiscount: 0,
        cashDiscount: paymentMethod === 'cash' ? Math.max(0, transferProductsSubtotal - cashProductsSubtotal) : 0,
        shippingCost,
        total: totalFinal,
        status: 'pending_payment' as const,
      };

      const savedOrder = await onSaveOrderToSupabaseAndEmail(orderPayload);

      // Trigger celebration confetti
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch (e) {
        // Safe fallback
      }

      onOrderCompleted(savedOrder);
    } catch (err: any) {
      console.error('Error procesando checkout:', err);
      setErrorMessage(err?.message || 'Ocurrió un error al guardar tu pedido. Por favor intenta nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-[1240px] mx-auto px-1 sm:px-4 py-2 sm:py-6 space-y-3 sm:space-y-6">
      <h1 id="checkout-title" className="text-xl sm:text-2xl md:text-3xl font-black text-gray-900 font-['Montserrat'] px-1 sm:px-0">
        Finalizar Compra
      </h1>

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl flex items-center gap-2.5 text-xs sm:text-sm">
          <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-red-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 lg:gap-8 items-start">
        {/* Left Column: Form Details (Cols 8) */}
        <div className="lg:col-span-8 space-y-3 sm:space-y-3.5">
          {/* Prompt to login or session active indicator */}
          {!currentUser ? (
            <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-2.5 px-3 sm:px-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-sm text-gray-800">
              <p className="text-xs text-gray-700">
                ¿Ya tienes una cuenta?{' '}
                <span className="font-medium text-gray-900">
                  Inicia sesión para completar automáticamente tus datos.
                </span>
              </p>
              <button
                type="button"
                id="checkout-login-btn"
                onClick={() => setIsAuthModalOpen(true)}
                className="shrink-0 bg-[#0058bb] hover:bg-[#004799] text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer min-h-[34px]"
              >
                Iniciar sesión
              </button>
            </div>
          ) : (
            <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-2.5 px-3 sm:px-3.5 flex items-center justify-between gap-2 text-xs md:text-sm text-emerald-900">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>
                  Sesión iniciada como <strong className="font-semibold">{currentUser.fullName}</strong> ({currentUser.email})
                </span>
              </div>
            </div>
          )}

          {/* 1. Tus Datos - Native flat layout on mobile */}
          <div className="bg-transparent md:bg-white rounded-none md:rounded-xl border-0 md:border md:border-gray-200 p-1 md:p-4 shadow-none md:shadow-xs space-y-2.5 pb-4 border-b border-gray-100 md:border-b-0">
            <h2 className="text-sm sm:text-base md:text-lg font-bold text-gray-900 font-['Montserrat']">
              Tus Datos
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              <div>
                <label className="text-xs sm:text-sm font-semibold text-gray-700 block mb-1">
                  Número de WhatsApp *
                </label>
                <input
                  id="checkout-whatsapp"
                  type="tel"
                  required
                  value={customerWhatsapp}
                  onChange={(e) => setCustomerWhatsapp(e.target.value)}
                  placeholder="Ej: 1123456789"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0058bb] focus:border-transparent transition-all min-h-[42px] bg-white"
                />
              </div>

              <div>
                <label className="text-xs sm:text-sm font-semibold text-gray-700 block mb-1">
                  Correo Gmail (Se enviará el recibo) *
                </label>
                <input
                  id="checkout-email"
                  type="email"
                  required
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="correo@gmail.com"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0058bb] focus:border-transparent transition-all min-h-[42px] bg-white"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs sm:text-sm font-semibold text-gray-700 block mb-1">
                  Nombre y Apellido Completo *
                </label>
                <input
                  id="checkout-name"
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Ej: Alejandro Yugar"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0058bb] focus:border-transparent transition-all min-h-[42px] bg-white"
                />
              </div>
            </div>
          </div>

          {/* 2. Opciones de Entrega */}
          <div
            id="delivery-options-section"
            ref={deliverySectionRef}
            className="space-y-2"
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-sm sm:text-base md:text-lg font-bold text-gray-900 font-['Montserrat'] flex items-center gap-2">
                <Truck className="w-4 h-4 sm:w-5 sm:h-5 text-[#0058bb]" />
                Opciones de Entrega
              </h2>
            </div>

            <div className="space-y-2">
              {/* Option: Retiro en local */}
              <label
                className={`flex items-start justify-between bg-white p-2.5 sm:p-3 rounded-xl border-2 transition-all cursor-pointer ${
                  deliveryOption === 'pickup'
                    ? 'border-[#0058bb] bg-blue-50/20 shadow-xs'
                    : deliveryOptionError && !deliveryOption
                    ? 'border-red-400 bg-red-50/10 hover:border-red-500'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <input
                    type="radio"
                    name="delivery"
                    checked={deliveryOption === 'pickup'}
                    onChange={() => handleSelectDeliveryOption('pickup')}
                    className="mt-0.5 text-[#0058bb] focus:ring-[#0058bb]"
                  />
                  <div>
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                      <span className="text-xs sm:text-sm font-bold text-gray-900">Retiro en local</span>
                      <span className="bg-[#a3e635] text-gray-900 text-xs font-bold px-2 py-0.5 rounded">
                        Descuento disponible
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 leading-snug">
                      Gratis en nuestro local en Av. San Pedrito 28 local 4, CABA - Lunes a sábados de 11hs a 17hs
                    </p>
                  </div>
                </div>
                <span className="text-xs sm:text-sm font-bold text-[#00a650] shrink-0 pl-2">Gratis</span>
              </label>

              {/* Option: Envío a domicilio */}
              <div
                className={`bg-white p-2.5 sm:p-3 rounded-xl border-2 transition-all ${
                  deliveryOption === 'delivery'
                    ? 'border-[#0058bb] bg-blue-50/20 shadow-xs'
                    : deliveryOptionError && !deliveryOption
                    ? 'border-red-400 bg-red-50/10 hover:border-red-500'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div
                  onClick={() => handleSelectDeliveryOption('delivery')}
                  className="flex items-start justify-between cursor-pointer"
                >
                  <div className="flex items-start gap-2.5">
                    <input
                      type="radio"
                      name="delivery"
                      checked={deliveryOption === 'delivery'}
                      onChange={() => handleSelectDeliveryOption('delivery')}
                      className="mt-0.5 text-[#0058bb] focus:ring-[#0058bb]"
                    />
                    <div>
                      <span className="text-xs sm:text-sm font-bold text-gray-900">Envío a domicilio</span>
                      <p className="text-xs text-gray-500 mt-0.5 leading-snug">
                        Entrega a la puerta de tu casa o comercio (Uber Moto, Flex o Correo Argentino).
                      </p>
                    </div>
                  </div>
                  <span className="text-xs sm:text-sm font-bold text-gray-900 shrink-0 pl-2 text-right leading-tight">
                    {selectedShippingOption ? (
                      `$ ${selectedShippingOption.price.toLocaleString('es-AR')}`
                    ) : (
                      <>
                        Según<br />
                        Código<br />
                        Postal
                      </>
                    )}
                  </span>
                </div>

                {/* Extended Address Form & Dynamic Shipping Options */}
                {deliveryOption === 'delivery' && (
                  <div className="mt-3 pt-3 border-t border-blue-200/60 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs sm:text-sm font-semibold text-gray-700 block mb-0.5">Calle *</label>
                        <input
                          type="text"
                          required
                          value={street}
                          onChange={(e) => setStreet(e.target.value)}
                          placeholder="Ej: Av. Corrientes"
                          className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-sm focus:ring-1 focus:ring-[#0058bb] bg-white min-h-[38px]"
                        />
                      </div>

                      <div>
                        <label className="text-xs sm:text-sm font-semibold text-gray-700 block mb-0.5">Número *</label>
                        <input
                          type="text"
                          required
                          value={number}
                          onChange={(e) => setNumber(e.target.value)}
                          placeholder="1234"
                          className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-sm focus:ring-1 focus:ring-[#0058bb] bg-white min-h-[38px]"
                        />
                      </div>

                      <div>
                        <label className="text-xs sm:text-sm font-semibold text-gray-700 block mb-0.5">Piso / Dpto</label>
                        <input
                          type="text"
                          value={floor}
                          onChange={(e) => setFloor(e.target.value)}
                          placeholder="Piso 5, Dpto B"
                          className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-sm focus:ring-1 focus:ring-[#0058bb] bg-white min-h-[38px]"
                        />
                      </div>

                      <div>
                        <label className="text-xs sm:text-sm font-semibold text-gray-700 block mb-0.5">Ciudad / Localidad *</label>
                        <input
                          type="text"
                          required
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          placeholder="Ej: CABA, Lanús..."
                          className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-sm focus:ring-1 focus:ring-[#0058bb] bg-white min-h-[38px]"
                        />
                      </div>

                      <div className="col-span-2 sm:col-span-1">
                        <label className="text-xs sm:text-sm font-semibold text-gray-700 block mb-0.5">
                          Código Postal *
                        </label>
                        <input
                          type="text"
                          required
                          value={postalCode}
                          onChange={(e) => setPostalCode(e.target.value)}
                          placeholder="Ej: 1406, 1602..."
                          className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-sm focus:ring-1 focus:ring-[#0058bb] bg-white font-semibold min-h-[38px]"
                        />
                      </div>
                    </div>

                    {/* Dynamic Postal Code Options Section */}
                    <div className="pt-2 border-t border-blue-200/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs sm:text-sm font-bold text-gray-800 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-[#0058bb]" />
                          Opciones de envío disponibles para tu zona:
                        </label>
                        {shippingZoneInfo && (
                          <span className="text-xs font-semibold text-[#0058bb] bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                            {shippingZoneInfo.zoneLabel}
                          </span>
                        )}
                      </div>

                      {deliveryOptionError && (
                        <div className="text-xs sm:text-sm font-semibold text-red-600 flex items-center gap-2 bg-red-50 p-2 rounded-lg border border-red-200 animate-pulse">
                          <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                          <span>elija una opción de envió</span>
                        </div>
                      )}

                      {availableShippingOptions.length > 0 ? (
                        <div className="space-y-1.5">
                          {availableShippingOptions.map((option) => {
                            const isSelected = selectedShippingOptionId === option.id;
                            return (
                              <label
                                key={option.id}
                                onClick={() => handleSelectShippingOption(option.id)}
                                className={`flex items-center justify-between p-2.5 rounded-lg border-2 transition-all cursor-pointer ${
                                  isSelected
                                    ? 'border-[#0058bb] bg-white shadow-xs'
                                    : 'border-gray-200 bg-white/70 hover:border-gray-300'
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <input
                                    type="radio"
                                    name="shippingMethod"
                                    checked={isSelected}
                                    onChange={() => handleSelectShippingOption(option.id)}
                                    className="text-[#0058bb] focus:ring-[#0058bb]"
                                  />
                                  <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-xs sm:text-sm font-bold text-gray-900">
                                        {option.name}
                                      </span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                      {option.description}
                                    </p>
                                  </div>
                                </div>
                                <span className="text-sm sm:text-base font-bold text-gray-900 font-['Montserrat'] shrink-0 pl-2">
                                  $ {option.price.toLocaleString('es-AR')}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-2.5 bg-amber-50/90 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-2">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>
                            Por favor escribe tu Código Postal arriba para ver los métodos de envío y tarifas exactas para tu localidad.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 3. Medio de Pago */}
          <div className="space-y-2 px-1 sm:px-0">
            <h2 className="text-sm sm:text-base md:text-lg font-bold text-gray-900 font-['Montserrat'] flex items-center gap-2">
              <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-[#0058bb]" />
              Medio de Pago
            </h2>

            <div className="space-y-2">
              {/* Transferencia */}
              <label
                className={`flex items-start justify-between bg-white p-3 rounded-xl border-2 transition-all cursor-pointer min-h-[48px] ${
                  paymentMethod === 'transfer'
                    ? 'border-[#0058bb] bg-blue-50/20 shadow-xs'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <input
                    type="radio"
                    name="payment"
                    checked={paymentMethod === 'transfer'}
                    onChange={() => setPaymentMethod('transfer')}
                    className="mt-1 text-[#0058bb] focus:ring-[#0058bb]"
                  />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-gray-900">Transferencia Bancaria</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 leading-snug">
                      Al finalizar la compra le pasaremos los datos (Alias y CVU) para realizar la transferencia.
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0 pl-2">
                  <span className="text-sm sm:text-base font-bold text-gray-900 font-['Montserrat'] block">
                    $ {transferTotal.toLocaleString('es-AR')}
                  </span>
                </div>
              </label>

              {/* Efectivo (Solo disponible para retiro en local) */}
              {deliveryOption === 'pickup' && (
                <label
                  className={`flex items-start justify-between bg-white p-3 rounded-xl border-2 transition-all cursor-pointer min-h-[48px] ${
                    paymentMethod === 'cash'
                      ? 'border-[#0058bb] bg-blue-50/20 shadow-xs'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <input
                      type="radio"
                      name="payment"
                      checked={paymentMethod === 'cash'}
                      onChange={() => setPaymentMethod('cash')}
                      className="mt-1 text-[#0058bb] focus:ring-[#0058bb]"
                    />
                    <div>
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <span className="text-sm font-bold text-gray-900">Efectivo</span>
                        <span className="bg-[#a3e635] text-gray-900 text-xs font-bold px-2 py-0.5 rounded">
                          Precio en efectivo
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Abonás al retirar en el local comercial.
                      </p>
                      <p className="text-xs text-gray-400 font-normal mt-0.5">
                        Calculado con los precios en efectivo de cada producto.
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 pl-2">
                    <span className="text-sm sm:text-base font-bold text-[#00a650] font-['Montserrat'] block">
                      $ {cashTotal.toLocaleString('es-AR')}
                    </span>
                    {cashTotal < transferTotal && (
                      <span className="text-xs text-gray-400 line-through block">
                        $ {transferTotal.toLocaleString('es-AR')}
                      </span>
                    )}
                    <span className="text-xs font-bold text-[#00a650] block leading-tight">
                      Precio total<br />en efectivo
                    </span>
                  </div>
                </label>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Resumen de Compra (Cols 4) - Native flat on mobile */}
        <div className="lg:col-span-4 bg-transparent md:bg-white rounded-none md:rounded-xl border-0 md:border md:border-gray-200 p-1 md:p-5 shadow-none md:shadow-xs space-y-4 lg:sticky lg:top-28 pt-4 md:pt-5 border-t border-gray-200 md:border-t-0">
          <h2 className="text-base sm:text-lg font-bold text-gray-900 font-['Montserrat'] border-b border-gray-100 pb-2.5">
            Resumen de compra
          </h2>

          {/* Mini item list */}
          <div className="space-y-3 max-h-56 overflow-y-auto no-scrollbar border-b border-gray-100 pb-3">
            {processedItems.map((item) => {
              const itemLabel = `${item.quantity}x ${item.product.title}${
                item.variantText ? `, ${item.variantText}` : ''
              } (${item.isWholesale ? 'mayorista' : 'minorista'})`;

              return (
                <div key={item.id} className="flex items-start gap-2.5 sm:gap-3">
                  <img
                    src={item.selectedImage || (item.product.images && item.product.images[0]) || 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=200'}
                    alt={item.product.title}
                    className="w-12 h-12 sm:w-12 sm:h-12 object-contain rounded-xl border border-gray-200 p-0.5 shrink-0 bg-white mt-0.5 shadow-2xs"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-semibold text-gray-800 leading-snug break-words">
                      {itemLabel}
                    </p>
                    <p className={`text-xs mt-0.5 font-medium ${
                      paymentMethod === 'cash' ? 'text-[#00a650]' : 'text-gray-500'
                    }`}>
                      ($ {item.unitPrice.toLocaleString('es-AR')} c/u)
                    </p>
                  </div>
                  <span className="text-sm sm:text-base font-bold text-gray-900 shrink-0 pt-0.5">
                    ${item.totalPrice.toLocaleString('es-AR')}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="space-y-2.5 text-xs sm:text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Productos ({totalQuantity} u.)</span>
              <span className="font-normal text-gray-900">${productsSubtotal.toLocaleString('es-AR')}</span>
            </div>

            <div className="flex justify-between items-start text-gray-600">
              <div>
                <span>Envío</span>
                {deliveryOption === 'delivery' && selectedShippingOption && (
                  <p className="text-xs text-gray-500 font-normal">
                    {selectedShippingOption.name}
                  </p>
                )}
              </div>
              <span className={shippingCost === 0 && deliveryOption === 'pickup' ? 'text-[#00a650] font-bold' : 'font-normal text-gray-900'}>
                {deliveryOption === 'pickup'
                  ? 'Gratis'
                  : selectedShippingOption
                  ? `$${shippingCost.toLocaleString('es-AR')}`
                  : 'A calcular'}
              </span>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-3 flex items-baseline justify-between">
            <span className="text-base font-bold text-gray-900">Total</span>
            <span id="checkout-total-display" className="text-2xl font-bold text-gray-900 font-['Montserrat']">
              $ {totalFinal.toLocaleString('es-AR')}
            </span>
          </div>

          {/* Confirm Button - Enlarged full width */}
          <button
            id="checkout-confirm-btn"
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[#0058bb] hover:bg-[#004bb0] text-white font-bold py-4 px-4 rounded-xl text-base uppercase tracking-wide transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 min-h-[50px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>PROCESANDO PEDIDO...</span>
              </>
            ) : (
              <span>FINALIZAR COMPRA</span>
            )}
          </button>

          <div className="text-center pt-2 space-y-2 text-xs sm:text-sm">
            <div className="flex items-center justify-center gap-1.5 text-gray-500">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Pago seguro y protegido</span>
            </div>

            <button
              type="button"
              onClick={onBackToCart}
              className="text-[#0058bb] hover:underline font-bold cursor-pointer block mx-auto pt-1"
            >
              ← Volver al carrito
            </button>
          </div>
        </div>
      </form>

      {/* Auth Modal for Checkout login/register without leaving */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={handleModalAuthSuccess}
      />
    </div>
  );
};

