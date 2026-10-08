import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";

import { Icon } from "@/components/eb/icon";
import { cn } from "@/lib/utils";

type Base = {
  label?: string | undefined;
  icon?: string | undefined;
  hint?: string | undefined;
  error?: string | undefined;
  trailing?: ReactNode;
  className?: string | undefined;
};

const control =
  "w-full rounded-[var(--radius-md)] border bg-[var(--surface-field)] text-[15px] text-foreground placeholder:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Campo do design system: rótulo, ícone, ajuda, erro, sufixo e, se pedido, várias linhas. */
export function Input({
  label,
  icon,
  hint,
  error,
  trailing,
  multiline,
  rows = 3,
  type = "text",
  className,
  ...props
}: Base & { multiline?: boolean; rows?: number } & Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "className"
  >) {
  const id = useId();
  const [reveal, setReveal] = useState(false);
  const isPassword = type === "password";
  const border = error ? "border-[var(--coral)]" : "border-[var(--border-card)]";
  const noteId = `${id}-nota`;

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
        {icon ? (
          <span className="pointer-events-none absolute left-3.5 text-muted-foreground">
            <Icon name={icon} size={17} />
          </span>
        ) : null}
        {multiline ? (
          <textarea
            id={id}
            rows={rows}
            aria-invalid={error ? true : undefined}
            aria-describedby={error || hint ? noteId : undefined}
            className={cn(control, border, "resize-y px-3.5 py-3 leading-normal")}
            {...(props as unknown as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
          />
        ) : (
          <input
            id={id}
            type={isPassword && reveal ? "text" : type}
            aria-invalid={error ? true : undefined}
            aria-describedby={error || hint ? noteId : undefined}
            className={cn(
              control,
              border,
              "min-h-11 px-3.5",
              icon && "pl-[42px]",
              (isPassword || trailing) && "pr-11",
            )}
            {...props}
          />
        )}
        {isPassword ? (
          <button
            type="button"
            onClick={() => setReveal((value) => !value)}
            aria-label={reveal ? "Ocultar senha" : "Mostrar senha"}
            className="absolute right-1.5 grid size-9 place-items-center rounded-full text-muted-foreground"
          >
            <Icon name={reveal ? "EyeOff" : "Eye"} size={17} />
          </button>
        ) : trailing ? (
          <span className="pointer-events-none absolute right-3.5 text-[13px] text-muted-foreground">
            {trailing}
          </span>
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
          {error ? <Icon name="AlertCircle" size={13} /> : null}
          {error ?? hint}
        </p>
      ) : null}
    </div>
  );
}
