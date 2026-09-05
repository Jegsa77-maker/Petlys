import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Disponibilidade padrão de um Profissional novo (pedido de 2026-09-05,
 * durante o ajuste da Agenda): todo profissional passa a nascer com os 7
 * dias da semana marcados como disponíveis o dia inteiro — não porque
 * alguém trabalhe 24h, mas pra nenhuma reserva de tutor ficar bloqueada
 * até a pessoa vir configurar um horário de trabalho de verdade. Sem
 * essas linhas, restringir o que o tutor consegue pedir (próximo passo)
 * deixaria a maioria dos profissionais — que nunca mexeu em "Horários de
 * trabalho" — sem nenhum horário reservável.
 */
export function defaultAvailabilityRows(professionalId: string) {
  return Array.from({ length: 7 }, (_, weekday) => ({
    professional_id: professionalId,
    weekday,
    start_time: "00:00",
    end_time: "23:59",
    blocked: false,
  }));
}

/**
 * Idempotente: só insere se a conta ainda não tem nenhuma janela
 * recorrente (weekday não nulo) — evita sobrescrever configuração que a
 * pessoa já tenha feito (ex.: reconceder o papel depois de desativado).
 */
export async function seedDefaultAvailability(
  supabase: SupabaseClient<Database>,
  professionalId: string
): Promise<void> {
  const { count } = await supabase
    .from("professional_availability")
    .select("id", { count: "exact", head: true })
    .eq("professional_id", professionalId)
    .not("weekday", "is", null);

  if (count && count > 0) return;

  await supabase.from("professional_availability").insert(defaultAvailabilityRows(professionalId));
}
