import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/auth/field";
import { authService } from "@/services/auth.service";

export function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  if (sent) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-light text-foreground">Enviamos o link para você.</h1>
        <p className="text-sm text-muted-foreground">
          Confira seu e-mail e siga as instruções para criar uma nova senha.
        </p>
        <Button size="lg" variant="secondary" className="w-full" onClick={onBack}>
          Voltar para o acesso
        </Button>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setLoading(true);
        await authService.requestPasswordReset();
        setLoading(false);
        setSent(true);
      }}
    >
      <div>
        <h1 className="text-xl font-light text-foreground">Vamos recuperar seu acesso.</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Informe o e-mail da sua conta e enviaremos um link para redefinir a senha.
        </p>
      </div>

      <Field label="E-mail" type="email" name="email" autoComplete="email" placeholder="voce@estudio.com" required />

      <Button type="submit" size="lg" className="w-full" disabled={loading}>
        {loading ? "Enviando..." : "Enviar link"}
      </Button>
      <Button type="button" size="lg" variant="ghost" className="w-full" onClick={onBack}>
        Voltar
      </Button>
    </form>
  );
}
