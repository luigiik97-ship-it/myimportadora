/**
 * Utilidad y Hook para bloqueo de scroll del fondo en ventanas modales interactivas
 * 
 * Requisitos y Comportamiento:
 * - Exclusivo para la web pública (no administración).
 * - Se activa únicamente cuando se abre una ventana modal que requiera interacción del usuario para cerrarse
 *   (ejemplos: ampliar imagen en lightbox, iniciar sesión, 'avísame' aviso de stock, mi cuenta, mapa, compartir).
 * - NO se aplica a notificaciones temporales tipo 'toast' ni mensajes automáticos.
 * - Mientras el modal está abierto: impide el scroll del fondo en móvil (dedo/touch) y escritorio
 *   (rueda del mouse, trackpad, barra de scroll), permitiendo solo el scroll interno dentro del modal si aplica.
 * - Al cerrar: restituye de forma instantánea el scroll del fondo en la misma posición exacta, sin saltos.
 * - Utiliza contador de referencias (reference counting) para soportar modales encadenados o anidados sin pérdida de posición.
 */
import { useEffect } from 'react';

let lockCount = 0;
let savedScrollY = 0;
let savedBodyStyles: {
  position: string;
  top: string;
  left: string;
  right: string;
  width: string;
  overflow: string;
  paddingRight: string;
} | null = null;
let savedHtmlOverflow: string | null = null;

export function lockBackgroundScroll(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  lockCount++;

  // Si ya estaba bloqueado por otro modal activo, mantener el bloqueo y la posición original
  if (lockCount > 1) {
    return;
  }

  // 1. Guardar la posición actual exacta del scroll
  savedScrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;

  // 2. Compensar el ancho de la barra de desplazamiento en escritorio para evitar saltos horizontales
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

  // 3. Guardar estilos previos para restauración limpia
  savedBodyStyles = {
    position: document.body.style.position,
    top: document.body.style.top,
    left: document.body.style.left,
    right: document.body.style.right,
    width: document.body.style.width,
    overflow: document.body.style.overflow,
    paddingRight: document.body.style.paddingRight,
  };
  savedHtmlOverflow = document.documentElement.style.overflow;

  // 4. Aplicar bloqueo inmovilizando la vista en la posición actual
  document.documentElement.style.overflow = 'hidden';
  document.body.style.position = 'fixed';
  document.body.style.top = `-${savedScrollY}px`;
  document.body.style.left = '0';
  document.body.style.right = '0';
  document.body.style.width = '100%';
  document.body.style.overflow = 'hidden';

  if (scrollbarWidth > 0) {
    document.body.style.paddingRight = `${scrollbarWidth}px`;
  }
}

export function unlockBackgroundScroll(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  if (lockCount <= 0) {
    lockCount = 0;
    return;
  }

  lockCount--;

  // Si todavía quedan otros modales abiertos, mantener el bloqueo
  if (lockCount > 0) {
    return;
  }

  // 5. Restaurar estilos previos de html y body
  if (savedBodyStyles) {
    document.body.style.position = savedBodyStyles.position;
    document.body.style.top = savedBodyStyles.top;
    document.body.style.left = savedBodyStyles.left;
    document.body.style.right = savedBodyStyles.right;
    document.body.style.width = savedBodyStyles.width;
    document.body.style.overflow = savedBodyStyles.overflow;
    document.body.style.paddingRight = savedBodyStyles.paddingRight;
    savedBodyStyles = null;
  } else {
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
  }

  if (savedHtmlOverflow !== null) {
    document.documentElement.style.overflow = savedHtmlOverflow;
    savedHtmlOverflow = null;
  } else {
    document.documentElement.style.overflow = '';
  }

  // 6. Restituir exactamente la posición original del scroll sin saltos ni animaciones
  const restoreY = savedScrollY;
  window.scrollTo({
    top: restoreY,
    left: 0,
    behavior: 'instant' as ScrollBehavior,
  });
}

/**
 * Hook reutilizable para ventanas modales interactivas que requieran bloqueo de scroll del fondo
 * @param isOpen Booleano que indica si la ventana modal está abierta
 */
export function useModalScrollLock(isOpen: boolean): void {
  useEffect(() => {
    if (!isOpen) return;

    lockBackgroundScroll();

    return () => {
      unlockBackgroundScroll();
    };
  }, [isOpen]);
}
