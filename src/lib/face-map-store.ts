import { useCallback, useEffect, useState } from "react";

import { FACE_PAIRS } from "@/components/facemap/face-data";

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

const PREFIX = "estetboost:facemap:";

/** Lê o mapa da cliente: `null` quando ela ainda não tem nenhum guardado. */
export function readFaceMap(clientId: string): FaceMark[] | null {
  try {
    const raw = window.localStorage.getItem(PREFIX + clientId);
    if (raw === null) return null;
    const list = JSON.parse(raw);
    return Array.isArray(list) ? (list as FaceMark[]) : [];
  } catch {
    return null;
  }
}

export function writeFaceMap(clientId: string, marks: FaceMark[]) {
  try {
    window.localStorage.setItem(PREFIX + clientId, JSON.stringify(marks));
  } catch {
    /* sem armazenamento: o mapa vale até recarregar */
  }
}

const shortDate = () =>
  new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");

/** Uma marcação por região. Com `mirror`, a região par recebe o mesmo registro. */
export function buildMarks(
  zoneId: string,
  record: FaceRecord,
  points: FacePoint[],
  mirror: boolean,
  state: MarkState = "done",
): FaceMark[] {
  const stamp = Date.now();
  const ids = mirror && FACE_PAIRS[zoneId] ? [zoneId, FACE_PAIRS[zoneId]] : [zoneId];
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
export function useFaceMap(clientId: string, seed: FaceMark[] = []) {
  const [marks, setMarks] = useState<FaceMark[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setMarks(readFaceMap(clientId) ?? seed);
    setReady(true);
    // `seed` só vale na primeira leitura de cada cliente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const commit = useCallback(
    (next: FaceMark[]) => {
      setMarks(next);
      writeFaceMap(clientId, next);
    },
    [clientId],
  );

  return {
    marks,
    ready,
    add: (added: FaceMark[]) => commit([...marks, ...added]),
    remove: (id: string) => commit(marks.filter((mark) => mark.id !== id)),
    removeZone: (zoneId: string) => commit(marks.filter((mark) => mark.zoneId !== zoneId)),
  };
}
