import Store from 'electron-store';
import { settingsSnapshotSchema, type SettingsSnapshot } from '../shared/ipc-schemas';

const defaults = settingsSnapshotSchema.parse({});

const store = new Store<SettingsSnapshot>({
  name: 'settings',
  defaults,
});

export function getAllSettings(): SettingsSnapshot {
  const raw = store.store;
  const result = settingsSnapshotSchema.safeParse(raw);
  if (!result.success) {
    return defaults;
  }
  return result.data;
}

export function setSetting<K extends keyof SettingsSnapshot>(key: K, value: SettingsSnapshot[K]): void {
  const draft = { ...store.store, [key]: value };
  const validated = settingsSnapshotSchema.safeParse(draft);
  if (!validated.success) {
    throw new Error(`Invalid setting value for ${String(key)}: ${validated.error.message}`);
  }
  store.set(key, value);
}

export function onChanged(cb: (snap: SettingsSnapshot) => void): () => void {
  const unsubscribe = store.onDidAnyChange(() => cb(getAllSettings()));
  return unsubscribe;
}
