import { Icon } from "@/components/eb/icon";
import { cn } from "@/lib/utils";

/** Etapas curtas e sempre escapáveis: nada clínico é guardado até a profissional confirmar. */
export function AnamnesisStepper({
  steps,
  current = 0,
  onSelect,
}: {
  steps: { label: string }[];
  current?: number;
  onSelect?: (index: number) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <span className="text-[11px] font-medium uppercase leading-[1.2] tracking-[0.14em] text-muted-foreground">
          Etapa {current + 1} de {steps.length}
        </span>
        <span className="text-[17px] font-medium text-foreground">{steps[current]?.label}</span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={current + 1}
        aria-valuemin={1}
        aria-valuemax={steps.length}
        className="flex gap-1.5"
      >
        {steps.map((step, index) => (
          <span
            key={step.label}
            className="h-[5px] flex-1 rounded-full transition-colors"
            style={{ background: index <= current ? "var(--eb-teal-500)" : "var(--eb-ivory-a06)" }}
          />
        ))}
      </div>
      <ol className="m-0 flex list-none gap-2.5 overflow-x-auto p-0 pb-1.5">
        {steps.map((step, index) => {
          const done = index < current;
          const on = index === current;
          return (
            <li key={step.label} className="flex-none">
              <button
                type="button"
                onClick={() => onSelect?.(index)}
                aria-current={on ? "step" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-2.5 whitespace-nowrap rounded-full border py-0 pl-2 pr-4 text-[13px]",
                  on
                    ? "border-[var(--eb-teal-a40)] bg-[var(--eb-teal-a12)] text-foreground"
                    : "border-[var(--border-hairline)] bg-transparent",
                  !on && (done ? "text-[var(--text-secondary)]" : "text-muted-foreground"),
                )}
              >
                <span
                  className="grid size-[26px] flex-none place-items-center rounded-full text-[11.5px]"
                  style={{
                    background: done
                      ? "var(--eb-teal-500)"
                      : on
                        ? "var(--eb-teal-a40)"
                        : "var(--eb-ivory-a06)",
                    color: done ? "var(--eb-plum-900)" : "var(--text-primary)",
                  }}
                >
                  {done ? <Icon name="Check" size={13} strokeWidth={2.4} /> : index + 1}
                </span>
                {step.label}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
