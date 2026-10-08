import { Outlet, createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/shell/app-shell";
import { clienteNav } from "@/components/shell/nav-items";
import { notifications } from "@/data/cliente-mock";

export const Route = createFileRoute("/cliente")({
  component: ClienteLayout,
});

function ClienteLayout() {
  return (
    <AppShell nav={clienteNav} notifications={notifications}>
      <Outlet />
    </AppShell>
  );
}
