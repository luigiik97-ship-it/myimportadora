import React, { useState, useEffect } from 'react';
import {
  getStoreSettings,
  saveStoreSettings,
  fetchStoreSettingsFromSupabase,
  StoreSettings
} from '../../services/storeSettings';
import {
  ShoppingBag,
  Check,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Cloud,
  Sparkles,
  Smartphone,
  Save,
  RotateCw
} from 'lucide-react';

export const StoreSettingsManager: React.FC = () => {
  const [settings, setSettings] = useState<StoreSettings>(() => getStoreSettings());
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // Sincronizar desde la nube al cargar el componente
    fetchStoreSettingsFromSupabase()
      .then((remote) => {
        setSettings(remote);
      })
      .catch((err) => {
        console.warn('Error fetching store settings:', err);
      });

    const handleUpdate = (e: CustomEvent<StoreSettings>) => {
      if (e.detail) {
        setSettings(e.detail);
      }
    };
    window.addEventListener('my_commerce_store_settings_updated' as any, handleUpdate);
    return () => {
      window.removeEventListener('my_commerce_store_settings_updated' as any, handleUpdate);
    };
  }, []);

  const handleToggleBuyNow = async (enabled: boolean) => {
    setErrorMessage(null);
    setSaveSuccess(false);
    setIsSaving(true);
    try {
      const updated = await saveStoreSettings({ showBuyNowButton: enabled });
      setSettings(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error al guardar la configuración');
    } finally {
      setIsSaving(false);
    }
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      const remote = await fetchStoreSettingsFromSupabase();
      setSettings(remote);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#0058bb] flex items-center justify-center font-bold">
              <ShoppingBag className="w-4.5 h-4.5" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 font-['Montserrat']">
              Botones y Funciones de Tienda
            </h2>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
              <Cloud className="w-3 h-3 text-emerald-600" />
              Sincronizado con Vercel
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-600 max-w-2xl">
            Gestiona la visibilidad de los botones de compra en la ficha de producto. Los cambios se guardan directamente en la base de datos de Supabase y se aplican en tiempo real en la tienda publicada en Vercel.
          </p>
        </div>

        <button
          type="button"
          onClick={handleManualRefresh}
          disabled={isRefreshing}
          className="self-start sm:self-auto shrink-0 inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all cursor-pointer"
          title="Recargar desde la base de datos"
        >
          <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>{isRefreshing ? 'Actualizando...' : 'Recargar'}</span>
        </button>
      </div>

      {/* Success Notification */}
      {saveSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-3.5 flex items-center gap-2.5 text-xs sm:text-sm font-medium animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>
            ¡Configuración guardada exitosamente! El botón &quot;Comprar ahora&quot; ha sido actualizado y se refleja en la tienda publicada en Vercel.
          </span>
        </div>
      )}

      {/* Error Notification */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-3.5 flex items-center gap-2.5 text-xs sm:text-sm font-medium animate-fadeIn">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Setting Box */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-gray-100">
          <div className="space-y-1 max-w-lg">
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-gray-900">
                Botón &quot;Comprar ahora&quot; en Ficha de Producto
              </h3>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                  settings.showBuyNowButton
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {settings.showBuyNowButton ? (
                  <>
                    <Eye className="w-3.5 h-3.5 text-emerald-600" />
                    Visible
                  </>
                ) : (
                  <>
                    <EyeOff className="w-3.5 h-3.5 text-gray-500" />
                    Oculto
                  </>
                )}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">
              Define si en la página de detalle de cada producto aparece el botón azul directo de <strong>&quot;Comprar ahora&quot;</strong> (que lleva de inmediato al cliente a finalizar compra) o si prefieres ocultarlo para que el cliente compre siempre mediante <strong>&quot;Agregar al carrito&quot;</strong>.
            </p>
          </div>

          {/* Toggle Switch */}
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                checked={settings.showBuyNowButton}
                onChange={(e) => handleToggleBuyNow(e.target.checked)}
                disabled={isSaving}
                className="sr-only peer"
              />
              <div className="w-14 h-8 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[3px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-7 after:w-7 after:transition-all peer-checked:bg-[#0058bb]"></div>
            </label>
            <span className="text-xs sm:text-sm font-bold text-gray-800 min-w-[70px]">
              {settings.showBuyNowButton ? 'Activado' : 'Desactivado'}
            </span>
          </div>
        </div>

        {/* Live Mockup / Visual Preview */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs sm:text-sm font-bold text-gray-800 flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-gray-500" />
              Vista previa interactiva en la ficha de producto:
            </h4>
            <span className="text-[11px] text-gray-500">
              Así verán los clientes los botones en la tienda
            </span>
          </div>

          <div className="bg-gray-50/80 border border-gray-200 rounded-xl p-4 sm:p-5 max-w-md mx-auto sm:mx-0">
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between text-xs text-gray-500 border-b border-gray-100 pb-2">
                <span className="font-semibold text-gray-700">Ejemplo: Cadena Cubana 10mm</span>
                <span className="font-bold text-gray-900">$ 24.500</span>
              </div>

              {/* Mockup Action Buttons */}
              <div className="space-y-2 pt-1">
                {settings.showBuyNowButton && (
                  <div className="w-full bg-[#0058bb] text-white font-bold py-2.5 px-4 rounded-xl text-xs sm:text-sm text-center shadow-xs flex items-center justify-center gap-1.5 transition-all animate-fadeIn">
                    <span>Comprar ahora</span>
                  </div>
                )}

                <div
                  className={`w-full font-bold py-2.5 px-4 rounded-xl text-xs sm:text-sm text-center flex items-center justify-center gap-1.5 transition-all ${
                    !settings.showBuyNowButton
                      ? 'bg-[#0058bb] text-white shadow-xs'
                      : 'bg-white hover:bg-blue-50/50 text-[#0058bb] border-2 border-[#0058bb]'
                  }`}
                >
                  <span>Agregar al carrito</span>
                </div>
              </div>

              <div className="text-[11px] text-center text-gray-400 pt-1">
                {settings.showBuyNowButton
                  ? '✓ Ambos botones están disponibles para el cliente.'
                  : '✓ El botón "Comprar ahora" está oculto. Solo se muestra "Agregar al carrito".'}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Action buttons */}
        <div className="pt-2 flex flex-wrap items-center gap-2.5 border-t border-gray-100">
          <button
            type="button"
            onClick={() => handleToggleBuyNow(true)}
            disabled={isSaving || settings.showBuyNowButton}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              settings.showBuyNowButton
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 opacity-60 cursor-default'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
            }`}
          >
            <Check className="w-3.5 h-3.5" />
            Mostrar &quot;Comprar ahora&quot;
          </button>

          <button
            type="button"
            onClick={() => handleToggleBuyNow(false)}
            disabled={isSaving || !settings.showBuyNowButton}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              !settings.showBuyNowButton
                ? 'bg-amber-50 text-amber-800 border border-amber-200 opacity-60 cursor-default'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
            }`}
          >
            <EyeOff className="w-3.5 h-3.5" />
            Ocultar &quot;Comprar ahora&quot;
          </button>
        </div>
      </div>
    </div>
  );
};
