import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/auth/field";
import { authService } from "@/services/auth.service";
import type { Invite } from "@/lib/auth.types";

export function ClientInviteForm({ invite, onSuccess }: { invite: Invite; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [consent, setConsent] = useState(false);

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setLoading(true);
        await authService.acceptInvite();
        setLoading(false);
        onSuccess();
      }}
    >
      <div className="rounded-[var(--radius-md)] border border-border bg-[var(--muted)] p-3">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Convite de</p>
        <p className="mt-1 text-sm text-foreground">{invite.professional}</p>
        {invite.code ? (
          <p className="mt-1 font-mono text-xs text-[var(--teal)]">Código {invite.code}</p>
        ) : null}
      </div>

      <div>
        <h1 className="text-xl font-light text-foreground">Crie seu acesso.</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Acompanhe seus atendimentos, retornos e evolução em um só lugar.
        </p>
      </div>

      <Field label="Nome completo" name="nome" autoComplete="name" placeholder="Seu nome" required />
      <Field label="Celular" name="celular" inputMode="tel" placeholder="(11) 90000-0000" required />
      <Field label="E-mail" type="email" name="email" autoComplete="email" placeholder="voce@email.com" required />
      <Field label="Senha" type="password" name="senha" autoComplete="new-password" placeholder="Mínimo de 8 caracteres" required />

      <label className="flex items-start gap-3 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          className="mt-1 size-4 accent-[var(--teal)]"
          required
        />
        <span>Autorizo o registro dos meus dados de atendimento e evolução.</span>
      </label>

      <Button type="submit" size="lg" className="w-full" disabled={loading || !consent}>
        {loading ? "Criando acesso..." : "Criar meu acesso"}
      </Button>
    </form>
  );
}
