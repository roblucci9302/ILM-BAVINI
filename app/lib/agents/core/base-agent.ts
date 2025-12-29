/**
 * Classe abstraite de base pour tous les agents BAVINI
 * Fournit les fonctionnalités communes : appel LLM, exécution d'outils, logging
 */

import Anthropic from '@anthropic-ai/sdk';
import { createScopedLogger } from '~/utils/logger';
import { ToolRegistry, type ToolHandler } from './tool-registry';
import type {
  AgentConfig,
  AgentStatus,
  AgentMessage,
  Task,
  TaskResult,
  TaskMetrics,
  ToolCall,
  ToolResult,
  ToolDefinition,
  ToolExecutionResult,
  AgentError,
  LogEntry,
  LogLevel,
  AgentEvent,
  AgentEventCallback,
  DEFAULT_MODEL,
} from '../types';

/**
 * Classe abstraite de base pour tous les agents
 */
export abstract class BaseAgent {
  protected config: AgentConfig;
  protected status: AgentStatus = 'idle';
  protected currentTask: Task | null = null;
  protected messageHistory: AgentMessage[] = [];
  protected abortController: AbortController | null = null;
  protected logger: ReturnType<typeof createScopedLogger>;
  protected eventCallbacks: Set<AgentEventCallback> = new Set();
  protected metrics: TaskMetrics = this.createEmptyMetrics();

  // Client Anthropic (sera initialisé avec la clé API)
  protected anthropicClient: Anthropic | null = null;

  // Registre d'outils pour l'exécution des tools
  protected toolRegistry: ToolRegistry = new ToolRegistry();

  constructor(config: AgentConfig) {
    this.config = {
      maxTokens: 8192,
      temperature: 0.2,
      timeout: 300000,
      maxRetries: 3,
      ...config,
    };
    this.logger = createScopedLogger(`Agent:${config.name}`);
  }

  // ============================================================================
  // MÉTHODES ABSTRAITES (à implémenter par chaque agent)
  // ============================================================================

  /**
   * Exécute la logique spécifique de l'agent
   * @param task Tâche à exécuter
   */
  abstract execute(task: Task): Promise<TaskResult>;

  /**
   * Retourne le system prompt spécifique de l'agent
   */
  abstract getSystemPrompt(): string;

  // ============================================================================
  // MÉTHODES PUBLIQUES
  // ============================================================================

  /**
   * Lance l'exécution d'une tâche avec gestion complète
   */
  async run(task: Task, apiKey: string): Promise<TaskResult> {
    this.log('info', `Starting task: ${task.id}`, { taskType: task.type });

    // Initialiser
    this.currentTask = task;
    this.status = 'thinking';
    this.messageHistory = [];
    this.metrics = this.createEmptyMetrics();
    this.abortController = new AbortController();

    // Initialiser le client Anthropic
    this.anthropicClient = new Anthropic({ apiKey });

    const startTime = Date.now();

    try {
      // Émettre l'événement de démarrage
      this.emitEvent('agent:started', { taskId: task.id });

      // Exécuter la logique spécifique de l'agent
      const result = await this.executeWithTimeout(task);

      // Calculer les métriques finales
      this.metrics.executionTime = Date.now() - startTime;

      // Ajouter les métriques au résultat
      result.metrics = { ...this.metrics };

      this.status = result.success ? 'completed' : 'failed';
      this.emitEvent(result.success ? 'agent:completed' : 'agent:failed', {
        taskId: task.id,
        result,
      });

      this.log('info', `Task completed: ${task.id}`, {
        success: result.success,
        executionTime: this.metrics.executionTime,
      });

      return result;
    } catch (error) {
      this.status = 'failed';
      const agentError = this.createError(error);

      this.log('error', `Task failed: ${task.id}`, { error: agentError });
      this.emitEvent('agent:failed', { taskId: task.id, error: agentError });

      return {
        success: false,
        output: `Erreur lors de l'exécution: ${agentError.message}`,
        errors: [agentError],
        metrics: {
          ...this.metrics,
          executionTime: Date.now() - startTime,
        },
      };
    } finally {
      this.currentTask = null;
      this.abortController = null;
    }
  }

  /**
   * Annule l'exécution en cours
   */
  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.status = 'aborted';
      this.log('warn', 'Task aborted', { taskId: this.currentTask?.id });
    }
  }

  /**
   * Retourne le statut actuel de l'agent
   */
  getStatus(): AgentStatus {
    return this.status;
  }

  /**
   * Retourne la configuration de l'agent
   */
  getConfig(): AgentConfig {
    return this.config;
  }

  /**
   * Retourne le nom de l'agent
   */
  getName(): string {
    return this.config.name;
  }

  /**
   * Retourne la description de l'agent
   */
  getDescription(): string {
    return this.config.description;
  }

  /**
   * Vérifie si l'agent est disponible
   */
  isAvailable(): boolean {
    return this.status === 'idle';
  }

  /**
   * S'abonner aux événements de l'agent
   */
  subscribe(callback: AgentEventCallback): () => void {
    this.eventCallbacks.add(callback);
    return () => this.eventCallbacks.delete(callback);
  }

  // ============================================================================
  // GESTION DES OUTILS (Tool Registry)
  // ============================================================================

  /**
   * Enregistrer un outil avec son handler
   */
  registerTool(definition: ToolDefinition, handler: ToolHandler): void {
    this.toolRegistry.register(definition, handler);

    // Ajouter à la config si pas déjà présent (pour le LLM)
    if (!this.config.tools.find((t) => t.name === definition.name)) {
      this.config.tools.push(definition);
    }

    this.log('debug', `Tool registered: ${definition.name}`);
  }

  /**
   * Enregistrer plusieurs outils d'un coup
   */
  registerTools(
    definitions: ToolDefinition[],
    handlers: Record<string, ToolHandler>,
    category?: string
  ): void {
    this.toolRegistry.registerBatch(definitions, handlers, category);

    // Ajouter à la config
    for (const def of definitions) {
      if (handlers[def.name] && !this.config.tools.find((t) => t.name === def.name)) {
        this.config.tools.push(def);
      }
    }

    this.log('debug', `Registered ${definitions.length} tools`, { category });
  }

  /**
   * Désinscrire un outil
   */
  unregisterTool(name: string): boolean {
    const removed = this.toolRegistry.unregister(name);

    if (removed) {
      // Retirer de la config
      const index = this.config.tools.findIndex((t) => t.name === name);
      if (index !== -1) {
        this.config.tools.splice(index, 1);
      }
    }

    return removed;
  }

  /**
   * Obtenir le registre d'outils (pour les sous-classes)
   */
  protected getToolRegistry(): ToolRegistry {
    return this.toolRegistry;
  }

  /**
   * Obtenir les définitions des outils enregistrés
   */
  getRegisteredTools(): ToolDefinition[] {
    return this.toolRegistry.getDefinitions();
  }

  // ============================================================================
  // MÉTHODES PROTÉGÉES (utilisables par les sous-classes)
  // ============================================================================

  /**
   * Appelle Claude avec les messages fournis
   */
  protected async callLLM(
    messages: AgentMessage[],
    options?: {
      tools?: ToolDefinition[];
      maxTokens?: number;
      temperature?: number;
    }
  ): Promise<Anthropic.Message> {
    if (!this.anthropicClient) {
      throw new Error('Anthropic client not initialized');
    }

    this.status = 'thinking';
    this.metrics.llmCalls++;

    const startTime = Date.now();

    try {
      // Convertir nos messages au format Anthropic
      const anthropicMessages = this.convertToAnthropicMessages(messages);

      // Convertir nos outils au format Anthropic
      const tools = options?.tools || this.config.tools;
      const anthropicTools = this.convertToAnthropicTools(tools);

      // Appeler l'API
      const response = await this.anthropicClient.messages.create({
        model: this.config.model,
        max_tokens: options?.maxTokens || this.config.maxTokens || 8192,
        temperature: options?.temperature || this.config.temperature || 0.2,
        system: this.getSystemPrompt(),
        messages: anthropicMessages,
        tools: anthropicTools.length > 0 ? anthropicTools : undefined,
      });

      // Comptabiliser les tokens
      this.metrics.inputTokens += response.usage.input_tokens;
      this.metrics.outputTokens += response.usage.output_tokens;

      this.log('debug', 'LLM call completed', {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        stopReason: response.stop_reason,
        duration: Date.now() - startTime,
      });

      return response;
    } catch (error) {
      this.log('error', 'LLM call failed', { error });
      throw error;
    }
  }

  /**
   * Exécute un outil et retourne le résultat
   */
  protected async executeTool(
    toolName: string,
    input: Record<string, unknown>
  ): Promise<ToolExecutionResult> {
    this.status = 'waiting_for_tool';
    this.metrics.toolCalls++;

    const startTime = Date.now();

    this.log('debug', `Executing tool: ${toolName}`, { input });
    this.emitEvent('agent:tool_call', { toolName, input });

    try {
      // Trouver l'outil dans la configuration
      const tool = this.config.tools.find((t) => t.name === toolName);

      if (!tool) {
        throw new Error(`Tool not found: ${toolName}`);
      }

      // L'exécution réelle sera gérée par les handlers spécifiques
      // Pour l'instant, on retourne un placeholder
      // Les sous-classes doivent override cette méthode ou fournir des handlers
      const result = await this.executeToolHandler(toolName, input);

      const executionTime = Date.now() - startTime;
      this.metrics.toolExecutionTime += executionTime;

      this.emitEvent('agent:tool_result', { toolName, result, executionTime });

      return {
        success: true,
        output: result,
        executionTime,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.metrics.toolExecutionTime += executionTime;

      const errorMessage = error instanceof Error ? error.message : String(error);

      this.emitEvent('agent:tool_result', {
        toolName,
        error: errorMessage,
        executionTime,
      });

      return {
        success: false,
        output: null,
        error: errorMessage,
        executionTime,
      };
    }
  }

  /**
   * Handler d'exécution des outils
   * Utilise le ToolRegistry pour trouver et exécuter le handler approprié
   */
  protected async executeToolHandler(
    toolName: string,
    input: Record<string, unknown>
  ): Promise<unknown> {
    // 1. Chercher dans le registre d'outils
    if (this.toolRegistry.has(toolName)) {
      const result = await this.toolRegistry.execute(toolName, input);

      if (!result.success) {
        throw new Error(result.error || `Tool '${toolName}' execution failed`);
      }

      return result.output;
    }

    // 2. Permettre aux sous-classes de gérer des outils personnalisés
    return this.handleCustomTool(toolName, input);
  }

  /**
   * Handler pour les outils personnalisés non enregistrés dans le registry
   * Les sous-classes peuvent override cette méthode pour gérer des cas spéciaux
   */
  protected async handleCustomTool(
    toolName: string,
    _input: Record<string, unknown>
  ): Promise<unknown> {
    // Par défaut, retourne une erreur si l'outil n'est pas trouvé
    const availableTools = this.toolRegistry.getToolNames();
    const toolList = availableTools.length > 0
      ? `Available tools: ${availableTools.join(', ')}`
      : 'No tools registered';

    throw new Error(
      `Tool '${toolName}' not found in registry and no custom handler provided. ${toolList}`
    );
  }

  /**
   * Boucle d'agent : appel LLM -> exécution outils -> répéter jusqu'à completion
   */
  protected async runAgentLoop(initialPrompt: string): Promise<TaskResult> {
    // Initialiser avec le prompt utilisateur
    this.messageHistory.push({
      role: 'user',
      content: initialPrompt,
    });

    let iterations = 0;
    const maxIterations = 20; // Sécurité contre les boucles infinies

    while (iterations < maxIterations) {
      iterations++;

      // Vérifier l'annulation
      if (this.abortController?.signal.aborted) {
        throw new Error('Task was aborted');
      }

      // Appeler le LLM
      const response = await this.callLLM(this.messageHistory);

      // Traiter la réponse
      const { text, toolCalls } = this.parseResponse(response);

      // Ajouter la réponse à l'historique
      this.messageHistory.push({
        role: 'assistant',
        content: text,
        toolCalls,
      });

      // Si pas d'appels d'outils, on a terminé
      if (!toolCalls || toolCalls.length === 0) {
        return this.createSuccessResult(text);
      }

      // Exécuter les outils
      const toolResults: ToolResult[] = [];

      for (const toolCall of toolCalls) {
        const result = await this.executeTool(toolCall.name, toolCall.input);

        toolResults.push({
          toolCallId: toolCall.id,
          output: result.output,
          error: result.error,
          isError: !result.success,
        });
      }

      // Ajouter les résultats à l'historique
      this.messageHistory.push({
        role: 'user',
        content: '', // Le contenu est dans toolResults
        toolResults,
      });
    }

    // Si on atteint la limite d'itérations
    return {
      success: false,
      output: 'Maximum iterations reached',
      errors: [
        {
          code: 'MAX_ITERATIONS',
          message: `Agent reached maximum iterations (${maxIterations})`,
          recoverable: false,
        },
      ],
    };
  }

  /**
   * Logging centralisé
   */
  protected log(
    level: LogLevel,
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      agentName: this.config.name,
      taskId: this.currentTask?.id,
      data,
    };

    switch (level) {
      case 'debug':
        this.logger.debug(message, data);
        break;
      case 'info':
        this.logger.info(message, data);
        break;
      case 'warn':
        this.logger.warn(message, data);
        break;
      case 'error':
        this.logger.error(message, data);
        break;
    }
  }

  // ============================================================================
  // MÉTHODES PRIVÉES
  // ============================================================================

  /**
   * Exécute avec timeout
   */
  private async executeWithTimeout(task: Task): Promise<TaskResult> {
    const timeout = task.timeout || this.config.timeout || 300000;

    return Promise.race([
      this.execute(task),
      new Promise<TaskResult>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Task timeout after ${timeout}ms`));
        }, timeout);
      }),
    ]);
  }

  /**
   * Convertit nos messages au format Anthropic
   */
  private convertToAnthropicMessages(
    messages: AgentMessage[]
  ): Anthropic.MessageParam[] {
    return messages.map((msg) => {
      if (msg.role === 'system') {
        // Les messages system sont gérés séparément
        return { role: 'user' as const, content: msg.content };
      }

      if (msg.toolResults && msg.toolResults.length > 0) {
        // Message avec résultats d'outils
        return {
          role: 'user' as const,
          content: msg.toolResults.map((tr) => ({
            type: 'tool_result' as const,
            tool_use_id: tr.toolCallId,
            content: typeof tr.output === 'string' ? tr.output : JSON.stringify(tr.output),
            is_error: tr.isError,
          })),
        };
      }

      if (msg.toolCalls && msg.toolCalls.length > 0) {
        // Message assistant avec appels d'outils
        const content: Anthropic.ContentBlockParam[] = [];

        if (msg.content) {
          content.push({ type: 'text' as const, text: msg.content });
        }

        for (const tc of msg.toolCalls) {
          content.push({
            type: 'tool_use' as const,
            id: tc.id,
            name: tc.name,
            input: tc.input,
          });
        }

        return { role: 'assistant' as const, content };
      }

      // Message simple
      return {
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      };
    });
  }

  /**
   * Convertit nos outils au format Anthropic
   */
  private convertToAnthropicTools(tools: ToolDefinition[]): Anthropic.Tool[] {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema as Anthropic.Tool['input_schema'],
    }));
  }

  /**
   * Parse la réponse du LLM
   */
  private parseResponse(response: Anthropic.Message): {
    text: string;
    toolCalls: ToolCall[] | undefined;
  } {
    let text = '';
    const toolCalls: ToolCall[] = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        text += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        });
      }
    }

    return {
      text,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }

  /**
   * Crée un résultat de succès
   */
  private createSuccessResult(output: string): TaskResult {
    return {
      success: true,
      output,
      artifacts: [],
      errors: [],
    };
  }

  /**
   * Crée une erreur structurée
   */
  private createError(error: unknown): AgentError {
    if (error instanceof Error) {
      return {
        code: 'AGENT_ERROR',
        message: error.message,
        recoverable: false,
        stack: error.stack,
      };
    }

    return {
      code: 'UNKNOWN_ERROR',
      message: String(error),
      recoverable: false,
    };
  }

  /**
   * Crée des métriques vides
   */
  private createEmptyMetrics(): TaskMetrics {
    return {
      inputTokens: 0,
      outputTokens: 0,
      executionTime: 0,
      toolCalls: 0,
      llmCalls: 0,
      toolExecutionTime: 0,
    };
  }

  /**
   * Émet un événement
   */
  protected emitEvent(
    type: AgentEvent['type'],
    data: Record<string, unknown>
  ): void {
    const event: AgentEvent = {
      type,
      timestamp: new Date(),
      agentName: this.config.name,
      taskId: this.currentTask?.id,
      data,
    };

    for (const callback of this.eventCallbacks) {
      try {
        callback(event);
      } catch (error) {
        this.logger.error('Event callback error', { error });
      }
    }
  }
}
