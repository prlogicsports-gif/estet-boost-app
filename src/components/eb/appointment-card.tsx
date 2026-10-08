import { Icon } from "@/components/eb/icon";
import { StatusBadge, type StatusTone } from "@/components/eb/status-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type Appointment = {
  id: string;
  clientId: string;
  time: string;
  client: string;
  initials: string;
  procedure: string;
  kind: "retorno" | "primeira";
  session?: number;
  sessionsTotal?: number;
  status: StatusTone;
  price: string;
  alert?: string;
  /** Atendimento já realizado. */
  done?: boolean;
};

function Chip({ icon, label, warn }: { icon: string; label: string; warn?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-[5px] whitespace-nowrap rounded-full px-[9px] py-1 text-[11.5px]"
      style={{
        background: warn ? "var(--eb-amber-a16)" : "var(--eb-ivory-a06)",
        color: warn ? "var(--eb-amber-500)" : "var(--text-secondary)",
      }}
    >
      <Icon name={icon} size={12} />
      {label}
    </span>
  );
}

/** `hero` é o "próximo atendimento" da tela Hoje; `row` é uma linha da lista do dia. */
export function AppointmentCard({
  time,
  client,
  initials,
  procedure,
  kind,
  session,
  sessionsTotal,
  status = "confirmed",
  price,
  alert,
  done,
  variant = "row",
  onOpen,
  actionLabel = "Ver atendimento",
}: Partial<Appointment> & {
  time: string;
  client: string;
  procedure: string;
  variant?: "hero" | "row";
  onOpen?: () => void;
  actionLabel?: string;
}) {
  const hero = variant === "hero";
  return (
    <article
      className={cn(
        "flex flex-col border",
        hero
          ? "gap-3.5 rounded-[var(--radius-lg)] border-[var(--border-strong)] bg-[var(--surface-card)] p-[18px]"
          : "rounded-[var(--radius-md)] border-[var(--border-hairline)] bg-[var(--eb-ivory-a06)] px-3.5 py-3",
      )}
      style={hero ? { boxShadow: "var(--shadow-raised)" } : undefined}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "w-11 flex-none font-mono",
            hero ? "text-[15px] text-[var(--nude-sand)]" : "text-sm text-[var(--text-secondary)]",
          )}
        >
          {time}
        </span>
        <span
          className={cn(
            "grid flex-none place-items-center overflow-hidden rounded-full bg-[var(--eb-nude-a32)] font-medium text-foreground",
            hero ? "size-14 text-[17px]" : "size-10 text-sm",
          )}
        >
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              "truncate font-medium",
              hero ? "text-xl tracking-[-0.01em]" : "text-[14.5px]",
            )}
          >
            {client}
          </div>
          <div
            className={cn(
              "truncate text-[var(--text-secondary)]",
              hero ? "text-[13.5px]" : "text-[12.5px]",
            )}
          >
            {procedure}
          </div>
        </div>
        <StatusBadge
          tone={status}
          size={hero ? "md" : "sm"}
          {...(done ? { icon: "CheckCheck" } : {})}
        >
          {done ? "Concluído" : undefined}
        </StatusBadge>
      </div>

      {hero || alert ? (
        <div className={cn("flex flex-wrap gap-2", !hero && "pl-14 pt-2")}>
          {kind ? (
            <Chip
              icon={kind === "primeira" ? "Sparkles" : "RotateCcw"}
              label={kind === "primeira" ? "Primeira consulta" : "Retorno"}
            />
          ) : null}
          {session ? (
            <Chip
              icon="Layers"
              label={`Sessão ${session}${sessionsTotal ? ` de ${sessionsTotal}` : ""}`}
            />
          ) : null}
          {price ? <Chip icon="Wallet" label={price} /> : null}
          {alert ? <Chip icon="AlertTriangle" label={alert} warn /> : null}
        </div>
      ) : null}

      {hero ? (
        <Button className="w-full" onClick={onOpen}>
          {actionLabel} <Icon name="ArrowRight" size={18} />
        </Button>
      ) : null}
    </article>
  );
}
