/**
 * Git module for BAVINI.
 * Uses isomorphic-git for browser-based Git operations.
 */

export * from './operations';
export * from './cors-proxy';
export * from './file-sync';
export { gitStore, type GitState, type GitStatus } from '~/lib/stores/git';
