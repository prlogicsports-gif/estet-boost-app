import { Outlet, createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/shell/app-shell";
import { gestorNav } from "@/components/shell/nav-items";

export const Route = createFileRoute("/_gestor")({
  component: GestorLayout,
});

function GestorLayout() {
  return (
    <AppShell nav={gestorNav}>
      <Outlet />
    </AppShell>
  );
}
