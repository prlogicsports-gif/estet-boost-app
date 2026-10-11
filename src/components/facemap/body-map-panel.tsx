import { useEffect, useState } from "react";
import { Check } from "lucide-react";

import { BODY_MAPS, type BodyKind } from "@/components/facemap/body-data";
import { BodyMap } from "@/components/facemap/body-map";
import type { FaceZone } from "@/components/facemap/face-data";
import { FaceMapHistory } from "@/components/facemap/face-map-history";
import { FaceMapSheet } from "@/components/facemap/face-map-sheet";
import {
  buildMarks,
  historyForZone,
  useFaceMap,
  type FacePoint,
  type FaceRecord,
} from "@/lib/face-map-store";
import { mapKindOf } from "@/components/facemap/body-data";
import { useMediaQuery } from "@/lib/use-media-query";

const label =
  "text-[11px] font-medium uppercase leading-none tracking-[0.14em] text-muted-foreground";

/**
 * Registro de procedimentos nos mapas de corpo (abdômen e glúteo): mesmo fluxo do mapa facial.
 * Toque numa região para selecionar, toque de novo para pousar um ponto e registre na janela.
 */
export function BodyMapPanel({ clientId, kind }: { clientId: string; kind: BodyKind }) {
  const def = BODY_MAPS[kind];
  const { marks: all, add, remove, removeZone } = useFaceMap(clientId);
  const marks = all.filter((mark) => mapKindOf(mark.zoneId) === kind);
  const [selected, setSelected] = useState<string | null>(null);
  const [points, setPoints] = useState<Record<string, FacePoint[]>>({});
  const [sheetOpen, setSheetOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const wide = useMediaQuery("(min-width: 1280px)");

  useEffect(() => {
    setSelected(null);
    setSheetOpen(false);
    setPoints({});
  }, [kind]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2400);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const zone = selected ? (def.zones.find((item) => item.id === selected) ?? null) : null;
  const pending = selected ? (points[selected] ?? []) : [];
  const pairId = zone ? (def.pairs[zone.id] ?? null) : null;
  const pairZone = pairId ? (def.zones.find((item) => item.id === pairId) ?? null) : null;

  const select = (next: FaceZone) => {
    setSelected(next.id);
    setSheetOpen(false);
  };
  const addPoint = (zoneId: string, point: FacePoint) => {
    setPoints((current) => ({ ...current, [zoneId]: [...(current[zoneId] ?? []), point] }));
    setSheetOpen(true);
  };

  const save = (record: FaceRecord, mirrorId: string | null) => {
    if (!zone) return;
    const made = buildMarks(zone.id, record, pending, mirrorId);
    add(made);
    setPoints((current) => ({ ...current, [zone.id]: [] }));
    setSelected(null);
    setSheetOpen(false);
    setNotice(made.length > 1 ? "Marcação salva nas duas regiões" : "Marcação salva");
  };

  const clear = () => {
    if (!zone) return;
    removeZone(zone.id);
    setPoints((current) => ({ ...current, [zone.id]: [] }));
    setSelected(null);
    setSheetOpen(false);
  };

  const sheet = (
    <FaceMapSheet
      inline={wide}
      zone={zone}
      pointCount={pending.length}
      history={zone ? historyForZone(marks, zone.id) : []}
      pair={pairZone ? { id: pairZone.id, nome: pairZone.nome } : null}
      procedures={def.procedures}
      actions={def.actions}
      onClose={() => (wide ? setSelected(null) : setSheetOpen(false))}
      onSave={save}
      onClear={clear}
    />
  );

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
      <div className="relative mx-auto w-full max-w-[440px] overflow-hidden rounded-[var(--radius-xl)]">
        <BodyMap
          kind={kind}
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
      </div>
      {wide || !sheetOpen ? null : sheet}

      {wide || !zone || sheetOpen ? null : (
        <div className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border-card)] bg-[var(--surface-card)] p-3.5 xl:col-span-2">
          <span className="min-w-0 flex-1">
            <span className="block break-words text-[14px] font-medium">{zone.nome}</span>
            <span className="mt-0.5 block text-[12.5px] text-muted-foreground">
              {pending.length
                ? pending.length === 1
                  ? "1 ponto de ação"
                  : `${pending.length} pontos de ação`
                : "Toque de novo dentro da região para pousar um ponto."}
            </span>
          </span>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="min-h-11 flex-none rounded-full border border-[var(--eb-teal-a40)] bg-[var(--eb-teal-500)] px-4 text-[14px] font-medium text-[var(--eb-plum-900)]"
          >
            Registrar
          </button>
        </div>
      )}

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
              : def.hint}
          </span>
        </div>
        <div className="flex flex-col gap-2.5">
          <span className={label}>Histórico</span>
          <FaceMapHistory
            marks={marks}
            emptyLabel={`Nenhuma marcação ainda. Toque em uma região do ${def.label.toLowerCase()} para registrar.`}
            onSelect={(mark) => setSelected(mark.zoneId)}
            onRemove={(mark) => remove(mark.id)}
          />
        </div>
      </div>
    </div>
  );
}
