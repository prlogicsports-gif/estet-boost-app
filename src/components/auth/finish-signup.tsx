import { useEffect, useRef, useState } from "react";
import { Building2, KeyRound, MapPin, Phone, Sparkles, User } from "lucide-react";

import { Field } from "@/components/auth/field";
import { AuthTitle } from "@/components/auth/terms-check";
import { Button } from "@/components/ui/button";
import { authService, pendingStore } from "@/services/auth.service";

type Mode = "clinica" | "cliente" | "equipe";

/**
 * A pessoa já tem login (e-mail confirmado) mas ainda não tem perfil. Se havia um cadastro em andamento
 * neste aparelho, termina sozinho; senão, pergunta o que ela é (abrir clínica ou entrar com credencial).
 */
export function FinishSignup({ email }: { email: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(() => pendingStore.get() !== null);
  const [mode, setMode] = useState<Mode>("clinica");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current || !pendingStore.get()) return;
    ran.current = true;
    authService.finishPending().then((result) => {
      if (!result.ok) setMessage(result.message);
      setBusy(false);
    });
  }, []);

  if (busy) {
    return (
      <div className="mt-1">
        <AuthTitle title="Finalizando seu cadastro…">Só um instante.</AuthTitle>
      </div>
    );
  }

  const run = async (pending: Parameters<typeof pendingStore.set>[0]) => {
    setBusy(true);
    setMessage(null);
    pendingStore.set(pending);
    const result = await authService.finishPending();
    if (!result.ok) setMessage(result.message);
    setBusy(false);
  };

  return (
    <form
      className="mt-1"
      onSubmit={(event) => {
        event.preventDefault();
        const d = new FormData(event.currentTarget);
        const name = String(d.get("nome") ?? "");
        if (mode === "clinica")
          void run({
            type: "gestor",
            name,
            phone: String(d.get("celular") ?? ""),
            studio: String(d.get("estudio") ?? ""),
            city: String(d.get("cidade") ?? ""),
            document: "",
            size: "autonoma",
          });
        else if (mode === "cliente")
          void run({
            type: "cliente",
            name,
            phone: String(d.get("celular") ?? ""),
            code: String(d.get("codigo") ?? ""),
            slug: null,
          });
        else void run({ type: "equipe", name, code: String(d.get("codigo") ?? "") });
      }}
    >
      <AuthTitle title="Falta pouco.">
        Seu e-mail <strong className="text-foreground">{email}</strong> está confirmado. Conte como
        você vai usar a EstetBoost.
      </AuthTitle>

      <div
        role="tablist"
        className="mt-4 grid grid-cols-3 gap-1 rounded-full border border-[var(--border-hairline)] bg-[var(--eb-ivory-a06)] p-1 text-[12.5px]"
      >
        {(
          [
            ["clinica", "Abrir clínica"],
            ["cliente", "Sou cliente"],
            ["equipe", "Sou da equipe"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={mode === id}
            onClick={() => setMode(id)}
            className={`min-h-10 rounded-full px-2 ${mode === id ? "bg-[var(--eb-ivory-a10)] font-medium text-foreground" : "text-[var(--text-secondary)]"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-3.5">
        <Field
          label="Seu nome"
          name="nome"
          autoComplete="name"
          icon={<User aria-hidden />}
          required
        />
        {mode === "clinica" ? (
          <>
            <Field
              label="Nome do estúdio"
              name="estudio"
              icon={<Sparkles aria-hidden />}
              required
            />
            <Field label="Cidade" name="cidade" icon={<MapPin aria-hidden />} />
            <Field label="Celular" name="celular" type="tel" icon={<Phone aria-hidden />} />
          </>
        ) : (
          <>
            <Field
              label="Código da credencial"
              name="codigo"
              placeholder="EB-XXXX-XXXX"
              icon={<KeyRound aria-hidden />}
              required
            />
            {mode === "cliente" ? (
              <Field label="Celular" name="celular" type="tel" icon={<Phone aria-hidden />} />
            ) : null}
          </>
        )}
      </div>

      {message ? (
        <p role="alert" className="mt-4 text-[13px] text-[var(--eb-coral-500)]">
          {message}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="mt-5 w-full" disabled={busy}>
        <Building2 aria-hidden />{" "}
        {mode === "clinica" ? "Criar minha clínica" : "Entrar com a credencial"}
      </Button>
      <Button
        type="button"
        size="lg"
        variant="ghost"
        className="mt-2 w-full"
        onClick={() => void authService.signOut()}
      >
        Sair
      </Button>
    </form>
  );
}
