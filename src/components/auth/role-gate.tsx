import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";

import type { Role } from "@/lib/auth.types";
import { homeFor, useSession } from "@/lib/session";

/**
 * Deixa passar só o perfil indicado. Sem sessão volta ao acesso; com o outro
 * perfil leva para a área dele. A sessão é local, então a checagem roda no cliente.
 */
export function RoleGate({ role, children }: { role: Role; children: ReactNode }) {
  const session = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (session === undefined) return;
    if (session === null) navigate({ to: "/" });
    else if (session.role !== role) navigate({ to: homeFor(session.role) });
  }, [session, role, navigate]);

  if (!session || session.role !== role) {
    return <div className="min-h-screen bg-background" aria-busy />;
  }
  return <>{children}</>;
}
