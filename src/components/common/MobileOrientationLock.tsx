import React, { useEffect, useState } from 'react';
import { Smartphone, RotateCcw } from 'lucide-react';

/**
 * MobileOrientationLock
 * 
 * Enforces vertical / portrait mode strictly on mobile phones.
 * - Does NOT affect desktop/laptop computers.
 * - Does NOT affect tablets (iPads, Android tablets).
 * - Applies across all views and pages seamlessly.
 */
export const MobileOrientationLock: React.FC = () => {
  const [isMobileLandscape, setIsMobileLandscape] = useState(false);

  useEffect(() => {
    // Attempt standard Screen Orientation API lock if supported by the browser
    const attemptOrientationLock = () => {
      try {
        if (
          typeof window !== 'undefined' &&
          window.screen &&
          window.screen.orientation &&
          typeof (window.screen.orientation as any).lock === 'function'
        ) {
          (window.screen.orientation as any).lock('portrait').catch(() => {
            // Lock rejected (normal on standard browsers without fullscreen or PWA mode)
          });
        }
      } catch {
        // Silently ignore
      }
    };

    attemptOrientationLock();

    const checkOrientation = () => {
      if (typeof window === 'undefined') return;

      const width = window.innerWidth;
      const height = window.innerHeight;
      const isLandscape = width > height;

      // Check if device is a mobile phone (NOT a tablet, NOT a desktop)
      const userAgent = navigator.userAgent || '';
      const isMobileUA = /iPhone|iPod|Android.*Mobile/i.test(userAgent);
      const isTabletUA = /iPad|Tablet|PlayBook|Silk/i.test(userAgent);
      const isTouch = 'ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);

      // On mobile phones in landscape mode, viewport height is typically <= 550px
      // Tablets in landscape mode have height >= 600px (e.g. 768px, 800px, 1024px)
      // Desktops typically have non-coarse pointers or large heights (> 600px)
      const isPhoneDimensions = height <= 550 && width <= 1000;

      const isPhone = (isMobileUA || (isTouch && isPhoneDimensions)) && !isTabletUA && height < 580;

      if (isLandscape && isPhone) {
        setIsMobileLandscape(true);
      } else {
        setIsMobileLandscape(false);
      }
    };

    checkOrientation();

    window.addEventListener('resize', checkOrientation, { passive: true });
    window.addEventListener('orientationchange', checkOrientation, { passive: true });
    
    // Also re-attempt lock on first user interaction
    const handleFirstTouch = () => {
      attemptOrientationLock();
      window.removeEventListener('touchstart', handleFirstTouch);
    };
    window.addEventListener('touchstart', handleFirstTouch, { passive: true });

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
      window.removeEventListener('touchstart', handleFirstTouch);
    };
  }, []);

  if (!isMobileLandscape) return null;

  return (
    <aside
      role="status"
      aria-live="polite"
      id="mobile-orientation-lock-overlay"
      className="fixed inset-0 z-[99999] bg-[#0058bb] text-white flex flex-col items-center justify-center p-6 text-center select-none"
      style={{
        width: '100vw',
        height: '100vh',
      }}
    >
      <div className="max-w-xs flex flex-col items-center animate-pulse">
        {/* Animated Rotate Phone Icon */}
        <div className="relative mb-4 w-16 h-16 flex items-center justify-center">
          <Smartphone className="w-12 h-12 text-white animate-bounce" />
          <RotateCcw className="w-6 h-6 text-[#ffdd00] absolute -top-1 -right-1" />
        </div>

        <div className="font-black text-2xl tracking-tighter font-['Montserrat'] mb-2">
          MY
        </div>

        <h2 className="text-lg font-bold mb-1.5 text-white">
          Gira tu teléfono
        </h2>

        <p className="text-xs text-blue-100 leading-relaxed max-w-[260px]">
          Esta tienda funciona exclusivamente en <strong>modo vertical</strong> en teléfonos móviles. Por favor, gira tu dispositivo para continuar.
        </p>
      </div>
    </aside>
  );
};
