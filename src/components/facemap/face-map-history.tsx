import { useMemo } from "react";
import { Trash2 } from "lucide-react";

import { useFaceLayout } from "@/lib/face-layout";
import type { FaceMark } from "@/lib/face-map-store";

const dotColor = (state: FaceMark["state"]) =>
  state === "sensitive"
    ? "var(--eb-coral-500)"
    : state === "planned"
      ? "var(--eb-nude-500)"
      : "var(--eb-teal-500)";

const summarize = (mark: FaceMark) =>
  [mark.procedimento, mark.produto, mark.acao].filter(Boolean).join(" · ") || "—";

/** Histórico de marcações da cliente, agrupado por data: o registro do que foi feito em cada região. */
export function FaceMapHistory({
  marks,
  onSelect,
  onRemove,
  emptyLabel = "Nenhuma marcação ainda. Toque em uma região do rosto para registrar.",
}: {
  marks: FaceMark[];
  onSelect?: (mark: FaceMark) => void;
  onRemove?: (mark: FaceMark) => void;
  emptyLabel?: string;
}) {
  const layout = useFaceLayout();
  const groups = useMemo(() => {
    const buckets = new Map<string, FaceMark[]>();
    for (const mark of marks) buckets.set(mark.date, [...(buckets.get(mark.date) ?? []), mark]);
    return [...buckets.entries()]
      .map(([date, items]) => ({ date, items, at: items[0]?.savedAt ?? "" }))
      .sort((a, b) => b.at.localeCompare(a.at));
  }, [marks]);

  if (!marks.length) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border-card)] bg-[var(--eb-ivory-a06)] px-[18px] py-[22px] text-center">
        <p className="text-[13.5px] text-[var(--text-secondary)]">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <div key={group.date} className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium uppercase leading-none tracking-[0.14em] text-muted-foreground">
            {group.date}
          </span>
          {group.items.map((mark) => (
            <div
              key={mark.id}
              className="flex items-start gap-[11px] rounded-[var(--radius-md)] border border-[var(--border-card)] bg-card px-[13px] py-[11px]"
            >
              <span
                className="mt-1.5 size-2 flex-none rounded-full"
                style={{ background: dotColor(mark.state) }}
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground">
                  {layout.nameOf(mark.zoneId)}
                </div>
                <div className="mt-0.5 text-[12.5px] text-[var(--text-secondary)]">
                  {summarize(mark)}
                </div>
                {mark.observacao ? (
                  <p className="mt-1 text-[12.5px] text-muted-foreground">{mark.observacao}</p>
                ) : null}
                {onSelect ? (
                  <button
                    type="button"
                    onClick={() => onSelect(mark)}
                    className="min-h-11 pt-1.5 text-xs text-[var(--teal)] underline-offset-4 hover:underline"
                  >
                    Ver no mapa
                  </button>
                ) : null}
              </div>
              {onRemove ? (
                <button
                  type="button"
                  onClick={() => onRemove(mark)}
                  aria-label={`Remover marcação de ${layout.nameOf(mark.zoneId)}`}
                  className="grid size-11 flex-none place-items-center text-muted-foreground hover:text-foreground"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
