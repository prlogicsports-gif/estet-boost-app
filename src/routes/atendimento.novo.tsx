import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { NewSessionStart } from "@/components/session/new-session-start";
import { SessionFrame } from "@/components/session/session-frame";

export const Route = createFileRoute("/atendimento/novo")({
  head: () => ({ meta: [{ title: "Novo atendimento — EstetBoost." }] }),
  component: NovoAtendimentoPage,
});

function NovoAtendimentoPage() {
  const navigate = useNavigate();
  return (
    <SessionFrame>
      <NewSessionStart
        onCancel={() => navigate({ to: "/hoje" })}
        onStart={(clientId, procedure) =>
          navigate({
            to: "/atendimento/$sessionId",
            params: { sessionId: "livre" },
            search: { cliente: clientId, procedimento: procedure },
          })
        }
      />
    </SessionFrame>
  );
}
