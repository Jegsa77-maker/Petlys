"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type ActionResult = { error: string | null };

/**
 * Moderação de avaliações e mensagens (seção 12.3, item 4 da Onda 4).
 * Sinalizar e ocultar passam por funções SECURITY DEFINER
 * (0031_moderacao.sql) em vez de update() direto — mesmo motivo do
 * appeal_incident (0030): RLS de messages/reviews não libera update
 * pra quem só devia poder sinalizar/ocultar essas colunas específicas.
 */
export async function flagMessage(messageId: string, requestId: string, reason: string): Promise<ActionResult> {
  if (!reason.trim()) {
    return { error: "Explique o motivo da sinalização." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("flag_message", { p_message_id: messageId, p_reason: reason });
  if (error) return { error: error.message || "Não foi possível sinalizar a mensagem." };
  revalidatePath(`/solicitacoes/${requestId}`);
  return { error: null };
}

export async function flagReview(reviewId: string, requestId: string, reason: string): Promise<ActionResult> {
  if (!reason.trim()) {
    return { error: "Explique o motivo da sinalização." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("flag_review", { p_review_id: reviewId, p_reason: reason });
  if (error) return { error: error.message || "Não foi possível sinalizar a avaliação." };
  revalidatePath(`/solicitacoes/${requestId}`);
  return { error: null };
}

export async function setMessageHidden(messageId: string, hidden: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_message_hidden", { p_message_id: messageId, p_hidden: hidden });
  if (error) return { error: error.message || "Não foi possível moderar a mensagem." };
  revalidatePath("/moderacao");
  return { error: null };
}

export async function setReviewHidden(reviewId: string, hidden: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_review_hidden", { p_review_id: reviewId, p_hidden: hidden });
  if (error) return { error: error.message || "Não foi possível moderar a avaliação." };
  revalidatePath("/moderacao");
  return { error: null };
}

/** "Manter" na fila — limpa a sinalização de verdade, senão reaparece sempre. */
export async function dismissMessageFlag(messageId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("dismiss_message_flag", { p_message_id: messageId });
  if (error) return { error: error.message || "Não foi possível descartar a sinalização." };
  revalidatePath("/moderacao");
  return { error: null };
}

export async function dismissReviewFlag(reviewId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("dismiss_review_flag", { p_review_id: reviewId });
  if (error) return { error: error.message || "Não foi possível descartar a sinalização." };
  revalidatePath("/moderacao");
  return { error: null };
}
