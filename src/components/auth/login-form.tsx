import { useState } from "react";
import { Lock, Mail } from "lucide-react";

import { AuthTitle, authLink } from "@/components/auth/terms-check";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/auth/field";
import { authService } from "@/services/auth.service";

export function LoginForm({
  onSuccess,
  onForgot,
  onCreate,
}: {
  onSuccess: () => void;
  onForgot: () => void;
  onCreate: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  return (
    <form
      className="mt-6"
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setLoading(true);
        setError(undefined);
        const result = await authService.signIn(
          String(data.get("email")),
          String(data.get("senha")),
        );
        setLoading(false);
        if (result.ok) onSuccess();
        else setError(result.message);
      }}
    >
      <AuthTitle title="Seu cuidado, organizado.">
        Acompanhe atendimentos, clientes e cada evolução.
      </AuthTitle>

      <div className="mt-5 flex flex-col gap-3.5">
        <Field
          label="E-mail"
          type="email"
          name="email"
          autoComplete="username"
          placeholder="voce@email.com"
          icon={<Mail aria-hidden />}
          error={error}
          required
        />
        <Field
          label="Senha"
          type="password"
          name="senha"
          autoComplete="current-password"
          placeholder="Sua senha"
          icon={<Lock aria-hidden />}
          required
        />
      </div>

      <div className="mt-2.5 flex justify-end">
        <button type="button" onClick={onForgot} className={`min-h-11 text-[13.5px] ${authLink}`}>
          Esqueci minha senha
        </button>
      </div>

      <Button type="submit" size="lg" className="mt-2.5 w-full" disabled={loading}>
        {loading ? "Entrando..." : "Entrar"}
      </Button>

      <p className="mt-[18px] text-center text-[13.5px] leading-normal text-[var(--text-secondary)]">
        Primeira vez por aqui?{" "}
        <button type="button" onClick={onCreate} className={authLink}>
          Criar minha conta
        </button>
      </p>
    </form>
  );
}
