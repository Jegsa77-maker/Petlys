import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/shell/app-shell";
import { NotificationsBadgeLink } from "@/components/shared/notifications-badge-link";
import type { ShellRole } from "@/components/shell/nav-config";

/**
 * `/notificacoes` (e outras rotas "compartilhadas" futuras) não moram
 * dentro de nenhum dos 4 grupos de rota — por isso ficaram sem shell
 * até esse achado (revisão de todas as telas contra o padrão de CX).
 * Mesma resolução de papel usada em `lib/supabase/middleware.ts`
 * (`resolveActiveRole`), só que aqui pra escolher a navegação certa,
 * não pra bloquear acesso.
 */
export default async function SharedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: roles } = user
    ? await supabase.from("account_roles").select("role").eq("profile_id", user.id).eq("active", true)
    : { data: null };

  const roleNames = (roles ?? []).map((r) => r.role);
  const cookieStore = await cookies();
  const activeRoleCookie = cookieStore.get("active_role")?.value;

  let role: ShellRole = "tutor";
  if (roleNames.includes("administrador")) {
    role = "admin";
  } else if (roleNames.includes("supervisor")) {
    role = "supervisor";
  } else if (roleNames.includes("tutor") && roleNames.includes("profissional")) {
    role = activeRoleCookie === "profissional" ? "profissional" : "tutor";
  } else if (roleNames.includes("profissional")) {
    role = "profissional";
  }

  return (
    <AppShell
      role={role}
      notificationsDesktop={
        <NotificationsBadgeLink className="inline-flex items-center gap-1 text-sm font-semibold text-white/85 hover:text-white" />
      }
      notificationsMobile={<NotificationsBadgeLink iconOnly />}
    >
      {children}
    </AppShell>
  );
}
