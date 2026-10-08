import { useEffect, useState } from "react";

import { Icon } from "@/components/eb/icon";
import { StatusBadge, type StatusTone } from "@/components/eb/status-badge";
import { Button } from "@/components/ui/button";
import {
  readInvites,
  stateOf,
  writeInvites,
  type InviteRec as Invite,
  type InviteState,
} from "@/lib/invites-store";
import type { ClinicRec } from "@/lib/models";
import { cn } from "@/lib/utils";

/**
 * Cadastro de novas clientes pela profissional. Dois caminhos, os dois já
 * atrelam a cliente a quem convidou:
 * 1. Link fixo do perfil: o mesmo para sempre; toda cliente que se cadastrar por ele entra na carteira.
 * 2. Credencial individual: código de uso único (EB-XXXX-XXXX), válido por 7 dias.
 * A lista fica no aparelho enquanto não há backend.
 */
const VALID_DAYS = 7;

// Sem 0/O e 1/I/L: o código é lido em voz alta e digitado.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function makeCode() {
  const bytes = new Uint32Array(8);
  window.crypto.getRandomValues(bytes);
  const text = Array.from(bytes, (n) => ALPHABET[n % ALPHABET.length]).join("");
  return `EB-${text.slice(0, 4)}-${text.slice(4)}`;
}

const TONES: Record<InviteState, [StatusTone, string, string]> = {
  pendente: ["pending", "Aguardando cadastro", "Clock"],
  usada: ["confirmed", "Cadastro feito", "Check"],
  expirada: ["neutral", "Expirada", "CalendarX"],
  revogada: ["cancelled", "Cancelada", "X"],
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

function whatsapp(phone: string, text: string) {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits ? (digits.length <= 11 ? `55${digits}` : digits) : ""}?text=${encodeURIComponent(text)}`;
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
  clinic: Pick<ClinicRec, "id" | "slug" | "name" | "owner">;
  compact?: boolean;
}) {
  const slug = clinic.slug;
  const id = clinic.id;
  const [origin, setOrigin] = useState("");
  const [list, setList] = useState<Invite[]>([]);
  const [form, setForm] = useState<{ nome: string; celular: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
    setList(readInvites(id));
  }, [id]);

  const fixedLink = `${origin}/?p=${encodeURIComponent(slug)}&nome=${encodeURIComponent(clinic.name)}`;
  const fixedText = `Olá! Faça seu cadastro na EstetBoost para acompanhar seus atendimentos comigo: ${fixedLink}`;

  const mark = (key: string) => {
    setCopied(key);
    window.setTimeout(() => setCopied((current) => (current === key ? null : current)), 1800);
  };

  const share = (text: string, url: string, phone?: string) => {
    if (typeof navigator.share === "function" && !phone) {
      navigator.share({ title: "Cadastro EstetBoost", text, url }).catch(() => {});
    } else {
      window.open(whatsapp(phone ?? "", text), "_blank", "noopener");
    }
  };

  const generate = () => {
    if (!form) return;
    const codigo = makeCode();
    const invite: Invite = {
      codigo,
      nome: form.nome.trim(),
      celular: form.celular.trim(),
      criadaEm: new Date().toISOString(),
      expiraEm: new Date(Date.now() + VALID_DAYS * 86400000).toISOString(),
      link: `${origin}/?convite=${codigo}&nome=${encodeURIComponent(clinic.name)}`,
    };
    const next = [invite, ...list];
    setList(next);
    writeInvites(id, next);
    setForm(null);
    mark(`novo-${codigo}`);
  };

  const revoke = (invite: Invite) => {
    const next = list.map((item) =>
      item.codigo === invite.codigo ? { ...item, revogada: true } : item,
    );
    setList(next);
    writeInvites(id, next);
  };

  const inviteText = (invite: Invite) =>
    `${invite.nome ? `Olá, ${invite.nome.split(" ")[0]}! ` : "Olá! "}Seu cadastro na EstetBoost já está pronto para você acompanhar seus atendimentos comigo. Use o link: ${invite.link} (ou o código ${invite.codigo}). Válido até ${shortDate(invite.expiraEm)}.`;

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
            <div className="text-[17px] font-medium">Seu link de cadastro</div>
            <p className="mt-0.5 text-[12.5px] text-[var(--text-secondary)]">
              Fixo no seu perfil. Toda cliente que se cadastrar por ele já entra na carteira de{" "}
              {clinic.name}.
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
            onClick={() => window.open(whatsapp("", fixedText), "_blank", "noopener")}
          >
            <Icon name="MessageCircle" size={15} /> WhatsApp
          </Button>
          <Button type="button" variant="ghost" size="sm" asChild>
            <a href={fixedLink} target="_blank" rel="noreferrer">
              <Icon name="ExternalLink" size={15} /> Ver como a cliente vê
            </a>
          </Button>
        </div>
      </section>

      <section className={card}>
        <div className="flex items-start gap-3">
          <span className="grid size-[38px] flex-none place-items-center rounded-[var(--radius-sm)] bg-[var(--eb-nude-a16)] text-[var(--eb-nude-300)]">
            <Icon name="KeyRound" size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[17px] font-medium">Credencial de cadastro</div>
            <p className="mt-0.5 text-[12.5px] text-[var(--text-secondary)]">
              Um código de uso único para uma cliente específica, válido por {VALID_DAYS} dias.
            </p>
          </div>
        </div>

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
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setForm(null)}>
                Cancelar
              </Button>
              <Button type="button" size="sm" className="flex-1" onClick={generate}>
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
            onClick={() => setForm({ nome: "", celular: "" })}
          >
            <Icon name="Plus" size={15} /> Nova credencial
          </Button>
        )}

        {list.length ? (
          <div className="flex flex-col gap-2">
            {list.map((invite) => {
              const state = stateOf(invite);
              const [tone, label, icon] = TONES[state];
              const active = state === "pendente";
              const fresh = copied === `novo-${invite.codigo}`;
              return (
                <div
                  key={invite.codigo}
                  className={cn(
                    "flex flex-col gap-2 rounded-[var(--radius-md)] border p-3",
                    fresh
                      ? "border-[var(--eb-teal-a40)] bg-[var(--eb-teal-a12)]"
                      : "border-[var(--border-hairline)] bg-[var(--eb-ivory-a06)]",
                    active || state === "usada" ? "opacity-100" : "opacity-60",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono text-[15px] font-medium tracking-[0.06em]">
                      {invite.codigo}
                    </span>
                    <span className="min-w-20 flex-1 text-[12.5px] text-[var(--text-secondary)]">
                      {invite.nome || "Sem nome"}
                    </span>
                    <StatusBadge tone={tone} size="sm" icon={icon}>
                      {label}
                    </StatusBadge>
                  </div>
                  <div className="font-mono text-[11.5px] text-muted-foreground">
                    Gerada {shortDate(invite.criadaEm)}
                    {active ? ` · vale até ${shortDate(invite.expiraEm)}` : ""}
                    {invite.celular ? ` · ${invite.celular}` : ""}
                  </div>
                  {active ? (
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() =>
                          share(inviteText(invite), invite.link, invite.celular || undefined)
                        }
                      >
                        <Icon name="Send" size={15} />{" "}
                        {invite.celular ? "Enviar no WhatsApp" : "Enviar"}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => copy(invite.link).then(() => mark(invite.codigo))}
                      >
                        <Icon name={copied === invite.codigo ? "Check" : "Copy"} size={15} />{" "}
                        {copied === invite.codigo ? "Copiado" : "Copiar link"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => revoke(invite)}
                      >
                        Cancelar
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
