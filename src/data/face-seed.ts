import type { FaceMark } from "@/lib/face-map-store";

/** Marcações de exemplo do protótipo, até a cliente ter registros próprios. */
export const faceSeed: Record<string, FaceMark[]> = {
  c1: [
    {
      id: "d1",
      zoneId: "bochecha-esq",
      state: "done",
      date: "04 ago",
      savedAt: "2026-08-04T10:00:00Z",
      procedimento: "Limpeza de pele",
      produto: "",
      acao: "",
      observacao: "Sensibilidade leve ao final.",
    },
    {
      id: "d2",
      zoneId: "nariz",
      state: "done",
      date: "04 ago",
      savedAt: "2026-08-04T10:05:00Z",
      procedimento: "Extração",
      produto: "Ácido mandélico 5%",
      acao: "",
      observacao: "",
    },
    {
      id: "d3",
      zoneId: "glabela",
      state: "done",
      date: "01 set",
      savedAt: "2026-09-01T09:00:00Z",
      procedimento: "Peeling suave",
      produto: "",
      acao: "",
      observacao: "",
    },
  ],
};
