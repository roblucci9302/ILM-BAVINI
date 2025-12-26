/**
 * Tester Agent - Agent spécialisé dans l'exécution de tests
 * Lance les tests, analyse les résultats, et suggère des corrections
 */

import { BaseAgent } from '../core/base-agent';
import { TEST_TOOLS, createTestToolHandlers, type TestRunner } from '../tools/test-tools';
import { TESTER_SYSTEM_PROMPT } from '../prompts/tester-prompt';
import type { Task, TaskResult, ToolDefinition, Artifact } from '../types';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('TesterAgent');

// ============================================================================
// TESTER AGENT
// ============================================================================

/**
 * Agent de test et validation
 */
export class TesterAgent extends BaseAgent {
  private testRunner: TestRunner | null = null;
  private testHandlers: ReturnType<typeof createTestToolHandlers> | null = null;
  private testHistory: Array<{
    timestamp: Date;
    passed: number;
    failed: number;
    duration: number;
  }> = [];

  constructor() {
    super({
      name: 'tester',
      description:
        'Agent de test. Lance les tests unitaires et d\'intégration, ' +
        'analyse les résultats, suggère des corrections. Supporte vitest, jest, mocha.',
      model: 'claude-sonnet-4-5-20250929',
      tools: TEST_TOOLS,
      systemPrompt: TESTER_SYSTEM_PROMPT,
      maxTokens: 4096,
      temperature: 0.1, // Déterministe pour l'analyse
    });
  }

  /**
   * Implémentation du system prompt
   */
  getSystemPrompt(): string {
    return TESTER_SYSTEM_PROMPT;
  }

  /**
   * Exécution principale de l'agent (appelée par run())
   */
  async execute(task: Task): Promise<TaskResult> {
    // Vérifier que le TestRunner est initialisé
    if (!this.testRunner || !this.testHandlers) {
      return {
        success: false,
        output: 'TestRunner not initialized. Call setTestRunner() first.',
        errors: [
          {
            code: 'RUNNER_NOT_INITIALIZED',
            message: 'TestRunner not initialized',
            recoverable: false,
          },
        ],
      };
    }

    // Construire le prompt avec contexte
    let prompt = task.prompt;

    // Ajouter l'historique récent des tests au contexte
    if (this.testHistory.length > 0) {
      const recent = this.testHistory.slice(-5);
      prompt += '\n\nHistorique récent des tests:\n';

      for (const entry of recent) {
        prompt += `- ${entry.timestamp.toISOString()}: ${entry.passed} passés, ${entry.failed} échoués (${entry.duration}ms)\n`;
      }
    }

    // Détecter le framework de test
    try {
      const framework = await this.testRunner.detectFramework();
      prompt += `\n\nFramework de test détecté: ${framework}`;
    } catch (error) {
      // Ignorer si la détection échoue
    }

    // Exécuter la boucle d'agent
    const result = await this.runAgentLoop(prompt);

    // Ajouter les artefacts des résultats de test
    if (result.success && result.data?.testResults) {
      result.artifacts = result.artifacts || [];

      const testArtifact: Artifact = {
        type: 'message',
        content: JSON.stringify(result.data.testResults, null, 2),
        title: 'Test Results',
      };
      result.artifacts.push(testArtifact);
    }

    return result;
  }

  /**
   * Initialiser le runner de tests
   */
  setTestRunner(runner: TestRunner): void {
    this.testRunner = runner;
    this.testHandlers = createTestToolHandlers(runner);
    this.log('info', 'TestRunner initialized for TesterAgent');
  }

  /**
   * Obtenir l'historique des tests
   */
  getTestHistory(): typeof this.testHistory {
    return [...this.testHistory];
  }

  /**
   * Vider l'historique des tests
   */
  clearTestHistory(): void {
    this.testHistory = [];
  }

  /**
   * Handler pour l'exécution des outils
   */
  protected async executeToolHandler(
    toolName: string,
    input: Record<string, unknown>
  ): Promise<unknown> {
    if (!this.testHandlers || !(toolName in this.testHandlers)) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    const handler = this.testHandlers[toolName as keyof typeof this.testHandlers];
    const result = await handler(input);

    // Tracker les résultats de test
    if (toolName === 'run_tests' && result.success) {
      this.trackTestRun(result.output as string);
    }

    if (!result.success) {
      throw new Error(result.error || 'Test tool failed');
    }

    return result.output;
  }

  /**
   * Tracker les résultats d'un run de tests
   */
  private trackTestRun(output: string): void {
    // Parser le résumé pour extraire les stats
    const passedMatch = output.match(/(\d+)\s+passed/i);
    const failedMatch = output.match(/(\d+)\s+failed/i);
    const durationMatch = output.match(/Duration:\s*(\d+)ms/i);

    this.testHistory.push({
      timestamp: new Date(),
      passed: passedMatch ? parseInt(passedMatch[1], 10) : 0,
      failed: failedMatch ? parseInt(failedMatch[1], 10) : 0,
      duration: durationMatch ? parseInt(durationMatch[1], 10) : 0,
    });

    // Garder seulement les 20 derniers runs
    if (this.testHistory.length > 20) {
      this.testHistory = this.testHistory.slice(-20);
    }
  }

  /**
   * Obtenir la liste des outils disponibles
   */
  getAvailableTools(): ToolDefinition[] {
    return this.config.tools;
  }
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Créer une instance du Tester Agent
 */
export function createTesterAgent(runner?: TestRunner): TesterAgent {
  const agent = new TesterAgent();

  if (runner) {
    agent.setTestRunner(runner);
  }

  return agent;
}
