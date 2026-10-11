import { useState } from "react";

import { TermsCheck } from "@/components/auth/terms-check";
import { Button } from "@/components/ui/button";
import { sessionStore } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { authService } from "@/services/auth.service";

/**
 * Primeiro acesso de quem teve a conta criada pela gestora: a gestora não pode aceitar os termos por ela,
 * então a tela fica travada até a cliente concordar (gravado em `profiles.terms_accepted_at`).
 */
export function TermsGate() {
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      const { error: failed } = await supabase.rpc("accept_terms");
      if (failed) throw failed;
      await sessionStore.refresh();
    } catch {
      setError("Não foi possível registrar o aceite. Confira a internet e tente de novo.");
    }
    setBusy(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Termos de uso e privacidade"
      className="fixed inset-0 z-[120] flex items-end justify-center bg-[rgba(20,14,17,.72)] sm:items-center sm:p-6"
    >
      <div className="flex max-h-[92dvh] w-full flex-col rounded-t-[var(--radius-2xl)] border border-[var(--glass-border)] bg-[var(--surface-raised)] sm:max-w-[520px] sm:rounded-[var(--radius-2xl)]">
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-2 pt-5">
          <h2 className="text-[22px] font-medium leading-tight">Bem-vinda ao EstetBoost.</h2>
          <p className="mt-2 text-[13.5px] leading-[1.5] text-[var(--text-secondary)]">
            Sua clínica criou seu acesso. Antes de continuar, leia e aceite como seus dados são
            usados:
          </p>
          <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-[13px] leading-[1.5] text-[var(--text-secondary)]">
            <li>
              Seus dados e seu histórico de atendimento (inclusive informações de saúde) ficam
              guardados com segurança e só a sua clínica e você acessam.
            </li>
            <li>
              As fotos de evolução só aparecem para você depois que você autoriza o uso de imagem,
              em Perfil.
            </li>
            <li>
              Você pode pedir uma cópia ou a exclusão dos seus dados à clínica a qualquer momento.
            </li>
            <li>
              Os avisos (lembretes de horário, cuidados) chegam pelo app e, se você ligar, no
              celular.
            </li>
          </ul>
          <TermsCheck checked={agree} onChange={setAgree}>
            Li e concordo com os termos de uso e com a política de privacidade do EstetBoost.
          </TermsCheck>
          {error ? (
            <p role="alert" className="mt-3 text-[13px] text-[var(--eb-coral-500)]">
              {error}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2 border-t border-[var(--border-hairline)] px-5 pb-[calc(16px+env(safe-area-inset-bottom))] pt-3.5">
          <Button type="button" size="lg" disabled={!agree || busy} onClick={() => void accept()}>
            {busy ? "Registrando…" : "Aceitar e continuar"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => void authService.signOut()}>
            Sair
          </Button>
        </div>
      </div>
    </div>
  );
}
