import { Icon } from "@/components/eb/icon";
import { StatusBadge, type StatusTone } from "@/components/eb/status-badge";

export type Client = {
  id: string;
  name: string;
  initials: string;
  mainProcedure: string;
  lastVisit: string;
  nextReturn: string;
  status: StatusTone;
  alert?: string;
  age: number;
  phone: string;
  goal?: string;
  allergies?: string;
  contra?: string;
  session?: string;
  note?: string;
};

export function ClientCard({
  name,
  initials,
  lastVisit,
  mainProcedure,
  nextReturn,
  status,
  alert,
  onOpen,
}: Partial<Client> & { name: string; onOpen?: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-11 w-full items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border-card)] bg-[var(--surface-card)] px-3.5 py-3 text-left transition-colors hover:bg-[var(--surface-card-hover)]"
    >
      <span className="grid size-11 flex-none place-items-center overflow-hidden rounded-full bg-[var(--eb-nude-a32)] text-[15px] font-medium text-foreground">
        {initials}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className="text-[15px] font-medium">{name}</span>
        <span className="truncate text-[12.5px] text-[var(--text-secondary)]">{mainProcedure}</span>
        <span className="flex gap-2.5 whitespace-nowrap text-[11.5px] text-muted-foreground">
          {lastVisit ? <span>Último: {lastVisit}</span> : null}
          {nextReturn ? <span>Retorno: {nextReturn}</span> : null}
        </span>
      </span>
      <span className="flex flex-none flex-col items-end gap-1.5">
        {status ? <StatusBadge tone={status} size="sm" /> : null}
        {alert ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-[var(--eb-amber-500)]">
            <Icon name="AlertTriangle" size={12} />
            {alert}
          </span>
        ) : null}
      </span>
      <Icon name="ChevronRight" size={18} className="text-muted-foreground" />
    </button>
  );
}
