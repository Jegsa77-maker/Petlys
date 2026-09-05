"use server";

import { createClient } from "@/lib/supabase/server";
import {
  createServiceSchema,
  availabilitySlotSchema,
  blockDateSchema,
} from "@/lib/validations/services";
import { categoryRequiresCertification } from "@/lib/domain/regulated-categories";
import { revalidatePath } from "next/cache";

type ActionResult = { error: string | null };

/**
 * Profissional publica um serviço (seção 5.3). O desconto por múltiplos
 * pets é opcional e a critério dele (seção 6.1).
 */
export async function createService(input: unknown): Promise<ActionResult> {
  const parsed = createServiceSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados do serviço inválidos" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  // Categorias regulamentadas exigem habilitação aprovada antes de publicar
  // (seção 6.3) — ex.: veterinário domiciliar precisa de CRMV verificado.
  if (categoryRequiresCertification(parsed.data.category)) {
    const { data: approvedCert } = await supabase
      .from("professional_certifications")
      .select("id")
      .eq("professional_id", user.id)
      .eq("category", parsed.data.category)
      .eq("status", "aprovado")
      .maybeSingle();

    if (!approvedCert) {
      return {
        error:
          "Essa categoria exige habilitação verificada. Envie seu documento em Meu perfil > Habilitações antes de publicar este serviço.",
      };
    }
  }

  const { data: service, error } = await supabase
    .from("professional_services")
    .insert({
      professional_id: user.id,
      category: parsed.data.category,
      subcategory: parsed.data.subcategory ?? null,
      pricing_model: parsed.data.pricingModel,
      base_price: parsed.data.basePrice ?? null,
      multi_pet_discount_percent: parsed.data.multiPetDiscountPercent ?? null,
      description: parsed.data.description ?? null,
      duration_minutes: parsed.data.durationMinutes ?? null,
      species_accepted: parsed.data.speciesAccepted,
      min_size: parsed.data.minSize ?? null,
      max_size: parsed.data.maxSize ?? null,
      restrictions: parsed.data.restrictions ?? null,
    })
    .select("id")
    .single();

  if (error || !service) {
    return { error: "Não foi possível publicar o serviço." };
  }

  if (parsed.data.addons.length > 0) {
    const { error: addonsError } = await supabase.from("professional_service_addons").insert(
      parsed.data.addons.map((addon) => ({
        service_id: service.id,
        name: addon.name,
        price: addon.price,
      }))
    );
    if (addonsError) {
      return { error: "Serviço publicado, mas houve um erro ao salvar os adicionais." };
    }
  }

  revalidatePath("/servicos");
  return { error: null };
}

export async function toggleServiceActive(serviceId: string, active: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("professional_services")
    .update({ active })
    .eq("id", serviceId);

  if (error) {
    return { error: "Não foi possível atualizar o serviço." };
  }

  revalidatePath("/servicos");
  return { error: null };
}

/**
 * Agenda semanal recorrente (seção 5.4). A decisão final de horário
 * permanece com o profissional — a plataforma só alerta conflitos,
 * nunca bloqueia.
 */
export async function addAvailabilitySlot(input: unknown): Promise<ActionResult> {
  const parsed = availabilitySlotSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Horário inválido" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const { error } = await supabase.from("professional_availability").insert({
    professional_id: user.id,
    weekday: parsed.data.weekday,
    start_time: parsed.data.startTime,
    end_time: parsed.data.endTime,
    blocked: false,
  });

  if (error) {
    return { error: "Não foi possível salvar o horário." };
  }

  revalidatePath("/agenda");
  return { error: null };
}

export async function blockDate(input: unknown): Promise<ActionResult> {
  const parsed = blockDateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data inválida" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  // Um dia só ou um período inteiro (semana de folga, mês de férias) —
  // uma linha por dia, mesmo mecanismo de sempre, só que em lote. Formata
  // a data manualmente (não .toISOString(), que converte pra UTC e pode
  // voltar um dia em fusos à frente de UTC) — mesmo padrão de
  // lib/domain/agenda-calendar.ts:toDateKey.
  const dates: string[] = [parsed.data.dateOverride];
  if (parsed.data.untilDate) {
    const cursor = new Date(parsed.data.dateOverride + "T00:00:00");
    const end = new Date(parsed.data.untilDate + "T00:00:00");
    dates.length = 0;
    while (cursor <= end) {
      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, "0");
      const d = String(cursor.getDate()).padStart(2, "0");
      dates.push(`${y}-${m}-${d}`);
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  const { error } = await supabase.from("professional_availability").insert(
    dates.map((date) => ({
      professional_id: user.id,
      date_override: date,
      start_time: parsed.data.startTime ?? null,
      end_time: parsed.data.endTime ?? null,
      block_type: parsed.data.blockType,
      reason: parsed.data.reason ?? null,
      blocked: true,
    }))
  );

  if (error) {
    return { error: "Não foi possível bloquear a data." };
  }

  revalidatePath("/agenda");
  return { error: null };
}

export async function removeAvailabilitySlot(slotId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("professional_availability").delete().eq("id", slotId);

  if (error) {
    return { error: "Não foi possível remover o horário." };
  }

  revalidatePath("/agenda");
  return { error: null };
}
