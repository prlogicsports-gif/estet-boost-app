import type { ReactNode } from "react";

import { RoleGate } from "@/components/auth/role-gate";

/** O atendimento é um fluxo independente em tela cheia: sem menu, sem barra, só o passo a passo. */
export function SessionFrame({ children }: { children: ReactNode }) {
  return (
    <RoleGate role="gestor">
      <div
        className="fixed inset-0 z-50 overflow-y-auto bg-background"
        style={{ animation: "fade-up 320ms cubic-bezier(.16,1,.3,1)" }}
      >
        <div className="mx-auto max-w-[880px] px-4 pb-12 pt-[calc(env(safe-area-inset-top)+20px)]">
          {children}
        </div>
      </div>
    </RoleGate>
  );
}
