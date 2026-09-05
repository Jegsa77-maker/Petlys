"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type ActionResult = { error: string | null };

/**
 * Chat de suporte entre staff (Admin/Supervisor) e um usuário qualquer,
 * iniciado a partir do perfil dele — ver 0075_staff_conversations.sql.
 * A RLS de staff_conversation_messages já garante quem pode inserir
 * (staff pra qualquer alvo, ou o próprio alvo respondendo); aqui só
 * valida o conteúdo e resolve o caminho pra revalidar.
 */
export async function sendStaffMessage(targetProfileId: string, content: string): Promise<ActionResult> {
  const trimmed = content.trim();
  if (!trimmed) {
    return { error: "Escreva uma mensagem." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const { error } = await supabase
    .from("staff_conversation_messages")
    .insert({ target_profile_id: targetProfileId, sender_id: user.id, content: trimmed });

  if (error) {
    return { error: "Não foi possível enviar a mensagem." };
  }

  revalidatePath(`/admin/usuarios/${targetProfileId}`);
  revalidatePath(`/supervisor/usuarios/${targetProfileId}`);
  return { error: null };
}
