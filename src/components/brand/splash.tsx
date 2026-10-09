import { useEffect, useState } from "react";

const KEY = "eb-splash-seen";
/** Duração total da animação (revelar a marca + sumir). Mantida igual ao CSS abaixo. */
const TOTAL_MS = 2100;

/**
 * Abertura do app: aparece uma vez a cada vez que o app é aberto (a flag fica na sessão do
 * navegador, então fechar e abrir de novo mostra de novo). O HTML do servidor já inclui a
 * abertura, então ela começa a animar enquanto o JavaScript ainda carrega.
 */
export function Splash() {
  // Começa visível no servidor e no cliente para não haver diferença na hidratação.
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let seen = false;
    try {
      seen = window.sessionStorage.getItem(KEY) === "1";
      window.sessionStorage.setItem(KEY, "1");
    } catch {
      /* sem armazenamento: mostra normalmente */
    }
    if (seen) {
      setVisible(false);
      return;
    }
    // Se o JavaScript demorou, parte da animação já passou: espera só o que falta.
    const remaining = Math.max(0, TOTAL_MS - performance.now());
    const timer = window.setTimeout(() => setVisible(false), remaining);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      className="fixed inset-0 z-[200] grid place-items-center bg-background"
      style={{ animation: `splash-out ${TOTAL_MS}ms ease-in forwards` }}
    >
      <div className="flex flex-col items-center gap-4">
        <span className="inline-flex items-baseline whitespace-nowrap text-[44px] leading-none">
          <span
            className="inline-block overflow-hidden align-baseline font-light text-foreground"
            style={{ animation: "splash-estet 700ms cubic-bezier(.16,1,.3,1) 250ms both" }}
          >
            Estet
          </span>
          <span
            className="inline-block overflow-hidden align-baseline font-medium text-primary"
            style={{ animation: "splash-boost 700ms cubic-bezier(.16,1,.3,1) 550ms both" }}
          >
            Boost
          </span>
          <span
            className="font-medium text-[var(--teal)]"
            style={{ animation: "fade-in 300ms ease-out 1100ms both" }}
          >
            .
          </span>
        </span>
        <span
          className="text-[13px] tracking-[0.02em] text-muted-foreground"
          style={{ animation: "fade-in 500ms ease-out 900ms both" }}
        >
          Cuidado organizado. Negócio em evolução.
        </span>
      </div>
    </div>
  );
}
