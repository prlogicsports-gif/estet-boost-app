import { useMemo } from "react";

import type { NavConfig, NavItem } from "@/components/shell/nav-items";
import type { Session } from "@/lib/auth.types";
import { canAny } from "@/lib/permissions";
import { useSession } from "@/lib/session";

const DOCK_SIZE = 4;

/** Esconde do menu o que a pessoa não pode usar (a funcionária só vê o que a gestora liberou). */
export function visibleNav(nav: NavConfig, session: Session | null | undefined): NavConfig {
  const visible = (item: NavItem) => {
    if (!session) return true;
    if (session.role === "gestor" || session.role === "cliente") return true;
    if (item.adminOnly) return false;
    return !item.needs || canAny(session, ...item.needs);
  };
  const primary = nav.primary.filter(visible);
  let secondary = nav.secondary.filter(visible);
  // Quem não tem uma permissão ficaria com o dock vazio: sobe o primeiro item do "Mais" que ela pode usar.
  if (session?.role === "funcionario") {
    while (primary.length < DOCK_SIZE) {
      const next = secondary.find((item) => item.needs && !item.adminOnly);
      if (!next) break;
      primary.push(next);
      secondary = secondary.filter((item) => item !== next);
    }
  }
  return { ...nav, primary, secondary };
}

export function useVisibleNav(nav: NavConfig): NavConfig {
  const session = useSession();
  return useMemo(() => visibleNav(nav, session), [nav, session]);
}
