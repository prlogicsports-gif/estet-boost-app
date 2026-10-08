import { Icon } from "@/components/eb/icon";

export type NotificationKind =
  | "request"
  | "confirmed"
  | "reschedule"
  | "stock"
  | "bill"
  | "followup"
  | "reminder"
  | "recommendation";
export type NotificationItem = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  time: string;
  unread?: boolean;
};

const kinds: Record<NotificationKind, { icon: string; fg: string }> = {
  request: { icon: "CalendarPlus", fg: "var(--eb-teal-500)" },
  confirmed: { icon: "CheckCheck", fg: "var(--eb-teal-500)" },
  reschedule: { icon: "CalendarClock", fg: "var(--eb-amber-500)" },
  stock: { icon: "PackageMinus", fg: "var(--eb-amber-500)" },
  bill: { icon: "Receipt", fg: "var(--eb-coral-500)" },
  followup: { icon: "Sparkles", fg: "var(--eb-nude-500)" },
  reminder: { icon: "BellRing", fg: "var(--eb-nude-500)" },
  recommendation: { icon: "NotebookPen", fg: "var(--eb-nude-500)" },
};

export function NotificationCenter({
  items,
  onSelect,
  onMarkAll,
  emptyLabel = "Nada por aqui ainda.",
}: {
  items: NotificationItem[];
  onSelect?: (item: NotificationItem) => void;
  onMarkAll?: () => void;
  emptyLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between px-0.5 pb-2">
        <span className="text-[11px] font-medium uppercase leading-[1.2] tracking-[0.14em] text-muted-foreground">
          Notificações
        </span>
        {onMarkAll ? (
          <button
            type="button"
            onClick={onMarkAll}
            className="min-h-11 whitespace-nowrap text-[12.5px] text-[var(--teal)]"
          >
            Marcar tudo como lido
          </button>
        ) : null}
      </div>
      {items.length ? (
        items.map((item) => {
          const kind = kinds[item.kind] ?? kinds.reminder;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect?.(item)}
              className="flex min-h-11 w-full items-start gap-3 rounded-[var(--radius-md)] border border-[var(--border-hairline)] p-3 text-left transition-colors"
              style={{ background: item.unread ? "var(--eb-ivory-a06)" : "transparent" }}
            >
              <span
                className="grid size-8 flex-none place-items-center rounded-full bg-[var(--eb-ivory-a06)]"
                style={{ color: kind.fg }}
              >
                <Icon name={kind.icon} size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className="block text-[13.5px]"
                  style={{ fontWeight: item.unread ? 500 : 400 }}
                >
                  {item.title}
                </span>
                <span className="mt-0.5 block text-[12.5px] text-[var(--text-secondary)]">
                  {item.body}
                </span>
              </span>
              <span className="flex-none text-[11.5px] text-muted-foreground">{item.time}</span>
              {item.unread ? (
                <span className="mt-1.5 size-1.5 flex-none rounded-full bg-[var(--eb-teal-500)]" />
              ) : null}
            </button>
          );
        })
      ) : (
        <p className="p-3 text-[13px] text-muted-foreground">{emptyLabel}</p>
      )}
    </div>
  );
}
