import { useEffect, useState } from "react";

import { BrandMark } from "@/components/brand/brand-mark";
import { Icon } from "@/components/eb/icon";
import { Modal } from "@/components/eb/overlays";
import { Button } from "@/components/ui/button";
import type { Audience } from "@/lib/models";
import { setPrefs } from "@/services/notify";
import { pushStatus, pushSupported, registerPush } from "@/services/push.service";

const SNOOZE_KEY = "eb.push-prompt";
const SNOOZE_MS = 7 * 86400000;

const snoozed = () => {
  try {
    return Date.now() - Number(window.localStorage.getItem(SNOOZE_KEY) ?? 0) < SNOOZE_MS;
  } catch {
    return false;
  }
};

/**
 * Convite para ligar as notificações no aparelho. Aparece uma vez depois que a tela abriu, só se o aparelho
 * consegue receber push e a pessoa ainda não decidiu. "Agora não" só volta depois de 7 dias. No iPhone ele só
 * aparece com o app instalado na tela inicial (antes disso o aviso de instalar cuida do caminho).
 */
export function PushPrompt({ audience, ready }: { audience: Audience; ready: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!ready) return;
    const handle = window.setTimeout(() => {
      if (pushSupported() && pushStatus() === "default" && !snoozed()) setOpen(true);
    }, 5500); // depois da abertura (splash) e da primeira tela
    return () => window.clearTimeout(handle);
  }, [ready]);

  const later = () => {
    try {
      window.localStorage.setItem(SNOOZE_KEY, String(Date.now()));
    } catch {
      /* ignorado */
    }
    setOpen(false);
  };

  const enable = async () => {
    setBusy(true);
    const status = await registerPush();
    setBusy(false);
    if (status === "granted") {
      setPrefs(audience, { push: true });
      setOpen(false);
    } else if (status === "denied") setBlocked(true);
    else later();
  };

  return (
    <Modal open={open} onClose={later} title="" width={400}>
      <div className="flex flex-col items-center gap-3 pb-1 text-center">
        <span className="grid size-16 place-items-center rounded-[20px] bg-[var(--eb-teal-a12)] text-[var(--eb-teal-500)]">
          <Icon name="BellRing" size={30} />
        </span>
        <BrandMark className="text-[22px]" />
        <h2 className="text-[19px] font-medium leading-snug">
          {blocked ? "Notificações bloqueadas" : "Ative as notificações"}
        </h2>
        <p className="text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
          {blocked
            ? "O aparelho bloqueou os avisos. Libere em Ajustes do aparelho → Notificações → EstetBoost. para receber."
            : audience === "cliente"
              ? "Receba o lembrete do seu atendimento, mudanças de horário e seus cuidados, mesmo com o app fechado."
              : "Receba horários, confirmações, cobranças e lembretes na hora, mesmo com o app fechado."}
        </p>
        {blocked ? (
          <Button type="button" onClick={() => setOpen(false)} className="mt-1 w-full">
            Entendi
          </Button>
        ) : (
          <>
            <Button
              type="button"
              onClick={() => void enable()}
              disabled={busy}
              className="mt-1 w-full"
            >
              <Icon name="Bell" size={16} /> {busy ? "Ativando…" : "Ativar notificações"}
            </Button>
            <button
              type="button"
              onClick={later}
              className="min-h-11 px-3 text-[13.5px] text-[var(--text-secondary)]"
            >
              Agora não
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
