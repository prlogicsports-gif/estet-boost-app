import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { ClientCard } from "@/components/eb/client-card";
import { EmptyState } from "@/components/eb/empty-state";
import { FilterBar } from "@/components/eb/filter-bar";
import { Icon } from "@/components/eb/icon";
import { Drawer } from "@/components/eb/overlays";
import { ClientInvite } from "@/components/eb/client-invite";
import { SearchBar } from "@/components/eb/search-bar";
import { Skeleton } from "@/components/eb/skeleton";
import { TopBar } from "@/components/eb/top-bar";
import { useShell } from "@/components/shell/shell-context";
import { Button } from "@/components/ui/button";
import { clients, pro } from "@/data/gestor-mock";

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
  const navigate = useNavigate();
  const { openNotifications, unread } = useShell();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(false);
  const [invite, setInvite] = useState(false);

  useEffect(() => {
    if (!loading) return;
    const timer = window.setTimeout(() => setLoading(false), 420);
    return () => window.clearTimeout(timer);
  }, [loading]);

  const list = clients.filter((client) => {
    if (query && !client.name.toLowerCase().includes(query.toLowerCase())) return false;
    if (filter === "return") return client.nextReturn !== "—";
    if (filter === "package") return client.mainProcedure.includes("pacote");
    if (filter === "debt") return client.alert === "Pagamento pendente";
    if (filter === "cold") return client.alert === "Sem atendimento recente";
    return true;
  });

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
          { id: "all", label: "Todas", count: clients.length },
          { id: "return", label: "Retorno próximo", icon: "RotateCcw", count: 4 },
          { id: "package", label: "Pacote ativo", count: 3 },
          { id: "debt", label: "Pagamento pendente", count: 1 },
          { id: "cold", label: "Sem atendimento recente", count: 1 },
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
          description={`Nada corresponde a "${query}". Verifique a escrita ou cadastre uma nova cliente.`}
          action={newClient}
        />
      )}

      <Drawer
        open={invite}
        onClose={() => setInvite(false)}
        title="Nova cliente"
        subtitle="Envie o seu link ou gere uma credencial: a cliente já entra na sua carteira"
      >
        <ClientInvite professional={{ id: "fernanda", name: pro.name }} compact />
      </Drawer>
    </div>
  );
}
