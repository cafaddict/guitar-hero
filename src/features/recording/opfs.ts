/** Recording audio lives in the Origin Private File System (SPEC §13.4); metadata stays in IndexedDB. */
const DIR = 'recordings';

export function opfsSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.storage?.getDirectory === 'function';
}

async function directory(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(DIR, { create: true });
}

export async function saveFile(name: string, bytes: Uint8Array): Promise<void> {
  const handle = await (await directory()).getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  await writable.write(bytes as Uint8Array<ArrayBuffer>);
  await writable.close();
}

export async function readFile(name: string): Promise<Uint8Array> {
  const handle = await (await directory()).getFileHandle(name);
  return new Uint8Array(await (await handle.getFile()).arrayBuffer());
}
