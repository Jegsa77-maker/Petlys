"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type ActionResult = { error: string | null };

/**
 * Anexo na própria solicitação (seção 12.1, item 4 da Onda 2) — diferente
 * dos documentos do prontuário do pet, é algo específico deste pedido (ex.:
 * foto de uma lesão de pele pro veterinário ver antes do atendimento).
 * `path` é o caminho no bucket privado `request-attachments`
 * ({request_id}/...), não uma URL pública.
 */
export async function addRequestAttachment(requestId: string, path: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const { error } = await supabase.from("request_attachments").insert({
    request_id: requestId,
    url: path,
    uploaded_by: user.id,
  });

  if (error) {
    return { error: "Não foi possível anexar o arquivo." };
  }

  revalidatePath(`/solicitacoes/${requestId}`);
  return { error: null };
}
