import { describe, expect, it, beforeEach, vi } from 'vitest';

// mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('Git Settings Store', () => {
  beforeEach(async () => {
    vi.resetModules();
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  describe('getGitToken', () => {
    it('should return null when no token is set', async () => {
      const { getGitToken } = await import('./git-settings');

      expect(getGitToken()).toBeNull();
    });

    it('should return stored token from localStorage', async () => {
      localStorageMock.setItem('bavini_git_token', 'ghp_stored_token');

      const { getGitToken } = await import('./git-settings');

      expect(getGitToken()).toBe('ghp_stored_token');
    });
  });

  describe('setGitToken', () => {
    it('should set token and persist to localStorage', async () => {
      const { setGitToken, getGitToken } = await import('./git-settings');

      setGitToken('ghp_new_token');

      expect(getGitToken()).toBe('ghp_new_token');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('bavini_git_token', 'ghp_new_token');
    });

    it('should remove token from localStorage when set to null', async () => {
      const { setGitToken, getGitToken } = await import('./git-settings');

      setGitToken('ghp_test');
      setGitToken(null);

      expect(getGitToken()).toBeNull();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('bavini_git_token');
    });
  });

  describe('clearGitToken', () => {
    it('should clear the token', async () => {
      const { setGitToken, clearGitToken, getGitToken } = await import('./git-settings');

      setGitToken('ghp_test_token');
      clearGitToken();

      expect(getGitToken()).toBeNull();
    });
  });

  describe('gitSettingsStore', () => {
    it('should initialize with token from localStorage', async () => {
      localStorageMock.setItem('bavini_git_token', 'ghp_persisted');

      const { gitSettingsStore } = await import('./git-settings');

      expect(gitSettingsStore.get().token).toBe('ghp_persisted');
    });

    it('should update when setGitToken is called', async () => {
      const { gitSettingsStore, setGitToken } = await import('./git-settings');

      setGitToken('ghp_updated');

      expect(gitSettingsStore.get().token).toBe('ghp_updated');
    });
  });

  describe('kGitToken constant', () => {
    it('should export the correct localStorage key', async () => {
      const { kGitToken } = await import('./git-settings');

      expect(kGitToken).toBe('bavini_git_token');
    });
  });
});
