import React, { useState } from 'react';
import { X, Check, Copy, Share2, ExternalLink } from 'lucide-react';
import { OfficialWhatsAppIcon } from '../admin/QuickBuyLinkManager';
import { Product } from '../../types';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: Product | null;
  customTitle?: string;
  customUrl?: string;
  customImage?: string;
}

export const InstagramIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
  </svg>
);

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  product,
  customTitle,
  customUrl,
  customImage,
}) => {
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!isOpen) return null;

  const title = product?.title || customTitle || 'Producto en My Importadora';
  const url =
    customUrl ||
    (product?.id
      ? `${window.location.origin}/producto/${product.id}`
      : window.location.href);
  const image =
    customImage ||
    product?.images?.[0] ||
    'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=400';

  const showToast = (text: string) => {
    setFeedback(text);
    setTimeout(() => setFeedback(null), 3000);
  };

  // 1. WhatsApp share
  const handleShareWhatsApp = () => {
    const message = `Mirá este producto: ${title}\n${url}`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
    onClose();
  };

  // 2. Instagram share
  const handleShareInstagram = async () => {
    try {
      await navigator.clipboard.writeText(url);
      showToast('¡Enlace copiado! Podés pegarlo en tu historia o mensaje de Instagram.');
    } catch {
      showToast('Copiá el enlace para pegarlo en Instagram.');
    }

    setTimeout(() => {
      // Intento de abrir la app o web de Instagram
      window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer');
    }, 700);
  };

  // 3. Copiar enlace
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      showToast('¡Enlace copiado al portapapeles!');
    } catch {
      showToast('No se pudo copiar el enlace.');
    }
  };

  // Native share si está disponible
  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title,
          text: `Mirá este producto: ${title}`,
          url,
        });
        onClose();
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          handleCopyLink();
        }
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-sm w-full p-4 sm:p-5 shadow-2xl space-y-4 border border-gray-100 animate-scale-up relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-[#0058bb]" />
            <h3 className="text-sm sm:text-base font-bold text-gray-900 font-['Montserrat']">
              Compartir producto
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Cerrar ventana"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Product mini card */}
        <div className="flex items-center gap-3 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
          <img
            src={image}
            alt={title}
            className="w-12 h-12 object-cover rounded-lg border border-gray-200 shrink-0 bg-white"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-semibold text-gray-900 truncate leading-snug">
              {title}
            </p>
            <p className="text-[11px] text-gray-500 truncate font-mono mt-0.5">
              {url.replace(/^https?:\/\//, '')}
            </p>
          </div>
        </div>

        {/* 3 Botones de acción principales: WhatsApp, Instagram y Copiar Enlace */}
        <div className="space-y-2 pt-1">
          {/* WhatsApp */}
          <button
            type="button"
            id="share-btn-whatsapp"
            onClick={handleShareWhatsApp}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 active:scale-[0.99] border border-emerald-200 text-emerald-900 font-semibold text-xs sm:text-sm transition-all cursor-pointer shadow-2xs group"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-full bg-[#25D366] text-white flex items-center justify-center shrink-0 shadow-xs">
                <OfficialWhatsAppIcon className="w-4 h-4 text-white" />
              </span>
              <span>Compartir en WhatsApp</span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-emerald-600 opacity-60 group-hover:opacity-100" />
          </button>

          {/* Instagram */}
          <button
            type="button"
            id="share-btn-instagram"
            onClick={handleShareInstagram}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-pink-50 hover:bg-pink-100 active:scale-[0.99] border border-pink-200 text-pink-900 font-semibold text-xs sm:text-sm transition-all cursor-pointer shadow-2xs group"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <InstagramIcon className="w-4 h-4 text-white" />
              </span>
              <span>Compartir en Instagram</span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-pink-600 opacity-60 group-hover:opacity-100" />
          </button>

          {/* Copiar enlace */}
          <button
            type="button"
            id="share-btn-copy"
            onClick={handleCopyLink}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 active:scale-[0.99] border border-gray-200 text-gray-800 font-semibold text-xs sm:text-sm transition-all cursor-pointer shadow-2xs group"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center shrink-0">
                <Copy className="w-4 h-4 text-gray-700" />
              </span>
              <span>Copiar enlace directo</span>
            </div>
            <span className="text-[11px] text-gray-500 font-normal">Portapapeles</span>
          </button>
        </div>

        {/* Feedback visual inline */}
        {feedback && (
          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="leading-snug">{feedback}</span>
          </div>
        )}

        {/* Más opciones nativas en móviles */}
        {typeof navigator !== 'undefined' && 'share' in navigator && (
          <div className="pt-1 text-center">
            <button
              type="button"
              onClick={handleNativeShare}
              className="text-xs text-gray-500 hover:text-[#0058bb] hover:underline font-medium cursor-pointer"
            >
              Más opciones del dispositivo...
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
