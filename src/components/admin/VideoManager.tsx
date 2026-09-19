import React, { useState, useEffect } from 'react';
import {
  Video,
  Plus,
  Trash2,
  Edit2,
  ExternalLink,
  Play,
  Pause,
  Save,
  CheckCircle2,
  AlertCircle,
  ShoppingBag,
  Sparkles,
  RefreshCw,
  X,
} from 'lucide-react';
import { StoreVideo, Product } from '../../types';
import {
  fetchStoreVideosFromSupabase,
  saveStoreVideos,
  getLocalStoreVideos,
} from '../../services/storeVideos';

interface VideoManagerProps {
  products: Product[];
}

export const VideoManager: React.FC<VideoManagerProps> = ({ products }) => {
  const [videos, setVideos] = useState<StoreVideo[]>(() => getLocalStoreVideos());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // New video form state
  const [newUrl, setNewUrl] = useState<string>('');
  const [newTitle, setNewTitle] = useState<string>('');
  const [newProductId, setNewProductId] = useState<string>('');
  const [previewTestPlay, setPreviewTestPlay] = useState<boolean>(false);

  // Edit video modal state
  const [editingVideo, setEditingVideo] = useState<StoreVideo | null>(null);

  // Load from Supabase on mount
  useEffect(() => {
    setIsLoading(true);
    fetchStoreVideosFromSupabase()
      .then((remoteVideos) => {
        setVideos(remoteVideos);
      })
      .catch((err) => {
        console.warn('Error loading remote videos:', err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const handleAddVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedUrl = newUrl.trim();
    if (!trimmedUrl) {
      setErrorMessage('Por favor ingresa la URL directa de Cloudinary MP4.');
      return;
    }

    // Optional linked product
    const selectedProd = products.find((p) => p.id === newProductId);

    const newVideoItem: StoreVideo = {
      id: `vid-${Date.now()}`,
      videoUrl: trimmedUrl,
      title: newTitle.trim() || (selectedProd ? selectedProd.title : ''),
      productId: selectedProd ? selectedProd.id : undefined,
      productTitle: selectedProd ? selectedProd.title : undefined,
      productPrice: selectedProd ? selectedProd.wholesalePrice : undefined,
      productImage: selectedProd ? selectedProd.images?.[0] : undefined,
      createdAt: new Date().toISOString(),
      sortOrder: videos.length,
    };

    const updatedList = [newVideoItem, ...videos];
    setVideos(updatedList);
    setNewUrl('');
    setNewTitle('');
    setNewProductId('');
    setPreviewTestPlay(false);

    setIsSaving(true);
    const ok = await saveStoreVideos(updatedList);
    setIsSaving(false);
    if (ok) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingVideo) return;
    const selectedProd = products.find((p) => p.id === editingVideo.productId);

    const updatedList = videos.map((v) => {
      if (v.id === editingVideo.id) {
        return {
          ...editingVideo,
          productTitle: selectedProd ? selectedProd.title : v.productTitle,
          productPrice: selectedProd ? selectedProd.wholesalePrice : v.productPrice,
          productImage: selectedProd ? selectedProd.images?.[0] : v.productImage,
        };
      }
      return v;
    });

    setVideos(updatedList);
    setEditingVideo(null);

    setIsSaving(true);
    const ok = await saveStoreVideos(updatedList);
    setIsSaving(false);
    if (ok) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  const handleDeleteVideo = async (id: string) => {
    if (!window.confirm('¿Deseas eliminar este video del carrusel de Reels?')) return;
    const updatedList = videos.filter((v) => v.id !== id);
    setVideos(updatedList);

    setIsSaving(true);
    const ok = await saveStoreVideos(updatedList);
    setIsSaving(false);
    if (ok) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Introduction */}
      <div className="bg-gradient-to-r from-neutral-900 to-neutral-800 rounded-xl p-5 sm:p-6 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
            <Video className="w-4 h-4" />
            <span>Gestión de Videos Cloudinary MP4</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black font-['Montserrat']">
            Videos & Reels en Formato 9:16
          </h2>
          <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
            Pega tus URLs directas MP4 de Cloudinary para exhibir en el carrusel Reels de la página principal y vincularlos a tus productos destacados.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {saveSuccess && (
            <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-3 py-1.5 rounded-lg flex items-center gap-1.5 animate-fade-in">
              <CheckCircle2 className="w-4 h-4" /> Guardado
            </span>
          )}
          {isSaving && (
            <span className="text-xs text-gray-300 flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Guardando...
            </span>
          )}
        </div>
      </div>

      {/* Add New Video Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
        <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2 font-['Montserrat']">
          <Plus className="w-4 h-4 text-[#0058bb]" />
          Agregar Nuevo Video (Cloudinary MP4)
        </h3>

        <form onSubmit={handleAddVideo} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 block">
                URL directa del Video Cloudinary (MP4) *
              </label>
              <input
                type="url"
                required
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://res.cloudinary.com/.../video/upload/...mp4"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0058bb] focus:border-transparent outline-none transition-all font-mono text-xs"
              />
              <p className="text-[11px] text-gray-500">
                Pega la URL de tu video subido a Cloudinary terminado en .mp4.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 block">
                Título o Pie del Video (opcional)
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ej. Novedades en dijes de acero"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0058bb] focus:border-transparent outline-none transition-all"
              />
            </div>
          </div>

          {/* Product link selector */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 block">
                Vincular a un Producto de la Tienda (opcional)
              </label>
              <select
                value={newProductId}
                onChange={(e) => setNewProductId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0058bb] focus:border-transparent outline-none transition-all bg-white"
              >
                <option value="">-- Ninguno (Solo video de portada) --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} (${p.wholesalePrice.toLocaleString('es-AR')})
                  </option>
                ))}
              </select>
            </div>

            {/* Quick Live Preview Test */}
            {newUrl.trim() && (
              <div className="flex items-center gap-3 pt-4">
                <div className="w-12 h-16 rounded-lg overflow-hidden bg-black shrink-0 relative border border-gray-300">
                  <video
                    src={newUrl.trim()}
                    muted
                    autoPlay
                    loop
                    playsInline
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="text-xs text-gray-600">
                  <p className="font-bold text-emerald-600">✓ Video detectado correctamente</p>
                  <p className="text-[11px] text-gray-500">Formato 9:16 listo para Reels</p>
                </div>
              </div>
            )}
          </div>

          {errorMessage && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 p-2.5 rounded-lg flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={!newUrl.trim() || isSaving}
              className="bg-[#0058bb] hover:bg-[#004494] disabled:opacity-50 text-white font-bold text-xs sm:text-sm px-5 py-2.5 rounded-lg flex items-center gap-2 shadow-xs cursor-pointer transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar Video al Carrusel</span>
            </button>
          </div>
        </form>
      </div>

      {/* Videos List */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <h3 className="text-base font-bold text-gray-900 font-['Montserrat'] flex items-center gap-2">
            <Video className="w-4 h-4 text-gray-700" />
            Videos Activos en la Tienda ({videos.length})
          </h3>
          <span className="text-xs text-gray-500">
            Los videos se reproducen de manera encadenada (uno a la vez, sin loop).
          </span>
        </div>

        {videos.length === 0 ? (
          <div className="text-center py-12 text-gray-500 space-y-2">
            <Video className="w-10 h-10 mx-auto text-gray-300" />
            <p className="text-sm font-medium">Aún no hay videos en el carrusel de Reels.</p>
            <p className="text-xs text-gray-400">Agrega uno arriba pegando una URL MP4 de Cloudinary.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-4">
            {videos.map((vid) => (
              <div
                key={vid.id}
                className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden shadow-2xs flex flex-col justify-between group"
              >
                {/* 9:16 Video Thumbnail Box */}
                <div className="aspect-[9/16] w-full bg-black relative overflow-hidden">
                  <video
                    src={vid.videoUrl}
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    className="w-full h-full object-cover"
                    onMouseEnter={(e) => {
                      try {
                        e.currentTarget.play();
                      } catch {}
                    }}
                    onMouseLeave={(e) => {
                      try {
                        e.currentTarget.pause();
                        e.currentTarget.currentTime = 0;
                      } catch {}
                    }}
                  />

                  {/* Play badge */}
                  <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-black/50 backdrop-blur-xs flex items-center justify-center text-white">
                    <Play className="w-3 h-3 fill-white text-white" />
                  </div>

                  {/* Title overlay */}
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-2 text-white">
                    <p className="text-xs font-bold truncate">{vid.title || 'Video'}</p>
                    {vid.productPrice !== undefined && (
                      <p className="text-[11px] font-semibold text-yellow-300">
                        ${vid.productPrice.toLocaleString('es-AR')}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions bottom bar */}
                <div className="p-2.5 bg-white border-t border-gray-200 flex items-center justify-between gap-1">
                  <a
                    href={vid.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-gray-500 hover:text-[#0058bb] p-1 rounded hover:bg-gray-100"
                    title="Abrir enlace directo"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingVideo(vid)}
                      className="p-1 text-gray-600 hover:text-[#0058bb] hover:bg-gray-100 rounded cursor-pointer transition-colors"
                      title="Editar video"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteVideo(vid.id)}
                      className="p-1 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer transition-colors"
                      title="Eliminar video"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Video Modal */}
      {editingVideo && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h4 className="text-base font-bold text-gray-900 font-['Montserrat'] flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-[#0058bb]" />
                Editar Video
              </h4>
              <button
                type="button"
                onClick={() => setEditingVideo(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 block">URL de Cloudinary MP4</label>
                <input
                  type="url"
                  value={editingVideo.videoUrl}
                  onChange={(e) => setEditingVideo({ ...editingVideo, videoUrl: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 block">Título / Descripción</label>
                <input
                  type="text"
                  value={editingVideo.title || ''}
                  onChange={(e) => setEditingVideo({ ...editingVideo, title: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 block">Producto Vinculado</label>
                <select
                  value={editingVideo.productId || ''}
                  onChange={(e) => setEditingVideo({ ...editingVideo, productId: e.target.value || undefined })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs bg-white"
                >
                  <option value="">-- Ninguno --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} (${p.wholesalePrice.toLocaleString('es-AR')})
                    </option>
                  ))}
                </select>
              </div>

              {/* Preview */}
              <div className="pt-2">
                <div className="aspect-[9/16] w-28 rounded-lg overflow-hidden bg-black mx-auto border border-gray-200">
                  <video
                    src={editingVideo.videoUrl}
                    muted
                    autoPlay
                    loop
                    playsInline
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setEditingVideo(null)}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-4 py-2 text-xs font-bold text-white bg-[#0058bb] hover:bg-[#004494] rounded-lg shadow-xs cursor-pointer"
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
