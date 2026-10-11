import { proceduresDb } from "@/data/db";
import { cn } from "@/lib/utils";

/**
 * Escolha dos procedimentos que uma pessoa da equipe realiza (a partir do Catálogo).
 * Lista vazia = todos os procedimentos.
 */
export function ProcedurePicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const catalog = proceduresDb.use();
  const some = value.length > 0;
  const radio = (on: boolean) =>
    cn(
      "flex min-h-12 w-full items-center gap-3 rounded-[var(--radius-md)] border px-3.5 py-2 text-left text-[14px]",
      on
        ? "border-[var(--eb-teal-a40)] bg-[var(--eb-teal-a12)]"
        : "border-[var(--border-card)] bg-[var(--surface-card)]",
    );

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-pressed={!some}
        className={radio(!some)}
        onClick={() => onChange([])}
      >
        <span className="flex-1">Todos os procedimentos</span>
      </button>
      <button
        type="button"
        aria-pressed={some}
        className={radio(some)}
        disabled={!catalog.length}
        onClick={() => !some && catalog[0] && onChange([catalog[0].id])}
      >
        <span className="flex-1">Só alguns procedimentos</span>
      </button>
      {!catalog.length ? (
        <p className="text-xs text-muted-foreground">
          Cadastre os procedimentos no Catálogo para escolher quais ela realiza.
        </p>
      ) : null}
      {some
        ? catalog.map((item) => {
            const on = value.includes(item.id);
            return (
              <label
                key={item.id}
                className="flex min-h-12 items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-card)] bg-[var(--surface-card)] px-3.5 py-2"
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() =>
                    onChange(on ? value.filter((id) => id !== item.id) : [...value, item.id])
                  }
                  className="size-5 flex-none accent-[var(--teal)]"
                />
                <span className="min-w-0 flex-1 break-words text-[14px]">{item.name}</span>
                <span className="flex-none font-mono text-xs text-muted-foreground">
                  {item.duration} min
                </span>
              </label>
            );
          })
        : null}
      {some ? (
        <p className="text-xs text-muted-foreground">
          {value.length === 1
            ? "1 procedimento marcado."
            : `${value.length} procedimentos marcados.`}{" "}
          Ela só agenda e atende o que estiver marcado. Para liberar tudo, escolha "Todos os
          procedimentos".
        </p>
      ) : null}
    </div>
  );
}
