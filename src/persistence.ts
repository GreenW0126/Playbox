import type { Snapshot } from 'xstate';
import type { PersistedUserData, PlayboxContext } from './playbox.machine';
import type { Language } from './i18n';
import { STORAGE_PREFIX } from './app-config';

const SCHEMA_VERSION = 7;

export function storageKeysForPrefix(prefix: string) {
  return {
    snapshot: `${prefix}.actor.v1`,
    userData: `${prefix}.user-data.v1`,
    language: `${prefix}.language.v1`,
  } as const;
}

const STORAGE_KEYS = storageKeysForPrefix(STORAGE_PREFIX);

function getBrowserStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

interface StoredState {
  version: number;
  snapshot: Snapshot<unknown>;
}

export function loadPersistedSnapshot(): Snapshot<unknown> | undefined {
  const storage = getBrowserStorage();
  if (!storage) return undefined;
  try {
    const raw = storage.getItem(STORAGE_KEYS.snapshot);
    if (!raw) return undefined;
    const stored = JSON.parse(raw) as StoredState;
    if (stored.version !== SCHEMA_VERSION || !stored.snapshot) {
      storage.removeItem(STORAGE_KEYS.snapshot);
      return undefined;
    }
    return stored.snapshot;
  } catch {
    storage.removeItem(STORAGE_KEYS.snapshot);
    return undefined;
  }
}

export function loadPersistedUserData(): PersistedUserData | undefined {
  const storage = getBrowserStorage();
  if (!storage) return undefined;
  try {
    const raw = storage.getItem(STORAGE_KEYS.userData);
    if (!raw) return undefined;
    const data = JSON.parse(raw) as PersistedUserData;
    if (!Array.isArray(data.records) || !data.recentTasksByRole) return undefined;
    return data;
  } catch {
    return undefined;
  }
}

export function savePersistedSnapshot(snapshot: Snapshot<unknown>) {
  const storage = getBrowserStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEYS.snapshot, JSON.stringify({ version: SCHEMA_VERSION, snapshot }));
    const context = (snapshot as Snapshot<unknown> & { context?: PlayboxContext }).context;
    if (context) {
      const userData: PersistedUserData = {
        records: context.records,
        recentTasksByRole: context.recentTasksByRole,
      };
      storage.setItem(STORAGE_KEYS.userData, JSON.stringify(userData));
    }
  } catch {
    // Persistence failure should not block a session.
  }
}

export function loadPersistedLanguage(): Language | undefined {
  const storage = getBrowserStorage();
  if (!storage) return undefined;
  try {
    const value = storage.getItem(STORAGE_KEYS.language);
    return value === 'en' || value === 'zh' ? value : undefined;
  } catch {
    return undefined;
  }
}

export function savePersistedLanguage(language: Language) {
  const storage = getBrowserStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEYS.language, language);
  } catch {
    // Preference persistence failure should not block a session.
  }
}
