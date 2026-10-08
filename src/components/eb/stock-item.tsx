import { Icon } from "@/components/eb/icon";
import { StatusBadge } from "@/components/eb/status-badge";
import { daysBetween, todayISO } from "@/lib/dates";
import type { StockRec } from "@/lib/models";
import { brl } from "@/lib/view";
import { cn } from "@/lib/utils";

/** Dias até vencer: negativo se já venceu, `null` se o produto não vence. */
export const daysToExpire = (item: Pick<StockRec, "expiry">) =>
  item.expiry ? daysBetween(todayISO(), item.expiry) : null;

const expiryLabel = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" });

export function StockItem({
  item,
  onRestock,
  onEdit,
}: {
  item: StockRec;
  onRestock?: () => void;
  onEdit?: () => void;
}) {
  const low = item.quantity <= item.min;
  const days = daysToExpire(item);
  const expired = days !== null && days < 0;
  const soon = days !== null && days >= 0 && days <= 30;
  const warn = low || expired || soon;
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border bg-[var(--surface-card)] px-3.5 py-3",
        expired
          ? "border-[rgba(201,109,109,.35)]"
          : warn
            ? "border-[rgba(216,166,83,.28)]"
            : "border-[var(--border-card)]",
      )}
    >
      <button
        type="button"
        onClick={onEdit}
        disabled={!onEdit}
        className="flex min-w-[200px] flex-1 items-center gap-3 text-left"
      >
        <span
          className="grid size-[34px] flex-none place-items-center rounded-[var(--radius-sm)] bg-[var(--eb-ivory-a06)]"
          style={{
            color: expired
              ? "var(--eb-coral-500)"
              : warn
                ? "var(--eb-amber-500)"
                : "var(--eb-nude-300)",
          }}
        >
          <Icon name={low ? "PackageMinus" : "Package"} size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{item.name}</span>
          <span className="flex flex-wrap gap-x-2.5 text-[11.5px] text-muted-foreground">
            <span>{item.category}</span>
            {item.expiry ? <span>Val. {expiryLabel(item.expiry)}</span> : null}
            {item.batch && item.batch !== "—" ? <span>Lote {item.batch}</span> : null}
            {item.cost ? (
              <span>
                Custo {brl(item.cost)}/{item.unit}
              </span>
            ) : null}
            {item.supplier ? <span>{item.supplier}</span> : null}
          </span>
        </span>
      </button>
      <div className="flex-none text-right">
        <div
          className="font-mono text-[15px] font-medium"
          style={{ color: low ? "var(--eb-amber-500)" : undefined }}
        >
          {item.quantity} {item.unit}
        </div>
        <div className="text-[11px] text-muted-foreground">mín. {item.min}</div>
      </div>
      <div className="flex flex-none flex-wrap items-center justify-end gap-1.5">
        {expired ? (
          <StatusBadge tone="cancelled" size="sm" icon="AlertTriangle">
            Vencido
          </StatusBadge>
        ) : soon ? (
          <StatusBadge tone="pending" size="sm" icon="Clock">
            Vence em {days} {days === 1 ? "dia" : "dias"}
          </StatusBadge>
        ) : null}
        {low ? (
          onRestock ? (
            <button
              type="button"
              onClick={onRestock}
              className="min-h-11 rounded-full border border-[rgba(216,166,83,.28)] px-3 text-[12.5px] text-[var(--eb-amber-500)]"
            >
              Repor
            </button>
          ) : (
            <StatusBadge tone="pending" size="sm">
              Repor
            </StatusBadge>
          )
        ) : null}
      </div>
    </div>
  );
}
