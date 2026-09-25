import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Flame,
  Rocket,
  Heart,
  Lightbulb,
  Maximize2,
  X,
  CheckCircle2,
  TrendingUp,
  Share2,
  Lock,
} from 'lucide-react';
import { LaunchCollection, LaunchInterestLevel, LaunchModel, UserProfile } from '../../types';
import {
  fetchLaunchCollections,
  getStoredVotes,
  recordModelVote,
} from '../../services/launches';
import { LaunchProposalModal } from './LaunchProposalModal';

interface LaunchesViewProps {
  currentUser: UserProfile | null;
  onOpenAuth: () => void;
  onGoHome: () => void;
}

const INTEREST_LEVELS: {
  level: LaunchInterestLevel;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  activeClass: string;
  badgeClass: string;
}[] = [
  {
    level: 1,
    label: 'Me gusta',
    shortLabel: 'Me gusta',
    icon: <Heart className="w-3.5 h-3.5" />,
    activeClass: 'bg-blue-50 text-[#0058bb] border-[#0058bb] font-bold shadow-xs',
    badgeClass: 'bg-blue-100 text-blue-800',
  },
  {
    level: 2,
    label: 'Lo compraría',
    shortLabel: 'Compraría',
    icon: <Flame className="w-3.5 h-3.5" />,
    activeClass: 'bg-amber-50 text-amber-900 border-amber-500 font-bold shadow-xs',
    badgeClass: 'bg-amber-100 text-amber-900',
  },
  {
    level: 3,
    label: '¡Lo quiero ya!',
    shortLabel: '¡Quiero ya!',
    icon: <Rocket className="w-3.5 h-3.5" />,
    activeClass: 'bg-emerald-50 text-emerald-900 border-emerald-500 font-bold shadow-xs',
    badgeClass: 'bg-emerald-100 text-emerald-900',
  },
];

export const LaunchesView: React.FC<LaunchesViewProps> = ({
  currentUser,
  onOpenAuth,
  onGoHome,
}) => {
  const [collections, setCollections] = useState<LaunchCollection[]>([]);
  const [activeCollectionId, setActiveCollectionId] = useState<string>('');
  const [userVotes, setUserVotes] = useState<Record<string, LaunchInterestLevel>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isProposalModalOpen, setIsProposalModalOpen] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<{ url: string; letter: string } | null>(null);
  const [voteToast, setVoteToast] = useState<{ message: string; modelLetter: string } | null>(null);

  // Load collections & votes from cookies/localStorage
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const cols = await fetchLaunchCollections();
      const activeCols = cols.filter((c) => c.status !== 'paused');
      setCollections(activeCols);
      if (activeCols.length > 0 && !activeCollectionId) {
        setActiveCollectionId(activeCols[0].id);
      }
      const votes = getStoredVotes();
      setUserVotes(votes);
      setIsLoading(false);
    };
    load();
  }, []);

  const currentCollection = useMemo(() => {
    return collections.find((c) => c.id === activeCollectionId) || collections[0] || null;
  }, [collections, activeCollectionId]);

  const handleVote = async (model: LaunchModel, level: LaunchInterestLevel) => {
    if (!currentCollection) return;
    const previousLevel = userVotes[model.id] || null;

    // Optimistic UI update
    const isDeselecting = previousLevel === level;
    const updatedUserVotes = { ...userVotes };
    if (isDeselecting) {
      delete updatedUserVotes[model.id];
    } else {
      updatedUserVotes[model.id] = level;
    }
    setUserVotes(updatedUserVotes);

    // Show instant toast feedback
    const levelObj = INTEREST_LEVELS.find((l) => l.level === level);
    if (isDeselecting) {
      setVoteToast({
        message: `Voto retirado del Modelo ${model.letter}`,
        modelLetter: model.letter,
      });
    } else {
      setVoteToast({
        message: `¡Votaste "${levelObj?.label}" por el Modelo ${model.letter}!`,
        modelLetter: model.letter,
      });
    }
    setTimeout(() => setVoteToast(null), 3000);

    // Persist via service
    const res = await recordModelVote(currentCollection.id, model.id, level, previousLevel);
    setCollections(res.collections);
    setUserVotes(res.userVotes);
  };

  const handleOpenProposal = () => {
    if (!currentUser) {
      // Prompt login strictly for proposals with image, keeping voting friction-free
      onOpenAuth();
    } else {
      setIsProposalModalOpen(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#fbf9f8] text-[#1b1c1c] pb-24">
      {/* Toast Feedback */}
      {voteToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="bg-gray-900/95 text-white backdrop-blur-md px-4 py-2.5 rounded-full shadow-xl border border-white/10 flex items-center gap-2 text-xs sm:text-sm font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{voteToast.message}</span>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="max-w-6xl mx-auto px-3 sm:px-6 pt-4 sm:pt-6">
        {/* Header Banner - Mobile first, minimalist & sophisticated */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#003882] via-[#0058bb] to-[#0074f0] text-white p-5 sm:p-8 shadow-md mb-6 sm:mb-8">
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 text-yellow-300 font-bold text-[11px] sm:text-xs uppercase tracking-wider mb-2.5">
              <Sparkles className="w-3.5 h-3.5 fill-current" />
              <span>Participación de la Comunidad</span>
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black font-['Montserrat'] tracking-tight leading-tight text-white mb-2">
              Próximos Lanzamientos
            </h1>
            <p className="text-white/90 text-xs sm:text-sm leading-relaxed mb-4 sm:mb-5">
              Votá los modelos que te gustaría ver en stock. Los más votados tendrán prioridad en el próximo ingreso.
              Tu voto se registra al instante sin necesidad de registro previo.
            </p>

            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
              <button
                type="button"
                onClick={handleOpenProposal}
                className="inline-flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-gray-950 font-black text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-sm hover:shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <Lightbulb className="w-4 h-4 fill-current text-gray-900" />
                <span>💡 Proponer un modelo</span>
              </button>

              {!currentUser && (
                <span className="text-[11px] sm:text-xs text-white/80 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-yellow-300 shrink-0" />
                  <span>Requiere sesión solo para subir fotos y mensaje</span>
                </span>
              )}
            </div>
          </div>

          {/* Decorative background glow */}
          <div className="absolute -right-16 -bottom-16 w-64 h-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        </div>

        {/* Collection Selector Tabs */}
        {collections.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-3 mb-4">
            {collections.map((col) => {
              const isSelected = col.id === activeCollectionId;
              return (
                <button
                  key={col.id}
                  onClick={() => setActiveCollectionId(col.id)}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-[#0058bb] text-white border-[#0058bb] shadow-sm'
                      : 'bg-white text-gray-700 hover:text-gray-900 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {col.title}
                </button>
              );
            })}
          </div>
        )}

        {/* Active Collection Header */}
        {currentCollection && (
          <div className="bg-white rounded-2xl border border-gray-200/90 p-4 sm:p-5 mb-6 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0058bb]" />
                <h2 className="text-base sm:text-lg font-black font-['Montserrat'] text-gray-900 uppercase tracking-tight">
                  {currentCollection.title}
                </h2>
              </div>
              {currentCollection.description && (
                <p className="text-xs sm:text-sm text-gray-600 max-w-2xl">
                  {currentCollection.description}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                {currentCollection.models.length} modelos en votación
              </span>
            </div>
          </div>
        )}

        {/* Compact Gallery Grid of Models (strictly image, letter identifier, and 3-level selector) */}
        {isLoading ? (
          <div className="grid grid-cols-2 min-[460px]:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-2.5 sm:gap-3.5 md:gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div
                key={i}
                className="bg-white rounded-xl sm:rounded-2xl border border-gray-200 p-2 animate-pulse space-y-2"
              >
                <div className="w-full aspect-square bg-gray-200 rounded-lg sm:rounded-xl" />
                <div className="h-8 bg-gray-200 rounded-lg" />
              </div>
            ))}
          </div>
        ) : !currentCollection || currentCollection.models.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center max-w-md mx-auto">
            <Sparkles className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <h3 className="text-base font-bold text-gray-800 mb-1">No hay modelos activos en esta colección</h3>
            <p className="text-xs text-gray-500 mb-4">
              Pronto se agregarán nuevos modelos para que puedas votar.
            </p>
            <button
              type="button"
              onClick={handleOpenProposal}
              className="px-4 py-2 bg-[#0058bb] text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              Proponer el primer modelo
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 min-[460px]:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-2.5 sm:gap-3.5 md:gap-4">
            {currentCollection.models.map((model) => {
              const currentVote = userVotes[model.id] || null;

              return (
                <div
                  key={model.id}
                  id={`launch-model-${model.letter}`}
                  className={`bg-white rounded-xl sm:rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col shadow-2xs hover:shadow-md ${
                    currentVote
                      ? 'border-[#0058bb] ring-2 ring-[#0058bb]/15'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {/* Model Image with Letter Identifier Overlay */}
                  <div
                    className="relative aspect-square w-full bg-gray-100 overflow-hidden group cursor-pointer"
                    onClick={() => setZoomedImage({ url: model.image, letter: model.letter })}
                    title={`Ver foto ampliada del Modelo ${model.letter}`}
                  >
                    <img
                      src={model.image}
                      alt={`Modelo ${model.letter}`}
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                      loading="lazy"
                    />

                    {/* Letra identificadora prominente */}
                    <div className="absolute top-2 left-2 z-10">
                      <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/85 backdrop-blur-xs text-white font-black text-xs sm:text-sm font-['Montserrat'] flex items-center justify-center shadow-md border border-white/20">
                        {model.letter}
                      </span>
                    </div>

                    {/* Botón lupa sutil para ampliar imagen */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setZoomedImage({ url: model.image, letter: model.letter });
                      }}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/40 hover:bg-black/70 text-white shadow-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      title="Ampliar imagen"
                      aria-label={`Ampliar imagen del Modelo ${model.letter}`}
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Indicador discreto de voto registrado */}
                    {currentVote && (
                      <div className="absolute bottom-2 right-2 z-10">
                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-md">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Selector de 3 niveles de apoyo (compacto, sin textos largos ni nombres) */}
                  <div className="p-1.5 sm:p-2 bg-white">
                    <div className="grid grid-cols-3 gap-1 bg-gray-50/90 p-1 rounded-xl border border-gray-100">
                      {INTEREST_LEVELS.map(({ level, shortLabel, icon, activeClass }) => {
                        const isSelected = currentVote === level;
                        return (
                          <button
                            key={level}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleVote(model, level);
                            }}
                            className={`py-1.5 px-0.5 rounded-lg flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1 transition-all cursor-pointer border ${
                              isSelected
                                ? `${activeClass} scale-[1.02]`
                                : 'bg-white hover:bg-gray-100 text-gray-600 border-gray-100 hover:border-gray-200'
                            }`}
                            title={`${shortLabel} (Nivel ${level})`}
                            aria-label={`${shortLabel} para Modelo ${model.letter}`}
                          >
                            <span className="shrink-0">{icon}</span>
                            <span className="text-[9px] sm:text-[10px] font-bold leading-none truncate">
                              {shortLabel}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Suggestion Callout Footer */}
        <div className="mt-10 sm:mt-12 bg-white rounded-2xl border border-gray-200/90 p-5 sm:p-7 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center shrink-0">
              <Lightbulb className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-gray-900">
                ¿Tenés en mente otro modelo o personaje?
              </h3>
              <p className="text-xs sm:text-sm text-gray-500">
                Podés subir una foto y contarnos por qué te gustaría tenerlo en la tienda.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleOpenProposal}
            className="w-full sm:w-auto px-6 py-3 bg-[#0058bb] hover:bg-[#004696] text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2 shrink-0 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Subir mi propuesta</span>
          </button>
        </div>
      </div>

      {/* Image Zoom Modal */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150"
          onClick={() => setZoomedImage(null)}
        >
          <div
            className="relative max-w-2xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <span className="font-bold text-sm text-gray-900">
                Foto Modelo {zoomedImage.letter}
              </span>
              <button
                type="button"
                onClick={() => setZoomedImage(null)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-2 sm:p-4 bg-gray-950 flex items-center justify-center max-h-[75vh] overflow-hidden">
              <img
                src={zoomedImage.url}
                alt={`Modelo ${zoomedImage.letter}`}
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}

      {/* Customer Proposal Modal */}
      <LaunchProposalModal
        isOpen={isProposalModalOpen}
        onClose={() => setIsProposalModalOpen(false)}
        currentUser={currentUser}
        collections={collections}
        selectedCollectionId={activeCollectionId}
        onProposalSubmitted={async () => {
          const cols = await fetchLaunchCollections();
          setCollections(cols);
        }}
      />
    </div>
  );
};
