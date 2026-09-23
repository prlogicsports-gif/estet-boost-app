import { Link } from "@tanstack/react-router";

import { BrandMark } from "@/components/brand/brand-mark";
import { desktopItems } from "@/components/shell/nav-items";
import { mockSession } from "@/data/mock-auth";

export function DesktopSidebar() {
  return (
    <aside className="sticky top-6 hidden h-[calc(100vh-3rem)] w-64 shrink-0 flex-col justify-between rounded-[var(--radius-xl)] p-4 glass-panel lg:flex">
      <div>
        <div className="px-2 py-3 text-lg">
          <BrandMark />
        </div>
        <nav className="mt-4 space-y-1">
          {desktopItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex min-h-11 items-center gap-3 rounded-[var(--radius-md)] px-3 text-sm text-muted-foreground transition-colors hover:bg-[var(--accent)] hover:text-foreground"
              activeProps={{ className: "bg-[var(--accent)] text-foreground" }}
            >
              <item.icon className="size-4" aria-hidden />
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-3 rounded-[var(--radius-md)] bg-[var(--muted)] p-3">
        <span className="flex size-9 items-center justify-center rounded-full bg-primary font-mono text-xs text-primary-foreground">
          {mockSession.user.initials}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm text-foreground">{mockSession.user.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{mockSession.user.role}</span>
        </span>
      </div>
    </aside>
  );
}
