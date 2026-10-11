import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { Icon } from "@/components/eb/icon";
import { SegmentedTabs } from "@/components/eb/segmented-tabs";
import { ToastHost } from "@/components/eb/toast";
import { TopBar } from "@/components/eb/top-bar";
import { Badges } from "@/components/loyalty/badges-tab";
import { CampaignsTab } from "@/components/loyalty/campaigns-tab";
import { Overview } from "@/components/loyalty/overview-tab";
import { Program } from "@/components/loyalty/program-tab";
import { RewardsTab } from "@/components/loyalty/rewards-tab";
import { Button } from "@/components/ui/button";
import { usePro } from "@/lib/use-pro";
import { useRemote } from "@/lib/use-remote";
import { loadLoyaltyAdmin } from "@/services/loyalty.service";

export const Route = createFileRoute("/_gestor/fidelidade")({
  validateSearch: (search): { aba?: Tab | undefined } => ({
    aba: TABS.find((item) => item === search["aba"]),
  }),
  head: () => ({
    meta: [
      { title: "Fidelidade — EstetBoost." },
      {
        name: "description",
        content: "Pontos, níveis, selos e ranking das suas clientes, definidos por você.",
      },
    ],
  }),
  component: FidelidadePage,
});

type Tab = "geral" | "programa" | "selos" | "premios" | "campanhas";
const TABS: Tab[] = ["geral", "programa", "selos", "premios", "campanhas"];

function FidelidadePage() {
  const pro = usePro();
  const admin = useRemote(loadLoyaltyAdmin);
  const { aba } = Route.useSearch();
  const [tab, setTab] = useState<Tab>(aba ?? "geral");
  useEffect(() => {
    if (aba) setTab(aba);
  }, [aba]);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const data = admin.data;
  return (
    <div className="flex flex-col gap-4">
      <TopBar title="Fidelidade" context="Pontos, selos e ranking das clientes" user={pro} />
      {!data ? (
        <p className="text-[13px] text-muted-foreground">
          {admin.error ?? (admin.loading ? "Carregando…" : "")}
        </p>
      ) : (
        <>
          {!data.config.enabled ? (
            <div className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--eb-amber-500)]/40 bg-[var(--surface-card)] p-4">
              <Icon name="Trophy" size={20} color="var(--eb-amber-500)" />
              <div className="min-w-0 flex-1">
                <div className="text-[14.5px] font-medium">O programa está desligado</div>
                <p className="mt-0.5 text-[12.5px] text-[var(--text-secondary)]">
                  Ligue em “Programa” para as clientes começarem a ganhar pontos e selos. Você
                  escolhe quanto vale cada coisa.
                </p>
              </div>
              <Button type="button" size="sm" onClick={() => setTab("programa")}>
                Configurar
              </Button>
            </div>
          ) : null}
          <SegmentedTabs<Tab>
            size="sm"
            active={tab}
            onSelect={setTab}
            tabs={[
              { id: "geral", label: "Geral" },
              { id: "programa", label: "Programa" },
              { id: "selos", label: "Selos" },
              { id: "premios", label: "Prêmios" },
              { id: "campanhas", label: "Campanhas" },
            ]}
            className="max-w-xl"
          />
          {tab === "geral" ? (
            <Overview data={data} onToast={setToast} onChanged={() => void admin.reload()} />
          ) : null}
          {tab === "programa" ? (
            <Program data={data} onToast={setToast} onSaved={() => void admin.reload()} />
          ) : null}
          {tab === "premios" ? <RewardsTab onToast={setToast} /> : null}
          {tab === "campanhas" ? <CampaignsTab onToast={setToast} /> : null}
          {tab === "selos" ? (
            <Badges data={data} onToast={setToast} onChanged={() => void admin.reload()} />
          ) : null}
        </>
      )}
      <ToastHost toast={toast ? { message: toast } : null} />
    </div>
  );
}
