/**
 * Screen Wake Lock during practice (SPEC §8.5). The browser drops the lock whenever the page is hidden, so it
 * is re-acquired on visibilitychange while practice wants it. Unsupported browsers degrade silently.
 */

interface Sentinel {
  release(): Promise<void>;
  addEventListener(type: 'release', listener: () => void): void;
}

export interface WakeLockPlatform {
  wakeLock?: { request(type: 'screen'): Promise<Sentinel> };
}

export interface VisibilitySource {
  readonly visibilityState: DocumentVisibilityState;
  addEventListener(type: 'visibilitychange', listener: () => void): void;
  removeEventListener(type: 'visibilitychange', listener: () => void): void;
}

export class WakeLockManager {
  private wanted = false;
  private sentinel: Sentinel | null = null;

  constructor(
    private readonly platform: WakeLockPlatform,
    private readonly visibility: VisibilitySource,
  ) {}

  get supported(): boolean {
    return this.platform.wakeLock !== undefined;
  }

  get active(): boolean {
    return this.sentinel !== null;
  }

  async enable(): Promise<void> {
    if (this.wanted) return;
    this.wanted = true;
    this.visibility.addEventListener('visibilitychange', this.onVisibility);
    await this.acquire();
  }

  async disable(): Promise<void> {
    this.wanted = false;
    this.visibility.removeEventListener('visibilitychange', this.onVisibility);
    const sentinel = this.sentinel;
    this.sentinel = null;
    await sentinel?.release().catch(() => undefined);
  }

  private readonly onVisibility = (): void => {
    if (this.wanted && this.visibility.visibilityState === 'visible' && this.sentinel === null)
      void this.acquire();
  };

  private async acquire(): Promise<void> {
    if (!this.platform.wakeLock || this.visibility.visibilityState !== 'visible') return;
    try {
      const sentinel = await this.platform.wakeLock.request('screen');
      if (!this.wanted) {
        await sentinel.release();
        return;
      }
      this.sentinel = sentinel;
      sentinel.addEventListener('release', () => {
        if (this.sentinel === sentinel) this.sentinel = null;
      });
    } catch {
      // Denied (battery saver, not visible): practice continues without it.
      this.sentinel = null;
    }
  }
}

let shared: WakeLockManager | null = null;

/** App-wide instance bound to the real navigator/document. */
export function wakeLock(): WakeLockManager {
  shared ??= new WakeLockManager(navigator as WakeLockPlatform, document);
  return shared;
}
