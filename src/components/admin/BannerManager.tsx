import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  Check,
  RotateCcw,
  Copy,
  ExternalLink,
  Save,
  Image as ImageIcon,
  Sliders,
  Sparkles,
  Info,
  Layers,
  Store,
  CheckCircle2,
  AlertCircle,
  Eye,
  Trash2,
} from 'lucide-react';
import {
  StoreBannersConfig,
  DEFAULT_STORE_BANNERS,
  getStoreBannersConfig,
  fetchStoreBannersFromSupabase,
  saveStoreBannersConfig,
} from '../../services/storeBanners';
import { uploadBannerImage, isSupabaseConfigured } from '../../services/supabase';

export const BannerManager: React.FC = () => {
  const [config, setConfig] = useState<StoreBannersConfig>(() => getStoreBannersConfig());
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // File input refs for each of the 6 images
  const fileInputRefs = {
    heroBanner1: useRef<HTMLInputElement>(null),
    heroBanner2: useRef<HTMLInputElement>(null),
    heroBanner3: useRef<HTMLInputElement>(null),
    secondaryBanner1: useRef<HTMLInputElement>(null),
    secondaryBanner2: useRef<HTMLInputElement>(null),
    showroomImage: useRef<HTMLInputElement>(null),
  };

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

  const handleFileUpload = async (key: keyof StoreBannersConfig, file: File) => {
    if (!file) return;

    try {
      setUploadingKey(key);
      setErrorMessage(null);

      // Subir a Supabase Storage con compresión inteligente WebP
      const publicUrl = await uploadBannerImage(file);

      const updated = {
        ...config,
        [key]: publicUrl,
      };
      setConfig(updated);

      // Guardar automáticamente en Supabase para persistencia inmediata
      await saveStoreBannersConfig(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error al subir banner:', err);
      setErrorMessage(err?.message || 'Error al procesar y subir la imagen. Inténtalo de nuevo.');
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

  const handleReset = async (key: keyof StoreBannersConfig) => {
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
            Administra las imágenes de la pantalla de inicio de tu tienda. Las fotos se almacenan
            permanentemente en Supabase Storage y se sincronizan en computadoras y celulares.
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

      {/* SECCIÓN 1: CARRUSEL PRINCIPAL (3 BANNERS) */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-100 bg-gray-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#0058bb]" />
              <h3 className="text-base font-bold text-gray-900 font-['Montserrat']">
                1. Carrusel Principal de Portada (3 Banners)
              </h3>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Rotación automática cada 3 segundos en la parte superior de la tienda.
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-blue-50 border border-blue-200 text-[#0058bb] text-xs font-semibold w-max">
            <Info className="w-3.5 h-3.5" />
            <span>Tamaño recomendado: <strong>1920 × 700 píxeles</strong></span>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-5">
          <div className="text-xs text-gray-500 bg-gray-50 p-2.5 rounded-lg border border-gray-100 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              <strong>Nota de compatibilidad:</strong> Puedes subir imágenes de cualquier proporción o resolución. El tamaño recomendado (1920×700 px) es la sugerencia ideal para una nitidez óptima sin distorsión.
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Banner 1 */}
            <BannerSlideCard
              index={1}
              badge="Oferta Mayorista"
              title="Banner 1: Precios en Efectivo"
              subtitle="Oferta Mayorista y Transferencia"
              recommendedSize="1920 × 700 px"
              imageUrl={config.heroBanner1}
              showText={config.heroBanner1ShowText !== false}
              isUploading={uploadingKey === 'heroBanner1'}
              isCopied={copiedKey === 'heroBanner1'}
              fileInputRef={fileInputRefs.heroBanner1}
              onUpload={(file) => handleFileUpload('heroBanner1', file)}
              onUrlChange={(url) => setConfig({ ...config, heroBanner1: url })}
              onToggleText={(val) => setConfig({ ...config, heroBanner1ShowText: val })}
              onCopyUrl={() => handleCopyUrl(config.heroBanner1, 'heroBanner1')}
              onReset={() => handleReset('heroBanner1')}
            />

            {/* Banner 2 */}
            <BannerSlideCard
              index={2}
              badge="Envíos Nacionales"
              title="Banner 2: Despacho Inmediato"
              subtitle="Expresos y Retiro en Flores"
              recommendedSize="1920 × 700 px"
              imageUrl={config.heroBanner2}
              showText={config.heroBanner2ShowText !== false}
              isUploading={uploadingKey === 'heroBanner2'}
              isCopied={copiedKey === 'heroBanner2'}
              fileInputRef={fileInputRefs.heroBanner2}
              onUpload={(file) => handleFileUpload('heroBanner2', file)}
              onUrlChange={(url) => setConfig({ ...config, heroBanner2: url })}
              onToggleText={(val) => setConfig({ ...config, heroBanner2ShowText: val })}
              onCopyUrl={() => handleCopyUrl(config.heroBanner2, 'heroBanner2')}
              onReset={() => handleReset('heroBanner2')}
            />

            {/* Banner 3 */}
            <BannerSlideCard
              index={3}
              badge="Precios de Fábrica"
              title="Banner 3: Bulto y Surtido"
              subtitle="40% OFF Mayorista"
              recommendedSize="1920 × 700 px"
              imageUrl={config.heroBanner3}
              showText={config.heroBanner3ShowText !== false}
              isUploading={uploadingKey === 'heroBanner3'}
              isCopied={copiedKey === 'heroBanner3'}
              fileInputRef={fileInputRefs.heroBanner3}
              onUpload={(file) => handleFileUpload('heroBanner3', file)}
              onUrlChange={(url) => setConfig({ ...config, heroBanner3: url })}
              onToggleText={(val) => setConfig({ ...config, heroBanner3ShowText: val })}
              onCopyUrl={() => handleCopyUrl(config.heroBanner3, 'heroBanner3')}
              onReset={() => handleReset('heroBanner3')}
            />
          </div>
        </div>
      </section>

      {/* SECCIÓN 2: BANNERS SECUNDARIOS (2 BANNERS INTERMEDIOS) */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-100 bg-gray-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-600" />
              <h3 className="text-base font-bold text-gray-900 font-['Montserrat']">
                2. Banners Secundarios Intermedios (2 Banners)
              </h3>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Se muestran debajo de "Más Vendidos" en dos columnas divididas.
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold w-max">
            <Info className="w-3.5 h-3.5" />
            <span>Tamaño recomendado: <strong>800 × 400 píxeles (proporción 2:1)</strong></span>
          </div>
        </div>

        <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Banner Secundario 1 (Izquierdo) */}
          <StaticBannerCard
            label="Banner Secundario Izquierdo"
            description="Mercado Mayorista / Accesorios y Dijes"
            recommendedSize="800 × 400 px"
            imageUrl={config.secondaryBanner1}
            isUploading={uploadingKey === 'secondaryBanner1'}
            isCopied={copiedKey === 'secondaryBanner1'}
            fileInputRef={fileInputRefs.secondaryBanner1}
            onUpload={(file) => handleFileUpload('secondaryBanner1', file)}
            onUrlChange={(url) => setConfig({ ...config, secondaryBanner1: url })}
            onCopyUrl={() => handleCopyUrl(config.secondaryBanner1, 'secondaryBanner1')}
            onReset={() => handleReset('secondaryBanner1')}
          />

          {/* Banner Secundario 2 (Derecho) */}
          <StaticBannerCard
            label="Banner Secundario Derecho"
            description="Colección Destacada / Mercado Mayorista"
            recommendedSize="800 × 400 px"
            imageUrl={config.secondaryBanner2}
            isUploading={uploadingKey === 'secondaryBanner2'}
            isCopied={copiedKey === 'secondaryBanner2'}
            fileInputRef={fileInputRefs.secondaryBanner2}
            onUpload={(file) => handleFileUpload('secondaryBanner2', file)}
            onUrlChange={(url) => setConfig({ ...config, secondaryBanner2: url })}
            onCopyUrl={() => handleCopyUrl(config.secondaryBanner2, 'secondaryBanner2')}
            onReset={() => handleReset('secondaryBanner2')}
          />
        </div>
      </section>

      {/* SECCIÓN 3: IMAGEN DE EXHIBICIÓN INFERIOR */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-100 bg-gray-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-600" />
              <h3 className="text-base font-bold text-gray-900 font-['Montserrat']">
                3. Imagen de Exhibición Inferior (Showroom)
              </h3>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Se visualiza en la sección inferior junto a la información de Locales y Depósito.
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-purple-50 border border-purple-200 text-purple-700 text-xs font-semibold w-max">
            <Info className="w-3.5 h-3.5" />
            <span>Tamaño recomendado: <strong>800 × 500 píxeles (proporción 16:10)</strong></span>
          </div>
        </div>

        <div className="p-4 sm:p-6 max-w-2xl">
          <StaticBannerCard
            label="Foto de Exhibición / Showroom"
            description="Muestra el local, vitrina o productos destacados al pie de la página."
            recommendedSize="800 × 500 px"
            imageUrl={config.showroomImage}
            isUploading={uploadingKey === 'showroomImage'}
            isCopied={copiedKey === 'showroomImage'}
            fileInputRef={fileInputRefs.showroomImage}
            onUpload={(file) => handleFileUpload('showroomImage', file)}
            onUrlChange={(url) => setConfig({ ...config, showroomImage: url })}
            onCopyUrl={() => handleCopyUrl(config.showroomImage, 'showroomImage')}
            onReset={() => handleReset('showroomImage')}
          />
        </div>
      </section>
    </div>
  );
};

// -------------------------------------------------------------
// Componente de Tarjeta para cada Slide del Carrusel Principal
// -------------------------------------------------------------
interface BannerSlideCardProps {
  index: number;
  badge: string;
  title: string;
  subtitle: string;
  recommendedSize: string;
  imageUrl: string;
  showText: boolean;
  isUploading: boolean;
  isCopied: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onUpload: (file: File) => void;
  onUrlChange: (url: string) => void;
  onToggleText: (val: boolean) => void;
  onCopyUrl: () => void;
  onReset: () => void;
}

const BannerSlideCard: React.FC<BannerSlideCardProps> = ({
  index,
  badge,
  title,
  subtitle,
  recommendedSize,
  imageUrl,
  showText,
  isUploading,
  isCopied,
  fileInputRef,
  onUpload,
  onUrlChange,
  onToggleText,
  onCopyUrl,
  onReset,
}) => {
  return (
    <div className="bg-gray-50/70 rounded-xl p-3.5 sm:p-4 border border-gray-200 flex flex-col justify-between space-y-3.5">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#0058bb] bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
              Slide #{index} • {badge}
            </span>
            <h4 className="text-sm font-bold text-gray-900 mt-1">{title}</h4>
            <p className="text-xs text-gray-500">{subtitle}</p>
          </div>
        </div>

        {/* Recommended Size Notice */}
        <div className="text-[11px] text-gray-600 bg-white px-2.5 py-1.5 rounded-lg border border-gray-200 flex items-center justify-between mb-3">
          <span>Tamaño recomendado:</span>
          <strong className="text-gray-900 font-semibold">{recommendedSize}</strong>
        </div>

        {/* Preview Container */}
        <div className="relative aspect-[16/7] w-full bg-slate-200 rounded-lg overflow-hidden border border-gray-300 group">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gradient-to-br from-slate-100 to-slate-200 p-3 text-center">
              <ImageIcon className="w-7 h-7 text-gray-400 mb-1" />
              <span className="text-xs font-semibold text-gray-600">Diseño predeterminado</span>
              <span className="text-[10px] text-gray-400">Composición tipográfica con fotos flotantes</span>
            </div>
          )}

          {isUploading && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center text-white text-xs font-bold gap-2">
              <RotateCcw className="w-6 h-6 animate-spin text-blue-400" />
              <span>Subiendo a Supabase...</span>
            </div>
          )}
        </div>

        {/* Overlay Text Toggle */}
        <div className="mt-3 pt-2.5 border-t border-gray-200">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showText}
              onChange={(e) => onToggleText(e.target.checked)}
              className="w-4 h-4 text-[#0058bb] rounded border-gray-300 focus:ring-[#0058bb]"
            />
            <span className="text-xs font-medium text-gray-700">
              Superponer textos y botón sobre la imagen
            </span>
          </label>
          <p className="text-[10px] text-gray-400 ml-6 mt-0.5">
            Desmárcalo si tu imagen de 1920×700 px ya incluye diseño con textos.
          </p>
        </div>

        {/* URL Input & Copy */}
        <div className="mt-3 space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold text-gray-600">URL de la imagen:</label>
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
              placeholder="https://... (o sube un archivo abajo)"
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

      {/* Action Buttons: Subir o Restablecer */}
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
          <span>{imageUrl ? 'Reemplazar Foto' : 'Subir Imagen'}</span>
        </button>

        {imageUrl && (
          <button
            type="button"
            onClick={onReset}
            title="Restablecer diseño inicial"
            className="p-2 bg-white hover:bg-red-50 border border-gray-300 hover:border-red-200 text-gray-500 hover:text-red-600 rounded-lg transition-colors cursor-pointer shrink-0 min-h-[36px]"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
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
  isUploading: boolean;
  isCopied: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onUpload: (file: File) => void;
  onUrlChange: (url: string) => void;
  onCopyUrl: () => void;
  onReset: () => void;
}

const StaticBannerCard: React.FC<StaticBannerCardProps> = ({
  label,
  description,
  recommendedSize,
  imageUrl,
  isUploading,
  isCopied,
  fileInputRef,
  onUpload,
  onUrlChange,
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

        {/* URL Input */}
        <div className="mt-3 space-y-1">
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
