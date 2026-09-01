import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Bell } from "lucide-react";

/**
 * Link pra /notificacoes com contagem de não lidas — hoje só a Home do
 * Tutor linkava pra lá; Admin e Supervisor não tinham nenhum jeito de
 * chegar até a notificação de incidente aberto (seção 8.2, item 2 da
 * Onda 4), mesmo a notificação já sendo gerada no banco.
 */
export async function NotificationsBadgeLink({
  iconOnly = false,
  className,
}: {
  /** Só o ícone com o pontinho de contagem — usado no cabeçalho do shell (M-001), onde não cabe o texto. */
  iconOnly?: boolean;
  className?: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { count } = user
    ? await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", user.id)
        .is("read_at", null)
    : { count: 0 };

  if (iconOnly) {
    return (
      <Link
        href="/notificacoes"
        aria-label="Notificações"
        className={className ?? "relative inline-flex items-center justify-center rounded-full p-2 text-teal hover:bg-teal/10"}
      >
        <Bell size={20} />
        {(count ?? 0) > 0 && (
          <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-red-700" />
        )}
      </Link>
    );
  }

  return (
    <Link
      href="/notificacoes"
      className={className ?? "inline-flex items-center gap-1 text-sm font-semibold text-teal hover:underline"}
    >
      <Bell size={16} />
      Notificações
      {(count ?? 0) > 0 && (
        <span className="rounded-full bg-red-700 text-white text-xs px-1.5 py-0.5 leading-none">
          {count}
        </span>
      )}
    </Link>
  );
}
