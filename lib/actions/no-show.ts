"use server";

import { createClient } from "@/lib/supabase/server";
import { reportNoShowSchema } from "@/lib/validations/no-show";
import { revalidatePath } from "next/cache";

type ActionResult = { error: string | null };

/**
 * Registra não comparecimento (seção 6.4). Comprovação exige as três
 * evidências (tempo mínimo, check-in, tentativa de contato). O
 * percentual de retenção é lido de platform_parameters — configurável
 * por categoria, sem valor fixo no código (seção 6.4/9.4).
 */
export async function reportNoShow(input: unknown): Promise<ActionResult> {
  const parsed = reportNoShowSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  if (
    !parsed.data.minWaitConfirmed ||
    !parsed.data.checkinConfirmed ||
    !parsed.data.contactAttemptConfirmed
  ) {
    return { error: "As três evidências são obrigatórias: tempo mínimo, check-in e tentativa de contato." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Sessão expirada. Faça login novamente." };

  const { data: request } = await supabase
    .from("requests")
    .select("id, category, tutor_id, professional_id, status")
    .eq("id", parsed.data.requestId)
    .single();

  if (!request || (request.tutor_id !== user.id && request.professional_id !== user.id)) {
    return { error: "Você não tem permissão para reportar isso." };
  }

  const { data: proposal } = await supabase
    .from("proposals")
    .select("price, additional_fees")
    .eq("request_id", parsed.data.requestId)
    .not("accepted_at", "is", null)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const totalAmount = proposal ? Number(proposal.price) + Number(proposal.additional_fees) : 0;

  let retainedPercent = 30; // padrão de fallback caso o parâmetro não esteja configurado
  const { data: param } = await supabase
    .from("platform_parameters")
    .select("valor1")
    .eq("chave1", "retencao_nao_comparecimento_percentual")
    .eq("chave2", request.category)
    .eq("status", "ativo")
    .maybeSingle();

  if (param?.valor1) {
    retainedPercent = Number(param.valor1);
  }

  let retainedAmount = 0;
  let professionalCompensation = 0;

  if (parsed.data.reportedParty === "tutor") {
    // Não comparecimento do tutor: retém percentual do valor, repassa ao
    // profissional como compensação, restante volta pro tutor.
    retainedAmount = (totalAmount * retainedPercent) / 100;
    professionalCompensation = retainedAmount;
  }
  // Não comparecimento do profissional segue a mesma regra do cancelamento
  // pelo profissional (seção 6.3/6.4) — tratado à parte quando o
  // financeiro real for integrado; aqui só registramos a ocorrência.

  const { error: recordError } = await supabase.from("no_show_records").insert({
    request_id: parsed.data.requestId,
    occurrence_id: parsed.data.occurrenceId,
    reported_party: parsed.data.reportedParty,
    reported_by: user.id,
    min_wait_confirmed: parsed.data.minWaitConfirmed,
    checkin_confirmed: parsed.data.checkinConfirmed,
    contact_attempt_confirmed: parsed.data.contactAttemptConfirmed,
    retained_percent: parsed.data.reportedParty === "tutor" ? retainedPercent : null,
    retained_amount: retainedAmount || null,
    professional_compensation: professionalCompensation || null,
  });

  if (recordError) {
    return { error: "Não foi possível registrar o não comparecimento." };
  }

  const { error: occurrenceError } = await supabase
    .from("request_occurrences")
    .update({ status: "nao_compareceu" })
    .eq("id", parsed.data.occurrenceId);

  if (occurrenceError) {
    return { error: "Registro criado, mas houve um erro ao atualizar a ocorrência." };
  }

  const { error: statusError } = await supabase
    .from("requests")
    .update({ status: "cancelado" })
    .eq("id", parsed.data.requestId);

  if (statusError) {
    return { error: "Registro criado, mas houve um erro ao atualizar o status da solicitação." };
  }

  revalidatePath(`/solicitacoes/${parsed.data.requestId}`);
  return { error: null };
}
