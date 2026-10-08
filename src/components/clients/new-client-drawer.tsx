import { useEffect, useState } from "react";

import { ClientInvite } from "@/components/eb/client-invite";
import { Icon } from "@/components/eb/icon";
import { Input } from "@/components/eb/input";
import { Drawer } from "@/components/eb/overlays";
import { SegmentedTabs } from "@/components/eb/segmented-tabs";
import { Select } from "@/components/eb/select";
import { Button } from "@/components/ui/button";
import { PROCEDURES } from "@/components/agenda/new-appointment-drawer";
import { clientsDb, type ClientRec } from "@/data/db";
import { usePro } from "@/lib/use-pro";
import { createClient } from "@/services/clients.service";

type Mode = "agora" | "convite";
const NONE = "Definir depois";

/** Nova cliente: cadastrar na hora, ou enviar o link/credencial para ela se cadastrar. */
export function NewClientDrawer({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (client: ClientRec) => void;
}) {
  const pro = usePro();
  const [mode, setMode] = useState<Mode>("agora");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [procedure, setProcedure] = useState(NONE);
  const [tried, setTried] = useState(false);
  const clients = clientsDb.use();

  useEffect(() => {
    if (open) {
      setMode("agora");
      setName("");
      setPhone("");
      setEmail("");
      setProcedure(NONE);
      setTried(false);
    }
  }, [open]);

  const duplicate = clients.find(
    (client) =>
      client.name.toLowerCase() === name.trim().toLowerCase() ||
      (email.trim() && client.email === email.trim().toLowerCase()),
  );
  const nameError = !name.trim()
    ? "Escreva o nome da cliente."
    : duplicate
      ? `${duplicate.name} já está na sua carteira.`
      : undefined;

  function submit() {
    setTried(true);
    if (nameError) return;
    const client = createClient({
      name,
      phone,
      email,
      ...(procedure !== NONE ? { procedure } : {}),
    });
    onCreated(client);
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Nova cliente"
      subtitle="Cadastre agora ou envie o seu link: a cliente já entra na sua carteira"
    >
      <div className="flex flex-col gap-4">
        <SegmentedTabs<Mode>
          active={mode}
          onSelect={setMode}
          tabs={[
            { id: "agora", label: "Cadastrar agora" },
            { id: "convite", label: "Enviar convite" },
          ]}
        />
        {mode === "agora" ? (
          <div className="flex flex-col gap-3.5">
            <Input
              label="Nome"
              icon="User"
              placeholder="Paula Andrade"
              value={name}
              error={tried ? nameError : undefined}
              onChange={(event) => setName(event.target.value)}
            />
            <Input
              label="Celular"
              icon="Phone"
              type="tel"
              placeholder="(11) 90000-0000"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
            <Input
              label="E-mail"
              icon="Mail"
              type="email"
              placeholder="paula@email.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Select
              label="Procedimento principal"
              options={[NONE, ...PROCEDURES]}
              value={procedure}
              onChange={(event) => setProcedure(event.target.value)}
            />
            <Button type="button" variant="tech" onClick={submit}>
              <Icon name="UserPlus" size={18} /> Cadastrar cliente
            </Button>
          </div>
        ) : (
          <ClientInvite professional={{ id: "fernanda", name: pro.name }} compact />
        )}
      </div>
    </Drawer>
  );
}
