import { Product } from '../types';

/**
 * Catálogo base del sistema.
 * Vacío por diseño: Supabase es la fuente autoritativa única y en vivo de los productos de la tienda.
 * Se previene inyectar productos predeterminados antiguos en el primer render.
 */
export const INITIAL_PRODUCTS: Product[] = [];
