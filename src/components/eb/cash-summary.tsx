import { Icon } from "@/components/eb/icon";

export type CashKind = "entradas" | "saidas" | "receber";

/** Com `onSelect`, cada linha vira botão que abre o detalhamento: de onde vem cada valor. */
export function CashSummary({
  income,
  expense,
  balance,
  receivable,
  goal,
  goalProgress = 0,
  onSelect,
}: {
  income: string;
  expense: string;
  balance: string;
  receivable: string;
  goal?: string;
  goalProgress?: number;
  onSelect?: (kind: CashKind) => void;
}) {
  const row = (icon: string, label: string, value: string, color: string, kind: CashKind) => {
    const Tag = onSelect ? "button" : "div";
    return (
      <Tag
        key={label}
        onClick={onSelect ? () => onSelect(kind) : undefined}
        aria-label={onSelect ? `Ver detalhes de ${label.toLowerCase()}` : undefined}
        className="flex min-h-11 w-full items-center gap-2.5 border-b border-[var(--border-hairline)] bg-transparent py-[11px] text-left"
        style={{ cursor: onSelect ? "pointer" : "default" }}
      >
        <span
          className="grid size-7 flex-none place-items-center rounded-full bg-[var(--eb-ivory-a06)]"
          style={{ color }}
        >
          <Icon name={icon} size={14} />
        </span>
        <span className="flex-1 text-[13.5px] text-[var(--text-secondary)]">{label}</span>
        <span className="font-mono text-[15px] font-medium" style={{ color }}>
          {value}
        </span>
        {onSelect ? <Icon name="ChevronRight" size={16} className="text-muted-foreground" /> : null}
      </Tag>
    );
  };
  const progress = Math.max(0, Math.min(1, goalProgress));
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--border-card)] bg-[var(--surface-card)] px-[18px] py-4">
      <span className="text-[11px] font-medium uppercase leading-[1.2] tracking-[0.14em] text-muted-foreground">
        Saldo do mês
      </span>
      <div className="mb-2.5 mt-1.5 font-mono text-[34px] font-medium leading-[1.12] tracking-[-0.02em]">
        {balance}
      </div>
      <div className="border-t border-[var(--border-hairline)]">
        {row("ArrowDownLeft", "Entradas", income, "var(--eb-teal-500)", "entradas")}
        {row("ArrowUpRight", "Saídas", expense, "var(--eb-coral-500)", "saidas")}
        {row("Hourglass", "A receber", receivable, "var(--eb-amber-500)", "receber")}
      </div>
      {goal ? (
        <div className="mt-3 border-t border-[var(--border-hairline)] pt-3.5">
          <div className="mb-[7px] flex justify-between text-[12.5px] text-[var(--text-secondary)]">
            <span>Meta do mês</span>
            <span className="font-mono">{goal}</span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={Math.round(progress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-1.5 overflow-hidden rounded-full bg-[var(--eb-ivory-a06)]"
          >
            <div
              className="h-full rounded-full bg-[var(--eb-teal-500)] transition-[width] duration-300"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <div className="mt-1.5 text-[11.5px] text-muted-foreground">
            {Math.round(progress * 100)}% da meta alcançada
          </div>
        </div>
      ) : null}
    </section>
  );
}
