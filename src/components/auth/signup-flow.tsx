import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/auth/field";
import { authService } from "@/services/auth.service";
import type { StudioSize } from "@/lib/auth.types";
import { cn } from "@/lib/utils";

export function SignupFlow({ onSuccess }: { onSuccess: () => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [size, setSize] = useState<StudioSize>("autonoma");
  const [loading, setLoading] = useState(false);

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (step === 1) {
          setStep(2);
          return;
        }
        setLoading(true);
        await authService.signUp({ size });
        setLoading(false);
        onSuccess();
      }}
    >
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--nude-sand)]">
        Passo {step} de 2
      </p>

      {step === 1 ? (
        <>
          <h1 className="text-xl font-light text-foreground">Vamos começar por você.</h1>
          <Field label="Nome completo" name="nome" autoComplete="name" placeholder="Seu nome" required />
          <Field label="E-mail" type="email" name="email" autoComplete="email" placeholder="voce@estudio.com" required />
          <Field label="Celular" name="celular" inputMode="tel" placeholder="(11) 90000-0000" required />
          <Field label="Senha" type="password" name="senha" autoComplete="new-password" placeholder="Mínimo de 8 caracteres" required />
        </>
      ) : (
        <>
          <h1 className="text-xl font-light text-foreground">Agora, o seu estúdio.</h1>
          <Field label="Nome do estúdio" name="estudio" placeholder="Como sua cliente te encontra" required />

          <div className="space-y-1.5">
            <span className="block text-xs text-muted-foreground">Porte</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  { value: "autonoma", label: "Sozinha, como autônoma" },
                  { value: "clinica", label: "Com uma equipe" },
                ] as const
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSize(option.value)}
                  aria-pressed={size === option.value}
                  className={cn(
                    "min-h-11 rounded-[var(--radius-md)] border px-3 text-left text-sm transition-colors",
                    size === option.value
                      ? "border-primary bg-[var(--accent)] text-foreground"
                      : "border-border bg-[var(--muted)] text-muted-foreground",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <Field label="Cidade" name="cidade" placeholder="Onde você atende" required />
          <Field label="CNPJ ou CPF" name="documento" inputMode="numeric" placeholder="Somente números" required />
        </>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={loading}>
        {step === 1 ? "Continuar" : loading ? "Criando conta..." : "Criar conta"}
      </Button>

      {step === 2 ? (
        <Button type="button" size="lg" variant="ghost" className="w-full" onClick={() => setStep(1)}>
          Voltar
        </Button>
      ) : null}
    </form>
  );
}
