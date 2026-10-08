import { Icon } from "@/components/eb/icon";
import type { Session } from "@/lib/auth.types";
import { authService } from "@/services/auth.service";

/**
 * Acesso livre, temporário: abre a área da esteticista ou da cliente sem login,
 * para navegar pelas telas. Quando o app for ativado, basta remover este componente
 * (e o uso dele em `routes/index.tsx`) e o `enterAs` do serviço de autenticação.
 */
export function FreeAccess({ onEnter }: { onEnter: (session: Session) => void }) {
  return (
    <div className="mt-[18px] border-t border-[var(--border-hairline)] pt-4">
      <p className="text-center text-[11px] font-medium uppercase leading-none tracking-[0.14em] text-muted-foreground">
        Acesso livre · temporário
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {(
          [
            ["gestor", "Área da gestora", "Sun"],
            ["cliente", "Área da cliente", "User"],
          ] as const
        ).map(([role, label, icon]) => (
          <button
            key={role}
            type="button"
            onClick={() => onEnter(authService.enterAs(role))}
            className="flex min-h-12 items-center justify-center gap-2 rounded-full border border-[var(--border-card)] bg-[var(--eb-ivory-a06)] px-3 text-[13.5px] text-foreground transition-colors hover:bg-[var(--eb-ivory-a10)]"
          >
            <Icon name={icon} size={16} color="var(--eb-nude-300)" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
