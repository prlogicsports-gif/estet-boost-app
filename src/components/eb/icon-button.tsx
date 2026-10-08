import type { ButtonHTMLAttributes } from "react";

import { Icon } from "@/components/eb/icon";
import { cn } from "@/lib/utils";

const tones = {
  quiet: "border-transparent bg-transparent text-[var(--text-secondary)]",
  outline: "border-[var(--border-card)] bg-[var(--eb-ivory-a06)] text-foreground",
  solid: "border-transparent bg-[var(--eb-nude-500)] text-[var(--text-on-nude)]",
} as const;

export function IconButton({
  icon,
  label,
  tone = "quiet",
  size = 44,
  badge,
  className,
  ...props
}: {
  icon: string;
  label: string;
  tone?: keyof typeof tones;
  size?: number;
  badge?: number | string | undefined;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border transition-colors",
        tones[tone],
        className,
      )}
      style={{ width: size, height: size }}
      {...props}
    >
      <Icon name={icon} size={Math.round(size * 0.45)} />
      {badge ? (
        <span
          className="absolute grid h-4 min-w-4 place-items-center rounded-full bg-[var(--eb-teal-500)] px-1 text-[10px] font-semibold text-[var(--eb-plum-900)]"
          style={{ top: size * 0.2, right: size * 0.2 }}
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}
