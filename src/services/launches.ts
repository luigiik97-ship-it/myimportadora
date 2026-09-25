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
// Modelos identificados exclusivamente por letras A, B, C, D, E, sin nombres
const INITIAL_COLLECTIONS: LaunchCollection[] = [
  {
    id: 'launch-col-1',
    title: 'Colección Figuras Armables Pokémon & Anime',
    description: 'Votá qué modelos preferís que importemos en el próximo ingreso. Los más votados tendrán prioridad de stock.',
    status: 'active',
    allowCustomerProposals: true,
    createdAt: new Date().toISOString(),
    models: [
      {
        id: 'model-1-a',
        letter: 'A',
        image: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=800&auto=format&fit=crop&q=80',
        sortOrder: 1,
        votes: { level1: 14, level2: 28, level3: 52, total: 94 },
      },
      {
        id: 'model-1-b',
        letter: 'B',
        image: 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=800&auto=format&fit=crop&q=80',
        sortOrder: 2,
        votes: { level1: 22, level2: 45, level3: 67, total: 134 },
      },
      {
        id: 'model-1-c',
        letter: 'C',
        image: 'https://images.unsplash.com/photo-1618336753974-aae8e04506aa?w=800&auto=format&fit=crop&q=80',
        sortOrder: 3,
        votes: { level1: 8, level2: 19, level3: 41, total: 68 },
      },
      {
        id: 'model-1-d',
        letter: 'D',
        image: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=800&auto=format&fit=crop&q=80',
        sortOrder: 4,
        votes: { level1: 31, level2: 38, level3: 49, total: 118 },
      },
      {
        id: 'model-1-e',
        letter: 'E',
        image: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=800&auto=format&fit=crop&q=80',
        sortOrder: 5,
        votes: { level1: 15, level2: 24, level3: 38, total: 77 },
      },
    ],
  },
  {
    id: 'launch-col-2',
    title: 'Colección Mochilas & Accesorios Urbanos',
    description: 'Nuevos diseños y combinaciones de colores para la temporada. Seleccioná tu nivel de interés.',
    status: 'active',
    allowCustomerProposals: true,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    models: [
      {
        id: 'model-2-a',
        letter: 'A',
        image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&auto=format&fit=crop&q=80',
        sortOrder: 1,
        votes: { level1: 18, level2: 34, level3: 61, total: 113 },
      },
      {
        id: 'model-2-b',
        letter: 'B',
        image: 'https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?w=800&auto=format&fit=crop&q=80',
        sortOrder: 2,
        votes: { level1: 25, level2: 41, level3: 55, total: 121 },
      },
      {
        id: 'model-2-c',
        letter: 'C',
        image: 'https://images.unsplash.com/photo-1546938576-6e6a64f317cc?w=800&auto=format&fit=crop&q=80',
        sortOrder: 3,
        votes: { level1: 12, level2: 29, level3: 47, total: 88 },
      },
      {
        id: 'model-2-d',
        letter: 'D',
        image: 'https://images.unsplash.com/photo-1577733966973-d680bffd2e80?w=800&auto=format&fit=crop&q=80',
        sortOrder: 4,
        votes: { level1: 9, level2: 17, level3: 33, total: 59 },
      },
    ],
  },
];

const INITIAL_PROPOSALS: LaunchCustomerProposal[] = [
  {
    id: 'prop-sample-1',
    collectionId: 'launch-col-1',
    collectionTitle: 'Colección Figuras Armables Pokémon & Anime',
    imageUrl: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=800&auto=format&fit=crop&q=80',
    message: '¡Me encantaría que traigan este set de Mewtwo y Gengar en formato mini blocks!',
    userId: 'user-demo-1',
    userEmail: 'cliente.entusiasta@gmail.com',
    userName: 'Martín Gómez',
    status: 'pending',
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
];

// ---------------- SERVICE API ---------------- //

export async function fetchLaunchCollections(): Promise<LaunchCollection[]> {
  try {
    const supabase = getSupabase();
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('launch_collections')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        const mapped: LaunchCollection[] = data.map((item: any) => ({
          id: item.id,
          title: item.title,
          description: item.description || '',
          status: item.status || 'active',
          models: Array.isArray(item.models) ? item.models : [],
          createdAt: item.created_at || new Date().toISOString(),
          allowCustomerProposals: item.allow_proposals !== false,
        }));
        localStorage.setItem(COLLECTIONS_STORAGE_KEY, JSON.stringify(mapped));
        return mapped;
      }
    }
  } catch (err) {
    console.warn('Supabase fetchLaunchCollections fallback to storage:', err);
  }

  // Fallback to localStorage
  try {
    const saved = localStorage.getItem(COLLECTIONS_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn('Error reading launch collections from storage:', e);
  }

  // First time initialization
  localStorage.setItem(COLLECTIONS_STORAGE_KEY, JSON.stringify(INITIAL_COLLECTIONS));
  return INITIAL_COLLECTIONS;
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

  localStorage.setItem(COLLECTIONS_STORAGE_KEY, JSON.stringify(updated));

  // Sync to Supabase if table exists
  try {
    const supabase = getSupabase();
    if (isSupabaseConfigured() && supabase) {
      await supabase.from('launch_collections').upsert({
        id: collection.id,
        title: collection.title,
        description: collection.description,
        status: collection.status,
        models: collection.models,
        allow_proposals: collection.allowCustomerProposals,
        updated_at: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.warn('Error syncing launch collection to Supabase:', err);
  }

  return updated;
}

export async function deleteLaunchCollection(collectionId: string): Promise<LaunchCollection[]> {
  const currentCollections = await fetchLaunchCollections();
  const updated = currentCollections.filter((c) => c.id !== collectionId);
  localStorage.setItem(COLLECTIONS_STORAGE_KEY, JSON.stringify(updated));

  try {
    const supabase = getSupabase();
    if (isSupabaseConfigured() && supabase) {
      await supabase.from('launch_collections').delete().eq('id', collectionId);
    }
  } catch (err) {
    console.warn('Error deleting launch collection from Supabase:', err);
  }

  return updated;
}

/**
 * Registra o actualiza el voto de un modelo (3 niveles de interés: 1, 2 o 3).
 * Guarda en cookies y localStorage para el votante, y actualiza el contador de la colección.
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

    // Async sync to Supabase
    try {
      const supabase = getSupabase();
      if (isSupabaseConfigured() && supabase) {
        await supabase.from('launch_collections').upsert({
          id: updatedCol.id,
          models: updatedCol.models,
          updated_at: new Date().toISOString(),
        });
      }
    } catch (e) {
      // Ignored for non-blocking local experience
    }
  }

  return { collections, userVotes };
}

// ---------------- CUSTOMER PROPOSALS API ---------------- //

export async function fetchCustomerProposals(): Promise<LaunchCustomerProposal[]> {
  try {
    const supabase = getSupabase();
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('launch_proposals')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        const mapped: LaunchCustomerProposal[] = data.map((item: any) => ({
          id: item.id,
          collectionId: item.collection_id,
          collectionTitle: item.collection_title,
          imageUrl: item.image_url,
          message: item.message,
          userId: item.user_id,
          userEmail: item.user_email,
          userName: item.user_name,
          status: item.status || 'pending',
          createdAt: item.created_at || new Date().toISOString(),
          adminNotes: item.admin_notes,
        }));
        localStorage.setItem(PROPOSALS_STORAGE_KEY, JSON.stringify(mapped));
        return mapped;
      }
    }
  } catch (err) {
    console.warn('Supabase fetchCustomerProposals fallback to storage:', err);
  }

  try {
    const saved = localStorage.getItem(PROPOSALS_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.warn('Error reading proposals from storage:', e);
  }

  localStorage.setItem(PROPOSALS_STORAGE_KEY, JSON.stringify(INITIAL_PROPOSALS));
  return INITIAL_PROPOSALS;
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

  try {
    const supabase = getSupabase();
    if (isSupabaseConfigured() && supabase) {
      await supabase.from('launch_proposals').insert({
        id: newProposal.id,
        collection_id: newProposal.collectionId,
        collection_title: newProposal.collectionTitle,
        image_url: newProposal.imageUrl,
        message: newProposal.message,
        user_id: newProposal.userId,
        user_email: newProposal.userEmail,
        user_name: newProposal.userName,
        status: 'pending',
        created_at: newProposal.createdAt,
      });
    }
  } catch (err) {
    console.warn('Error submitting proposal to Supabase:', err);
  }

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

  try {
    const supabase = getSupabase();
    if (isSupabaseConfigured() && supabase) {
      await supabase
        .from('launch_proposals')
        .update({ status, admin_notes: adminNotes, updated_at: new Date().toISOString() })
        .eq('id', proposalId);
    }
  } catch (err) {
    console.warn('Error updating proposal status in Supabase:', err);
  }

  return updated;
}

export async function deleteCustomerProposal(proposalId: string): Promise<LaunchCustomerProposal[]> {
  const current = await fetchCustomerProposals();
  const updated = current.filter((p) => p.id !== proposalId);
  localStorage.setItem(PROPOSALS_STORAGE_KEY, JSON.stringify(updated));

  try {
    const supabase = getSupabase();
    if (isSupabaseConfigured() && supabase) {
      await supabase.from('launch_proposals').delete().eq('id', proposalId);
    }
  } catch (err) {
    console.warn('Error deleting proposal in Supabase:', err);
  }

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

  return { collections, proposals: updatedProposals };
}

// ---------------- GESTIÓN DE VISIBILIDAD DE PRÓXIMOS LANZAMIENTOS ---------------- //
export const LAUNCHES_VISIBILITY_STORAGE_KEY = 'my_commerce_launches_visible';
export const LAUNCHES_VISIBILITY_EVENT = 'launches_visibility_change';

/**
 * Consulta si la sección de Próximos Lanzamientos está visible públicamente en la tienda.
 * Por defecto es true.
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
 * Activa u oculta la sección de Próximos Lanzamientos en la tienda (menú, banner de inicio y acceso).
 */
export function setLaunchesSectionVisible(visible: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LAUNCHES_VISIBILITY_STORAGE_KEY, String(visible));
    window.dispatchEvent(new CustomEvent(LAUNCHES_VISIBILITY_EVENT, { detail: { visible } }));
  } catch (e) {
    console.warn('Error al guardar visibilidad de próximos lanzamientos:', e);
  }
}
