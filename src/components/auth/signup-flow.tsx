import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Lock,
  Mail,
  MapPin,
  Phone,
  Receipt,
  Sparkles,
  User,
} from "lucide-react";

import { AuthTitle, TermsCheck, authLink } from "@/components/auth/terms-check";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/auth/field";
import type { Session, StudioSize } from "@/lib/auth.types";
import { authService } from "@/services/auth.service";
import { cn } from "@/lib/utils";

const sizes = [
  { value: "autonoma", label: "Sozinha, como autônoma", note: "Só você atende as clientes." },
  {
    value: "clinica",
    label: "Com uma equipe",
    note: "Centro de estética com outras profissionais.",
  },
] as const;

export function SignupFlow({
  onSuccess,
  onLogin,
}: {
  onSuccess: (session: Session) => void;
  onLogin: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [size, setSize] = useState<StudioSize>("autonoma");
  const [terms, setTerms] = useState(true);
  const [loading, setLoading] = useState(false);
  const [account, setAccount] = useState({ name: "", email: "" });

  return (
    <form
      className="mt-6"
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        if (step === 1) {
          setAccount({ name: String(data.get("nome")), email: String(data.get("email")) });
          setStep(2);
          return;
        }
        setLoading(true);
        const result = await authService.signUp(account);
        setLoading(false);
        if (result.ok) onSuccess(result.session);
      }}
    >
      <span className="text-[11px] font-medium uppercase leading-none tracking-[0.14em] text-muted-foreground">
        Passo {step} de 2
      </span>
      <div className="mt-2.5">
        <AuthTitle title={step === 1 ? "Vamos começar por você." : "Agora, o seu estúdio."}>
          {step === 1
            ? "É o seu acesso de profissional — as clientes recebem o convite depois."
            : "Isso define como a agenda e a equipe aparecem no aplicativo."}
        </AuthTitle>
      </div>
      <div className="mt-[18px] flex gap-1.5" aria-hidden>
        <span className="h-[3px] flex-1 rounded-full bg-[var(--teal)]" />
        <span
          className={cn(
            "h-[3px] flex-1 rounded-full",
            step === 2 ? "bg-[var(--teal)]" : "bg-[var(--eb-ivory-a10)]",
          )}
        />
      </div>

      {step === 1 ? (
        <>
          <div className="mt-5 flex flex-col gap-3.5">
            <Field
              label="Seu nome"
              name="nome"
              autoComplete="name"
              placeholder="Fernanda Lima"
              icon={<User aria-hidden />}
              defaultValue={account.name}
              required
            />
            <Field
              label="E-mail"
              type="email"
              name="email"
              autoComplete="email"
              placeholder="fernanda@estudio.com.br"
              icon={<Mail aria-hidden />}
              defaultValue={account.email}
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
          <Button type="submit" size="lg" className="mt-5 w-full">
            Continuar <ArrowRight aria-hidden />
          </Button>
        </>
      ) : (
        <>
          <div className="mt-5 flex flex-col gap-3.5">
            <Field
              label="Nome do estúdio"
              name="estudio"
              placeholder="Estúdio Fernanda Lima"
              icon={<Sparkles aria-hidden />}
              required
            />
            <div>
              <span className="mb-2 block text-[13.5px] leading-[1.4] text-[var(--text-secondary)]">
                Como você atende hoje?
              </span>
              <div className="flex flex-col gap-2">
                {sizes.map((option) => {
                  const active = size === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setSize(option.value)}
                      aria-pressed={active}
                      className={cn(
                        "w-full rounded-[var(--radius-md)] border px-3.5 py-3 text-left transition-colors",
                        active
                          ? "border-[var(--eb-teal-a40)] bg-[var(--eb-teal-a12)]"
                          : "border-[var(--border-hairline)] bg-[var(--eb-ivory-a06)]",
                      )}
                    >
                      <span className="block text-[15px] leading-[1.35] text-foreground">
                        {option.label}
                      </span>
                      <span className="mt-0.5 block text-xs leading-[1.4] text-muted-foreground">
                        {option.note}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <Field
              label="Cidade"
              name="cidade"
              placeholder="São Paulo, SP"
              icon={<MapPin aria-hidden />}
              required
            />
            <Field
              label="CNPJ ou CPF"
              name="documento"
              inputMode="numeric"
              icon={<Receipt aria-hidden />}
              hint="Só para emitir recibos. Pode preencher depois."
            />
          </div>
          <TermsCheck checked={terms} onChange={setTerms}>
            Concordo com os{" "}
            <a href="#termos" className={authLink}>
              termos de uso
            </a>{" "}
            e com a{" "}
            <a href="#privacidade" className={authLink}>
              política de privacidade
            </a>
            . Os dados das suas clientes são seus e só aparecem para elas com autorização.
          </TermsCheck>
          <div className="mt-5 flex gap-2">
            <Button type="button" variant="secondary" size="lg" onClick={() => setStep(1)}>
              <ArrowLeft aria-hidden /> Voltar
            </Button>
            <Button type="submit" size="lg" className="flex-1" disabled={!terms || loading}>
              {loading ? "Criando conta..." : "Criar minha conta"}
            </Button>
          </div>
        </>
      )}

      <p className="mt-[18px] text-center text-[13.5px] leading-normal text-[var(--text-secondary)]">
        Já tem conta?{" "}
        <button type="button" onClick={onLogin} className={authLink}>
          Entrar
        </button>
      </p>
    </form>
  );
}
