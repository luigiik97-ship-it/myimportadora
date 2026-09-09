import React, { useState, useMemo } from 'react';
import { Product, VariantType, SizeVariant } from '../../types';
import { normalizeVariantTypes, syncLegacyFields } from '../../utils/variantHelpers';
import { updateProduct } from '../../services/supabase';
import {
  Percent,
  TrendingUp,
  TrendingDown,
  Check,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  Package,
  Layers,
  Filter,
  CheckSquare,
  Square,
  Sparkles,
} from 'lucide-react';

interface BulkPriceUpdateProps {
  products: Product[];
  onProductsUpdated: () => Promise<void> | void;
}

export interface PriceTargets {
  retail: boolean;
  wholesale: boolean;
  retailCash: boolean;
  wholesaleCash: boolean;
}

export const BulkPriceUpdate: React.FC<BulkPriceUpdateProps> = ({
  products,
  onProductsUpdated,
}) => {
  const [percentage, setPercentage] = useState<number | ''>(10);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [targets, setTargets] = useState<PriceTargets>({
    retail: true,
    wholesale: true,
    retailCash: true,
    wholesaleCash: true,
  });

  // Modal and execution state
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Categories extraction
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  // Filtered products to be updated
  const targetProducts = useMemo(() => {
    if (selectedCategory === 'all') return products;
    return products.filter((p) => p.category === selectedCategory);
  }, [products, selectedCategory]);

  const allTargetsSelected =
    targets.retail && targets.wholesale && targets.retailCash && targets.wholesaleCash;

  const handleToggleAllTargets = () => {
    if (allTargetsSelected) {
      setTargets({
        retail: false,
        wholesale: false,
        retailCash: false,
        wholesaleCash: false,
      });
    } else {
      setTargets({
        retail: true,
        wholesale: true,
        retailCash: true,
        wholesaleCash: true,
      });
    }
  };

  const hasAnyTargetSelected =
    targets.retail || targets.wholesale || targets.retailCash || targets.wholesaleCash;

  const calcNewPrice = (base: number, pct: number): number => {
    const multiplier = 1 + pct / 100;
    const calculated = base * multiplier;
    return Math.max(0, Math.round(calculated));
  };

  // Helper to calculate updated product prices
  const computeProductUpdates = (prod: Product, pct: number) => {
    const numPct = typeof pct === 'number' ? pct : 0;

    // 1. Calculate Base Prices
    const newRetailPrice = targets.retail
      ? calcNewPrice(prod.retailPrice || 0, numPct)
      : prod.retailPrice || 0;

    const newWholesalePrice = targets.wholesale
      ? calcNewPrice(prod.wholesalePrice || 0, numPct)
      : prod.wholesalePrice || 0;

    // Fallback: If cash price not set, use regular price
    const baseRetailCash =
      prod.retailCashPrice !== undefined && prod.retailCashPrice > 0
        ? prod.retailCashPrice
        : prod.cashPrice !== undefined && prod.cashPrice > 0
        ? prod.cashPrice
        : prod.retailPrice || 0;

    const newRetailCashPrice = targets.retailCash
      ? calcNewPrice(baseRetailCash, numPct)
      : prod.retailCashPrice ?? prod.cashPrice ?? (targets.retail ? newRetailPrice : prod.retailPrice);

    const baseWholesaleCash =
      prod.wholesaleCashPrice !== undefined && prod.wholesaleCashPrice > 0
        ? prod.wholesaleCashPrice
        : prod.cashPrice !== undefined && prod.cashPrice > 0
        ? prod.cashPrice
        : prod.wholesalePrice || 0;

    const newWholesaleCashPrice = targets.wholesaleCash
      ? calcNewPrice(baseWholesaleCash, numPct)
      : prod.wholesaleCashPrice ?? prod.cashPrice ?? (targets.wholesale ? newWholesalePrice : prod.wholesalePrice);

    // 2. Calculate Variants Updates
    const currentVariantTypes = normalizeVariantTypes(prod);
    const updatedVariantTypes: VariantType[] = currentVariantTypes.map((vt) => ({
      ...vt,
      options: vt.options.map((opt) => {
        const updatedOpt = { ...opt };

        if (targets.retail && opt.retailPrice !== undefined && opt.retailPrice > 0) {
          updatedOpt.retailPrice = calcNewPrice(opt.retailPrice, numPct);
        }

        if (targets.wholesale && opt.wholesalePrice !== undefined && opt.wholesalePrice > 0) {
          updatedOpt.wholesalePrice = calcNewPrice(opt.wholesalePrice, numPct);
        }

        if (targets.retailCash) {
          const optBaseRetailCash =
            opt.retailCashPrice !== undefined && opt.retailCashPrice > 0
              ? opt.retailCashPrice
              : opt.cashPrice !== undefined && opt.cashPrice > 0
              ? opt.cashPrice
              : opt.retailPrice !== undefined && opt.retailPrice > 0
              ? opt.retailPrice
              : baseRetailCash;
          if (optBaseRetailCash > 0) {
            updatedOpt.retailCashPrice = calcNewPrice(optBaseRetailCash, numPct);
            updatedOpt.cashPrice = updatedOpt.retailCashPrice;
          }
        }

        if (targets.wholesaleCash) {
          const optBaseWholesaleCash =
            opt.wholesaleCashPrice !== undefined && opt.wholesaleCashPrice > 0
              ? opt.wholesaleCashPrice
              : opt.cashPrice !== undefined && opt.cashPrice > 0
              ? opt.cashPrice
              : opt.wholesalePrice !== undefined && opt.wholesalePrice > 0
              ? opt.wholesalePrice
              : baseWholesaleCash;
          if (optBaseWholesaleCash > 0) {
            updatedOpt.wholesaleCashPrice = calcNewPrice(optBaseWholesaleCash, numPct);
          }
        }

        return updatedOpt;
      }),
    }));

    // 3. Size Variants
    const updatedSizeVariants: SizeVariant[] = (prod.sizeVariants || []).map((sv) => {
      const updatedSv = { ...sv };
      if (targets.retail && sv.retailPrice !== undefined && sv.retailPrice > 0) {
        updatedSv.retailPrice = calcNewPrice(sv.retailPrice, numPct);
      }
      if (targets.wholesale && sv.wholesalePrice !== undefined && sv.wholesalePrice > 0) {
        updatedSv.wholesalePrice = calcNewPrice(sv.wholesalePrice, numPct);
      }
      if (targets.retailCash) {
        const svBaseRetailCash =
          sv.retailCashPrice !== undefined && sv.retailCashPrice > 0
            ? sv.retailCashPrice
            : sv.cashPrice !== undefined && sv.cashPrice > 0
            ? sv.cashPrice
            : sv.retailPrice || baseRetailCash;
        updatedSv.retailCashPrice = calcNewPrice(svBaseRetailCash, numPct);
        updatedSv.cashPrice = updatedSv.retailCashPrice;
      }
      if (targets.wholesaleCash) {
        const svBaseWholesaleCash =
          sv.wholesaleCashPrice !== undefined && sv.wholesaleCashPrice > 0
            ? sv.wholesaleCashPrice
            : sv.cashPrice !== undefined && sv.cashPrice > 0
            ? sv.cashPrice
            : sv.wholesalePrice || baseWholesaleCash;
        updatedSv.wholesaleCashPrice = calcNewPrice(svBaseWholesaleCash, numPct);
      }
      return updatedSv;
    });

    const { colors, sizeVariants } = syncLegacyFields(
      updatedVariantTypes,
      newWholesalePrice,
      newRetailPrice,
      newRetailCashPrice,
      newRetailCashPrice,
      newWholesaleCashPrice
    );

    return {
      retailPrice: newRetailPrice,
      wholesalePrice: newWholesalePrice,
      retailCashPrice: newRetailCashPrice,
      wholesaleCashPrice: newWholesaleCashPrice,
      cashPrice: newRetailCashPrice,
      variantTypes: updatedVariantTypes,
      sizeVariants: sizeVariants.length > 0 ? sizeVariants : updatedSizeVariants,
      colors,
    };
  };

  // Preview data (first 4 products)
  const previewProducts = useMemo(() => {
    const pct = typeof percentage === 'number' ? percentage : 0;
    return targetProducts.slice(0, 5).map((p) => {
      const updates = computeProductUpdates(p, pct);
      return {
        original: p,
        updated: updates,
      };
    });
  }, [targetProducts, percentage, targets]);

  const handleApplyUpdates = async () => {
    if (typeof percentage !== 'number' || isNaN(percentage)) {
      alert('Por favor, ingresa un porcentaje numérico válido.');
      return;
    }

    if (!hasAnyTargetSelected) {
      alert('Debes seleccionar al menos un tipo de precio para actualizar.');
      return;
    }

    if (targetProducts.length === 0) {
      alert('No hay productos disponibles para actualizar en el alcance seleccionado.');
      return;
    }

    setIsExecuting(true);
    setIsConfirmModalOpen(false);
    setProgress({ current: 0, total: targetProducts.length });
    setSuccessMessage(null);
    setErrorMessage(null);

    let updatedCount = 0;
    const errors: string[] = [];

    try {
      for (let i = 0; i < targetProducts.length; i++) {
        const prod = targetProducts[i];
        const updates = computeProductUpdates(prod, percentage);

        try {
          await updateProduct(prod.id, updates);
          updatedCount++;
        } catch (err: any) {
          console.error(`Error actualizando producto ${prod.id} (${prod.title}):`, err);
          errors.push(prod.title || prod.id);
        }

        setProgress({ current: i + 1, total: targetProducts.length });
      }

      if (onProductsUpdated) {
        await onProductsUpdated();
      }

      if (errors.length > 0) {
        setErrorMessage(
          `Se actualizaron ${updatedCount} productos correctamente, pero hubo un error en ${errors.length} producto(s): ${errors.slice(0, 3).join(', ')}...`
        );
      } else {
        setSuccessMessage(
          `¡Actualización masiva completada con éxito! Se actualizaron correctamente los precios de ${updatedCount} producto(s).`
        );
      }
    } catch (e: any) {
      setErrorMessage(`Ocurrió un error durante la actualización masiva: ${e?.message || e}`);
    } finally {
      setIsExecuting(false);
      setProgress(null);
    }
  };

  const quickPercentages = [5, 10, 15, 20, 25, 30, -5, -10, -15, -20];

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#0058bb] flex items-center justify-center font-bold">
              <Percent className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 font-['Montserrat']">
              Actualización Masiva de Precios
            </h2>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Ajusta los precios de tus productos de forma porcentual (aumentos o descuentos) con guardado directo en la base de datos y compatibilidad total para variantes.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 text-xs">
          <Package className="w-4 h-4 text-gray-500" />
          <span className="text-gray-600">Total en catálogo:</span>
          <strong className="text-gray-900">{products.length} productos</strong>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-4 rounded-xl flex items-start gap-3 shadow-xs">
          <Check className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <strong className="font-bold block text-sm">Operación Exitosa</strong>
            <p>{successMessage}</p>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-xs p-4 rounded-xl flex items-start gap-3 shadow-xs">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <strong className="font-bold block text-sm">Atención</strong>
            <p>{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Controls Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs space-y-5">
        <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
          Configuración del Ajuste
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 1. Porcentaje */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-gray-700 block">
              1. Porcentaje a aplicar (%)
            </label>
            <div className="relative">
              <input
                id="bulk-percentage-input"
                type="number"
                step="any"
                value={percentage}
                onChange={(e) =>
                  setPercentage(e.target.value === '' ? '' : Number(e.target.value))
                }
                placeholder="Ej: 10 para +10% o -5 para -5%"
                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0058bb]"
              />
              <span className="absolute right-3 top-2.5 text-gray-400 font-bold text-sm">%</span>
            </div>

            {/* Quick buttons */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {quickPercentages.map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setPercentage(val)}
                  className={`text-[11px] font-semibold px-2 py-1 rounded-md border transition-colors cursor-pointer ${
                    percentage === val
                      ? val >= 0
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-red-600 text-white border-red-600'
                      : val >= 0
                      ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                      : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                  }`}
                >
                  {val > 0 ? `+${val}%` : `${val}%`}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Precios a los que se aplica */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-700 block">
                2. Precios a modificar
              </label>
              <button
                type="button"
                onClick={handleToggleAllTargets}
                className="text-[11px] text-[#0058bb] hover:underline font-semibold cursor-pointer"
              >
                {allTargetsSelected ? 'Desmarcar todos' : 'Seleccionar todos'}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2 bg-gray-50 p-3 rounded-lg border border-gray-200 text-xs">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={targets.retail}
                  onChange={(e) => setTargets({ ...targets, retail: e.target.checked })}
                  className="rounded text-[#0058bb] focus:ring-[#0058bb] h-4 w-4"
                />
                <span className="font-semibold text-gray-800">Precio Minorista</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={targets.wholesale}
                  onChange={(e) => setTargets({ ...targets, wholesale: e.target.checked })}
                  className="rounded text-[#0058bb] focus:ring-[#0058bb] h-4 w-4"
                />
                <span className="font-semibold text-gray-800">Precio Mayorista</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={targets.retailCash}
                  onChange={(e) => setTargets({ ...targets, retailCash: e.target.checked })}
                  className="rounded text-emerald-600 focus:ring-emerald-600 h-4 w-4"
                />
                <span className="font-semibold text-emerald-800">Precio en Efectivo Minorista</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={targets.wholesaleCash}
                  onChange={(e) => setTargets({ ...targets, wholesaleCash: e.target.checked })}
                  className="rounded text-teal-600 focus:ring-teal-600 h-4 w-4"
                />
                <span className="font-semibold text-teal-800">Precio en Efectivo Mayorista</span>
              </label>
            </div>
          </div>

          {/* 3. Alcance / Categoría */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-gray-700 block">
              3. Alcance de productos
            </label>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0058bb]"
            >
              <option value="all">Todos los productos ({products.length})</option>
              {categories.map((cat) => {
                const count = products.filter((p) => p.category === cat).length;
                return (
                  <option key={cat} value={cat}>
                    Categoría: {cat} ({count} productos)
                  </option>
                );
              })}
            </select>

            <div className="bg-blue-50/60 border border-blue-100 rounded-lg p-3 text-[11px] text-blue-900 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <Sparkles className="w-3.5 h-3.5 text-[#0058bb]" />
                <span>Productos a procesar: {targetProducts.length}</span>
              </div>
              <p className="text-gray-600 text-[10px] leading-relaxed">
                Si un producto no tiene precio en efectivo asignado, el sistema tomará automáticamente su precio normal como base de cálculo.
              </p>
            </div>
          </div>
        </div>

        {/* Action Button & Summary */}
        <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-gray-600 flex items-center gap-2">
            {typeof percentage === 'number' && percentage !== 0 ? (
              percentage > 0 ? (
                <span className="flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  <TrendingUp className="w-3.5 h-3.5" /> Aumento del +{percentage}%
                </span>
              ) : (
                <span className="flex items-center gap-1 text-red-700 font-bold bg-red-50 px-2.5 py-1 rounded-full border border-red-200">
                  <TrendingDown className="w-3.5 h-3.5" /> Descuento del {percentage}%
                </span>
              )
            ) : (
              <span className="text-gray-500 italic">Ingresa un porcentaje para calcular</span>
            )}
            <span>en {targetProducts.length} publicaciones</span>
          </div>

          <button
            id="open-bulk-price-confirm-btn"
            type="button"
            disabled={
              isExecuting ||
              typeof percentage !== 'number' ||
              percentage === 0 ||
              !hasAnyTargetSelected ||
              targetProducts.length === 0
            }
            onClick={() => setIsConfirmModalOpen(true)}
            className="w-full sm:w-auto bg-[#0058bb] hover:bg-[#004bb0] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold px-6 py-2.5 rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs"
          >
            <RefreshCw className="w-4 h-4" />
            Aplicar Actualización Masiva
          </button>
        </div>
      </div>

      {/* Live Preview Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs space-y-0">
        <div className="p-4 bg-gray-50/70 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">
              Vista previa del cálculo (Muestra de publicaciones)
            </span>
          </div>
          <span className="text-[11px] text-gray-500">
            Mostrando 5 de {targetProducts.length} productos
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-100/70 border-b border-gray-200 text-gray-700 font-bold uppercase text-[10px]">
              <tr>
                <th className="p-3">Producto</th>
                <th className="p-3">Mayorista</th>
                <th className="p-3">Minorista</th>
                <th className="p-3">Efec. Minorista</th>
                <th className="p-3">Efec. Mayorista</th>
                <th className="p-3 text-right">Variantes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {previewProducts.map(({ original, updated }) => {
                const variantTypes = normalizeVariantTypes(original);
                const hasVariants = variantTypes.length > 0;

                return (
                  <tr key={original.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="p-3">
                      <div className="font-bold text-gray-900 line-clamp-1">{original.title}</div>
                      <span className="text-[10px] text-gray-400">{original.category}</span>
                    </td>

                    {/* Wholesale */}
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <span className="line-through text-gray-400">
                          ${(original.wholesalePrice || 0).toLocaleString('es-AR')}
                        </span>
                        <ArrowRight className="w-3 h-3 text-gray-300" />
                        <span className={`font-bold ${targets.wholesale ? 'text-[#0058bb]' : 'text-gray-700'}`}>
                          ${updated.wholesalePrice.toLocaleString('es-AR')}
                        </span>
                      </div>
                    </td>

                    {/* Retail */}
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <span className="line-through text-gray-400">
                          ${(original.retailPrice || 0).toLocaleString('es-AR')}
                        </span>
                        <ArrowRight className="w-3 h-3 text-gray-300" />
                        <span className={`font-bold ${targets.retail ? 'text-[#0058bb]' : 'text-gray-700'}`}>
                          ${updated.retailPrice.toLocaleString('es-AR')}
                        </span>
                      </div>
                    </td>

                    {/* Retail Cash */}
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <span className="line-through text-gray-400">
                          ${(original.retailCashPrice || original.cashPrice || original.retailPrice || 0).toLocaleString('es-AR')}
                        </span>
                        <ArrowRight className="w-3 h-3 text-gray-300" />
                        <span className={`font-bold ${targets.retailCash ? 'text-emerald-700' : 'text-gray-700'}`}>
                          ${(updated.retailCashPrice || updated.retailPrice).toLocaleString('es-AR')}
                        </span>
                      </div>
                    </td>

                    {/* Wholesale Cash */}
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <span className="line-through text-gray-400">
                          ${(original.wholesaleCashPrice || original.cashPrice || original.wholesalePrice || 0).toLocaleString('es-AR')}
                        </span>
                        <ArrowRight className="w-3 h-3 text-gray-300" />
                        <span className={`font-bold ${targets.wholesaleCash ? 'text-teal-700' : 'text-gray-700'}`}>
                          ${(updated.wholesaleCashPrice || updated.wholesalePrice).toLocaleString('es-AR')}
                        </span>
                      </div>
                    </td>

                    <td className="p-3 text-right">
                      {hasVariants ? (
                        <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 font-semibold px-2 py-0.5 rounded text-[10px]">
                          <Layers className="w-3 h-3" />
                          {variantTypes.reduce((acc, vt) => acc + (vt.options || []).length, 0)} opciones
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-400">Sin variantes</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 font-['Montserrat']">
                  Confirmar Actualización Masiva
                </h3>
                <p className="text-xs text-gray-500">
                  Esta acción modificará los precios en la base de datos de manera definitiva.
                </p>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2.5 text-xs text-gray-700">
              <div className="flex justify-between pb-2 border-b border-gray-200">
                <span className="font-semibold text-gray-500">Porcentaje:</span>
                <strong className="text-sm font-bold text-[#0058bb]">
                  {typeof percentage === 'number' && percentage > 0 ? `+${percentage}%` : `${percentage}%`}
                </strong>
              </div>

              <div className="flex justify-between pb-2 border-b border-gray-200">
                <span className="font-semibold text-gray-500">Productos afectados:</span>
                <strong>{targetProducts.length} publicaciones</strong>
              </div>

              <div className="flex justify-between pb-2 border-b border-gray-200">
                <span className="font-semibold text-gray-500">Alcance:</span>
                <span>{selectedCategory === 'all' ? 'Todo el catálogo' : `Categoría: ${selectedCategory}`}</span>
              </div>

              <div className="pt-1">
                <span className="font-semibold text-gray-500 block mb-1">Precios a modificar:</span>
                <ul className="list-disc list-inside space-y-0.5 text-gray-800">
                  {targets.retail && <li>Precio Minorista</li>}
                  {targets.wholesale && <li>Precio Mayorista</li>}
                  {targets.retailCash && <li>Precio en Efectivo Minorista</li>}
                  {targets.wholesaleCash && <li>Precio en Efectivo Mayorista</li>}
                </ul>
              </div>
            </div>

            <p className="text-[11px] text-gray-500">
              ✓ Incluye recálculo y actualización de precios en todas las variantes y opciones hijas.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                id="confirm-bulk-price-execute-btn"
                type="button"
                onClick={handleApplyUpdates}
                className="px-5 py-2.5 text-xs font-bold text-white bg-[#0058bb] hover:bg-[#004bb0] rounded-lg transition-colors cursor-pointer shadow-xs"
              >
                Sí, Confirmar y Aplicar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Execution Progress Overlay */}
      {isExecuting && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 text-center space-y-4">
            <RefreshCw className="w-10 h-10 text-[#0058bb] animate-spin mx-auto" />
            <div>
              <h3 className="text-base font-bold text-gray-900 font-['Montserrat']">
                Actualizando Precios...
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Por favor espera mientras se guardan los nuevos valores en la base de datos.
              </p>
            </div>

            {progress && (
              <div className="space-y-2">
                <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-[#0058bb] h-2.5 rounded-full transition-all duration-200"
                    style={{
                      width: `${Math.round((progress.current / progress.total) * 100)}%`,
                    }}
                  />
                </div>
                <span className="text-xs font-bold text-gray-700">
                  {progress.current} de {progress.total} productos procesados (
                  {Math.round((progress.current / progress.total) * 100)}%)
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
