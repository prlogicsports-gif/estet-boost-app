import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { AlertCard } from "@/components/eb/alert-card";
import { ClientTimeline } from "@/components/eb/client-timeline";
import { MetricCard } from "@/components/eb/metric-card";
import { PhotoVault } from "@/components/eb/photo-vault";
import { SegmentedTabs } from "@/components/eb/segmented-tabs";
import { TopBar } from "@/components/eb/top-bar";
import { findZone } from "@/components/facemap/face-data";
import { FaceMap } from "@/components/facemap/face-map";
import { FaceMapHistory } from "@/components/facemap/face-map-history";
import { useShell } from "@/components/shell/shell-context";
import { Button } from "@/components/ui/button";
import { CLIENT_ID, client, history, recommendations } from "@/data/cliente-mock";
import { faceSeed } from "@/data/face-seed";
import { historyForZone, readFaceMap, type FaceMark } from "@/lib/face-map-store";

export const Route = createFileRoute("/cliente/evolucao")({
  head: () => ({ meta: [{ title: "Minha evolução — EstetBoost." }] }),
  component: EvolucaoPage,
});

type Tab = "mapa" | "fotos" | "linha" | "recom";

/** O mapa e as fotos são os mesmos que a esteticista registra no perfil desta cliente, só para leitura. */
const withoutInternal = (mark: FaceMark): FaceMark => ({ ...mark, observacao: "" });
const load = () => (readFaceMap(CLIENT_ID) ?? faceSeed[CLIENT_ID] ?? []).map(withoutInternal);

function EvolucaoPage() {
  const { openNotifications, unread } = useShell();
  const [tab, setTab] = useState<Tab>("mapa");
  const [marks, setMarks] = useState<FaceMark[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    setMarks(load());
    const refresh = () => setMarks(load());
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, []);

  const zone = selected ? findZone(selected) : null;
  const list = selected ? historyForZone(marks, selected) : marks;

  return (
    <div className="flex flex-col gap-4">
      <TopBar
        title="Minha evolução"
        context="Somente o que foi autorizado por você"
        notifications={unread}
        user={client}
        onNotifications={openNotifications}
      />
      <SegmentedTabs<Tab>
        active={tab}
        onSelect={setTab}
        tabs={[
          { id: "mapa", label: "Mapa facial" },
          { id: "fotos", label: "Fotografias" },
          { id: "linha", label: "Linha do tempo" },
          { id: "recom", label: "Recomendações" },
        ]}
      />

      {tab === "mapa" ? (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] items-start gap-[18px]">
          <div className="mx-auto w-full max-w-[320px]">
            <FaceMap
              selected={selected}
              onSelectZone={(next) =>
                setSelected((current) => (current === next.id ? null : next.id))
              }
              points={[]}
              onAddPoint={() => {}}
              marks={marks}
              allowPoints={false}
            />
          </div>
          <div className="flex min-w-0 flex-col gap-2.5">
            <div className="flex items-center gap-2.5">
              <span className="flex-1 text-[11px] font-medium uppercase leading-[1.2] tracking-[0.14em] text-muted-foreground">
                {zone ? zone.nome : "Registros no seu rosto"}
              </span>
              {zone ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(null)}>
                  Ver todos
                </Button>
              ) : null}
            </div>
            <FaceMapHistory
              marks={list}
              emptyLabel={
                zone
                  ? "Nenhum registro nesta região."
                  : "Ainda não há registros no seu mapa facial."
              }
              onSelect={(mark) => setSelected(mark.zoneId)}
            />
            <p className="text-xs text-muted-foreground">
              Toque em uma região para ver o que foi feito nela. Observações internas da
              profissional não aparecem aqui.
            </p>
          </div>
        </div>
      ) : null}

      {tab === "fotos" ? <PhotoVault clientId={CLIENT_ID} canEdit={false} /> : null}
      {tab === "linha" ? <ClientTimeline entries={history} /> : null}
      {tab === "recom" ? (
        <div className="flex flex-col gap-2.5">
          {recommendations.map((item) => (
            <AlertCard
              key={item.title}
              tone="info"
              icon={item.icon}
              title={item.title}
              description={item.detail}
            />
          ))}
          <MetricCard
            label="Sessões restantes"
            value="2"
            hint="de 4 no pacote"
            icon="Layers"
            tone="tech"
          />
        </div>
      ) : null}
    </div>
  );
}
