/**
 * Reviewer Agent - Agent spécialisé dans la review de code
 * Analyse la qualité, la sécurité, et suggère des améliorations
 */

import { BaseAgent } from '../core/base-agent';
import type { ToolHandler } from '../core/tool-registry';
import {
  REVIEW_TOOLS,
  createReviewToolHandlers,
  type CodeAnalyzer,
  type AnalysisResult,
  type CodeIssue,
} from '../tools/review-tools';
import { READ_TOOLS, createReadToolHandlers, type FileSystem } from '../tools/read-tools';
import { REVIEWER_SYSTEM_PROMPT } from '../prompts/reviewer-prompt';
import type { Task, TaskResult, ToolDefinition, Artifact, ToolExecutionResult } from '../types';
import { getModelForAgent } from '../types';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('ReviewerAgent');

/*
 * ============================================================================
 * TYPES
 * ============================================================================
 */

/**
 * Rapport de review complet
 */
export interface ReviewReport {
  summary: string;
  score: {
    overall: number;
    quality: number;
    security: number;
    performance: number;
    maintainability: number;
  };
  issues: CodeIssue[];
  recommendations: string[];
  metrics: {
    filesReviewed: number;
    linesReviewed: number;
    issuesFound: number;
    criticalIssues: number;
  };
}

/*
 * ============================================================================
 * REVIEWER AGENT
 * ============================================================================
 */

/**
 * Agent de review de code
 */
export class ReviewerAgent extends BaseAgent {
  private analyzer: CodeAnalyzer | null = null;
  private fileSystem: FileSystem | null = null;
  private reviewHistory: Array<{
    timestamp: Date;
    file: string;
    score: number;
    issuesFound: number;
  }> = [];

  constructor() {
    super({
      name: 'reviewer',
      description:
        'Agent de review de code. Analyse la qualité, la sécurité, la performance. ' +
        'Détecte les code smells, calcule la complexité, suggère des améliorations.',
      model: getModelForAgent('reviewer'), // Opus 4.5 pour analyse approfondie
      tools: [...REVIEW_TOOLS, ...READ_TOOLS],
      systemPrompt: REVIEWER_SYSTEM_PROMPT,
      maxTokens: 8192,
      temperature: 0.2, // Légère variation pour suggestions créatives
    });
  }

  /**
   * Implémentation du system prompt
   */
  getSystemPrompt(): string {
    return REVIEWER_SYSTEM_PROMPT;
  }

  /**
   * Exécution principale de l'agent (appelée par run())
   */
  async execute(task: Task): Promise<TaskResult> {
    // Vérifier que l'analyseur est initialisé
    if (!this.analyzer) {
      return {
        success: false,
        output: 'CodeAnalyzer not initialized. Call setAnalyzer() first.',
        errors: [
          {
            code: 'ANALYZER_NOT_INITIALIZED',
            message: 'CodeAnalyzer not initialized',
            recoverable: false,
          },
        ],
      };
    }

    // Construire le prompt avec contexte
    let prompt = task.prompt;

    // Ajouter l'historique récent des reviews au contexte
    if (this.reviewHistory.length > 0) {
      const recent = this.reviewHistory.slice(-5);
      prompt += '\n\nHistorique récent des reviews:\n';

      for (const entry of recent) {
        prompt += `- ${entry.timestamp.toISOString()}: ${entry.file} - Score: ${entry.score}/100, ${entry.issuesFound} problèmes\n`;
      }
    }

    // Exécuter la boucle d'agent
    const result = await this.runAgentLoop(prompt);

    // Ajouter les artefacts du rapport de review
    if (result.success && result.data?.reviewReport) {
      result.artifacts = result.artifacts || [];

      const reviewArtifact: Artifact = {
        type: 'message',
        content: JSON.stringify(result.data.reviewReport, null, 2),
        title: 'Review Report',
      };
      result.artifacts.push(reviewArtifact);
    }

    return result;
  }

  /**
   * Initialiser l'analyseur de code
   * Enregistre les outils de review dans le ToolRegistry
   */
  setAnalyzer(analyzer: CodeAnalyzer): void {
    this.analyzer = analyzer;

    // Créer des handlers wrappés pour tracker les reviews
    const handlers = createReviewToolHandlers(analyzer);
    const wrappedHandlers = this.wrapReviewHandlersWithTracking(handlers);
    this.registerTools(REVIEW_TOOLS, wrappedHandlers, 'review');

    this.log('info', 'CodeAnalyzer initialized for ReviewerAgent with ToolRegistry');
  }

  /**
   * Initialiser le système de fichiers (pour la lecture)
   * Enregistre les outils de lecture dans le ToolRegistry
   */
  setFileSystem(fs: FileSystem): void {
    this.fileSystem = fs;

    const handlers = createReadToolHandlers(fs);
    this.registerTools(READ_TOOLS, handlers as unknown as Record<string, ToolHandler>, 'filesystem');

    this.log('info', 'FileSystem initialized for ReviewerAgent with ToolRegistry');
  }

  /**
   * Wrapper les handlers de review pour tracker les résultats
   */
  private wrapReviewHandlersWithTracking(
    handlers: ReturnType<typeof createReviewToolHandlers>,
  ): Record<string, ToolHandler> {
    const wrapped: Record<string, ToolHandler> = {};

    for (const [name, handler] of Object.entries(handlers)) {
      wrapped[name] = async (input: Record<string, unknown>): Promise<ToolExecutionResult> => {
        const result = await (handler as (input: unknown) => Promise<unknown>)(input);

        // Tracker les résultats d'analyse
        if (name === 'analyze_code' && result) {
          this.trackReview(result as AnalysisResult);
        }

        // Wrapper le résultat dans le format attendu
        return {
          success: true,
          output: result,
        };
      };
    }

    return wrapped;
  }

  /**
   * Obtenir l'historique des reviews
   */
  getReviewHistory(): typeof this.reviewHistory {
    return [...this.reviewHistory];
  }

  /**
   * Vider l'historique des reviews
   */
  clearReviewHistory(): void {
    this.reviewHistory = [];
  }

  // executeToolHandler est hérité de BaseAgent et utilise le ToolRegistry

  /**
   * Tracker les résultats d'une review
   */
  private trackReview(result: AnalysisResult): void {
    this.reviewHistory.push({
      timestamp: new Date(),
      file: result.file,
      score: result.score.overall,
      issuesFound: result.issues.length,
    });

    // Garder seulement les 50 dernières reviews
    if (this.reviewHistory.length > 50) {
      this.reviewHistory = this.reviewHistory.slice(-50);
    }
  }

  /**
   * Obtenir la liste des outils disponibles
   */
  getAvailableTools(): ToolDefinition[] {
    return this.config.tools;
  }

  /**
   * Générer un rapport de review agrégé
   */
  generateReport(analyses: AnalysisResult[]): ReviewReport {
    if (analyses.length === 0) {
      return {
        summary: 'No files analyzed',
        score: { overall: 0, quality: 0, security: 0, performance: 0, maintainability: 0 },
        issues: [],
        recommendations: [],
        metrics: { filesReviewed: 0, linesReviewed: 0, issuesFound: 0, criticalIssues: 0 },
      };
    }

    // Agréger les scores
    const avgScore = {
      overall: 0,
      quality: 0,
      security: 0,
      performance: 0,
      maintainability: 0,
    };

    for (const analysis of analyses) {
      avgScore.overall += analysis.score.overall;
      avgScore.quality += analysis.score.quality;
      avgScore.security += analysis.score.security;
      avgScore.performance += analysis.score.performance;
      avgScore.maintainability += analysis.score.maintainability;
    }

    const count = analyses.length;
    avgScore.overall = Math.round(avgScore.overall / count);
    avgScore.quality = Math.round(avgScore.quality / count);
    avgScore.security = Math.round(avgScore.security / count);
    avgScore.performance = Math.round(avgScore.performance / count);
    avgScore.maintainability = Math.round(avgScore.maintainability / count);

    // Agréger les issues
    const allIssues: CodeIssue[] = [];
    let totalLines = 0;

    for (const analysis of analyses) {
      allIssues.push(...analysis.issues);
      totalLines += analysis.linesAnalyzed;
    }

    // Compter les issues critiques
    const criticalIssues = allIssues.filter((i) => i.severity === 'high').length;

    // Générer les recommandations basées sur les issues
    const recommendations: string[] = [];

    if (criticalIssues > 0) {
      recommendations.push(`Address ${criticalIssues} high-severity issues immediately`);
    }

    if (avgScore.security < 80) {
      recommendations.push('Review security practices and fix vulnerabilities');
    }

    if (avgScore.performance < 80) {
      recommendations.push('Consider performance optimizations');
    }

    if (avgScore.maintainability < 80) {
      recommendations.push('Improve code maintainability through refactoring');
    }

    return {
      summary: `Reviewed ${count} files with an average score of ${avgScore.overall}/100`,
      score: avgScore,
      issues: allIssues,
      recommendations,
      metrics: {
        filesReviewed: count,
        linesReviewed: totalLines,
        issuesFound: allIssues.length,
        criticalIssues,
      },
    };
  }
}

/*
 * ============================================================================
 * FACTORY
 * ============================================================================
 */

/**
 * Créer une instance du Reviewer Agent
 */
export function createReviewerAgent(analyzer?: CodeAnalyzer, fileSystem?: FileSystem): ReviewerAgent {
  const agent = new ReviewerAgent();

  if (analyzer) {
    agent.setAnalyzer(analyzer);
  }

  if (fileSystem) {
    agent.setFileSystem(fileSystem);
  }

  return agent;
}
