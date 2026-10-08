import { useSyncExternalStore } from "react";

/**
 * Banco local do app: uma coleção por chave, guardada no aparelho e reativa. Enquanto
 * ninguém grava, a coleção devolve os dados de exemplo (que acompanham o dia de hoje).
 * Trocar por Firestore depois exige reescrever só este arquivo e os serviços.
 */
export type Store<T> = {
  get: () => T;
  set: (next: T | ((current: T) => T)) => void;
  reset: () => void;
  use: () => T;
};

export function createStore<T>(key: string, seed: () => T): Store<T> {
  const listeners = new Set<() => void>();
  let cache: { raw: string | null; value: T } | null = null;
  let serverValue: T | null = null;

  const notify = () => listeners.forEach((listener) => listener());

  function get(): T {
    if (typeof window === "undefined") return (serverValue ??= seed());
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(key);
    } catch {
      /* sem armazenamento: vale o que está em memória */
    }
    if (cache && cache.raw === raw) return cache.value;
    let value: T;
    try {
      value = raw === null ? seed() : (JSON.parse(raw) as T);
    } catch {
      value = seed();
    }
    cache = { raw, value };
    return value;
  }

  function set(next: T | ((current: T) => T)) {
    const value = typeof next === "function" ? (next as (current: T) => T)(get()) : next;
    const raw = JSON.stringify(value);
    try {
      window.localStorage.setItem(key, raw);
    } catch {
      /* mantém em memória */
    }
    cache = { raw, value };
    notify();
  }

  function reset() {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignorado */
    }
    cache = null;
    notify();
  }

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    const onStorage = (event: StorageEvent) => {
      if (event.key === key) listener();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  };

  return {
    get,
    set,
    reset,
    use: () => useSyncExternalStore(subscribe, get, () => (serverValue ??= seed())),
  };
}
