/** Settings cache shared by screens (loaded once, written through to IndexedDB). */
import { create } from 'zustand';
import type { Settings } from '../data/settings';
import { repo } from './services';

interface SettingsState {
  settings: Settings | null;
  load(): Promise<Settings>;
  update(patch: Partial<Settings>): Promise<Settings>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,
  async load() {
    const settings = await repo.settings();
    set({ settings });
    return settings;
  },
  async update(patch) {
    const current = get().settings ?? (await repo.settings());
    const next = { ...current, ...patch };
    set({ settings: next });
    await repo.saveSettings(next);
    return next;
  },
}));
