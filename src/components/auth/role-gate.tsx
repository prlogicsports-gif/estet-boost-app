import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";

import { EmptyState } from "@/components/eb/empty-state";
import { Button } from "@/components/ui/button";
import type { Area, PermissionKey } from "@/lib/auth.types";
import { canAny } from "@/lib/permissions";
import { homeFor, sessionStore, useAuthState } from "@/lib/session";

const areaOf = (role: string): Area => (role === "cliente" ? "cliente" : "gestor");

/**
 * Deixa passar só quem tem login e é da área indicada (a equipe usa a área "gestor"; a cliente, "cliente").
 * Com `permissions`, a funcionária precisa ter ao menos uma delas. Isto é só a tela: quem protege os dados é o RLS do banco.
 */
export function RoleGate({
  role,
  permissions,
  children,
}: {
  role: Area;
  permissions?: PermissionKey[] | undefined;
  children: ReactNode;
}) {
  const auth = useAuthState();
  const navigate = useNavigate();

  useEffect(() => {
    if (auth.status === "out" || auth.status === "needs-profile") navigate({ to: "/" });
    else if (auth.status === "in" && areaOf(auth.session.role) !== role)
      navigate({ to: homeFor(auth.session.role) });
  }, [auth, role, navigate]);

  if (auth.status === "error") {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4">
        <EmptyState
          icon="WifiOff"
          title="Sem conexão com a sua conta"
          description={auth.message}
          action={<Button onClick={() => void sessionStore.refresh()}>Tentar de novo</Button>}
        />
      </div>
    );
  }
  if (auth.status !== "in" || areaOf(auth.session.role) !== role) {
    return <div className="min-h-screen bg-background" aria-busy />;
  }
  if (permissions && !canAny(auth.session, ...permissions)) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4">
        <EmptyState
          icon="Lock"
          title="Sem acesso a esta área"
          description="Peça à gestora da clínica para liberar essa permissão."
          action={
            <Button onClick={() => navigate({ to: homeFor(auth.session.role) })}>Voltar</Button>
          }
        />
      </div>
    );
  }
  return <>{children}</>;
}
