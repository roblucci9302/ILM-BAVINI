/**
 * Outils shell et npm pour les agents BAVINI
 * Ces outils permettent d'exécuter des commandes dans WebContainer
 */

import type { ToolDefinition, ToolExecutionResult } from '../types';

/*
 * ============================================================================
 * DÉFINITIONS DES OUTILS
 * ============================================================================
 */

/**
 * Outil pour exécuter une commande npm
 */
export const NpmCommandTool: ToolDefinition = {
  name: 'npm_command',
  description: 'Exécuter une commande npm/pnpm. ' + 'Exemples: install, run dev, run build, run test.',
  inputSchema: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'Commande npm à exécuter (ex: "install", "run dev", "run build")',
      },
      args: {
        type: 'array',
        description: 'Arguments additionnels',
        items: { type: 'string' },
      },
      cwd: {
        type: 'string',
        description: 'Dossier de travail (défaut: racine du projet)',
      },
      timeout: {
        type: 'number',
        description: 'Timeout en millisecondes (défaut: 120000)',
      },
    },
    required: ['command'],
  },
};

/**
 * Outil pour exécuter une commande shell
 */
export const ShellCommandTool: ToolDefinition = {
  name: 'shell_command',
  description: 'Exécuter une commande shell. ' + 'ATTENTION: Commandes dangereuses interdites (rm -rf, etc.).',
  inputSchema: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'Commande shell à exécuter',
      },
      cwd: {
        type: 'string',
        description: 'Dossier de travail (défaut: racine du projet)',
      },
      timeout: {
        type: 'number',
        description: 'Timeout en millisecondes (défaut: 30000)',
      },
    },
    required: ['command'],
  },
};

/**
 * Outil pour démarrer un serveur de développement
 */
export const StartDevServerTool: ToolDefinition = {
  name: 'start_dev_server',
  description: 'Démarrer le serveur de développement (npm run dev). ' + 'Le serveur reste actif en arrière-plan.',
  inputSchema: {
    type: 'object',
    properties: {
      port: {
        type: 'number',
        description: 'Port à utiliser (défaut: 5173 ou 3000)',
      },
      script: {
        type: 'string',
        description: 'Script npm à lancer (défaut: "dev")',
      },
    },
    required: [],
  },
};

/**
 * Outil pour arrêter un serveur
 */
export const StopServerTool: ToolDefinition = {
  name: 'stop_server',
  description: "Arrêter un serveur en cours d'exécution.",
  inputSchema: {
    type: 'object',
    properties: {
      processId: {
        type: 'string',
        description: 'ID du processus à arrêter',
      },
    },
    required: [],
  },
};

/**
 * Outil pour installer des dépendances
 */
export const InstallDependenciesTool: ToolDefinition = {
  name: 'install_dependencies',
  description: 'Installer une ou plusieurs dépendances npm. ' + 'Peut installer en dev avec --save-dev.',
  inputSchema: {
    type: 'object',
    properties: {
      packages: {
        type: 'array',
        description: 'Liste des packages à installer',
        items: { type: 'string' },
      },
      dev: {
        type: 'boolean',
        description: 'Installer en devDependencies (défaut: false)',
      },
    },
    required: ['packages'],
  },
};

/**
 * Outil pour obtenir le statut des processus
 */
export const GetProcessStatusTool: ToolDefinition = {
  name: 'get_process_status',
  description: "Obtenir le statut des processus en cours d'exécution.",
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

/*
 * ============================================================================
 * LISTE DES OUTILS SHELL
 * ============================================================================
 */

export const SHELL_TOOLS: ToolDefinition[] = [
  NpmCommandTool,
  ShellCommandTool,
  StartDevServerTool,
  StopServerTool,
  InstallDependenciesTool,
  GetProcessStatusTool,
];

/*
 * ============================================================================
 * INTERFACE SHELL
 * ============================================================================
 */

/**
 * Résultat d'une commande shell
 */
export interface ShellResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Processus en cours
 */
export interface RunningProcess {
  id: string;
  command: string;
  startedAt: Date;
  port?: number;
}

/**
 * Interface pour le shell (abstraction de WebContainer)
 */
export interface ShellInterface {
  /** Exécuter une commande et attendre le résultat */
  exec(
    command: string,
    args?: string[],
    options?: {
      cwd?: string;
      timeout?: number;
      env?: Record<string, string>;
    },
  ): Promise<ShellResult>;

  /** Démarrer un processus en arrière-plan */
  spawn(
    command: string,
    args?: string[],
    options?: {
      cwd?: string;
      env?: Record<string, string>;
    },
  ): Promise<{
    processId: string;
    port?: number;
  }>;

  /** Arrêter un processus */
  kill(processId: string): Promise<boolean>;

  /** Obtenir les processus en cours */
  getRunningProcesses(): RunningProcess[];
}

/*
 * ============================================================================
 * COMMANDES INTERDITES
 * ============================================================================
 */

const FORBIDDEN_COMMANDS = [
  'rm -rf /',
  'rm -rf /*',
  'rm -rf ~',
  'rm -rf $HOME',
  'chmod 777',
  'chmod -R 777',
  ':(){ :|:& };:', // Fork bomb
  'dd if=/dev/zero',
  'mkfs',
  '> /dev/sda',
  'wget.*|.*sh',
  'curl.*|.*sh',
];

/**
 * Vérifier si une commande est sûre
 */
function isCommandSafe(command: string): { safe: boolean; reason?: string } {
  const lowerCommand = command.toLowerCase();

  for (const forbidden of FORBIDDEN_COMMANDS) {
    if (lowerCommand.includes(forbidden.toLowerCase())) {
      return { safe: false, reason: `Command contains forbidden pattern: ${forbidden}` };
    }
  }

  // Vérifier les patterns dangereux
  if (/rm\s+-rf?\s+\//.test(command)) {
    return { safe: false, reason: 'Attempting to delete root directory' };
  }

  if (/>\s*\/dev\//.test(command)) {
    return { safe: false, reason: 'Attempting to write to device files' };
  }

  return { safe: true };
}

/*
 * ============================================================================
 * HANDLERS D'EXÉCUTION
 * ============================================================================
 */

/**
 * Créer les handlers pour les outils shell
 */
export function createShellToolHandlers(
  shell: ShellInterface,
): Record<string, (input: Record<string, unknown>) => Promise<ToolExecutionResult>> {
  return {
    /**
     * Exécuter une commande npm
     */
    npm_command: async (input: Record<string, unknown>): Promise<ToolExecutionResult> => {
      const command = input.command as string;
      const args = (input.args as string[]) || [];
      const cwd = input.cwd as string | undefined;
      const timeout = (input.timeout as number) || 120000;

      try {
        // Déterminer le gestionnaire de packages
        const packageManager = 'pnpm'; // On utilise pnpm par défaut dans BAVINI

        const result = await shell.exec(packageManager, [command, ...args], {
          cwd,
          timeout,
        });

        if (result.exitCode !== 0) {
          return {
            success: false,
            output: result.stdout,
            error: result.stderr || `Command failed with exit code ${result.exitCode}`,
          };
        }

        return {
          success: true,
          output: result.stdout || 'Command completed successfully',
        };
      } catch (error) {
        return {
          success: false,
          output: null,
          error: `npm command failed: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },

    /**
     * Exécuter une commande shell
     */
    shell_command: async (input: Record<string, unknown>): Promise<ToolExecutionResult> => {
      const command = input.command as string;
      const cwd = input.cwd as string | undefined;
      const timeout = (input.timeout as number) || 30000;

      // Vérifier la sécurité de la commande
      const safetyCheck = isCommandSafe(command);

      if (!safetyCheck.safe) {
        return {
          success: false,
          output: null,
          error: `Command rejected for safety: ${safetyCheck.reason}`,
        };
      }

      try {
        // Parser la commande en programme + arguments
        const parts = command.split(/\s+/);
        const program = parts[0];
        const args = parts.slice(1);

        const result = await shell.exec(program, args, { cwd, timeout });

        if (result.exitCode !== 0) {
          return {
            success: false,
            output: result.stdout,
            error: result.stderr || `Command failed with exit code ${result.exitCode}`,
          };
        }

        return {
          success: true,
          output: result.stdout || 'Command completed successfully',
        };
      } catch (error) {
        return {
          success: false,
          output: null,
          error: `Shell command failed: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },

    /**
     * Démarrer un serveur de développement
     */
    start_dev_server: async (input: Record<string, unknown>): Promise<ToolExecutionResult> => {
      const script = (input.script as string) || 'dev';
      const port = input.port as number | undefined;

      try {
        const env: Record<string, string> = {};

        if (port) {
          env.PORT = String(port);
        }

        const result = await shell.spawn('pnpm', ['run', script], { env });

        return {
          success: true,
          output: JSON.stringify({
            message: `Dev server started`,
            processId: result.processId,
            port: result.port || port || 5173,
          }),
        };
      } catch (error) {
        return {
          success: false,
          output: null,
          error: `Failed to start dev server: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },

    /**
     * Arrêter un serveur
     */
    stop_server: async (input: Record<string, unknown>): Promise<ToolExecutionResult> => {
      const processId = input.processId as string | undefined;

      try {
        if (processId) {
          const killed = await shell.kill(processId);

          if (!killed) {
            return {
              success: false,
              output: null,
              error: `Process ${processId} not found or already stopped`,
            };
          }

          return {
            success: true,
            output: `Process ${processId} stopped`,
          };
        }

        // Arrêter tous les processus
        const processes = shell.getRunningProcesses();

        for (const proc of processes) {
          await shell.kill(proc.id);
        }

        return {
          success: true,
          output: `Stopped ${processes.length} process(es)`,
        };
      } catch (error) {
        return {
          success: false,
          output: null,
          error: `Failed to stop server: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },

    /**
     * Installer des dépendances
     */
    install_dependencies: async (input: Record<string, unknown>): Promise<ToolExecutionResult> => {
      const packages = input.packages as string[];
      const dev = input.dev === true;

      if (!packages || packages.length === 0) {
        return {
          success: false,
          output: null,
          error: 'No packages specified',
        };
      }

      try {
        const args = ['add', ...packages];

        if (dev) {
          args.push('-D');
        }

        const result = await shell.exec('pnpm', args, { timeout: 180000 });

        if (result.exitCode !== 0) {
          return {
            success: false,
            output: result.stdout,
            error: result.stderr || 'Installation failed',
          };
        }

        return {
          success: true,
          output: `Installed ${packages.length} package(s): ${packages.join(', ')}`,
        };
      } catch (error) {
        return {
          success: false,
          output: null,
          error: `Failed to install dependencies: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },

    /**
     * Obtenir le statut des processus
     */
    get_process_status: async (_input: Record<string, unknown>): Promise<ToolExecutionResult> => {
      try {
        const processes = shell.getRunningProcesses();

        if (processes.length === 0) {
          return {
            success: true,
            output: 'No running processes',
          };
        }

        const status = processes.map((p) => ({
          id: p.id,
          command: p.command,
          port: p.port,
          uptime: Math.floor((Date.now() - p.startedAt.getTime()) / 1000) + 's',
        }));

        return {
          success: true,
          output: JSON.stringify(status, null, 2),
        };
      } catch (error) {
        return {
          success: false,
          output: null,
          error: `Failed to get process status: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  };
}

/*
 * ============================================================================
 * MOCK SHELL (POUR LES TESTS)
 * ============================================================================
 */

/**
 * Créer un mock Shell pour les tests
 */
export function createMockShell(
  options: {
    execResults?: Record<string, ShellResult>;
    defaultExitCode?: number;
  } = {},
): ShellInterface {
  const processes = new Map<string, RunningProcess>();
  let processCounter = 0;

  return {
    async exec(command: string, args?: string[], _options?: { cwd?: string; timeout?: number }): Promise<ShellResult> {
      const fullCommand = [command, ...(args || [])].join(' ');

      // Vérifier si on a un résultat prédéfini
      if (options.execResults && fullCommand in options.execResults) {
        return options.execResults[fullCommand];
      }

      // Résultat par défaut
      return {
        exitCode: options.defaultExitCode ?? 0,
        stdout: `Mock output for: ${fullCommand}`,
        stderr: '',
      };
    },

    async spawn(
      command: string,
      args?: string[],
      _options?: { cwd?: string; env?: Record<string, string> },
    ): Promise<{ processId: string; port?: number }> {
      processCounter++;

      const processId = `mock-process-${processCounter}`;
      const port = 5173;

      processes.set(processId, {
        id: processId,
        command: [command, ...(args || [])].join(' '),
        startedAt: new Date(),
        port,
      });

      return { processId, port };
    },

    async kill(processId: string): Promise<boolean> {
      if (processes.has(processId)) {
        processes.delete(processId);
        return true;
      }

      return false;
    },

    getRunningProcesses(): RunningProcess[] {
      return Array.from(processes.values());
    },
  };
}
