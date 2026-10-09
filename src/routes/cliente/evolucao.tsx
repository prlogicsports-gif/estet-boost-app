import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { AlertCard } from "@/components/eb/alert-card";
import { ClientTimeline } from "@/components/eb/client-timeline";
import { PhotoVault } from "@/components/eb/photo-vault";
import { SegmentedTabs } from "@/components/eb/segmented-tabs";
import { TopBar } from "@/components/eb/top-bar";
import { FaceMap } from "@/components/facemap/face-map";
import { FaceMapHistory } from "@/components/facemap/face-map-history";
import { useFaceLayout } from "@/lib/face-layout";
import { useShell } from "@/components/shell/shell-context";
import { Button } from "@/components/ui/button";
import { appointmentsDb, careDb } from "@/data/db";
import { formatShort } from "@/lib/dates";
import { useClient } from "@/lib/use-client";
import type { TimelineEntry } from "@/components/eb/client-timeline";
import { faceMapsDb, historyForZone, type FaceMark } from "@/lib/face-map-store";

export const Route = createFileRoute("/cliente/evolucao")({
  head: () => ({ meta: [{ title: "Minha evolução — EstetBoost." }] }),
  component: EvolucaoPage,
});

type Tab = "mapa" | "fotos" | "linha" | "recom";

/** O mapa e as fotos são os mesmos que a esteticista registra no perfil desta cliente, só para leitura. */
const withoutInternal = (mark: FaceMark): FaceMark => ({ ...mark, observacao: "" });

function EvolucaoPage() {
  const { openNotifications, unread } = useShell();
  const { clientId, profile } = useClient();
  const care = careDb
    .use()
    .filter((item) => item.clientId === clientId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const done = appointmentsDb.use().filter((item) => item.clientId === clientId && item.done);
  const history: TimelineEntry[] = [
    ...done
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((item) => ({
        id: item.id,
        date: formatShort(item.date),
        procedure: item.procedure,
      })),
  ];
  const [tab, setTab] = useState<Tab>("mapa");
  const maps = faceMapsDb.use();
  const marks = useMemo(
    () => (maps.find((map) => map.clientId === clientId)?.marks ?? []).map(withoutInternal),
    [maps, clientId],
  );
  const [selected, setSelected] = useState<string | null>(null);

  const layout = useFaceLayout();
  const zone = selected ? layout.zoneById(selected) : null;
  const list = selected ? historyForZone(marks, selected) : marks;

  return (
    <div className="flex flex-col gap-4">
      <TopBar
        title="Minha evolução"
        context="Somente o que foi autorizado por você"
        notifications={unread}
        user={profile}
        onNotifications={openNotifications}
      />
      <SegmentedTabs<Tab>
        active={tab}
        onSelect={setTab}
        tabs={[
          { id: "mapa", label: "Mapa facial", short: "Mapa" },
          { id: "fotos", label: "Fotografias", short: "Fotos" },
          { id: "linha", label: "Linha do tempo", short: "Linha" },
          { id: "recom", label: "Recomendações", short: "Dicas" },
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
                {zone ? layout.nameOf(zone.id) : "Registros no seu rosto"}
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

      {tab === "fotos" ? <PhotoVault clientId={clientId} canEdit={false} /> : null}
      {tab === "linha" ? (
        history.length ? (
          <ClientTimeline entries={history} />
        ) : (
          <p className="rounded-[var(--radius-md)] border border-dashed border-[var(--border-card)] px-4 py-6 text-center text-[13px] text-muted-foreground">
            Seus atendimentos concluídos aparecem aqui.
          </p>
        )
      ) : null}
      {tab === "recom" ? (
        <div className="flex flex-col gap-2.5">
          {care.length ? (
            care.map((item) => (
              <AlertCard
                key={item.id}
                tone="info"
                icon={
                  /manh|protetor/i.test(item.text)
                    ? "Sun"
                    : /noite/i.test(item.text)
                      ? "Moon"
                      : "Droplets"
                }
                title={item.text.split(/[.!?]/)[0] ?? item.text}
                {...(item.text.includes(".")
                  ? {
                      description: `${item.text.split(".").slice(1).join(".").trim()}${item.reminderTime ? ` · Lembrete todo dia às ${item.reminderTime}` : ""}`,
                    }
                  : item.reminderTime
                    ? { description: `Lembrete todo dia às ${item.reminderTime}` }
                    : {})}
              />
            ))
          ) : (
            <p className="rounded-[var(--radius-md)] border border-dashed border-[var(--border-card)] px-4 py-6 text-center text-[13px] text-muted-foreground">
              As recomendações da sua esteticista aparecem aqui depois de cada atendimento.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
