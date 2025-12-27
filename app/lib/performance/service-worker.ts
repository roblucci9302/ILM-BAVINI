/**
 * Service Worker Registration
 *
 * Registers the service worker for asset caching.
 * Only registers in production to avoid caching issues during development.
 */

let registration: ServiceWorkerRegistration | null = null;

/**
 * Check if service workers are supported
 */
export function isServiceWorkerSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator;
}

/**
 * Register the service worker
 * Only registers in production environment
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isServiceWorkerSupported()) {
    console.log('[SW] Service workers not supported');
    return null;
  }

  // Skip registration in development
  if (import.meta.env.DEV) {
    console.log('[SW] Skipping registration in development');
    return null;
  }

  try {
    registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    });

    console.log('[SW] Registered successfully');

    // Handle updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration?.installing;

      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New service worker is ready, notify user if needed
            console.log('[SW] New version available');
          }
        });
      }
    });

    return registration;
  } catch (error) {
    console.error('[SW] Registration failed:', error);
    return null;
  }
}

/**
 * Unregister the service worker
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if (!isServiceWorkerSupported()) {
    return false;
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();

    for (const reg of registrations) {
      await reg.unregister();
    }

    console.log('[SW] Unregistered successfully');
    return true;
  } catch (error) {
    console.error('[SW] Unregistration failed:', error);
    return false;
  }
}

/**
 * Clear all caches
 */
export async function clearServiceWorkerCache(): Promise<boolean> {
  if (!isServiceWorkerSupported()) {
    return false;
  }

  try {
    const cacheNames = await caches.keys();

    await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));

    console.log('[SW] Cache cleared');
    return true;
  } catch (error) {
    console.error('[SW] Cache clear failed:', error);
    return false;
  }
}

/**
 * Get the current service worker registration
 */
export function getRegistration(): ServiceWorkerRegistration | null {
  return registration;
}

/**
 * Check if a service worker update is available
 */
export async function checkForUpdate(): Promise<boolean> {
  if (!registration) {
    return false;
  }

  try {
    await registration.update();
    return registration.waiting !== null;
  } catch (error) {
    console.error('[SW] Update check failed:', error);
    return false;
  }
}

/**
 * Skip waiting and activate new service worker
 */
export function skipWaiting(): void {
  if (registration?.waiting) {
    registration.waiting.postMessage('skipWaiting');
  }
}
