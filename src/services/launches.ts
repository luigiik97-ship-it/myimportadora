import { LaunchCollection, LaunchCustomerProposal, LaunchInterestLevel, LaunchModel } from '../types';
import { getSupabase, isSupabaseConfigured } from './supabase';

const VOTES_COOKIE_NAME = 'my_launch_votes';
const VOTES_LOCAL_STORAGE_KEY = 'my_commerce_launch_votes';
const COLLECTIONS_STORAGE_KEY = 'my_commerce_launch_collections_v1';
const PROPOSALS_STORAGE_KEY = 'my_commerce_launch_proposals_v1';

// ---------------- COOKIE & LOCAL STORAGE HELPERS ---------------- //
export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
  return match ? decodeURIComponent(match[3]) : null;
}

export function setCookie(name: string, value: string, days = 180): void {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

export function getStoredVotes(): Record<string, LaunchInterestLevel> {
  try {
    // Check cookie first, fallback to localStorage
    const cookieVal = getCookie(VOTES_COOKIE_NAME);
    if (cookieVal) {
      return JSON.parse(cookieVal);
    }
    const localVal = localStorage.getItem(VOTES_LOCAL_STORAGE_KEY);
    if (localVal) {
      return JSON.parse(localVal);
    }
  } catch (e) {
    console.warn('Error reading launch votes:', e);
  }
  return {};
}

export function persistStoredVotes(votes: Record<string, LaunchInterestLevel>): void {
  try {
    const json = JSON.stringify(votes);
    setCookie(VOTES_COOKIE_NAME, json, 180);
    localStorage.setItem(VOTES_LOCAL_STORAGE_KEY, json);
  } catch (e) {
    console.warn('Error saving launch votes:', e);
  }
}

// ---------------- INITIAL PRESET COLLECTIONS ---------------- //
// Colecciones y propuestas administradas exclusivamente en Supabase y panel de control
const INITIAL_COLLECTIONS: LaunchCollection[] = [];
const INITIAL_PROPOSALS: LaunchCustomerProposal[] = [];

// ---------------- IDENTIFICADORES DE FILAS EN SUPABASE ---------------- //
export const SYSTEM_LAUNCHES_COLLECTIONS_ROW_ID = '__system_launches_collections_v1__';
export const SYSTEM_LAUNCHES_PROPOSALS_ROW_ID = '__system_launches_proposals_v1__';

/**
 * Persiste la lista completa de colecciones en Supabase para sincronización absoluta
 */
export async function syncCollectionsToSupabase(collections: LaunchCollection[]): Promise<boolean> {
  const supabase = getSupabase();
  if (!isSupabaseConfigured() || !supabase) return false;

  try {
    const { error } = await supabase.from('products').upsert({
      id: SYSTEM_LAUNCHES_COLLECTIONS_ROW_ID,
      title: '__SYSTEM_LAUNCHES_COLLECTIONS__',
      description: JSON.stringify(collections),
      category: '__system__',
      wholesale_price: 0,
      retail_price: 0,
      stock: 0,
      specs: [{ key: 'updated_at', value: new Date().toISOString() }],
    });
    if (error) {
      console.warn('[Launches] Error al sincronizar colecciones en Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Launches] Excepción de red al guardar colecciones en Supabase:', err);
    return false;
  }
}

/**
 * Persiste la lista de propuestas comunitarias en Supabase
 */
export async function syncProposalsToSupabase(proposals: LaunchCustomerProposal[]): Promise<boolean> {
  const supabase = getSupabase();
  if (!isSupabaseConfigured() || !supabase) return false;

  try {
    const { error } = await supabase.from('products').upsert({
      id: SYSTEM_LAUNCHES_PROPOSALS_ROW_ID,
      title: '__SYSTEM_LAUNCHES_PROPOSALS__',
      description: JSON.stringify(proposals),
      category: '__system__',
      wholesale_price: 0,
      retail_price: 0,
      stock: 0,
      specs: [{ key: 'updated_at', value: new Date().toISOString() }],
    });
    if (error) {
      console.warn('[Launches] Error al sincronizar propuestas en Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Launches] Excepción de red al guardar propuestas en Supabase:', err);
    return false;
  }
}

// ---------------- SERVICE API ---------------- //

let cachedCollections: LaunchCollection[] | null = null;
let activeFetchCollectionsPromise: Promise<LaunchCollection[]> | null = null;
let lastCollectionsFetchTime = 0;
const COLLECTIONS_CACHE_TTL = 30000;

export async function fetchLaunchCollections(force = false): Promise<LaunchCollection[]> {
  const now = Date.now();
  if (!force && cachedCollections && cachedCollections.length > 0 && (now - lastCollectionsFetchTime < COLLECTIONS_CACHE_TTL)) {
    return cachedCollections;
  }

  if (activeFetchCollectionsPromise) {
    return activeFetchCollectionsPromise;
  }

  activeFetchCollectionsPromise = (async () => {
    try {
      const supabase = getSupabase();
      if (isSupabaseConfigured() && supabase) {
        // 1. Consultar fila centralizada en Supabase
        const { data, error } = await supabase
          .from('products')
          .select('description')
          .eq('id', SYSTEM_LAUNCHES_COLLECTIONS_ROW_ID)
          .maybeSingle();

        if (!error && data && data.description) {
          try {
            const parsed = JSON.parse(data.description);
            if (Array.isArray(parsed) && parsed.length > 0) {
              cachedCollections = parsed;
              lastCollectionsFetchTime = Date.now();
              localStorage.setItem(COLLECTIONS_STORAGE_KEY, JSON.stringify(parsed));
              return parsed;
            }
          } catch (e) {
            console.warn('[Launches] Error parseando colecciones desde Supabase:', e);
          }
        }
      }
    } catch (err) {
      console.warn('Supabase fetchLaunchCollections fallback to storage:', err);
    }

    // Fallback to localStorage
    try {
      const saved = localStorage.getItem(COLLECTIONS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          cachedCollections = parsed;
          lastCollectionsFetchTime = Date.now();
          // Sembrar en Supabase en segundo plano si aún no estaba en la nube
          syncCollectionsToSupabase(parsed).catch(() => {});
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Error reading launch collections from storage:', e);
    }

    cachedCollections = [];
    lastCollectionsFetchTime = Date.now();
    return [];
  })().finally(() => {
    activeFetchCollectionsPromise = null;
  });

  return activeFetchCollectionsPromise;
}

export async function saveLaunchCollection(collection: LaunchCollection): Promise<LaunchCollection[]> {
  const currentCollections = await fetchLaunchCollections();
  const index = currentCollections.findIndex((c) => c.id === collection.id);
  let updated: LaunchCollection[];

  if (index >= 0) {
    updated = [...currentCollections];
    updated[index] = collection;
  } else {
    updated = [collection, ...currentCollections];
  }

  cachedCollections = updated;
  lastCollectionsFetchTime = Date.now();
  localStorage.setItem(COLLECTIONS_STORAGE_KEY, JSON.stringify(updated));

  // Persistir inmediatamente en Supabase
  await syncCollectionsToSupabase(updated);

  return updated;
}

export async function deleteLaunchCollection(collectionId: string): Promise<LaunchCollection[]> {
  const currentCollections = await fetchLaunchCollections();
  const updated = currentCollections.filter((c) => c.id !== collectionId);
  cachedCollections = updated;
  lastCollectionsFetchTime = Date.now();
  localStorage.setItem(COLLECTIONS_STORAGE_KEY, JSON.stringify(updated));

  // Persistir cambio inmediatamente en Supabase
  await syncCollectionsToSupabase(updated);

  return updated;
}

/**
 * Registra o actualiza el voto de un modelo (3 niveles de interés: 1, 2 o 3).
 * Guarda en cookies y localStorage para el votante, y actualiza el contador de la colección en Supabase.
 */
export async function recordModelVote(
  collectionId: string,
  modelId: string,
  level: LaunchInterestLevel,
  previousLevel?: LaunchInterestLevel | null
): Promise<{ collections: LaunchCollection[]; userVotes: Record<string, LaunchInterestLevel> }> {
  const userVotes = getStoredVotes();

  // If tapping same level, remove vote (toggle behavior)
  const isDeselecting = previousLevel === level;

  if (isDeselecting) {
    delete userVotes[modelId];
  } else {
    userVotes[modelId] = level;
  }
  persistStoredVotes(userVotes);

  // Update in collections
  const collections = await fetchLaunchCollections();
  const colIndex = collections.findIndex((c) => c.id === collectionId);
  if (colIndex >= 0) {
    const col = collections[colIndex];
    const updatedModels = col.models.map((m) => {
      if (m.id !== modelId) return m;

      const votes = { ...m.votes };

      // Deduct previous vote if existed
      if (previousLevel === 1 && votes.level1 > 0) votes.level1 -= 1;
      if (previousLevel === 2 && votes.level2 > 0) votes.level2 -= 1;
      if (previousLevel === 3 && votes.level3 > 0) votes.level3 -= 1;

      // Add new vote if not deselecting
      if (!isDeselecting) {
        if (level === 1) votes.level1 += 1;
        if (level === 2) votes.level2 += 1;
        if (level === 3) votes.level3 += 1;
      }

      votes.total = votes.level1 + votes.level2 + votes.level3;
      return { ...m, votes };
    });

    const updatedCol = { ...col, models: updatedModels };
    collections[colIndex] = updatedCol;
    localStorage.setItem(COLLECTIONS_STORAGE_KEY, JSON.stringify(collections));

    // Sincronizar votos directamente a Supabase
    syncCollectionsToSupabase(collections).catch(() => {});
  }

  return { collections, userVotes };
}

// ---------------- CUSTOMER PROPOSALS API ---------------- //

export async function fetchCustomerProposals(): Promise<LaunchCustomerProposal[]> {
  try {
    const supabase = getSupabase();
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('products')
        .select('description')
        .eq('id', SYSTEM_LAUNCHES_PROPOSALS_ROW_ID)
        .maybeSingle();

      if (!error && data && data.description) {
        try {
          const parsed = JSON.parse(data.description);
          if (Array.isArray(parsed)) {
            localStorage.setItem(PROPOSALS_STORAGE_KEY, JSON.stringify(parsed));
            return parsed;
          }
        } catch (e) {
          console.warn('[Launches] Error parseando propuestas de Supabase:', e);
        }
      }
    }
  } catch (err) {
    console.warn('Supabase fetchCustomerProposals fallback to storage:', err);
  }

  try {
    const saved = localStorage.getItem(PROPOSALS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        syncProposalsToSupabase(parsed).catch(() => {});
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Error reading proposals from storage:', e);
  }

  return [];
}

export async function submitCustomerProposal(
  data: Omit<LaunchCustomerProposal, 'id' | 'createdAt' | 'status'>
): Promise<LaunchCustomerProposal> {
  const newProposal: LaunchCustomerProposal = {
    ...data,
    id: `prop-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    createdAt: new Date().toISOString(),
    status: 'pending',
  };

  const current = await fetchCustomerProposals();
  const updated = [newProposal, ...current];
  localStorage.setItem(PROPOSALS_STORAGE_KEY, JSON.stringify(updated));

  // Persistir en Supabase
  await syncProposalsToSupabase(updated);

  return newProposal;
}

export async function updateProposalStatus(
  proposalId: string,
  status: 'approved' | 'rejected',
  adminNotes?: string
): Promise<LaunchCustomerProposal[]> {
  const current = await fetchCustomerProposals();
  const updated = current.map((p) => {
    if (p.id !== proposalId) return p;
    return { ...p, status, adminNotes: adminNotes ?? p.adminNotes };
  });
  localStorage.setItem(PROPOSALS_STORAGE_KEY, JSON.stringify(updated));

  // Persistir en Supabase
  await syncProposalsToSupabase(updated);

  return updated;
}

export async function deleteCustomerProposal(proposalId: string): Promise<LaunchCustomerProposal[]> {
  const current = await fetchCustomerProposals();
  const updated = current.filter((p) => p.id !== proposalId);
  localStorage.setItem(PROPOSALS_STORAGE_KEY, JSON.stringify(updated));

  // Persistir en Supabase
  await syncProposalsToSupabase(updated);

  return updated;
}

/**
 * Convierte una propuesta aprobada en un modelo formal (A, B, C, D, E...) dentro de una colección.
 */
export async function convertProposalToModel(
  proposalId: string,
  targetCollectionId: string
): Promise<{ collections: LaunchCollection[]; proposals: LaunchCustomerProposal[] }> {
  const proposals = await fetchCustomerProposals();
  const proposal = proposals.find((p) => p.id === proposalId);
  if (!proposal) throw new Error('Propuesta no encontrada');

  const collections = await fetchLaunchCollections();
  const colIndex = collections.findIndex((c) => c.id === targetCollectionId);
  if (colIndex < 0) throw new Error('Colección destino no encontrada');

  const targetCol = collections[colIndex];
  const nextLetterCode = 65 + targetCol.models.length; // 65 = 'A', 66 = 'B'...
  const nextLetter = String.fromCharCode(nextLetterCode);

  const newModel: LaunchModel = {
    id: `model-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    letter: nextLetter,
    image: proposal.imageUrl,
    votes: { level1: 0, level2: 0, level3: 1, total: 1 }, // Inicia con 1 voto de entusiasmo
    sortOrder: targetCol.models.length + 1,
  };

  targetCol.models.push(newModel);
  collections[colIndex] = { ...targetCol };
  localStorage.setItem(COLLECTIONS_STORAGE_KEY, JSON.stringify(collections));

  // Mark proposal as approved
  const updatedProposals = proposals.map((p) =>
    p.id === proposalId
      ? { ...p, status: 'approved' as const, adminNotes: `Aprobado y publicado como Modelo ${nextLetter}` }
      : p
  );
  localStorage.setItem(PROPOSALS_STORAGE_KEY, JSON.stringify(updatedProposals));

  // Sincronizar ambos cambios en Supabase
  await syncCollectionsToSupabase(collections);
  await syncProposalsToSupabase(updatedProposals);

  return { collections, proposals: updatedProposals };
}

// ---------------- GESTIÓN DE VISIBILIDAD DE PRÓXIMOS LANZAMIENTOS (CENTRALIZADO EN SUPABASE) ---------------- //
export const LAUNCHES_VISIBILITY_STORAGE_KEY = 'my_commerce_launches_visible';
export const LAUNCHES_VISIBILITY_EVENT = 'launches_visibility_change';
export const SYSTEM_LAUNCHES_CONFIG_ROW_ID = '__system_launches_config_v1__';

/**
 * Consulta si la sección de Próximos Lanzamientos está visible públicamente en la tienda.
 * Usa caché local/memoria para render inmediato y fallback resiliente.
 */
export function isLaunchesSectionVisible(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const val = localStorage.getItem(LAUNCHES_VISIBILITY_STORAGE_KEY);
    if (val === null) return true;
    return val === 'true';
  } catch (e) {
    console.warn('Error al leer visibilidad de próximos lanzamientos:', e);
    return true;
  }
}

/**
 * Consulta y sincroniza la visibilidad de Próximos Lanzamientos directamente desde Supabase.
 * Esto asegura sincronización única y centralizada entre el panel, Supabase, Vercel y todos los dispositivos.
 */
export async function fetchLaunchesVisibilityFromSupabase(): Promise<boolean> {
  const supabase = getSupabase();
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('description')
        .eq('id', SYSTEM_LAUNCHES_CONFIG_ROW_ID)
        .maybeSingle();

      if (!error && data && data.description) {
        try {
          const parsed = JSON.parse(data.description);
          if (parsed && typeof parsed.isVisible === 'boolean') {
            const isVis = parsed.isVisible;
            if (typeof window !== 'undefined') {
              localStorage.setItem(LAUNCHES_VISIBILITY_STORAGE_KEY, String(isVis));
              window.dispatchEvent(new CustomEvent(LAUNCHES_VISIBILITY_EVENT, { detail: { visible: isVis } }));
            }
            return isVis;
          }
        } catch (parseErr) {
          console.warn('Error parseando configuración remota de visibilidad de lanzamientos:', parseErr);
        }
      }
    } catch (e) {
      console.warn('Error consultando visibilidad de lanzamientos en Supabase:', e);
    }
  }
  return isLaunchesSectionVisible();
}

/**
 * Activa u oculta la sección de Próximos Lanzamientos tanto en memoria/local como centralizadamente en Supabase.
 * Garantiza que el cambio se refleje en Vercel y en todos los navegadores/clientes.
 */
export async function setLaunchesSectionVisible(visible: boolean): Promise<void> {
  // 1. Guardar inmediatamente en localStorage y notificar componentes locales
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LAUNCHES_VISIBILITY_STORAGE_KEY, String(visible));
      window.dispatchEvent(new CustomEvent(LAUNCHES_VISIBILITY_EVENT, { detail: { visible } }));
    } catch (e) {
      console.warn('Error al guardar visibilidad local:', e);
    }
  }

  // 2. Persistir en la fila centralizada de configuración de Supabase
  const supabase = getSupabase();
  if (isSupabaseConfigured() && supabase) {
    try {
      const payload = {
        isVisible: visible,
        lastUpdated: new Date().toISOString(),
      };
      const { error } = await supabase.from('products').upsert({
        id: SYSTEM_LAUNCHES_CONFIG_ROW_ID,
        title: '__SYSTEM_LAUNCHES_CONFIG__',
        description: JSON.stringify(payload),
        category: '__system__',
        wholesale_price: 0,
        retail_price: 0,
        stock: 0,
        specs: [{ key: 'updated_at', value: payload.lastUpdated }],
      });

      if (error) {
        console.warn('Advertencia al guardar visibilidad de lanzamientos en Supabase:', error.message);
      }
    } catch (err) {
      console.warn('Error sincronizando visibilidad de lanzamientos con Supabase:', err);
    }
  }
}
