import React, { useState, useEffect, useMemo } from 'react';
import { Product, VariantType, VariantOption } from '../../types';
import {
  StandaloneVariantItem,
  StandaloneVariantsConfig,
  getStandaloneVariantsConfig,
  saveStandaloneVariantsConfig,
  fetchStandaloneVariantsFromSupabase,
  buildStandaloneVariantId,
} from '../../services/standaloneVariants';
import { normalizeVariantTypes, getResolvedProductPrices, getOptionStock } from '../../utils/variantHelpers';
import {
  Layers,
  Search,
  Check,
  Plus,
  Trash2,
  ExternalLink,
  Sparkles,
  Eye,
  AlertCircle,
  Save,
  CheckCircle2,
  RefreshCw,
  Tag,
  DollarSign,
  Package,
} from 'lucide-react';

interface StandaloneVariantsManagerProps {
  products: Product[];
  onOpenProductDetail?: (product: Product, selectedVariants?: Record<string, string>, image?: string) => void;
}

export const StandaloneVariantsManager: React.FC<StandaloneVariantsManagerProps> = ({
  products,
  onOpenProductDetail,
}) => {
  const [config, setConfig] = useState<StandaloneVariantsConfig>(() => getStandaloneVariantsConfig());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync from Supabase on mount
  useEffect(() => {
    fetchStandaloneVariantsFromSupabase().then((remote) => {
      setConfig(remote);
    });

    const handleUpdate = (e: CustomEvent<StandaloneVariantsConfig>) => {
      if (e.detail) {
        setConfig(e.detail);
      }
    };

    window.addEventListener('my_commerce_standalone_variants_updated' as any, handleUpdate);
    return () => {
      window.removeEventListener('my_commerce_standalone_variants_updated' as any, handleUpdate);
    };
  }, []);

  // Filter products that have at least one variant type with options
  const eligibleProducts = useMemo(() => {
    return products
      .filter((p) => p && !p.id.startsWith('__system_'))
      .filter((p) => {
        const types = normalizeVariantTypes(p);
        return types.some((t) => Array.isArray(t.options) && t.options.length > 0);
      })
      .filter((p) => {
        if (!searchTerm.trim()) return true;
        const q = searchTerm.toLowerCase();
        return (
          p.title.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          (p.variantTypes || []).some((vt) =>
            vt.options.some((opt) => opt.name.toLowerCase().includes(q))
          )
        );
      });
  }, [products, searchTerm]);

  // Selected product object
  const selectedProduct = useMemo(() => {
    if (!selectedProductId) return null;
    return products.find((p) => String(p.id) === String(selectedProductId)) || null;
  }, [products, selectedProductId]);

  // Normalized variant types for the selected product
  const selectedProductVariantTypes: VariantType[] = useMemo(() => {
    if (!selectedProduct) return [];
    return normalizeVariantTypes(selectedProduct);
  }, [selectedProduct]);

  // Map of active items for quick O(1) checks: key -> item
  const activeItemsMap = useMemo(() => {
    const map = new Map<string, StandaloneVariantItem>();
    config.items.forEach((item) => {
      map.set(item.id, item);
    });
    return map;
  }, [config.items]);

  // Toggle a variant option as standalone card
  const handleToggleVariant = async (
    product: Product,
    variantType: VariantType,
    option: VariantOption
  ) => {
    const itemId = buildStandaloneVariantId(product.id, option.id);
    const existing = activeItemsMap.get(itemId);

    let updatedItems: StandaloneVariantItem[];

    if (existing) {
      // Toggle active status or remove if requested
      updatedItems = config.items.map((it) =>
        it.id === itemId ? { ...it, active: !it.active } : it
      );
    } else {
      // Add as new active standalone variant item
      const newItem: StandaloneVariantItem = {
        id: itemId,
        productId: product.id,
        variantTypeId: variantType.id,
        variantOptionId: option.id,
        variantOptionName: option.name,
        active: true,
        createdAt: new Date().toISOString(),
      };
      updatedItems = [newItem, ...config.items];
    }

    const newConfig: StandaloneVariantsConfig = {
      items: updatedItems,
      lastUpdated: new Date().toISOString(),
    };

    setConfig(newConfig);
    await persistConfig(newConfig);
  };

  // Remove an item completely
  const handleRemoveItem = async (itemId: string) => {
    const updatedItems = config.items.filter((it) => it.id !== itemId);
    const newConfig: StandaloneVariantsConfig = {
      items: updatedItems,
      lastUpdated: new Date().toISOString(),
    };
    setConfig(newConfig);
    await persistConfig(newConfig);
  };

  // Persist to Supabase and localStorage
  const persistConfig = async (newConfig: StandaloneVariantsConfig) => {
    setIsSaving(true);
    setErrorMessage(null);
    setSaveSuccess(false);

    try {
      await saveStandaloneVariantsConfig(newConfig);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error guardando variantes independientes:', err);
      setErrorMessage(err.message || 'Error al guardar en Supabase');
    } finally {
      setIsSaving(false);
    }
  };

  // List of active items with resolved product data for the summary table
  const configuredItemsWithDetails = useMemo(() => {
    return config.items
      .map((item) => {
        const prod = products.find((p) => String(p.id) === String(item.productId));
        if (!prod) return null;

        const types = normalizeVariantTypes(prod);
        const vt = types.find((t) => t.id === item.variantTypeId) || types[0];
        const opt = vt?.options.find((o) => o.id === item.variantOptionId || o.name === item.variantOptionName);
        if (!opt) return null;

        const prices = getResolvedProductPrices(prod, { [vt.id]: opt.name });
        const img =
          (opt.images && opt.images[0]) ||
          (prod.images && prod.images[0]) ||
          'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=400';
        const stock = getOptionStock(prod, opt, vt.id);

        return {
          item,
          product: prod,
          variantType: vt,
          option: opt,
          prices,
          image: img,
          stock,
        };
      })
      .filter(Boolean) as Array<{
      item: StandaloneVariantItem;
      product: Product;
      variantType: VariantType;
      option: VariantOption;
      prices: ReturnType<typeof getResolvedProductPrices>;
      image: string;
      stock: number;
    }>;
  }, [config.items, products]);

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-blue-50 text-[#0058bb] rounded-xl">
                <Layers className="w-5 h-5" />
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 font-['Montserrat']">
                Variantes como Tarjetas Independientes
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-gray-600 max-w-2xl">
              Selecciona variantes de tus publicaciones para exhibirlas como tarjetas individuales en el catálogo. Cada tarjeta muestra la foto y el precio de esa variante, conserva el título general del producto y, al hacer clic, abre la publicación con dicha variante seleccionada automáticamente (permitiendo al cliente cambiar a cualquier otra).
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            {isSaving ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-[#0058bb] rounded-lg text-xs font-semibold">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Guardando en Supabase...
              </span>
            ) : saveSuccess ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Sincronizado en Supabase y Vercel
              </span>
            ) : (
              <span className="text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200">
                {configuredItemsWithDetails.filter((d) => d.item.active).length} tarjetas activas
              </span>
            )}
          </div>
        </div>

        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Main Grid: Selector & Variant Options */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Product Selection (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-gray-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
              <Search className="w-4 h-4 text-[#0058bb]" />
              1. Elegir Publicación Existente
            </h3>
            <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              {eligibleProducts.length} disponibles
            </span>
          </div>

          {/* Search Input */}
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por título, categoría o variante..."
              className="w-full border border-gray-300 rounded-xl pl-9 pr-3 py-2 text-xs focus:ring-2 focus:ring-[#0058bb]/20 focus:border-[#0058bb] transition-all"
            />
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          </div>

          {/* Product List */}
          <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1">
            {eligibleProducts.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-xs">
                No se encontraron publicaciones con variantes que coincidan.
              </div>
            ) : (
              eligibleProducts.map((prod) => {
                const isSelected = String(prod.id) === String(selectedProductId);
                const types = normalizeVariantTypes(prod);
                const totalOptions = types.reduce((acc, t) => acc + t.options.length, 0);

                // Count active standalone variants configured for this product
                const activeForThis = config.items.filter(
                  (it) => it.productId === prod.id && it.active
                ).length;

                return (
                  <div
                    key={prod.id}
                    onClick={() => setSelectedProductId(prod.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-3 ${
                      isSelected
                        ? 'border-[#0058bb] bg-blue-50/50 shadow-xs ring-1 ring-[#0058bb]'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50 bg-white'
                    }`}
                  >
                    <img
                      src={
                        (prod.images && prod.images[0]) ||
                        'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=100'
                      }
                      alt={prod.title}
                      className="w-12 h-12 rounded-lg object-cover bg-gray-100 shrink-0 border border-gray-200"
                    />

                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-gray-900 truncate">
                        {prod.title}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                          {prod.category}
                        </span>
                        <span className="text-[10px] text-[#0058bb] font-semibold">
                          {totalOptions} {totalOptions === 1 ? 'opción' : 'opciones'}
                        </span>
                        {activeForThis > 0 && (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                            <Check className="w-2.5 h-2.5" /> {activeForThis} activa{activeForThis > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <span className="text-xs font-extrabold text-gray-900">
                        ${prod.wholesalePrice.toLocaleString('es-AR')}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Variants Selector for chosen Product (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-gray-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#0058bb]" />
              2. Seleccionar Variantes para Tarjetas Independientes
            </h3>
            {selectedProduct && (
              <span className="text-xs font-medium text-gray-500 truncate max-w-xs">
                {selectedProduct.title}
              </span>
            )}
          </div>

          {!selectedProduct ? (
            <div className="py-16 text-center space-y-2 text-gray-400">
              <Layers className="w-10 h-10 mx-auto text-gray-300" />
              <p className="text-sm font-medium text-gray-600">
                Selecciona una publicación de la lista izquierda
              </p>
              <p className="text-xs text-gray-400 max-w-md mx-auto">
                Verás todas las opciones de sus variantes con sus fotos y precios listos para convertirse en tarjetas independientes.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {selectedProductVariantTypes.map((variantType) => {
                return (
                  <div key={variantType.id} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#0058bb]" />
                      <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                        Tipo: {variantType.name}
                      </h4>
                      <span className="text-[10px] text-gray-400">
                        ({variantType.options.length} opciones)
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {variantType.options.map((option) => {
                        const itemId = buildStandaloneVariantId(selectedProduct.id, option.id);
                        const existingConfig = activeItemsMap.get(itemId);
                        const isActive = !!(existingConfig && existingConfig.active);

                        const prices = getResolvedProductPrices(selectedProduct, {
                          [variantType.id]: option.name,
                        });

                        const optionImg =
                          (option.images && option.images[0]) ||
                          (selectedProduct.images && selectedProduct.images[0]) ||
                          'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=200';

                        const optionStock = getOptionStock(
                          selectedProduct,
                          option,
                          variantType.id
                        );

                        return (
                          <div
                            key={option.id}
                            className={`p-3 rounded-xl border transition-all flex flex-col justify-between space-y-2 ${
                              isActive
                                ? 'border-[#0058bb] bg-blue-50/30 ring-1 ring-[#0058bb]/40 shadow-xs'
                                : 'border-gray-200 bg-white hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              {/* Option Image Thumbnail */}
                              <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 shrink-0">
                                <img
                                  src={optionImg}
                                  alt={option.name}
                                  className="w-full h-full object-cover"
                                />
                                {isActive && (
                                  <span className="absolute top-1 right-1 w-3 h-3 bg-emerald-500 rounded-full border border-white" />
                                )}
                              </div>

                              {/* Option Details */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-gray-900 truncate">
                                    {option.name}
                                  </span>
                                  {isActive && (
                                    <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 bg-[#0058bb] text-white rounded">
                                      Tarjeta Activa
                                    </span>
                                  )}
                                </div>

                                <div className="text-[11px] text-gray-600 mt-0.5 space-y-0.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-gray-900">
                                      May: ${prices.wholesalePrice.toLocaleString('es-AR')}
                                    </span>
                                    <span className="text-gray-400">|</span>
                                    <span>Min: ${prices.retailPrice.toLocaleString('es-AR')}</span>
                                  </div>
                                  <div className="text-[10px] text-gray-500">
                                    Stock: <span className="font-semibold">{optionStock} un.</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Card Preview Details info */}
                            <div className="bg-gray-50 rounded-lg p-2 text-[10px] text-gray-600 border border-gray-100 space-y-0.5">
                              <p className="truncate">
                                <span className="font-semibold text-gray-700">Título tarjeta:</span>{' '}
                                {selectedProduct.title}
                              </p>
                              <p className="truncate">
                                <span className="font-semibold text-gray-700">Etiqueta:</span> {option.name}
                              </p>
                            </div>

                            {/* Action Button */}
                            <button
                              type="button"
                              onClick={() => handleToggleVariant(selectedProduct, variantType, option)}
                              className={`w-full py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                                isActive
                                  ? 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
                                  : 'bg-[#0058bb] hover:bg-[#004bb0] text-white shadow-xs'
                              }`}
                            >
                              {isActive ? (
                                <>
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Quitar tarjeta independiente</span>
                                </>
                              ) : (
                                <>
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Mostrar como tarjeta independiente</span>
                                </>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 3. Summary Table: All configured standalone variant cards */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-gray-900 font-['Montserrat'] flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#0058bb]" />
              Tarjetas Independientes Configuradas en la Tienda
            </h3>
            <p className="text-xs text-gray-500">
              Estas tarjetas se visualizan en el catálogo principal y abren la publicación correspondiente con su variante preseleccionada.
            </p>
          </div>
          <span className="text-xs font-bold text-[#0058bb] bg-blue-50 px-3 py-1 rounded-full border border-blue-100 self-start sm:self-auto">
            {configuredItemsWithDetails.length} tarjetas en total
          </span>
        </div>

        {configuredItemsWithDetails.length === 0 ? (
          <div className="py-12 text-center text-gray-400 space-y-2">
            <Package className="w-8 h-8 mx-auto text-gray-300" />
            <p className="text-xs font-medium text-gray-600">
              Aún no has configurado ninguna variante como tarjeta independiente.
            </p>
            <p className="text-[11px] text-gray-400">
              Usa el panel de arriba para seleccionar variantes de tus productos y activarlas con un clic.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 font-bold uppercase text-[10px] bg-gray-50">
                  <th className="py-2.5 px-3">Foto Variante</th>
                  <th className="py-2.5 px-3">Título de la Tarjeta</th>
                  <th className="py-2.5 px-3">Variante</th>
                  <th className="py-2.5 px-3">Precio Variante (May / Min)</th>
                  <th className="py-2.5 px-3">Stock</th>
                  <th className="py-2.5 px-3">Estado</th>
                  <th className="py-2.5 px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {configuredItemsWithDetails.map(
                  ({ item, product, variantType, option, prices, image, stock }) => {
                    return (
                      <tr key={item.id} className="hover:bg-gray-50/70 transition-colors">
                        {/* Foto */}
                        <td className="py-2.5 px-3">
                          <img
                            src={image}
                            alt={option.name}
                            className="w-10 h-10 rounded-lg object-cover bg-gray-100 border border-gray-200"
                          />
                        </td>

                        {/* Titulo */}
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-gray-900 line-clamp-1">{product.title}</div>
                          <div className="text-[10px] text-gray-400">{product.category}</div>
                        </td>

                        {/* Variante */}
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-[#0058bb] bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                            {option.name}
                          </span>
                          <span className="block text-[10px] text-gray-400 mt-0.5">
                            {variantType.name}
                          </span>
                        </td>

                        {/* Precios */}
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-gray-900">
                            ${prices.wholesalePrice.toLocaleString('es-AR')}
                          </div>
                          <div className="text-[10px] text-gray-500">
                            Min: ${prices.retailPrice.toLocaleString('es-AR')}
                          </div>
                        </td>

                        {/* Stock */}
                        <td className="py-2.5 px-3">
                          <span
                            className={`font-semibold ${
                              stock > 0 ? 'text-gray-700' : 'text-red-600 font-bold'
                            }`}
                          >
                            {stock > 0 ? `${stock} un.` : 'Sin stock'}
                          </span>
                        </td>

                        {/* Estado */}
                        <td className="py-2.5 px-3">
                          <button
                            type="button"
                            onClick={() => handleToggleVariant(product, variantType, option)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer transition-colors ${
                              item.active
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                            }`}
                          >
                            {item.active ? (
                              <>
                                <Check className="w-3 h-3" /> Activa
                              </>
                            ) : (
                              'Pausada'
                            )}
                          </button>
                        </td>

                        {/* Acciones */}
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {onOpenProductDetail && (
                              <button
                                type="button"
                                title="Ver cómo se abre la publicación"
                                onClick={() =>
                                  onOpenProductDetail(
                                    product,
                                    { [variantType.id]: option.name },
                                    image
                                  )
                                }
                                className="p-1.5 text-gray-500 hover:text-[#0058bb] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              title="Eliminar de tarjetas independientes"
                              onClick={() => handleRemoveItem(item.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
