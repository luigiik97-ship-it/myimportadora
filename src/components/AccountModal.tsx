import React, { useState, useEffect } from 'react';
import { 
  X, User, MapPin, Package, LogOut, Loader2, CheckCircle2, 
  AlertCircle, ChevronRight, Clock, Truck, Store, ExternalLink, RefreshCw 
} from 'lucide-react';
import { UserProfile, Order } from '../types';
import { saveUserProfile, signOutUser, fetchUserOrders } from '../services/auth';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onUpdateProfile: (updated: UserProfile) => void;
  onLogout: () => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  profile,
  onUpdateProfile,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'addresses' | 'orders'>('orders');

  // Profile Form States
  const [fullName, setFullName] = useState(profile.fullName || '');
  const [phone, setPhone] = useState(profile.phone || '');
  const [dni, setDni] = useState(profile.dni || '');
  
  // Address Form States
  const [street, setStreet] = useState(profile.street || '');
  const [streetNumber, setStreetNumber] = useState(profile.streetNumber || '');
  const [floor, setFloor] = useState(profile.floor || '');
  const [city, setCity] = useState(profile.city || '');
  const [province, setProvince] = useState(profile.province || '');
  const [postalCode, setPostalCode] = useState(profile.postalCode || '');
  const [receiverName, setReceiverName] = useState(profile.receiverName || '');

  // Orders state
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Status feedback
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Sync with incoming profile prop
  useEffect(() => {
    setFullName(profile.fullName || '');
    setPhone(profile.phone || '');
    setDni(profile.dni || '');
    setStreet(profile.street || '');
    setStreetNumber(profile.streetNumber || '');
    setFloor(profile.floor || '');
    setCity(profile.city || '');
    setProvince(profile.province || '');
    setPostalCode(profile.postalCode || '');
    setReceiverName(profile.receiverName || '');
  }, [profile]);

  // Load orders when modal opens or tab changes, or when orders update
  useEffect(() => {
    if (isOpen) {
      loadOrders();
    }

    const handleOrdersUpdated = () => {
      if (isOpen) {
        loadOrders();
      }
    };

    window.addEventListener('my_commerce_orders_updated', handleOrdersUpdated);
    return () => {
      window.removeEventListener('my_commerce_orders_updated', handleOrdersUpdated);
    };
  }, [isOpen, profile.id, profile.email]);

  const loadOrders = async () => {
    setLoadingOrders(true);
    try {
      const userOrders = await fetchUserOrders(profile.id, profile.email);
      setOrders(userOrders);
    } catch (e) {
      console.warn('Error loading orders:', e);
    } finally {
      setLoadingOrders(false);
    }
  };

  if (!isOpen) return null;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      const updated: UserProfile = {
        ...profile,
        fullName: fullName.trim(),
        phone: phone.trim(),
        dni: dni.trim(),
      };
      const result = await saveUserProfile(updated);
      onUpdateProfile(result);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err?.message || 'Error al guardar cambios.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      const updated: UserProfile = {
        ...profile,
        street: street.trim(),
        streetNumber: streetNumber.trim(),
        floor: floor.trim(),
        city: city.trim(),
        province: province.trim(),
        postalCode: postalCode.trim(),
        receiverName: receiverName.trim() || fullName.trim(),
      };
      const result = await saveUserProfile(updated);
      onUpdateProfile(result);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err?.message || 'Error al guardar la dirección.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoutClick = async () => {
    await signOutUser();
    onLogout();
    onClose();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="px-2.5 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-600"></span> Entregado
          </span>
        );
      case 'shipped':
        return (
          <span className="px-2.5 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded-full flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-600"></span> En camino
          </span>
        );
      case 'preparing':
        return (
          <span className="px-2.5 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span> En preparación
          </span>
        );
      case 'cancelled':
        return (
          <span className="px-2.5 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded-full flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span> Cancelado
          </span>
        );
      case 'pending_payment':
      default:
        return (
          <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span> Pendiente de pago
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 md:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#0058bb] text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-lg">
              {profile.fullName ? profile.fullName.charAt(0).toUpperCase() : 'U'}
            </div>
            <div>
              <h2 className="font-bold text-lg font-['Montserrat'] leading-tight">
                Mi Cuenta
              </h2>
              <p className="text-xs text-blue-100">{profile.email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white rounded-full hover:bg-white/15 transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50/80 px-2.5 md:px-6 shrink-0 overflow-x-auto no-scrollbar sm:scrollbar-thin gap-1 md:gap-2">
          <button
            onClick={() => setActiveTab('orders')}
            className={`min-h-[44px] py-2.5 md:py-3 px-3 md:px-4 text-xs md:text-sm font-semibold flex items-center gap-1.5 md:gap-2 border-b-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'orders'
                ? 'border-[#0058bb] text-[#0058bb]'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <span>Mis pedidos</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`min-h-[44px] py-2.5 md:py-3 px-3 md:px-4 text-xs md:text-sm font-semibold flex items-center gap-1.5 md:gap-2 border-b-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'profile'
                ? 'border-[#0058bb] text-[#0058bb]'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <User className="w-4 h-4 shrink-0" />
            <span>Perfil</span>
          </button>

          <button
            onClick={() => setActiveTab('addresses')}
            className={`min-h-[44px] py-2.5 md:py-3 px-3 md:px-4 text-xs md:text-sm font-semibold flex items-center gap-1.5 md:gap-2 border-b-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'addresses'
                ? 'border-[#0058bb] text-[#0058bb]'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <MapPin className="w-4 h-4 shrink-0" />
            <span>Direcciones</span>
          </button>

          <div className="hidden md:block md:flex-1"></div>

          <button
            onClick={handleLogoutClick}
            className="min-h-[44px] py-2.5 md:py-3 px-3 md:px-3 text-xs md:text-sm font-semibold text-red-600 hover:text-red-700 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ml-auto"
            title="Cerrar sesión"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Cerrar sesión</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="p-4 md:p-6 overflow-y-auto flex-1 space-y-4">
          {saveSuccess && (
            <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-2.5 rounded-xl flex items-center gap-2 text-xs">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
              <span>Cambios guardados correctamente.</span>
            </div>
          )}

          {saveError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-xl flex items-center gap-2 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{saveError}</span>
            </div>
          )}

          {/* TAB: MIS PEDIDOS */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-900 font-['Montserrat'] text-base">
                  Historial de Compras
                </h3>
                <button
                  onClick={loadOrders}
                  disabled={loadingOrders}
                  className="text-xs text-[#0058bb] hover:underline flex items-center gap-1"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingOrders ? 'animate-spin' : ''}`} />
                  <span>Actualizar</span>
                </button>
              </div>

              {loadingOrders ? (
                <div className="py-12 flex flex-col items-center justify-center text-gray-400 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-[#0058bb]" />
                  <p className="text-xs">Cargando tus pedidos...</p>
                </div>
              ) : orders.length === 0 ? (
                <div className="py-12 px-4 text-center border-2 border-dashed border-gray-200 rounded-2xl">
                  <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <h4 className="font-bold text-gray-700 text-sm mb-1">Aún no tienes pedidos registrados</h4>
                  <p className="text-xs text-gray-500 max-w-sm mx-auto">
                    Tus compras se sincronizarán aquí automáticamente para que puedas consultar el estado y comprobantes en cualquier momento.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {orders.map((order) => {
                    const formattedDate = new Date(order.createdAt).toLocaleDateString('es-AR', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <div
                        key={order.id}
                        className="bg-white border border-gray-200 rounded-xl p-4 shadow-2xs hover:shadow-xs transition-shadow space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-gray-900 font-mono">
                                Pedido #{order.orderNumber}
                              </span>
                              {getStatusBadge(order.status)}
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {formattedDate}
                            </p>
                          </div>

                          <div className="text-right">
                            <span className="text-xs text-gray-500 block">Total</span>
                            <span className="font-bold text-base text-gray-900">
                              ${order.total.toLocaleString('es-AR')}
                            </span>
                          </div>
                        </div>

                        {/* Items list */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 overflow-x-auto py-1">
                            {order.items.map((item, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-lg p-1.5 pr-3 shrink-0"
                              >
                                <img
                                  src={item.image}
                                  alt={item.title}
                                  className="w-10 h-10 rounded object-cover border border-gray-200"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800';
                                  }}
                                />
                                <div className="text-xs">
                                  <p className="font-medium text-gray-800 line-clamp-1 max-w-[150px]">
                                    {item.title}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    Cant: <span className="font-semibold text-gray-700">{item.quantity}</span>
                                    {item.variantText ? ` • ${item.variantText}` : ''}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Order Details Footer */}
                        <div className="flex flex-wrap items-center justify-between text-xs text-gray-600 bg-gray-50/60 rounded-lg p-2.5 gap-2">
                          <div className="flex items-center gap-2">
                            {order.deliveryOption === 'delivery' ? (
                              <Truck className="w-4 h-4 text-[#0058bb]" />
                            ) : (
                              <Store className="w-4 h-4 text-emerald-600" />
                            )}
                            <span>
                              {order.deliveryOption === 'delivery'
                                ? `Envío a domicilio: ${order.shippingMethodName || 'Correo / Flex'}`
                                : 'Retiro en el local de (Flores)'}
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="capitalize">
                              Pago: {order.paymentMethod === 'cash' ? 'Efectivo en local' : 'Transferencia'}
                            </span>
                            <a
                              href={`https://wa.me/5491136916892?text=${encodeURIComponent(
                                `Hola! Quisiera consultar sobre el estado de mi pedido #${order.orderNumber}`
                              )}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[#0058bb] hover:underline font-semibold flex items-center gap-1 ml-auto"
                            >
                              <span>Consultar por WhatsApp</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB: PERFIL */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <h3 className="font-bold text-gray-900 font-['Montserrat'] text-base">
                Datos Personales
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Nombre y Apellido Completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ej: Alejandro Yugar"
                    className="w-full border border-gray-300 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0058bb] focus:border-transparent transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Correo Electrónico (No modificable)
                  </label>
                  <input
                    type="email"
                    disabled
                    value={profile.email}
                    className="w-full border border-gray-200 bg-gray-100 text-gray-500 rounded-lg px-3.5 py-2 text-sm cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Teléfono / WhatsApp
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ej: 1123456789"
                    className="w-full border border-gray-300 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0058bb] focus:border-transparent transition-all"
                  />
                </div>

                <div className="hidden">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    DNI / CUIT (Opcional para facturación)
                  </label>
                  <input
                    type="text"
                    value={dni}
                    onChange={(e) => setDni(e.target.value)}
                    placeholder="Ej: 38123456"
                    className="w-full border border-gray-300 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0058bb] focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="bg-[#0058bb] hover:bg-[#004799] text-white font-semibold py-2 px-5 rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-70 text-sm"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <span>Guardar Cambios</span>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* TAB: DIRECCIONES */}
          {activeTab === 'addresses' && (
            <form onSubmit={handleSaveAddress} className="space-y-4">
              <div>
                <h3 className="font-bold text-gray-900 font-['Montserrat'] text-base">
                  Dirección Predeterminada de Envío
                </h3>
                <p className="text-xs text-gray-500">
                  Esta dirección se completará automáticamente cada vez que realices una compra con entrega a domicilio.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Nombre de quien recibe
                  </label>
                  <input
                    type="text"
                    value={receiverName}
                    onChange={(e) => setReceiverName(e.target.value)}
                    placeholder={fullName || 'Ej: Juan Pérez'}
                    className="w-full border border-gray-300 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0058bb] focus:border-transparent transition-all"
                  />
                </div>

                <div className="sm:col-span-2 grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Calle
                    </label>
                    <input
                      type="text"
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      placeholder="Ej: Av. Corrientes"
                      className="w-full border border-gray-300 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0058bb] focus:border-transparent transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Número
                    </label>
                    <input
                      type="text"
                      value={streetNumber}
                      onChange={(e) => setStreetNumber(e.target.value)}
                      placeholder="1234"
                      className="w-full border border-gray-300 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0058bb] focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Piso / Depto / Timbre (Opcional)
                  </label>
                  <input
                    type="text"
                    value={floor}
                    onChange={(e) => setFloor(e.target.value)}
                    placeholder="Ej: 4to B"
                    className="w-full border border-gray-300 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0058bb] focus:border-transparent transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Código Postal
                  </label>
                  <input
                    type="text"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="Ej: 1043 o C1043"
                    className="w-full border border-gray-300 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0058bb] focus:border-transparent transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Ciudad / Localidad
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Ej: Balvanera / CABA"
                    className="w-full border border-gray-300 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0058bb] focus:border-transparent transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Provincia
                  </label>
                  <input
                    type="text"
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    placeholder="Ej: Buenos Aires / CABA"
                    className="w-full border border-gray-300 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0058bb] focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="bg-[#0058bb] hover:bg-[#004799] text-white font-semibold py-2 px-5 rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-70 text-sm"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <span>Guardar Dirección</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
