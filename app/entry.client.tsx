import { RemixBrowser } from '@remix-run/react';
import { startTransition } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { initPreloading, registerServiceWorker } from '~/lib/performance';

startTransition(() => {
  hydrateRoot(document.getElementById('root')!, <RemixBrowser />);
});

// Initialize performance optimizations after hydration
if (typeof window !== 'undefined') {
  // Wait for hydration to complete before starting optimizations
  requestAnimationFrame(() => {
    // Strategic module preloading during idle time
    initPreloading();

    // Register service worker for asset caching (production only)
    registerServiceWorker();
  });
}
