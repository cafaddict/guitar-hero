/** Persistent storage request at startup (SPEC §13.3): asks the browser not to evict IndexedDB/OPFS. */
let granted: boolean | null = null;

export async function requestPersistentStorage(): Promise<boolean> {
  const storage = typeof navigator === 'undefined' ? undefined : navigator.storage;
  if (!storage?.persist) {
    granted = false;
    return false;
  }
  try {
    granted = (await storage.persisted?.()) || (await storage.persist());
  } catch {
    granted = false;
  }
  return granted;
}

export function persistentStorageGranted(): boolean | null {
  return granted;
}
