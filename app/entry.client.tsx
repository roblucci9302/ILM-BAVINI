import { RemixBrowser } from '@remix-run/react';
import { startTransition } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { initPreloading } from '~/lib/performance';

startTransition(() => {
  hydrateRoot(document.getElementById('root')!, <RemixBrowser />);
});

// Initialize strategic module preloading after hydration
// This preloads heavy modules during idle time to improve perceived performance
if (typeof window !== 'undefined') {
  // Wait for hydration to complete before starting preload
  requestAnimationFrame(() => {
    initPreloading();
  });
}
