import { loadPyodide, type PyodideInterface } from 'pyodide';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('Pyodide');

const PYODIDE_INDEX_URL = '/assets/pyodide/';

let pyodideInstance: PyodideInterface | null = null;
let pyodidePromise: Promise<PyodideInterface> | null = null;
let micropipLoaded = false;

export interface PythonResult {
  result: any;
  stdout: string;
  stderr: string;
}

/**
 * Initialize Pyodide runtime. Returns cached instance if already initialized.
 */
export async function initPyodide(): Promise<PyodideInterface> {
  if (pyodideInstance) {
    return pyodideInstance;
  }

  if (pyodidePromise) {
    return pyodidePromise;
  }

  pyodidePromise = (async () => {
    logger.info('Initializing Pyodide...');

    const pyodide = await loadPyodide({
      indexURL: PYODIDE_INDEX_URL,
    });

    logger.info('Pyodide initialized successfully');

    pyodideInstance = pyodide;

    return pyodide;
  })();

  return pyodidePromise;
}

/**
 * Get the Pyodide instance. Throws if not initialized.
 */
export function getPyodide(): PyodideInterface {
  if (!pyodideInstance) {
    throw new Error('Pyodide not initialized. Call initPyodide() first.');
  }

  return pyodideInstance;
}

/**
 * Check if Pyodide is ready.
 */
export function isPyodideReady(): boolean {
  return pyodideInstance !== null;
}

/**
 * Load micropip for package installation.
 */
async function ensureMicropip(): Promise<void> {
  if (micropipLoaded) {
    return;
  }

  const pyodide = await initPyodide();

  await pyodide.loadPackage('micropip');
  micropipLoaded = true;
  logger.debug('micropip loaded');
}

/**
 * Install Python packages using micropip.
 */
export async function installPackages(packages: string[]): Promise<void> {
  if (packages.length === 0) {
    return;
  }

  await ensureMicropip();

  const pyodide = getPyodide();
  const micropip = pyodide.pyimport('micropip');

  for (const pkg of packages) {
    logger.debug(`Installing package: ${pkg}`);

    try {
      await micropip.install(pkg);
      logger.info(`Installed: ${pkg}`);
    } catch (error) {
      logger.error(`Failed to install ${pkg}:`, error);
      throw error;
    }
  }
}

/**
 * Run Python code and capture stdout/stderr.
 */
export async function runPython(code: string): Promise<PythonResult> {
  const pyodide = await initPyodide();

  // set up stdout/stderr capture
  await pyodide.runPythonAsync(`
import sys
from io import StringIO

_captured_stdout = StringIO()
_captured_stderr = StringIO()
_original_stdout = sys.stdout
_original_stderr = sys.stderr
sys.stdout = _captured_stdout
sys.stderr = _captured_stderr
`);

  let result: any;
  let error: Error | null = null;

  try {
    result = await pyodide.runPythonAsync(code);
  } catch (err) {
    error = err as Error;
    logger.error('Python execution error:', err);
  }

  // capture output
  const stdout = await pyodide.runPythonAsync('_captured_stdout.getvalue()');
  const stderr = await pyodide.runPythonAsync('_captured_stderr.getvalue()');

  // restore stdout/stderr
  await pyodide.runPythonAsync(`
sys.stdout = _original_stdout
sys.stderr = _original_stderr
`);

  if (error) {
    return {
      result: null,
      stdout: stdout || '',
      stderr: stderr || error.message,
    };
  }

  return {
    result,
    stdout: stdout || '',
    stderr: stderr || '',
  };
}

/**
 * Run Python code synchronously (blocking). Use with caution.
 */
export function runPythonSync(code: string): any {
  const pyodide = getPyodide();

  return pyodide.runPython(code);
}

/**
 * Close and reset Pyodide instance.
 */
export function closePyodide(): void {
  pyodideInstance = null;
  pyodidePromise = null;
  micropipLoaded = false;
  logger.info('Pyodide closed');
}

/**
 * Check if a package is available in Pyodide's built-in packages.
 */
export async function isPackageBuiltin(packageName: string): Promise<boolean> {
  const pyodide = await initPyodide();

  try {
    const result = await pyodide.runPythonAsync(`
import micropip
"${packageName}" in micropip.list()
`);

    return result;
  } catch {
    return false;
  }
}
