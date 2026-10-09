import type { ReactNode } from "react";

import { RoleGate } from "@/components/auth/role-gate";

/** O atendimento é um fluxo independente em tela cheia: sem menu, sem barra, só o passo a passo. */
export function SessionFrame({ children }: { children: ReactNode }) {
  return (
    <RoleGate role="gestor" permissions={["atendimentos"]}>
      <div
        className="fixed inset-0 z-50 overflow-y-auto bg-background"
        style={{ animation: "page-in 320ms cubic-bezier(.22,1,.36,1)" }}
      >
        <div className="mx-auto max-w-[880px] px-4 pb-12 lg:max-w-none lg:px-10 xl:px-14 pt-[calc(env(safe-area-inset-top)+20px)]">
          {children}
        </div>
      </div>
    </RoleGate>
  );
}
