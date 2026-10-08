import { Icon } from "@/components/eb/icon";

export type AlertTone = "info" | "warn" | "danger" | "tech";

const tones: Record<AlertTone, { fg: string; bg: string; bd: string }> = {
  info: { fg: "var(--eb-nude-500)", bg: "var(--eb-nude-a08)", bd: "var(--eb-nude-a16)" },
  warn: { fg: "var(--eb-amber-500)", bg: "var(--eb-amber-a16)", bd: "rgba(216,166,83,.28)" },
  danger: { fg: "var(--eb-coral-500)", bg: "var(--eb-coral-a16)", bd: "rgba(201,109,109,.28)" },
  tech: { fg: "var(--eb-teal-500)", bg: "var(--eb-teal-a12)", bd: "var(--eb-teal-a24)" },
};

/** Alertas acionáveis: cada um tem exatamente uma ação. */
export function AlertCard({
  icon = "Bell",
  title,
  description,
  tone = "warn",
  actionLabel,
  onAction,
  onDismiss,
}: {
  icon?: string;
  title: string;
  description?: string;
  tone?: AlertTone;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
}) {
  const t = tones[tone] ?? tones.warn;
  return (
    <div
      className="flex items-start gap-3 rounded-[var(--radius-md)] border px-3.5 py-3"
      style={{ background: t.bg, borderColor: t.bd }}
    >
      <span
        className="grid size-[30px] flex-none place-items-center rounded-full bg-[var(--eb-ivory-a06)]"
        style={{ color: t.fg }}
      >
        <Icon name={icon} size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-medium text-foreground">{title}</div>
        {description ? (
          <div className="mt-0.5 text-[12.5px] text-[var(--text-secondary)]">{description}</div>
        ) : null}
      </div>
      {actionLabel ? (
        <button
          type="button"
          onClick={onAction}
          className="min-h-11 flex-none rounded-full border bg-transparent px-3 text-[12.5px] font-medium"
          style={{ borderColor: t.bd, color: t.fg }}
        >
          {actionLabel}
        </button>
      ) : null}
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dispensar"
          className="p-0.5 text-muted-foreground"
        >
          <Icon name="X" size={14} />
        </button>
      ) : null}
    </div>
  );
}
