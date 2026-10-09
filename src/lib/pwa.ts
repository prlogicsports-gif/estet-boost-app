import { useEffect, useState } from "react";

/**
 * App instalável (PWA): registra o service worker (que faz o app abrir sem internet) e ajuda a instalar na tela
 * inicial. No Android e no computador o navegador oferece a instalação; no iPhone/iPad é preciso Compartilhar →
 * Adicionar à Tela de Início (e só depois disso o push funciona).
 */
export async function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    /* sem service worker o app continua funcionando online */
  }
}

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault(); // guarda para mostrar o botão "Instalar" quando a pessoa quiser
    deferred = event as InstallEvent;
    listeners.forEach((listener) => listener());
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    listeners.forEach((listener) => listener());
  });
}

export const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true);

export const isIOS = () =>
  typeof navigator !== "undefined" &&
  (/iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

export type InstallState = {
  standalone: boolean;
  ios: boolean;
  canPrompt: boolean;
  install: () => Promise<void>;
};

export function useInstall(): InstallState {
  const [, bump] = useState(0);
  useEffect(() => {
    const listener = () => bump((value) => value + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return {
    standalone: isStandalone(),
    ios: isIOS(),
    canPrompt: Boolean(deferred),
    install: async () => {
      if (!deferred) return;
      await deferred.prompt();
      await deferred.userChoice.catch(() => undefined);
      deferred = null;
      bump((value) => value + 1);
    },
  };
}
