import { useEffect, useState } from "react";
import { Check } from "lucide-react";

import type { FaceZone } from "@/components/facemap/face-data";
import { FaceGeneralActions } from "@/components/facemap/face-general-actions";
import { FaceMap } from "@/components/facemap/face-map";
import { FaceMapEditor } from "@/components/facemap/face-map-editor";
import { FaceMapHistory } from "@/components/facemap/face-map-history";
import { SegmentedTabs } from "@/components/eb/segmented-tabs";
import type { ZonePhotos } from "@/components/eb/face-zone-photos";
import { FaceMapSheet } from "@/components/facemap/face-map-sheet";
import { useFaceLayout } from "@/lib/face-layout";
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
  showGeneralActions = true,
}: {
  clientId: string;
  showGeneralActions?: boolean;
}) {
  const { marks, add, remove, removeZone } = useFaceMap(clientId);
  const { actions, update } = useGeneralActions();
  const [selected, setSelected] = useState<string | null>(null);
  const [points, setPoints] = useState<Record<string, FacePoint[]>>({});
  const [applied, setApplied] = useState<Record<string, boolean>>({});
  const [mode, setMode] = useState<"registrar" | "editar">("registrar");
  const [notice, setNotice] = useState<string | null>(null);
  const [zonePhotos, setZonePhotos] = useState<Record<string, ZonePhotos>>({});

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2400);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const layout = useFaceLayout();
  const wide = useMediaQuery("(min-width: 1024px)");
  const base = selected ? layout.zoneById(selected) : null;
  const zone = base ? { ...base, nome: layout.nameOf(base.id) } : null;
  const pending = selected ? (points[selected] ?? []) : [];

  const select = (next: FaceZone) => setSelected(next.id);
  const addPoint = (zoneId: string, point: FacePoint) =>
    setPoints((current) => ({ ...current, [zoneId]: [...(current[zoneId] ?? []), point] }));

  const save = (record: FaceRecord, pairId: string | null) => {
    if (!zone) return;
    const made = buildMarks(zone.id, record, pending, pairId);
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

  const tabs = (
    <SegmentedTabs
      size="sm"
      active={mode}
      onSelect={(next) => {
        setMode(next);
        setSelected(null);
      }}
      tabs={[
        { id: "registrar", label: "Registrar" },
        { id: "editar", label: "Editar regiões" },
      ]}
      className="mb-3.5 max-w-xs"
    />
  );

  if (mode === "editar") {
    return (
      <div>
        {tabs}
        <FaceMapEditor onExit={() => setMode("registrar")} />
      </div>
    );
  }

  return (
    <div>
      {tabs}
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
    </div>
  );
}
