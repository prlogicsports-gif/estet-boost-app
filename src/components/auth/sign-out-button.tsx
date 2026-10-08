import { LogOut } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { authService } from "@/services/auth.service";

export function SignOutButton() {
  const navigate = useNavigate();
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        authService.signOut();
        navigate({ to: "/" });
      }}
    >
      <LogOut aria-hidden /> Sair
    </Button>
  );
}
