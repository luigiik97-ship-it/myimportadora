import React, { useState, useEffect } from 'react';
import {
  Truck,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Clock,
  DollarSign,
  MapPin,
  Search,
  Plus,
  Trash2,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import {
  ShippingConfig,
  ShippingOptionConfig,
  ShippingZoneId,
  DEFAULT_SHIPPING_CONFIG,
  getShippingConfig,
  saveShippingConfig,
  fetchShippingConfigFromSupabase,
  resetShippingConfigToDefault,
} from '../../services/shippingConfig';
import { getShippingZoneInfo } from '../../utils/shipping';
import { isSupabaseConfigured } from '../../services/supabase';

export const ShippingConfigManager: React.FC = () => {
  const [config, setConfig] = useState<ShippingConfig>(() => getShippingConfig());
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  // Simulador de Código Postal en vivo
  const [simulatorPostalCode, setSimulatorPostalCode] = useState('1406');
  const [simulatorProvince, setSimulatorProvince] = useState('');
  const [simulatorCity, setSimulatorCity] = useState('');

  // Modal para agregar regla específica de Código Postal (Override)
  const [isCustomRuleModalOpen, setIsCustomRuleModalOpen] = useState(false);
  const [newRuleCp, setNewRuleCp] = useState('');
  const [newRuleLabel, setNewRuleLabel] = useState('');
  const [newRuleMethodName, setNewRuleMethodName] = useState('Envío Express');
  const [newRulePrice, setNewRulePrice] = useState<number>(7500);
  const [newRuleTime, setNewRuleTime] = useState('Llega hoy');

  // Cargar configuración remota al montar
  useEffect(() => {
    fetchShippingConfigFromSupabase()
      .then((remoteConfig) => {
        if (remoteConfig) {
          setConfig(remoteConfig);
        }
      })
      .catch((err) => {
        console.warn('Error sincronizando configuración de envíos:', err);
      });

    const handleUpdate = (e: CustomEvent<ShippingConfig>) => {
      if (e.detail) {
        setConfig(e.detail);
      }
    };

    window.addEventListener(
      'my_commerce_shipping_config_updated' as any,
      handleUpdate as EventListener
    );
    return () => {
      window.removeEventListener(
        'my_commerce_shipping_config_updated' as any,
        handleUpdate as EventListener
      );
    };
  }, []);

  // Actualizar una opción de una zona específica
  const handleUpdateOption = (
    zoneId: ShippingZoneId,
    optionIndex: number,
    field: keyof ShippingOptionConfig,
    value: any
  ) => {
    setConfig((prev) => {
      const zone = prev.zones[zoneId];
      if (!zone) return prev;
      const updatedOptions = [...zone.options];
      updatedOptions[optionIndex] = {
        ...updatedOptions[optionIndex],
        [field]: value,
      };

      return {
        ...prev,
        zones: {
          ...prev.zones,
          [zoneId]: {
            ...zone,
            options: updatedOptions,
          },
        },
      };
    });
  };

  // Actualizar etiqueta o rangos de CP de una zona
  const handleUpdateZoneMeta = (
    zoneId: ShippingZoneId,
    field: 'name' | 'zoneLabel' | 'description' | 'minPostalCode' | 'maxPostalCode',
    value: any
  ) => {
    setConfig((prev) => {
      const zone = prev.zones[zoneId];
      if (!zone) return prev;
      return {
        ...prev,
        zones: {
          ...prev.zones,
          [zoneId]: {
            ...zone,
            [field]: value,
          },
        },
      };
    });
  };

  // Guardar configuración completa
  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      await saveShippingConfig(config);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      console.error('Error al guardar configuración de envíos:', err);
      setSaveError(err.message || 'Error al guardar la configuración');
    } finally {
      setIsSaving(false);
    }
  };

  // Restablecer valores por defecto
  const handleReset = async () => {
    setIsSaving(true);
    try {
      const reset = await resetShippingConfigToDefault();
      setConfig(reset);
      setIsResetConfirmOpen(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (e) {
      console.error('Error al restablecer valores de envíos:', e);
    } finally {
      setIsSaving(false);
    }
  };

  // Agregar excepción personalizada por Código Postal
  const handleAddCustomRule = () => {
    if (!newRuleCp.trim()) return;

    const newRule = {
      id: `cp_rule_${Date.now()}`,
      postalCode: newRuleCp.trim().toUpperCase(),
      zoneLabel: newRuleLabel.trim() || `CP ${newRuleCp.trim()} (Tarifa especial)`,
      options: [
        {
          id: `custom_${Date.now()}`,
          name: newRuleMethodName.trim() || 'Envío Personalizado',
          price: Number(newRulePrice) || 0,
          deliveryTime: newRuleTime.trim() || 'Coordinar',
          description: 'Tarifa especial configurada para este código postal',
          enabled: true,
        },
      ],
    };

    setConfig((prev) => ({
      ...prev,
      customPostalCodeRules: [...(prev.customPostalCodeRules || []), newRule],
    }));

    setIsCustomRuleModalOpen(false);
    setNewRuleCp('');
    setNewRuleLabel('');
    setNewRuleMethodName('Envío Express');
    setNewRulePrice(7500);
    setNewRuleTime('Llega hoy');
  };

  // Eliminar regla personalizada
  const handleDeleteCustomRule = (ruleId: string) => {
    setConfig((prev) => ({
      ...prev,
      customPostalCodeRules: prev.customPostalCodeRules.filter((r) => r.id !== ruleId),
    }));
  };

  // Calcular resultado en el simulador interactivo usando la configuración actual en edición
  const simulatorResult = getShippingZoneInfo(
    simulatorPostalCode,
    simulatorProvince,
    simulatorCity,
    config
  );

  return (
    <div className="space-y-6">
      {/* HEADER PRINCIPAL */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0058bb]">
            <Truck className="w-4 h-4" />
            <span>Gestión de Logística y Envíos</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-gray-900 mt-1">
            Configuración y Tarifas de Envíos
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Administra precios, tiempos de entrega y métodos (Uber Moto, Envío Flex y Correo
            Argentino) para el Checkout y la Compra Rápida por WhatsApp.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsResetConfirmOpen(true)}
            className="px-3.5 py-2 text-xs font-bold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restablecer Valores
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2 text-sm font-bold text-white bg-[#0058bb] hover:bg-[#004696] active:bg-[#00387a] rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Guardando...</span>
              </>
            ) : saveSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                <span>¡Cambios Guardados!</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Guardar Cambios</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ALERTAS DE ESTADO */}
      {saveSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl flex items-center gap-2.5 text-sm font-medium animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>
            Las tarifas y zonas de envío fueron actualizadas con éxito y ya están activas tanto en
            el Checkout normal como en la Compra Rápida por WhatsApp.
          </span>
        </div>
      )}

      {saveError && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl flex items-center gap-2.5 text-sm font-medium">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {/* SIMULADOR DE CÓDIGO POSTAL EN VIVO */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#0058bb] text-white text-xs font-bold">
                <Search className="w-3.5 h-3.5" />
              </span>
              <h3 className="text-base font-bold text-gray-900">
                Simulador de Envíos en Tiempo Real
              </h3>
            </div>
            <p className="text-xs text-gray-600">
              Ingresa un código postal para comprobar de inmediato cómo se cotiza según tus precios
              configurados.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 text-xs font-bold">
                CP:
              </span>
              <input
                type="text"
                value={simulatorPostalCode}
                onChange={(e) => setSimulatorPostalCode(e.target.value)}
                placeholder="Ej. 1406, 1602, 2000"
                className="pl-9 pr-3 py-1.5 text-sm font-bold text-gray-900 bg-white border border-blue-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0058bb] w-36 shadow-xs"
              />
            </div>

            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setSimulatorPostalCode('1406')}
                className="px-2 py-1 text-xs bg-white hover:bg-gray-100 text-gray-700 font-semibold rounded-lg border border-gray-200 cursor-pointer"
              >
                CABA (1406)
              </button>
              <button
                type="button"
                onClick={() => setSimulatorPostalCode('1602')}
                className="px-2 py-1 text-xs bg-white hover:bg-gray-100 text-gray-700 font-semibold rounded-lg border border-gray-200 cursor-pointer"
              >
                GBA (1602)
              </button>
              <button
                type="button"
                onClick={() => setSimulatorPostalCode('2000')}
                className="px-2 py-1 text-xs bg-white hover:bg-gray-100 text-gray-700 font-semibold rounded-lg border border-gray-200 cursor-pointer"
              >
                Sta Fe (2000)
              </button>
              <button
                type="button"
                onClick={() => setSimulatorPostalCode('5000')}
                className="px-2 py-1 text-xs bg-white hover:bg-gray-100 text-gray-700 font-semibold rounded-lg border border-gray-200 cursor-pointer"
              >
                Cba (5000)
              </button>
              <button
                type="button"
                onClick={() => setSimulatorPostalCode('9400')}
                className="px-2 py-1 text-xs bg-white hover:bg-gray-100 text-gray-700 font-semibold rounded-lg border border-gray-200 cursor-pointer"
              >
                Interior (9400)
              </button>
            </div>
          </div>
        </div>

        {/* Resultado del simulador */}
        <div className="mt-4 pt-4 border-t border-blue-200/70">
          {simulatorResult ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-900">
                  Zona Detectada:
                </span>
                <span className="text-xs font-bold text-[#0058bb] bg-blue-100 px-2 py-0.5 rounded-md">
                  {simulatorResult.zoneLabel}
                </span>
              </div>

              {simulatorResult.options.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 mt-2">
                  {simulatorResult.options.map((opt) => (
                    <div
                      key={opt.id}
                      className="bg-white p-3 rounded-xl border border-blue-200 flex flex-col justify-between shadow-2xs"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-bold text-gray-900">{opt.name}</span>
                          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                            ${opt.price.toLocaleString('es-AR')}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{opt.description}</p>
                      </div>
                      <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                        <span className="flex items-center gap-1 font-medium">
                          <Clock className="w-3 h-3 text-[#0058bb]" />
                          {opt.deliveryTime}
                        </span>
                        <span className="text-xs text-emerald-600 font-semibold">Disponible</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-amber-50 text-amber-800 text-xs p-3 rounded-xl border border-amber-200">
                  No hay opciones de envío activas para esta zona. Revisa si alguna opción fue
                  desactivada en el panel inferior.
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-gray-500 italic">
              Ingresa un código postal válido arriba para simular las opciones.
            </div>
          )}
        </div>
      </div>

      {/* ZONAS PRINCIPALES DE ENVÍO */}
      <div className="space-y-6">
        {/* ZONA 1: CABA */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs">
          <div className="bg-gray-50/80 px-5 py-3.5 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <h3 className="text-base font-bold text-gray-900">
                  Zona 1: CABA (Ciudad Autónoma de Buenos Aires)
                </h3>
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  CPs 1000 a 1499
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Capital Federal y barrios aledaños. Admite entrega rápida en el día (Uber Moto),
                reparto express (Flex) y Correo Argentino.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-500">Rango CP:</span>
              <input
                type="number"
                value={config.zones.caba.minPostalCode ?? 1000}
                onChange={(e) =>
                  handleUpdateZoneMeta('caba', 'minPostalCode', parseInt(e.target.value, 10) || 0)
                }
                className="w-16 px-2 py-1 text-xs font-bold border border-gray-300 rounded-lg text-center"
              />
              <span className="text-gray-400">a</span>
              <input
                type="number"
                value={config.zones.caba.maxPostalCode ?? 1499}
                onChange={(e) =>
                  handleUpdateZoneMeta('caba', 'maxPostalCode', parseInt(e.target.value, 10) || 0)
                }
                className="w-16 px-2 py-1 text-xs font-bold border border-gray-300 rounded-lg text-center"
              />
            </div>
          </div>

          <div className="p-5 divide-y divide-gray-100">
            {config.zones.caba.options.map((option, idx) => (
              <div
                key={option.id}
                className={`py-4 first:pt-0 last:pb-0 grid grid-cols-1 md:grid-cols-12 gap-3 items-center ${
                  !option.enabled ? 'opacity-50' : ''
                }`}
              >
                <div className="md:col-span-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`caba_opt_enable_${option.id}`}
                      checked={option.enabled}
                      onChange={(e) =>
                        handleUpdateOption('caba', idx, 'enabled', e.target.checked)
                      }
                      className="w-4 h-4 text-[#0058bb] rounded border-gray-300 focus:ring-[#0058bb]"
                    />
                    <label
                      htmlFor={`caba_opt_enable_${option.id}`}
                      className="text-sm font-bold text-gray-900 cursor-pointer flex items-center gap-1.5"
                    >
                      {option.name}
                      {option.id.includes('uber') && (
                        <span className="text-xs bg-black text-white px-1.5 py-0.5 rounded font-black">
                          UBER
                        </span>
                      )}
                      {option.id.includes('flex') && (
                        <span className="text-xs bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
                          FLEX
                        </span>
                      )}
                      {option.id.includes('correo') && (
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded font-bold">
                          CORREO
                        </span>
                      )}
                    </label>
                  </div>
                  <input
                    type="text"
                    value={option.description}
                    onChange={(e) =>
                      handleUpdateOption('caba', idx, 'description', e.target.value)
                    }
                    placeholder="Descripción visible para el cliente"
                    className="mt-1.5 w-full text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0058bb]"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Tiempo de Entrega
                  </label>
                  <div className="relative">
                    <Clock className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={option.deliveryTime}
                      onChange={(e) =>
                        handleUpdateOption('caba', idx, 'deliveryTime', e.target.value)
                      }
                      placeholder="Ej. Llega hoy"
                      className="w-full text-xs font-medium pl-8 pr-2.5 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0058bb]"
                    />
                  </div>
                </div>

                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Precio de Envío ($ ARS)
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                      $
                    </span>
                    <input
                      type="number"
                      value={option.price}
                      onChange={(e) =>
                        handleUpdateOption(
                          'caba',
                          idx,
                          'price',
                          Math.max(0, parseInt(e.target.value, 10) || 0)
                        )
                      }
                      className="w-full text-sm font-black text-gray-900 pl-7 pr-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0058bb]"
                    />
                  </div>
                </div>

                <div className="md:col-span-2 flex items-center justify-end">
                  <span
                    className={`text-xs font-bold px-2 py-1 rounded-full ${
                      option.enabled
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {option.enabled ? 'Activo' : 'Desactivado'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ZONA 2: GRAN BUENOS AIRES */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs">
          <div className="bg-gray-50/80 px-5 py-3.5 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                <h3 className="text-base font-bold text-gray-900">
                  Zona 2: Gran Buenos Aires (1er y 2do cordón)
                </h3>
                <span className="text-xs font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                  CPs 1600 a 1899
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Municipios del Conurbano Bonaerense. Admite Envío Flex (llega mañana) y Correo
                Argentino a domicilio.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-500">Rango CP:</span>
              <input
                type="number"
                value={config.zones.gba.minPostalCode ?? 1600}
                onChange={(e) =>
                  handleUpdateZoneMeta('gba', 'minPostalCode', parseInt(e.target.value, 10) || 0)
                }
                className="w-16 px-2 py-1 text-xs font-bold border border-gray-300 rounded-lg text-center"
              />
              <span className="text-gray-400">a</span>
              <input
                type="number"
                value={config.zones.gba.maxPostalCode ?? 1899}
                onChange={(e) =>
                  handleUpdateZoneMeta('gba', 'maxPostalCode', parseInt(e.target.value, 10) || 0)
                }
                className="w-16 px-2 py-1 text-xs font-bold border border-gray-300 rounded-lg text-center"
              />
            </div>
          </div>

          <div className="p-5 divide-y divide-gray-100">
            {config.zones.gba.options.map((option, idx) => (
              <div
                key={option.id}
                className={`py-4 first:pt-0 last:pb-0 grid grid-cols-1 md:grid-cols-12 gap-3 items-center ${
                  !option.enabled ? 'opacity-50' : ''
                }`}
              >
                <div className="md:col-span-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`gba_opt_enable_${option.id}`}
                      checked={option.enabled}
                      onChange={(e) => handleUpdateOption('gba', idx, 'enabled', e.target.checked)}
                      className="w-4 h-4 text-[#0058bb] rounded border-gray-300 focus:ring-[#0058bb]"
                    />
                    <label
                      htmlFor={`gba_opt_enable_${option.id}`}
                      className="text-sm font-bold text-gray-900 cursor-pointer flex items-center gap-1.5"
                    >
                      {option.name}
                      {option.id.includes('flex') && (
                        <span className="text-xs bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
                          FLEX
                        </span>
                      )}
                      {option.id.includes('correo') && (
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded font-bold">
                          CORREO
                        </span>
                      )}
                    </label>
                  </div>
                  <input
                    type="text"
                    value={option.description}
                    onChange={(e) => handleUpdateOption('gba', idx, 'description', e.target.value)}
                    placeholder="Descripción visible para el cliente"
                    className="mt-1.5 w-full text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0058bb]"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Tiempo de Entrega
                  </label>
                  <div className="relative">
                    <Clock className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={option.deliveryTime}
                      onChange={(e) =>
                        handleUpdateOption('gba', idx, 'deliveryTime', e.target.value)
                      }
                      placeholder="Ej. Llega mañana"
                      className="w-full text-xs font-medium pl-8 pr-2.5 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0058bb]"
                    />
                  </div>
                </div>

                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Precio de Envío ($ ARS)
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                      $
                    </span>
                    <input
                      type="number"
                      value={option.price}
                      onChange={(e) =>
                        handleUpdateOption(
                          'gba',
                          idx,
                          'price',
                          Math.max(0, parseInt(e.target.value, 10) || 0)
                        )
                      }
                      className="w-full text-sm font-black text-gray-900 pl-7 pr-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0058bb]"
                    />
                  </div>
                </div>

                <div className="md:col-span-2 flex items-center justify-end">
                  <span
                    className={`text-xs font-bold px-2 py-1 rounded-full ${
                      option.enabled
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {option.enabled ? 'Activo' : 'Desactivado'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ZONA 3: PBA RESTO / SANTA FE / CÓRDOBA */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs">
          <div className="bg-gray-50/80 px-5 py-3.5 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                <h3 className="text-base font-bold text-gray-900">
                  Zona 3: Provincia de Buenos Aires (Interior) / Santa Fe / Córdoba
                </h3>
                <span className="text-xs font-semibold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                  CPs 1900-1999, 2000-3099, 5000-5999, 6000-8199
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Localidades de la Provincia de Buenos Aires fuera del conurbano, Provincia de Santa Fe
                y Provincia de Córdoba.
              </p>
            </div>
          </div>

          <div className="p-5 divide-y divide-gray-100">
            {config.zones.pba_sf_cba.options.map((option, idx) => (
              <div
                key={option.id}
                className={`py-4 first:pt-0 last:pb-0 grid grid-cols-1 md:grid-cols-12 gap-3 items-center ${
                  !option.enabled ? 'opacity-50' : ''
                }`}
              >
                <div className="md:col-span-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`pba_opt_enable_${option.id}`}
                      checked={option.enabled}
                      onChange={(e) =>
                        handleUpdateOption('pba_sf_cba', idx, 'enabled', e.target.checked)
                      }
                      className="w-4 h-4 text-[#0058bb] rounded border-gray-300 focus:ring-[#0058bb]"
                    />
                    <label
                      htmlFor={`pba_opt_enable_${option.id}`}
                      className="text-sm font-bold text-gray-900 cursor-pointer flex items-center gap-1.5"
                    >
                      {option.name}
                      <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded font-bold">
                        CORREO
                      </span>
                    </label>
                  </div>
                  <input
                    type="text"
                    value={option.description}
                    onChange={(e) =>
                      handleUpdateOption('pba_sf_cba', idx, 'description', e.target.value)
                    }
                    placeholder="Descripción visible para el cliente"
                    className="mt-1.5 w-full text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0058bb]"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Tiempo de Entrega
                  </label>
                  <div className="relative">
                    <Clock className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={option.deliveryTime}
                      onChange={(e) =>
                        handleUpdateOption('pba_sf_cba', idx, 'deliveryTime', e.target.value)
                      }
                      placeholder="Ej. Llega 1 a 4 días"
                      className="w-full text-xs font-medium pl-8 pr-2.5 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0058bb]"
                    />
                  </div>
                </div>

                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Precio de Envío ($ ARS)
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                      $
                    </span>
                    <input
                      type="number"
                      value={option.price}
                      onChange={(e) =>
                        handleUpdateOption(
                          'pba_sf_cba',
                          idx,
                          'price',
                          Math.max(0, parseInt(e.target.value, 10) || 0)
                        )
                      }
                      className="w-full text-sm font-black text-gray-900 pl-7 pr-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0058bb]"
                    />
                  </div>
                </div>

                <div className="md:col-span-2 flex items-center justify-end">
                  <span
                    className={`text-xs font-bold px-2 py-1 rounded-full ${
                      option.enabled
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {option.enabled ? 'Activo' : 'Desactivado'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ZONA 4: INTERIOR DEL PAÍS */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs">
          <div className="bg-gray-50/80 px-5 py-3.5 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <h3 className="text-base font-bold text-gray-900">
                  Zona 4: Interior del País (Otras Provincias)
                </h3>
                <span className="text-xs font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                  Resto de Provincias Argentinas
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Mendoza, Tucumán, Salta, Entre Ríos, Chaco, Corrientes, Misiones, San Juan, Jujuy,
                Río Negro, Neuquén, Chubut, etc.
              </p>
            </div>
          </div>

          <div className="p-5 divide-y divide-gray-100">
            {config.zones.resto_pais.options.map((option, idx) => (
              <div
                key={option.id}
                className={`py-4 first:pt-0 last:pb-0 grid grid-cols-1 md:grid-cols-12 gap-3 items-center ${
                  !option.enabled ? 'opacity-50' : ''
                }`}
              >
                <div className="md:col-span-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`resto_opt_enable_${option.id}`}
                      checked={option.enabled}
                      onChange={(e) =>
                        handleUpdateOption('resto_pais', idx, 'enabled', e.target.checked)
                      }
                      className="w-4 h-4 text-[#0058bb] rounded border-gray-300 focus:ring-[#0058bb]"
                    />
                    <label
                      htmlFor={`resto_opt_enable_${option.id}`}
                      className="text-sm font-bold text-gray-900 cursor-pointer flex items-center gap-1.5"
                    >
                      {option.name}
                      <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded font-bold">
                        CORREO
                      </span>
                    </label>
                  </div>
                  <input
                    type="text"
                    value={option.description}
                    onChange={(e) =>
                      handleUpdateOption('resto_pais', idx, 'description', e.target.value)
                    }
                    placeholder="Descripción visible para el cliente"
                    className="mt-1.5 w-full text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0058bb]"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Tiempo de Entrega
                  </label>
                  <div className="relative">
                    <Clock className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={option.deliveryTime}
                      onChange={(e) =>
                        handleUpdateOption('resto_pais', idx, 'deliveryTime', e.target.value)
                      }
                      placeholder="Ej. Llega 1 a 4 días"
                      className="w-full text-xs font-medium pl-8 pr-2.5 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0058bb]"
                    />
                  </div>
                </div>

                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Precio de Envío ($ ARS)
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                      $
                    </span>
                    <input
                      type="number"
                      value={option.price}
                      onChange={(e) =>
                        handleUpdateOption(
                          'resto_pais',
                          idx,
                          'price',
                          Math.max(0, parseInt(e.target.value, 10) || 0)
                        )
                      }
                      className="w-full text-sm font-black text-gray-900 pl-7 pr-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0058bb]"
                    />
                  </div>
                </div>

                <div className="md:col-span-2 flex items-center justify-end">
                  <span
                    className={`text-xs font-bold px-2 py-1 rounded-full ${
                      option.enabled
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {option.enabled ? 'Activo' : 'Desactivado'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* REGLAS O EXCEPCIONES POR CÓDIGO POSTAL ESPECÍFICO */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#0058bb]" />
              Tarifas Especiales por Código Postal Específico
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Si deseas fijar un precio preferencial o una opción especial para un código postal en
              particular (ej. código postal local del local o un cliente frecuente), agrégalo aquí.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsCustomRuleModalOpen(true)}
            className="px-3.5 py-1.5 text-xs font-bold text-[#0058bb] bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            Agregar Tarifa por CP
          </button>
        </div>

        {config.customPostalCodeRules && config.customPostalCodeRules.length > 0 ? (
          <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
            {config.customPostalCodeRules.map((rule) => (
              <div
                key={rule.id}
                className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50/70 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-black text-gray-900 bg-gray-100 px-2.5 py-1 rounded-lg border border-gray-200">
                    CP {rule.postalCode}
                  </span>
                  <div>
                    <div className="text-sm font-bold text-gray-900">{rule.zoneLabel}</div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mt-0.5">
                      {rule.options.map((opt) => (
                        <span key={opt.id} className="font-medium text-emerald-700">
                          {opt.name}: ${opt.price.toLocaleString('es-AR')} ({opt.deliveryTime})
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteCustomRule(rule.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors self-end sm:self-auto cursor-pointer"
                  title="Eliminar regla personalizada"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-gray-400 italic bg-gray-50 p-4 rounded-xl text-center border border-dashed border-gray-200">
            No hay excepciones por código postal individual. Todas las cotizaciones se rigen por las 4
            zonas principales configuradas arriba.
          </div>
        )}
      </div>

      {/* NOTA INFORMATIVA DE CENTRALIZACIÓN */}
      <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-4 flex items-start gap-3 text-xs text-blue-900">
        <ShieldCheck className="w-5 h-5 text-[#0058bb] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold">Sincronización Centralizada Activa</p>
          <p className="text-blue-800 leading-relaxed">
            Cualquier modificación que guardes aquí se sincroniza automáticamente en tiempo real tanto
            para los clientes que compran por el <strong>Checkout web normal</strong> como para los
            que realizan compras directas por el <strong>Enlace de Compra Rápida por WhatsApp</strong>.
          </p>
        </div>
      </div>

      {/* MODAL PARA AGREGAR REGLA ESPECÍFICA */}
      {isCustomRuleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[#0058bb]" />
              Nueva Tarifa por Código Postal
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Código Postal</label>
                <input
                  type="text"
                  value={newRuleCp}
                  onChange={(e) => setNewRuleCp(e.target.value)}
                  placeholder="Ej: 1406"
                  className="w-full text-sm font-bold px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0058bb]"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Nombre descriptivo o Localidad
                </label>
                <input
                  type="text"
                  value={newRuleLabel}
                  onChange={(e) => setNewRuleLabel(e.target.value)}
                  placeholder="Ej: Flores / Zona Local"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0058bb]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Nombre del Método</label>
                  <input
                    type="text"
                    value={newRuleMethodName}
                    onChange={(e) => setNewRuleMethodName(e.target.value)}
                    placeholder="Ej: Moto Express"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0058bb]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Precio ($ ARS)</label>
                  <input
                    type="number"
                    value={newRulePrice}
                    onChange={(e) => setNewRulePrice(parseInt(e.target.value, 10) || 0)}
                    placeholder="7500"
                    className="w-full font-bold px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0058bb]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Tiempo de Entrega</label>
                <input
                  type="text"
                  value={newRuleTime}
                  onChange={(e) => setNewRuleTime(e.target.value)}
                  placeholder="Ej: Llega hoy / En el día"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0058bb]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsCustomRuleModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:text-gray-900 bg-gray-100 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAddCustomRule}
                disabled={!newRuleCp.trim()}
                className="px-4 py-2 text-xs font-bold text-white bg-[#0058bb] hover:bg-[#004696] rounded-xl cursor-pointer disabled:opacity-50"
              >
                Guardar Regla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN PARA RESTABLECER VALORES */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 mx-auto flex items-center justify-center">
              <RotateCcw className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">
                ¿Restablecer tarifas predeterminadas?
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Esto devolverá los precios a las tarifas iniciales ($7.950 Uber Moto, $7.150 Flex
                CABA, $10.250 Flex GBA, etc.) y reactivará todas las opciones.
              </p>
            </div>

            <div className="flex justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(false)}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:text-gray-900 bg-gray-100 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl cursor-pointer"
              >
                Sí, restablecer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
