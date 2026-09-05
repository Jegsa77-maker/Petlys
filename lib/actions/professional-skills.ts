"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ServiceCategory } from "@/types/database";

type ActionResult = { error: string | null };

/**
 * "Habilidades" do Profissional (2026-09-06, doc "Petlys | Perfis -
 * Pilar 1") — categorias que ele declara que atua. Aparece publicamente
 * no perfil e libera os campos específicos daquela categoria na hora de
 * publicar um Serviço (ver lib/domain/service-category-fields.ts). Não
 * confundir com professional_services: uma habilidade é declarada uma
 * vez por categoria; o profissional pode publicar vários serviços
 * (com preços/regras diferentes) dentro da mesma habilidade depois.
 */
export async function addProfessionalSkill(category: ServiceCategory): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const { error } = await supabase
    .from("professional_skills")
    .insert({ professional_id: user.id, category });

  if (error) {
    // unique (professional_id, category) — já tinha essa habilidade.
    if (error.code === "23505") {
      return { error: null };
    }
    return { error: "Não foi possível adicionar essa habilidade." };
  }

  revalidatePath("/perfil");
  revalidatePath(`/profissional/${user.id}`);
  return { error: null };
}

export async function removeProfessionalSkill(skillId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const { error } = await supabase.from("professional_skills").delete().eq("id", skillId);

  if (error) {
    return { error: "Não foi possível remover essa habilidade." };
  }

  revalidatePath("/perfil");
  revalidatePath(`/profissional/${user.id}`);
  return { error: null };
}
