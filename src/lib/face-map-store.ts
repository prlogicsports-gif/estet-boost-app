import { useCallback, useMemo } from "react";

import { createRemoteStore, type Row } from "@/lib/remote-store";
import { supabase } from "@/lib/supabase";

export type MarkState = "done" | "planned" | "sensitive";
export type FacePoint = { x: number; y: number };
export type FaceRecord = {
  procedimento: string;
  produto: string;
  acao: string;
  observacao: string;
};
export type FaceMark = FaceRecord & {
  id: string;
  zoneId: string;
  state: MarkState;
  date: string;
  savedAt: string;
  /** Pontos de ação pousados na região; sem pontos, a marcação fica no centroide. */
  points?: FacePoint[] | undefined;
};

export const emptyRecord: FaceRecord = { procedimento: "", produto: "", acao: "", observacao: "" };

export type FaceMapRec = { clientId: string; marks: FaceMark[] };

/**
 * Mapa facial de cada cliente, no Supabase (tabela `face_maps`). A equipe lê e grava; a cliente recebe o
 * dela por função do banco, já sem as observações internas da esteticista.
 */
export const faceMapsDb = createRemoteStore<FaceMapRec>({
  key: "face_maps",
  table: "face_maps",
  idOf: (rec) => rec.clientId,
  fromRow: (r) => ({
    clientId: r.client_id,
    marks: Array.isArray(r.marks) ? (r.marks as FaceMark[]) : [],
  }),
  load: async (ctx) => {
    if (ctx.session.role === "cliente") {
      const { data } = await supabase.rpc("my_face_map");
      return ctx.session.clientId
        ? [
            {
              clientId: ctx.session.clientId,
              marks: Array.isArray(data) ? (data as FaceMark[]) : [],
            },
          ]
        : [];
    }
    const { data, error } = await supabase.from("face_maps").select("client_id, marks");
    if (error) throw error;
    return ((data ?? []) as Row[]).map((r) => ({
      clientId: r.client_id,
      marks: Array.isArray(r.marks) ? (r.marks as FaceMark[]) : [],
    }));
  },
  save: async (rec, _prev, ctx) => {
    const { error } = await supabase.from("face_maps").upsert(
      {
        client_id: rec.clientId,
        clinic_id: ctx.session.clinicId,
        marks: rec.marks,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "client_id" },
    );
    if (error) throw error;
  },
  remove: async (rec) => {
    const { error } = await supabase.from("face_maps").delete().eq("client_id", rec.clientId);
    if (error) throw error;
  },
});

/** Lê o mapa da cliente: `null` quando ela ainda não tem nenhum guardado. */
export function readFaceMap(clientId: string): FaceMark[] | null {
  return faceMapsDb.get().find((map) => map.clientId === clientId)?.marks ?? null;
}

export function writeFaceMap(clientId: string, marks: FaceMark[]) {
  faceMapsDb.set((list) =>
    list.some((map) => map.clientId === clientId)
      ? list.map((map) => (map.clientId === clientId ? { ...map, marks } : map))
      : [...list, { clientId, marks }],
  );
}

const shortDate = () =>
  new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");

/** Uma marcação por região. Com `pairId`, a região do lado oposto recebe o mesmo registro. */
export function buildMarks(
  zoneId: string,
  record: FaceRecord,
  points: FacePoint[],
  pairId: string | null,
  state: MarkState = "done",
): FaceMark[] {
  const stamp = Date.now();
  const ids = pairId ? [zoneId, pairId] : [zoneId];
  return ids.map((id, index) => ({
    ...record,
    id: `m${stamp}-${index}`,
    zoneId: id,
    state,
    date: shortDate(),
    savedAt: new Date(stamp + index).toISOString(),
    // Só a região escolhida leva os pontos: o espelho pousa no centroide.
    points: index === 0 && points.length ? points : undefined,
  }));
}

export const historyForZone = (marks: FaceMark[], zoneId: string) =>
  marks.filter((mark) => mark.zoneId === zoneId).sort((a, b) => b.savedAt.localeCompare(a.savedAt));

export function zoneStatesFrom(marks: FaceMark[]) {
  const out: Record<string, MarkState> = {};
  for (const mark of marks) out[mark.zoneId] = mark.state;
  return out;
}

/** Mapa de uma cliente: cada cliente tem o seu, a chave é o id dela. */
export function useFaceMap(clientId: string) {
  const maps = faceMapsDb.use();
  const marks = useMemo(
    () => maps.find((map) => map.clientId === clientId)?.marks ?? [],
    [maps, clientId],
  );
  const commit = useCallback((next: FaceMark[]) => writeFaceMap(clientId, next), [clientId]);

  return {
    marks,
    ready: true,
    add: (added: FaceMark[]) => commit([...marks, ...added]),
    remove: (id: string) => commit(marks.filter((mark) => mark.id !== id)),
    removeZone: (zoneId: string) => commit(marks.filter((mark) => mark.zoneId !== zoneId)),
  };
}
