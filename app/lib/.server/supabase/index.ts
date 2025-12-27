/**
 * Module Supabase - Génération Backend Automatique
 *
 * Ce module fournit les outils pour générer automatiquement
 * des backends Supabase avec schémas, RLS, et migrations.
 */

// Types
export * from './types';

// Validators
export { SQLValidator, createSQLValidator } from './validators/SQLValidator';
export { NLPValidator, createNLPValidator } from './validators/NLPValidator';
export type { NLPValidatorOptions, TypeInference } from './validators/NLPValidator';
export { RLSValidator, createRLSValidator } from './validators/RLSValidator';
export type { RLSValidatorOptions, RLSValidationResult, PolicyAnalysis } from './validators/RLSValidator';

// Generators
export { SchemaGenerator, createSchemaGenerator } from './generators/SchemaGenerator';
export type { SchemaGeneratorOptions, GenerationResult, EntityExtractionResult } from './generators/SchemaGenerator';

export { TypeGenerator, createTypeGenerator } from './generators/TypeGenerator';
export type { TypeGeneratorOptions, GeneratedTypes } from './generators/TypeGenerator';

export { RLSGenerator, createRLSGenerator } from './generators/RLSGenerator';
export type { RLSGeneratorOptions, RLSGenerationResult, TableRLSConfig } from './generators/RLSGenerator';

// Managers
export { RollbackManager, createRollbackManager } from './RollbackManager';
