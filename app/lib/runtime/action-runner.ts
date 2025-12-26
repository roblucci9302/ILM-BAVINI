import { WebContainer } from '@webcontainer/api';
import { map, type MapStore } from 'nanostores';
import * as nodePath from 'node:path';
import { syncToWebContainer } from '~/lib/git/file-sync';
import * as gitOps from '~/lib/git/operations';
import { initPyodide, installPackages, runPython } from '~/lib/pyodide';
import { getGitToken } from '~/lib/stores/git-settings';
import type { BoltAction, GitAction, GitHubAction, PythonAction } from '~/types/actions';
import * as githubApi from '~/lib/github/api';
import { createScopedLogger } from '~/utils/logger';
import { unreachable } from '~/utils/unreachable';
import type { ActionCallbackData } from './message-parser';

const logger = createScopedLogger('ActionRunner');

export type ActionStatus = 'pending' | 'running' | 'complete' | 'aborted' | 'failed';

export type BaseActionState = BoltAction & {
  status: Exclude<ActionStatus, 'failed'>;
  abort: () => void;
  executed: boolean;
  abortSignal: AbortSignal;
};

export type FailedActionState = BoltAction &
  Omit<BaseActionState, 'status'> & {
    status: Extract<ActionStatus, 'failed'>;
    error: string;
  };

export type ActionState = BaseActionState | FailedActionState;

type BaseActionUpdate = Partial<Pick<BaseActionState, 'status' | 'abort' | 'executed'>>;

export type ActionStateUpdate =
  | BaseActionUpdate
  | (Omit<BaseActionUpdate, 'status'> & { status: 'failed'; error: string });

type ActionsMap = MapStore<Record<string, ActionState>>;

export class ActionRunner {
  #webcontainer: Promise<WebContainer>;
  #currentExecutionPromise: Promise<void> = Promise.resolve();

  actions: ActionsMap = map({});

  constructor(webcontainerPromise: Promise<WebContainer>) {
    this.#webcontainer = webcontainerPromise;
  }

  addAction(data: ActionCallbackData) {
    const { actionId } = data;

    const actions = this.actions.get();
    const action = actions[actionId];

    if (action) {
      // action already added
      return;
    }

    const abortController = new AbortController();

    this.actions.setKey(actionId, {
      ...data.action,
      status: 'pending',
      executed: false,
      abort: () => {
        abortController.abort();
        this.#updateAction(actionId, { status: 'aborted' });
      },
      abortSignal: abortController.signal,
    });

    this.#currentExecutionPromise.then(() => {
      this.#updateAction(actionId, { status: 'running' });
    });
  }

  async runAction(data: ActionCallbackData) {
    const { actionId } = data;
    const action = this.actions.get()[actionId];

    if (!action) {
      unreachable(`Action ${actionId} not found`);
    }

    if (action.executed) {
      return;
    }

    this.#updateAction(actionId, { ...action, ...data.action, executed: true });

    this.#currentExecutionPromise = this.#currentExecutionPromise
      .then(() => {
        return this.#executeAction(actionId);
      })
      .catch((error) => {
        console.error('Action failed:', error);
      });
  }

  async #executeAction(actionId: string) {
    const action = this.actions.get()[actionId];

    this.#updateAction(actionId, { status: 'running' });

    try {
      switch (action.type) {
        case 'shell': {
          await this.#runShellAction(action);
          break;
        }
        case 'file': {
          await this.#runFileAction(action);
          break;
        }
        case 'git': {
          await this.#runGitAction(action);
          break;
        }
        case 'python': {
          await this.#runPythonAction(action);
          break;
        }
        case 'github': {
          await this.#runGitHubAction(action);
          break;
        }
      }

      this.#updateAction(actionId, { status: action.abortSignal.aborted ? 'aborted' : 'complete' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Une erreur inattendue est survenue';
      this.#updateAction(actionId, { status: 'failed', error: errorMessage });

      logger.error(`Action ${action.type} failed:`, error);

      // re-throw the error to be caught in the promise chain
      throw error;
    }
  }

  async #runShellAction(action: ActionState) {
    if (action.type !== 'shell') {
      unreachable('Expected shell action');
    }

    const webcontainer = await this.#webcontainer;

    const process = await webcontainer.spawn('jsh', ['-c', action.content], {
      env: { npm_config_yes: true },
    });

    action.abortSignal.addEventListener('abort', () => {
      process.kill();
    });

    process.output.pipeTo(
      new WritableStream({
        write(data) {
          logger.debug('[Shell output]', data);
        },
      }),
    );

    const exitCode = await process.exit;

    logger.debug(`Process terminated with code ${exitCode}`);
  }

  async #runFileAction(action: ActionState) {
    if (action.type !== 'file') {
      unreachable('Expected file action');
    }

    const webcontainer = await this.#webcontainer;

    let folder = nodePath.dirname(action.filePath);

    // remove trailing slashes
    folder = folder.replace(/\/+$/g, '');

    if (folder !== '.') {
      try {
        await webcontainer.fs.mkdir(folder, { recursive: true });
        logger.debug('Created folder', folder);
      } catch (error) {
        logger.error(`Échec de la création du dossier ${folder}:`, error);
        throw new Error(`Impossible de créer le dossier: ${folder}`);
      }
    }

    try {
      await webcontainer.fs.writeFile(action.filePath, action.content);
      logger.debug(`File written ${action.filePath}`);
    } catch (error) {
      logger.error(`Échec de l'écriture du fichier ${action.filePath}:`, error);
      throw new Error(`Impossible d'écrire le fichier: ${action.filePath}`);
    }
  }

  async #runGitAction(action: ActionState) {
    if (action.type !== 'git') {
      unreachable('Expected git action');
    }

    const gitAction = action as GitAction & ActionState;
    const dir = '/home/project';

    logger.debug(`Running git ${gitAction.operation}`);

    // create onAuth callback using token from action or settings
    const token = gitAction.token || getGitToken();
    const onAuth = token
      ? async () => ({
          username: 'oauth2',
          password: token,
        })
      : undefined;

    try {
      switch (gitAction.operation) {
        case 'init': {
          await gitOps.init(dir);
          logger.debug('Git repository initialized');
          break;
        }
        case 'clone': {
          if (!gitAction.url) {
            throw new Error('URL is required for clone operation');
          }

          const webcontainer = await this.#webcontainer;

          await gitOps.clone({
            dir,
            url: gitAction.url,
            depth: 1,
            onAuth,
          });
          logger.debug(`Cloned ${gitAction.url}`);

          // sync cloned files to WebContainer so they appear in editor
          const syncStats = await syncToWebContainer(webcontainer, dir);
          logger.debug(`Synced ${syncStats.files} files to WebContainer`);
          break;
        }
        case 'add': {
          const filepath = gitAction.filepath || '.';
          await gitOps.add(dir, filepath);
          logger.debug(`Added ${filepath} to staging`);
          break;
        }
        case 'commit': {
          const message = gitAction.message || 'Commit via BAVINI';
          await gitOps.commit({ dir, message });
          logger.debug(`Committed with message: ${message}`);
          break;
        }
        case 'push': {
          const remote = gitAction.remote || 'origin';
          const branch = gitAction.branch || 'main';
          await gitOps.push({ dir, remote, branch, onAuth });
          logger.debug(`Pushed to ${remote}/${branch}`);
          break;
        }
        case 'pull': {
          const remote = gitAction.remote || 'origin';
          const branch = gitAction.branch || 'main';

          const webcontainer = await this.#webcontainer;

          await gitOps.pull({ dir, remote, branch, onAuth });
          logger.debug(`Pulled from ${remote}/${branch}`);

          // sync pulled files to WebContainer so editor shows latest
          const syncStats = await syncToWebContainer(webcontainer, dir);
          logger.debug(`Synced ${syncStats.files} files to WebContainer`);
          break;
        }
        case 'status': {
          const statusResult = await gitOps.status(dir);
          logger.debug('Git status:', statusResult);
          break;
        }
        default: {
          logger.warn(`Unknown git operation: ${gitAction.operation}`);
        }
      }
    } catch (error) {
      logger.error(`Git ${gitAction.operation} failed:`, error);
      throw error;
    }
  }

  async #runPythonAction(action: ActionState) {
    if (action.type !== 'python') {
      unreachable('Expected python action');
    }

    const pythonAction = action as PythonAction & ActionState;

    logger.debug('Initializing Pyodide for Python execution');

    try {
      // initialize Pyodide (lazy load)
      await initPyodide();

      // install packages if specified
      if (pythonAction.packages && pythonAction.packages.length > 0) {
        logger.debug(`Installing packages: ${pythonAction.packages.join(', ')}`);
        await installPackages(pythonAction.packages);
      }

      // run the Python code
      logger.debug('Executing Python code');

      const result = await runPython(pythonAction.content);

      if (result.stdout) {
        logger.debug('[Python stdout]', result.stdout);
      }

      if (result.stderr) {
        logger.warn('[Python stderr]', result.stderr);
      }

      if (result.result !== null && result.result !== undefined) {
        logger.debug('Python result:', result.result);
      }
    } catch (error) {
      logger.error('Python execution failed:', error);
      throw error;
    }
  }

  async #runGitHubAction(action: ActionState) {
    if (action.type !== 'github') {
      unreachable('Expected github action');
    }

    const githubAction = action as GitHubAction & ActionState;
    const token = getGitToken();

    if (!token) {
      throw new Error('Token GitHub requis. Connectez votre compte GitHub dans les paramètres.');
    }

    logger.debug(`Running GitHub ${githubAction.operation}`);

    try {
      switch (githubAction.operation) {
        case 'list-repos': {
          const result = await githubApi.listUserRepos(token);

          if (!result.success) {
            throw new Error(result.error);
          }

          logger.debug(`Listed ${result.data?.length || 0} repositories`);
          logger.trace('[GitHub] Repositories:', result.data);
          break;
        }
        case 'get-repo': {
          if (!githubAction.owner || !githubAction.repo) {
            throw new Error('Owner et repo requis pour get-repo');
          }

          const result = await githubApi.getRepo(token, githubAction.owner, githubAction.repo);

          if (!result.success) {
            throw new Error(result.error);
          }

          logger.debug(`Got repo: ${result.data?.full_name}`);
          logger.trace('[GitHub] Repository:', result.data);
          break;
        }
        case 'list-issues': {
          if (!githubAction.owner || !githubAction.repo) {
            throw new Error('Owner et repo requis pour list-issues');
          }

          const result = await githubApi.listIssues(token, githubAction.owner, githubAction.repo, {
            state: githubAction.state,
          });

          if (!result.success) {
            throw new Error(result.error);
          }

          logger.debug(`Listed ${result.data?.length || 0} issues`);
          logger.trace('[GitHub] Issues:', result.data);
          break;
        }
        case 'create-issue': {
          if (!githubAction.owner || !githubAction.repo || !githubAction.title) {
            throw new Error('Owner, repo et title requis pour create-issue');
          }

          const result = await githubApi.createIssue(token, githubAction.owner, githubAction.repo, {
            title: githubAction.title,
            body: githubAction.body,
            labels: githubAction.labels,
          });

          if (!result.success) {
            throw new Error(result.error);
          }

          logger.debug(`Created issue #${result.data?.number}: ${result.data?.title}`);
          logger.trace('[GitHub] Created issue:', result.data);
          break;
        }
        case 'list-prs': {
          if (!githubAction.owner || !githubAction.repo) {
            throw new Error('Owner et repo requis pour list-prs');
          }

          const result = await githubApi.listPullRequests(token, githubAction.owner, githubAction.repo, {
            state: githubAction.state,
          });

          if (!result.success) {
            throw new Error(result.error);
          }

          logger.debug(`Listed ${result.data?.length || 0} pull requests`);
          logger.trace('[GitHub] Pull Requests:', result.data);
          break;
        }
        case 'create-pr': {
          if (
            !githubAction.owner ||
            !githubAction.repo ||
            !githubAction.title ||
            !githubAction.head ||
            !githubAction.base
          ) {
            throw new Error('Owner, repo, title, head et base requis pour create-pr');
          }

          const result = await githubApi.createPullRequest(token, githubAction.owner, githubAction.repo, {
            title: githubAction.title,
            body: githubAction.body,
            head: githubAction.head,
            base: githubAction.base,
          });

          if (!result.success) {
            throw new Error(result.error);
          }

          logger.debug(`Created PR #${result.data?.number}: ${result.data?.title}`);
          logger.trace('[GitHub] Created PR:', result.data);
          break;
        }
        default: {
          logger.warn(`Unknown GitHub operation: ${githubAction.operation}`);
        }
      }
    } catch (error) {
      logger.error(`GitHub ${githubAction.operation} failed:`, error);
      throw error;
    }
  }

  #updateAction(id: string, newState: ActionStateUpdate) {
    const actions = this.actions.get();

    this.actions.setKey(id, { ...actions[id], ...newState } as ActionState);
  }
}
