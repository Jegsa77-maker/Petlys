"use server";

import { createClient } from "@/lib/supabase/server";
import { openIncidentSchema } from "@/lib/validations/incidents";
import { defaultUrgencyForType } from "@/lib/domain/incident-types";
import { revalidatePath } from "next/cache";

type ActionResult = { error: string | null };

/**
 * Botão "Preciso de ajuda" (seção 8.2 da Especificação v2.0, item 2 da
 * Onda 4). A RLS (incidents_insert, 0009_rls_policies.sql) já exige
 * opened_by = auth.uid() e ser parte da solicitação — a checagem aqui é
 * só pra devolver uma mensagem de erro clara antes de bater no banco.
 * A urgência não é escolhida por quem abre: vem do tipo selecionado
 * (menos uma decisão pra tomar num momento de estresse).
 */
export async function openIncident(input: unknown): Promise<ActionResult> {
  const parsed = openIncidentSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const { data: request } = await supabase
    .from("requests")
    .select("id, tutor_id, professional_id")
    .eq("id", parsed.data.requestId)
    .single();

  if (!request || (request.tutor_id !== user.id && request.professional_id !== user.id)) {
    return { error: "Você não tem permissão para abrir um incidente nesta solicitação." };
  }

  const { error } = await supabase.from("incidents").insert({
    request_id: parsed.data.requestId,
    occurrence_id: parsed.data.occurrenceId ?? null,
    opened_by: user.id,
    type: parsed.data.type,
    urgency: defaultUrgencyForType(parsed.data.type),
    description: parsed.data.description,
  });

  if (error) {
    return { error: "Não foi possível registrar o incidente. Tente novamente." };
  }

  revalidatePath(`/solicitacoes/${parsed.data.requestId}`);
  return { error: null };
}
