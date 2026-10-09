import { useNavigate } from "@tanstack/react-router";

import { authService } from "@/services/auth.service";

/** Sair da conta: encerra o login e volta para a tela de acesso. */
export function useSignOut() {
  const navigate = useNavigate();
  return async () => {
    await authService.signOut();
    navigate({ to: "/" });
  };
}
