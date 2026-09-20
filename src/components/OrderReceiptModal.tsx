import React, { useState } from 'react';
import {
  MessageSquare,
  Download,
  Copy,
  Check,
  ExternalLink,
  X,
  Share2,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import {
  GeneratedReceipt,
  downloadReceiptImage,
  copyReceiptImageToClipboard,
  shareReceiptImageViaWhatsApp,
} from '../services/orderReceiptImage';

interface OrderReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receipt: GeneratedReceipt | null;
  customWaDestination?: string;
  isQuickBuy?: boolean;
}

export const OrderReceiptModal: React.FC<OrderReceiptModalProps> = ({
  isOpen,
  onClose,
  receipt,
  customWaDestination,
  isQuickBuy = false,
}) => {
  const [copied, setCopied] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  if (!isOpen || !receipt) return null;

  const handleCopy = async () => {
    const success = await copyReceiptImageToClipboard(receipt.blob);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleDownload = () => {
    downloadReceiptImage(receipt);
  };

  const handleShare = async () => {
    setIsSharing(true);
    try {
      await shareReceiptImageViaWhatsApp({
        receipt,
        customWaDestination,
        isQuickBuy,
      });
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs overflow-y-auto">
      <div
        className="relative bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-gray-200 overflow-hidden flex flex-col my-auto max-h-[92vh] animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera del modal */}
        <div className="bg-[#0058bb] text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-yellow-300" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold leading-tight">
                ¡Imagen del Pedido Lista!
              </h3>
              <p className="text-xs text-blue-100 font-medium">
                Pedido #{receipt.orderNumber} con fotos de variantes
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Cerrar vista previa"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Notificación informativa */}
        <div className="bg-emerald-50 border-b border-emerald-200/80 px-4 py-2.5 flex items-center gap-2 text-emerald-800 text-xs sm:text-sm font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            Se reemplazó el texto largo por este comprobante con fotos reales.
          </span>
        </div>

        {/* Vista previa de la imagen generada */}
        <div className="p-4 bg-slate-100/70 overflow-y-auto flex-1 flex flex-col items-center justify-center min-h-[260px]">
          <div className="relative group max-w-sm w-full bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
            <img
              src={receipt.dataUrl}
              alt={`Comprobante Pedido #${receipt.orderNumber}`}
              className="w-full h-auto object-contain max-h-[48vh] mx-auto block"
            />
          </div>
          <p className="text-[11px] text-gray-500 mt-2 text-center">
            Diseño optimizado para verse nítido en la pantalla de cualquier celular
          </p>
        </div>

        {/* Barra de Acciones */}
        <div className="p-4 bg-white border-t border-gray-200 flex flex-col gap-2.5 shrink-0">
          {/* Botón Principal: Compartir por WhatsApp */}
          <button
            type="button"
            id="modal-share-receipt-wa-btn"
            disabled={isSharing}
            onClick={handleShare}
            className="w-full bg-[#00a650] hover:bg-[#009045] active:scale-[0.98] text-white font-bold py-3.5 px-4 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 text-sm sm:text-base cursor-pointer uppercase tracking-wide"
          >
            <MessageSquare className="w-5 h-5 fill-white" />
            <span>Compartir por WhatsApp</span>
          </button>

          {/* Botones secundarios: Descargar y Copiar */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              id="modal-download-receipt-btn"
              onClick={handleDownload}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-2.5 px-3 rounded-xl border border-gray-200 transition-colors flex items-center justify-center gap-1.5 text-xs sm:text-sm cursor-pointer"
            >
              <Download className="w-4 h-4 text-gray-600" />
              <span>Descargar</span>
            </button>

            <button
              type="button"
              id="modal-copy-receipt-btn"
              onClick={handleCopy}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-2.5 px-3 rounded-xl border border-gray-200 transition-colors flex items-center justify-center gap-1.5 text-xs sm:text-sm cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700">¡Copiada!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-gray-600" />
                  <span>Copiar Imagen</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
