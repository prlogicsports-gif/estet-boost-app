import { firebaseConfig, vapidKey } from "@/lib/firebase";
import { sessionStore } from "@/lib/session";
import { supabase } from "@/lib/supabase";

/**
 * Push no aparelho, mesmo com o app fechado: o aparelho se registra no Firebase Cloud Messaging, o token fica
 * em `push_tokens` (só a própria pessoa lê e grava) e o servidor envia (Edge Function `send-push`) a cada aviso novo.
 * O service worker `public/sw.js` mostra a notificação. No iPhone, o push só funciona com o app instalado na
 * tela inicial.
 */
export type PushStatus = "granted" | "denied" | "default" | "unsupported";

const TOKEN_KEY = "eb.push-token";

const supported = () =>
  typeof window !== "undefined" &&
  typeof Notification !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window;

export const pushStatus = (): PushStatus =>
  typeof Notification === "undefined" ? "unsupported" : Notification.permission;

/** O navegador consegue receber push (no iPhone, só depois de instalar o app na tela inicial). */
export const pushSupported = supported;

const platform = () =>
  /iphone|ipad/i.test(navigator.userAgent)
    ? "ios"
    : /android/i.test(navigator.userAgent)
      ? "android"
      : "web";

/** Obtém o token do aparelho e grava no servidor. Seguro para repetir (renova o token quando preciso). */
export async function syncPushToken(): Promise<boolean> {
  const auth = sessionStore.get();
  if (!supported() || Notification.permission !== "granted" || auth.status !== "in") return false;
  try {
    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    const [{ initializeApp, getApps }, { getMessaging, getToken }] = await Promise.all([
      import("firebase/app"),
      import("firebase/messaging"),
    ]);
    const app = getApps()[0] ?? initializeApp(firebaseConfig);
    const token = await getToken(getMessaging(app), {
      vapidKey,
      serviceWorkerRegistration: registration,
    });
    if (!token) return false;
    const { error } = await supabase
      .from("push_tokens")
      .upsert({ user_id: auth.session.uid, token, platform: platform() }, { onConflict: "token" });
    if (error) return false;
    try {
      window.localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* ignorado */
    }
    return true;
  } catch {
    return false;
  }
}

/** Pede permissão ao navegador e registra o aparelho. Retorna o estado final. */
export async function registerPush(): Promise<PushStatus> {
  if (typeof Notification === "undefined") return "unsupported";
  if (Notification.permission === "default") {
    try {
      await Notification.requestPermission();
    } catch {
      /* navegador antigo ou bloqueio */
    }
  }
  if (Notification.permission === "granted") await syncPushToken();
  return pushStatus();
}

/** Tira este aparelho da lista de envio (ao sair da conta ou desligar o push). */
export async function unregisterPush() {
  let token: string | null = null;
  try {
    token = window.localStorage.getItem(TOKEN_KEY);
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignorado */
  }
  if (!token) return;
  await supabase.from("push_tokens").delete().eq("token", token);
}
