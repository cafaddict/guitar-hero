/**
 * Service worker registration with the "prompt" strategy (SPEC §15): a new version never reloads the page by
 * itself (practice must not be interrupted); the home screen alone offers the update.
 */

import { useRegisterSW } from 'virtual:pwa-register/react';
import { useEffect } from 'react';
import { create } from 'zustand';
import { ko } from '../i18n/ko';
import { Button } from '../ui/Button';

interface PwaState {
  needRefresh: boolean;
  update: (() => void) | null;
  dismiss: () => void;
}

export const usePwaStore = create<PwaState>((set) => ({
  needRefresh: false,
  update: null,
  dismiss: () => set({ needRefresh: false }),
}));

/** Mounted once in the app shell: registers the worker and publishes "update available". */
export function PwaRegistration() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({ immediate: true });
  useEffect(() => {
    usePwaStore.setState({ needRefresh, update: () => void updateServiceWorker(true) });
  }, [needRefresh, updateServiceWorker]);
  return null;
}

/** Shown on the home screen only. */
export function UpdateToast() {
  const { needRefresh, update, dismiss } = usePwaStore();
  if (!needRefresh || !update) return null;
  return (
    <div
      role="status"
      className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-surface-2 p-3"
      data-testid="update-toast"
    >
      <span>{ko.pwa.updateReady}</span>
      <Button onClick={update}>{ko.pwa.update}</Button>
      <Button variant="ghost" onClick={dismiss}>
        {ko.pwa.later}
      </Button>
    </div>
  );
}
