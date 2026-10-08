import React, { useState, useEffect, useMemo } from 'react';
import {
  Video,
  Plus,
  Trash2,
  Edit2,
  ExternalLink,
  Play,
  CheckCircle2,
  AlertCircle,
  ShoppingBag,
  RefreshCw,
  X,
  ArrowUp,
  ArrowDown,
  Film,
  AlertTriangle,
  Link,
  Unlink,
} from 'lucide-react';
import { StoreVideo, Product } from '../../types';
import {
  fetchStoreVideosFromSupabase,
  saveStoreVideos,
  getLocalStoreVideos,
} from '../../services/storeVideos';
import { updateProduct } from '../../services/supabase';

interface VideoManagerProps {
  products: Product[];
  onProductUpdated?: () => void;
}

export const VideoManager: React.FC<VideoManagerProps> = ({
  products,
  onProductUpdated,
}) => {
  const [videos, setVideos] = useState<StoreVideo[]>(() => getLocalStoreVideos());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // New video form state
  const [newUrl, setNewUrl] = useState<string>('');
  const [newTitle, setNewTitle] = useState<string>('');
  const [newProductId, setNewProductId] = useState<string>('');

  // Modals state
  const [editingVideo, setEditingVideo] = useState<StoreVideo | null>(null);
  const [videoToDelete, setVideoToDelete] = useState<StoreVideo | null>(null);
  const [productVideoToRemove, setProductVideoToRemove] = useState<Product | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Load from Supabase on mount
  const loadVideos = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const remoteVideos = await fetchStoreVideosFromSupabase();
      setVideos(remoteVideos);
    } catch (err) {
      console.warn('Error loading remote videos:', err);
      setVideos(getLocalStoreVideos());
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadVideos();
  }, []);

  // Products that have a videoUrl configured in their product catalog sheet
  const productsWithVideos = useMemo(() => {
    return products.filter((p) => Boolean(p.videoUrl && p.videoUrl.trim()));
  }, [products]);

  // Handle adding a new video to the Reels carousel
  const handleAddVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedUrl = newUrl.trim();
    if (!trimmedUrl) {
      setErrorMessage('Por favor ingresa la URL directa de Cloudinary MP4.');
      return;
    }

    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      setErrorMessage('La URL debe comenzar con https://');
      return;
    }

    const selectedProd = products.find((p) => p.id === newProductId);

    const newVideoItem: StoreVideo = {
      id: `vid-${Date.now()}`,
      videoUrl: trimmedUrl,
      title: newTitle.trim() || (selectedProd ? selectedProd.title : 'Video de Temporada'),
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

    setIsSaving(true);
    const ok = await saveStoreVideos(updatedList);
    if (selectedProd) {
      try {
        await updateProduct(selectedProd.id, { videoUrl: trimmedUrl });
        if (onProductUpdated) await onProductUpdated();
      } catch (prodErr) {
        console.warn('Advertencia al sincronizar video con el producto:', prodErr);
      }
    }
    setIsSaving(false);
    if (ok) {
      showToast('Video agregado y vinculado exitosamente');
    } else {
      setErrorMessage('Se guardó localmente, pero ocurrió un aviso de red con Supabase.');
    }
  };

  // Save changes from Edit Modal
  const handleSaveEdit = async () => {
    if (!editingVideo) return;
    const selectedProd = products.find((p) => p.id === editingVideo.productId);

    const updatedList = videos.map((v) => {
      if (v.id === editingVideo.id) {
        return {
          ...editingVideo,
          title: editingVideo.title?.trim() || (selectedProd ? selectedProd.title : v.title),
          videoUrl: editingVideo.videoUrl.trim(),
          productId: selectedProd ? selectedProd.id : undefined,
          productTitle: selectedProd ? selectedProd.title : undefined,
          productPrice: selectedProd ? selectedProd.wholesalePrice : undefined,
          productImage: selectedProd ? selectedProd.images?.[0] : undefined,
        };
      }
      return v;
    });

    setVideos(updatedList);
    setEditingVideo(null);

    setIsSaving(true);
    const ok = await saveStoreVideos(updatedList);
    if (selectedProd) {
      try {
        await updateProduct(selectedProd.id, { videoUrl: editingVideo.videoUrl.trim() });
        if (onProductUpdated) await onProductUpdated();
      } catch (prodErr) {
        console.warn('Advertencia al sincronizar video con el producto:', prodErr);
      }
    }
    setIsSaving(false);
    if (ok) {
      showToast('Video actualizado y vinculado correctamente');
    }
  };

  // Confirmed Delete of a Store Video (NO window.confirm!)
  const handleConfirmDelete = async () => {
    if (!videoToDelete) return;
    const idToDelete = videoToDelete.id;
    const updatedList = videos.filter((v) => v.id !== idToDelete);

    setVideos(updatedList);
    setVideoToDelete(null);

    setIsSaving(true);
    const ok = await saveStoreVideos(updatedList);
    setIsSaving(false);
    if (ok) {
      showToast('Video eliminado del carrusel exitosamente');
    }
  };

  // Re-order video in list (move up / down)
  const handleMoveVideo = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= videos.length) return;

    const reordered = [...videos];
    const temp = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = temp;

    const normalized = reordered.map((v, i) => ({ ...v, sortOrder: i }));
    setVideos(normalized);

    setIsSaving(true);
    await saveStoreVideos(normalized);
    setIsSaving(false);
    showToast('Orden de videos actualizado');
  };

  // Remove video directly from an individual product
  const handleConfirmRemoveProductVideo = async () => {
    if (!productVideoToRemove) return;
    const targetProd = productVideoToRemove;
    setProductVideoToRemove(null);

    setIsSaving(true);
    try {
      await updateProduct(targetProd.id, { videoUrl: '' });
      if (onProductUpdated) {
        await onProductUpdated();
      }
      showToast(`Video quitado del producto "${targetProd.title}"`);
    } catch (err) {
      console.error('Error desvinculando video del producto:', err);
      setErrorMessage('No se pudo quitar el video del producto. Inténtalo nuevamente.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-emerald-600 text-white font-bold text-xs sm:text-sm px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Banner / Introduction */}
      <div className="bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900 rounded-xl p-5 sm:p-6 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 border border-neutral-700/50">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
            <Video className="w-4 h-4" />
            <span>Gestión de Videos Cloudinary MP4 & Reels</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black font-['Montserrat'] tracking-tight">
            Videos & Reels en Formato 9:16
          </h2>
          <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
            Administra los videos que se reproducen en el carrusel de Reels en la página de inicio.
            Puedes agregar nuevos videos, reordenarlos, editarlos o eliminarlos en cualquier momento.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={loadVideos}
            disabled={isLoading || isSaving}
            className="text-xs font-semibold text-gray-300 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Recargar videos"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
          {isSaving && (
            <span className="text-xs text-amber-300 flex items-center gap-1.5 bg-amber-950/60 border border-amber-500/30 px-3 py-2 rounded-lg">
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
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-[#0058bb] focus:border-transparent outline-none transition-all"
              />
              <p className="text-[11px] text-gray-500">
                Pega la URL directa de Cloudinary terminada en .mp4.
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
                placeholder="Ej. Anillos de Plata 925"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0058bb] focus:border-transparent outline-none transition-all"
              />
            </div>
          </div>

          {/* Product link selector & Live Preview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 block flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5 text-[#0058bb]" />
                Vincular a un Producto de la Tienda (opcional)
              </label>
              <select
                value={newProductId}
                onChange={(e) => setNewProductId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-[#0058bb] focus:border-transparent outline-none transition-all bg-white"
              >
                <option value="">-- Ninguno (Video de portada o general) --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} (${p.wholesalePrice.toLocaleString('es-AR')})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-gray-500">
                Si vinculas un producto, al hacer clic en el Reel se abrirá directamente dicho producto.
              </p>
            </div>

            {/* Quick Live Preview Test */}
            {newUrl.trim() && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                <div className="w-14 aspect-[9/16] rounded-lg overflow-hidden bg-black shrink-0 relative border border-gray-300 shadow-2xs">
                  <video
                    src={newUrl.trim()}
                    muted
                    autoPlay
                    loop
                    playsInline
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="text-xs text-gray-600 space-y-0.5">
                  <p className="font-bold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Video detectado
                  </p>
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

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={!newUrl.trim() || isSaving}
              className="bg-[#0058bb] hover:bg-[#004494] disabled:opacity-50 text-white font-bold text-xs sm:text-sm px-5 py-2.5 rounded-lg flex items-center gap-2 shadow-xs cursor-pointer transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar Video al Carrusel</span>
            </button>
          </div>
        </form>
      </div>

      {/* Videos List in Carousel */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-gray-900 font-['Montserrat'] flex items-center gap-2">
              <Film className="w-4 h-4 text-gray-700" />
              Videos Activos en el Carrusel Reels ({videos.length})
            </h3>
            <p className="text-xs text-gray-500">
              Usa los botones de subir/bajar para cambiar el orden en que se reproducen en la página de inicio.
            </p>
          </div>

          {videos.length > 0 && (
            <span className="text-xs text-gray-400 font-medium">
              Arrastra o usa los controles para gestionar
            </span>
          )}
        </div>

        {videos.length === 0 ? (
          <div className="text-center py-12 text-gray-500 space-y-2 bg-gray-50/50 rounded-xl border border-dashed border-gray-200 p-6">
            <Video className="w-10 h-10 mx-auto text-gray-300" />
            <p className="text-sm font-medium text-gray-700">Aún no hay videos en el carrusel de Reels.</p>
            <p className="text-xs text-gray-400">
              Agrega uno arriba pegando la URL directa de Cloudinary MP4.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-4">
            {videos.map((vid, idx) => (
              <div
                key={vid.id}
                className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden shadow-2xs hover:shadow-md transition-shadow flex flex-col justify-between group relative"
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

                  {/* Order badge */}
                  <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-xs text-white text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                    <span>#{idx + 1}</span>
                  </div>

                  {/* Reorder Up / Down floating controls */}
                  <div className="absolute top-2 right-2 flex flex-col gap-1 z-10 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveVideo(idx, 'up')}
                      className="w-6 h-6 rounded-md bg-black/60 hover:bg-black text-white disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer shadow-xs"
                      title="Mover antes"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === videos.length - 1}
                      onClick={() => handleMoveVideo(idx, 'down')}
                      className="w-6 h-6 rounded-md bg-black/60 hover:bg-black text-white disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer shadow-xs"
                      title="Mover después"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Play badge indicator */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none group-hover:opacity-0 transition-opacity">
                    <div className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-xs border border-white/40 flex items-center justify-center text-white">
                      <Play className="w-4 h-4 ml-0.5 fill-white" />
                    </div>
                  </div>

                  {/* Title overlay */}
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-2.5 text-white">
                    <p className="text-xs font-bold truncate leading-tight">{vid.title || 'Video'}</p>
                    {vid.productPrice !== undefined && (
                      <p className="text-[11px] font-semibold text-yellow-300 mt-0.5">
                        ${vid.productPrice.toLocaleString('es-AR')}
                      </p>
                    )}
                    {vid.productTitle && (
                      <p className="text-[10px] text-gray-300 truncate mt-0.5 flex items-center gap-1">
                        <Link className="w-2.5 h-2.5 text-emerald-400" />
                        <span>{vid.productTitle}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions bottom bar */}
                <div className="p-2 bg-white border-t border-gray-200 flex items-center justify-between gap-1">
                  <a
                    href={vid.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-gray-500 hover:text-[#0058bb] p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                    title="Abrir enlace directo de Cloudinary"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingVideo(vid)}
                      className="p-1.5 text-gray-600 hover:text-[#0058bb] hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"
                      title="Editar video"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setVideoToDelete(vid)}
                      className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                      title="Eliminar este video"
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

      {/* Videos from Individual Products Section */}
      {productsWithVideos.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs space-y-4">
          <div className="border-b border-gray-100 pb-3">
            <h3 className="text-base font-bold text-gray-900 font-['Montserrat'] flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-[#0058bb]" />
              Videos Vinculados en Fichas de Productos ({productsWithVideos.length})
            </h3>
            <p className="text-xs text-gray-500">
              Estos videos fueron asignados directamente en la ficha del producto desde la pestaña "Publicaciones" y también se incluyen en el carrusel de Reels. Puedes desvincularlos aquí mismo.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {productsWithVideos.map((prod) => (
              <div
                key={prod.id}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200 hover:border-gray-300 transition-all"
              >
                {/* Video mini preview */}
                <div className="w-12 aspect-[9/16] rounded-lg overflow-hidden bg-black shrink-0 relative border border-gray-300">
                  <video
                    src={prod.videoUrl}
                    muted
                    loop
                    playsInline
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-gray-900 truncate">{prod.title}</h4>
                  <p className="text-[11px] text-gray-500 truncate mt-0.5">
                    ${prod.wholesalePrice.toLocaleString('es-AR')} • {prod.category}
                  </p>
                  <a
                    href={prod.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-[#0058bb] hover:underline font-mono truncate block mt-0.5"
                  >
                    Ver MP4 directo
                  </a>
                </div>

                <button
                  type="button"
                  onClick={() => setProductVideoToRemove(prod)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition-colors shrink-0"
                  title="Quitar video de este producto"
                >
                  <Unlink className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirmation Modal to Delete Store Video (Clean in-app modal, replaces window.confirm) */}
      {videoToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-scale-up border border-gray-100">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h4 className="text-base font-bold text-gray-900 font-['Montserrat']">
                  ¿Eliminar este video?
                </h4>
                <p className="text-xs text-gray-500">Esta acción no se puede deshacer.</p>
              </div>
            </div>

            {/* Video preview in modal */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
              <div className="w-12 aspect-[9/16] rounded-lg overflow-hidden bg-black shrink-0 relative border border-gray-300">
                <video
                  src={videoToDelete.videoUrl}
                  muted
                  autoPlay
                  loop
                  playsInline
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-gray-800 truncate">
                  {videoToDelete.title || 'Video sin título'}
                </p>
                {videoToDelete.productTitle && (
                  <p className="text-[11px] text-gray-500 truncate">
                    Producto: {videoToDelete.productTitle}
                  </p>
                )}
                <p className="text-[10px] text-gray-400 font-mono truncate mt-0.5">
                  {videoToDelete.videoUrl}
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              El video se quitará de inmediato del carrusel de Reels en la página principal y se actualizará en la base de datos.
            </p>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setVideoToDelete(null)}
                className="px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isSaving}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Eliminando...' : 'Sí, eliminar video'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal to Unlink Video from Product */}
      {productVideoToRemove && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-scale-up border border-gray-100">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <Unlink className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h4 className="text-base font-bold text-gray-900 font-['Montserrat']">
                  ¿Quitar video del producto?
                </h4>
                <p className="text-xs text-gray-500">Se eliminará el video de la ficha de este producto.</p>
              </div>
            </div>

            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
              <p className="text-xs font-bold text-gray-800 truncate">
                {productVideoToRemove.title}
              </p>
              <p className="text-[11px] text-gray-500">
                Precio: ${productVideoToRemove.wholesalePrice.toLocaleString('es-AR')}
              </p>
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setProductVideoToRemove(null)}
                className="px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmRemoveProductVideo}
                disabled={isSaving}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5 transition-colors"
              >
                <Unlink className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Guardando...' : 'Quitar Video'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
                  required
                  value={editingVideo.videoUrl}
                  onChange={(e) => setEditingVideo({ ...editingVideo, videoUrl: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-[#0058bb] outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 block">Título / Pie del Video</label>
                <input
                  type="text"
                  value={editingVideo.title || ''}
                  onChange={(e) => setEditingVideo({ ...editingVideo, title: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-[#0058bb] outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 block">Producto Vinculado</label>
                <select
                  value={editingVideo.productId || ''}
                  onChange={(e) => setEditingVideo({ ...editingVideo, productId: e.target.value || undefined })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-[#0058bb] outline-none"
                >
                  <option value="">-- Ninguno (Video de portada o general) --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} (${p.wholesalePrice.toLocaleString('es-AR')})
                    </option>
                  ))}
                </select>
              </div>

              {/* Preview in edit modal */}
              {editingVideo.videoUrl.trim() && (
                <div className="pt-2">
                  <div className="aspect-[9/16] w-28 rounded-lg overflow-hidden bg-black mx-auto border border-gray-300 shadow-sm">
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
              )}
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setEditingVideo(null)}
                className="px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100 rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isSaving}
                className="px-4 py-2 text-xs font-bold text-white bg-[#0058bb] hover:bg-[#004494] disabled:opacity-50 rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Guardando...' : 'Guardar Cambios'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
