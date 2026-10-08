import { Icon } from "@/components/eb/icon";
import { cn } from "@/lib/utils";

export type FilterOption<T extends string> = {
  id: T;
  label: string;
  icon?: string;
  count?: number;
};

/** Chips com rolagem horizontal. */
export function FilterBar<T extends string>({
  filters,
  active,
  onSelect,
}: {
  filters: FilterOption<T>[];
  active: T;
  onSelect: (id: T) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Filtros"
      className="flex gap-2 overflow-x-auto py-0.5 [scrollbar-width:none]"
    >
      {filters.map((filter) => {
        const on = filter.id === active;
        return (
          <button
            key={filter.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onSelect(filter.id)}
            className={cn(
              "inline-flex min-h-11 flex-none items-center gap-1.5 rounded-full border px-[13px] text-[13px] transition-colors",
              on
                ? "border-transparent bg-[var(--eb-nude-500)] font-medium text-[var(--text-on-nude)]"
                : "border-[var(--border-hairline)] bg-[var(--eb-ivory-a06)] text-[var(--text-secondary)]",
            )}
          >
            {filter.icon ? <Icon name={filter.icon} size={13} /> : null}
            {filter.label}
            {typeof filter.count === "number" ? (
              <span className="font-mono text-[11px] opacity-70">{filter.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
