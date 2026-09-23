import * as React from "react";

import { cn } from "@/lib/utils";

export const Field = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { label: string }
>(({ label, className, id, ...props }, ref) => {
  const autoId = React.useId();
  const inputId = id ?? autoId;
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-xs text-muted-foreground">
        {label}
      </label>
      <input
        id={inputId}
        ref={ref}
        className={cn(
          "min-h-11 w-full rounded-[var(--radius-md)] border border-input bg-[var(--muted)] px-3.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
        {...props}
      />
    </div>
  );
});
Field.displayName = "Field";
