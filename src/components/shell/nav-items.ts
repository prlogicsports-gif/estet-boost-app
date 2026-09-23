import { Bell, CalendarDays, KeyRound, LayoutGrid, Settings, Sun, Users } from "lucide-react";

export type NavItem = { to: string; label: string; icon: typeof Sun };

export const primaryItems: NavItem[] = [
  { to: "/hoje", label: "Hoje", icon: Sun },
  { to: "/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/gestao", label: "Gestão", icon: LayoutGrid },
];

export const secondaryItems: NavItem[] = [
  { to: "/notificacoes", label: "Notificações", icon: Bell },
  { to: "/credenciais", label: "Credenciais", icon: KeyRound },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
];

export const desktopItems: NavItem[] = [...primaryItems, ...secondaryItems];
