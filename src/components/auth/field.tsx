import * as React from "react";
import { AlertCircle, Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils";

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  icon?: React.ReactNode;
  hint?: string;
  error?: string | undefined;
};

export const Field = React.forwardRef<HTMLInputElement, FieldProps>(
  ({ label, icon, hint, error, className, id, type = "text", ...props }, ref) => {
    const autoId = React.useId();
    const inputId = id ?? autoId;
    const noteId = `${inputId}-nota`;
    const [reveal, setReveal] = React.useState(false);
    const isPassword = type === "password";

    return (
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={inputId}
          className="text-[12.5px] tracking-[0.02em] text-[var(--text-secondary)]"
        >
          {label}
        </label>
        <div className="relative flex items-center">
          {icon ? (
            <span className="pointer-events-none absolute left-3.5 text-muted-foreground [&_svg]:size-[17px]">
              {icon}
            </span>
          ) : null}
          <input
            id={inputId}
            ref={ref}
            type={isPassword && reveal ? "text" : type}
            aria-invalid={error ? true : undefined}
            aria-describedby={error || hint ? noteId : undefined}
            className={cn(
              "min-h-11 w-full rounded-[var(--radius-md)] border bg-[var(--surface-field)] px-3.5 text-[15px] text-foreground placeholder:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              error ? "border-[var(--coral)]" : "border-[var(--border-card)]",
              icon && "pl-[42px]",
              isPassword && "pr-11",
              className,
            )}
            {...props}
          />
          {isPassword ? (
            <button
              type="button"
              onClick={() => setReveal((value) => !value)}
              aria-label={reveal ? "Ocultar senha" : "Mostrar senha"}
              className="absolute right-1.5 grid size-9 place-items-center rounded-full text-muted-foreground hover:text-foreground"
            >
              {reveal ? (
                <EyeOff className="size-[17px]" aria-hidden />
              ) : (
                <Eye className="size-[17px]" aria-hidden />
              )}
            </button>
          ) : null}
        </div>
        {error || hint ? (
          <p
            id={noteId}
            className={cn(
              "flex items-center gap-1.5 text-xs",
              error ? "text-[var(--coral)]" : "text-muted-foreground",
            )}
          >
            {error ? <AlertCircle className="size-3.5" aria-hidden /> : null}
            {error ?? hint}
          </p>
        ) : null}
      </div>
    );
  },
);
Field.displayName = "Field";
