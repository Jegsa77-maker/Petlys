import {
  Home,
  Search,
  ClipboardList,
  PawPrint,
  LayoutDashboard,
  CalendarDays,
  Kanban,
  Wrench,
  UserRound,
  BadgeCheck,
  ShieldAlert,
  Flag,
  SlidersHorizontal,
  Users,
  Wallet,
} from "lucide-react";
import type { ComponentType } from "react";

export type ShellRole = "tutor" | "profissional" | "admin" | "supervisor";

export type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
};

/**
 * Navegação por papel (M-001, iniciativa de CX) — só rotas que já
 * existem hoje (`find app -iname page.tsx`). "Financeiro" do Profissional
 * entrou junto com a Onda 3 (fundação sem gateway, Etapa 1 — onboarding
 * de recebedor); o extrato completo chega nas próximas etapas.
 */
export const NAV_BY_ROLE: Record<ShellRole, NavItem[]> = {
  tutor: [
    { href: "/inicio", label: "Início", icon: Home },
    { href: "/buscar", label: "Buscar", icon: Search },
    { href: "/solicitacoes", label: "Solicitações", icon: ClipboardList },
    { href: "/pets", label: "Meus pets", icon: PawPrint },
  ],
  profissional: [
    { href: "/dashboard", label: "Início", icon: LayoutDashboard },
    { href: "/agenda", label: "Agenda", icon: CalendarDays },
    { href: "/kanban", label: "Atendimentos", icon: Kanban },
    { href: "/servicos", label: "Serviços", icon: Wrench },
    { href: "/financeiro", label: "Financeiro", icon: Wallet },
    { href: "/perfil", label: "Perfil", icon: UserRound },
  ],
  admin: [
    { href: "/admin/dashboard", label: "Painel", icon: LayoutDashboard },
    { href: "/admin/incidentes", label: "Incidentes", icon: ShieldAlert },
    { href: "/admin/moderacao", label: "Moderação", icon: Flag },
    { href: "/admin/habilitacoes", label: "Habilitações", icon: BadgeCheck },
    { href: "/admin/parametros", label: "Parâmetros", icon: SlidersHorizontal },
    { href: "/admin/supervisores", label: "Supervisores", icon: Users },
  ],
  supervisor: [
    { href: "/supervisor/incidentes", label: "Incidentes", icon: ShieldAlert },
    { href: "/supervisor/moderacao", label: "Moderação", icon: Flag },
  ],
};

/** Rótulo do papel — mostrado embaixo da wordmark no cabeçalho do shell. */
export const ROLE_LABEL: Record<ShellRole, string> = {
  tutor: "Tutor",
  profissional: "Profissional",
  admin: "Administrador",
  supervisor: "Supervisor",
};

/**
 * No celular, a barra inferior (Matriz_Responsiva) cabe no máximo uns 5
 * itens sem espremer — Admin tem 6 no total, então a barra de baixo
 * mostra só os 4 primeiros (mais usados) e o resto fica só na sidebar
 * quando a tela crescer.
 */
export const MOBILE_TAB_LIMIT = 4;
