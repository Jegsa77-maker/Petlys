"use server";

import { createClient } from "@/lib/supabase/server";
import { upsertServiceAreaSchema } from "@/lib/validations/service-area";
import { geocodeCep, GeocodingError } from "@/lib/services/geocoding";
import { revalidatePath } from "next/cache";

type ActionResult = { error: string | null };

/**
 * Área de atendimento do Profissional — só schema/RLS existia até agora
 * (0012), nenhuma tela nunca escreveu aqui. CEP + raio (ou "sem restrição"),
 * geocodificado no servidor (mesmo lib/services/geocoding.ts do endereço do
 * Tutor). Upsert por professional_id: uma área só por profissional (0069
 * adicionou a constraint única).
 */
export async function upsertServiceArea(input: unknown): Promise<ActionResult> {
  const parsed = upsertServiceAreaSchema.safeParse(input);
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

  let geocoded;
  try {
    geocoded = await geocodeCep(parsed.data.cep);
  } catch (err) {
    if (err instanceof GeocodingError) return { error: err.message };
    return { error: "Não foi possível localizar esse CEP agora. Tente novamente." };
  }

  const { error } = await supabase.from("professional_service_areas").upsert(
    {
      professional_id: user.id,
      center_lat: geocoded.lat,
      center_lng: geocoded.lng,
      center_zip: geocoded.zip,
      radius_km: parsed.data.radiusKm,
    },
    { onConflict: "professional_id" }
  );

  if (error) {
    return { error: "Não foi possível salvar sua área de atendimento. Tente novamente." };
  }

  revalidatePath("/perfil");
  revalidatePath("/buscar");
  return { error: null };
}
