"use server";

import { createClient } from "@/lib/supabase/server";
import {
  submitCertificationSchema,
  reviewCertificationSchema,
} from "@/lib/validations/professional-certifications";
import { revalidatePath } from "next/cache";

type ActionResult = { error: string | null };

/**
 * Profissional envia documento de habilitação pra uma categoria
 * regulamentada (seção 6.3), a partir do formulário de Serviço (movido de
 * "Meu perfil" em 2026-09-06). Fica `pendente` até revisão manual de
 * Admin/Supervisor — ver reviewCertification. Não bloqueia publicar
 * nenhum serviço (ver createService) — só define o selo que o Tutor vê.
 */
export async function submitCertification(input: unknown): Promise<ActionResult> {
  const parsed = submitCertificationSchema.safeParse(input);
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

  const { error } = await supabase.from("professional_certifications").insert({
    professional_id: user.id,
    category: parsed.data.category,
    document_url: parsed.data.documentPath,
  });

  if (error) {
    return { error: "Não foi possível enviar o documento. Tente novamente." };
  }

  revalidatePath("/servicos");
  return { error: null };
}

export async function withdrawCertification(certificationId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("professional_certifications")
    .delete()
    .eq("id", certificationId);

  if (error) {
    return { error: "Só é possível remover documentos ainda pendentes de revisão." };
  }

  revalidatePath("/servicos");
  return { error: null };
}

/**
 * Admin/Supervisor aprova ou rejeita a habilitação (seção 6.3/13.3 —
 * moderação). RLS (`professional_certifications_update_admin`) já garante
 * que só admin/supervisor grava aqui.
 */
export async function reviewCertification(input: unknown): Promise<ActionResult> {
  const parsed = reviewCertificationSchema.safeParse(input);
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

  const { error } = await supabase
    .from("professional_certifications")
    .update({
      status: parsed.data.status,
      review_notes: parsed.data.reviewNotes ?? null,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.certificationId);

  if (error) {
    return { error: "Não foi possível registrar a revisão." };
  }

  revalidatePath("/admin/habilitacoes");
  return { error: null };
}
