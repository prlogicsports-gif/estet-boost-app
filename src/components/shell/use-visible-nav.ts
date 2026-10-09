import { useMemo } from "react";

import type { NavConfig, NavItem } from "@/components/shell/nav-items";
import { canAny } from "@/lib/permissions";
import { useSession } from "@/lib/session";

/** Esconde do menu o que a pessoa não pode usar (a funcionária só vê o que a gestora liberou). */
export function useVisibleNav(nav: NavConfig): NavConfig {
  const session = useSession();
  return useMemo(() => {
    const visible = (item: NavItem) => {
      if (!session) return true;
      if (session.role === "gestor" || session.role === "cliente") return true;
      if (item.adminOnly) return false;
      return !item.needs || canAny(session, ...item.needs);
    };
    return {
      ...nav,
      primary: nav.primary.filter(visible),
      secondary: nav.secondary.filter(visible),
    };
  }, [nav, session]);
}
