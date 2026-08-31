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

  revalidatePath("/kanban");
  return { error: null };
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

  revalidatePath("/kanban");
  return { error: null };
}
