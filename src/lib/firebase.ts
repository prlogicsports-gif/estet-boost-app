/**
 * Firebase SÓ para o push (Cloud Messaging). Banco, login e arquivos são do Supabase.
 * Tudo aqui é configuração PÚBLICA do app web (não dá acesso a nada sozinha); a chave privada da conta de
 * serviço fica apenas nas secrets da função `send-push` no Supabase. Analytics não é usado de propósito.
 */
const env = import.meta.env as Record<string, string | undefined>;

export const firebaseConfig = {
  apiKey: env["VITE_FIREBASE_API_KEY"] ?? "AIzaSyAQgbP_krnQ-E_dZbH3fGVAGS5S-Guj6e0",
  authDomain: env["VITE_FIREBASE_AUTH_DOMAIN"] ?? "estetboost.firebaseapp.com",
  projectId: env["VITE_FIREBASE_PROJECT_ID"] ?? "estetboost",
  messagingSenderId: env["VITE_FIREBASE_MESSAGING_SENDER_ID"] ?? "985145183641",
  appId: env["VITE_FIREBASE_APP_ID"] ?? "1:985145183641:web:fed4ed2bd107a9c22b1708",
};

/** Chave pública do push web (VAPID). */
export const vapidKey =
  env["VITE_FIREBASE_VAPID_KEY"] ??
  "BG9pv6kFIipZuw-bcVso__sX-j9fxqD1A6iXvmIGzn2JQMIJQg0ABxFhAbcTCLeNq5mHY4XvukFn0CwGeejc0yg";
