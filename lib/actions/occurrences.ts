"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

type ActionResult = { error: string | null };

const checkinSchema = z.object({
  occurrenceId: z.uuid(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

/**
 * A ocorrência (request_occurrences) e a solicitação (requests) têm
 * máquinas de estado separadas. O Kanban só mexia na ocorrência — sem
 * isto, o status que o tutor vê em /solicitacoes/[id] nunca avançava
 * junto, e a solicitação nunca chegava a 'avaliacao' (avaliação exige
 * esse status exato, ver policy reviews_insert em 0009_rls_policies.sql).
 */
async function syncRequestStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  occurrenceId: string,
  status: "checkin" | "em_andamento" | "finalizacao" | "concluido" | "avaliacao"
): Promise<{ error: string | null; requestId: string | null }> {
  const { data: occurrence } = await supabase
    .from("request_occurrences")
    .select("request_id")
    .eq("id", occurrenceId)
    .single();

  if (!occurrence) {
    return { error: null, requestId: null };
  }

  const { error } = await supabase
    .from("requests")
    .update({ status })
    .eq("id", occurrence.request_id);

  revalidatePath(`/solicitacoes/${occurrence.request_id}`);
  return {
    error: error ? "Ocorrência atualizada, mas houve um erro ao sincronizar o status da solicitação." : null,
    requestId: occurrence.request_id,
  };
}

/**
 * Registra o check-in do profissional (seção 5, estado 11 "Execução").
 * Geolocalização é opcional — usada depois como parte da comprovação de
 * não comparecimento quando aplicável (seção 6.4).
 */
export async function registerCheckin(input: unknown): Promise<ActionResult> {
  const parsed = checkinSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Dados de check-in inválidos" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("request_occurrences")
    .update({
      status: "checkin",
      checkin_at: new Date().toISOString(),
      checkin_lat: parsed.data.lat ?? null,
      checkin_lng: parsed.data.lng ?? null,
    })
    .eq("id", parsed.data.occurrenceId);

  if (error) {
    return { error: "Não foi possível registrar o check-in." };
  }

  const sync = await syncRequestStatus(supabase, parsed.data.occurrenceId, "checkin");

  revalidatePath("/kanban");
  return { error: sync.error };
}

export async function advanceOccurrence(
  occurrenceId: string,
  nextStatus: "em_andamento" | "finalizacao" | "concluido"
): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("request_occurrences")
    .update(
      nextStatus === "concluido"
        ? { status: nextStatus, completed_at: new Date().toISOString() }
        : { status: nextStatus }
    )
    .eq("id", occurrenceId);

  if (error) {
    return { error: "Não foi possível atualizar o status do atendimento." };
  }

  const sync = await syncRequestStatus(supabase, occurrenceId, nextStatus);
  if (sync.error) {
    revalidatePath("/kanban");
    return { error: sync.error };
  }

  // Em contratos recorrentes ainda há ocorrências futuras a atender — a
  // solicitação volta pra 'confirmado' pra liberar o check-in da próxima
  // (0014_recurring_occurrence_cycle.sql). Só vai pra 'avaliacao' quando
  // essa era a última ocorrência pendente do contrato.
  if (nextStatus === "concluido" && sync.requestId) {
    const { count: pending } = await supabase
      .from("request_occurrences")
      .select("id", { count: "exact", head: true })
      .eq("request_id", sync.requestId)
      .not("status", "in", "(concluido,cancelado,nao_compareceu)");

    await supabase
      .from("requests")
      .update({ status: pending && pending > 0 ? "confirmado" : "avaliacao" })
      .eq("id", sync.requestId);
    revalidatePath(`/solicitacoes/${sync.requestId}`);
  }

  revalidatePath("/kanban");
  return { error: null };
}

const reportSchema = z.object({
  occurrenceId: z.uuid(),
  notes: z.string().trim().min(1, "Descreva o que foi feito"),
  attachmentPaths: z.array(z.string()).optional(),
});

/**
 * Relatório rápido de finalização (seção 5, estado 12). Fica salvo em
 * jsonb na própria ocorrência, incluindo os caminhos de eventuais fotos
 * enviadas ao bucket occurrence-reports.
 */
export async function submitOccurrenceReport(input: unknown): Promise<ActionResult> {
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Relatório inválido" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("request_occurrences")
    .update({
      status: "finalizacao",
      report: {
        notas: parsed.data.notes,
        anexos: parsed.data.attachmentPaths ?? [],
        enviado_em: new Date().toISOString(),
      },
    })
    .eq("id", parsed.data.occurrenceId);

  if (error) {
    return { error: "Não foi possível salvar o relatório." };
  }

  const sync = await syncRequestStatus(supabase, parsed.data.occurrenceId, "finalizacao");

  revalidatePath("/kanban");
  return { error: sync.error };
}
