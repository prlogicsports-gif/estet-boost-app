import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { MoreHorizontal } from "lucide-react";

import { primaryItems, secondaryItems } from "@/components/shell/nav-items";

export function MobileDock() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-background/60" />
          <div
            className="absolute inset-x-4 rounded-[var(--radius-xl)] p-2 glass-panel"
            style={{ bottom: "calc(env(safe-area-inset-bottom) + 6.25rem)" }}
            onClick={(event) => event.stopPropagation()}
          >
            {secondaryItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="flex min-h-11 items-center gap-3 rounded-[var(--radius-md)] px-3 text-sm text-muted-foreground hover:bg-[var(--accent)] hover:text-foreground"
                activeProps={{ className: "bg-[var(--accent)] text-foreground" }}
              >
                <item.icon className="size-4" aria-hidden />
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <nav
        className="fixed inset-x-4 z-40 flex items-center justify-between gap-1 rounded-[var(--radius-xl)] p-2 glass-panel lg:hidden"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
        aria-label="Navegação principal"
      >
        {primaryItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="flex min-h-11 flex-1 flex-col items-center justify-center gap-1 rounded-[var(--radius-md)] px-1 py-1.5 text-[11px] text-muted-foreground"
            activeProps={{ className: "bg-[var(--accent)] text-foreground" }}
          >
            <item.icon className="size-4" aria-hidden />
            {item.label}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex min-h-11 flex-1 flex-col items-center justify-center gap-1 rounded-[var(--radius-md)] px-1 py-1.5 text-[11px] text-muted-foreground"
        >
          <MoreHorizontal className="size-4" aria-hidden />
          Mais
        </button>
      </nav>
    </>
  );
}
