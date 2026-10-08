import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { EmptyState } from "@/components/eb/empty-state";
import { SessionFrame } from "@/components/session/session-frame";
import { SessionScreen } from "@/components/session/session-screen";
import { Button } from "@/components/ui/button";
import { appointmentsDb, sessionsDb } from "@/data/db";
import { startSession } from "@/services/sessions.service";

type Search = { cliente?: string | undefined; procedimento?: string | undefined };

export const Route = createFileRoute("/atendimento/$sessionId")({
  validateSearch: (search): Search => ({
    cliente: typeof search["cliente"] === "string" ? search["cliente"] : undefined,
    procedimento: typeof search["procedimento"] === "string" ? search["procedimento"] : undefined,
  }),
  head: () => ({ meta: [{ title: "Atendimento — EstetBoost." }] }),
  component: AtendimentoEmAndamentoPage,
});

/**
 * O endereço pode ser o do próprio atendimento, o de um horário da agenda ou `livre` com a cliente na URL.
 * Nos dois últimos casos o rascunho é aberto (ou retomado) e o endereço passa a ser o dele.
 */
function AtendimentoEmAndamentoPage() {
  const { sessionId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const session = sessionsDb.use().find((item) => item.id === sessionId);
  const appt = appointmentsDb.use().find((item) => item.id === sessionId);

  useEffect(() => {
    if (session) return;
    const clientId = appt?.clientId ?? (sessionId === "livre" ? search.cliente : undefined);
    if (!clientId) return;
    const opened = startSession({
      clientId,
      ...((search.procedimento ?? appt?.procedure)
        ? { procedure: (search.procedimento ?? appt?.procedure) as string }
        : {}),
      ...(appt ? { apptId: appt.id } : {}),
    });
    if (opened)
      void navigate({
        to: "/atendimento/$sessionId",
        params: { sessionId: opened.id },
        replace: true,
      });
  }, [session, appt, sessionId, search.cliente, search.procedimento, navigate]);

  return (
    <SessionFrame>
      {session ? (
        <SessionScreen session={session} onExit={() => navigate({ to: "/hoje" })} />
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
