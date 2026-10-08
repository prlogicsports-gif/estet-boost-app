import { Outlet, createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/shell/app-shell";
import { gestorNav } from "@/components/shell/nav-items";
import { notifications } from "@/data/gestor-mock";

export const Route = createFileRoute("/_gestor")({
  component: GestorLayout,
});

function GestorLayout() {
  return (
    <AppShell nav={gestorNav} notifications={notifications}>
      <Outlet />
    </AppShell>
  );
}
