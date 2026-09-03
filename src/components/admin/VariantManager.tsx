import React, { useState } from 'react';
import { VariantType, VariantOption } from '../../types';
import { uploadProductImages } from '../../services/supabase';
import {
  Layers,
  Plus,
  Trash2,
  Image as ImageIcon,
  Upload,
  ChevronDown,
  ChevronUp,
  Sparkles,
  DollarSign,
  Star,
  Check,
  RefreshCw,
  X,
} from 'lucide-react';

interface VariantManagerProps {
  variantTypes: VariantType[];
  onChange: (updatedVariantTypes: VariantType[]) => void;
  baseWholesalePrice: number;
  baseRetailPrice: number;
  baseCashPrice?: number;
  baseRetailCashPrice?: number;
  baseWholesaleCashPrice?: number;
  baseStock?: number;
}

export const VariantManager: React.FC<VariantManagerProps> = ({
  variantTypes,
  onChange,
  baseWholesalePrice,
  baseRetailPrice,
  baseCashPrice,
  baseRetailCashPrice,
  baseWholesaleCashPrice,
  baseStock = 10,
}) => {
  // Active expanded option ID for image management
  const [expandedOptionId, setExpandedOptionId] = useState<string | null>(null);

  // Per-option uploading state: { [optionId]: boolean }
  const [uploadingForOption, setUploadingForOption] = useState<Record<string, boolean>>({});
  // Per-option URL input: { [optionId]: string }
  const [urlInputForOption, setUrlInputForOption] = useState<Record<string, string>>({});

  // Add a new variant type (up to 3 types)
  const handleAddVariantType = () => {
    if (variantTypes.length >= 3) return;

    let defaultName = 'Color / Modelo';
    let defaultOptionName = 'Opción 1';

    if (variantTypes.length === 1) {
      defaultName = 'Tamaño / Medida';
      defaultOptionName = 'Estándar';
    } else if (variantTypes.length === 2) {
      defaultName = 'Grosor de cadena / Selector opcional';
      defaultOptionName = '40 cm / Fina';
    }

    const newTypeId = `vt-${Date.now()}`;
    const newType: VariantType = {
      id: newTypeId,
      name: defaultName,
      options: [
        {
          id: `opt-${Date.now()}-1`,
          name: defaultOptionName,
          images: [],
        },
      ],
    };

    onChange([...variantTypes, newType]);
  };

  // Remove a variant type
  const handleRemoveVariantType = (typeIndex: number) => {
    const updated = variantTypes.filter((_, idx) => idx !== typeIndex);
    onChange(updated);
  };

  // Update variant type name
  const handleUpdateTypeName = (typeIndex: number, newName: string) => {
    const updated = [...variantTypes];
    updated[typeIndex] = { ...updated[typeIndex], name: newName };
    onChange(updated);
  };

  // Add an option to a variant type
  const handleAddOption = (typeIndex: number) => {
    const updated = [...variantTypes];
    const targetType = updated[typeIndex];
    const newOptionId = `opt-${typeIndex}-${Date.now()}`;
    const newOption: VariantOption = {
      id: newOptionId,
      name: `Nueva opción ${targetType.options.length + 1}`,
      images: [],
    };
    targetType.options = [...targetType.options, newOption];
    onChange(updated);
    setExpandedOptionId(newOptionId);
  };

  // Remove an option
  const handleRemoveOption = (typeIndex: number, optionIndex: number) => {
    const updated = [...variantTypes];
    const targetType = updated[typeIndex];
    targetType.options = targetType.options.filter((_, idx) => idx !== optionIndex);
    onChange(updated);
  };

  // Update option properties
  const handleUpdateOption = (
    typeIndex: number,
    optionIndex: number,
    field: keyof VariantOption,
    value: any
  ) => {
    const updated = [...variantTypes];
    const targetType = updated[typeIndex];
    targetType.options[optionIndex] = {
      ...targetType.options[optionIndex],
      [field]: value,
    };
    onChange(updated);
  };

  // Handle uploading images to a specific variant option
  const handleUploadOptionImages = async (
    typeIndex: number,
    optionIndex: number,
    files: FileList | null
  ) => {
    if (!files || files.length === 0) return;
    const option = variantTypes[typeIndex]?.options[optionIndex];
    if (!option) return;

    setUploadingForOption((prev) => ({ ...prev, [option.id]: true }));

    try {
      const filesArray = Array.from(files);
      const uploadedUrls = await uploadProductImages(filesArray);

      if (uploadedUrls.length > 0) {
        const currentImages = option.images || [];
        const newImages = [...currentImages, ...uploadedUrls];
        console.log(`[VARIANT DEBUG - OPTION IMAGES] Asignadas ${uploadedUrls.length} imágenes a la variante "${option.name}" (Total: ${newImages.length}):`, newImages);
        handleUpdateOption(typeIndex, optionIndex, 'images', newImages);
      }
    } catch (err: any) {
      alert('Error subiendo imágenes para la variante: ' + (err?.message || err));
    } finally {
      setUploadingForOption((prev) => ({ ...prev, [option.id]: false }));
    }
  };

  // Handle adding image URL to a variant option
  const handleAddOptionImageUrl = (typeIndex: number, optionIndex: number) => {
    const option = variantTypes[typeIndex]?.options[optionIndex];
    if (!option) return;

    const url = (urlInputForOption[option.id] || '').trim();
    if (!url) return;

    const currentImages = option.images || [];
    const newImages = [...currentImages, url];
    console.log(`[VARIANT DEBUG - OPTION IMAGES] Agregada URL manual a la variante "${option.name}":`, url);
    handleUpdateOption(typeIndex, optionIndex, 'images', newImages);
    setUrlInputForOption((prev) => ({ ...prev, [option.id]: '' }));
  };

  // Remove an image from a variant option
  const handleRemoveOptionImage = (
    typeIndex: number,
    optionIndex: number,
    imageIndex: number
  ) => {
    const option = variantTypes[typeIndex]?.options[optionIndex];
    if (!option || !option.images) return;

    const updatedImages = option.images.filter((_, idx) => idx !== imageIndex);
    console.log(`[VARIANT DEBUG - OPTION IMAGES] Eliminada imagen ${imageIndex} de la variante "${option.name}". Restantes:`, updatedImages);
    handleUpdateOption(typeIndex, optionIndex, 'images', updatedImages);
  };

  // Set cover / first image for a variant option
  const handleSetOptionCoverImage = (
    typeIndex: number,
    optionIndex: number,
    imageIndex: number
  ) => {
    const option = variantTypes[typeIndex]?.options[optionIndex];
    if (!option || !option.images || imageIndex === 0) return;

    const images = [...option.images];
    const [selected] = images.splice(imageIndex, 1);
    images.unshift(selected);
    handleUpdateOption(typeIndex, optionIndex, 'images', images);
  };

  // Presets helper
  const handleApplyPreset = (preset: 'none' | 'single' | 'double' | 'triple') => {
    if (preset === 'none') {
      onChange([]);
    } else if (preset === 'single') {
      onChange([
        {
          id: `vt-color-${Date.now()}`,
          name: 'Color / Modelo',
          options: [
            { id: `opt-1-${Date.now()}`, name: 'Opción 1', images: [] },
            { id: `opt-2-${Date.now()}`, name: 'Opción 2', images: [] },
          ],
        },
      ]);
    } else if (preset === 'double') {
      onChange([
        {
          id: `vt-color-${Date.now()}`,
          name: 'Color / Modelo',
          options: [
            { id: `opt-c1-${Date.now()}`, name: 'Dorado', images: [] },
            { id: `opt-c2-${Date.now()}`, name: 'Plateado', images: [] },
          ],
        },
        {
          id: `vt-size-${Date.now()}`,
          name: 'Tamaño / Medida',
          options: [
            { id: `opt-s1-${Date.now()}`, name: 'Mediano', wholesalePrice: baseWholesalePrice, retailPrice: baseRetailPrice, images: [] },
            { id: `opt-s2-${Date.now()}`, name: 'Grande', wholesalePrice: Math.round(baseWholesalePrice * 1.3), retailPrice: Math.round(baseRetailPrice * 1.3), images: [] },
          ],
        },
      ]);
    } else if (preset === 'triple') {
      onChange([
        {
          id: `vt-color-${Date.now()}`,
          name: 'Color / Modelo',
          options: [
            { id: `opt-c1-${Date.now()}`, name: 'Dorado', images: [] },
            { id: `opt-c2-${Date.now()}`, name: 'Plateado', images: [] },
          ],
        },
        {
          id: `vt-size-${Date.now()}`,
          name: 'Tamaño / Medida',
          options: [
            { id: `opt-s1-${Date.now()}`, name: '45 cm', images: [] },
            { id: `opt-s2-${Date.now()}`, name: '50 cm', images: [] },
          ],
        },
        {
          id: `vt-chain-${Date.now()}`,
          name: 'Grosor de cadena',
          options: [
            { id: `opt-g1-${Date.now()}`, name: 'Fina (1.5mm)', images: [] },
            { id: `opt-g2-${Date.now()}`, name: 'Media (2.5mm)', images: [] },
            { id: `opt-g3-${Date.now()}`, name: 'Gruesa (4mm)', images: [] },
          ],
        },
      ]);
    }
  };

  return (
    <div className="border border-blue-200 rounded-xl p-4 bg-gradient-to-br from-blue-50/40 to-slate-50 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#0058bb]/10 text-[#0058bb] flex items-center justify-center">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-xs md:text-sm flex items-center gap-1.5">
              Sistema de Variantes e Imágenes por Opción
              <span className="bg-[#0058bb] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                {variantTypes.length === 0
                  ? 'Sin variantes'
                  : variantTypes.length === 1
                  ? '1 Variante activa'
                  : `${variantTypes.length} Variantes activas`}
              </span>
            </h3>
            <p className="text-[11px] text-gray-500">
              Configura hasta 3 variantes (ej: Color, Medida y Grosor de cadena). Las variantes selectoras opcionales no requieren precio ni fotos.
            </p>
          </div>
        </div>

        {/* Quick actions & Add variant button */}
        <div className="flex items-center gap-2 flex-wrap">
          {variantTypes.length < 3 && (
            <button
              type="button"
              onClick={handleAddVariantType}
              className="bg-[#0058bb] hover:bg-[#004bb0] text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>
                {variantTypes.length === 0
                  ? 'Añadir 1ª Variante (Color/Modelo)'
                  : variantTypes.length === 1
                  ? 'Añadir 2ª Variante (Tamaño/Medida)'
                  : 'Añadir 3ª Variante (Grosor de cadena / Selector)'}
              </span>
            </button>
          )}

          {variantTypes.length > 0 && (
            <button
              type="button"
              onClick={() => handleApplyPreset('none')}
              className="text-gray-500 hover:text-red-600 text-xs font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors cursor-pointer"
              title="Quitar todas las variantes para dejar este producto como simple"
            >
              Quitar Variantes
            </button>
          )}
        </div>
      </div>

      {/* Preset Selector Chips */}
      <div className="flex items-center gap-1.5 flex-wrap text-[11px] pt-1">
        <span className="text-gray-500 font-semibold mr-1">Estructura rápida:</span>
        <button
          type="button"
          onClick={() => handleApplyPreset('none')}
          className={`px-2 py-0.5 rounded border transition-colors cursor-pointer ${
            variantTypes.length === 0
              ? 'bg-[#0058bb] text-white border-[#0058bb] font-bold'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          Sin variantes (Simple)
        </button>
        <button
          type="button"
          onClick={() => handleApplyPreset('single')}
          className={`px-2 py-0.5 rounded border transition-colors cursor-pointer ${
            variantTypes.length === 1
              ? 'bg-[#0058bb] text-white border-[#0058bb] font-bold'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          1 Variante (Color o Modelo)
        </button>
        <button
          type="button"
          onClick={() => handleApplyPreset('double')}
          className={`px-2 py-0.5 rounded border transition-colors cursor-pointer ${
            variantTypes.length === 2
              ? 'bg-[#0058bb] text-white border-[#0058bb] font-bold'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          2 Variantes (Color + Tamaño)
        </button>
        <button
          type="button"
          onClick={() => handleApplyPreset('triple')}
          className={`px-2 py-0.5 rounded border transition-colors cursor-pointer ${
            variantTypes.length === 3
              ? 'bg-[#0058bb] text-white border-[#0058bb] font-bold'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          3 Variantes (Color + Tamaño + Grosor)
        </button>
      </div>

      {/* Variant Types List */}
      {variantTypes.length === 0 ? (
        <div className="p-4 bg-white rounded-lg border border-dashed border-gray-300 text-center space-y-2">
          <p className="text-xs text-gray-500">
            Este producto no tiene variantes configuradas. Usa los botones superiores para agregar 1 variante (ej: Colores con fotos independientes) o 2 variantes.
          </p>
          <div className="flex justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => handleApplyPreset('single')}
              className="inline-flex items-center gap-1 text-xs font-bold text-[#0058bb] bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Activar 1 Variante (Color / Modelo)
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {variantTypes.map((vt, vtIdx) => (
            <div
              key={vt.id || vtIdx}
              className="bg-white rounded-xl border border-gray-200 p-3.5 shadow-2xs space-y-3"
            >
              {/* Type Header / Controls */}
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-gray-100 flex-wrap">
                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#0058bb] bg-blue-50 px-2 py-0.5 rounded border border-blue-100 shrink-0">
                    Tipo #{vtIdx + 1}
                  </span>
                  <input
                    type="text"
                    value={vt.name}
                    onChange={(e) => handleUpdateTypeName(vtIdx, e.target.value)}
                    placeholder="Ej: Color / Modelo o Tamaño / Medida"
                    className="font-bold text-gray-800 text-xs border border-gray-300 rounded px-2.5 py-1 w-full max-w-xs focus:ring-1 focus:ring-[#0058bb]"
                  />
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => handleUpdateTypeName(vtIdx, 'Color / Modelo')}
                      className="text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded cursor-pointer"
                    >
                      Color
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateTypeName(vtIdx, 'Tamaño / Medida')}
                      className="text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded cursor-pointer"
                    >
                      Tamaño
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateTypeName(vtIdx, 'Grosor de cadena')}
                      className="text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded cursor-pointer"
                    >
                      Grosor
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleAddOption(vtIdx)}
                    className="text-[#0058bb] hover:bg-blue-50 font-bold text-xs px-2.5 py-1 rounded border border-blue-200 flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Añadir Opción
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRemoveVariantType(vtIdx)}
                    className="text-red-500 hover:bg-red-50 p-1 rounded transition-colors cursor-pointer"
                    title="Eliminar este tipo de variante"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Options Table / List */}
              <div className="space-y-2.5">
                {vt.options.map((option, optIdx) => {
                  const isExpanded = expandedOptionId === option.id;
                  const optionImages = option.images || [];
                  const isUploading = uploadingForOption[option.id];

                  return (
                    <div
                      key={option.id || optIdx}
                      className={`border rounded-lg p-3 transition-all ${
                        isExpanded
                          ? 'border-[#0058bb]/60 bg-blue-50/20 shadow-xs'
                          : 'border-gray-200 bg-gray-50/50 hover:bg-white'
                      }`}
                    >
                      {/* Main Option Row */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        {/* Option Name */}
                        <div className="flex items-center gap-2 flex-1 min-w-[160px]">
                          {/* Thumbnail trigger */}
                          {optionImages.length > 0 ? (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedOptionId(isExpanded ? null : option.id)
                              }
                              className="relative w-9 h-9 rounded-lg overflow-hidden border border-blue-300 p-0.5 bg-white shrink-0 cursor-pointer group"
                              title="Ver fotos de esta opción"
                            >
                              <img
                                src={optionImages[0]}
                                alt={option.name}
                                className="w-full h-full object-contain"
                              />
                              <span className="absolute bottom-0 right-0 bg-[#0058bb] text-white text-[8px] font-bold px-1 rounded-tl">
                                {optionImages.length}
                              </span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedOptionId(isExpanded ? null : option.id)
                              }
                              className="w-9 h-9 rounded-lg border border-dashed border-gray-300 text-gray-400 hover:text-[#0058bb] hover:border-[#0058bb] flex items-center justify-center bg-white shrink-0 cursor-pointer"
                              title="Asignar fotos a esta variante"
                            >
                              <ImageIcon className="w-4 h-4" />
                            </button>
                          )}

                          <input
                            type="text"
                            value={option.name}
                            onChange={(e) =>
                              handleUpdateOption(vtIdx, optIdx, 'name', e.target.value)
                            }
                            placeholder="Nombre de la opción (ej: Dorado, Talle M)"
                            className="font-medium text-xs border border-gray-300 rounded px-2.5 py-1.5 flex-1 bg-white focus:ring-1 focus:ring-[#0058bb]"
                          />
                        </div>

                        {/* Individual Stock Control */}
                        <div className="flex items-center gap-1.5 text-xs bg-slate-100/70 border border-slate-200 px-2 py-1 rounded">
                          <span className="text-[10px] text-gray-700 font-bold">Stock (u.):</span>
                          <input
                            type="number"
                            min={0}
                            placeholder={String(baseStock)}
                            value={option.stock !== undefined ? option.stock : ''}
                            onChange={(e) =>
                              handleUpdateOption(
                                vtIdx,
                                optIdx,
                                'stock',
                                e.target.value === '' ? undefined : Math.max(0, Number(e.target.value))
                              )
                            }
                            className="w-16 border border-gray-300 rounded px-1.5 py-0.5 text-xs bg-white font-semibold text-gray-900 focus:ring-1 focus:ring-[#0058bb]"
                            title="Stock disponible exclusivo para esta variante"
                          />
                          {option.stock !== undefined && (
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                option.stock <= 0
                                  ? 'bg-red-100 text-red-700 border border-red-200'
                                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              }`}
                            >
                              {option.stock <= 0 ? 'Sin stock' : `${option.stock} u.`}
                            </span>
                          )}
                        </div>

                        {/* Optional Prices Override */}
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-gray-500 font-semibold">May $:</span>
                            <input
                              type="number"
                              min={0}
                              placeholder={String(baseWholesalePrice)}
                              value={option.wholesalePrice ?? ''}
                              onChange={(e) =>
                                handleUpdateOption(
                                  vtIdx,
                                  optIdx,
                                  'wholesalePrice',
                                  e.target.value === '' ? undefined : Number(e.target.value)
                                )
                              }
                              className="w-18 border border-gray-300 rounded px-1.5 py-1 text-xs bg-white focus:ring-1 focus:ring-[#0058bb]"
                              title="Precio mayorista normal"
                            />
                          </div>

                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-gray-500 font-semibold">Min $:</span>
                            <input
                              type="number"
                              min={0}
                              placeholder={String(baseRetailPrice)}
                              value={option.retailPrice ?? ''}
                              onChange={(e) =>
                                handleUpdateOption(
                                  vtIdx,
                                  optIdx,
                                  'retailPrice',
                                  e.target.value === '' ? undefined : Number(e.target.value)
                                )
                              }
                              className="w-18 border border-gray-300 rounded px-1.5 py-1 text-xs bg-white focus:ring-1 focus:ring-[#0058bb]"
                              title="Precio minorista normal"
                            />
                          </div>

                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-emerald-700 font-semibold">Efec. Min $:</span>
                            <input
                              type="number"
                              min={0}
                              placeholder={
                                baseRetailCashPrice !== undefined && baseRetailCashPrice > 0
                                  ? String(baseRetailCashPrice)
                                  : (baseCashPrice !== undefined && baseCashPrice > 0 ? String(baseCashPrice) : '')
                              }
                              value={option.retailCashPrice ?? ''}
                              onChange={(e) =>
                                handleUpdateOption(
                                  vtIdx,
                                  optIdx,
                                  'retailCashPrice',
                                  e.target.value === '' ? undefined : Number(e.target.value)
                                )
                              }
                              className="w-18 border border-emerald-300 rounded px-1.5 py-1 text-xs bg-white focus:ring-1 focus:ring-emerald-600"
                              title="Precio en efectivo minorista para esta variante"
                            />
                          </div>

                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-teal-700 font-semibold">Efec. May $:</span>
                            <input
                              type="number"
                              min={0}
                              placeholder={
                                baseWholesaleCashPrice !== undefined && baseWholesaleCashPrice > 0
                                  ? String(baseWholesaleCashPrice)
                                  : (baseCashPrice !== undefined && baseCashPrice > 0 ? String(baseCashPrice) : '')
                              }
                              value={option.wholesaleCashPrice ?? ''}
                              onChange={(e) =>
                                handleUpdateOption(
                                  vtIdx,
                                  optIdx,
                                  'wholesaleCashPrice',
                                  e.target.value === '' ? undefined : Number(e.target.value)
                                )
                              }
                              className="w-18 border border-teal-300 rounded px-1.5 py-1 text-xs bg-white focus:ring-1 focus:ring-teal-600"
                              title="Precio en efectivo mayorista para esta variante"
                            />
                          </div>
                        </div>

                        {/* Photo Toggle Button */}
                        <button
                          type="button"
                          onClick={() => setExpandedOptionId(isExpanded ? null : option.id)}
                          className={`text-xs font-semibold px-2.5 py-1 rounded flex items-center gap-1 transition-colors cursor-pointer ${
                            optionImages.length > 0
                              ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                          <span>
                            {optionImages.length > 0
                              ? `${optionImages.length} foto${optionImages.length > 1 ? 's' : ''}`
                              : 'Asignar fotos'}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {/* Delete Option */}
                        <button
                          type="button"
                          onClick={() => handleRemoveOption(vtIdx, optIdx)}
                          className="text-red-400 hover:text-red-600 p-1 cursor-pointer transition-colors"
                          title="Eliminar opción"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Expandable Image Gallery for this specific Variant Option */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-blue-100 space-y-3 bg-white p-3 rounded-lg border border-blue-200/80">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                              <ImageIcon className="w-3.5 h-3.5 text-[#0058bb]" />
                              Fotos independientes para: <span className="text-[#0058bb]">{option.name || 'Esta variante'}</span>
                            </span>
                            <span className="text-[10px] text-gray-500">
                              (Se mostrarán automáticamente cuando el cliente seleccione {option.name})
                            </span>
                          </div>

                          {/* Thumbnails grid */}
                          <div className="flex flex-wrap gap-2 items-center">
                            {optionImages.map((imgUrl, imgIdx) => (
                              <div
                                key={imgIdx}
                                className="relative w-16 h-16 rounded-lg border-2 border-gray-200 overflow-hidden group bg-gray-50 flex items-center justify-center p-1"
                              >
                                <img
                                  src={imgUrl}
                                  alt={`Foto ${imgIdx + 1}`}
                                  className="max-h-full max-w-full object-contain"
                                />

                                {imgIdx === 0 && (
                                  <span className="absolute top-0.5 left-0.5 bg-[#0058bb] text-white text-[8px] font-bold px-1 rounded shadow-xs">
                                    Principal
                                  </span>
                                )}

                                {/* Overlay action buttons */}
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1 transition-opacity">
                                  {imgIdx > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => handleSetOptionCoverImage(vtIdx, optIdx, imgIdx)}
                                      className="p-1 bg-white/90 text-amber-600 rounded hover:bg-white cursor-pointer"
                                      title="Poner como foto principal de esta variante"
                                    >
                                      <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveOptionImage(vtIdx, optIdx, imgIdx)}
                                    className="p-1 bg-red-600 text-white rounded hover:bg-red-700 cursor-pointer"
                                    title="Quitar foto"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            ))}

                            {/* Add Photo Slot via Upload */}
                            <label
                              className={`w-16 h-16 rounded-lg border-2 border-dashed border-[#0058bb]/50 hover:border-[#0058bb] bg-blue-50/50 hover:bg-blue-50 flex flex-col items-center justify-center cursor-pointer transition-colors text-[#0058bb] ${
                                isUploading ? 'opacity-50 pointer-events-none' : ''
                              }`}
                            >
                              {isUploading ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <Upload className="w-4 h-4 mb-0.5" />
                                  <span className="text-[9px] font-bold">Subir</span>
                                </>
                              )}
                              <input
                                type="file"
                                multiple
                                accept="image/*"
                                onChange={(e) => handleUploadOptionImages(vtIdx, optIdx, e.target.files)}
                                disabled={isUploading}
                                className="hidden"
                              />
                            </label>
                          </div>

                          {/* URL Input Bar */}
                          <div className="flex gap-1.5 pt-1">
                            <input
                              type="url"
                              value={urlInputForOption[option.id] || ''}
                              onChange={(e) =>
                                setUrlInputForOption((prev) => ({
                                  ...prev,
                                  [option.id]: e.target.value,
                                }))
                              }
                              placeholder="O pegar URL directa de imagen (https://...)"
                              className="flex-1 border border-gray-300 rounded px-2.5 py-1 text-xs bg-white focus:ring-1 focus:ring-[#0058bb]"
                            />
                            <button
                              type="button"
                              onClick={() => handleAddOptionImageUrl(vtIdx, optIdx)}
                              disabled={!(urlInputForOption[option.id] || '').trim()}
                              className="bg-gray-200 hover:bg-gray-300 disabled:opacity-50 text-gray-800 text-xs font-bold px-3 py-1 rounded transition-colors cursor-pointer"
                            >
                              Añadir URL
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
