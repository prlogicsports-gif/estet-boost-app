import { sessionStore } from "@/lib/session";
import type { NotificationRec } from "@/lib/models";

/**
 * Push no aparelho. Hoje usa a API de notificações do navegador, só com o app aberto.
 * Quando o Firebase entrar, `registerPush` passa a registrar o token do FCM no usuário
 * e o envio sai das Cloud Functions: veja docs/NOTIFICACOES-FIREBASE.md.
 */
export type PushStatus = "granted" | "denied" | "default" | "unsupported";

export const pushStatus = (): PushStatus =>
  typeof Notification === "undefined" ? "unsupported" : Notification.permission;

/** Pede permissão ao navegador. Retorna o estado final. */
export async function registerPush(): Promise<PushStatus> {
  if (typeof Notification === "undefined") return "unsupported";
  if (Notification.permission === "default") {
    try {
      await Notification.requestPermission();
    } catch {
      /* navegador antigo ou bloqueio */
    }
  }
  return pushStatus();
}

/** Mostra a notificação no aparelho, se a pessoa liberou e ela é do perfil que está logado. */
export function showPush(rec: NotificationRec) {
  if (pushStatus() !== "granted") return;
  const auth = sessionStore.get();
  if (auth.status !== "in") return;
  const session = auth.session;
  if ((session.role === "cliente" ? "cliente" : "gestor") !== rec.audience) return;
  if (
    rec.audience === "cliente" &&
    session.clientId &&
    rec.clientId &&
    rec.clientId !== session.clientId
  )
    return;
  try {
    new Notification(rec.title, { body: rec.body, tag: rec.id, icon: "/favicon.svg" });
  } catch {
    /* alguns navegadores móveis só aceitam via service worker */
  }
}
