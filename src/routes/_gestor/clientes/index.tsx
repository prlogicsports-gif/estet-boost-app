import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { NewClientDrawer } from "@/components/clients/new-client-drawer";
import { ClientCard } from "@/components/eb/client-card";
import { EmptyState } from "@/components/eb/empty-state";
import { FilterBar } from "@/components/eb/filter-bar";
import { Icon } from "@/components/eb/icon";
import { SearchBar } from "@/components/eb/search-bar";
import { Skeleton } from "@/components/eb/skeleton";
import { ToastHost } from "@/components/eb/toast";
import { TopBar } from "@/components/eb/top-bar";
import { useShell } from "@/components/shell/shell-context";
import { Button } from "@/components/ui/button";
import { clientsDb } from "@/data/db";
import { usePro } from "@/lib/use-pro";

export const Route = createFileRoute("/_gestor/clientes/")({
  head: () => ({
    meta: [
      { title: "Clientes — EstetBoost." },
      {
        name: "description",
        content: "Histórico, anamneses e evolução de cada cliente do seu estúdio.",
      },
      { property: "og:title", content: "Clientes — EstetBoost." },
      {
        property: "og:description",
        content: "Histórico, anamneses e evolução de cada cliente do seu estúdio.",
      },
    ],
  }),
  component: ClientesPage,
});

type Filter = "all" | "return" | "package" | "debt" | "cold";

function ClientesPage() {
  const pro = usePro();
  const navigate = useNavigate();
  const { openNotifications, unread } = useShell();
  const clients = clientsDb.use();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(false);
  const [invite, setInvite] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!loading) return;
    const timer = window.setTimeout(() => setLoading(false), 420);
    return () => window.clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const matches: Record<Filter, (client: (typeof clients)[number]) => boolean> = {
    all: () => true,
    return: (client) => client.nextReturn !== "—",
    package: (client) => client.mainProcedure.includes("pacote"),
    debt: (client) => client.alert === "Pagamento pendente",
    cold: (client) => client.alert === "Sem atendimento recente",
  };
  const list = clients.filter(
    (client) =>
      (!query || client.name.toLowerCase().includes(query.toLowerCase())) &&
      matches[filter](client),
  );
  const count = (id: Filter) => clients.filter(matches[id]).length;

  const newClient = (
    <Button type="button" onClick={() => setInvite(true)}>
      <Icon name="UserPlus" size={18} /> Nova cliente
    </Button>
  );

  return (
    <div className="flex flex-col gap-4">
      <TopBar
        title="Clientes"
        context={`${clients.length} cadastradas`}
        notifications={unread}
        user={pro}
        onNotifications={openNotifications}
        actions={
          <Button type="button" size="sm" onClick={() => setInvite(true)}>
            <Icon name="UserPlus" size={15} /> Nova cliente
          </Button>
        }
      />
      <SearchBar value={query} onChange={setQuery} onClear={() => setQuery("")} />
      <FilterBar<Filter>
        active={filter}
        onSelect={(id) => {
          setFilter(id);
          setLoading(true);
        }}
        filters={[
          { id: "all", label: "Todas", count: count("all") },
          { id: "return", label: "Retorno próximo", icon: "RotateCcw", count: count("return") },
          { id: "package", label: "Pacote ativo", count: count("package") },
          { id: "debt", label: "Pagamento pendente", count: count("debt") },
          { id: "cold", label: "Sem atendimento recente", count: count("cold") },
        ]}
      />
      {loading ? (
        <div className="flex flex-col gap-2.5">
          <Skeleton variant="card" />
          <Skeleton variant="card" />
        </div>
      ) : list.length ? (
        <div className="flex flex-col gap-2.5">
          {list.map((client) => (
            <ClientCard
              key={client.id}
              {...client}
              onOpen={() =>
                navigate({ to: "/clientes/$clientId", params: { clientId: client.id } })
              }
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon="UserSearch"
          title="Nenhuma cliente encontrada"
          description={
            query
              ? `Nada corresponde a "${query}". Verifique a escrita ou cadastre uma nova cliente.`
              : "Nenhuma cliente neste filtro."
          }
          action={newClient}
        />
      )}

      <ToastHost toast={toast ? { message: toast } : null} />
      <NewClientDrawer
        open={invite}
        onClose={() => setInvite(false)}
        onCreated={(client) => {
          setInvite(false);
          setToast(`${client.name} cadastrada`);
          navigate({ to: "/clientes/$clientId", params: { clientId: client.id } });
        }}
      />
    </div>
  );
}
