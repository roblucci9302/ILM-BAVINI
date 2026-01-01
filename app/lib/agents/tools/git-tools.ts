/**
 * Outils Git pour les agents BAVINI
 * Ces outils permettent de gérer les opérations Git et GitHub
 */

import type { ToolDefinition, ToolExecutionResult } from '../types';

/*
 * ============================================================================
 * DÉFINITIONS DES OUTILS GIT
 * ============================================================================
 */

/**
 * Outil pour initialiser un repo Git
 */
export const GitInitTool: ToolDefinition = {
  name: 'git_init',
  description: 'Initialiser un nouveau dépôt Git dans le projet.',
  inputSchema: {
    type: 'object',
    properties: {
      defaultBranch: {
        type: 'string',
        description: 'Nom de la branche par défaut (défaut: main)',
      },
    },
    required: [],
  },
};

/**
 * Outil pour cloner un repo
 */
export const GitCloneTool: ToolDefinition = {
  name: 'git_clone',
  description: 'Cloner un dépôt Git distant.',
  inputSchema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'URL du dépôt à cloner (HTTPS ou SSH)',
      },
      directory: {
        type: 'string',
        description: 'Dossier de destination (optionnel)',
      },
      branch: {
        type: 'string',
        description: 'Branche à cloner (défaut: default branch)',
      },
      depth: {
        type: 'number',
        description: 'Profondeur du clone (pour shallow clone)',
      },
    },
    required: ['url'],
  },
};

/**
 * Outil pour voir le status Git
 */
export const GitStatusTool: ToolDefinition = {
  name: 'git_status',
  description: 'Afficher le status Git du projet (fichiers modifiés, staged, etc.).',
  inputSchema: {
    type: 'object',
    properties: {
      short: {
        type: 'boolean',
        description: 'Format court (défaut: false)',
      },
    },
    required: [],
  },
};

/**
 * Outil pour ajouter des fichiers au staging
 */
export const GitAddTool: ToolDefinition = {
  name: 'git_add',
  description: 'Ajouter des fichiers au staging area.',
  inputSchema: {
    type: 'object',
    properties: {
      files: {
        type: 'array',
        items: { type: 'string' },
        description: 'Liste des fichiers à ajouter (ou ["."] pour tout)',
      },
    },
    required: ['files'],
  },
};

/**
 * Outil pour créer un commit
 */
export const GitCommitTool: ToolDefinition = {
  name: 'git_commit',
  description: 'Créer un commit avec les changements stagés.',
  inputSchema: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'Message du commit',
      },
      author: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string' },
        },
        description: 'Auteur du commit (optionnel)',
      },
    },
    required: ['message'],
  },
};

/**
 * Outil pour pousser les commits
 */
export const GitPushTool: ToolDefinition = {
  name: 'git_push',
  description: 'Pousser les commits vers le dépôt distant.',
  inputSchema: {
    type: 'object',
    properties: {
      remote: {
        type: 'string',
        description: 'Nom du remote (défaut: origin)',
      },
      branch: {
        type: 'string',
        description: 'Branche à pousser (défaut: branche courante)',
      },
      setUpstream: {
        type: 'boolean',
        description: 'Définir comme upstream (défaut: false)',
      },
      force: {
        type: 'boolean',
        description: 'Force push (ATTENTION - défaut: false)',
      },
    },
    required: [],
  },
};

/**
 * Outil pour tirer les commits
 */
export const GitPullTool: ToolDefinition = {
  name: 'git_pull',
  description: 'Tirer les commits depuis le dépôt distant.',
  inputSchema: {
    type: 'object',
    properties: {
      remote: {
        type: 'string',
        description: 'Nom du remote (défaut: origin)',
      },
      branch: {
        type: 'string',
        description: 'Branche à tirer (défaut: branche courante)',
      },
      rebase: {
        type: 'boolean',
        description: 'Utiliser rebase au lieu de merge (défaut: false)',
      },
    },
    required: [],
  },
};

/**
 * Outil pour gérer les branches
 */
export const GitBranchTool: ToolDefinition = {
  name: 'git_branch',
  description: 'Créer, lister ou supprimer des branches.',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['list', 'create', 'delete', 'checkout'],
        description: 'Action à effectuer',
      },
      name: {
        type: 'string',
        description: 'Nom de la branche (requis pour create, delete, checkout)',
      },
      force: {
        type: 'boolean',
        description: 'Forcer la suppression (défaut: false)',
      },
    },
    required: ['action'],
  },
};

/**
 * Outil pour voir le log Git
 */
export const GitLogTool: ToolDefinition = {
  name: 'git_log',
  description: "Afficher l'historique des commits.",
  inputSchema: {
    type: 'object',
    properties: {
      count: {
        type: 'number',
        description: 'Nombre de commits à afficher (défaut: 10)',
      },
      oneline: {
        type: 'boolean',
        description: 'Format une ligne par commit (défaut: true)',
      },
      branch: {
        type: 'string',
        description: 'Branche à afficher (défaut: courante)',
      },
    },
    required: [],
  },
};

/**
 * Outil pour voir les différences
 */
export const GitDiffTool: ToolDefinition = {
  name: 'git_diff',
  description: 'Afficher les différences entre versions.',
  inputSchema: {
    type: 'object',
    properties: {
      staged: {
        type: 'boolean',
        description: 'Voir les changements stagés (défaut: false)',
      },
      file: {
        type: 'string',
        description: 'Fichier spécifique à comparer',
      },
      commit: {
        type: 'string',
        description: 'Commit de référence',
      },
    },
    required: [],
  },
};

/*
 * ============================================================================
 * LISTE DES OUTILS GIT
 * ============================================================================
 */

export const GIT_TOOLS: ToolDefinition[] = [
  GitInitTool,
  GitCloneTool,
  GitStatusTool,
  GitAddTool,
  GitCommitTool,
  GitPushTool,
  GitPullTool,
  GitBranchTool,
  GitLogTool,
  GitDiffTool,
];

/*
 * ============================================================================
 * INTERFACE GIT
 * ============================================================================
 */

/**
 * Information sur une branche
 */
export interface GitBranch {
  name: string;
  current: boolean;
  remote?: string;
  tracking?: string;
}

/**
 * Information sur un commit
 */
export interface GitCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: {
    name: string;
    email: string;
  };
  date: Date;
}

/**
 * Status d'un fichier
 */
export interface GitFileStatus {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'ignored';
  staged: boolean;
}

/**
 * Interface pour les opérations Git
 */
export interface GitInterface {
  /** Initialiser un repo */
  init(options?: { defaultBranch?: string }): Promise<void>;

  /** Cloner un repo */
  clone(
    url: string,
    options?: {
      directory?: string;
      branch?: string;
      depth?: number;
    },
  ): Promise<void>;

  /** Obtenir le status */
  status(): Promise<{
    branch: string;
    ahead: number;
    behind: number;
    files: GitFileStatus[];
  }>;

  /** Ajouter des fichiers */
  add(files: string[]): Promise<void>;

  /** Créer un commit */
  commit(
    message: string,
    options?: {
      author?: { name: string; email: string };
    },
  ): Promise<GitCommit>;

  /** Pousser les commits */
  push(options?: { remote?: string; branch?: string; setUpstream?: boolean; force?: boolean }): Promise<void>;

  /** Tirer les commits */
  pull(options?: { remote?: string; branch?: string; rebase?: boolean }): Promise<void>;

  /** Opérations sur les branches */
  branch(
    action: 'list' | 'create' | 'delete' | 'checkout',
    name?: string,
    force?: boolean,
  ): Promise<GitBranch[] | void>;

  /** Obtenir le log */
  log(options?: { count?: number; branch?: string }): Promise<GitCommit[]>;

  /** Obtenir les différences */
  diff(options?: { staged?: boolean; file?: string; commit?: string }): Promise<string>;

  /** Obtenir la branche courante */
  getCurrentBranch(): Promise<string>;

  /** Vérifier si c'est un repo Git */
  isRepository(): Promise<boolean>;
}

/*
 * ============================================================================
 * HANDLERS D'EXÉCUTION
 * ============================================================================
 */

/**
 * Créer les handlers pour les outils Git
 */
export function createGitToolHandlers(
  git: GitInterface,
): Record<string, (input: Record<string, unknown>) => Promise<ToolExecutionResult>> {
  return {
    /**
     * Initialiser un repo
     */
    git_init: async (input: Record<string, unknown>): Promise<ToolExecutionResult> => {
      const defaultBranch = (input.defaultBranch as string) || 'main';

      try {
        await git.init({ defaultBranch });

        return {
          success: true,
          output: `Initialized empty Git repository with default branch '${defaultBranch}'`,
        };
      } catch (error) {
        return {
          success: false,
          output: null,
          error: `Failed to init repository: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },

    /**
     * Cloner un repo
     */
    git_clone: async (input: Record<string, unknown>): Promise<ToolExecutionResult> => {
      const url = input.url as string;
      const directory = input.directory as string | undefined;
      const branch = input.branch as string | undefined;
      const depth = input.depth as number | undefined;

      try {
        await git.clone(url, { directory, branch, depth });

        return {
          success: true,
          output: `Cloned ${url}${directory ? ` into ${directory}` : ''}`,
        };
      } catch (error) {
        return {
          success: false,
          output: null,
          error: `Failed to clone: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },

    /**
     * Status Git
     */
    git_status: async (input: Record<string, unknown>): Promise<ToolExecutionResult> => {
      const short = input.short === true;

      try {
        const status = await git.status();

        if (short) {
          const lines = status.files.map((f) => {
            const prefix = f.staged ? 'A' : f.status === 'untracked' ? '?' : 'M';
            return `${prefix} ${f.path}`;
          });
          return {
            success: true,
            output: lines.join('\n') || 'Nothing to commit, working tree clean',
          };
        }

        const output = [
          `On branch ${status.branch}`,
          status.ahead > 0 ? `Your branch is ahead by ${status.ahead} commit(s)` : '',
          status.behind > 0 ? `Your branch is behind by ${status.behind} commit(s)` : '',
          '',
          status.files.length > 0 ? 'Changes:' : 'Nothing to commit, working tree clean',
          ...status.files.map((f) => `  ${f.staged ? '(staged)' : ''}${f.status}: ${f.path}`),
        ]
          .filter(Boolean)
          .join('\n');

        return {
          success: true,
          output,
        };
      } catch (error) {
        return {
          success: false,
          output: null,
          error: `Failed to get status: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },

    /**
     * Ajouter des fichiers
     */
    git_add: async (input: Record<string, unknown>): Promise<ToolExecutionResult> => {
      const files = input.files as string[];

      try {
        await git.add(files);

        return {
          success: true,
          output: `Added ${files.length === 1 && files[0] === '.' ? 'all files' : files.join(', ')} to staging`,
        };
      } catch (error) {
        return {
          success: false,
          output: null,
          error: `Failed to add files: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },

    /**
     * Créer un commit
     */
    git_commit: async (input: Record<string, unknown>): Promise<ToolExecutionResult> => {
      const message = input.message as string;
      const author = input.author as { name: string; email: string } | undefined;

      try {
        const commit = await git.commit(message, { author });

        return {
          success: true,
          output: `[${commit.shortHash}] ${commit.message}`,
        };
      } catch (error) {
        return {
          success: false,
          output: null,
          error: `Failed to commit: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },

    /**
     * Pousser les commits
     */
    git_push: async (input: Record<string, unknown>): Promise<ToolExecutionResult> => {
      const remote = (input.remote as string) || 'origin';
      const branch = input.branch as string | undefined;
      const setUpstream = input.setUpstream === true;
      const force = input.force === true;

      if (force) {
        // Warn about force push
        return {
          success: false,
          output: null,
          error: 'Force push is dangerous. Please confirm this action explicitly.',
        };
      }

      try {
        await git.push({ remote, branch, setUpstream, force });

        return {
          success: true,
          output: `Pushed to ${remote}${branch ? `/${branch}` : ''}`,
        };
      } catch (error) {
        return {
          success: false,
          output: null,
          error: `Failed to push: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },

    /**
     * Tirer les commits
     */
    git_pull: async (input: Record<string, unknown>): Promise<ToolExecutionResult> => {
      const remote = (input.remote as string) || 'origin';
      const branch = input.branch as string | undefined;
      const rebase = input.rebase === true;

      try {
        await git.pull({ remote, branch, rebase });

        return {
          success: true,
          output: `Pulled from ${remote}${branch ? `/${branch}` : ''}${rebase ? ' (with rebase)' : ''}`,
        };
      } catch (error) {
        return {
          success: false,
          output: null,
          error: `Failed to pull: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },

    /**
     * Gérer les branches
     */
    git_branch: async (input: Record<string, unknown>): Promise<ToolExecutionResult> => {
      const action = input.action as 'list' | 'create' | 'delete' | 'checkout';
      const name = input.name as string | undefined;
      const force = input.force === true;

      try {
        if (action === 'list') {
          const branches = (await git.branch('list')) as GitBranch[];
          const output = branches
            .map((b) => `${b.current ? '* ' : '  '}${b.name}${b.tracking ? ` -> ${b.tracking}` : ''}`)
            .join('\n');

          return {
            success: true,
            output: output || 'No branches',
          };
        }

        if (!name) {
          return {
            success: false,
            output: null,
            error: `Branch name is required for '${action}'`,
          };
        }

        await git.branch(action, name, force);

        const messages = {
          create: `Created branch '${name}'`,
          delete: `Deleted branch '${name}'`,
          checkout: `Switched to branch '${name}'`,
        };

        return {
          success: true,
          output: messages[action],
        };
      } catch (error) {
        return {
          success: false,
          output: null,
          error: `Failed to ${action} branch: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },

    /**
     * Log Git
     */
    git_log: async (input: Record<string, unknown>): Promise<ToolExecutionResult> => {
      const count = (input.count as number) || 10;
      const oneline = input.oneline !== false;
      const branch = input.branch as string | undefined;

      try {
        const commits = await git.log({ count, branch });

        if (oneline) {
          const output = commits.map((c) => `${c.shortHash} ${c.message}`).join('\n');
          return {
            success: true,
            output: output || 'No commits',
          };
        }

        const output = commits
          .map((c) =>
            [
              `commit ${c.hash}`,
              `Author: ${c.author.name} <${c.author.email}>`,
              `Date:   ${c.date.toISOString()}`,
              '',
              `    ${c.message}`,
              '',
            ].join('\n'),
          )
          .join('\n');

        return {
          success: true,
          output: output || 'No commits',
        };
      } catch (error) {
        return {
          success: false,
          output: null,
          error: `Failed to get log: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },

    /**
     * Différences Git
     */
    git_diff: async (input: Record<string, unknown>): Promise<ToolExecutionResult> => {
      const staged = input.staged === true;
      const file = input.file as string | undefined;
      const commit = input.commit as string | undefined;

      try {
        const diff = await git.diff({ staged, file, commit });

        return {
          success: true,
          output: diff || 'No differences',
        };
      } catch (error) {
        return {
          success: false,
          output: null,
          error: `Failed to get diff: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  };
}

/*
 * ============================================================================
 * MOCK GIT (POUR LES TESTS)
 * ============================================================================
 */

/**
 * Créer un mock GitInterface pour les tests
 */
export function createMockGit(
  options: {
    isRepo?: boolean;
    currentBranch?: string;
    branches?: GitBranch[];
    commits?: GitCommit[];
    files?: GitFileStatus[];
  } = {},
): GitInterface {
  const defaultBranch = options.currentBranch || 'main';
  let currentBranch = defaultBranch;
  const branches: GitBranch[] = options.branches || [{ name: 'main', current: true }];
  const commits: GitCommit[] = options.commits || [];
  const stagedFiles = new Set<string>();

  return {
    async init(_initOptions) {
      // Mock init
    },

    async clone(_url, _cloneOptions) {
      // Mock clone
    },

    async status() {
      return {
        branch: currentBranch,
        ahead: 0,
        behind: 0,
        files: options.files || [],
      };
    },

    async add(files) {
      files.forEach((f) => stagedFiles.add(f));
    },

    async commit(message, commitOptions) {
      const commit: GitCommit = {
        hash: Math.random().toString(36).substring(2, 10),
        shortHash: Math.random().toString(36).substring(2, 9),
        message,
        author: commitOptions?.author || { name: 'Test', email: 'test@test.com' },
        date: new Date(),
      };
      commits.unshift(commit);
      stagedFiles.clear();

      return commit;
    },

    async push(_pushOptions) {
      // Mock push
    },

    async pull(_pullOptions) {
      // Mock pull
    },

    async branch(action, name, _force) {
      switch (action) {
        case 'list':
          return branches;
        case 'create':
          if (name) {
            branches.push({ name, current: false });
          }

          break;
        case 'delete':
          const idx = branches.findIndex((b) => b.name === name);

          if (idx !== -1) {
            branches.splice(idx, 1);
          }

          break;
        case 'checkout':
          branches.forEach((b) => (b.current = b.name === name));
          currentBranch = name || defaultBranch;
          break;
      }
    },

    async log(logOptions) {
      const count = logOptions?.count || 10;
      return commits.slice(0, count);
    },

    async diff(_diffOptions) {
      return '';
    },

    async getCurrentBranch() {
      return currentBranch;
    },

    async isRepository() {
      return options.isRepo !== false;
    },
  };
}
