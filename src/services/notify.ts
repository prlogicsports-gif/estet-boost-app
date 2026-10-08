import { notificationsDb, prefsDb } from "@/data/db";
import type { Audience, NotificationRec } from "@/lib/models";
import { showPush } from "@/services/push.service";

export type NotificationDraft = Omit<NotificationRec, "id" | "createdAt" | "read"> & {
  createdAt?: string;
};
type Draft = NotificationDraft;

/** Cria uma notificação. Com `ruleKey`, não repete a mesma (as regras automáticas rodam o tempo todo). */
export function notify(draft: Draft): NotificationRec | null {
  const current = notificationsDb.get();
  if (draft.ruleKey && current.some((item) => item.ruleKey === draft.ruleKey)) return null;
  const rec: NotificationRec = {
    ...draft,
    id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: draft.createdAt ?? new Date().toISOString(),
    read: false,
  };
  notificationsDb.set([rec, ...current]);
  const prefs = prefsDb.get()[draft.audience];
  if (prefs?.push !== false) showPush(rec);
  return rec;
}

const mine = (item: NotificationRec, audience: Audience, clientId?: string) =>
  item.audience === audience && (audience === "gestor" || !clientId || item.clientId === clientId);

export function markRead(id: string) {
  notificationsDb.set((list) =>
    list.map((item) => (item.id === id ? { ...item, read: true } : item)),
  );
}

export function markAllRead(audience: Audience, clientId?: string) {
  notificationsDb.set((list) =>
    list.map((item) => (mine(item, audience, clientId) ? { ...item, read: true } : item)),
  );
}

export const notificationsFor = (list: NotificationRec[], audience: Audience, clientId?: string) =>
  list
    .filter((item) => mine(item, audience, clientId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

export function setPrefs(
  audience: Audience,
  next: Partial<ReturnType<typeof prefsDb.get>[string]>,
) {
  prefsDb.set((all) => ({
    ...all,
    [audience]: { ...(all[audience] as NonNullable<(typeof all)[string]>), ...next },
  }));
}
