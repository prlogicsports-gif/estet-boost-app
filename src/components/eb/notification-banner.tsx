import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/eb/icon";
import { NOTIFICATION_KINDS } from "@/components/eb/notification-center";
import { prefsDb } from "@/data/db";
import type { Audience, NotificationRec } from "@/lib/models";
import { kindLabel, prefKeyOf } from "@/lib/notification-labels";
import { markRead } from "@/services/notify";

const SHOW_MS = 6000;

/**
 * Banner que desce do topo quando chega um aviso com o app aberto (como nos apps de mensagem): ícone do tipo,
 * título e texto; toque abre a tela do aviso, arrastar para cima dispensa. Vibra no aparelho que permite
 * (Android; o iPhone não deixa páginas vibrarem). Respeita as preferências de Configurações → Avisos.
 */
export function NotificationBanner({
  audience,
  onOpen,
}: {
  audience: Audience;
  onOpen: (href: string) => void;
}) {
  const [item, setItem] = useState<NotificationRec | null>(null);
  const [drag, setDrag] = useState(0);
  const prefs = prefsDb.use();
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const start = useRef<number | null>(null);

  useEffect(() => {
    const onNew = (event: Event) => {
      const rec = (event as CustomEvent<NotificationRec>).detail;
      if (!rec || document.visibilityState !== "visible") return;
      const mine = prefsRef.current[audience];
      if (mine && mine[prefKeyOf(rec.kind)] === false) return;
      setDrag(0);
      setItem(rec);
      try {
        navigator.vibrate?.([120, 60, 120]);
      } catch {
        /* sem suporte */
      }
    };
    window.addEventListener("eb:notification", onNew);
    return () => window.removeEventListener("eb:notification", onNew);
  }, [audience]);

  useEffect(() => {
    if (!item) return;
    const timer = window.setTimeout(() => setItem(null), SHOW_MS);
    return () => window.clearTimeout(timer);
  }, [item]);

  if (!item) return null;
  const kind = NOTIFICATION_KINDS[item.kind] ?? NOTIFICATION_KINDS.reminder;
  const open = () => {
    markRead(item.id);
    setItem(null);
    if (item.href) onOpen(item.href);
  };

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[110] flex justify-center px-3"
      style={{ top: "calc(env(safe-area-inset-top) + 8px)" }}
      role="status"
      aria-live="polite"
    >
      <div
        onPointerDown={(event) => {
          start.current = event.clientY;
        }}
        onPointerMove={(event) => {
          if (start.current === null) return;
          setDrag(Math.min(0, event.clientY - start.current));
        }}
        onPointerUp={() => {
          const moved = drag;
          start.current = null;
          if (moved < -36) setItem(null);
          else setDrag(0);
        }}
        onPointerCancel={() => {
          start.current = null;
          setDrag(0);
        }}
        className="pointer-events-auto w-full max-w-[420px] touch-none"
        style={{
          transform: drag ? `translateY(${drag}px)` : undefined,
          animation: drag ? undefined : "banner-in 360ms cubic-bezier(.16,1,.3,1)",
        }}
      >
        <button
          type="button"
          onClick={open}
          className="flex w-full items-start gap-3 rounded-[22px] border border-[var(--glass-border)] bg-[var(--glass-bg-strong)] p-3.5 text-left backdrop-blur-[22px]"
          style={{ boxShadow: "var(--glass-shadow), var(--glass-highlight)" }}
        >
          <span
            className="grid size-11 flex-none place-items-center rounded-[14px]"
            style={{
              color: kind.fg,
              background: `color-mix(in srgb, ${kind.fg} 18%, transparent)`,
            }}
          >
            <Icon name={kind.icon} size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span
                className="text-[10.5px] font-semibold uppercase leading-none tracking-[0.12em]"
                style={{ color: kind.fg }}
              >
                {kindLabel(item.kind, audience)}
              </span>
              <span className="text-[10.5px] leading-none text-muted-foreground">agora</span>
            </span>
            <span className="mt-1 block text-[14.5px] font-semibold leading-[1.3]">
              {item.title}
            </span>
            {item.body ? (
              <span className="mt-0.5 line-clamp-2 block text-[13px] leading-[1.4] text-[var(--text-secondary)]">
                {item.body}
              </span>
            ) : null}
          </span>
        </button>
      </div>
    </div>
  );
}
