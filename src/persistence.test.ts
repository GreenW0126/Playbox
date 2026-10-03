import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadPersistedLanguage, savePersistedLanguage, storageKeysForPrefix } from './persistence';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe('browser persistence', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('isolates browser data by storage prefix', () => {
    expect(storageKeysForPrefix('playbox')).toEqual({
      snapshot: 'playbox.actor.v1',
      userData: 'playbox.user-data.v1',
      language: 'playbox.language.v1',
    });
    expect(storageKeysForPrefix('private-playbox')).toEqual({
      snapshot: 'private-playbox.actor.v1',
      userData: 'private-playbox.user-data.v1',
      language: 'private-playbox.language.v1',
    });
  });

  it('round-trips the language preference through localStorage', () => {
    const localStorage = new MemoryStorage();
    vi.stubGlobal('window', { localStorage });

    savePersistedLanguage('zh');
    expect(loadPersistedLanguage()).toBe('zh');
  });
});
