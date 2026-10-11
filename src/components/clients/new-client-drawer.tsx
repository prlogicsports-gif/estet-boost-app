import { useEffect, useState } from "react";

import { ClientForm, NONE } from "@/components/clients/client-form";
import { ClientAccessSuccess, type Credentials } from "@/components/eb/client-access";
import { ClientInvite } from "@/components/eb/client-invite";
import { Drawer } from "@/components/eb/overlays";
import { SegmentedTabs } from "@/components/eb/segmented-tabs";
import type { ClientRec } from "@/data/db";
import { useClinic, useClinicClients } from "@/lib/use-clinic";
import { createClientAccess } from "@/services/client-access.service";
import { createClient, updateClient } from "@/services/clients.service";

type Mode = "agora" | "convite";
type Done = { client: ClientRec; creds?: Credentials; accessError?: string };

/** Nova cliente: cadastro completo pela esteticista, ou envio do link/credencial para a própria cliente se cadastrar. */
export function NewClientDrawer({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (client: ClientRec) => void;
}) {
  const { clinic } = useClinic();
  const [mode, setMode] = useState<Mode>("agora");
  const clients = useClinicClients();
  const [done, setDone] = useState<Done | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) setDone(null);
  }, [open]);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={done ? "Cadastro concluído" : "Nova cliente"}
      subtitle={
        done
          ? "Envie o acesso ao app para a cliente"
          : "Preencha o cadastro completo ou envie o link da sua clínica para ela se cadastrar"
      }
    >
      <div className="flex flex-col gap-4">
        {done ? (
          <ClientAccessSuccess
            client={done.client}
            clinic={clinic}
            creds={done.creds}
            accessError={done.accessError}
            onDone={() => onCreated(done.client)}
          />
        ) : null}
        {done ? null : (
          <SegmentedTabs<Mode>
            active={mode}
            onSelect={setMode}
            tabs={[
              { id: "agora", label: "Cadastrar agora" },
              { id: "convite", label: "Enviar link" },
            ]}
          />
        )}
        {done ? null : mode === "agora" ? (
          <ClientForm
            key={String(open)}
            initial={{
              name: "",
              phone: "",
              email: "",
              birth: "",
              document: "",
              address: "",
              procedure: NONE,
              goal: "",
              allergies: "",
              contra: "",
              note: "",
              imageConsent: false,
              createAccess: false,
              password: "",
            }}
            withAccess
            busy={busy}
            submitLabel="Cadastrar cliente"
            nameError={(name, email) => {
              const duplicate = clients.find(
                (client) =>
                  client.name.toLowerCase() === name.trim().toLowerCase() ||
                  (email.trim() && client.email === email.trim().toLowerCase()),
              );
              return duplicate ? `${duplicate.name} já está na sua carteira.` : undefined;
            }}
            onSubmit={async (values) => {
              const client = createClient({
                name: values.name,
                phone: values.phone,
                email: values.email,
                birth: values.birth,
                document: values.document,
                address: values.address,
                goal: values.goal,
                allergies: values.allergies,
                contra: values.contra,
                note: values.note,
                ...(values.procedure !== NONE ? { procedure: values.procedure } : {}),
              });
              if (values.imageConsent) updateClient(client.id, { imageConsent: true });
              if (!values.createAccess) {
                setDone({ client });
                return;
              }
              setBusy(true);
              const email = values.email.trim().toLowerCase();
              const result = await createClientAccess({
                clientId: client.id,
                email,
                password: values.password,
              });
              setBusy(false);
              setDone(
                result.ok
                  ? { client, creds: { email, password: values.password } }
                  : { client, accessError: result.message },
              );
            }}
          />
        ) : clinic ? (
          <ClientInvite clinic={clinic} compact />
        ) : null}
      </div>
    </Drawer>
  );
}
