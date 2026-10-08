import { Icon } from "@/components/eb/icon";

export type TimelineEntry = {
  id: string;
  date: string;
  procedure: string;
  region?: string;
  product?: string;
  note?: string;
  photos?: number;
  payment?: string;
  professional?: string;
  /** Pode ser corrigido pela esteticista. */
  editable?: boolean;
};

function Meta({ icon, label }: { icon: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-[5px] rounded-full bg-[var(--eb-ivory-a06)] px-2 py-[3px] text-[11.5px] text-muted-foreground">
      <Icon name={icon} size={12} />
      {label}
    </span>
  );
}

export function ClientTimeline({
  entries,
  onSelect,
  selectLabel = "Ver detalhes",
}: {
  entries: TimelineEntry[];
  onSelect?: (entry: TimelineEntry) => void;
  selectLabel?: string;
}) {
  return (
    <ol className="m-0 flex list-none flex-col p-0">
      {entries.map((entry, index) => (
        <li key={entry.id} className="flex gap-3.5">
          <div className="flex w-[22px] flex-none flex-col items-center">
            <span
              className="mt-4 size-2.5 rounded-full"
              style={{
                background: index === 0 ? "var(--eb-teal-500)" : "var(--eb-nude-a32)",
                boxShadow: index === 0 ? "0 0 0 4px var(--eb-teal-a12)" : "none",
              }}
            />
            {index < entries.length - 1 ? (
              <span className="mt-1.5 w-px flex-1 bg-[var(--border-hairline)]" />
            ) : null}
          </div>
          <div className="min-w-0 flex-1 pb-[18px] pt-3">
            <div className="flex flex-wrap items-baseline gap-2.5">
              <span className="font-mono text-xs text-muted-foreground">{entry.date}</span>
              <span className="text-[14.5px] font-medium">{entry.procedure}</span>
            </div>
            {entry.region ? (
              <div className="mt-[3px] text-[12.5px] text-[var(--text-secondary)]">
                Região: {entry.region}
              </div>
            ) : null}
            {entry.product ? (
              <div className="text-[12.5px] text-[var(--text-secondary)]">
                Produto: {entry.product}
              </div>
            ) : null}
            {entry.note ? (
              <p className="mt-1.5 text-[13px] text-[var(--text-secondary)]">{entry.note}</p>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {entry.photos ? (
                <Meta icon="Images" label={`${entry.photos} foto${entry.photos > 1 ? "s" : ""}`} />
              ) : null}
              {entry.payment ? <Meta icon="Wallet" label={entry.payment} /> : null}
              {entry.professional ? <Meta icon="User" label={entry.professional} /> : null}
              {onSelect && entry.editable ? (
                <button
                  type="button"
                  onClick={() => onSelect(entry)}
                  className="min-h-11 text-[12.5px] text-[var(--teal)]"
                >
                  {selectLabel}
                </button>
              ) : null}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
