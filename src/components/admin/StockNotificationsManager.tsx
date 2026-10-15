import React, { useState, useEffect, useMemo } from 'react';
import {
  Bell,
  Search,
  MessageCircle,
  CheckCircle,
  Clock,
  Trash2,
  Filter,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  PackageCheck,
  User,
  Phone,
} from 'lucide-react';
import { StockNotification } from '../../types';
import {
  fetchStockNotifications,
  markStockNotificationAsNotified,
  deleteStockNotification,
  formatWhatsAppLink,
} from '../../services/stockNotifications';

interface StockNotificationsManagerProps {
  initialFilterVariant?: string;
  initialFilterProduct?: string;
}

export const StockNotificationsManager: React.FC<StockNotificationsManagerProps> = ({
  initialFilterVariant,
  initialFilterProduct,
}) => {
  const [notifications, setNotifications] = useState<StockNotification[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>(initialFilterVariant || initialFilterProduct || '');
  const [statusFilter, setStatusFilter] = useState<'pending' | 'notified' | 'all'>('pending');
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchStockNotifications();
      setNotifications(data);
    } catch (e) {
      console.error('Error cargando avisos de stock:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleMarkAsNotified = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const success = await markStockNotificationAsNotified(id);
    if (success) {
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status: 'notified' as const, notifiedAt: new Date().toISOString() } : item
        )
      );
      showFlashMessage('Cliente marcado como avisado correctamente.');
    }
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm('¿Seguro que deseas eliminar este registro de aviso?')) return;
    const success = await deleteStockNotification(id);
    if (success) {
      setNotifications((prev) => prev.filter((item) => item.id !== id));
      showFlashMessage('Registro eliminado.');
    }
  };

  const showFlashMessage = (msg: string) => {
    setActionSuccessMessage(msg);
    setTimeout(() => {
      setActionSuccessMessage(null);
    }, 3000);
  };

  const handleSendWhatsApp = (item: StockNotification, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const message = `¡Hola${item.customerName ? ` ${item.customerName}` : ''}! Te escribimos de MY Importadora. El producto que estabas esperando ya volvió a estar disponible: *${item.productTitle}* (${item.variantName}).`;
    const url = formatWhatsAppLink(item.phone, message);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Filtrado y agrupado
  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      // Filtro de estado
      if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false;
      }
      // Búsqueda
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesProduct = item.productTitle.toLowerCase().includes(q);
        const matchesVariant = item.variantName.toLowerCase().includes(q);
        const matchesPhone = item.phone.toLowerCase().includes(q);
        const matchesName = (item.customerName || '').toLowerCase().includes(q);
        return matchesProduct || matchesVariant || matchesPhone || matchesName;
      }
      return true;
    });
  }, [notifications, statusFilter, searchQuery]);

  // Agrupación por Producto + Variante para visualización clara
  const groupedByVariant = useMemo(() => {
    const groups: Record<
      string,
      {
        productId: string;
        productTitle: string;
        variantName: string;
        items: StockNotification[];
      }
    > = {};

    filteredNotifications.forEach((item) => {
      const key = `${item.productId}__${item.variantName}`;
      if (!groups[key]) {
        groups[key] = {
          productId: item.productId,
          productTitle: item.productTitle,
          variantName: item.variantName,
          items: [],
        };
      }
      groups[key].items.push(item);
    });

    return Object.values(groups);
  }, [filteredNotifications]);

  const pendingTotal = useMemo(() => {
    return notifications.filter((n) => n.status === 'pending').length;
  }, [notifications]);

  const notifiedTotal = useMemo(() => {
    return notifications.filter((n) => n.status === 'notified').length;
  }, [notifications]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 font-['Montserrat']">
                Avisos de Stock Pendientes
              </h2>
              <p className="text-xs text-gray-500">
                Clientes que solicitaron aviso por WhatsApp cuando vuelva el stock de una variante
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={loadData}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Actualizar</span>
        </button>
      </div>

      {actionSuccessMessage && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 font-bold flex items-center gap-2 shadow-xs animate-in fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccessMessage}</span>
        </div>
      )}

      {/* Filtros y Búsqueda */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Pills de Estado */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            <button
              type="button"
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                statusFilter === 'pending'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Pendientes ({pendingTotal})</span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('notified')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                statusFilter === 'notified'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Avisados ({notifiedTotal})</span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-gray-800 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Todos ({notifications.length})</span>
            </button>
          </div>

          {/* Input de Búsqueda */}
          <div className="relative min-w-[240px] max-w-sm">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por producto, variante, teléfono..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-300 rounded-xl text-xs text-gray-900 focus:bg-white focus:border-[#0058bb] focus:ring-1 focus:ring-[#0058bb] outline-none"
            />
          </div>
        </div>
      </div>

      {/* Lista Agrupada por Producto → Variante */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-500 space-y-2">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-gray-400" />
          <p className="text-xs">Cargando avisos de stock...</p>
        </div>
      ) : groupedByVariant.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <PackageCheck className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-gray-800">
            {statusFilter === 'pending'
              ? 'No hay avisos de stock pendientes'
              : 'No se encontraron avisos con los filtros actuales'}
          </h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto">
            {statusFilter === 'pending'
              ? 'Cuando un cliente elija "Avísame cuando esté disponible" sobre una variante sin stock, aparecerá aquí organizado por producto y variante.'
              : 'Probá seleccionando otra pestaña o limpiando el texto de búsqueda.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedByVariant.map((group) => {
            const pendingInGroup = group.items.filter((i) => i.status === 'pending').length;

            return (
              <div
                key={`${group.productId}-${group.variantName}`}
                className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs hover:border-gray-300 transition-colors"
              >
                {/* Cabecera del Grupo: Producto y Variante */}
                <div className="bg-slate-50/80 px-4 py-3 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                      Producto & Variante
                    </span>
                    <h3 className="text-sm sm:text-base font-bold text-gray-900 truncate">
                      {group.productTitle}
                    </h3>
                    <div className="inline-flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                        {group.variantName}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        pendingInGroup > 0
                          ? 'bg-amber-100 text-amber-900 border border-amber-200'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {pendingInGroup} {pendingInGroup === 1 ? 'cliente esperando' : 'clientes esperando'}
                    </span>
                  </div>
                </div>

                {/* Tabla de Clientes Esperando */}
                <div className="divide-y divide-gray-100">
                  {group.items.map((item) => {
                    const isPending = item.status === 'pending';

                    return (
                      <div
                        key={item.id}
                        className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50/70 transition-colors"
                      >
                        {/* Info de contacto */}
                        <div className="flex items-start sm:items-center gap-3 min-w-0">
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                              isPending
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {isPending ? <Clock className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-gray-900">
                                {item.phone}
                              </span>
                              {item.customerName && (
                                <span className="text-xs text-gray-600 font-medium truncate">
                                  ({item.customerName})
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-0.5">
                              <span>
                                Solicitado: {new Date(item.createdAt).toLocaleDateString()} {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {!isPending && item.notifiedAt && (
                                <span className="text-emerald-700 font-medium">
                                  • Avisado el: {new Date(item.notifiedAt).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Botones de Acción */}
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          {isPending ? (
                            <>
                              {/* Avisar por WhatsApp */}
                              <button
                                type="button"
                                onClick={(e) => handleSendWhatsApp(item, e)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                                title="Abrir WhatsApp para enviar aviso de reposición de stock"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                <span>Avisar por WhatsApp</span>
                              </button>

                              {/* Marcar como avisado */}
                              <button
                                type="button"
                                onClick={(e) => handleMarkAsNotified(item.id, e)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-gray-100 hover:bg-blue-50 text-gray-700 hover:text-[#0058bb] border border-gray-200 text-xs font-semibold transition-colors cursor-pointer"
                                title="Marcar como avisado para pasarlo al historial"
                              >
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Marcar Avisado</span>
                              </button>
                            </>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                              <CheckCircle className="w-3 h-3" />
                              <span>Avisado</span>
                            </span>
                          )}

                          {/* Eliminar registro */}
                          <button
                            type="button"
                            onClick={(e) => handleDelete(item.id, e)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            title="Eliminar registro"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
