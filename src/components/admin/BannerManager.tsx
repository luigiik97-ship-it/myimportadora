import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  Check,
  RotateCcw,
  Copy,
  ExternalLink,
  Save,
  Image as ImageIcon,
  Sparkles,
  Info,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Plus,
  ArrowUp,
  ArrowDown,
  Link as LinkIcon,
} from 'lucide-react';
import {
  StoreBannersConfig,
  DEFAULT_STORE_BANNERS,
  StoreBannerItem,
  getStoreBannersConfig,
  fetchStoreBannersFromSupabase,
  saveStoreBannersConfig,
  getNormalizedHeroBanners,
} from '../../services/storeBanners';
import { uploadBannerImage, isSupabaseConfigured } from '../../services/supabase';

export const BannerManager: React.FC = () => {
  const [config, setConfig] = useState<StoreBannersConfig>(() => getStoreBannersConfig());
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // File input refs for secondary and showroom images
  const fileInputRefs = {
    secondaryBanner1: useRef<HTMLInputElement>(null),
    secondaryBanner2: useRef<HTMLInputElement>(null),
    showroomImage: useRef<HTMLInputElement>(null),
  };

  // Dinámica de heroBanners
  const heroBanners = getNormalizedHeroBanners(config);

  // Cargar de Supabase al montar
  useEffect(() => {
    fetchStoreBannersFromSupabase()
      .then((remoteConfig) => {
        setConfig(remoteConfig);
      })
      .catch((err) => console.warn('Error sincronizando banners al abrir panel:', err));

    const handleUpdate = (e: CustomEvent<StoreBannersConfig>) => {
      if (e.detail) {
        setConfig(e.detail);
      }
    };

    window.addEventListener('my_commerce_banners_updated' as any, handleUpdate as any);
    return () => {
      window.removeEventListener('my_commerce_banners_updated' as any, handleUpdate as any);
    };
  }, []);

  const handleCopyUrl = (url: string, key: string) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Helper para sincronizar la lista de heroBanners
  const updateHeroBanners = async (newHeroBanners: StoreBannerItem[], autoSave = false) => {
    const updated: StoreBannersConfig = {
      ...config,
      heroBanners: newHeroBanners,
      // Sincronizar compatibilidad con campos clásicos
      heroBanner1: newHeroBanners[0]?.imageUrl || '',
      heroBanner1ShowText: newHeroBanners[0]?.showText,
      heroBanner2: newHeroBanners[1]?.imageUrl || '',
      heroBanner2ShowText: newHeroBanners[1]?.showText,
      heroBanner3: newHeroBanners[2]?.imageUrl || '',
      heroBanner3ShowText: newHeroBanners[2]?.showText,
    };
    setConfig(updated);

    if (autoSave) {
      try {
        await saveStoreBannersConfig(updated);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } catch (err: any) {
        console.error('Error al auto-guardar banners:', err);
      }
    }
  };

  // Agregar nuevo banner a la portada
  const handleAddBanner = () => {
    const newItem: StoreBannerItem = {
      id: `banner-${Date.now()}`,
      imageUrl: '',
      linkUrl: '',
      title: `Banner Promocional #${heroBanners.length + 1}`,
      showText: false,
    };
    updateHeroBanners([...heroBanners, newItem]);
  };

  // Eliminar un banner
  const handleRemoveBanner = (index: number) => {
    if (heroBanners.length <= 1) {
      alert('Debes mantener al menos 1 banner para la portada.');
      return;
    }
    const updated = heroBanners.filter((_, idx) => idx !== index);
    updateHeroBanners(updated);
  };

  // Mover banner hacia arriba o abajo
  const handleMoveBanner = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= heroBanners.length) return;
    const updated = [...heroBanners];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    updateHeroBanners(updated);
  };

  // Actualizar campo específico de un banner
  const handleUpdateBannerField = (index: number, field: keyof StoreBannerItem, value: any) => {
    const updated = [...heroBanners];
    updated[index] = {
      ...updated[index],
      [field]: value,
    };
    updateHeroBanners(updated);
  };

  // Subir archivo de imagen para un banner específico
  const handleHeroBannerFileUpload = async (index: number, file: File) => {
    if (!file) return;

    try {
      setUploadingKey(`heroBanner_${index}`);
      setErrorMessage(null);

      // Subir con compresión y máxima resolución para banners (2560px sin pixelación)
      const publicUrl = await uploadBannerImage(file);

      const updated = [...heroBanners];
      updated[index] = {
        ...updated[index],
        imageUrl: publicUrl,
      };

      await updateHeroBanners(updated, true);
    } catch (err: any) {
      console.error('Error al subir banner:', err);
      setErrorMessage(err?.message || 'Error al procesar y subir la imagen. Inténtalo de nuevo.');
    } finally {
      setUploadingKey(null);
    }
  };

  // Subir imagen estática secundaria
  const handleStaticFileUpload = async (key: 'secondaryBanner1' | 'secondaryBanner2' | 'showroomImage', file: File) => {
    if (!file) return;

    try {
      setUploadingKey(key);
      setErrorMessage(null);

      const publicUrl = await uploadBannerImage(file);
      const updated = {
        ...config,
        [key]: publicUrl,
      };
      setConfig(updated);

      await saveStoreBannersConfig(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error al subir imagen secundaria:', err);
      setErrorMessage(err?.message || 'Error al procesar y subir la imagen.');
    } finally {
      setUploadingKey(null);
    }
  };

  const handleSaveAll = async () => {
    try {
      setIsSaving(true);
      setErrorMessage(null);
      await saveStoreBannersConfig(config);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error al guardar configuración de banners:', err);
      setErrorMessage('No se pudo sincronizar con Supabase. Verifica tu conexión.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetStatic = async (key: 'secondaryBanner1' | 'secondaryBanner2' | 'showroomImage') => {
    const defaultVal = DEFAULT_STORE_BANNERS[key];
    const updated = {
      ...config,
      [key]: defaultVal,
    };
    setConfig(updated);
    await saveStoreBannersConfig(updated);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const isConnected = isSupabaseConfigured();

  return (
    <div id="admin-banner-manager" className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white rounded-xl p-4 sm:p-5 border border-gray-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-blue-50 text-[#0058bb] rounded-lg">
              <ImageIcon className="w-5 h-5" />
            </span>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 font-['Montserrat']">
              Banners y Portada
            </h2>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                isConnected
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              {isConnected ? 'Sincronizado en Supabase' : 'Almacenamiento Local'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-1 max-w-2xl">
            Administra las imágenes de portada de tu tienda en alta definición. Si tienes 1 imagen se mostrará como banner estático; si tienes 2 o más imágenes se convertirá automáticamente en un carrusel dinámico. Además puedes asignar un link de destino a cada banner.
          </p>
        </div>

        {/* Global Save Button */}
        <div className="flex items-center gap-3 shrink-0">
          {saveSuccess && (
            <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1.5 animate-in fade-in duration-300">
              <CheckCircle2 className="w-4 h-4" />
              ¡Guardado y sincronizado!
            </span>
          )}
          <button
            onClick={handleSaveAll}
            disabled={isSaving}
            className="inline-flex items-center gap-2 bg-[#0058bb] hover:bg-[#004494] disabled:bg-blue-300 text-white text-xs sm:text-sm font-bold px-4 sm:px-5 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer min-h-[42px]"
          >
            {isSaving ? (
              <RotateCcw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{isSaving ? 'Guardando...' : 'Guardar Cambios'}</span>
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs sm:text-sm flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* SECCIÓN 1: BANNERS PRINCIPALES DE PORTADA (DINÁMICO: 1 = ESTÁTICO, 2+ = CARRUSEL) */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-100 bg-gray-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#0058bb]" />
              <h3 className="text-base font-bold text-gray-900 font-['Montserrat']">
                1. Banners Principales de Portada
              </h3>
              <span className={`text-xs px-2.5 py-0.5 rounded-md font-semibold ${
                heroBanners.length === 1
                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                  : 'bg-blue-50 text-[#0058bb] border border-blue-200'
              }`}>
                {heroBanners.length === 1
                  ? 'Modo: Banner Estático (1 imagen)'
                  : `Modo: Carrusel Dinámico (${heroBanners.length} imágenes)`}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {heroBanners.length === 1
                ? 'Con 1 sola imagen cargada, el banner permanece fijo y nítido en la parte superior.'
                : 'Con 2 o más imágenes, rota automáticamente cada 3.5 segundos y permite deslizar con el dedo o mouse.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleAddBanner}
              className="inline-flex items-center gap-1.5 bg-[#0058bb] hover:bg-[#004494] text-white text-xs font-bold px-3.5 py-2 rounded-lg shadow-2xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar Banner</span>
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-5">
          {/* Banner Quality Info */}
          <div className="text-xs text-blue-900 bg-blue-50/80 p-3 rounded-xl border border-blue-200/70 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">
                Corrección de nitidez en alta definición (2560px sin pixelación)
              </p>
              <p className="text-blue-800 text-[11px] leading-relaxed">
                Al subir tus imágenes se procesan con compresión fotográfica de alta resolución (hasta 2560px) para que no pierdan nitidez ni se vean borrosas en computadoras o celulares. Para cada banner puedes definir un link de destino donde los clientes serán redirigidos al tocarlo.
              </p>
            </div>
          </div>

          {/* Grid de Banners Dinámicos */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {heroBanners.map((banner, index) => {
              const fileInputId = `hero-banner-input-${index}`;
              const isUploading = uploadingKey === `heroBanner_${index}`;
              const isCopied = copiedKey === `heroBanner_${index}`;

              return (
                <div
                  key={banner.id || `banner-card-${index}`}
                  className="bg-gray-50/70 rounded-xl p-4 border border-gray-200 flex flex-col justify-between space-y-3.5 relative hover:border-gray-300 transition-all"
                >
                  <div>
                    {/* Top Row: Badge, Move Controls, Remove Button */}
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#0058bb] bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                          {heroBanners.length === 1 ? 'Banner Fijo' : `Slide #${index + 1}`}
                        </span>
                        {banner.linkUrl && (
                          <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 flex items-center gap-0.5">
                            <LinkIcon className="w-2.5 h-2.5" /> Link activo
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        {/* Move Up */}
                        <button
                          type="button"
                          onClick={() => handleMoveBanner(index, 'up')}
                          disabled={index === 0}
                          title="Subir posición"
                          className="p-1 text-gray-500 hover:text-[#0058bb] disabled:text-gray-300 disabled:cursor-not-allowed hover:bg-white rounded border border-transparent hover:border-gray-200 cursor-pointer"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>

                        {/* Move Down */}
                        <button
                          type="button"
                          onClick={() => handleMoveBanner(index, 'down')}
                          disabled={index === heroBanners.length - 1}
                          title="Bajar posición"
                          className="p-1 text-gray-500 hover:text-[#0058bb] disabled:text-gray-300 disabled:cursor-not-allowed hover:bg-white rounded border border-transparent hover:border-gray-200 cursor-pointer"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Banner */}
                        {heroBanners.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveBanner(index)}
                            title="Eliminar este banner"
                            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded border border-transparent hover:border-red-200 cursor-pointer ml-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Preview Box */}
                    <div className="relative aspect-[16/7] w-full bg-slate-200 rounded-lg overflow-hidden border border-gray-300 group">
                      {banner.imageUrl ? (
                        <img
                          src={banner.imageUrl}
                          alt={banner.title || `Banner ${index + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gradient-to-br from-slate-100 to-slate-200 p-3 text-center">
                          <ImageIcon className="w-7 h-7 text-gray-400 mb-1" />
                          <span className="text-xs font-semibold text-gray-600">Sin imagen</span>
                          <span className="text-[10px] text-gray-400">Sube una foto abajo</span>
                        </div>
                      )}

                      {isUploading && (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center text-white text-xs font-bold gap-2">
                          <RotateCcw className="w-6 h-6 animate-spin text-blue-400" />
                          <span>Subiendo en alta resolución...</span>
                        </div>
                      )}
                    </div>

                    {/* Link de Destino al hacer clic */}
                    <div className="mt-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-semibold text-gray-700 flex items-center gap-1">
                          <LinkIcon className="w-3 h-3 text-[#0058bb]" />
                          Link al hacer clic en el banner:
                        </label>
                        {banner.linkUrl && (
                          <a
                            href={banner.linkUrl.startsWith('http') || banner.linkUrl.startsWith('wa.me') ? (banner.linkUrl.startsWith('wa.me') ? `https://${banner.linkUrl}` : banner.linkUrl) : '#'}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] text-[#0058bb] hover:underline flex items-center gap-0.5"
                          >
                            Probar link <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                      <input
                        type="text"
                        value={banner.linkUrl || ''}
                        onChange={(e) => handleUpdateBannerField(index, 'linkUrl', e.target.value)}
                        placeholder="ej: https://... o https://wa.me/54911... o Todo"
                        className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-gray-300 bg-white focus:border-[#0058bb] focus:ring-1 focus:ring-[#0058bb] outline-none"
                      />
                      <p className="text-[10px] text-gray-400">
                        Al tocar este banner en la tienda, llevará a este enlace o categoría.
                      </p>
                    </div>

                    {/* URL de la Imagen */}
                    <div className="mt-2.5 space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-semibold text-gray-600">URL directa de imagen:</label>
                        {banner.imageUrl && (
                          <a
                            href={banner.imageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] text-[#0058bb] hover:underline flex items-center gap-0.5"
                          >
                            Ver original <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={banner.imageUrl || ''}
                          onChange={(e) => handleUpdateBannerField(index, 'imageUrl', e.target.value)}
                          placeholder="https://... o sube una imagen abajo"
                          className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-gray-300 bg-white focus:border-[#0058bb] focus:ring-1 focus:ring-[#0058bb] outline-none"
                        />
                        {banner.imageUrl && (
                          <button
                            type="button"
                            onClick={() => handleCopyUrl(banner.imageUrl, `heroBanner_${index}`)}
                            title="Copiar enlace de imagen"
                            className="px-2 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg text-gray-600 transition-colors cursor-pointer shrink-0"
                          >
                            {isCopied ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Etiqueta identificatoria opcional */}
                    <div className="mt-2.5 space-y-1">
                      <label className="text-[11px] font-semibold text-gray-600">Nombre interno / Etiqueta (opcional):</label>
                      <input
                        type="text"
                        value={banner.title || ''}
                        onChange={(e) => handleUpdateBannerField(index, 'title', e.target.value)}
                        placeholder="ej: Oferta Mayorista, Despacho Inmediato..."
                        className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-gray-300 bg-white focus:border-[#0058bb] focus:ring-1 focus:ring-[#0058bb] outline-none"
                      />
                    </div>
                  </div>

                  {/* Botón para Subir Foto */}
                  <div className="pt-2 flex items-center gap-2">
                    <input
                      id={fileInputId}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleHeroBannerFileUpload(index, file);
                          e.target.value = '';
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => document.getElementById(fileInputId)?.click()}
                      disabled={isUploading}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 bg-white hover:bg-gray-50 border border-gray-300 text-gray-800 text-xs font-bold py-2 px-3 rounded-lg shadow-2xs hover:border-[#0058bb] transition-all cursor-pointer min-h-[36px]"
                    >
                      <Upload className="w-3.5 h-3.5 text-[#0058bb]" />
                      <span>{banner.imageUrl ? 'Reemplazar Foto' : 'Subir Imagen'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Action to Add Another Banner */}
          <div className="pt-2 flex justify-center">
            <button
              onClick={handleAddBanner}
              className="inline-flex items-center gap-2 bg-white hover:bg-blue-50 border-2 border-dashed border-[#0058bb]/40 hover:border-[#0058bb] text-[#0058bb] text-xs sm:text-sm font-bold px-6 py-3 rounded-xl transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar otra imagen a la portada</span>
            </button>
          </div>
        </div>
      </section>

      {/* SECCIÓN 2: BANNERS SECUNDARIOS (2 BANNERS INTERMEDIOS) */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-100 bg-gray-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
              <h3 className="text-base font-bold text-gray-900 font-['Montserrat']">
                2. Banners Secundarios Intermedios (2 Banners)
              </h3>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Se muestran debajo de "Más Vendidos" en dos columnas divididas con soporte de link directo.
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold w-max">
            <Info className="w-3.5 h-3.5" />
            <span>Tamaño recomendado: <strong>800 × 400 píxeles</strong></span>
          </div>
        </div>

        <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Banner Secundario 1 (Izquierdo) */}
          <StaticBannerCard
            label="Banner Intermedio 1 (Izquierdo)"
            description="Ubicado en la columna izquierda intermedia."
            recommendedSize="800 × 400 px"
            imageUrl={config.secondaryBanner1}
            linkUrl={config.secondaryBanner1Link || ''}
            isUploading={uploadingKey === 'secondaryBanner1'}
            isCopied={copiedKey === 'secondaryBanner1'}
            fileInputRef={fileInputRefs.secondaryBanner1}
            onUpload={(file) => handleStaticFileUpload('secondaryBanner1', file)}
            onUrlChange={(url) => setConfig({ ...config, secondaryBanner1: url })}
            onLinkUrlChange={(link) => setConfig({ ...config, secondaryBanner1Link: link })}
            onCopyUrl={() => handleCopyUrl(config.secondaryBanner1, 'secondaryBanner1')}
            onReset={() => handleResetStatic('secondaryBanner1')}
          />

          {/* Banner Secundario 2 (Derecho) */}
          <StaticBannerCard
            label="Banner Intermedio 2 (Derecho)"
            description="Ubicado en la columna derecha intermedia."
            recommendedSize="800 × 400 px"
            imageUrl={config.secondaryBanner2}
            linkUrl={config.secondaryBanner2Link || ''}
            isUploading={uploadingKey === 'secondaryBanner2'}
            isCopied={copiedKey === 'secondaryBanner2'}
            fileInputRef={fileInputRefs.secondaryBanner2}
            onUpload={(file) => handleStaticFileUpload('secondaryBanner2', file)}
            onUrlChange={(url) => setConfig({ ...config, secondaryBanner2: url })}
            onLinkUrlChange={(link) => setConfig({ ...config, secondaryBanner2Link: link })}
            onCopyUrl={() => handleCopyUrl(config.secondaryBanner2, 'secondaryBanner2')}
            onReset={() => handleResetStatic('secondaryBanner2')}
          />
        </div>
      </section>

      {/* SECCIÓN 3: FOTO DE EXHIBICIÓN / SHOWROOM */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-100 bg-gray-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
              <h3 className="text-base font-bold text-gray-900 font-['Montserrat']">
                3. Imagen de Exhibición / Showroom
              </h3>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Se ubica en la sección de información comercial al pie de la página de inicio.
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-purple-50 border border-purple-200 text-purple-700 text-xs font-semibold w-max">
            <Info className="w-3.5 h-3.5" />
            <span>Tamaño recomendado: <strong>600 × 400 píxeles</strong></span>
          </div>
        </div>

        <div className="p-4 sm:p-6 max-w-xl">
          <StaticBannerCard
            label="Foto de Exhibición"
            description="Muestra el local, la mesa de exhibición o productos destacados en el bloque inferior."
            recommendedSize="600 × 400 px"
            imageUrl={config.showroomImage}
            linkUrl={config.showroomImageLink || ''}
            isUploading={uploadingKey === 'showroomImage'}
            isCopied={copiedKey === 'showroomImage'}
            fileInputRef={fileInputRefs.showroomImage}
            onUpload={(file) => handleStaticFileUpload('showroomImage', file)}
            onUrlChange={(url) => setConfig({ ...config, showroomImage: url })}
            onLinkUrlChange={(link) => setConfig({ ...config, showroomImageLink: link })}
            onCopyUrl={() => handleCopyUrl(config.showroomImage, 'showroomImage')}
            onReset={() => handleResetStatic('showroomImage')}
          />
        </div>
      </section>
    </div>
  );
};

// -------------------------------------------------------------
// Componente de Tarjeta para Banners Secundarios y Exhibición
// -------------------------------------------------------------
interface StaticBannerCardProps {
  label: string;
  description: string;
  recommendedSize: string;
  imageUrl: string;
  linkUrl: string;
  isUploading: boolean;
  isCopied: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onUpload: (file: File) => void;
  onUrlChange: (url: string) => void;
  onLinkUrlChange: (link: string) => void;
  onCopyUrl: () => void;
  onReset: () => void;
}

const StaticBannerCard: React.FC<StaticBannerCardProps> = ({
  label,
  description,
  recommendedSize,
  imageUrl,
  linkUrl,
  isUploading,
  isCopied,
  fileInputRef,
  onUpload,
  onUrlChange,
  onLinkUrlChange,
  onCopyUrl,
  onReset,
}) => {
  return (
    <div className="bg-gray-50/70 rounded-xl p-4 border border-gray-200 flex flex-col justify-between space-y-3.5">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <h4 className="text-sm font-bold text-gray-900">{label}</h4>
          <span className="text-[11px] font-semibold text-gray-700 bg-white px-2 py-0.5 rounded border border-gray-200">
            {recommendedSize}
          </span>
        </div>
        <p className="text-xs text-gray-500 mb-3">{description}</p>

        {/* Thumbnail Preview */}
        <div className="relative aspect-[16/9] w-full bg-slate-200 rounded-lg overflow-hidden border border-gray-300 group">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={label}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
              <ImageIcon className="w-8 h-8 text-gray-300 mb-1" />
              <span className="text-xs">Sin imagen configurada</span>
            </div>
          )}

          {isUploading && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center text-white text-xs font-bold gap-2">
              <RotateCcw className="w-6 h-6 animate-spin text-blue-400" />
              <span>Subiendo a Supabase...</span>
            </div>
          )}
        </div>

        {/* Link Input */}
        <div className="mt-3 space-y-1">
          <label className="text-[11px] font-semibold text-gray-700 flex items-center gap-1">
            <LinkIcon className="w-3 h-3 text-[#0058bb]" />
            Link al hacer clic:
          </label>
          <input
            type="text"
            value={linkUrl}
            onChange={(e) => onLinkUrlChange(e.target.value)}
            placeholder="ej: https://... o Todo"
            className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-gray-300 bg-white focus:border-[#0058bb] focus:ring-1 focus:ring-[#0058bb] outline-none"
          />
        </div>

        {/* URL Input */}
        <div className="mt-2.5 space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold text-gray-600">URL pública:</label>
            {imageUrl && (
              <a
                href={imageUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-[#0058bb] hover:underline flex items-center gap-0.5"
              >
                Abrir <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
          </div>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={imageUrl}
              onChange={(e) => onUrlChange(e.target.value)}
              placeholder="https://... (o sube una imagen)"
              className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-gray-300 bg-white focus:border-[#0058bb] focus:ring-1 focus:ring-[#0058bb] outline-none"
            />
            {imageUrl && (
              <button
                type="button"
                onClick={onCopyUrl}
                title="Copiar enlace"
                className="px-2.5 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg text-gray-600 transition-colors cursor-pointer shrink-0"
              >
                {isCopied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="pt-2 flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              onUpload(file);
              e.target.value = '';
            }
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="flex-1 inline-flex items-center justify-center gap-1.5 bg-white hover:bg-gray-50 border border-gray-300 text-gray-800 text-xs font-bold py-2 px-3 rounded-lg shadow-2xs hover:border-[#0058bb] transition-all cursor-pointer min-h-[36px]"
        >
          <Upload className="w-3.5 h-3.5 text-[#0058bb]" />
          <span>{imageUrl ? 'Reemplazar Imagen' : 'Subir Imagen'}</span>
        </button>

        {imageUrl && (
          <button
            type="button"
            onClick={onReset}
            title="Restablecer a imagen predeterminada"
            className="p-2 bg-white hover:bg-red-50 border border-gray-300 hover:border-red-200 text-gray-500 hover:text-red-600 rounded-lg transition-colors cursor-pointer shrink-0 min-h-[36px]"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
