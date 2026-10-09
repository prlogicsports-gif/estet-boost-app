import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { LogOut, MoreHorizontal } from "lucide-react";

import { useSignOut } from "@/lib/use-sign-out";

import type { NavConfig } from "@/components/shell/nav-items";
import { cn } from "@/lib/utils";

const item =
  "relative flex min-h-11 min-w-11 flex-col items-center gap-[3px] rounded-[18px] px-3 pb-2 pt-1.5 text-[var(--text-secondary)] transition-colors";
const itemActive = "bg-[var(--eb-ivory-a10)] text-[var(--eb-nude-300)]";

/** Dock flutuante de vidro, centralizada. O item ativo leva o rótulo em nude e um ponto verde. */
export function MobileDock({ nav }: { nav: NavConfig }) {
  const { primary, secondary } = nav;
  const [open, setOpen] = useState(false);
  const signOut = useSignOut();
  const bottom = "calc(env(safe-area-inset-bottom) + 16px)";

  return (
    <>
      {open && secondary.length ? (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setOpen(false)}>
          <div
            className="absolute inset-0 bg-[rgba(20,14,17,.45)]"
            style={{ animation: "fade-in 200ms ease-out" }}
          />
          <div
            className="glass-dock absolute left-1/2 w-[min(320px,calc(100%-32px))] -translate-x-1/2 rounded-[var(--radius-xl)] p-2"
            style={{
              bottom: "calc(env(safe-area-inset-bottom) + 92px)",
              animation: "sheet-in 240ms cubic-bezier(.16,1,.3,1)",
            }}
            onClick={(event) => event.stopPropagation()}
          >
            {secondary.map((entry) => (
              <Link
                key={entry.to}
                to={entry.to}
                onClick={() => setOpen(false)}
                className="flex min-h-12 items-center gap-3 rounded-[var(--radius-md)] px-3 text-sm text-[var(--text-secondary)] hover:bg-[var(--accent)] hover:text-foreground"
                activeProps={{ className: "bg-[var(--eb-ivory-a10)] text-foreground" }}
              >
                <entry.icon className="size-[18px]" aria-hidden />
                {entry.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                void signOut();
              }}
              className="flex min-h-12 w-full items-center gap-3 rounded-[var(--radius-md)] px-3 text-sm text-[var(--eb-coral-500)] hover:bg-[var(--accent)]"
            >
              <LogOut className="size-[18px]" aria-hidden />
              Sair da conta
            </button>
          </div>
        </div>
      ) : null}

      <nav
        aria-label="Navegação principal"
        className="glass-dock fixed left-1/2 z-40 flex -translate-x-1/2 gap-0.5 rounded-[var(--radius-xl)] p-1.5 lg:hidden"
        style={{ bottom }}
      >
        {primary.map((entry) => (
          <Link
            key={entry.to}
            to={entry.to}
            activeOptions={{ exact: entry.to === "/cliente" }}
            className={item}
            activeProps={{ className: itemActive, "aria-current": "page" }}
          >
            {({ isActive }) => (
              <>
                <entry.icon className="size-5" strokeWidth={isActive ? 1.9 : 1.6} aria-hidden />
                <span className={cn("text-[10.5px] tracking-[0.01em]", isActive && "font-medium")}>
                  {entry.label}
                </span>
                {isActive ? (
                  <span className="absolute bottom-[3px] size-1 rounded-full bg-[var(--eb-teal-500)]" />
                ) : null}
              </>
            )}
          </Link>
        ))}
        {secondary.length ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className={cn(item, open && itemActive)}
          >
            <MoreHorizontal className="size-5" aria-hidden />
            <span className="text-[10.5px] tracking-[0.01em]">Mais</span>
          </button>
        ) : null}
      </nav>
    </>
  );
}
