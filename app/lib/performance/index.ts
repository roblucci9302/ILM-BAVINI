/**
 * Performance Optimization Module
 *
 * This module provides utilities for:
 * - Strategic module preloading
 * - Performance metrics collection
 * - Bundle size optimization
 */

export {
  initPreloading,
  schedulePreload,
  preloadOnWorkbenchInteraction,
  preloadOnFirstMessage,
  preloadOnTypingStart,
  isPreloaded,
  resetPreloading,
} from './preloader';
