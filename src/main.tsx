import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import App from './App.tsx';
import {ErrorBoundary} from './components/common/ErrorBoundary';
import './index.css';

// Precarga anticipada ultra-rápida de las imágenes críticas del viewport inicial (Banner principal y categorías)
if (typeof window !== 'undefined') {
  try {
    const bannersRaw = localStorage.getItem('my_commerce_store_banners_config');
    if (bannersRaw) {
      const cfg = JSON.parse(bannersRaw);
      const heroUrl = cfg.heroBanners?.[0]?.imageUrl || cfg.heroBanner1;
      if (heroUrl && typeof heroUrl === 'string' && heroUrl.startsWith('http')) {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = heroUrl;
        (link as any).fetchPriority = 'high';
        document.head.appendChild(link);
      }
    }
    const catsRaw = localStorage.getItem('my_commerce_categories');
    if (catsRaw) {
      const cats = JSON.parse(catsRaw);
      if (Array.isArray(cats)) {
        cats.slice(0, 6).forEach((c) => {
          if (c.image && typeof c.image === 'string' && c.image.startsWith('http')) {
            const img = new Image();
            if ('fetchPriority' in img) {
              (img as any).fetchPriority = 'high';
            }
            img.decoding = 'async';
            img.src = c.image;
          }
        });
      }
    }
  } catch (e) {}
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
