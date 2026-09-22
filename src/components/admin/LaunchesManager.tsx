import React, { useState, useEffect, useRef } from 'react';
import {
  Rocket,
  Plus,
  Edit2,
  Trash2,
  Upload,
  ArrowUp,
  ArrowDown,
  BarChart3,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Eye,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { LaunchCollection, LaunchCustomerProposal, LaunchModel } from '../../types';
import {
  fetchLaunchCollections,
  saveLaunchCollection,
  deleteLaunchCollection,
  fetchCustomerProposals,
  updateProposalStatus,
  deleteCustomerProposal,
  convertProposalToModel,
} from '../../services/launches';
import { uploadProductImage } from '../../services/supabase';

export const LaunchesManager: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'collections' | 'stats' | 'proposals'>('collections');
  const [collections, setCollections] = useState<LaunchCollection[]>([]);
  const [proposals, setProposals] = useState<LaunchCustomerProposal[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [messageToast, setMessageToast] = useState<string | null>(null);

  // Collection modal state
  const [isColModalOpen, setIsColModalOpen] = useState(false);
  const [editingCol, setEditingCol] = useState<LaunchCollection | null>(null);
  const [colTitle, setColTitle] = useState('');
  const [colDesc, setColDesc] = useState('');
  const [colStatus, setColStatus] = useState<'active' | 'coming_soon' | 'paused'>('active');

  // Proposal preview image modal
  const [zoomedProposalImg, setZoomedProposalImg] = useState<string | null>(null);

  // Hidden file input for uploading images to a model
  const [targetModelForUpload, setTargetModelForUpload] = useState<{ colId: string; modelId: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    setIsLoading(true);
    const [cols, props] = await Promise.all([fetchLaunchCollections(), fetchCustomerProposals()]);
    setCollections(cols);
    setProposals(props);
    if (cols.length > 0 && !selectedCollectionId) {
      setSelectedCollectionId(cols[0].id);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const showToast = (msg: string) => {
    setMessageToast(msg);
    setTimeout(() => setMessageToast(null), 3500);
  };

  const selectedCollection = collections.find((c) => c.id === selectedCollectionId) || collections[0] || null;

  const pendingProposalsCount = proposals.filter((p) => p.status === 'pending').length;

  // ---------------- COLLECTIONS ACTIONS ---------------- //
  const handleOpenCreateCollection = () => {
    setEditingCol(null);
    setColTitle('');
    setColDesc('');
    setColStatus('active');
    setIsColModalOpen(true);
  };

  const handleOpenEditCollection = (col: LaunchCollection) => {
    setEditingCol(col);
    setColTitle(col.title);
    setColDesc(col.description || '');
    setColStatus(col.status as any);
    setIsColModalOpen(true);
  };

  const handleSaveCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!colTitle.trim()) {
      alert('Por favor ingresá un título para la colección');
      return;
    }

    if (editingCol) {
      const updated: LaunchCollection = {
        ...editingCol,
        title: colTitle.trim(),
        description: colDesc.trim(),
        status: colStatus,
      };
      const newCols = await saveLaunchCollection(updated);
      setCollections(newCols);
      showToast('Colección actualizada correctamente.');
    } else {
      const newCol: LaunchCollection = {
        id: `col-${Date.now()}`,
        title: colTitle.trim(),
        description: colDesc.trim(),
        status: colStatus,
        allowCustomerProposals: true,
        createdAt: new Date().toISOString(),
        models: [
          {
            id: `model-${Date.now()}-a`,
            letter: 'A',
            image: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=800&auto=format&fit=crop&q=80',
            sortOrder: 1,
            votes: { level1: 0, level2: 0, level3: 0, total: 0 },
          },
          {
            id: `model-${Date.now()}-b`,
            letter: 'B',
            image: 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=800&auto=format&fit=crop&q=80',
            sortOrder: 2,
            votes: { level1: 0, level2: 0, level3: 0, total: 0 },
          },
        ],
      };
      const newCols = await saveLaunchCollection(newCol);
      setCollections(newCols);
      setSelectedCollectionId(newCol.id);
      showToast('Nueva colección creada.');
    }

    setIsColModalOpen(false);
  };

  const handleDeleteCollection = async (colId: string) => {
    if (!confirm('¿Estás seguro de eliminar esta colección y todos sus modelos?')) return;
    const updated = await deleteLaunchCollection(colId);
    setCollections(updated);
    if (selectedCollectionId === colId) {
      setSelectedCollectionId(updated[0]?.id || '');
    }
    showToast('Colección eliminada.');
  };

  // ---------------- MODEL ACTIONS ---------------- //
  const handleAddModel = async (colId: string) => {
    const col = collections.find((c) => c.id === colId);
    if (!col) return;

    const nextCode = 65 + col.models.length; // 65 = 'A'
    const nextLetter = String.fromCharCode(nextCode);

    const newModel: LaunchModel = {
      id: `model-${Date.now()}-${nextLetter.toLowerCase()}`,
      letter: nextLetter,
      image: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=800&auto=format&fit=crop&q=80',
      sortOrder: col.models.length + 1,
      votes: { level1: 0, level2: 0, level3: 0, total: 0 },
    };

    const updatedCol: LaunchCollection = {
      ...col,
      models: [...col.models, newModel],
    };

    const updatedCols = await saveLaunchCollection(updatedCol);
    setCollections(updatedCols);
    showToast(`Modelo ${nextLetter} agregado a la colección.`);
  };

  const handleDeleteModel = async (colId: string, modelId: string) => {
    const col = collections.find((c) => c.id === colId);
    if (!col) return;
    if (!confirm('¿Eliminar este modelo?')) return;

    // Filter and re-letter models to maintain clean sequence A, B, C, D...
    const remaining = col.models.filter((m) => m.id !== modelId);
    const reordered = remaining.map((m, idx) => ({
      ...m,
      letter: String.fromCharCode(65 + idx),
      sortOrder: idx + 1,
    }));

    const updatedCol: LaunchCollection = {
      ...col,
      models: reordered,
    };

    const updatedCols = await saveLaunchCollection(updatedCol);
    setCollections(updatedCols);
    showToast('Modelo eliminado.');
  };

  const handleMoveModel = async (colId: string, modelIndex: number, direction: 'up' | 'down') => {
    const col = collections.find((c) => c.id === colId);
    if (!col) return;

    const newModels = [...col.models];
    const targetIndex = direction === 'up' ? modelIndex - 1 : modelIndex + 1;
    if (targetIndex < 0 || targetIndex >= newModels.length) return;

    // Swap items
    const temp = newModels[modelIndex];
    newModels[modelIndex] = newModels[targetIndex];
    newModels[targetIndex] = temp;

    // Re-assign letters according to new position A, B, C...
    const normalized = newModels.map((m, idx) => ({
      ...m,
      letter: String.fromCharCode(65 + idx),
      sortOrder: idx + 1,
    }));

    const updatedCol: LaunchCollection = {
      ...col,
      models: normalized,
    };

    const updatedCols = await saveLaunchCollection(updatedCol);
    setCollections(updatedCols);
  };

  const triggerUploadImageForModel = (colId: string, modelId: string) => {
    setTargetModelForUpload({ colId, modelId });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileUploaded = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !targetModelForUpload) return;

    setIsUploadingImage(true);
    try {
      const uploadedUrl = await uploadProductImage(file, { isCover: true, maxDimension: 1200 });
      const col = collections.find((c) => c.id === targetModelForUpload.colId);
      if (col) {
        const updatedModels = col.models.map((m) =>
          m.id === targetModelForUpload.modelId ? { ...m, image: uploadedUrl } : m
        );
        const updatedCol = { ...col, models: updatedModels };
        const updatedCols = await saveLaunchCollection(updatedCol);
        setCollections(updatedCols);
        showToast('Foto del modelo actualizada.');
      }
    } catch (err: any) {
      alert('Error al subir imagen: ' + err.message);
    } finally {
      setIsUploadingImage(false);
      setTargetModelForUpload(null);
    }
  };

  // ---------------- PROPOSALS ACTIONS ---------------- //
  const handleApproveProposal = async (proposalId: string) => {
    const updatedProps = await updateProposalStatus(proposalId, 'approved', 'Aprobada por el administrador');
    setProposals(updatedProps);
    showToast('Propuesta aprobada.');
  };

  const handleRejectProposal = async (proposalId: string) => {
    const reason = prompt('Motivo del rechazo (opcional):', 'No disponible con proveedores actualmente');
    const updatedProps = await updateProposalStatus(proposalId, 'rejected', reason || 'Rechazada');
    setProposals(updatedProps);
    showToast('Propuesta rechazada.');
  };

  const handleDeleteProposal = async (proposalId: string) => {
    if (!confirm('¿Eliminar esta propuesta?')) return;
    const updatedProps = await deleteCustomerProposal(proposalId);
    setProposals(updatedProps);
    showToast('Propuesta eliminada.');
  };

  const handleConvertToModel = async (proposalId: string, targetColId: string) => {
    try {
      const { collections: newCols, proposals: newProps } = await convertProposalToModel(
        proposalId,
        targetColId
      );
      setCollections(newCols);
      setProposals(newProps);
      showToast('¡Propuesta convertida en un nuevo modelo en votación!');
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hidden file input for model image changes */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUploaded}
        accept="image/png,image/jpeg,image/webp,image/jpg"
        className="hidden"
      />

      {/* Toast Alert */}
      {messageToast && (
        <div className="fixed top-6 right-6 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="bg-gray-900 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-xs sm:text-sm font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{messageToast}</span>
          </div>
        </div>
      )}

      {/* Top Header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0058bb]/10 text-[#0058bb] flex items-center justify-center">
            <Rocket className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 font-['Montserrat']">
              Gestión de Próximos Lanzamientos
            </h2>
            <p className="text-xs text-gray-500">
              Colecciones, modelos por letras A/B/C/D/E, estadísticas de apoyo y propuestas de clientes
            </p>
          </div>
        </div>

        {/* Sub-tab Navigation */}
        <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl border border-gray-200">
          <button
            type="button"
            onClick={() => setActiveSubTab('collections')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'collections'
                ? 'bg-white text-gray-900 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Colecciones y Modelos
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('stats')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'stats'
                ? 'bg-white text-gray-900 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-[#0058bb]" />
            <span>Estadísticas de Apoyo</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('proposals')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'proposals'
                ? 'bg-white text-gray-900 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-amber-600" />
            <span>Propuestas</span>
            {pendingProposalsCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                {pendingProposalsCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ---------------- SUB-TAB 1: COLECCIONES Y MODELOS ---------------- */}
      {activeSubTab === 'collections' && (
        <div className="space-y-6">
          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Collection Dropdown / Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              {collections.map((col) => {
                const isSelected = col.id === selectedCollection?.id;
                return (
                  <button
                    key={col.id}
                    onClick={() => setSelectedCollectionId(col.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#0058bb] text-white border-[#0058bb] shadow-xs'
                        : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-200'
                    }`}
                  >
                    {col.title} ({col.models.length})
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleOpenCreateCollection}
              className="px-4 py-2 bg-[#0058bb] hover:bg-[#004696] text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Colección</span>
            </button>
          </div>

          {selectedCollection && (
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs space-y-5">
              {/* Collection Details Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-gray-100">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-gray-900 font-['Montserrat']">
                      {selectedCollection.title}
                    </h3>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        selectedCollection.status === 'active'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {selectedCollection.status === 'active' ? 'Activa' : 'Próxima'}
                    </span>
                  </div>
                  {selectedCollection.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{selectedCollection.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenEditCollection(selectedCollection)}
                    className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
                    title="Editar título o estado"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteCollection(selectedCollection.id)}
                    className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                    title="Eliminar colección"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddModel(selectedCollection.id)}
                    className="px-3 py-1.5 bg-gray-900 hover:bg-black text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-1 cursor-pointer ml-2"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar Modelo</span>
                  </button>
                </div>
              </div>

              {/* Models Grid (A, B, C, D, E...) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {selectedCollection.models.map((model, idx) => (
                  <div
                    key={model.id}
                    className="border border-gray-200 rounded-xl p-3 bg-gray-50/60 flex flex-col justify-between space-y-3"
                  >
                    {/* Image with letter badge */}
                    <div className="relative aspect-square rounded-lg overflow-hidden bg-white border border-gray-200 group">
                      <img
                        src={model.image}
                        alt={`Modelo ${model.letter}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 left-2 w-7 h-7 rounded-full bg-black/80 text-white font-black text-xs flex items-center justify-center shadow-xs">
                        {model.letter}
                      </div>

                      {/* Hover action to change picture */}
                      <button
                        type="button"
                        onClick={() => triggerUploadImageForModel(selectedCollection.id, model.id)}
                        className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 text-xs font-bold cursor-pointer"
                      >
                        <Upload className="w-5 h-5" />
                        <span>Subir o Cambiar Foto</span>
                      </button>
                    </div>

                    {/* Metadata & Controls */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-gray-900">
                          Modelo {model.letter}
                        </span>
                        <span className="text-[11px] text-gray-500 font-mono">
                          {model.votes?.total || 0} votos
                        </span>
                      </div>

                      {/* Reorder and Delete controls */}
                      <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveModel(selectedCollection.id, idx, 'up')}
                            className="p-1 rounded bg-white border border-gray-200 hover:bg-gray-100 disabled:opacity-30 cursor-pointer"
                            title="Mover arriba"
                          >
                            <ArrowUp className="w-3.5 h-3.5 text-gray-700" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === selectedCollection.models.length - 1}
                            onClick={() => handleMoveModel(selectedCollection.id, idx, 'down')}
                            className="p-1 rounded bg-white border border-gray-200 hover:bg-gray-100 disabled:opacity-30 cursor-pointer"
                            title="Mover abajo"
                          >
                            <ArrowDown className="w-3.5 h-3.5 text-gray-700" />
                          </button>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => triggerUploadImageForModel(selectedCollection.id, model.id)}
                            className="px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-50 rounded cursor-pointer"
                          >
                            Cambiar foto
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteModel(selectedCollection.id, model.id)}
                            className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded cursor-pointer"
                            title="Eliminar modelo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---------------- SUB-TAB 2: ESTADÍSTICAS DE APOYO POR NIVEL ---------------- */}
      {activeSubTab === 'stats' && (
        <div className="space-y-6">
          {/* Collection Selector */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {collections.map((col) => {
              const isSelected = col.id === selectedCollection?.id;
              return (
                <button
                  key={col.id}
                  onClick={() => setSelectedCollectionId(col.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#0058bb] text-white border-[#0058bb] shadow-xs'
                      : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-200'
                  }`}
                >
                  {col.title}
                </button>
              );
            })}
          </div>

          {selectedCollection && (
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs space-y-6">
              <div>
                <h3 className="text-base font-bold text-gray-900 font-['Montserrat']">
                  Apoyo del Público: {selectedCollection.title}
                </h3>
                <p className="text-xs text-gray-500">
                  Desglose exacto de los 3 niveles de interés por cada modelo
                </p>
              </div>

              {/* Models Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...selectedCollection.models]
                  .sort((a, b) => (b.votes?.total || 0) - (a.votes?.total || 0))
                  .map((model, rankIdx) => {
                    const total = model.votes?.total || 0;
                    const p1 = total > 0 ? ((model.votes.level1 / total) * 100).toFixed(0) : '0';
                    const p2 = total > 0 ? ((model.votes.level2 / total) * 100).toFixed(0) : '0';
                    const p3 = total > 0 ? ((model.votes.level3 / total) * 100).toFixed(0) : '0';

                    return (
                      <div
                        key={model.id}
                        className="border border-gray-200 rounded-xl p-4 bg-gray-50/50 flex gap-4"
                      >
                        {/* Thumbnail */}
                        <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-white border border-gray-200 shrink-0">
                          <img
                            src={model.image}
                            alt={`Modelo ${model.letter}`}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute top-1 left-1 w-6 h-6 rounded-full bg-black/80 text-white font-bold text-xs flex items-center justify-center">
                            {model.letter}
                          </div>
                        </div>

                        {/* Breakdown */}
                        <div className="flex-1 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-sm text-gray-900">
                                Modelo {model.letter}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  rankIdx === 0
                                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                    : 'bg-gray-200 text-gray-700'
                                }`}
                              >
                                #{rankIdx + 1} en preferencia
                              </span>
                            </div>
                            <span className="font-mono text-xs font-bold text-gray-900">
                              {total} votos
                            </span>
                          </div>

                          {/* Segmented Bar */}
                          <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden flex">
                            <div style={{ width: `${p1}%` }} className="bg-blue-400" />
                            <div style={{ width: `${p2}%` }} className="bg-amber-400" />
                            <div style={{ width: `${p3}%` }} className="bg-emerald-500" />
                          </div>

                          {/* 3 Levels Breakdown Grid */}
                          <div className="grid grid-cols-3 gap-2 text-center text-xs">
                            <div className="bg-white p-1.5 rounded-lg border border-gray-200">
                              <span className="text-[10px] text-gray-400 block">Me gusta</span>
                              <span className="font-bold text-blue-700">{model.votes.level1}</span>
                              <span className="text-[10px] text-gray-400 ml-1">({p1}%)</span>
                            </div>
                            <div className="bg-white p-1.5 rounded-lg border border-gray-200">
                              <span className="text-[10px] text-gray-400 block">Lo compraría</span>
                              <span className="font-bold text-amber-700">{model.votes.level2}</span>
                              <span className="text-[10px] text-gray-400 ml-1">({p2}%)</span>
                            </div>
                            <div className="bg-white p-1.5 rounded-lg border border-gray-200">
                              <span className="text-[10px] text-gray-400 block">¡Lo quiero ya!</span>
                              <span className="font-bold text-emerald-700">{model.votes.level3}</span>
                              <span className="text-[10px] text-gray-400 ml-1">({p3}%)</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---------------- SUB-TAB 3: PROPUESTAS DE CLIENTES ---------------- */}
      {activeSubTab === 'proposals' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-gray-900 font-['Montserrat']">
                Propuestas Recibidas de Clientes
              </h3>
              <p className="text-xs text-gray-500">
                Los clientes inician sesión para enviar sus sugerencias con foto y mensaje. Podés aprobarlas,
                rechazarlas o convertirlas directamente en un modelo de la colección.
              </p>
            </div>
          </div>

          {proposals.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center max-w-md mx-auto">
              <MessageSquare className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <h4 className="text-base font-bold text-gray-800">No hay propuestas de clientes</h4>
              <p className="text-xs text-gray-500 mt-1">
                A medida que los usuarios envíen sus ideas desde la tienda, aparecerán listadas aquí.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {proposals.map((prop) => (
                <div
                  key={prop.id}
                  className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs flex flex-col justify-between space-y-3"
                >
                  <div className="flex gap-3">
                    {/* Proposal Image */}
                    <div
                      onClick={() => setZoomedProposalImg(prop.imageUrl)}
                      className="relative w-24 h-24 rounded-xl overflow-hidden bg-gray-100 border border-gray-200 shrink-0 cursor-pointer group"
                    >
                      <img
                        src={prop.imageUrl}
                        alt="Propuesta"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                        <Eye className="w-4 h-4" />
                      </div>
                    </div>

                    {/* Proposal Details */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-xs text-gray-900 truncate">
                          {prop.userName}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            prop.status === 'approved'
                              ? 'bg-emerald-100 text-emerald-800'
                              : prop.status === 'rejected'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {prop.status === 'approved'
                            ? 'Aprobada'
                            : prop.status === 'rejected'
                            ? 'Rechazada'
                            : 'Pendiente'}
                        </span>
                      </div>

                      <p className="text-[11px] text-gray-500 truncate">{prop.userEmail}</p>

                      <div className="bg-gray-50 rounded-lg p-2 border border-gray-100">
                        <p className="text-xs text-gray-800 leading-snug break-words">
                          "{prop.message}"
                        </p>
                      </div>

                      {prop.collectionTitle && (
                        <p className="text-[10px] text-blue-700 font-semibold">
                          Colección sugerida: {prop.collectionTitle}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100">
                    <span className="text-[10px] text-gray-400">
                      {new Date(prop.createdAt).toLocaleDateString()}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {prop.status === 'pending' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleRejectProposal(prop.id)}
                            className="px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          >
                            Rechazar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApproveProposal(prop.id)}
                            className="px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                          >
                            Aprobar
                          </button>
                        </>
                      )}

                      {/* Convert to Model Button */}
                      {selectedCollection && (
                        <button
                          type="button"
                          onClick={() => handleConvertToModel(prop.id, selectedCollection.id)}
                          className="px-3 py-1 bg-[#0058bb] hover:bg-[#004696] text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                          title={`Agregar como nuevo modelo a "${selectedCollection.title}"`}
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>Publicar como Modelo</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDeleteProposal(prop.id)}
                        className="p-1 text-gray-400 hover:text-red-500 rounded cursor-pointer"
                        title="Eliminar registro"
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
      )}

      {/* ---------------- MODAL CREAR/EDITAR COLECCIÓN ---------------- */}
      {isColModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-gray-900 font-['Montserrat']">
              {editingCol ? 'Editar Colección' : 'Nueva Colección de Lanzamiento'}
            </h3>

            <form onSubmit={handleSaveCollection} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Título de la colección
                </label>
                <input
                  type="text"
                  required
                  value={colTitle}
                  onChange={(e) => setColTitle(e.target.value)}
                  placeholder="Ej. Colección Figuras Armables Pokémon"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0058bb]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Descripción (opcional)
                </label>
                <textarea
                  rows={2}
                  value={colDesc}
                  onChange={(e) => setColDesc(e.target.value)}
                  placeholder="Explicación breve para los clientes que van a votar..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0058bb] resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Estado
                </label>
                <select
                  value={colStatus}
                  onChange={(e) => setColStatus(e.target.value as any)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0058bb]"
                >
                  <option value="active">Activa (visible y con votación abierta)</option>
                  <option value="coming_soon">Próximamente</option>
                  <option value="paused">Pausada (oculta)</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsColModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0058bb] text-white text-xs font-bold rounded-xl hover:bg-[#004696]"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- ZOOM PROPUESTA MODAL ---------------- */}
      {zoomedProposalImg && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setZoomedProposalImg(null)}
        >
          <div className="relative max-w-lg w-full bg-white rounded-2xl overflow-hidden p-2">
            <img
              src={zoomedProposalImg}
              alt="Propuesta ampliada"
              className="w-full h-auto max-h-[80vh] object-contain rounded-xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};
