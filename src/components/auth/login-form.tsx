import { useState } from "react";

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

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setLoading(true);
        await authService.signIn();
        setLoading(false);
        onSuccess();
      }}
    >
      <div>
        <h1 className="text-xl font-light text-foreground">Seu cuidado, organizado.</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Acompanhe atendimentos, clientes e cada evolução.
        </p>
      </div>

      <Field label="E-mail" type="email" name="email" autoComplete="email" placeholder="voce@estudio.com" required />
      <Field label="Senha" type="password" name="senha" autoComplete="current-password" placeholder="••••••••" required />

      <button
        type="button"
        onClick={onForgot}
        className="min-h-11 text-sm text-[var(--teal)] underline-offset-4 hover:underline"
      >
        Esqueci minha senha
      </button>

      <Button type="submit" size="lg" className="w-full" disabled={loading}>
        {loading ? "Entrando..." : "Entrar"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Ainda não tem conta?{" "}
        <button type="button" onClick={onCreate} className="text-primary underline-offset-4 hover:underline">
          Criar minha conta
        </button>
      </p>
    </form>
  );
}
