import { useState } from "react";
import { Lock, Mail, Phone, User } from "lucide-react";

import { AuthTitle, TermsCheck, authLink } from "@/components/auth/terms-check";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/auth/field";
import type { Invite, Session } from "@/lib/auth.types";
import { authService } from "@/services/auth.service";
import { initialsOf } from "@/data/mock-auth";

export function ClientInviteForm({
  invite,
  onSuccess,
  onLogin,
}: {
  invite: Invite;
  onSuccess: (session: Session) => void;
  onLogin: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [terms, setTerms] = useState(true);
  const firstName = invite.professional.split(" ")[0] || "ela";

  return (
    <form
      className="mt-1"
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setLoading(true);
        const result = await authService.acceptInvite(
          { name: String(data.get("nome")), email: String(data.get("email")) },
          invite,
        );
        setLoading(false);
        if (result.ok) onSuccess(result.session);
      }}
    >
      <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--eb-teal-a40)] bg-[var(--eb-teal-a12)] px-3.5 py-3">
        <span className="grid size-10 flex-none place-items-center rounded-full bg-[var(--eb-nude-a32)] text-sm font-medium text-foreground">
          {initialsOf(invite.professional || "EB")}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-[var(--text-secondary)]">Convite de</span>
          <span className="block text-[15px] font-medium text-foreground">
            {invite.professional || "sua esteticista"}
          </span>
        </span>
        {invite.code ? (
          <span className="font-mono text-xs text-[var(--text-secondary)]">{invite.code}</span>
        ) : null}
      </div>

      <div className="mt-5">
        <AuthTitle title="Crie seu acesso.">
          Seu cadastro fica vinculado a {firstName}: você acompanha seus horários, sua evolução e as
          recomendações dela.
        </AuthTitle>
      </div>

      <div className="mt-5 flex flex-col gap-3.5">
        <Field
          label="Seu nome"
          name="nome"
          autoComplete="name"
          placeholder="Mariana Silva"
          icon={<User aria-hidden />}
          required
        />
        <Field
          label="Celular"
          type="tel"
          name="celular"
          autoComplete="tel"
          placeholder="(11) 90000-0000"
          icon={<Phone aria-hidden />}
          required
        />
        <Field
          label="E-mail"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="voce@email.com"
          icon={<Mail aria-hidden />}
          required
        />
        <Field
          label="Senha"
          type="password"
          name="senha"
          autoComplete="new-password"
          icon={<Lock aria-hidden />}
          hint="Ao menos 8 caracteres."
          minLength={8}
          required
        />
      </div>

      <TermsCheck checked={terms} onChange={setTerms}>
        Concordo com os{" "}
        <a href="#termos" className={authLink}>
          termos de uso
        </a>{" "}
        e a{" "}
        <a href="#privacidade" className={authLink}>
          política de privacidade
        </a>
        . Minhas fotos só são usadas com a minha autorização.
      </TermsCheck>

      <Button type="submit" size="lg" className="mt-5 w-full" disabled={!terms || loading}>
        {loading ? "Criando acesso..." : "Criar meu acesso"}
      </Button>

      <p className="mt-[18px] text-center text-[13.5px] leading-normal text-[var(--text-secondary)]">
        Já tem conta?{" "}
        <button type="button" onClick={onLogin} className={authLink}>
          Entrar
        </button>
      </p>
    </form>
  );
}
