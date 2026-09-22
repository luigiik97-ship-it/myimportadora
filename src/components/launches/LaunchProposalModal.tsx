import React, { useState, useRef } from 'react';
import { X, Upload, Image as ImageIcon, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { LaunchCollection, UserProfile } from '../../types';
import { uploadProductImage } from '../../services/supabase';
import { submitCustomerProposal } from '../../services/launches';

interface LaunchProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  collections: LaunchCollection[];
  selectedCollectionId?: string;
  onProposalSubmitted: () => void;
}

export const LaunchProposalModal: React.FC<LaunchProposalModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  collections,
  selectedCollectionId,
  onProposalSubmitted,
}) => {
  const [collectionId, setCollectionId] = useState<string>(
    selectedCollectionId || collections[0]?.id || 'otra'
  );
  const [customCollectionName, setCustomCollectionName] = useState('');
  const [message, setMessage] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setErrorMessage('Por favor seleccioná un archivo de imagen válido (JPG, PNG, WebP).');
        return;
      }
      setErrorMessage(null);
      setImageFile(file);
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setErrorMessage('Por favor seleccioná un archivo de imagen válido (JPG, PNG, WebP).');
        return;
      }
      setErrorMessage(null);
      setImageFile(file);
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      setErrorMessage('Debés iniciar sesión para enviar una propuesta con imagen y mensaje.');
      return;
    }

    if (!imageFile && !imagePreview) {
      setErrorMessage('Por favor seleccioná una imagen del modelo que querés proponer.');
      return;
    }

    if (!message.trim()) {
      setErrorMessage('Por favor escribí un mensaje o descripción para tu propuesta.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      let finalImageUrl = imagePreview || '';

      // Upload file if selected
      if (imageFile) {
        try {
          finalImageUrl = await uploadProductImage(imageFile, { isCover: true, maxDimension: 1200 });
        } catch (uploadErr: any) {
          console.warn('Error subiendo imagen a storage, usando Data URL local:', uploadErr);
          // Fallback to data url if direct storage upload failed
          finalImageUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(imageFile);
          });
        }
      }

      const selectedCol = collections.find((c) => c.id === collectionId);
      const collectionTitle =
        collectionId === 'otra'
          ? customCollectionName.trim() || 'Nueva Colección Propuesta'
          : selectedCol?.title || 'Colección';

      await submitCustomerProposal({
        collectionId: collectionId === 'otra' ? undefined : collectionId,
        collectionTitle,
        imageUrl: finalImageUrl,
        message: message.trim(),
        userId: currentUser.id,
        userEmail: currentUser.email,
        userName: currentUser.fullName || currentUser.email.split('@')[0],
      });

      setIsSuccess(true);
      setTimeout(() => {
        onProposalSubmitted();
        setIsSuccess(false);
        setImageFile(null);
        setImagePreview(null);
        setMessage('');
        onClose();
      }, 1600);
    } catch (err: any) {
      console.error('Error submitting proposal:', err);
      setErrorMessage(err.message || 'Ocurrió un error al enviar tu propuesta. Intentá nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-50/70 via-white to-gray-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#0058bb]/10 flex items-center justify-center text-[#0058bb]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-gray-900 leading-tight font-['Montserrat']">
                Proponer un Modelo
              </h3>
              <p className="text-xs text-gray-500">
                Tu sugerencia será evaluada por el equipo para los próximos lanzamientos
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto overscroll-contain flex-1">
          {isSuccess ? (
            <div className="py-8 text-center animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-bold text-gray-900 mb-1">¡Propuesta enviada con éxito!</h4>
              <p className="text-sm text-gray-600 max-w-sm mx-auto">
                Nuestro equipo revisará tu modelo sugerido. Una vez aprobado, aparecerá en las votaciones
                con su letra identificatoria.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* User Identity Info */}
              <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-3 flex items-center justify-between text-xs">
                <div className="text-blue-900">
                  <span className="font-semibold">Subiendo como:</span>{' '}
                  <span className="font-medium">{currentUser?.fullName || currentUser?.email}</span>
                </div>
                <span className="text-[10px] bg-blue-200/70 text-blue-900 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Verificado
                </span>
              </div>

              {/* Collection Selection */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Colección destino
                </label>
                <select
                  value={collectionId}
                  onChange={(e) => setCollectionId(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0058bb] focus:bg-white transition-all cursor-pointer"
                >
                  {collections.map((col) => (
                    <option key={col.id} value={col.id}>
                      {col.title}
                    </option>
                  ))}
                  <option value="otra">💡 Otra / Proponer nueva colección</option>
                </select>
              </div>

              {collectionId === 'otra' && (
                <div className="animate-in fade-in duration-150">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Nombre o temática sugerida
                  </label>
                  <input
                    type="text"
                    value={customCollectionName}
                    onChange={(e) => setCustomCollectionName(e.target.value)}
                    placeholder="Ej. Colección Figuras One Piece Bloques"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0058bb] focus:bg-white transition-all"
                  />
                </div>
              )}

              {/* Image Upload Area */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Foto del modelo <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/png,image/jpeg,image/webp,image/jpg"
                  className="hidden"
                />

                {imagePreview ? (
                  <div className="relative group rounded-xl overflow-hidden border border-gray-200 bg-gray-50 aspect-video sm:aspect-16/10 flex items-center justify-center">
                    <img
                      src={imagePreview}
                      alt="Vista previa"
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 bg-white text-gray-900 font-bold text-xs rounded-lg shadow-sm hover:bg-gray-100 transition-colors"
                      >
                        Cambiar foto
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setImageFile(null);
                          setImagePreview(null);
                        }}
                        className="px-3 py-1.5 bg-red-600 text-white font-bold text-xs rounded-lg shadow-sm hover:bg-red-700 transition-colors"
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 hover:border-[#0058bb] bg-gray-50 hover:bg-blue-50/30 rounded-xl p-6 text-center cursor-pointer transition-colors flex flex-col items-center justify-center"
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-[#0058bb] flex items-center justify-center mb-2">
                      <Upload className="w-5 h-5" />
                    </div>
                    <p className="text-sm font-semibold text-gray-800 mb-0.5">
                      Hacé clic para subir la imagen o arrastrala aquí
                    </p>
                    <p className="text-xs text-gray-400">
                      Formatos soportados: JPG, PNG, WebP (máx. 5 MB)
                    </p>
                  </div>
                )}
              </div>

              {/* Message / Description */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Mensaje o detalle del modelo <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Contanos qué personaje, variante o detalle tiene este modelo y por qué pensás que se vendería muy bien..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0058bb] focus:bg-white transition-all resize-none"
                />
              </div>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2 text-xs text-red-700 animate-in fade-in duration-150">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Actions */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-[#0058bb] hover:bg-[#004696] text-white font-bold text-xs rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-60 flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Enviando propuesta...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Enviar Propuesta</span>
                    </>
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
