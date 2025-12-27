/**
 * Module de Quality Score pour BAVINI
 * Évalue la qualité du code généré et propose des améliorations
 */

// =============================================================================
// Quality Score
// =============================================================================

export * from './types';
export * from './evaluator';

// =============================================================================
// AutoFix System
// =============================================================================

export * from './autofix-types';
export { AutoFixProcessor, createAutoFixProcessor } from './AutoFixProcessor';
export * from './fixers';
