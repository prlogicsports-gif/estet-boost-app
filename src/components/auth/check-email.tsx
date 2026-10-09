import { MailCheck } from "lucide-react";

import { AuthTitle } from "@/components/auth/terms-check";
import { Button } from "@/components/ui/button";

/** Depois do cadastro: pede para confirmar o e-mail. O link abre o app já logado e o cadastro termina sozinho. */
export function CheckEmail({ email, onBack }: { email: string; onBack: () => void }) {
  return (
    <div className="mt-1 flex flex-col gap-4">
      <span className="grid size-12 place-items-center rounded-full bg-[var(--eb-teal-a12)] text-[var(--eb-teal-500)]">
        <MailCheck aria-hidden />
      </span>
      <AuthTitle title="Confirme seu e-mail.">
        Enviamos um link para <strong className="text-foreground">{email}</strong>. Abra o e-mail e
        toque no link: você volta para cá e seu cadastro termina sozinho.
      </AuthTitle>
      <p className="text-[12.5px] text-muted-foreground">
        Não chegou? Veja o spam e espere alguns minutos. O link vale por pouco tempo.
      </p>
      <Button type="button" size="lg" variant="secondary" onClick={onBack}>
        Voltar para o acesso
      </Button>
    </div>
  );
}
