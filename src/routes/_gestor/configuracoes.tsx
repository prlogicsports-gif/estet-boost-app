import { BlockTimeDrawer } from "@/components/agenda/block-time-drawer";
import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { ClientInvite } from "@/components/eb/client-invite";
import { InstallCard } from "@/components/eb/install-app";
import { Icon } from "@/components/eb/icon";
import { IconButton } from "@/components/eb/icon-button";
import { Input } from "@/components/eb/input";
import { Drawer } from "@/components/eb/overlays";
import { TopBar } from "@/components/eb/top-bar";
import { NotificationPrefsEditor } from "@/components/eb/notifications-panel";
import { ToastHost } from "@/components/eb/toast";
import { NewProcedureForm } from "@/components/session/new-procedure-form";
import { Button } from "@/components/ui/button";
import { blocksDb, hoursDb, proceduresDb, settingsDb } from "@/data/db";
import { formatShort, todayISO } from "@/lib/dates";
import { sessionStore, useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { refreshClinic, useClinic } from "@/lib/use-clinic";
import { usePro } from "@/lib/use-pro";
import { useSignOut } from "@/lib/use-sign-out";
import { TeamPanel } from "@/components/team/team-panel";
import { removeProcedure, saveProcedure } from "@/services/sessions.service";
import { brl } from "@/lib/view";

export const Route = createFileRoute("/_gestor/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — EstetBoost." },
      {
        name: "description",
        content: "Ajuste seu perfil, horários de atendimento e preferências do estúdio.",
      },
      { property: "og:title", content: "Configurações — EstetBoost." },
      {
        property: "og:description",
        content: "Ajuste seu perfil, horários de atendimento e preferências do estúdio.",
      },
    ],
  }),
  component: ConfiguracoesPage,
});

const row =
  "flex min-h-14 w-full items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-card)] bg-[var(--surface-card)] px-3.5 py-2 text-left";
const heading =
  "text-[11px] font-medium uppercase leading-[1.2] tracking-[0.14em] text-muted-foreground";

type Sheet =
  | "perfil"
  | "horarios"
  | "procedimentos"
  | "anamnese"
  | "consentimento"
  | "bloqueios"
  | "link"
  | null;

const ITEMS: [Sheet & string, string, string, string][] = [
  ["perfil", "User", "Perfil e clínica", "Seus dados, nome e contato da clínica"],
  ["link", "Link", "Link e credenciais de cadastro", "Como as clientes se filiam à sua clínica"],
  ["horarios", "Clock", "Horários de atendimento", "Dias e horários livres na agenda"],
  ["bloqueios", "CalendarX", "Bloqueios de agenda", "Folgas, férias e compromissos"],
  ["procedimentos", "Sparkles", "Procedimentos e valores", "Duração, preço e retorno sugerido"],
  ["anamnese", "FileText", "Modelos de anamnese", "Perguntas de cada etapa"],
  [
    "consentimento",
    "ShieldCheck",
    "Consentimentos e autorizações",
    "Termo de autorização de imagem",
  ],
];

const DAYS: [string, string][] = [
  ["1", "Segunda"],
  ["2", "Terça"],
  ["3", "Quarta"],
  ["4", "Quinta"],
  ["5", "Sexta"],
  ["6", "Sábado"],
  ["0", "Domingo"],
];

function ConfiguracoesPage() {
  const pro = usePro();
  const session = useSession();
  const { clinic } = useClinic();
  const signOut = useSignOut();
  const isGestor = session?.role === "gestor";
  const [sheet, setSheet] = useState<Sheet>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const close = (message?: string) => {
    setSheet(null);
    if (message) setToast(message);
  };

  return (
    <div className="flex flex-col gap-4">
      <TopBar title="Configurações" context={clinic?.name ?? pro.name} user={pro} />

      <div className="flex items-center gap-3.5">
        <span className="grid size-16 place-items-center rounded-full bg-[var(--eb-nude-a32)] text-[21px] font-medium">
          {pro.initials}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-xl font-medium">{pro.name}</div>
          <div className="truncate text-[13px] text-[var(--text-secondary)]">
            {[session?.email, clinic?.name, clinic?.city].filter(Boolean).join(" · ")}
          </div>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={() => setSheet("perfil")}>
          <Icon name="PencilLine" size={15} /> Editar perfil
        </Button>
      </div>

      <InstallCard />

      <span className={heading}>Avisos</span>
      <NotificationPrefsEditor audience="gestor" />

      {isGestor ? <TeamPanel onToast={setToast} /> : null}

      <span className={`${heading} mt-2`}>{isGestor ? "Estúdio" : "Conta"}</span>
      <div className="flex flex-col gap-2">
        {(isGestor ? ITEMS : []).map(([id, icon, title, detail]) => (
          <button key={id} type="button" className={row} onClick={() => setSheet(id)}>
            <Icon name={icon} size={18} color="var(--eb-nude-300)" />
            <span className="min-w-0 flex-1">
              <span className="block text-[14.5px]">{title}</span>
              <span className="block text-xs text-muted-foreground">{detail}</span>
            </span>
            <Icon name="ChevronRight" size={16} className="text-muted-foreground" />
          </button>
        ))}
        <button
          type="button"
          className={`${row} text-[var(--eb-coral-500)]`}
          onClick={() => void signOut()}
        >
          <Icon name="LogOut" size={18} color="var(--eb-coral-500)" />
          <span className="flex-1 text-[14.5px]">Sair da conta</span>
        </button>
      </div>

      <ProfileDrawer open={sheet === "perfil"} onClose={close} session={session ?? null} />
      <Drawer
        open={sheet === "link"}
        onClose={() => close()}
        title="Link e credenciais"
        subtitle="Cada clínica tem o próprio link: quem se cadastra por ele fica filiada a você"
        width={520}
      >
        {clinic ? <ClientInvite clinic={clinic} compact /> : null}
      </Drawer>
      <HoursDrawer open={sheet === "horarios"} onClose={close} />
      <BlockTimeDrawer open={sheet === "bloqueios"} onClose={close} />
      <ProceduresDrawer open={sheet === "procedimentos"} onClose={close} />
      <QuestionsDrawer open={sheet === "anamnese"} onClose={close} />
      <ConsentDrawer open={sheet === "consentimento"} onClose={close} />
      <ToastHost toast={toast ? { message: toast } : null} />
    </div>
  );
}

const footer = (onClose: () => void, submit: () => void, text: string) => (
  <>
    <Button type="button" variant="ghost" onClick={onClose}>
      Cancelar
    </Button>
    <Button type="button" variant="tech" className="flex-1" onClick={submit}>
      <Icon name="Check" size={18} /> {text}
    </Button>
  </>
);

function ProfileDrawer({
  open,
  onClose,
  session,
}: {
  open: boolean;
  onClose: (message?: string) => void;
  session: ReturnType<typeof useSession>;
}) {
  const { clinic } = useClinic();
  const [f, setF] = useState({
    name: "",
    email: "",
    studio: "",
    phone: "",
    city: "",
    address: "",
    document: "",
  });
  useEffect(() => {
    if (!open) return;
    setF({
      name: session?.name ?? "",
      email: session?.email ?? "",
      studio: clinic?.name ?? "",
      phone: clinic?.phone ?? "",
      city: clinic?.city ?? "",
      address: clinic?.address ?? "",
      document: clinic?.document ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const set = (key: keyof typeof f) => (event: { target: { value: string } }) =>
    setF((c) => ({ ...c, [key]: event.target.value }));

  const isGestor = session?.role === "gestor";
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!f.name.trim() || (isGestor && !f.studio.trim())) return;
    setSaving(true);
    const named = await supabase.rpc("update_my_name", { p_name: f.name.trim() });
    let failed = Boolean(named.error);
    if (isGestor && clinic) {
      const updated = await supabase
        .from("clinics")
        .update({
          name: f.studio.trim(),
          phone: f.phone.trim() || null,
          city: f.city.trim() || null,
          address: f.address.trim() || null,
          document: f.document.trim() || null,
        })
        .eq("id", clinic.id);
      failed = failed || Boolean(updated.error);
      await refreshClinic(clinic.id);
    }
    await sessionStore.refresh();
    setSaving(false);
    onClose(failed ? "Não foi possível salvar. Tente de novo." : "Perfil atualizado");
  };

  return (
    <Drawer
      open={open}
      onClose={() => onClose()}
      title="Perfil e clínica"
      subtitle="Aparece para as suas clientes"
      footer={footer(
        () => onClose(),
        () => void save(),
        saving ? "Salvando…" : "Salvar perfil",
      )}
    >
      <div className="flex flex-col gap-3.5">
        <Input
          label="Seu nome"
          icon="User"
          value={f.name}
          error={f.name.trim() ? undefined : "Informe seu nome."}
          onChange={set("name")}
        />
        <Input
          label="E-mail de acesso"
          icon="Mail"
          type="email"
          value={f.email}
          disabled
          hint="Para trocar o e-mail, fale com o suporte."
        />
        {isGestor ? (
          <>
            <Input
              label="Nome da clínica"
              icon="Sparkles"
              value={f.studio}
              error={f.studio.trim() ? undefined : "Informe o nome da clínica."}
              onChange={set("studio")}
            />
            <div className="grid grid-cols-2 gap-2.5">
              <Input label="Celular" type="tel" value={f.phone} onChange={set("phone")} />
              <Input label="Cidade" value={f.city} onChange={set("city")} />
            </div>
            <Input
              label="Endereço do estúdio"
              icon="MapPin"
              value={f.address}
              onChange={set("address")}
              hint="Rua, número, bairro. A cliente toca no endereço para abrir no mapa."
            />
            <Input
              label="CNPJ ou CPF"
              inputMode="numeric"
              value={f.document}
              onChange={set("document")}
            />
            <p className="text-xs text-muted-foreground">
              Endereço do seu link de cadastro:{" "}
              <span className="font-mono">/?p={clinic?.slug}</span>
            </p>
          </>
        ) : null}
      </div>
    </Drawer>
  );
}

function HoursDrawer({ open, onClose }: { open: boolean; onClose: (message?: string) => void }) {
  const stored = hoursDb.use();
  const [hours, setHours] = useState(stored);
  useEffect(() => {
    if (open) setHours(hoursDb.get());
  }, [open]);
  const setDay = (id: string, patch: Partial<(typeof hours)["days"][string]>) =>
    setHours((c) => ({
      ...c,
      days: {
        ...c.days,
        [id]: { ...(c.days[id] ?? { open: false, start: "09:00", end: "18:00" }), ...patch },
      },
    }));
  return (
    <Drawer
      open={open}
      onClose={() => onClose()}
      title="Horários de atendimento"
      subtitle="A agenda e as solicitações das clientes respeitam estes horários"
      footer={footer(
        () => onClose(),
        () => (hoursDb.set(hours), onClose("Horários salvos")),
        "Salvar horários",
      )}
    >
      <div className="flex flex-col gap-2.5">
        {DAYS.map(([id, name]) => {
          const day = hours.days[id] ?? { open: false, start: "09:00", end: "18:00" };
          return (
            <div
              key={id}
              className="flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-card)] bg-[var(--surface-card)] px-3.5 py-2.5"
            >
              <label className="flex min-w-[110px] items-center gap-2.5 text-[14px]">
                <input
                  type="checkbox"
                  checked={day.open}
                  onChange={() => setDay(id, { open: !day.open })}
                  className="size-[18px] accent-[var(--teal)]"
                />
                {name}
              </label>
              {day.open ? (
                <div className="flex items-center gap-2">
                  <Input
                    aria-label={`${name} abre`}
                    type="time"
                    value={day.start}
                    onChange={(event) => setDay(id, { start: event.target.value })}
                  />
                  <span className="text-muted-foreground">às</span>
                  <Input
                    aria-label={`${name} fecha`}
                    type="time"
                    value={day.end}
                    onChange={(event) => setDay(id, { end: event.target.value })}
                  />
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">Fechado</span>
              )}
            </div>
          );
        })}
        <Input
          label="Intervalo entre horários"
          trailing="min"
          inputMode="numeric"
          value={String(hours.slot)}
          onChange={(event) =>
            setHours((c) => ({ ...c, slot: Math.max(10, Number(event.target.value) || 30) }))
          }
        />
      </div>
    </Drawer>
  );
}

function ProceduresDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: (message?: string) => void;
}) {
  const list = proceduresDb.use();
  const [adding, setAdding] = useState(false);
  return (
    <Drawer
      open={open}
      onClose={() => onClose()}
      title="Procedimentos e valores"
      subtitle="Usados na agenda, no atendimento e no cálculo de resultado"
      width={520}
    >
      <div className="flex flex-col gap-2.5">
        {list.map((item) => (
          <div
            key={item.id}
            className="flex flex-col gap-2.5 rounded-[var(--radius-md)] border border-[var(--border-card)] bg-[var(--surface-card)] p-3.5"
          >
            <div className="flex items-center gap-2">
              <Input
                aria-label="Nome"
                className="flex-1"
                value={item.name}
                onChange={(event) => saveProcedure({ ...item, name: event.target.value })}
              />
              <IconButton
                icon="Trash2"
                label={`Remover ${item.name}`}
                onClick={() => removeProcedure(item.id)}
              />
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              <Input
                label="Valor"
                trailing="R$"
                inputMode="decimal"
                value={String(item.price)}
                onChange={(event) =>
                  saveProcedure({
                    ...item,
                    price: Number(event.target.value.replace(",", ".")) || 0,
                  })
                }
              />
              <Input
                label="Duração"
                trailing="min"
                inputMode="numeric"
                value={String(item.duration)}
                onChange={(event) =>
                  saveProcedure({ ...item, duration: Number(event.target.value) || 0 })
                }
              />
              <Input
                label="Retorno"
                trailing="dias"
                inputMode="numeric"
                value={String(item.returnDays)}
                onChange={(event) =>
                  saveProcedure({ ...item, returnDays: Number(event.target.value) || 0 })
                }
              />
            </div>
          </div>
        ))}
        {adding ? (
          <NewProcedureForm onCancel={() => setAdding(false)} onCreate={() => setAdding(false)} />
        ) : (
          <Button
            type="button"
            variant="secondary"
            className="self-start"
            onClick={() => setAdding(true)}
          >
            <Icon name="Plus" size={16} /> Novo procedimento
          </Button>
        )}
        <p className="text-xs text-muted-foreground">
          {list.length} procedimentos · ticket médio{" "}
          {brl(list.length ? list.reduce((sum, item) => sum + item.price, 0) / list.length : 0)}
        </p>
      </div>
    </Drawer>
  );
}

function QuestionsDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: (message?: string) => void;
}) {
  const stored = settingsDb.use();
  const [questions, setQuestions] = useState(stored.questions);
  useEffect(() => {
    if (open) setQuestions(settingsDb.get().questions);
  }, [open]);
  return (
    <Drawer
      open={open}
      onClose={() => onClose()}
      title="Modelos de anamnese"
      subtitle="Estas perguntas aparecem na ficha de cada cliente"
      footer={footer(
        () => onClose(),
        () => (
          settingsDb.set((c) => ({ ...c, questions: questions.filter((q) => q.label.trim()) })),
          onClose("Perguntas salvas")
        ),
        "Salvar perguntas",
      )}
    >
      <div className="flex flex-col gap-2.5">
        {questions.map((question, index) => (
          <div key={question.id} className="flex items-center gap-2">
            <Input
              aria-label={`Pergunta ${index + 1}`}
              className="flex-1"
              value={question.label}
              onChange={(event) =>
                setQuestions((list) =>
                  list.map((item) =>
                    item.id === question.id ? { ...item, label: event.target.value } : item,
                  ),
                )
              }
            />
            <IconButton
              icon="Trash2"
              label="Remover pergunta"
              onClick={() => setQuestions((list) => list.filter((item) => item.id !== question.id))}
            />
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          className="self-start"
          onClick={() => setQuestions((list) => [...list, { id: `q-${Date.now()}`, label: "" }])}
        >
          <Icon name="Plus" size={16} /> Nova pergunta
        </Button>
      </div>
    </Drawer>
  );
}

function ConsentDrawer({ open, onClose }: { open: boolean; onClose: (message?: string) => void }) {
  const stored = settingsDb.use();
  const [text, setText] = useState(stored.consentText);
  useEffect(() => {
    if (open) setText(settingsDb.get().consentText);
  }, [open]);
  return (
    <Drawer
      open={open}
      onClose={() => onClose()}
      title="Consentimentos"
      subtitle="Termo de autorização de imagem"
      footer={footer(
        () => onClose(),
        () => (settingsDb.set((c) => ({ ...c, consentText: text.trim() })), onClose("Termo salvo")),
        "Salvar termo",
      )}
    >
      <Input
        label="Texto do termo"
        multiline
        rows={8}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
    </Drawer>
  );
}
