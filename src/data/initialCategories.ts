import { Category } from '../types';

/**
 * Categorías base del sistema.
 * Vacío por diseño: Supabase y los productos activos son la fuente autoritativa única y en vivo.
 * Se previene inyectar categorías predeterminadas obsoletas en el primer render.
 */
export const INITIAL_CATEGORIES: Category[] = [];
