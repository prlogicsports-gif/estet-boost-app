import { notificationsDb, prefsDb } from "@/data/db";
import type { Audience, NotificationRec } from "@/lib/models";
import { supabase } from "@/lib/supabase";

export type NotificationDraft = Omit<NotificationRec, "id" | "createdAt" | "read"> & {
  createdAt?: string;
};
type Draft = NotificationDraft;

/** Qual permissão da equipe recebe cada tipo de aviso (a gestora recebe todos). */
const PERMISSION_OF_KIND: Record<string, string> = {
  request: "agenda",
  reschedule: "agenda",
  confirmed: "agenda",
  reminder: "agenda",
  followup: "clientes",
  recommendation: "clientes",
  stock: "estoque",
  bill: "financeiro",
  payment: "financeiro",
};

const sent = new Set<string>();

/**
 * Pede ao servidor para criar o aviso: cada destinatário recebe o seu (a equipe conforme as permissões, ou a cliente).
 * Com `ruleKey`, o servidor não repete o mesmo aviso (as regras automáticas rodam o tempo todo).
 */
export function notify(draft: Draft): void {
  if (draft.ruleKey) {
    if (sent.has(draft.ruleKey)) return;
    sent.add(draft.ruleKey);
  }
  void supabase
    .rpc("push_notification", {
      p_audience: draft.audience === "gestor" ? "equipe" : "cliente",
      p_client_id: draft.clientId ?? null,
      p_kind: draft.kind,
      p_title: draft.title,
      p_body: draft.body,
      p_href: draft.href ?? null,
      p_rule: draft.ruleKey ?? null,
      p_perm: draft.audience === "gestor" ? (PERMISSION_OF_KIND[draft.kind] ?? "agenda") : null,
    })
    .then(() => {});
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
