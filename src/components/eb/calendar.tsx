import { Icon } from "@/components/eb/icon";
import { IconButton } from "@/components/eb/icon-button";
import type { StatusTone } from "@/components/eb/status-badge";

export type CalendarEvent = { time: string; client: string; status: StatusTone };
export type CalendarEvents = Record<string, CalendarEvent[]>;

const WEEKDAYS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

const dotFor = (status: StatusTone) =>
  status === "confirmed"
    ? "var(--status-confirmed)"
    : status === "pending"
      ? "var(--status-pending)"
      : status === "cancelled"
        ? "var(--status-cancelled)"
        : "var(--status-neutral)";

/** Uma tela, três vistas (dia, semana, mês). `events` é indexado pela data ISO. */
export function Calendar({
  view = "month",
  year,
  month,
  selected,
  events = {},
  onSelectDate,
  onSelectEvent,
  onNavigate,
  slots,
}: {
  view?: "day" | "week" | "month";
  year: number;
  /** 0 a 11. */
  month: number;
  selected?: string;
  events?: CalendarEvents;
  onSelectDate?: (iso: string, slot?: string) => void;
  onSelectEvent?: (event: CalendarEvent) => void;
  onNavigate?: (step: -1 | 1) => void;
  slots?: string[];
}) {
  const header = (
    <div className="mb-3 flex items-center gap-2">
      <IconButton
        icon="ChevronLeft"
        label="Período anterior"
        size={44}
        onClick={() => onNavigate?.(-1)}
      />
      <div className="flex-1 text-center text-[15px] font-medium">
        {(MONTHS[month] ?? "").charAt(0).toUpperCase() + (MONTHS[month] ?? "").slice(1)} de {year}
      </div>
      <IconButton
        icon="ChevronRight"
        label="Próximo período"
        size={44}
        onClick={() => onNavigate?.(1)}
      />
    </div>
  );

  if (view === "day" || view === "week") {
    const days =
      view === "day"
        ? [selected ?? `${year}-${String(month + 1).padStart(2, "0")}-08`]
        : Object.keys(events).slice(0, 7);
    return (
      <div>
        {header}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5">
          {days.map((day) => (
            <div
              key={day}
              className="rounded-[var(--radius-md)] border border-[var(--border-card)] bg-[var(--surface-card)] p-3"
            >
              <div className="mb-2 text-xs text-muted-foreground">
                {new Date(`${day}T00:00`).toLocaleDateString("pt-BR", {
                  weekday: "short",
                  day: "2-digit",
                })}
              </div>
              <div className="flex flex-col gap-1.5">
                {(events[day] ?? []).map((event, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => onSelectEvent?.(event)}
                    className="flex min-h-11 items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border-hairline)] bg-[var(--eb-ivory-a06)] px-2.5 py-2 text-left"
                    style={{ borderLeft: `3px solid ${dotFor(event.status)}` }}
                  >
                    <span className="font-mono text-xs text-[var(--text-secondary)]">
                      {event.time}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px]">{event.client}</span>
                  </button>
                ))}
                {!events[day]?.length ? (
                  <span className="text-xs text-muted-foreground">Sem atendimentos</span>
                ) : null}
                {slots && view === "day"
                  ? slots.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => onSelectDate?.(day, slot)}
                        className="flex min-h-11 items-center gap-2 rounded-[var(--radius-sm)] border border-dashed border-[var(--border-card)] px-2.5 py-2 text-[12.5px] text-muted-foreground"
                      >
                        <Icon name="Plus" size={13} />
                        {slot} · livre
                      </button>
                    ))
                  : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const total = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array<null>(offset).fill(null),
    ...Array.from({ length: total }, (_, i) => i + 1),
  ];

  return (
    <div>
      {header}
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((weekday) => (
          <div
            key={weekday}
            className="pb-1.5 text-center text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground"
          >
            {weekday}
          </div>
        ))}
        {cells.map((day, index) => {
          if (!day) return <div key={`vazio-${index}`} />;
          const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayEvents = events[iso] ?? [];
          const on = selected === iso;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelectDate?.(iso)}
              aria-label={`${day} de ${MONTHS[month]}${dayEvents.length ? `, ${dayEvents.length} atendimentos` : ", livre"}`}
              aria-current={on ? "date" : undefined}
              className="flex min-h-[84px] min-w-0 flex-col items-stretch justify-start gap-[3px] overflow-hidden rounded-[var(--radius-sm)] border p-[5px] text-left text-[13px] transition-colors [container-type:inline-size]"
              style={{
                background: on
                  ? "var(--eb-nude-a16)"
                  : dayEvents.length
                    ? "var(--eb-ivory-a06)"
                    : "transparent",
                borderColor: on ? "var(--eb-nude-500)" : "var(--border-hairline)",
              }}
            >
              <span
                className="pl-0.5 font-mono text-xs"
                style={{
                  color: on ? "var(--eb-nude-300)" : "var(--text-secondary)",
                  fontWeight: on ? 500 : 400,
                }}
              >
                {day}
              </span>
              {dayEvents.slice(0, 2).map((event, i) => (
                <span
                  key={i}
                  title={`${event.time} ${event.client}`}
                  className="flex min-w-0 flex-col rounded-[5px] px-[5px] py-0.5 text-[10.5px] leading-[1.3]"
                  style={{
                    background: `color-mix(in oklch, ${dotFor(event.status)} 22%, transparent)`,
                    borderLeft: `2px solid ${dotFor(event.status)}`,
                  }}
                >
                  <span className="truncate whitespace-nowrap">{event.client.split(" ")[0]}</span>
                  <span className="overflow-hidden whitespace-nowrap font-mono text-[9.5px] text-[var(--text-secondary)] [@container(max-width:62px)]:hidden">
                    {event.time}
                  </span>
                </span>
              ))}
              {dayEvents.length > 2 ? (
                <span className="pl-[3px] text-[10.5px] text-muted-foreground">
                  +{dayEvents.length - 2}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
