import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { EmptyState } from "@/components/eb/empty-state";
import { SessionFrame } from "@/components/session/session-frame";
import { SessionScreen, type SessionAppointment } from "@/components/session/session-screen";
import { Button } from "@/components/ui/button";
import { appointments, clients } from "@/data/gestor-mock";

type Search = { cliente?: string | undefined; procedimento?: string | undefined };

export const Route = createFileRoute("/atendimento/$sessionId")({
  validateSearch: (search): Search => ({
    cliente: typeof search["cliente"] === "string" ? search["cliente"] : undefined,
    procedimento: typeof search["procedimento"] === "string" ? search["procedimento"] : undefined,
  }),
  head: () => ({ meta: [{ title: "Atendimento — EstetBoost." }] }),
  component: AtendimentoEmAndamentoPage,
});

/** `livre` é o atendimento aberto na hora (cliente e procedimento vêm na URL); qualquer outro id é um horário da agenda. */
function resolve(sessionId: string, search: Search): SessionAppointment | null {
  if (sessionId === "livre") {
    const client = clients.find((item) => item.id === search.cliente);
    if (!client) return null;
    return {
      id: `novo-${client.id}`,
      novo: true,
      clientId: client.id,
      client: client.name,
      initials: client.initials,
      procedure: search.procedimento ?? "Limpeza de pele profunda",
      time: new Date().toTimeString().slice(0, 5),
    };
  }
  const found = appointments.find((item) => item.id === sessionId);
  return found
    ? {
        id: found.id,
        clientId: found.clientId,
        client: found.client,
        initials: found.initials,
        procedure: found.procedure,
        time: found.time,
      }
    : null;
}

function AtendimentoEmAndamentoPage() {
  const { sessionId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const appointment = resolve(sessionId, search);

  return (
    <SessionFrame>
      {appointment ? (
        <SessionScreen appointment={appointment} onExit={() => navigate({ to: "/hoje" })} />
      ) : (
        <EmptyState
          icon="CalendarClock"
          title="Atendimento não encontrado"
          description="Escolha a cliente e o procedimento para começar."
          action={
            <Button asChild>
              <Link to="/atendimento/novo">Novo atendimento</Link>
            </Button>
          }
        />
      )}
    </SessionFrame>
  );
}
