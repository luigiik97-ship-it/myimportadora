/**
 * Sistema de Optimización y Ahorro de Consumo para Videos Cloudinary
 * 
 * - Inyecta transformaciones automáticas Cloudinary: f_auto (formato óptimo según navegador),
 *   q_auto (calidad perceptual automática para reducir peso sin pérdida perceptible),
 *   vc_auto (códec de video óptimo) y w_<px>,c_limit (escalado inteligente a la resolución necesaria).
 * - Genera posters de imagen estática (.jpg / .webp con so_0) para miniaturas y estados iniciales,
 *   evitando peticiones de streaming de video completas solo para mostrar una miniatura.
 * - Desduplica URLs en memoria y unifica la resolución estándar (720p 9:16) para que el carrusel
 *   de inicio, el visor de pantalla completa y la vista de detalle compartan exactamente la misma
 *   URL y aprovechen al 100% la caché HTTP del navegador (0 bytes de descarga duplicada).
 */

export interface CloudinaryVideoOptions {
  width?: number;              // Lado ancho máximo (720 estándar para máxima reutilización de caché)
  quality?: 'auto' | 'auto:good' | 'auto:eco' | number;
  format?: 'auto' | 'mp4' | 'webm';
}

// Caché global en memoria para normalizar URLs y garantizar que múltiples componentes
// utilicen exactamente la misma URL en caché del navegador
const videoUrlCache = new Map<string, string>();
const posterUrlCache = new Map<string, string>();

/**
 * Determina si una URL pertenece a la CDN de Cloudinary y es un recurso de video
 */
export const isCloudinaryVideoUrl = (url?: string | null): boolean => {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  return (
    trimmed.includes('res.cloudinary.com') &&
    trimmed.includes('/video/upload/')
  );
};

/**
 * Limpia y normaliza el path de Cloudinary eliminando transformaciones intermedias o previas
 * para asegurar URLs canónicas deterministas y máxima tasa de acierto de caché.
 */
const cleanCloudinaryPath = (rest: string): string => {
  const parts = rest.split('/');
  // Si encontramos el segmento de versión v12345..., todo desde allí es el contenido limpio
  const versionIndex = parts.findIndex((p) => /^v\d+$/.test(p));
  if (versionIndex !== -1) {
    return parts.slice(versionIndex).join('/');
  }

  // Si no hay versión explícita, saltamos todos los segmentos que sean transformaciones
  const isTransform = (s: string) => {
    return s.split(',').some((param) =>
      /^(q|f|w|h|c|vc|br|so|eo|du|fl|e|ac|ar|g|co|b|z)_/.test(param)
    );
  };

  let firstContentIndex = 0;
  while (firstContentIndex < parts.length && isTransform(parts[firstContentIndex])) {
    firstContentIndex++;
  }
  return parts.slice(firstContentIndex).join('/');
};

/**
 * Optimiza una URL de video de Cloudinary para consumo mínimo de ancho de banda:
 * - f_auto: formato automático óptimo (WebM/VP9, AV1 o MP4 según cliente)
 * - q_auto: compresión perceptual inteligente (ahorro de 60-80% de bitrate sin pérdida visible)
 * - vc_auto: selección óptima de códec
 * - w_<width>,c_limit: reduce la resolución original (ej. 4K o 1080p) a 720p sin upscaling ni deformación
 */
export const optimizeCloudinaryVideoUrl = (
  url?: string | null,
  options: CloudinaryVideoOptions = {}
): string => {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  if (!isCloudinaryVideoUrl(trimmed)) {
    return trimmed;
  }

  const targetWidth = options.width || 720;
  const targetQuality = options.quality || 'auto';
  const targetFormat = options.format || 'auto';

  const cacheKey = `${trimmed}|w:${targetWidth}|q:${targetQuality}|f:${targetFormat}`;
  if (videoUrlCache.has(cacheKey)) {
    return videoUrlCache.get(cacheKey)!;
  }

  try {
    const uploadMarker = '/video/upload/';
    const uploadIndex = trimmed.indexOf(uploadMarker);
    if (uploadIndex === -1) return trimmed;

    let prefix = trimmed.substring(0, uploadIndex + uploadMarker.length);
    if (prefix.startsWith('http://')) {
      prefix = 'https://' + prefix.substring(7);
    }
    const rest = trimmed.substring(uploadIndex + uploadMarker.length);
    const contentPath = cleanCloudinaryPath(rest);

    // Para videos MP4 y WebM en Cloudinary, devolver la URL canónica directa limpia (https)
    // Las transformaciones dinámicas de video excesivas (f_auto, vc_auto) eliminan 'Accept-Ranges: bytes',
    // obligan a transcodificación al vuelo y devuelven WebM VP9 bajo extensión .mp4, provocando
    // que el elemento <video> del navegador se trabe o congele durante el buffering.
    const lowerContentPath = contentPath.toLowerCase();
    const isStandardWebVideo = lowerContentPath.endsWith('.mp4') || lowerContentPath.endsWith('.webm');
    if (isStandardWebVideo) {
      const canonicalUrl = `${prefix}${contentPath}`;
      videoUrlCache.set(cacheKey, canonicalUrl);
      return canonicalUrl;
    }

    // Si es un archivo de video de iPhone / cámara (.mov, .m4v, .avi, etc.), solicitar contenedor .mp4 canónico
    // para garantizar streaming HTTP 206 instantáneo y reproducción sin trabas en todos los navegadores
    if (/\.(mov|m4v|avi|mkv|wmv)$/i.test(contentPath)) {
      const mp4Path = contentPath.replace(/\.(mov|m4v|avi|mkv|wmv)$/i, '.mp4');
      const canonicalMp4 = `${prefix}${mp4Path}`;
      videoUrlCache.set(cacheKey, canonicalMp4);
      return canonicalMp4;
    }

    // Construir transformaciones optimizadas canónicas para otros formatos
    const transforms: string[] = [
      `f_${targetFormat}`,
      typeof targetQuality === 'number' ? `q_${targetQuality}` : `q_${targetQuality}`,
    ];

    if (targetWidth > 0) {
      transforms.push(`w_${targetWidth}`);
      transforms.push('c_limit');
    }

    const optimized = `${prefix}${transforms.join(',')}/${contentPath}`;
    videoUrlCache.set(cacheKey, optimized);
    return optimized;
  } catch (err) {
    console.warn('[Cloudinary Optimizer] Error transformando URL de video:', err);
    return trimmed;
  }
};

/**
 * Genera una URL de imagen estática (poster) de alta compresión directamente desde Cloudinary
 * utilizando el fotograma inicial del video (so_0) con formato y calidad automáticos.
 * 
 * Evita que el navegador tenga que descargar datos de streaming de video solo para mostrar una miniatura.
 */
export const getCloudinaryVideoPosterUrl = (
  url?: string | null,
  options: { width?: number } = {}
): string => {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  if (!isCloudinaryVideoUrl(trimmed)) {
    return '';
  }

  const targetWidth = options.width || 720;
  const cacheKey = `${trimmed}|poster|w:${targetWidth}`;
  if (posterUrlCache.has(cacheKey)) {
    return posterUrlCache.get(cacheKey)!;
  }

  try {
    const uploadMarker = '/video/upload/';
    const uploadIndex = trimmed.indexOf(uploadMarker);
    if (uploadIndex === -1) return '';

    let prefix = trimmed.substring(0, uploadIndex + uploadMarker.length);
    if (prefix.startsWith('http://')) {
      prefix = 'https://' + prefix.substring(7);
    }
    const rest = trimmed.substring(uploadIndex + uploadMarker.length);
    const contentPath = cleanCloudinaryPath(rest);

    // Transformación para póster de imagen: fotograma inicial (so_0), ancho escalado, calidad y formato auto
    const transforms = [
      'so_0',
      `w_${targetWidth}`,
      'c_limit',
      'q_auto',
      'f_auto',
    ];

    // Reemplazar extensión de video por .jpg para que Cloudinary entregue la imagen renderizada en JPG/WebP
    const imagePath = contentPath.replace(/\.(mp4|mov|webm|mkv|avi|m4v)(\?.*)?$/i, '.jpg$2');
    const posterUrl = `${prefix}${transforms.join(',')}/${imagePath}`;

    posterUrlCache.set(cacheKey, posterUrl);
    return posterUrl;
  } catch (err) {
    console.warn('[Cloudinary Optimizer] Error generando poster de video:', err);
    return '';
  }
};

// Conjunto de URLs de video actualmente precargadas para evitar precargas duplicadas
const preloadedUrls = new Set<string>();
// Pool de elementos de video en memoria para mantener los búferes activos en caché del navegador
const activePreloadPool: HTMLVideoElement[] = [];
const MAX_PRELOAD_POOL_SIZE = 4;

/**
 * Precarga de forma discreta un video en segundo plano para que la transición
 * al siguiente reel o al abrir el visor sea instantánea y sin pausas.
 */
export const preloadVideo = (url?: string | null, width: number = 720): void => {
  if (!url || typeof window === 'undefined') return;
  const optimizedUrl = optimizeCloudinaryVideoUrl(url, { width });
  if (!optimizedUrl || preloadedUrls.has(optimizedUrl)) return;
  preloadedUrls.add(optimizedUrl);

  try {
    // Usar elemento video en memoria con preload="auto" para inicializar el búfer en caché HTTP
    const v = document.createElement('video');
    v.src = optimizedUrl;
    v.preload = 'auto';
    v.muted = true;
    v.playsInline = true;
    v.load();

    // Mantener referencia en el pool para prevenir recolección de basura antes de poblar la caché
    activePreloadPool.push(v);
    if (activePreloadPool.length > MAX_PRELOAD_POOL_SIZE) {
      const removed = activePreloadPool.shift();
      if (removed) {
        removed.src = '';
      }
    }
  } catch {
    // Si el navegador restringe la precarga, degradar silenciosamente
  }
};
