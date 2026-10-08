import { useEffect, useState } from "react";
import { Check } from "lucide-react";

import { findZone, type FaceZone } from "@/components/facemap/face-data";
import { FaceGeneralActions } from "@/components/facemap/face-general-actions";
import { FaceMap } from "@/components/facemap/face-map";
import { FaceMapHistory } from "@/components/facemap/face-map-history";
import type { ZonePhotos } from "@/components/eb/face-zone-photos";
import { FaceMapSheet } from "@/components/facemap/face-map-sheet";
import { useMediaQuery } from "@/lib/use-media-query";
import { useGeneralActions } from "@/lib/face-general-actions";
import {
  buildMarks,
  historyForZone,
  useFaceMap,
  type FaceMark,
  type FacePoint,
  type FaceRecord,
} from "@/lib/face-map-store";

const label =
  "text-[11px] font-medium uppercase leading-none tracking-[0.14em] text-muted-foreground";

/**
 * Mapa facial de uma cliente, só na vista frontal. Toque numa região para
 * selecionar, toque de novo dentro dela para pousar um ponto e registre no painel.
 */
export function FaceMapPanel({
  clientId,
  seed,
  showGeneralActions = true,
}: {
  clientId: string;
  seed?: FaceMark[] | undefined;
  showGeneralActions?: boolean;
}) {
  const { marks, add, remove, removeZone } = useFaceMap(clientId, seed);
  const { actions, update } = useGeneralActions();
  const [selected, setSelected] = useState<string | null>(null);
  const [points, setPoints] = useState<Record<string, FacePoint[]>>({});
  const [applied, setApplied] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [zonePhotos, setZonePhotos] = useState<Record<string, ZonePhotos>>({});

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2400);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const wide = useMediaQuery("(min-width: 1024px)");
  const zone = selected ? findZone(selected) : null;
  const pending = selected ? (points[selected] ?? []) : [];

  const select = (next: FaceZone) => setSelected(next.id);
  const addPoint = (zoneId: string, point: FacePoint) =>
    setPoints((current) => ({ ...current, [zoneId]: [...(current[zoneId] ?? []), point] }));

  const save = (record: FaceRecord, mirror: boolean) => {
    if (!zone) return;
    const made = buildMarks(zone.id, record, pending, mirror);
    add(made);
    setPoints((current) => ({ ...current, [zone.id]: [] }));
    setSelected(null);
    setNotice(made.length > 1 ? "Marcação salva nas duas regiões" : "Marcação salva");
  };

  const clear = () => {
    if (!zone) return;
    removeZone(zone.id);
    setPoints((current) => ({ ...current, [zone.id]: [] }));
    setSelected(null);
  };

  const sheet = (
    <FaceMapSheet
      inline={wide}
      zone={zone}
      pointCount={pending.length}
      history={zone ? historyForZone(marks, zone.id) : []}
      photos={zone ? zonePhotos[zone.id] : undefined}
      onPhotosChange={(next) => {
        if (zone) setZonePhotos((current) => ({ ...current, [zone.id]: next }));
      }}
      onClose={() => setSelected(null)}
      onSave={save}
      onClear={clear}
    />
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
      <div className="relative mx-auto w-full max-w-[440px] overflow-hidden rounded-[var(--radius-xl)]">
        <FaceMap
          selected={selected}
          onSelectZone={select}
          points={pending}
          onAddPoint={addPoint}
          marks={marks}
        />

        {notice ? (
          <div
            role="status"
            className="absolute inset-x-0 top-3 z-20 mx-auto flex w-fit items-center gap-2 rounded-full border border-[var(--eb-teal-a40)] bg-[var(--eb-plum-800)] px-4 py-2 text-[13.5px] text-foreground"
            style={{
              boxShadow: "var(--shadow-raised)",
              animation: "sheet-in 280ms cubic-bezier(.16,1,.3,1)",
            }}
          >
            <Check className="size-4 text-[var(--teal)]" aria-hidden /> {notice}
          </div>
        ) : null}

        {wide ? null : sheet}
      </div>

      <div className="flex min-w-0 flex-col gap-5">
        {wide && zone ? sheet : null}
        <div className="flex flex-col gap-1.5">
          <span className={label}>Região selecionada</span>
          <span
            aria-live="polite"
            className={
              zone ? "text-[12.5px] text-foreground" : "text-[12.5px] text-muted-foreground"
            }
          >
            {zone
              ? `${zone.nome}. Toque de novo dentro dela para pousar um ponto de ação.`
              : "Toque em uma das 18 regiões do rosto."}
          </span>
        </div>

        {showGeneralActions ? (
          <FaceGeneralActions
            actions={actions}
            onChange={update}
            applied={applied}
            onApply={(action, on) => setApplied((current) => ({ ...current, [action.id]: on }))}
          />
        ) : null}

        <div className="flex flex-col gap-2.5">
          <span className={label}>Histórico</span>
          <FaceMapHistory
            marks={marks}
            onSelect={(mark) => setSelected(mark.zoneId)}
            onRemove={(mark) => remove(mark.id)}
          />
        </div>
      </div>
    </div>
  );
}
