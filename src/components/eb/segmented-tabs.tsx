import { cn } from "@/lib/utils";

export function SegmentedTabs<T extends string>({
  tabs,
  active,
  onSelect,
  size = "md",
  scroll,
  className,
}: {
  tabs: { id: T; label: string; /** Texto menor no celular. */ short?: string }[];
  active: T;
  onSelect: (id: T) => void;
  size?: "sm" | "md";
  scroll?: boolean;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "flex gap-0.5 rounded-full border border-[var(--border-hairline)] bg-[var(--eb-ivory-a06)] p-[3px]",
        scroll ? "overflow-x-auto" : "overflow-visible",
        className,
      )}
    >
      {tabs.map((tab) => {
        const on = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onSelect(tab.id)}
            className={cn(
              "min-w-0 rounded-full px-1.5 transition-colors sm:px-3.5",
              scroll ? "flex-none whitespace-nowrap !px-3.5" : "flex-1 truncate",
              size === "sm"
                ? "min-h-8 text-[12.5px]"
                : "min-h-[38px] text-[12.5px] sm:text-[13.5px]",
              on
                ? "bg-[var(--surface-card-hover)] font-medium text-foreground"
                : "text-[var(--text-secondary)]",
            )}
            style={on ? { boxShadow: "var(--shadow-card)" } : undefined}
          >
            {tab.short ? (
              <>
                <span className="sm:hidden">{tab.short}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </>
            ) : (
              tab.label
            )}
          </button>
        );
      })}
    </div>
  );
}
