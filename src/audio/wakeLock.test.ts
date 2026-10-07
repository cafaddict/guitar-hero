import { describe, expect, it } from 'vitest';
import { type VisibilitySource, WakeLockManager, type WakeLockPlatform } from './wakeLock';

class FakeSentinel {
  released = false;
  private listeners: (() => void)[] = [];
  addEventListener(_type: 'release', listener: () => void): void {
    this.listeners.push(listener);
  }
  async release(): Promise<void> {
    this.released = true;
    for (const l of this.listeners) l();
  }
}

class FakeDocument implements VisibilitySource {
  visibilityState: DocumentVisibilityState = 'visible';
  private listeners = new Set<() => void>();
  addEventListener(_type: 'visibilitychange', listener: () => void): void {
    this.listeners.add(listener);
  }
  removeEventListener(_type: 'visibilitychange', listener: () => void): void {
    this.listeners.delete(listener);
  }
  setVisible(visible: boolean): void {
    this.visibilityState = visible ? 'visible' : 'hidden';
    for (const l of this.listeners) l();
  }
  get listenerCount(): number {
    return this.listeners.size;
  }
}

function setup(fail = false) {
  const sentinels: FakeSentinel[] = [];
  const platform: WakeLockPlatform = {
    wakeLock: {
      request: async () => {
        if (fail) throw new DOMException('denied', 'NotAllowedError');
        const s = new FakeSentinel();
        sentinels.push(s);
        return s;
      },
    },
  };
  const doc = new FakeDocument();
  return { manager: new WakeLockManager(platform, doc), sentinels, doc };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('WakeLockManager', () => {
  it('acquires, re-acquires after the page becomes visible again, and releases on disable', async () => {
    const { manager, sentinels, doc } = setup();
    await manager.enable();
    expect(manager.active).toBe(true);
    // The browser releases the lock when the page is hidden.
    doc.setVisible(false);
    await sentinels[0]!.release();
    expect(manager.active).toBe(false);
    doc.setVisible(true);
    await flush();
    expect(manager.active).toBe(true);
    expect(sentinels).toHaveLength(2);
    await manager.disable();
    expect(manager.active).toBe(false);
    expect(sentinels[1]!.released).toBe(true);
    expect(doc.listenerCount).toBe(0);
    doc.setVisible(true);
    await flush();
    expect(sentinels).toHaveLength(2);
  });

  it('degrades silently when unsupported or denied', async () => {
    const unsupported = new WakeLockManager({}, new FakeDocument());
    expect(unsupported.supported).toBe(false);
    await unsupported.enable();
    expect(unsupported.active).toBe(false);
    const { manager } = setup(true);
    await expect(manager.enable()).resolves.toBeUndefined();
    expect(manager.active).toBe(false);
  });

  it('does not request while hidden', async () => {
    const { manager, sentinels, doc } = setup();
    doc.visibilityState = 'hidden';
    await manager.enable();
    expect(sentinels).toHaveLength(0);
    doc.setVisible(true);
    await flush();
    expect(sentinels).toHaveLength(1);
  });
});
