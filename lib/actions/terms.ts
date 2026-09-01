"use server";

import { createClient } from "@/lib/supabase/server";
import { CURRENT_TERMS_VERSION } from "@/lib/domain/terms";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type ActionResult = { error: string | null };

/**
 * Registra o aceite explícito da versão vigente dos Termos de Uso e
 * Política de Privacidade (seção 6.1). Gate obrigatório em
 * lib/supabase/middleware.ts — toda conta (OAuth ou e-mail/senha) passa
 * por aqui antes de escolher papel.
 */
export async function acceptTerms(): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const { error } = await supabase
    .from("terms_acceptances")
    .insert({ profile_id: user.id, version: CURRENT_TERMS_VERSION });

  if (error) {
    return { error: "Não foi possível registrar seu aceite. Tente novamente." };
  }

  revalidatePath("/", "layout");
  // "/" decide sozinho pra onde ir a seguir: sem papel -> middleware manda
  // pra /escolher-perfil; com papel -> mostra o seletor/atalho de sempre.
  redirect("/");
}
