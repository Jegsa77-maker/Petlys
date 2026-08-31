"use server";

import { createClient } from "@/lib/supabase/server";
import { submitReviewSchema, respondReviewSchema } from "@/lib/validations/reviews";
import { revalidatePath } from "next/cache";

type ActionResult = { error: string | null };

/**
 * Avaliação bilateral — só após atendimento concluído (seção 7.2). O
 * status 'avaliacao' é exigido pela policy de insert em reviews
 * (0009_rls_policies.sql), reforçando a regra no banco.
 */
export async function submitReview(input: unknown): Promise<ActionResult> {
  const parsed = submitReviewSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Avaliação inválida" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Sessão expirada. Faça login novamente." };

  const { error } = await supabase.from("reviews").insert({
    request_id: parsed.data.requestId,
    reviewer_id: user.id,
    reviewee_id: parsed.data.revieweeId,
    rating: {
      qualidade: parsed.data.qualidade,
      comunicacao: parsed.data.comunicacao,
      pontualidade: parsed.data.pontualidade,
      aderencia_combinado: parsed.data.aderenciaCombinado,
    },
    comment: parsed.data.comment ?? null,
  });

  if (error) {
    return { error: "Não foi possível enviar a avaliação. Ela só pode ser enviada uma vez, após a conclusão." };
  }

  revalidatePath(`/solicitacoes/${parsed.data.requestId}`);
  return { error: null };
}

/**
 * Direito de resposta do avaliado — não altera a nota (seção 7.2).
 */
export async function respondToReview(input: unknown): Promise<ActionResult> {
  const parsed = respondReviewSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Resposta inválida" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Sessão expirada." };

  const { data: review } = await supabase
    .from("reviews")
    .select("reviewee_id, request_id")
    .eq("id", parsed.data.reviewId)
    .single();

  if (!review || review.reviewee_id !== user.id) {
    return { error: "Você só pode responder a avaliações que recebeu." };
  }

  const { error } = await supabase
    .from("reviews")
    .update({ response: parsed.data.response })
    .eq("id", parsed.data.reviewId);

  if (error) return { error: "Não foi possível enviar a resposta." };

  revalidatePath(`/solicitacoes/${review.request_id}`);
  return { error: null };
}
