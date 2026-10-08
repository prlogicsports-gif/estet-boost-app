import type { TimelineEntry } from "@/components/eb/client-timeline";
import type { NotificationItem } from "@/components/eb/notification-center";
import type { StatusTone } from "@/components/eb/status-badge";

/** Dados de exemplo do app da cliente. Mariana é a cliente `c1` do app da esteticista. */
export const CLIENT_ID = "c1";
export const client = { name: "Mariana Silva", initials: "MS", first: "Mariana" };
export const proName = "Fernanda Costa";

export const next = {
  date: "Terça, 15 de setembro",
  time: "14:00",
  procedure: "Limpeza de pele profunda",
  status: "confirmed" as StatusTone,
  session: "3 de 4",
};

export const upcoming: { date: string; time: string; procedure: string; status: StatusTone }[] = [
  { date: "15 set", time: "14:00", procedure: "Limpeza de pele profunda", status: "confirmed" },
  { date: "29 set", time: "14:00", procedure: "Limpeza de pele profunda", status: "pending" },
];

export const history: TimelineEntry[] = [
  {
    id: "h1",
    date: "04 ago",
    procedure: "Limpeza de pele profunda",
    region: "Zona T e bochechas",
    note: "Recomendação: protetor solar todas as manhãs.",
    photos: 2,
    professional: "Fernanda Costa",
  },
  {
    id: "h2",
    date: "07 jul",
    procedure: "Limpeza de pele profunda",
    region: "Zona T",
    photos: 2,
    professional: "Fernanda Costa",
  },
  {
    id: "h3",
    date: "02 jun",
    procedure: "Avaliação inicial",
    region: "Face completa",
    photos: 1,
    professional: "Fernanda Costa",
  },
];

export const recommendations = [
  {
    icon: "Sun",
    title: "Protetor solar todas as manhãs",
    detail: "FPS 50, reaplicar após 4 horas de exposição.",
  },
  {
    icon: "Droplets",
    title: "Evitar esfoliação por 5 dias",
    detail: "A pele está em recuperação após a extração.",
  },
  {
    icon: "Moon",
    title: "Sabonete facial suave à noite",
    detail: "Sem ativos ácidos até a próxima sessão.",
  },
];

export const notifications: NotificationItem[] = [
  {
    id: "n1",
    kind: "reminder",
    title: "Seu atendimento é amanhã",
    body: "Limpeza de pele · 15 set, 14:00",
    time: "agora",
    unread: true,
  },
  {
    id: "n2",
    kind: "recommendation",
    title: "Nova recomendação de Fernanda",
    body: "Protetor solar todas as manhãs",
    time: "2 dias",
    unread: true,
  },
  {
    id: "n3",
    kind: "reschedule",
    title: "Horário alterado",
    body: "29 set mudou de 15:00 para 14:00",
    time: "5 dias",
  },
];
