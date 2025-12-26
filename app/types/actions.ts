export type ActionType = 'file' | 'shell' | 'git' | 'python' | 'github';

export type GitOperation = 'clone' | 'commit' | 'push' | 'pull' | 'init' | 'add' | 'status';

export type GitHubOperation = 'list-repos' | 'get-repo' | 'list-issues' | 'create-issue' | 'list-prs' | 'create-pr';

export interface BaseAction {
  content: string;
}

export interface FileAction extends BaseAction {
  type: 'file';
  filePath: string;
}

export interface ShellAction extends BaseAction {
  type: 'shell';
}

export interface GitAction extends BaseAction {
  type: 'git';
  operation: GitOperation;
  url?: string;
  message?: string;
  remote?: string;
  branch?: string;
  filepath?: string;
  token?: string;
}

export interface PythonAction extends BaseAction {
  type: 'python';
  packages?: string[];
}

export interface GitHubAction extends BaseAction {
  type: 'github';
  operation: GitHubOperation;
  owner?: string;
  repo?: string;
  title?: string;
  body?: string;
  head?: string;
  base?: string;
  labels?: string[];
  state?: 'open' | 'closed' | 'all';
}

export type BoltAction = FileAction | ShellAction | GitAction | PythonAction | GitHubAction;

export type BoltActionData = BoltAction | BaseAction;
