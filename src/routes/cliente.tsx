import { Outlet, createFileRoute } from "@tanstack/react-router";

import { TermsGate } from "@/components/auth/terms-gate";
import { AppShell } from "@/components/shell/app-shell";
import { clienteNav } from "@/components/shell/nav-items";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/cliente")({
  component: ClienteLayout,
});

function ClienteLayout() {
  const session = useSession();
  return (
    <AppShell nav={clienteNav}>
      <Outlet />
      {session?.termsPending ? <TermsGate /> : null}
    </AppShell>
  );
}
