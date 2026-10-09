/**
 * Armazenamento persistente do aparelho (IndexedDB) para o modo sem internet: cópia dos dados, fila de
 * alterações a enviar e fotos ainda não enviadas. Sem IndexedDB (testes, navegador restrito), usa memória.
 */
const DB = "eb-offline";
const STORE = "kv";

const memory = new Map<string, unknown>();
let opened: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (opened) return opened;
  opened = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("sem IndexedDB"));
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  opened.catch(() => {
    opened = null;
  });
  return opened;
}

async function run<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const request = action(transaction.objectStore(STORE));
    transaction.oncomplete = () => resolve(request.result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function idbGet<T>(key: string): Promise<T | undefined> {
  try {
    return await run<T | undefined>("readonly", (store) => store.get(key));
  } catch {
    return memory.get(key) as T | undefined;
  }
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  try {
    await run("readwrite", (store) => store.put(value, key));
  } catch {
    memory.set(key, value);
  }
}

export async function idbDelete(key: string): Promise<void> {
  memory.delete(key);
  try {
    await run("readwrite", (store) => store.delete(key));
  } catch {
    /* ignorado */
  }
}

export async function idbKeys(): Promise<string[]> {
  try {
    return (await run<IDBValidKey[]>("readonly", (store) => store.getAllKeys())).map(String);
  } catch {
    return [...memory.keys()];
  }
}

/** Apaga tudo o que começa com `prefix` (ao sair da conta ou trocar de pessoa). */
export async function idbClear(prefix = ""): Promise<void> {
  for (const key of await idbKeys()) if (key.startsWith(prefix)) await idbDelete(key);
}
