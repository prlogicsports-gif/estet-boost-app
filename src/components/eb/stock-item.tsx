import { Icon } from "@/components/eb/icon";
import { StatusBadge } from "@/components/eb/status-badge";
import { cn } from "@/lib/utils";

export type StockEntry = {
  name: string;
  quantity: number;
  unit: string;
  min: number;
  expiry: string;
  batch: string;
  cost: string;
};

export function StockItem({
  name,
  quantity,
  unit,
  min,
  expiry,
  batch,
  cost,
  onRestock,
}: StockEntry & { onRestock?: () => void }) {
  const low = quantity <= min;
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-[var(--radius-md)] border bg-[var(--surface-card)] px-3.5 py-3",
        low ? "border-[rgba(216,166,83,.28)]" : "border-[var(--border-card)]",
      )}
    >
      <span
        className="grid size-[34px] flex-none place-items-center rounded-[var(--radius-sm)] bg-[var(--eb-ivory-a06)]"
        style={{ color: low ? "var(--eb-amber-500)" : "var(--eb-nude-300)" }}
      >
        <Icon name={low ? "PackageMinus" : "Package"} size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{name}</div>
        <div className="flex flex-wrap gap-2.5 text-[11.5px] text-muted-foreground">
          {expiry ? <span>Val. {expiry}</span> : null}
          {batch ? <span>Lote {batch}</span> : null}
          {cost ? <span>Custo {cost}</span> : null}
        </div>
      </div>
      <div className="flex-none text-right">
        <div
          className="font-mono text-[15px] font-medium"
          style={{ color: low ? "var(--eb-amber-500)" : undefined }}
        >
          {quantity} {unit}
        </div>
        <div className="text-[11px] text-muted-foreground">mín. {min}</div>
      </div>
      {low ? (
        onRestock ? (
          <button
            type="button"
            onClick={onRestock}
            className="min-h-11 flex-none rounded-full border border-[rgba(216,166,83,.28)] px-3 text-[12.5px] text-[var(--eb-amber-500)]"
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
  );
}
