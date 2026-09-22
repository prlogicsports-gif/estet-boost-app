import { cn } from "@/lib/utils";

export function BrandMark({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-baseline text-[inherit] leading-none", className)} aria-label="EstetBoost.">
      <span className="font-light text-foreground">{compact ? "E" : "Estet"}</span>
      <span className="font-medium text-primary">{compact ? "B" : "Boost"}</span>
      <span className="font-medium text-[var(--teal)]">.</span>
    </span>
  );
}