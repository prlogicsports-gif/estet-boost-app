import { useEffect, useRef, useState } from "react";

/** Duração da abertura (revelar a marca e sumir). O CSS usa o mesmo valor. */
const TOTAL_MS = 3800;

/**
 * Abertura do app: aparece toda vez que o app é aberto (carga completa da página), sem exceção.
 * O HTML do servidor já inclui a abertura, então ela começa a animar enquanto o JavaScript carrega.
 * Ela só sai quando a animação termina de verdade (lida do próprio navegador), nunca por um cronômetro
 * que corte no meio.
 */
export function Splash() {
  // Começa visível no servidor e no cliente para não haver diferença na hidratação.
  const [visible, setVisible] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const running = element
      .getAnimations()
      .filter((animation) => animation.playState !== "finished");
    // O JavaScript demorou tanto que a animação já acabou (e a abertura já está invisível).
    if (!running.length) {
      setVisible(false);
      return;
    }
    let alive = true;
    void Promise.allSettled(running.map((animation) => animation.finished)).then(() => {
      if (alive) setVisible(false);
    });
    const safety = window.setTimeout(() => setVisible(false), TOTAL_MS + 2000);
    return () => {
      alive = false;
      window.clearTimeout(safety);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      ref={ref}
      aria-hidden
      className="fixed inset-0 z-[200] grid place-items-center bg-background"
      style={{ animation: `splash-out ${TOTAL_MS}ms ease-in-out forwards` }}
    >
      <span className="inline-flex items-baseline whitespace-nowrap text-[44px] leading-none">
        <span
          className="inline-block overflow-hidden align-baseline font-light text-foreground"
          style={{ animation: "splash-estet 1200ms cubic-bezier(.16,1,.3,1) 350ms both" }}
        >
          Estet
        </span>
        <span
          className="inline-block overflow-hidden align-baseline font-medium text-primary"
          style={{ animation: "splash-boost 1200ms cubic-bezier(.16,1,.3,1) 1000ms both" }}
        >
          Boost
        </span>
        <span
          className="font-medium text-[var(--teal)]"
          style={{ animation: "fade-in 500ms ease-out 2100ms both" }}
        >
          .
        </span>
      </span>
    </div>
  );
}
