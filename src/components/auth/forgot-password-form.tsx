import { useState } from "react";
import { Mail } from "lucide-react";

import { AuthTitle } from "@/components/auth/terms-check";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/auth/field";
import { authService } from "@/services/auth.service";

export function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  if (sent) {
    return (
      <div className="mt-1">
        <AuthTitle title="Enviamos o link para você.">
          Confira seu e-mail e siga as instruções para criar uma nova senha.
        </AuthTitle>
        <Button size="lg" variant="secondary" className="mt-5 w-full" onClick={onBack}>
          Voltar para o acesso
        </Button>
      </div>
    );
  }

  return (
    <form
      className="mt-1"
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setLoading(true);
        await authService.requestPasswordReset(String(data.get("email")));
        setLoading(false);
        setSent(true);
      }}
    >
      <AuthTitle title="Vamos recuperar seu acesso.">
        Informe o e-mail da sua conta e enviaremos um link para redefinir a senha.
      </AuthTitle>
      <div className="mt-5">
        <Field
          label="E-mail"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="fernanda@estudio.com.br"
          icon={<Mail aria-hidden />}
          required
        />
      </div>
      <Button type="submit" size="lg" className="mt-5 w-full" disabled={loading}>
        {loading ? "Enviando..." : "Enviar link"}
      </Button>
      <Button type="button" size="lg" variant="ghost" className="mt-2 w-full" onClick={onBack}>
        Voltar
      </Button>
    </form>
  );
}
