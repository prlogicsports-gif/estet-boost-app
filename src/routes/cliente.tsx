import { Outlet, createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/shell/app-shell";
import { clienteNav } from "@/components/shell/nav-items";

export const Route = createFileRoute("/cliente")({
  component: ClienteLayout,
});

function ClienteLayout() {
  return (
    <AppShell nav={clienteNav}>
      <Outlet />
    </AppShell>
  );
}
