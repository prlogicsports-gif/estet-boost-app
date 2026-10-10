/** Número no ícone do app instalado (Android e iPhone/iPad com o app na tela inicial). Sem suporte, não faz nada. */
type BadgeNav = Navigator & {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

export function setAppBadge(count: number) {
  if (typeof navigator === "undefined") return;
  const nav = navigator as BadgeNav;
  try {
    if (count > 0) void nav.setAppBadge?.(count)?.catch(() => {});
    else void nav.clearAppBadge?.()?.catch(() => {});
  } catch {
    /* sem suporte */
  }
}
