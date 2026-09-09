/**
 * Sistema de Optimización Automática de Imágenes para Panel de Administración
 * 
 * - Redimensiona de forma inteligente con lado mayor entre 1200 y 1600 px (sin upscaling).
 * - Imagen principal (portada): objetivo entre 200 y 300 KB.
 * - Imágenes secundarias (galería y variantes): objetivo entre 150 y 250 KB.
 * - Conversión automática a formato moderno WebP con fallback a JPEG.
 * - Compresión adaptativa con ajuste dinámico de calidad y dimensiones.
 */

export interface ImageOptimizationOptions {
  isCover?: boolean;            // true para portada/banner principal, false para secundarias
  maxDimension?: number;        // Lado mayor máximo (1200 - 1600 px)
  targetMinKB?: number;         // Tamaño objetivo mínimo en KB
  targetMaxKB?: number;         // Tamaño objetivo máximo en KB
  format?: 'webp' | 'jpeg' | 'auto';
}

export interface OptimizationResult {
  file: File;
  originalSizeKB: number;
  optimizedSizeKB: number;
  savedPercent: number;
  width: number;
  height: number;
  format: 'webp' | 'jpeg';
  isCover: boolean;
}

// Comprueba soporte del navegador para exportar WebP desde canvas
let _isWebPSupported: boolean | null = null;
export const isWebPSupported = (): boolean => {
  if (_isWebPSupported !== null) return _isWebPSupported;
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const dataUrl = canvas.toDataURL('image/webp');
    _isWebPSupported = typeof dataUrl === 'string' && dataUrl.indexOf('data:image/webp') === 0;
  } catch {
    _isWebPSupported = false;
  }
  return _isWebPSupported;
};

/**
 * Carga una imagen de forma segura compatible con todos los navegadores
 */
const loadImageSource = async (
  file: File
): Promise<{ source: CanvasImageSource; width: number; height: number; cleanup: () => void }> => {
  // Intentar primero con createImageBitmap (maneja rotación EXIF automáticamente)
  if (typeof window !== 'undefined' && 'createImageBitmap' in window) {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close(),
      };
    } catch {
      // Fallback si createImageBitmap falla
    }
  }

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({
        source: img,
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        cleanup: () => URL.revokeObjectURL(objectUrl),
      });
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(objectUrl);
      reject(e);
    };
    img.src = objectUrl;
  });
};

/**
 * Convierte un Canvas a Blob según formato y calidad especificados
 */
const canvasToBlob = (
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number
): Promise<Blob | null> => {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob),
      mimeType,
      Math.min(Math.max(quality, 0.1), 1.0)
    );
  });
};

/**
 * Optimiza una imagen antes de enviarla a Supabase Storage:
 * - Portada/Principal: Lado mayor hasta 1600px, objetivo 200 - 300 KB.
 * - Secundarias: Lado mayor hasta 1400px (rango 1200-1400px), objetivo 150 - 250 KB.
 * - Salida en WebP (o JPEG si no es compatible).
 */
export const optimizeProductImage = async (
  file: File,
  options: ImageOptimizationOptions = {}
): Promise<OptimizationResult> => {
  const originalSizeKB = file.size / 1024;
  const isCover = options.isCover ?? false;

  // No procesar SVGs ni GIFs animados (mantener vectores y animación)
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return {
      file,
      originalSizeKB,
      optimizedSizeKB: originalSizeKB,
      savedPercent: 0,
      width: 0,
      height: 0,
      format: file.type === 'image/svg+xml' ? 'jpeg' : 'webp',
      isCover,
    };
  }

  try {
    // 1. Determinar formato moderno compatible
    const supportsWebP = isWebPSupported();
    const useFormat = options.format === 'jpeg' ? 'jpeg' : (supportsWebP ? 'webp' : 'jpeg');
    const mimeType = useFormat === 'webp' ? 'image/webp' : 'image/jpeg';
    const ext = useFormat === 'webp' ? 'webp' : 'jpg';

    // 2. Parámetros de tamaño y resolución según si es principal o secundaria
    // Lado mayor entre 1200 y 1600 px
    const targetMaxDimension = options.maxDimension || (isCover ? 1600 : 1400);
    const targetMinKB = options.targetMinKB || (isCover ? 200 : 150);
    const targetMaxKB = options.targetMaxKB || (isCover ? 300 : 250);

    // 3. Cargar la imagen en memoria
    const { source, width: origWidth, height: origHeight, cleanup } = await loadImageSource(file);

    try {
      // 4. Calcular dimensiones inteligentes manteniendo la proporción de aspecto
      let currentMaxDim = targetMaxDimension;
      const longestEdge = Math.max(origWidth, origHeight);

      // Si la imagen original es menor a 1200px, no agrandar (evitar pixelación)
      let targetWidth = origWidth;
      let targetHeight = origHeight;

      if (longestEdge > currentMaxDim) {
        if (origWidth >= origHeight) {
          targetWidth = currentMaxDim;
          targetHeight = Math.round((origHeight * currentMaxDim) / origWidth);
        } else {
          targetHeight = currentMaxDim;
          targetWidth = Math.round((origWidth * currentMaxDim) / origHeight);
        }
      }

      // 5. Crear Canvas y dibujar con suavizado de alta calidad
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d', { alpha: useFormat === 'webp' });

      if (!ctx) {
        throw new Error('No se pudo inicializar el contexto 2D del Canvas');
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Si es JPEG (o fondo con transparencia exportado a JPEG), rellenar fondo blanco
      if (useFormat === 'jpeg') {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, targetWidth, targetHeight);
      }

      ctx.drawImage(source, 0, 0, targetWidth, targetHeight);

      // 6. Proceso de compresión inteligente hacia el rango de KB deseado
      // Calidad inicial alta: 0.86 para principal, 0.82 para secundarias
      let quality = isCover ? 0.86 : 0.82;
      let blob = await canvasToBlob(canvas, mimeType, quality);
      let sizeKB = blob ? blob.size / 1024 : originalSizeKB;

      // Si el tamaño supera el máximo objetivo (300KB principal, 250KB secundaria),
      // ajustar calidad y/o dimensiones iterativamente (máximo 4 pasos rápidos)
      let iterations = 0;
      while (blob && sizeKB > targetMaxKB && iterations < 4) {
        iterations++;
        if (sizeKB > targetMaxKB * 1.5) {
          quality -= 0.12;
        } else if (sizeKB > targetMaxKB * 1.2) {
          quality -= 0.07;
        } else {
          quality -= 0.04;
        }

        // Si la calidad bajó de 0.55 y aún excede el límite (foto con ruido/textura muy compleja),
        // reducir ligeramente las dimensiones pero manteniéndola siempre entre 1200 y 1600px
        if (quality < 0.55 && currentMaxDim > 1200) {
          currentMaxDim = Math.max(1200, Math.round(currentMaxDim * 0.88));
          if (origWidth >= origHeight) {
            targetWidth = currentMaxDim;
            targetHeight = Math.round((origHeight * currentMaxDim) / origWidth);
          } else {
            targetHeight = currentMaxDim;
            targetWidth = Math.round((origWidth * currentMaxDim) / origHeight);
          }
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          if (useFormat === 'jpeg') {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, targetWidth, targetHeight);
          }
          ctx.drawImage(source, 0, 0, targetWidth, targetHeight);
          quality = isCover ? 0.76 : 0.72; // Reiniciar calidad razonable con menor resolución
        }

        blob = await canvasToBlob(canvas, mimeType, Math.max(0.45, quality));
        sizeKB = blob ? blob.size / 1024 : sizeKB;
      }

      // Si el tamaño es menor al rango mínimo pero la calidad era conservadora y la imagen original es pesada,
      // podemos aprovechar un poco más de calidad para máxima nitidez (sin superar targetMaxKB)
      if (blob && sizeKB < targetMinKB && originalSizeKB > targetMinKB && quality < 0.90) {
        const higherQuality = Math.min(0.92, quality + 0.08);
        const testBlob = await canvasToBlob(canvas, mimeType, higherQuality);
        if (testBlob && testBlob.size / 1024 <= targetMaxKB) {
          blob = testBlob;
          sizeKB = testBlob.size / 1024;
        }
      }

      if (!blob) {
        throw new Error('No se pudo generar el archivo comprimido');
      }

      // 7. Construir nuevo nombre de archivo limpio con la extensión moderna
      const rawName = file.name || 'image';
      const lastDotIndex = rawName.lastIndexOf('.');
      const baseName = lastDotIndex > 0 ? rawName.substring(0, lastDotIndex) : rawName;
      const sanitizedBase = baseName
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '_')
        .replace(/_+/g, '_')
        .slice(0, 50);
      const newFileName = `${sanitizedBase}.${ext}`;

      const optimizedFile = new File([blob], newFileName, {
        type: mimeType,
        lastModified: Date.now(),
      });

      const optimizedSizeKB = blob.size / 1024;
      const savedPercent = originalSizeKB > 0
        ? Math.max(0, ((originalSizeKB - optimizedSizeKB) / originalSizeKB) * 100)
        : 0;

      console.log(
        `[IMAGE OPTIMIZER] ✓ "${file.name}" optimizada: ` +
        `${originalSizeKB.toFixed(1)} KB ➔ ${optimizedSizeKB.toFixed(1)} KB ` +
        `(-${savedPercent.toFixed(1)}%, ${targetWidth}x${targetHeight} ${useFormat.toUpperCase()}, ${isCover ? 'Principal' : 'Secundaria'})`
      );

      return {
        file: optimizedFile,
        originalSizeKB,
        optimizedSizeKB,
        savedPercent,
        width: targetWidth,
        height: targetHeight,
        format: useFormat,
        isCover,
      };
    } finally {
      cleanup();
    }
  } catch (error) {
    console.warn('[IMAGE OPTIMIZER] Fallo al optimizar imagen, usando archivo original:', error);
    return {
      file,
      originalSizeKB,
      optimizedSizeKB: originalSizeKB,
      savedPercent: 0,
      width: 0,
      height: 0,
      format: 'jpeg',
      isCover,
    };
  }
};

/**
 * Optimiza un arreglo de imágenes en lote, identificando portada y secundarias
 */
export const optimizeProductImagesBatch = async (
  files: File[],
  options?: {
    isFirstImageCover?: boolean;
    areAllSecondary?: boolean;
    onProgress?: (current: number, total: number, result?: OptimizationResult) => void;
  }
): Promise<OptimizationResult[]> => {
  if (!files || !Array.isArray(files) || files.length === 0) {
    return [];
  }
  const results: OptimizationResult[] = [];
  const total = files.length;

  for (let i = 0; i < total; i++) {
    const isCover = options?.areAllSecondary ? false : (options?.isFirstImageCover ? i === 0 : i === 0);
    const res = await optimizeProductImage(files[i], { isCover });
    results.push(res);
    if (options?.onProgress) {
      options.onProgress(i + 1, total, res);
    }
  }

  return results;
};
