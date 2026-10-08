import { useId, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/** Lista de opções no mesmo desenho dos campos do design system. */
export function Select({
  label,
  options,
  error,
  className,
  ...props
}: { label?: string; options: string[]; error?: string | undefined; className?: string } & Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "className" | "children"
>) {
  const id = useId();
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? (
        <label
          htmlFor={id}
          className="text-[12.5px] tracking-[0.02em] text-[var(--text-secondary)]"
        >
          {label}
        </label>
      ) : null}
      <div className="relative flex items-center">
        <select
          id={id}
          aria-invalid={error ? true : undefined}
          className={cn(
            "min-h-11 w-full appearance-none rounded-[var(--radius-md)] border bg-[var(--surface-field)] pl-3.5 pr-10 text-[15px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            error ? "border-[var(--coral)]" : "border-[var(--border-card)]",
          )}
          {...props}
        >
          {options.map((option) => (
            <option key={option} value={option} className="bg-[var(--surface-raised)]">
              {option}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3.5 size-4 text-muted-foreground"
          aria-hidden
        />
      </div>
      {error ? <p className="text-xs text-[var(--coral)]">{error}</p> : null}
    </div>
  );
}
