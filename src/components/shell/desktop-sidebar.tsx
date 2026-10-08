import { Link } from "@tanstack/react-router";

import { BrandMark } from "@/components/brand/brand-mark";
import type { NavConfig } from "@/components/shell/nav-items";
import { initialsOf, roleLabel } from "@/data/mock-auth";
import { useSession } from "@/lib/session";

/** O dock do celular em pé: o mesmo vidro, as mesmas rotas, o perfil fixo embaixo. */
export function DesktopSidebar({ nav }: { nav: NavConfig }) {
  const session = useSession();
  const items = [...nav.primary, ...nav.secondary];

  return (
    <aside
      aria-label="Navegação principal"
      className="sticky top-6 hidden h-[calc(100vh-3rem)] w-[236px] shrink-0 flex-col gap-5 rounded-[var(--radius-xl)] px-3 py-[18px] glass-panel lg:flex"
    >
      <div className="px-2.5 text-[19px]">
        <BrandMark />
      </div>
      <nav className="flex flex-1 flex-col gap-0.5">
        {items.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: item.to === "/cliente" }}
            className="flex min-h-11 items-center gap-[11px] rounded-[var(--radius-md)] px-3 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--accent)] hover:text-foreground"
            activeProps={{
              className: "bg-[var(--eb-ivory-a10)] font-medium text-foreground",
              "aria-current": "page",
            }}
          >
            <item.icon className="size-[18px]" aria-hidden />
            <span className="flex-1">{item.label}</span>
          </Link>
        ))}
      </nav>
      {session ? (
        <div className="flex items-center gap-2.5 border-t border-[var(--border-hairline)] p-2.5">
          <span className="grid size-[34px] flex-none place-items-center rounded-full bg-[var(--eb-nude-a32)] text-[13px] font-medium text-foreground">
            {initialsOf(session.name)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13.5px] text-foreground">{session.name}</span>
            <span className="block text-[11.5px] text-muted-foreground">
              {roleLabel[session.role]}
            </span>
          </span>
        </div>
      ) : null}
    </aside>
  );
}
