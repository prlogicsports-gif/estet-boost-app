import { createFileRoute } from "@tanstack/react-router";

import { FaceMapPanel } from "@/components/facemap/face-map-panel";
import { AppShell } from "@/components/shell/app-shell";
import type { FaceMark } from "@/lib/face-map-store";

export const Route = createFileRoute("/mapa-facial")({
  head: () => ({
    meta: [
      { title: "Mapa facial — EstetBoost." },
      {
        name: "description",
        content:
          "Registre procedimentos, produtos e observações em cada região do rosto da cliente.",
      },
      { property: "og:title", content: "Mapa facial — EstetBoost." },
      {
        property: "og:description",
        content:
          "Registre procedimentos, produtos e observações em cada região do rosto da cliente.",
      },
    ],
  }),
  component: MapaFacialPage,
});

/** Marcações de exemplo, do protótipo, enquanto a cliente ainda não tem registros. */
const seed: FaceMark[] = [
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
];

function MapaFacialPage() {
  return (
    <AppShell title="Mapa facial" subtitle="Mariana Silva · registre por região do rosto.">
      <FaceMapPanel clientId="mariana-silva" seed={seed} />
    </AppShell>
  );
}
