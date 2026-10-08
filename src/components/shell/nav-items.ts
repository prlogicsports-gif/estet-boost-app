import {
  Bell,
  CalendarDays,
  House,
  KeyRound,
  Settings,
  Sparkles,
  Sun,
  User,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import type { Role } from "@/lib/auth.types";

export type NavItem = { to: string; label: string; icon: LucideIcon };
export type NavConfig = {
  role: Role;
  /** Itens do dock no celular. */
  primary: NavItem[];
  /** Itens que no celular ficam em "Mais". Vazio: sem menu "Mais". */
  secondary: NavItem[];
  /** Largura máxima do conteúdo. */
  maxWidth: string;
};

export const gestorNav: NavConfig = {
  role: "gestor",
  primary: [
    { to: "/hoje", label: "Hoje", icon: Sun },
    { to: "/agenda", label: "Agenda", icon: CalendarDays },
    { to: "/clientes", label: "Clientes", icon: Users },
    { to: "/gestao", label: "Gestão", icon: Wallet },
  ],
  secondary: [
    { to: "/notificacoes", label: "Notificações", icon: Bell },
    { to: "/credenciais", label: "Credenciais", icon: KeyRound },
    { to: "/configuracoes", label: "Configurações", icon: Settings },
  ],
  maxWidth: "var(--content-max, 1120px)",
};

export const clienteNav: NavConfig = {
  role: "cliente",
  primary: [
    { to: "/cliente", label: "Início", icon: House },
    { to: "/cliente/agenda", label: "Agenda", icon: CalendarDays },
    { to: "/cliente/evolucao", label: "Evolução", icon: Sparkles },
    { to: "/cliente/perfil", label: "Perfil", icon: User },
  ],
  secondary: [],
  maxWidth: "var(--content-narrow, 640px)",
};
