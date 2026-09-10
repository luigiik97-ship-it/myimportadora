import React, { useState, useEffect } from 'react';
import { Category, Product } from '../../types';
import {
  fetchCategories,
  saveCategory,
  deleteCategory,
  reorderCategories,
  uploadCategoryImage,
  deleteStorageImageIfUnused,
  isSupabaseConfigured,
} from '../../services/supabase';
import { slugifyCategory, countProductsInCategory } from '../../utils/categoryHelpers';
import { INITIAL_CATEGORIES } from '../../data/initialCategories';
import {
  Plus,
  Edit2,
  Trash2,
  Upload,
  Image as ImageIcon,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Check,
  RefreshCw,
  Sparkles,
  Search,
  ExternalLink,
  Layers,
  HelpCircle,
} from 'lucide-react';

interface CategoryManagerProps {
  products: Product[];
  onCategoriesUpdated?: (categories: Category[]) => void;
  onProductsUpdated?: () => Promise<void> | void;
}

export const CategoryManager: React.FC<CategoryManagerProps> = ({
  products,
  onCategoriesUpdated,
  onProductsUpdated,
}) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // Deletion modal state (replaces window.confirm)
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [isDeletingCategory, setIsDeletingCategory] = useState<boolean>(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);

  // Edit / Create Modal state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingCategory, setEditingCategory] = useState<Partial<Category> | null>(null);
  const [imageUrlInput, setImageUrlInput] = useState<string>('');
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load categories
  const loadCategories = async () => {
    setLoading(true);
    try {
      const data = await fetchCategories();
      setCategories(data);
      if (onCategoriesUpdated) onCategoriesUpdated(data);
    } catch (err: any) {
      console.error('[CategoryManager] Error loading categories:', err);
      showFeedback('error', 'Error al cargar las categorías');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();

    const handleCategoriesUpdated = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) {
        setCategories([...e.detail].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)));
      }
    };

    window.addEventListener('categories-updated', handleCategoriesUpdated);
    return () => {
      window.removeEventListener('categories-updated', handleCategoriesUpdated);
    };
  }, []);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedbackMessage({ type, text });
    setTimeout(() => setFeedbackMessage(null), 3500);
  };

  const handleOpenCreateModal = () => {
    const nextOrder = categories.length > 0 ? Math.max(...categories.map((c) => c.sortOrder || 0)) + 1 : 1;
    setEditingCategory({
      id: `cat-${Date.now()}`,
      name: '',
      slug: '',
      image: '',
      sortOrder: nextOrder,
      isVisible: true,
      description: '',
    });
    setImageUrlInput('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (cat: Category) => {
    setEditingCategory({ ...cat });
    setImageUrlInput(cat.image || '');
    setIsModalOpen(true);
  };

  const handleNameChange = (name: string) => {
    if (!editingCategory) return;
    const isNew = !categories.some((c) => c.id === editingCategory.id);
    const autoSlug = isNew || !editingCategory.slug ? slugifyCategory(name) : editingCategory.slug;
    setEditingCategory({
      ...editingCategory,
      name,
      slug: autoSlug,
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingCategory) return;

    const previousImage = editingCategory.image;
    setIsUploading(true);
    try {
      const uploadedUrl = await uploadCategoryImage(file);
      setEditingCategory({
        ...editingCategory,
        image: uploadedUrl,
      });
      setImageUrlInput(uploadedUrl);
      showFeedback('success', 'Imagen subida correctamente');

      if (previousImage && previousImage !== uploadedUrl) {
        deleteStorageImageIfUnused(previousImage, products, categories);
      }
    } catch (err: any) {
      console.error('[CategoryManager] Error uploading category image:', err);
      showFeedback('error', `Error al subir la imagen: ${err.message || 'Desconocido'}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleApplyImageUrl = () => {
    if (!editingCategory || !imageUrlInput.trim()) return;
    setEditingCategory({
      ...editingCategory,
      image: imageUrlInput.trim(),
    });
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !editingCategory.name?.trim()) {
      showFeedback('error', 'El nombre de la categoría es obligatorio');
      return;
    }

    const payload: Category = {
      id: editingCategory.id || `cat-${Date.now()}`,
      name: editingCategory.name.trim(),
      slug: editingCategory.slug?.trim() || slugifyCategory(editingCategory.name),
      image: editingCategory.image?.trim() || 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=400&auto=format&fit=crop&q=80',
      sortOrder: Number(editingCategory.sortOrder) || 0,
      isVisible: editingCategory.isVisible !== false,
      description: editingCategory.description?.trim() || '',
    };

    setIsSaving(true);
    try {
      const saved = await saveCategory(payload);
      let nextCategories: Category[] = [];
      setCategories((prev) => {
        const index = prev.findIndex(
          (c) => c.id === saved.id || c.slug === saved.slug || c.name.toLowerCase() === saved.name.toLowerCase()
        );
        let updated: Category[];
        if (index >= 0) {
          updated = [...prev];
          updated[index] = saved;
        } else {
          updated = [...prev, saved];
        }
        nextCategories = updated.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        return nextCategories;
      });
      setIsModalOpen(false);
      setEditingCategory(null);
      showFeedback('success', `Categoría "${saved.name}" guardada correctamente`);
      if (onCategoriesUpdated) {
        onCategoriesUpdated(nextCategories);
      }
    } catch (err: any) {
      console.error('[CategoryManager] Error saving category:', err);
      showFeedback('error', `Error al guardar: ${err.message || 'Desconocido'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenDeleteModal = (cat: Category) => {
    setCategoryToDelete(cat);
  };

  const confirmDeleteCategory = async () => {
    if (!categoryToDelete) return;
    setIsDeletingCategory(true);
    try {
      const result = await deleteCategory(categoryToDelete.id, categoryToDelete.name);
      await loadCategories();
      if (onProductsUpdated) {
        await onProductsUpdated();
      }
      showFeedback(
        'success',
        `Categoría "${categoryToDelete.name}" eliminada correctamente.${
          result.affectedProductsCount > 0
            ? ` ${result.affectedProductsCount} publicación(es) cambiaron automáticamente a la categoría "Otros".`
            : ''
        }`
      );
      setCategoryToDelete(null);
    } catch (err: any) {
      console.error('[CategoryManager] Error deleting category:', err);
      showFeedback('error', `Error al eliminar categoría: ${err.message || 'Error desconocido'}`);
    } finally {
      setIsDeletingCategory(false);
    }
  };

  const handleToggleVisibility = async (cat: Category) => {
    const updated: Category = {
      ...cat,
      isVisible: !cat.isVisible,
    };
    try {
      await saveCategory(updated);
      setCategories((prev) => {
        const next = prev.map((c) => (c.id === cat.id ? updated : c));
        if (onCategoriesUpdated) onCategoriesUpdated(next);
        return next;
      });
      showFeedback('success', `Categoría "${cat.name}" ahora está ${updated.isVisible ? 'Visible' : 'Oculta'}`);
    } catch (err: any) {
      showFeedback('error', 'Error al cambiar visibilidad');
    }
  };

  const handleMoveOrder = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= categories.length) return;

    const newOrderList = [...categories];
    const temp = newOrderList[index];
    newOrderList[index] = newOrderList[targetIndex];
    newOrderList[targetIndex] = temp;

    // Re-assign sortOrder values sequentially
    const updatedWithOrder = newOrderList.map((cat, idx) => ({
      ...cat,
      sortOrder: idx + 1,
    }));

    setCategories(updatedWithOrder);
    try {
      await reorderCategories(updatedWithOrder);
      showFeedback('success', 'Orden de categorías actualizado');
      if (onCategoriesUpdated) onCategoriesUpdated(updatedWithOrder);
    } catch (err: any) {
      console.error('[CategoryManager] Error reordering:', err);
      showFeedback('error', 'Error al guardar el nuevo orden');
    }
  };

  const handleOpenResetModal = () => {
    setShowResetConfirmModal(true);
  };

  const confirmResetDefaults = async () => {
    setIsResetting(true);
    setLoading(true);
    try {
      for (const cat of INITIAL_CATEGORIES) {
        await saveCategory(cat);
      }
      await loadCategories();
      showFeedback('success', 'Categorías predeterminadas restauradas con éxito');
      setShowResetConfirmModal(false);
    } catch (err: any) {
      showFeedback('error', 'Error al restaurar categorías');
    } finally {
      setLoading(false);
      setIsResetting(false);
    }
  };

  const filteredCategories = categories.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.description && c.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Feedback Toast */}
      {feedbackMessage && (
        <div
          className={`p-3 rounded-lg text-xs font-semibold flex items-center justify-between shadow-sm animate-fadeIn ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          <span>{feedbackMessage.text}</span>
          <button onClick={() => setFeedbackMessage(null)} className="text-gray-400 hover:text-gray-600">
            ×
          </button>
        </div>
      )}

      {/* Top Header & Actions */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#0058bb]" />
            <h2 className="text-lg font-bold text-gray-900 font-['Montserrat']">
              Gestión de Categorías Independientes
            </h2>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Personaliza las imágenes, nombres, orden y visibilidad de cada categoría en la portada. Cada categoría tiene su propia imagen dedicada sin depender de las fotos de los productos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadCategories}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            title="Recargar categorías"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleOpenResetModal}
            className="text-xs font-semibold text-gray-600 hover:text-gray-900 border border-gray-200 bg-gray-50 hover:bg-gray-100 px-3 py-2 rounded-lg transition-colors cursor-pointer"
          >
            Restaurar base
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="bg-[#0058bb] hover:bg-[#004bb0] text-white text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Categoría</span>
          </button>
        </div>
      </div>

      {/* Search & Stats Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-gray-200 shadow-xs">
        <div className="relative max-w-sm flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre o slug..."
            className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0058bb] focus:bg-white transition-all"
          />
        </div>

        <div className="flex items-center gap-3 text-xs text-gray-500 font-medium">
          <span>
            Total: <strong className="text-gray-900">{categories.length}</strong>
          </span>
          <span>•</span>
          <span>
            Visibles en Portada:{' '}
            <strong className="text-[#00a650]">{categories.filter((c) => c.isVisible !== false).length}</strong>
          </span>
          <span>•</span>
          <span>
            Ocultas:{' '}
            <strong className="text-gray-400">{categories.filter((c) => c.isVisible === false).length}</strong>
          </span>
        </div>
      </div>

      {/* Categories Table / Cards List */}
      {loading ? (
        <div className="bg-white p-12 text-center rounded-xl border border-gray-200 text-gray-500 text-xs">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#0058bb] mb-2" />
          Cargando categorías...
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="bg-white p-10 text-center rounded-xl border border-gray-200 text-gray-500 space-y-3">
          <Layers className="w-10 h-10 text-gray-300 mx-auto" />
          <p className="text-sm font-semibold text-gray-700">No hay categorías que coincidan</p>
          <button
            onClick={handleOpenCreateModal}
            className="text-xs font-bold text-[#0058bb] hover:underline"
          >
            + Crear la primera categoría
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4 w-14 text-center">Orden</th>
                  <th className="py-3 px-4 w-20">Imagen</th>
                  <th className="py-3 px-4">Nombre / Slug</th>
                  <th className="py-3 px-4 w-28 text-center">Productos</th>
                  <th className="py-3 px-4 w-28 text-center">Estado</th>
                  <th className="py-3 px-4 w-40 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCategories.map((cat, index) => {
                  const prodsCount = countProductsInCategory(cat.name, products, cat.slug);
                  const isVisible = cat.isVisible !== false;

                  return (
                    <tr
                      key={cat.id ? `${cat.id}-${index}` : `cat-${index}`}
                      className={`hover:bg-gray-50/80 transition-colors ${
                        !isVisible ? 'bg-gray-50/50 opacity-75' : ''
                      }`}
                    >
                      {/* Order Controls */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleMoveOrder(index, 'up')}
                            disabled={index === 0}
                            className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20 disabled:hover:text-gray-400 cursor-pointer rounded hover:bg-gray-200"
                            title="Mover arriba"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <span className="font-bold text-gray-700 w-4 text-center">{index + 1}</span>
                          <button
                            onClick={() => handleMoveOrder(index, 'down')}
                            disabled={index === categories.length - 1}
                            className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20 disabled:hover:text-gray-400 cursor-pointer rounded hover:bg-gray-200"
                            title="Mover abajo"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* Independent Dedicated Image Preview */}
                      <td className="py-3 px-4">
                        <div className="w-12 h-12 rounded-lg overflow-hidden border border-gray-200 bg-gray-100 flex items-center justify-center relative group">
                          {cat.image ? (
                            <img
                              src={cat.image}
                              alt={cat.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <ImageIcon className="w-5 h-5 text-gray-300" />
                          )}
                        </div>
                      </td>

                      {/* Name & Slug */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-gray-900 text-sm">{cat.name}</div>
                        <div className="text-[11px] text-gray-400 font-mono">slug: {cat.slug}</div>
                        {cat.description && (
                          <div className="text-[11px] text-gray-500 line-clamp-1 mt-0.5">
                            {cat.description}
                          </div>
                        )}
                      </td>

                      {/* Associated Products Count in Database */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            prodsCount > 0
                              ? 'bg-blue-50 text-[#0058bb] border border-blue-100'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {prodsCount} {prodsCount === 1 ? 'artículo' : 'artículos'}
                        </span>
                      </td>

                      {/* Visibility Toggle Badge */}
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleToggleVisibility(cat)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold cursor-pointer transition-all ${
                            isVisible
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                              : 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200'
                          }`}
                          title={isVisible ? 'Visible en la portada (Clic para ocultar)' : 'Oculto en la portada (Clic para mostrar)'}
                        >
                          {isVisible ? (
                            <>
                              <Eye className="w-3 h-3 text-[#00a650]" />
                              <span>Visible</span>
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3 h-3 text-gray-400" />
                              <span>Oculto</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEditModal(cat)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Editar categoría e imagen"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            id={`delete-category-btn-${cat.id}`}
                            onClick={() => handleOpenDeleteModal(cat)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Eliminar categoría"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: EDIT / CREATE CATEGORY */}
      {isModalOpen && editingCategory && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-gray-200 animate-scaleIn my-8">
            <div className="p-5 bg-gradient-to-r from-gray-900 to-gray-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#0058bb]" />
                <h3 className="text-base font-bold font-['Montserrat']">
                  {categories.some((c) => c.id === editingCategory.id)
                    ? `Editar Categoría: ${editingCategory.name}`
                    : 'Nueva Categoría Independiente'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-white text-lg font-bold cursor-pointer"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Category Name */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Nombre de la Categoría *
                </label>
                <input
                  type="text"
                  required
                  value={editingCategory.name || ''}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="ej: Pulseras, Anillos, Cubanas..."
                  className="w-full border border-gray-300 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0058bb]"
                />
              </div>

              {/* Slug Identifier */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Slug URL / Identificador
                </label>
                <input
                  type="text"
                  required
                  value={editingCategory.slug || ''}
                  onChange={(e) =>
                    setEditingCategory({ ...editingCategory, slug: slugifyCategory(e.target.value) })
                  }
                  placeholder="ej: pulseras, anillos, cubanas"
                  className="w-full border border-gray-300 bg-gray-50 rounded-lg px-3.5 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#0058bb]"
                />
                <span className="text-[11px] text-gray-400 mt-1 block">
                  Usado para vincular los productos de la base de datos con esta categoría.
                </span>
              </div>

              {/* Independent Category Image Section */}
              <div className="space-y-2 border border-gray-200 rounded-xl p-3.5 bg-gray-50/50">
                <label className="block text-xs font-bold text-gray-700 uppercase">
                  Imagen Propia de la Categoría (Independiente de los productos)
                </label>
                <p className="text-[11px] text-gray-500">
                  Esta imagen se mostrará en la fila horizontal deslizable de la portada y en la cabecera de la categoría.
                </p>

                {/* Image Preview & Upload Controls */}
                <div className="flex items-start gap-4 pt-1">
                  <div className="w-24 h-24 rounded-xl overflow-hidden border border-gray-300 bg-white shrink-0 flex items-center justify-center shadow-xs">
                    {editingCategory.image ? (
                      <img
                        src={editingCategory.image}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-gray-300" />
                    )}
                  </div>

                  <div className="flex-1 space-y-2">
                    {/* File Upload to Supabase Storage */}
                    <div>
                      <label className="inline-flex items-center gap-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold px-3 py-1.5 rounded-lg shadow-2xs cursor-pointer transition-colors">
                        <Upload className="w-3.5 h-3.5 text-[#0058bb]" />
                        <span>{isUploading ? 'Subiendo archivo...' : 'Subir imagen desde PC'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileUpload}
                          disabled={isUploading}
                          className="hidden"
                        />
                      </label>
                    </div>

                    {/* URL Input */}
                    <div className="flex gap-1.5">
                      <input
                        type="url"
                        value={imageUrlInput}
                        onChange={(e) => setImageUrlInput(e.target.value)}
                        placeholder="https://... URL directa de imagen"
                        className="flex-1 border border-gray-300 bg-white rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#0058bb]"
                      />
                      <button
                        type="button"
                        onClick={handleApplyImageUrl}
                        className="bg-gray-800 hover:bg-gray-900 text-white text-xs font-semibold px-2.5 py-1 rounded-lg cursor-pointer"
                      >
                        Aplicar
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Descripción (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={editingCategory.description || ''}
                  onChange={(e) =>
                    setEditingCategory({ ...editingCategory, description: e.target.value })
                  }
                  placeholder="Breve detalle sobre los artículos de esta categoría..."
                  className="w-full border border-gray-300 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#0058bb]"
                />
              </div>

              {/* Sort Order and Visibility */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Posición / Orden
                  </label>
                  <input
                    type="number"
                    value={editingCategory.sortOrder || 1}
                    onChange={(e) =>
                      setEditingCategory({ ...editingCategory, sortOrder: Number(e.target.value) })
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0058bb]"
                  />
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-800 select-none">
                    <input
                      type="checkbox"
                      checked={editingCategory.isVisible !== false}
                      onChange={(e) =>
                        setEditingCategory({ ...editingCategory, isVisible: e.target.checked })
                      }
                      className="w-4 h-4 text-[#0058bb] rounded border-gray-300 focus:ring-[#0058bb]"
                    />
                    <span>Mostrar en Portada</span>
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving || isUploading}
                  className="bg-[#0058bb] hover:bg-[#004bb0] disabled:bg-gray-400 text-white text-xs font-bold px-5 py-2 rounded-lg cursor-pointer shadow-sm transition-colors flex items-center gap-1.5"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Guardar Categoría</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Category Confirmation Modal */}
      {categoryToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-100">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-gray-900 text-center font-['Montserrat']">
              ¿Eliminar la categoría "{categoryToDelete.name}"?
            </h3>

            {(() => {
              const count = countProductsInCategory(categoryToDelete.name, products);
              return count > 0 ? (
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 leading-relaxed">
                  <p className="font-semibold mb-1">
                    ⚠️ Esta categoría contiene {count} {count === 1 ? 'publicación' : 'publicaciones'}.
                  </p>
                  <p>
                    Para no perder tus publicaciones, el sistema las reasignará automáticamente a la categoría <span className="font-bold text-gray-900">"Otros"</span> de manera inmediata.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-gray-500 text-center mt-2 leading-relaxed">
                  Esta categoría no tiene publicaciones asociadas actualmente. Se eliminará de la base de datos y de la portada.
                </p>
              );
            })()}

            <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-gray-100">
              <button
                type="button"
                disabled={isDeletingCategory}
                onClick={() => setCategoryToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                id="confirm-delete-category-btn"
                disabled={isDeletingCategory}
                onClick={confirmDeleteCategory}
                className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer shadow-sm transition-colors flex items-center gap-1.5"
              >
                {isDeletingCategory ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirmar Eliminación</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Categories Modal */}
      {showResetConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-100">
            <div className="w-12 h-12 rounded-full bg-blue-100 text-[#0058bb] flex items-center justify-center mx-auto mb-4">
              <RefreshCw className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-gray-900 text-center font-['Montserrat']">
              ¿Restaurar categorías predeterminadas?
            </h3>
            <p className="text-xs text-gray-500 text-center mt-2 leading-relaxed">
              Esto restaurará el conjunto inicial de categorías con sus fotos predeterminadas sin borrar tus productos existentes.
            </p>

            <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-gray-100">
              <button
                type="button"
                disabled={isResetting}
                onClick={() => setShowResetConfirmModal(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                id="confirm-reset-categories-btn"
                disabled={isResetting}
                onClick={confirmResetDefaults}
                className="bg-[#0058bb] hover:bg-[#004bb0] disabled:bg-gray-400 text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer shadow-sm transition-colors flex items-center gap-1.5"
              >
                {isResetting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Restaurando...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Restaurar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
