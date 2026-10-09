import { useSyncExternalStore } from "react";

import type { PermissionKey, Session } from "@/lib/auth.types";
import { can } from "@/lib/permissions";
import { supabase } from "@/lib/supabase";

/**
 * Armazenamento compartilhado: cada coleção do app é uma tabela do Supabase.
 * - Leitura: consulta inicial, tempo real (Realtime) e releitura a cada 30 s como garantia.
 * - Escrita: otimista (a tela muda na hora) e enviada ao banco logo depois, agrupando alterações seguidas
 *   (por exemplo, o rascunho do atendimento que salva a cada letra). Se o banco recusar (RLS, conflito),
 *   a coleção volta ao que está no servidor e a tela recebe o aviso `eb:sync-error`.
 * Quem protege os dados é o RLS do banco; aqui só se monta a consulta.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = any;
export type SyncCtx = { session: Session; can: (permission: PermissionKey) => boolean };

type Op<T> = { kind: "save" | "remove"; rec: T; prev: T | undefined };

export type RemoteConfig<T> = {
  key: string;
  table: string;
  /** Colunas (e tabelas embutidas) da consulta. Padrão: tudo. */
  select?: string;
  order?: { column: string; ascending?: boolean };
  idOf?: (rec: T) => string;
  fromRow: (row: Row, ctx: SyncCtx) => T;
  /** Consulta própria (ex.: função do banco). Substitui select/fromRow. */
  load?: (ctx: SyncCtx) => Promise<T[]>;
  save?: (rec: T, prev: T | undefined, ctx: SyncCtx) => Promise<void>;
  remove?: (rec: T, ctx: SyncCtx) => Promise<void>;
  /** Outras tabelas cujas mudanças também exigem reler esta coleção. */
  watch?: string[];
  /** Chamado depois de cada leitura (ex.: mostrar push de aviso novo). */
  onLoaded?: (prev: T[], next: T[], ctx: SyncCtx) => void;
};

export type RemoteStore<T> = {
  get: () => T[];
  set: (next: T[] | ((current: T[]) => T[])) => void;
  use: () => T[];
  /** Relê do servidor agora. */
  reload: () => Promise<void>;
};

interface Controller {
  start: (ctx: SyncCtx) => Promise<void>;
  stop: () => void;
  reload: () => Promise<void>;
  flush: () => Promise<void>;
}

const registry = new Set<Controller>();
let current: SyncCtx | null = null;
let startedFor: string | null = null;
let ready = false;
const readySubs = new Set<() => void>();
const setReady = (value: boolean) => {
  ready = value;
  readySubs.forEach((listener) => listener());
};

export function reportSyncError(message: string) {
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent("eb:sync-error", { detail: message }));
}

// Todas as coleções enviam suas alterações juntas, na ordem em que foram registradas (clientes antes da agenda,
// por exemplo), para uma referência nunca chegar ao banco antes do que ela aponta.
let globalTimer: ReturnType<typeof setTimeout> | undefined;
let globalRunning: Promise<void> = Promise.resolve();
function scheduleGlobalFlush() {
  if (globalTimer) clearTimeout(globalTimer);
  globalTimer = setTimeout(() => {
    globalRunning = globalRunning.then(async () => {
      for (const controller of registry) await controller.flush();
    });
  }, 250);
}

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

export function createRemoteStore<T>(config: RemoteConfig<T>, initial: T[] = []): RemoteStore<T> {
  const idOf = config.idOf ?? ((rec: T) => (rec as unknown as { id: string }).id);
  let cache: T[] = initial;
  const subs = new Set<() => void>();
  const queue = new Map<string, Op<T>>();
  let reloadTimer: ReturnType<typeof setTimeout> | undefined;
  let pollTimer: ReturnType<typeof setInterval> | undefined;
  let flushing = false;
  let stale = false;
  let channels: ReturnType<typeof supabase.channel>[] = [];

  const emit = () => subs.forEach((listener) => listener());

  async function load() {
    const ctx = current;
    if (!ctx) return;
    if (queue.size || flushing) {
      stale = true; // há escritas a caminho: relê quando terminarem, para não desfazer a alteração na tela
      return;
    }
    try {
      let next: T[];
      if (config.load) next = await config.load(ctx);
      else {
        let query = supabase.from(config.table).select(config.select ?? "*");
        if (config.order)
          query = query.order(config.order.column, { ascending: config.order.ascending ?? true });
        const { data, error } = await query;
        if (error) throw error;
        next = ((data ?? []) as Row[]).map((row) => config.fromRow(row, ctx));
      }
      if (queue.size || flushing || current !== ctx) return;
      const prev = cache;
      cache = next;
      emit();
      config.onLoaded?.(prev, next, ctx);
    } catch {
      /* sem conexão ou sem permissão: mantém o que já está na tela */
    }
  }

  async function flush() {
    const ctx = current;
    if (!ctx || flushing) return;
    flushing = true;
    let failed = false;
    while (queue.size) {
      const [key, op] = queue.entries().next().value as [string, Op<T>];
      queue.delete(key);
      try {
        if (op.kind === "remove") await config.remove?.(op.rec, ctx);
        else await config.save?.(op.rec, op.prev, ctx);
      } catch {
        failed = true;
      }
    }
    flushing = false;
    if (failed)
      reportSyncError("Não foi possível salvar uma alteração. Os dados foram atualizados.");
    if (failed || stale) {
      stale = false;
      await load();
    }
  }

  const scheduleFlush = () => scheduleGlobalFlush();

  const scheduleReload = () => {
    if (reloadTimer) clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => void load(), 300);
  };

  function set(next: T[] | ((list: T[]) => T[])) {
    const prev = cache;
    const value = typeof next === "function" ? (next as (list: T[]) => T[])(prev) : next;
    cache = value;
    emit();
    if (!config.save && !config.remove) return;
    const before = new Map(prev.map((rec) => [idOf(rec), rec]));
    const seen = new Set<string>();
    for (const rec of value) {
      const id = idOf(rec);
      seen.add(id);
      const old = before.get(id);
      if (!old) queue.set(id, { kind: "save", rec, prev: undefined });
      else if (old !== rec && !same(old, rec))
        queue.set(id, { kind: "save", rec, prev: queue.get(id)?.prev ?? old });
    }
    for (const [id, old] of before)
      if (!seen.has(id)) queue.set(id, { kind: "remove", rec: old, prev: old });
    if (queue.size) scheduleFlush();
  }

  const controller: Controller = {
    async start(ctx) {
      current = ctx;
      await load();
      for (const table of [config.table, ...(config.watch ?? [])]) {
        channels.push(
          supabase
            .channel(`eb-${config.key}-${table}`)
            .on("postgres_changes", { event: "*", schema: "public", table }, scheduleReload)
            .subscribe(),
        );
      }
      pollTimer = setInterval(() => {
        if (typeof document === "undefined" || document.visibilityState === "visible") void load();
      }, 30000);
    },
    stop() {
      if (reloadTimer) clearTimeout(reloadTimer);
      if (pollTimer) clearInterval(pollTimer);
      channels.forEach((channel) => void supabase.removeChannel(channel));
      channels = [];
      queue.clear();
      cache = initial;
      emit();
    },
    reload: load,
    flush,
  };

  registry.add(controller);
  if (current) void controller.start(current);

  // Antes de a aba fechar ou ir para segundo plano, envia o que ainda estava esperando.
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden" && queue.size) scheduleGlobalFlush();
    });
  }

  return {
    get: () => cache,
    set,
    reload: load,
    use: () =>
      useSyncExternalStore(
        (listener) => {
          subs.add(listener);
          return () => {
            subs.delete(listener);
          };
        },
        () => cache,
        () => initial,
      ),
  };
}

/** Um único registro (configuração da clínica, preferências): guardado como coleção de um item. */
export function createRemoteDoc<T>(config: {
  key: string;
  table: string;
  initial: T;
  load: (ctx: SyncCtx) => Promise<T | null>;
  save: (value: T, ctx: SyncCtx) => Promise<void>;
  watch?: string[];
}) {
  type Box = { id: string; value: T };
  const store = createRemoteStore<Box>(
    {
      key: config.key,
      table: config.table,
      ...(config.watch ? { watch: config.watch } : {}),
      fromRow: () => ({ id: "doc", value: config.initial }),
      load: async (ctx) => {
        const value = await config.load(ctx);
        return [{ id: "doc", value: value ?? config.initial }];
      },
      save: (box, _prev, ctx) => config.save(box.value, ctx),
    },
    [{ id: "doc", value: config.initial }],
  );
  const read = (list: Box[]) => list[0]?.value ?? config.initial;
  return {
    get: () => read(store.get()),
    set: (next: T | ((current: T) => T)) =>
      store.set((list) => {
        const value = typeof next === "function" ? (next as (current: T) => T)(read(list)) : next;
        return [{ id: "doc", value }];
      }),
    use: () => read(store.use()),
    reload: store.reload,
  };
}

/** Liga a sincronização para a pessoa logada (chamado pelo login). */
export function startSync(session: Session) {
  const key = `${session.uid}:${session.clinicId}:${session.role}:${JSON.stringify(session.permissions)}`;
  if (startedFor === key) return;
  if (startedFor) registry.forEach((controller) => controller.stop());
  startedFor = key;
  const ctx: SyncCtx = { session, can: (permission) => can(session, permission) };
  current = ctx;
  setReady(false);
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, 8000));
  void Promise.race([
    Promise.allSettled([...registry].map((controller) => controller.start(ctx))),
    timeout,
  ]).then(() => {
    if (current === ctx) setReady(true);
  });
}

/** Desliga e limpa tudo da memória (ao sair da conta). */
export function stopSync() {
  startedFor = null;
  current = null;
  registry.forEach((controller) => controller.stop());
  setReady(false);
}

/** Envia agora tudo o que ainda estava esperando (antes de chamar uma função do servidor que depende disso). */
export async function flushAll() {
  if (globalTimer) clearTimeout(globalTimer);
  await globalRunning;
  for (const controller of registry) await controller.flush();
}

/** Releitura geral (depois de uma função do servidor que mexe em várias tabelas). */
export const reloadAll = () =>
  Promise.allSettled([...registry].map((controller) => controller.reload()));

export function useSyncReady() {
  return useSyncExternalStore(
    (listener) => {
      readySubs.add(listener);
      return () => {
        readySubs.delete(listener);
      };
    },
    () => ready,
    () => false,
  );
}
