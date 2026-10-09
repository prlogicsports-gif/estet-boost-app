import { useState } from "react";

import { ClientForm } from "@/components/clients/client-form";
import { ClientInvite } from "@/components/eb/client-invite";
import { Drawer } from "@/components/eb/overlays";
import { SegmentedTabs } from "@/components/eb/segmented-tabs";
import type { ClientRec } from "@/data/db";
import { useClinic, useClinicClients } from "@/lib/use-clinic";
import { createClient, updateClient } from "@/services/clients.service";

type Mode = "agora" | "convite";
const NONE = "Definir depois";

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

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Nova cliente"
      subtitle="Preencha o cadastro completo ou envie o link da sua clínica para ela se cadastrar"
    >
      <div className="flex flex-col gap-4">
        <SegmentedTabs<Mode>
          active={mode}
          onSelect={setMode}
          tabs={[
            { id: "agora", label: "Cadastrar agora" },
            { id: "convite", label: "Enviar link" },
          ]}
        />
        {mode === "agora" ? (
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
            }}
            submitLabel="Cadastrar cliente"
            nameError={(name, email) => {
              const duplicate = clients.find(
                (client) =>
                  client.name.toLowerCase() === name.trim().toLowerCase() ||
                  (email.trim() && client.email === email.trim().toLowerCase()),
              );
              return duplicate ? `${duplicate.name} já está na sua carteira.` : undefined;
            }}
            onSubmit={(values) => {
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
              onCreated(client);
            }}
          />
        ) : clinic ? (
          <ClientInvite clinic={clinic} compact />
        ) : null}
      </div>
    </Drawer>
  );
}
