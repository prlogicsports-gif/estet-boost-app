import { Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";

import { EmptyState } from "@/components/eb/empty-state";
import { AppShell } from "@/components/shell/app-shell";
import { gestorNav } from "@/components/shell/nav-items";
import { canAny, requiredFor } from "@/lib/permissions";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/_gestor")({
  component: GestorLayout,
});

/** A funcionária só abre o que a gestora liberou; o banco recusa o resto mesmo que alguém force a URL. */
function GestorLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const session = useSession();
  const need = requiredFor(pathname);
  const blocked =
    session?.role === "funcionario" &&
    (need === "gestor" || (need.length > 0 && !canAny(session, ...need)));
  return (
    <AppShell nav={gestorNav}>
      {blocked ? (
        <EmptyState
          icon="Lock"
          title="Sem acesso a esta área"
          description="Peça à gestora da clínica para liberar essa permissão."
        />
      ) : (
        <Outlet />
      )}
    </AppShell>
  );
}
