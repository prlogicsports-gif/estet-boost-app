import { useId, useState } from "react";

import { Icon } from "@/components/eb/icon";

export type ZonePhoto = { src: string; date: string; name: string };
export type ZonePhotos = { before?: ZonePhoto; after?: ZonePhoto };

function Slot({
  label,
  photo,
  onPick,
  onClear,
}: {
  label: string;
  photo: ZonePhoto | undefined;
  onPick: (file: File) => void;
  onClear: () => void;
}) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase leading-[1.2] tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      {photo ? (
        <div className="relative aspect-[3/4] overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-card)] bg-[var(--eb-plum-900)]">
          <img
            src={photo.src}
            alt={`${label} — ${photo.date}`}
            className="size-full object-cover"
          />
          <button
            type="button"
            onClick={onClear}
            aria-label={`Remover fotografia de ${label}`}
            className="absolute right-0.5 top-0.5 grid size-11 place-items-center"
          >
            <span className="grid size-7 place-items-center rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg-strong)] backdrop-blur-[10px]">
              <Icon name="X" size={13} />
            </span>
          </button>
          <span className="absolute bottom-1.5 left-1.5 rounded-full border border-[var(--glass-border)] bg-[rgba(36,28,32,.7)] px-2 py-[3px] text-[10.5px]">
            {photo.date}
          </span>
        </div>
      ) : (
        <>
          <input
            id={id}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onPick(file);
            }}
          />
          <label
            htmlFor={id}
            className="flex aspect-[3/4] cursor-pointer flex-col items-center justify-center gap-[7px] rounded-[var(--radius-md)] border border-dashed border-[var(--border-card)] bg-[var(--eb-ivory-a06)] p-2 text-center text-xs text-[var(--text-secondary)]"
          >
            <Icon name="ImagePlus" size={20} color="var(--eb-nude-300)" />
            Anexar {label.toLowerCase()}
          </label>
        </>
      )}
    </div>
  );
}

/** Par antes e depois de uma região do mapa facial. A imagem vira um endereço local e fica no estado da tela. */
export function FaceZonePhotos({
  photos,
  onChange,
  zoneLabel,
}: {
  photos: ZonePhotos;
  onChange: (next: ZonePhotos) => void;
  zoneLabel?: string;
}) {
  const [compare, setCompare] = useState(false);
  const [pos, setPos] = useState(50);
  const both = photos.before && photos.after;

  const pick = (slot: "before" | "after") => (file: File) =>
    onChange({
      ...photos,
      [slot]: {
        src: URL.createObjectURL(file),
        date: new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
        name: file.name,
      },
    });

  const clear = (slot: "before" | "after") => () => {
    const next = { ...photos };
    delete next[slot];
    onChange(next);
    if (!(next.before && next.after)) setCompare(false);
  };

  return (
    <div className="flex flex-col gap-2.5">
      {photos.before && photos.after && compare ? (
        <div className="relative aspect-[3/4] overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-card)] bg-[var(--eb-plum-900)]">
          <img src={photos.after.src} alt="Depois" className="size-full object-cover" />
          <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
            <img
              src={photos.before.src}
              alt="Antes"
              className="size-full min-w-full object-cover"
            />
          </div>
          <div
            className="pointer-events-none absolute inset-y-0 w-0.5 bg-[var(--eb-teal-500)]"
            style={{ left: `${pos}%` }}
          />
          <input
            type="range"
            min={0}
            max={100}
            value={pos}
            aria-label={`Comparar antes e depois de ${zoneLabel ?? "região"}`}
            onChange={(event) => setPos(Number(event.target.value))}
            className="absolute inset-x-2.5 bottom-2.5 w-auto accent-[var(--eb-teal-500)]"
          />
        </div>
      ) : (
        <div className="flex gap-2.5">
          <Slot
            label="Antes"
            photo={photos.before}
            onPick={pick("before")}
            onClear={clear("before")}
          />
          <Slot
            label="Depois"
            photo={photos.after}
            onPick={pick("after")}
            onClear={clear("after")}
          />
        </div>
      )}
      {both ? (
        <button
          type="button"
          onClick={() => setCompare((value) => !value)}
          className="flex min-h-11 items-center gap-[7px] self-start text-[12.5px] text-[var(--teal)]"
        >
          <Icon name={compare ? "Columns2" : "ChevronsLeftRight"} size={14} />
          {compare ? "Ver os dois lado a lado" : "Comparar com controle deslizante"}
        </button>
      ) : null}
      <p className="flex items-start gap-[7px] text-[11.5px] leading-[1.6] text-muted-foreground">
        <Icon name="ShieldCheck" size={13} className="mt-0.5 flex-none" />
        <span>
          A fotografia fica vinculada a esta região e só aparece para a cliente se a autorização de
          imagem estiver ativa.
        </span>
      </p>
    </div>
  );
}
