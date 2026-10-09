import { useState } from "react";

import { Icon, WhatsAppIcon } from "@/components/eb/icon";
import { openWhatsApp } from "@/lib/whatsapp";
import { StatusBadge, type StatusTone } from "@/components/eb/status-badge";
import { Button } from "@/components/ui/button";
import type { Clinic } from "@/lib/use-clinic";
import { useRemote } from "@/lib/use-remote";
import { cn } from "@/lib/utils";
import {
  createClientInvite,
  inviteState,
  listInvites,
  revokeInvite,
  type InviteState,
} from "@/services/team.service";

/**
 * Cadastro de novas clientes pela gestora. Dois caminhos, os dois filiam a cliente à clínica:
 * 1. Link fixo da clínica: toda cliente que se cadastrar por ele entra na carteira.
 * 2. Credencial individual (EB-XXXX-XXXX): uso único, vale 7 dias. O código aparece só ao ser criado; no banco fica só o hash.
 */
const VALID_DAYS = 7;

const TONES: Record<InviteState, [StatusTone, string, string]> = {
  pendente: ["pending", "Aguardando cadastro", "Clock"],
  usada: ["confirmed", "Cadastro feito", "Check"],
  expirada: ["neutral", "Expirada", "CalendarX"],
  cancelada: ["cancelled", "Cancelada", "X"],
};

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    /* sem permissão da área de transferência */
  }
}

const field =
  "min-h-11 w-full rounded-[var(--radius-md)] border border-[var(--border-card)] bg-[var(--surface-field)] px-3 text-[14.5px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function LinkRow({
  url,
  label,
  copied,
  onCopy,
}: {
  url: string;
  label: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-hairline)] bg-[var(--eb-ivory-a06)] py-1.5 pl-3 pr-1.5">
      <Icon name="Link" size={15} color="var(--eb-nude-300)" />
      <span aria-label={label} className="min-w-0 flex-1 truncate font-mono text-[13px]">
        {url.replace(/^https?:\/\//, "")}
      </span>
      <Button type="button" variant="secondary" size="sm" onClick={onCopy}>
        <Icon name={copied ? "Check" : "Copy"} size={15} /> {copied ? "Copiado" : "Copiar"}
      </Button>
    </div>
  );
}

export function ClientInvite({
  clinic,
  compact,
}: {
  clinic: Pick<Clinic, "slug" | "name">;
  compact?: boolean;
}) {
  const invites = useRemote(listInvites);
  const [form, setForm] = useState<{ nome: string; celular: string } | null>(null);
  const [fresh, setFresh] = useState<{
    code: string;
    link: string;
    nome: string;
    celular: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const fixedLink = `${origin}/?p=${encodeURIComponent(clinic.slug)}&nome=${encodeURIComponent(clinic.name)}`;
  const fixedText = `Olá! Faça seu cadastro na EstetBoost para acompanhar seus atendimentos em ${clinic.name}: ${fixedLink}`;
  const list = (invites.data ?? []).filter((item) => item.role === "cliente");

  const mark = (key: string) => {
    setCopied(key);
    window.setTimeout(() => setCopied((current) => (current === key ? null : current)), 1800);
  };

  const share = (text: string, url: string, phone?: string) => {
    if (typeof navigator.share === "function" && !phone)
      navigator.share({ title: "Cadastro EstetBoost", text, url }).catch(() => {});
    else openWhatsApp(phone ?? "", text);
  };

  const generate = async () => {
    if (!form) return;
    setError(null);
    const result = await createClientInvite(form.nome, form.celular);
    if (!result.ok) return setError(result.message);
    const code = result.code ?? "";
    setFresh({
      code,
      link: `${origin}/?convite=${encodeURIComponent(code)}&nome=${encodeURIComponent(clinic.name)}`,
      nome: form.nome.trim(),
      celular: form.celular.trim(),
    });
    setForm(null);
    void invites.reload();
  };

  const freshText = (item: NonNullable<typeof fresh>) =>
    `${item.nome ? `Olá, ${item.nome.split(" ")[0]}! ` : "Olá! "}Seu cadastro na EstetBoost já está pronto para você acompanhar seus atendimentos em ${clinic.name}. Use o link: ${item.link} (ou o código ${item.code}). Válido por ${VALID_DAYS} dias.`;

  const card = cn(
    "flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--border-card)] bg-[var(--surface-card)]",
    compact ? "p-3.5" : "px-[18px] py-4",
  );

  return (
    <div className="flex flex-col gap-4">
      <section className={card}>
        <div className="flex items-start gap-3">
          <span className="grid size-[38px] flex-none place-items-center rounded-[var(--radius-sm)] bg-[var(--eb-teal-a12)] text-[var(--eb-teal-500)]">
            <Icon name="Pin" size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[17px] font-medium">Link de cadastro da clínica</div>
            <p className="mt-0.5 text-[12.5px] text-[var(--text-secondary)]">
              Fixo. Toda cliente que se cadastrar por ele entra na carteira de {clinic.name}.
            </p>
          </div>
        </div>
        <LinkRow
          url={fixedLink}
          label="Link fixo de cadastro"
          copied={copied === "fixo"}
          onCopy={() => copy(fixedLink).then(() => mark("fixo"))}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => share(fixedText, fixedLink)}>
            <Icon name="Send" size={15} /> Enviar link
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => openWhatsApp("", fixedText)}
          >
            <WhatsAppIcon size={16} /> WhatsApp
          </Button>
        </div>
      </section>

      <section className={card}>
        <div className="flex items-start gap-3">
          <span className="grid size-[38px] flex-none place-items-center rounded-[var(--radius-sm)] bg-[var(--eb-nude-a16)] text-[var(--eb-nude-300)]">
            <Icon name="KeyRound" size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[17px] font-medium">Credencial de cliente</div>
            <p className="mt-0.5 text-[12.5px] text-[var(--text-secondary)]">
              Código de uso único para uma cliente, válido por {VALID_DAYS} dias. Ele só aparece
              quando é criado.
            </p>
          </div>
        </div>

        {fresh ? (
          <div className="flex flex-col gap-2.5 rounded-[var(--radius-md)] border border-[var(--eb-teal-a40)] bg-[var(--eb-teal-a12)] p-3">
            <div className="text-center font-mono text-[20px] font-medium tracking-[0.08em]">
              {fresh.code}
            </div>
            <div className="flex flex-wrap justify-center gap-1.5">
              <Button
                type="button"
                size="sm"
                onClick={() => share(freshText(fresh), fresh.link, fresh.celular || undefined)}
              >
                {fresh.celular ? <WhatsAppIcon size={16} /> : <Icon name="Send" size={15} />}{" "}
                {fresh.celular ? "Enviar no WhatsApp" : "Enviar"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => copy(freshText(fresh)).then(() => mark("fresh"))}
              >
                <Icon name={copied === "fresh" ? "Check" : "Copy"} size={15} />{" "}
                {copied === "fresh" ? "Copiado" : "Copiar mensagem"}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setFresh(null)}>
                Fechar
              </Button>
            </div>
            <p className="text-center text-[11.5px] text-muted-foreground">
              Se perder o código, cancele e gere outro.
            </p>
          </div>
        ) : null}

        {form ? (
          <div className="flex flex-col gap-2.5">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-2.5">
              <label>
                <span className="mb-1.5 block text-[12.5px] text-[var(--text-secondary)]">
                  Nome da cliente (opcional)
                </span>
                <input
                  value={form.nome}
                  placeholder="Paula Andrade"
                  onChange={(event) => setForm({ ...form, nome: event.target.value })}
                  className={field}
                />
              </label>
              <label>
                <span className="mb-1.5 block text-[12.5px] text-[var(--text-secondary)]">
                  Celular (opcional)
                </span>
                <input
                  type="tel"
                  value={form.celular}
                  placeholder="(11) 90000-0000"
                  onChange={(event) => setForm({ ...form, celular: event.target.value })}
                  className={field}
                />
              </label>
            </div>
            {error ? <p className="text-[13px] text-[var(--eb-coral-500)]">{error}</p> : null}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setForm(null)}>
                Cancelar
              </Button>
              <Button type="button" size="sm" className="flex-1" onClick={() => void generate()}>
                <Icon name="KeyRound" size={15} /> Gerar credencial
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="self-start"
            onClick={() => (setFresh(null), setForm({ nome: "", celular: "" }))}
          >
            <Icon name="Plus" size={15} /> Nova credencial
          </Button>
        )}

        {list.length ? (
          <div className="flex flex-col gap-2">
            {list.map((invite) => {
              const state = inviteState(invite);
              const [tone, text, icon] = TONES[state];
              return (
                <div
                  key={invite.id}
                  className={cn(
                    "flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--border-hairline)] bg-[var(--eb-ivory-a06)] p-3",
                    state === "pendente" || state === "usada" ? "opacity-100" : "opacity-60",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="min-w-20 flex-1 text-[13.5px]">
                      {invite.name_hint || "Sem nome"}
                    </span>
                    <StatusBadge tone={tone} size="sm" icon={icon}>
                      {text}
                    </StatusBadge>
                  </div>
                  <div className="font-mono text-[11.5px] text-muted-foreground">
                    Gerada {shortDate(invite.created_at)}
                    {state === "pendente" ? ` · vale até ${shortDate(invite.expires_at)}` : ""}
                    {invite.phone_hint ? ` · ${invite.phone_hint}` : ""}
                  </div>
                  {state === "pendente" ? (
                    <div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          await revokeInvite(invite.id);
                          void invites.reload();
                        }}
                      >
                        Cancelar credencial
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </section>
    </div>
  );
}
