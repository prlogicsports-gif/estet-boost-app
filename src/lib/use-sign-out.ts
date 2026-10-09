import { useNavigate } from "@tanstack/react-router";

import { pendingCount } from "@/lib/remote-store";
import { authService } from "@/services/auth.service";

/** Sair da conta: encerra o login e volta para a tela de acesso. */
export function useSignOut() {
  const navigate = useNavigate();
  return async () => {
    const pending = pendingCount();
    if (
      pending > 0 &&
      !window.confirm(
        `Há ${pending} ${pending === 1 ? "alteração" : "alterações"} que ainda não ${pending === 1 ? "foi enviada" : "foram enviadas"} (falta internet). Se você sair agora, ${pending === 1 ? "ela será perdida" : "elas serão perdidas"}. Sair mesmo assim?`,
      )
    )
      return;
    await authService.signOut();
    navigate({ to: "/" });
  };
}
