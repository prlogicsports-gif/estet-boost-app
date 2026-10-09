import { useSyncExternalStore } from "react";

import type { PermissionKey, Session } from "@/lib/auth.types";
import { backoff, classifyError, humanError, isRetryable, type ErrorClass } from "@/lib/errors";
import { idbClear, idbDelete, idbGet, idbKeys, idbSet } from "@/lib/idb";
import { can } from "@/lib/permissions";
import { supabase } from "@/lib/supabase";

/**
 * Armazenamento compartilhado, com modo sem internet. Cada coleção do app é uma tabela do Supabase.
 *
 * Leitura: ao abrir, mostra na hora a cópia guardada no aparelho (IndexedDB) e atualiza pelo servidor
 * (consulta, tempo real e releitura a cada 30 s). Sem internet, o app abre e funciona com a cópia.
 *
 * Escrita: a tela muda na hora e a alteração entra numa FILA guardada no aparelho (sobrevive a fechar o app).
 * A fila é enviada em ordem, sozinha, quando há internet. Cada falha cai numa classe (src/lib/errors.ts)
 * com um comportamento só: rede/sessão/servidor ficam na fila e tentam de novo; permissão, conflito e dado
 * inválido saem da fila, voltam ao que está no servidor e vão para "Pendências" com o motivo.
 * Quem protege os dados é o RLS do banco; aqui só se monta a consulta.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = any;
export type SyncCtx = { session: Session; can: (permission: PermissionKey) => boolean };

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
  /** Nome legível do registro, para a tela de Pendências. */
  label?: (rec: T) => string;
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

// ---------------------------------------------------------------- fila de alterações
type Item = {
  seq: number;
  kind: "save" | "remove" | "rpc" | "upload";
  store?: string;
  id?: string;
  rec?: unknown;
  prev?: unknown;
  name?: string;
  args?: unknown;
  blobKey?: string;
  path?: string;
  label: string;
  /** Avisos e histórico: se o servidor recusar, some sem incomodar. */
  quiet?: boolean;
  attempts: number;
  nextAt: number;
  created: string;
  /** Último motivo de falha (para a tela de pendências). */
  last?: string;
};
export type FailedItem = { item: Item; kind: ErrorClass; message: string; at: string };

export type RpcOutcome =
  | { status: "done"; data: unknown }
  | { status: "queued" }
  | { status: "rejected"; kind: ErrorClass; message: string };

type Outcome =
  { ok: true; data?: unknown } | { ok: false; kind: ErrorClass; message: string; data?: unknown };

interface Controller {
  key: string;
  start: (ctx: SyncCtx) => Promise<void>;
  stop: () => void;
  reload: () => Promise<void>;
  perform: (item: Item, ctx: SyncCtx) => Promise<void>;
  apply: (item: Item) => void;
  flagStale: () => void;
  /** Se havia algo para reler e a fila desta coleção esvaziou, relê agora. */
  settle: () => void;
}

const registry = new Map<string, Controller>();
let current: SyncCtx | null = null;
let startedFor: string | null = null;
let ready = false;

let outbox: Item[] = [];
let failed: FailedItem[] = [];
let seq = 1;
let networkDown = false;
let authExpired = false;
let syncing = false;
let draining: Promise<void> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let drainTimer: ReturnType<typeof setTimeout> | undefined;
const waiters = new Map<number, (outcome: RpcOutcome) => void>();
const inflight = new Set<number>();

const statusSubs = new Set<() => void>();
const readySubs = new Set<() => void>();

export type SyncStatus = {
  online: boolean;
  syncing: boolean;
  pending: number;
  failed: number;
  authExpired: boolean;
};
let statusSnapshot: SyncStatus = {
  online: true,
  syncing: false,
  pending: 0,
  failed: 0,
  authExpired: false,
};

const browserOnline = () => typeof navigator === "undefined" || navigator.onLine !== false;
const isOnline = () => browserOnline() && !networkDown;

function publish() {
  const next: SyncStatus = {
    online: isOnline(),
    syncing,
    pending: outbox.filter((item) => !item.quiet).length,
    failed: failed.length,
    authExpired,
  };
  if (JSON.stringify(next) === JSON.stringify(statusSnapshot)) return;
  statusSnapshot = next;
  statusSubs.forEach((listener) => listener());
}

const setReady = (value: boolean) => {
  ready = value;
  readySubs.forEach((listener) => listener());
};

export function reportSyncError(message: string) {
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent("eb:sync-error", { detail: message }));
}

const outboxKey = (uid: string) => `outbox:${uid}`;
const persistOutbox = () => {
  if (!current) return;
  void idbSet(outboxKey(current.session.uid), { outbox, failed, seq });
};

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

function enqueue(item: Omit<Item, "seq" | "attempts" | "nextAt" | "created">): Item {
  // Alterações seguidas no mesmo registro viram uma só (o rascunho do atendimento salva a cada letra).
  if ((item.kind === "save" || item.kind === "remove") && item.store && item.id) {
    const index = outbox.findIndex(
      (other) =>
        other.store === item.store &&
        other.id === item.id &&
        (other.kind === "save" || other.kind === "remove") &&
        !inflight.has(other.seq),
    );
    const old = index >= 0 ? outbox[index] : undefined;
    if (old) {
      if (old.kind === "save" && old.prev === undefined && item.kind === "remove") {
        outbox.splice(index, 1); // criado e apagado antes de chegar ao servidor: nunca existiu
        persistOutbox();
        publish();
        return old;
      }
      const merged: Item = {
        ...old,
        kind: item.kind,
        rec: item.rec,
        label: item.label,
        ...(item.kind === "remove" ? { prev: old.prev ?? item.prev } : {}),
        attempts: 0,
        nextAt: 0,
      };
      outbox[index] = merged;
      persistOutbox();
      publish();
      return merged;
    }
  }
  const created: Item = {
    ...item,
    seq: seq++,
    attempts: 0,
    nextAt: 0,
    created: new Date().toISOString(),
  };
  outbox.push(created);
  persistOutbox();
  publish();
  return created;
}

const hasPending = (store: string) => outbox.some((item) => item.store === store);

/** Sem resposta em 25 s conta como falha de rede: uma conexão pendurada não pode travar a fila. */
function performWithTimeout(item: Item): Promise<Outcome> {
  return new Promise<Outcome>((resolve) => {
    const timer = setTimeout(
      () => resolve({ ok: false, kind: "rede", message: humanError("rede") }),
      25000,
    );
    void perform(item).then((outcome) => {
      clearTimeout(timer);
      resolve(outcome);
    });
  });
}

async function perform(item: Item): Promise<Outcome> {
  const ctx = current;
  if (!ctx) return { ok: false, kind: "sessao", message: humanError("sessao") };
  try {
    if (item.kind === "rpc") {
      const { data, error } = await supabase.rpc(
        item.name ?? "",
        (item.args ?? {}) as Record<string, unknown>,
      );
      if (error) throw error;
      return { ok: true, data };
    }
    if (item.kind === "upload") {
      const blob = await idbGet<Blob>(`blob:${ctx.session.uid}:${item.blobKey}`);
      if (blob) {
        const { error } = await supabase.storage
          .from("photos")
          .upload(item.path ?? "", blob, { contentType: "image/jpeg", upsert: true });
        if (error) throw error;
        await idbDelete(`blob:${ctx.session.uid}:${item.blobKey}`);
      }
      return { ok: true };
    }
    const controller = registry.get(item.store ?? "");
    if (!controller) return { ok: true };
    await controller.perform(item, ctx);
    return { ok: true };
  } catch (error) {
    const kind = classifyError(error);
    return { ok: false, kind, message: humanError(kind) };
  }
}

function resolveWaiter(item: Item, outcome: RpcOutcome) {
  const waiter = waiters.get(item.seq);
  if (waiter) {
    waiters.delete(item.seq);
    waiter(outcome);
  }
}

function park(item: Item, result: Extract<Outcome, { ok: false }>) {
  outbox = outbox.filter((other) => other.seq !== item.seq);
  resolveWaiter(item, { status: "rejected", kind: result.kind, message: result.message });
  if (!item.quiet) {
    failed = [
      { item, kind: result.kind, message: result.message, at: new Date().toISOString() },
      ...failed,
    ].slice(0, 50);
    reportSyncError(result.message);
  }
  if (item.store) registry.get(item.store)?.flagStale();
  persistOutbox();
}

async function refreshSession(): Promise<boolean> {
  try {
    const { data, error } = await supabase.auth.refreshSession();
    return !error && Boolean(data.session);
  } catch {
    return false;
  }
}

async function runDrain(): Promise<void> {
  if (!current) return;
  syncing = true;
  publish();
  let refreshedOnce = false;
  try {
    while (outbox.length) {
      const item = outbox[0]!;
      if (item.nextAt > Date.now()) break; // o primeiro da fila espera: a ordem é preservada
      if (!browserOnline()) {
        networkDown = true;
        break;
      }
      inflight.add(item.seq);
      const result = await performWithTimeout(item);
      inflight.delete(item.seq);
      // o item pode ter sido trocado por uma versão mais nova enquanto enviava
      const live = outbox.find((other) => other.seq === item.seq);
      if (result.ok) {
        networkDown = false;
        authExpired = false;
        if (live && same(live.rec, item.rec) && live.kind === item.kind)
          outbox = outbox.filter((other) => other.seq !== item.seq);
        else if (live) live.attempts = 0;
        resolveWaiter(item, { status: "done", data: (result as { data?: unknown }).data });
        if (item.store) registry.get(item.store)?.flagStale();
        persistOutbox();
        continue;
      }
      if (result.kind === "rede") {
        (live ?? item).last = result.message;
        networkDown = true;
        scheduleRetry(backoff(1));
        break;
      }
      if (result.kind === "sessao") {
        if (!refreshedOnce && (await refreshSession())) {
          refreshedOnce = true;
          continue;
        }
        authExpired = true;
        break;
      }
      if (isRetryable(result.kind)) {
        const target = live ?? item;
        target.attempts += 1;
        target.last = result.message;
        if (target.attempts >= 5) {
          park(target, result);
          continue;
        }
        target.nextAt = Date.now() + backoff(target.attempts);
        persistOutbox();
        scheduleRetry(backoff(target.attempts));
        break;
      }
      park(live ?? item, result);
    }
  } finally {
    syncing = false;
    // quem aguardava uma função do servidor e continua na fila: avisa que ficou guardado
    for (const item of outbox) resolveWaiter(item, { status: "queued" });
    for (const controller of registry.values()) controller.settle();
    persistOutbox();
    publish();
  }
}

function drain(): Promise<void> {
  // Se já está enviando, espera terminar e faz mais uma passada (pode ter entrado coisa nova na fila).
  if (draining) return draining.then(() => drain());
  draining = runDrain().finally(() => {
    draining = null;
  });
  return draining;
}

function scheduleRetry(ms: number) {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = setTimeout(() => void drain(), ms);
}

function scheduleDrain() {
  if (drainTimer) clearTimeout(drainTimer);
  drainTimer = setTimeout(() => void drain(), 250);
}

/** Chama uma função do servidor. Sem internet, fica na fila (em ordem com as demais alterações) e executa ao reconectar. */
export function runRpc(
  name: string,
  args: Record<string, unknown>,
  options: { label: string; quiet?: boolean },
): Promise<RpcOutcome> {
  if (!current)
    return Promise.resolve({ status: "rejected", kind: "sessao", message: humanError("sessao") });
  const item = enqueue({
    kind: "rpc",
    name,
    args,
    label: options.label,
    ...(options.quiet ? { quiet: true } : {}),
  });
  return new Promise<RpcOutcome>((resolve) => {
    waiters.set(item.seq, resolve);
    if (drainTimer) clearTimeout(drainTimer);
    void drain();
  });
}

/** Envia uma foto ainda não enviada (guardada no aparelho até haver internet). */
export async function queueUpload(path: string, blob: Blob, label: string) {
  if (!current) return;
  const blobKey = path.replace(/\W+/g, "_");
  await idbSet(`blob:${current.session.uid}:${blobKey}`, blob);
  enqueue({ kind: "upload", path, blobKey, label });
  if (drainTimer) clearTimeout(drainTimer);
  void drain();
}

/** Foto que está esperando para subir (para mostrar já, mesmo sem internet). */
export async function pendingBlob(path: string): Promise<Blob | undefined> {
  if (!current || !outbox.some((item) => item.kind === "upload" && item.path === path))
    return undefined;
  return idbGet<Blob>(`blob:${current.session.uid}:${path.replace(/\W+/g, "_")}`);
}

/** Envia agora tudo o que está na fila (antes de uma ação que depende disso). */
export async function flushAll() {
  if (drainTimer) clearTimeout(drainTimer);
  await drain();
}

/** Relê todas as coleções do servidor. */
export const reloadAll = () =>
  Promise.allSettled([...registry.values()].map((controller) => controller.reload()));

// ---------------------------------------------------------------- pendências (o que não foi aceito)
export function retryFailed(seqNumber: number) {
  const found = failed.find((entry) => entry.item.seq === seqNumber);
  if (!found) return;
  failed = failed.filter((entry) => entry.item.seq !== seqNumber);
  const item = { ...found.item, attempts: 0, nextAt: 0 };
  if (item.store) registry.get(item.store)?.apply(item);
  outbox.push(item);
  outbox.sort((a, b) => a.seq - b.seq);
  persistOutbox();
  publish();
  void drain();
}

export function discardFailed(seqNumber: number) {
  failed = failed.filter((entry) => entry.item.seq !== seqNumber);
  persistOutbox();
  publish();
}

export const pendingCount = () => outbox.filter((item) => !item.quiet).length;
export const pendingItems = () =>
  outbox.map((item) => ({
    seq: item.seq,
    label: item.label,
    attempts: item.attempts,
    last: item.last ?? "",
  }));
export const failedItems = () => failed;

let listSnapshot = {
  pending: [] as { seq: number; label: string; attempts: number; last: string }[],
  failed: [] as FailedItem[],
};
function refreshList() {
  listSnapshot = { pending: pendingItems(), failed: failed.slice() };
}

// ---------------------------------------------------------------- coleção
export function createRemoteStore<T>(config: RemoteConfig<T>, initial: T[] = []): RemoteStore<T> {
  const idOf = config.idOf ?? ((rec: T) => (rec as unknown as { id: string }).id);
  let cache: T[] = initial;
  const subs = new Set<() => void>();
  let reloadTimer: ReturnType<typeof setTimeout> | undefined;
  let pollTimer: ReturnType<typeof setInterval> | undefined;
  let snapTimer: ReturnType<typeof setTimeout> | undefined;
  let channels: ReturnType<typeof supabase.channel>[] = [];
  let stale = false;

  const emit = () => subs.forEach((listener) => listener());
  const snapKey = () => (current ? `snap:${current.session.uid}:${config.key}` : null);

  const persistSnapshot = () => {
    if (snapTimer) clearTimeout(snapTimer);
    snapTimer = setTimeout(() => {
      const key = snapKey();
      if (key) void idbSet(key, { at: new Date().toISOString(), data: cache });
    }, 600);
  };

  async function load() {
    const ctx = current;
    if (!ctx) return;
    if (hasPending(config.key) || !browserOnline()) {
      stale = true; // há alterações a caminho (ou não há internet): relê quando terminar
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
      networkDown = false;
      stale = false;
      if (hasPending(config.key) || current !== ctx) return;
      const prev = cache;
      cache = next;
      emit();
      persistSnapshot();
      publish();
      config.onLoaded?.(prev, next, ctx);
    } catch (error) {
      if (classifyError(error) === "rede") {
        networkDown = true;
        publish();
      }
      /* sem conexão ou sem permissão: mantém a cópia que já está na tela */
    }
  }

  const scheduleReload = () => {
    if (reloadTimer) clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => void load(), 300);
  };

  function set(next: T[] | ((list: T[]) => T[])) {
    const prev = cache;
    const value = typeof next === "function" ? (next as (list: T[]) => T[])(prev) : next;
    cache = value;
    emit();
    persistSnapshot();
    if (!config.save && !config.remove) return;
    const before = new Map(prev.map((rec) => [idOf(rec), rec]));
    const seen = new Set<string>();
    const name = (rec: T) => config.label?.(rec) ?? `${config.key}`;
    for (const rec of value) {
      const id = idOf(rec);
      seen.add(id);
      const old = before.get(id);
      if (!old)
        enqueue({ kind: "save", store: config.key, id, rec, prev: undefined, label: name(rec) });
      else if (old !== rec && !same(old, rec))
        enqueue({ kind: "save", store: config.key, id, rec, prev: old, label: name(rec) });
    }
    for (const [id, old] of before)
      if (!seen.has(id))
        enqueue({ kind: "remove", store: config.key, id, rec: old, prev: old, label: name(old) });
    scheduleDrain();
  }

  const controller: Controller = {
    key: config.key,
    async start(ctx) {
      current = ctx;
      // 1) mostra na hora a cópia guardada no aparelho
      const key = snapKey();
      const snapshot = key ? await idbGet<{ data: T[] }>(key) : undefined;
      const restored = Boolean(snapshot && Array.isArray(snapshot.data));
      if (restored) {
        cache = snapshot!.data;
        emit();
      }
      // alterações que ainda estão na fila (a cópia pode ter sido gravada antes delas) voltam para a tela
      for (const item of outbox)
        if (item.store === config.key && (item.kind === "save" || item.kind === "remove"))
          controller.apply(item);
      // 2) atualiza pelo servidor (em segundo plano quando já havia cópia)
      const fresh = load();
      if (!restored) await fresh;
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
      if (snapTimer) {
        clearTimeout(snapTimer);
        const key = snapKey();
        if (key) void idbSet(key, { at: new Date().toISOString(), data: cache });
      }
      channels.forEach((channel) => void supabase.removeChannel(channel));
      channels = [];
      cache = initial;
      emit();
    },
    reload: load,
    async perform(item, ctx) {
      if (item.kind === "remove") await config.remove?.(item.rec as T, ctx);
      else await config.save?.(item.rec as T, item.prev as T | undefined, ctx);
    },
    apply(item) {
      const rec = item.rec as T;
      const id = idOf(rec);
      cache =
        item.kind === "remove"
          ? cache.filter((other) => idOf(other) !== id)
          : cache.some((other) => idOf(other) === id)
            ? cache.map((other) => (idOf(other) === id ? rec : other))
            : [...cache, rec];
      emit();
      persistSnapshot();
    },
    flagStale() {
      stale = true;
      scheduleReload();
    },
    settle() {
      if (stale && !hasPending(config.key)) void load();
    },
  };

  registry.set(config.key, controller);
  if (current) void controller.start(current);

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
      label: () => config.key,
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

// ---------------------------------------------------------------- ligar e desligar
/** Apaga do aparelho a cópia dos dados, a fila e as fotos pendentes de outras pessoas (privacidade). */
async function purgeOthers(uid: string) {
  for (const key of await idbKeys()) {
    const mine =
      key.startsWith(`snap:${uid}:`) ||
      key.startsWith(`outbox:${uid}`) ||
      key.startsWith(`blob:${uid}:`);
    if (!mine && /^(snap|outbox|blob):/.test(key)) await idbDelete(key);
  }
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
  void (async () => {
    await purgeOthers(session.uid);
    const saved = await idbGet<{ outbox: Item[]; failed: FailedItem[]; seq: number }>(
      outboxKey(session.uid),
    );
    if (current !== ctx) return;
    outbox = saved?.outbox ?? [];
    failed = saved?.failed ?? [];
    seq = Math.max(saved?.seq ?? 1, ...outbox.map((item) => item.seq + 1), 1);
    refreshList();
    publish();
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, 8000));
    await Promise.race([
      Promise.allSettled([...registry.values()].map((controller) => controller.start(ctx))),
      timeout,
    ]);
    if (current === ctx) {
      setReady(true);
      void drain(); // alterações que ficaram pendentes da última vez
    }
  })();
}

/** Desliga e limpa da memória (ao sair da conta). A fila só é apagada por `wipeOfflineData`. */
export function stopSync() {
  startedFor = null;
  current = null;
  outbox = [];
  failed = [];
  networkDown = false;
  authExpired = false;
  registry.forEach((controller) => controller.stop());
  setReady(false);
  refreshList();
  publish();
}

/** Ao sair de propósito: apaga a cópia local desta pessoa (dados de saúde não ficam no aparelho). */
export async function wipeOfflineData(uid: string) {
  await idbClear(`snap:${uid}:`);
  await idbClear(`outbox:${uid}`);
  await idbClear(`blob:${uid}:`);
}

// ---------------------------------------------------------------- reconexão
if (typeof window !== "undefined" && typeof document !== "undefined") {
  const wake = () => {
    networkDown = false;
    publish();
    void drain().then(() =>
      [...registry.values()].forEach((controller) => void controller.reload()),
    );
  };
  window.addEventListener("online", wake);
  window.addEventListener("offline", () => {
    networkDown = true;
    publish();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void drain();
  });
  setInterval(() => {
    if (outbox.length && !draining) void drain();
    refreshList();
  }, 30000);
}

// ---------------------------------------------------------------- ganchos de tela
export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (listener) => {
      statusSubs.add(listener);
      return () => {
        statusSubs.delete(listener);
      };
    },
    () => statusSnapshot,
    () => statusSnapshot,
  );
}

const listSubs = new Set<() => void>();
statusSubs.add(() => {
  refreshList();
  listSubs.forEach((listener) => listener());
});

/** Itens aguardando envio e itens que o servidor não aceitou (tela de Pendências). */
export function useSyncLists() {
  return useSyncExternalStore(
    (listener) => {
      listSubs.add(listener);
      return () => {
        listSubs.delete(listener);
      };
    },
    () => listSnapshot,
    () => listSnapshot,
  );
}

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
