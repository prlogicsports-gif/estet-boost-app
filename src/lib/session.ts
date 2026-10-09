import { useSyncExternalStore } from "react";

import type { Permissions, Role, Session } from "@/lib/auth.types";
import { PERMISSION_KEYS } from "@/lib/auth.types";
import { ensureOwner } from "@/lib/local-data";
import { startSync, stopSync } from "@/lib/remote-store";
import { supabase } from "@/lib/supabase";

/**
 * Sessão = login do Supabase Auth + o perfil da pessoa (`profiles`: papel, clínica, permissões).
 * O papel NUNCA vem de dado editável pelo usuário; vem da tabela `profiles`, que só funções do servidor alteram.
 */
export type AuthState =
  | { status: "loading" }
  | { status: "out" }
  | { status: "needs-profile"; uid: string; email: string }
  | { status: "error"; message: string }
  | { status: "in"; session: Session };

let state: AuthState = { status: "loading" };
const listeners = new Set<() => void>();
let started = false;
let sequence = 0;

const emit = () => listeners.forEach((listener) => listener());
const set = (next: AuthState) => {
  state = next;
  emit();
};

const none = Object.fromEntries(PERMISSION_KEYS.map((key) => [key, false])) as Permissions;
const everything = Object.fromEntries(PERMISSION_KEYS.map((key) => [key, true])) as Permissions;

type ProfileRow = {
  id: string;
  clinic_id: string;
  role: Role;
  client_id: string | null;
  name: string;
  email: string | null;
  active: boolean;
  permissions: Partial<Record<string, boolean>> | null;
};

async function load(uid: string, email: string) {
  const mine = ++sequence;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, clinic_id, role, client_id, name, email, active, permissions")
    .eq("id", uid)
    .maybeSingle();
  if (mine !== sequence) return;
  if (error) {
    set({
      status: "error",
      message: "Não foi possível carregar sua conta. Confira a conexão e tente de novo.",
    });
    return;
  }
  const row = data as ProfileRow | null;
  if (!row) {
    set({ status: "needs-profile", uid, email });
    return;
  }
  if (!row.active) {
    try {
      window.sessionStorage.setItem(
        "eb.notice",
        "Seu acesso foi desativado pela gestora da clínica.",
      );
    } catch {
      /* ignorado */
    }
    await supabase.auth.signOut();
    return;
  }
  ensureOwner(uid);
  const permissions: Permissions =
    row.role === "gestor"
      ? everything
      : row.role === "funcionario"
        ? (Object.fromEntries(
            PERMISSION_KEYS.map((key) => [key, row.permissions?.[key] === true]),
          ) as Permissions)
        : none;
  const session: Session = {
    uid,
    role: row.role,
    name: row.name,
    email: row.email ?? email,
    clinicId: row.clinic_id,
    ...(row.client_id ? { clientId: row.client_id } : {}),
    permissions,
  };
  set({ status: "in", session });
  startSync(session);
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  supabase.auth.onAuthStateChange((_event, authSession) => {
    // Não chamar o Supabase dentro do callback (trava o cliente): adia para o próximo ciclo.
    if (!authSession) {
      sequence += 1;
      stopSync();
      set({ status: "out" });
      return;
    }
    window.setTimeout(() => void load(authSession.user.id, authSession.user.email ?? ""), 0);
  });
}

export const sessionStore = {
  get: () => state,
  /** Relê o perfil (depois de criar a clínica ou aceitar uma credencial, por exemplo). */
  async refresh() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      stopSync();
      set({ status: "out" });
      return;
    }
    await load(data.session.user.id, data.session.user.email ?? "");
  },
};

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const serverState: AuthState = { status: "loading" };

export function useAuthState(): AuthState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => serverState,
  );
}

/** Papel de quem está logado (ou `null`). */
export const currentRole = () => (state.status === "in" ? state.session.role : null);

export function homeFor(role: Role) {
  return role === "cliente" ? ("/cliente" as const) : ("/hoje" as const);
}

/** `undefined` enquanto carrega; `null` sem login ou sem perfil completo. */
export function useSession(): Session | null | undefined {
  const auth = useAuthState();
  if (auth.status === "loading") return undefined;
  return auth.status === "in" ? auth.session : null;
}
