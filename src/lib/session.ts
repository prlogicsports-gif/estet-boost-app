import { useSyncExternalStore } from "react";

import type { Session } from "@/lib/auth.types";

const KEY = "eb.session";
const listeners = new Set<() => void>();
let cache: { raw: string | null; value: Session | null } = { raw: null, value: null };

function read(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw !== cache.raw) cache = { raw, value: raw ? (JSON.parse(raw) as Session) : null };
    return cache.value;
  } catch {
    return null;
  }
}

function emit() {
  listeners.forEach((listener) => listener());
}

export const sessionStore = {
  get: read,
  set(session: Session) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(session));
    } catch {
      /* sem armazenamento: a sessão vale só até recarregar */
    }
    cache = { raw: JSON.stringify(session), value: session };
    emit();
  },
  clear() {
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      /* ignorado */
    }
    cache = { raw: null, value: null };
    emit();
  },
};

export function homeFor(role: Session["role"]) {
  return role === "gestor" ? ("/hoje" as const) : ("/cliente" as const);
}

/** `undefined` no servidor e no primeiro render; `null` quando não há sessão. */
export function useSession(): Session | null | undefined {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    read,
    () => undefined,
  );
}
