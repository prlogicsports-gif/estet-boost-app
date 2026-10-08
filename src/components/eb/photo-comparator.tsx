import { useState } from "react";

import { Icon } from "@/components/eb/icon";

type Side = { src: string; alt?: string; label?: string };

/** Antes e depois: com controle deslizante ou lado a lado. */
export function PhotoComparator({
  before,
  after,
  mode = "slider",
  onModeChange,
  meta,
}: {
  before: Side;
  after: Side;
  mode?: "slider" | "side";
  onModeChange?: (mode: "slider" | "side") => void;
  meta?: { icon?: string; label: string }[];
}) {
  const [pos, setPos] = useState(50);
  const frame =
    "relative aspect-[4/5] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-card)] bg-[var(--eb-plum-700)]";
  const tag = (text: string, side: "left" | "right") => (
    <span
      className="absolute top-2.5 rounded-full border border-[var(--glass-border)] bg-[rgba(36,28,32,.66)] px-[9px] py-[3px] text-[11px] backdrop-blur-[10px]"
      style={{ [side]: 10 }}
    >
      {text}
    </span>
  );
  return (
    <div className="flex flex-col gap-2.5">
      {mode === "side" ? (
        <div className="grid grid-cols-2 gap-2">
          <div className={frame}>
            <img src={before.src} alt={before.alt ?? "Antes"} className="size-full object-cover" />
            {tag(before.label ?? "Antes", "left")}
          </div>
          <div className={frame}>
            <img src={after.src} alt={after.alt ?? "Depois"} className="size-full object-cover" />
            {tag(after.label ?? "Depois", "right")}
          </div>
        </div>
      ) : (
        <div className={frame}>
          <img src={after.src} alt={after.alt ?? "Depois"} className="size-full object-cover" />
          <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
            <img
              src={before.src}
              alt={before.alt ?? "Antes"}
              className="size-full min-w-full object-cover"
            />
          </div>
          <div
            className="pointer-events-none absolute inset-y-0 w-0.5 bg-[var(--eb-teal-500)]"
            style={{ left: `${pos}%` }}
          >
            <span className="absolute left-1/2 top-1/2 grid size-[34px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg-strong)] backdrop-blur-[12px]">
              <Icon name="ChevronsLeftRight" size={15} color="var(--eb-ivory-100)" />
            </span>
          </div>
          {tag(before.label ?? "Antes", "left")}
          {tag(after.label ?? "Depois", "right")}
          <input
            type="range"
            min={0}
            max={100}
            value={pos}
            aria-label="Comparar antes e depois"
            onChange={(event) => setPos(Number(event.target.value))}
            className="absolute inset-x-3 bottom-3 w-auto accent-[var(--eb-teal-500)]"
          />
        </div>
      )}
      {meta ? (
        <div className="flex flex-wrap gap-2">
          {meta.map((item) => (
            <span
              key={item.label}
              className="inline-flex items-center gap-[5px] rounded-full bg-[var(--eb-ivory-a06)] px-[9px] py-1 text-[11.5px] text-[var(--text-secondary)]"
            >
              {item.icon ? <Icon name={item.icon} size={12} /> : null}
              {item.label}
            </span>
          ))}
        </div>
      ) : null}
      {onModeChange ? (
        <button
          type="button"
          onClick={() => onModeChange(mode === "slider" ? "side" : "slider")}
          className="min-h-11 self-start text-[12.5px] text-[var(--teal)]"
        >
          {mode === "slider" ? "Ver lado a lado" : "Ver com controle deslizante"}
        </button>
      ) : null}
    </div>
  );
}
