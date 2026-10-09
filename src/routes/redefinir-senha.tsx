import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Lock } from "lucide-react";

import { Field } from "@/components/auth/field";
import { AuthTitle } from "@/components/auth/terms-check";
import { BrandMark } from "@/components/brand/brand-mark";
import { Button } from "@/components/ui/button";
import { useAuthState } from "@/lib/session";
import { authService } from "@/services/auth.service";

export const Route = createFileRoute("/redefinir-senha")({
  head: () => ({ meta: [{ title: "Nova senha — EstetBoost." }] }),
  component: RedefinirSenhaPage,
});

/** O link do e-mail de recuperação abre esta página já com uma sessão temporária; aqui a pessoa escolhe a nova senha. */
function RedefinirSenhaPage() {
  const auth = useAuthState();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-[440px]">
        <div className="mb-5 text-2xl">
          <BrandMark />
        </div>
        <div className="rounded-[28px] border border-[var(--glass-border)] bg-[var(--glass)] p-7">
          {done ? (
            <>
              <AuthTitle title="Senha alterada.">Tudo certo. Você já pode usar o app.</AuthTitle>
              <Button size="lg" className="mt-5 w-full" onClick={() => navigate({ to: "/" })}>
                Continuar
              </Button>
            </>
          ) : auth.status === "loading" ? (
            <div className="min-h-[160px]" aria-busy />
          ) : auth.status === "out" ? (
            <>
              <AuthTitle title="Link inválido ou expirado.">
                Peça um novo link em “Esqueci minha senha”.
              </AuthTitle>
              <Button
                size="lg"
                variant="secondary"
                className="mt-5 w-full"
                onClick={() => navigate({ to: "/" })}
              >
                Voltar para o acesso
              </Button>
            </>
          ) : (
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                const password = String(data.get("senha"));
                if (password !== String(data.get("confirmar")))
                  return setError("As senhas não são iguais.");
                setLoading(true);
                setError(null);
                const result = await authService.updatePassword(password);
                setLoading(false);
                if (result.ok) setDone(true);
                else setError(result.message);
              }}
            >
              <AuthTitle title="Crie uma nova senha.">Use ao menos 8 caracteres.</AuthTitle>
              <div className="mt-5 flex flex-col gap-3.5">
                <Field
                  label="Nova senha"
                  name="senha"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  icon={<Lock aria-hidden />}
                  required
                />
                <Field
                  label="Repita a senha"
                  name="confirmar"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  icon={<Lock aria-hidden />}
                  error={error ?? undefined}
                  required
                />
              </div>
              <Button type="submit" size="lg" className="mt-5 w-full" disabled={loading}>
                {loading ? "Salvando..." : "Salvar nova senha"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
