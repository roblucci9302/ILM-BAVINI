/**
 * Types pour le système de Quality Score
 * Évalue la qualité du code généré et décide si des améliorations sont nécessaires
 */

/**
 * Score de qualité d'un fichier ou bloc de code
 */
export interface QualityScore {
  /** Score global (0-100) */
  overall: number;

  /** Scores détaillés par catégorie */
  categories: {
    /** TypeScript: typage strict, pas de any */
    typescript: number;
    /** Tests: présence et qualité des tests */
    testing: number;
    /** Sécurité: pas de vulnérabilités */
    security: number;
    /** Performance: code optimisé */
    performance: number;
    /** Maintenabilité: code lisible et modulaire */
    maintainability: number;
    /** Structure: respect des conventions BAVINI */
    structure: number;
  };

  /** Niveau de qualité déterminé */
  level: QualityLevel;

  /** Action recommandée */
  action: QualityAction;
}

/**
 * Niveaux de qualité
 */
export type QualityLevel =
  | 'excellent' // 90-100 : Aucune amélioration nécessaire
  | 'good' // 75-89 : Quelques suggestions optionnelles
  | 'acceptable' // 60-74 : Améliorations recommandées
  | 'poor' // 40-59 : Améliorations nécessaires
  | 'critical'; // 0-39 : Refactoring obligatoire

/**
 * Actions possibles après évaluation
 */
export type QualityAction =
  | 'approve' // Code approuvé tel quel
  | 'suggest' // Proposer des améliorations optionnelles
  | 'improve' // Améliorer automatiquement
  | 'refactor'; // Refactoring complet nécessaire

/**
 * Problème détecté dans le code
 */
export interface QualityIssue {
  /** Catégorie du problème */
  category: keyof QualityScore['categories'];

  /** Sévérité */
  severity: 'critical' | 'major' | 'minor' | 'info';

  /** Description du problème */
  message: string;

  /** Fichier concerné */
  file?: string;

  /** Ligne concernée */
  line?: number;

  /** Suggestion de correction */
  suggestion?: string;

  /** Impact sur le score (-1 à -20 selon sévérité) */
  impact: number;
}

/**
 * Rapport complet d'évaluation de qualité
 */
export interface QualityReport {
  /** Timestamp de l'évaluation */
  timestamp: Date;

  /** Score calculé */
  score: QualityScore;

  /** Problèmes détectés */
  issues: QualityIssue[];

  /** Résumé textuel en français */
  summary: string;

  /** Suggestions d'amélioration (si action !== 'approve') */
  suggestions: string[];

  /** Métriques brutes */
  metrics: QualityMetrics;
}

/**
 * Métriques collectées sur le code
 */
export interface QualityMetrics {
  /** Nombre de fichiers analysés */
  filesAnalyzed: number;

  /** Lignes de code total */
  totalLines: number;

  /** Fichiers TypeScript (vs JavaScript) */
  typescriptFiles: number;

  /** Fichiers de test détectés */
  testFiles: number;

  /** Fichiers avec types 'any' */
  filesWithAny: number;

  /** Fichiers avec try/catch */
  filesWithErrorHandling: number;

  /** Fichiers > 100 lignes */
  largeFiles: number;
}

/**
 * Configuration des seuils de qualité
 */
export interface QualityThresholds {
  /** Seuil pour 'excellent' */
  excellent: number;
  /** Seuil pour 'good' */
  good: number;
  /** Seuil pour 'acceptable' */
  acceptable: number;
  /** Seuil pour 'poor' */
  poor: number;
}

/**
 * Seuils par défaut
 */
export const DEFAULT_THRESHOLDS: QualityThresholds = {
  excellent: 90,
  good: 75,
  acceptable: 60,
  poor: 40,
};

/**
 * Poids des catégories dans le score global
 */
export const CATEGORY_WEIGHTS: Record<keyof QualityScore['categories'], number> = {
  typescript: 0.25, // 25% - TypeScript est prioritaire
  testing: 0.20, // 20% - Tests obligatoires
  security: 0.20, // 20% - Sécurité critique
  performance: 0.10, // 10% - Performance importante
  maintainability: 0.15, // 15% - Maintenabilité
  structure: 0.10, // 10% - Structure du projet
};
