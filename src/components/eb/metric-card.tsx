import { Icon } from "@/components/eb/icon";

const toneColor = {
  neutral: "var(--eb-nude-300)",
  tech: "var(--eb-teal-500)",
  warn: "var(--eb-amber-500)",
  danger: "var(--eb-coral-500)",
} as const;

export function MetricCard({
  label,
  value,
  unit,
  hint,
  icon,
  tone = "neutral",
  onClick,
}: {
  label: string;
  value: string | number;
  unit?: string;
  hint?: string;
  icon?: string;
  tone?: keyof typeof toneColor;
  onClick?: () => void;
}) {
  const color = toneColor[tone];
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className="flex flex-col gap-1.5 rounded-[var(--radius-lg)] border border-[var(--border-card)] bg-[var(--surface-card)] px-4 py-3.5 text-left transition-colors"
      style={{ boxShadow: "var(--shadow-card)", cursor: onClick ? "pointer" : "default" }}
    >
      <div className="flex items-center gap-[7px]">
        {icon ? <Icon name={icon} size={14} color={color} /> : null}
        <span className="text-[11px] font-medium uppercase leading-[1.2] tracking-[0.14em] text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <span
          className="font-mono text-[28px] font-medium leading-[1.05] tracking-[-0.02em]"
          style={{ color }}
        >
          {value}
        </span>
        {unit ? <span className="text-[13px] text-muted-foreground">{unit}</span> : null}
      </div>
      {hint ? <span className="text-xs text-[var(--text-secondary)]">{hint}</span> : null}
    </Tag>
  );
}
