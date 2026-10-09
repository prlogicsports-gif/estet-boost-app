import { useState } from "react";

import { Icon } from "@/components/eb/icon";
import { Button } from "@/components/ui/button";
import { useInstall } from "@/lib/pwa";

const DISMISS_KEY = "eb.install-dismissed";

/** Cartão "Instalar o app": botão no Android/computador e passo a passo no iPhone/iPad. Some quando já está instalado. */
export function InstallCard() {
  const { standalone, ios, canPrompt, install } = useInstall();
  const [steps, setSteps] = useState(false);
  if (standalone) {
    return (
      <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-card)] bg-[var(--surface-card)] px-3.5 py-3 text-[13.5px] text-[var(--text-secondary)]">
        <Icon name="CheckCircle2" size={18} color="var(--eb-teal-500)" /> App instalado neste
        aparelho.
      </div>
    );
  }
  if (!ios && !canPrompt) return null;
  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--border-card)] bg-[var(--surface-card)] p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 flex-none place-items-center rounded-[var(--radius-sm)] bg-[var(--eb-teal-a12)] text-[var(--eb-teal-500)]">
          <Icon name="Smartphone" size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-medium">Instalar o app EstetBoost.</div>
          <p className="mt-0.5 text-[12.5px] text-[var(--text-secondary)]">
            Abre em tela cheia, como um aplicativo, funciona sem internet e recebe avisos com o app
            fechado.
          </p>
        </div>
      </div>
      {ios ? (
        <>
          <Button type="button" onClick={() => setSteps((v) => !v)} className="self-start">
            <Icon name="Download" size={16} /> Adicionar à tela inicial
          </Button>
          {steps ? (
            <ol className="m-0 flex list-decimal flex-col gap-1.5 pl-5 text-[13px] text-[var(--text-secondary)]">
              <li>
                Toque em <strong className="text-foreground">Compartilhar</strong>{" "}
                <Icon name="Share" size={14} className="inline align-[-2px]" /> na barra do Safari.
              </li>
              <li>
                Escolha <strong className="text-foreground">Adicionar à Tela de Início</strong>. O
                nome <strong className="text-foreground">EstetBoost.</strong> e o ícone já vêm
                preenchidos.
              </li>
              <li>
                Toque em <strong className="text-foreground">Adicionar</strong> e abra o app pelo
                ícone <strong className="text-foreground">EB.</strong>
              </li>
            </ol>
          ) : null}
        </>
      ) : (
        <Button type="button" onClick={() => void install()} className="self-start">
          <Icon name="Download" size={16} /> Instalar app
        </Button>
      )}
    </div>
  );
}

/** Convite discreto no topo (celular, fora do app instalado). Quem dispensa só vê de novo depois de 14 dias. */
export function InstallBanner() {
  const { standalone, ios, canPrompt, install } = useInstall();
  const [hidden, setHidden] = useState(() => {
    try {
      return Date.now() - Number(window.localStorage.getItem(DISMISS_KEY) ?? 0) < 14 * 86400000;
    } catch {
      return false;
    }
  });
  if (standalone || hidden || (!ios && !canPrompt)) return null;
  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignorado */
    }
    setHidden(true);
  };
  return (
    <div className="mb-3 flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--eb-teal-a40)] bg-[var(--eb-teal-a12)] px-3.5 py-2.5 lg:hidden">
      <Icon name="Smartphone" size={18} color="var(--eb-teal-500)" />
      <span className="min-w-0 flex-1 text-[12.5px] leading-snug">
        {ios
          ? "Instale o app: Compartilhar → Adicionar à Tela de Início."
          : "Instale o app na tela inicial."}
      </span>
      {ios ? null : (
        <button
          type="button"
          className="min-h-9 rounded-full px-2.5 text-[12.5px] font-medium text-[var(--teal)]"
          onClick={() => void install()}
        >
          Instalar
        </button>
      )}
      <button
        type="button"
        aria-label="Dispensar"
        className="grid size-9 place-items-center text-muted-foreground"
        onClick={dismiss}
      >
        <Icon name="X" size={15} />
      </button>
    </div>
  );
}
