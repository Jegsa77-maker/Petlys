"use server";

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { recipientOnboardingSchema } from "@/lib/validations/payments";
import { createRecipient, PagarmeError } from "@/lib/services/pagarme";
import { revalidatePath } from "next/cache";

type ActionResult = { error: string | null };

/**
 * Onboarding financeiro do Profissional (Onda 3, Etapa 1). O recebedor só é
 * gravado em `professional_recipients` depois que a chamada ao gateway teve
 * sucesso de verdade — nunca escrito otimisticamente (mesmo padrão de
 * `payments`/`payouts`: professional_recipients não tem policy de insert
 * pra `authenticated`, só `service_role` grava).
 */
export async function submitRecipientOnboarding(input: unknown): Promise<ActionResult> {
  const parsed = recipientOnboardingSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados bancários inválidos" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const { data: role } = await supabase
    .from("account_roles")
    .select("role")
    .eq("profile_id", user.id)
    .eq("role", "profissional")
    .eq("active", true)
    .maybeSingle();

  if (!role) {
    return { error: "Apenas quem tem o papel de Profissional pode cadastrar dados de recebimento." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("cpf_cnpj, full_name")
    .eq("id", user.id)
    .single();

  if (!profile?.cpf_cnpj) {
    return {
      error: "Seu CPF/CNPJ não está preenchido no cadastro. Complete isso antes de continuar.",
    };
  }

  const { data: existing } = await supabase
    .from("professional_recipients")
    .select("status")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (existing?.status === "ativo") {
    return { error: "Você já tem um recebedor ativo — não é preciso cadastrar de novo." };
  }

  let recipient;
  try {
    recipient = await createRecipient({
      document: profile.cpf_cnpj,
      documentType: profile.cpf_cnpj.replace(/\D/g, "").length > 11 ? "company" : "individual",
      name: profile.full_name ?? "",
      email: user.email ?? "",
      bankAccount: {
        bankCode: parsed.data.bankCode,
        agencia: parsed.data.agencia,
        agenciaDv: parsed.data.agenciaDv,
        conta: parsed.data.conta,
        contaDv: parsed.data.contaDv,
        contaTipo: parsed.data.contaTipo === "corrente" ? "conta_corrente" : "conta_poupanca",
      },
    });
  } catch (err) {
    const message = err instanceof PagarmeError ? err.message : "Erro inesperado ao contatar o gateway de pagamento.";
    return { error: `Não foi possível cadastrar seus dados de recebimento: ${message}` };
  }

  const service = createServiceRoleClient();
  const { error } = await service.from("professional_recipients").upsert(
    {
      profile_id: user.id,
      gateway_recipient_id: recipient.id,
      status: recipient.status === "active" ? "ativo" : "pendente",
      bank_code: parsed.data.bankCode,
      agencia: parsed.data.agencia,
      agencia_dv: parsed.data.agenciaDv ?? null,
      conta: parsed.data.conta,
      conta_dv: parsed.data.contaDv,
      conta_tipo: parsed.data.contaTipo,
    },
    { onConflict: "profile_id" }
  );

  if (error) {
    return {
      error:
        "O cadastro no gateway funcionou, mas houve um erro ao salvar aqui. Contate o suporte antes de tentar de novo.",
    };
  }

  revalidatePath("/financeiro");
  return { error: null };
}

export type RecipientStatusResult = {
  status: "nao_cadastrado" | "pendente" | "ativo" | "rejeitado" | "desabilitado";
  rejectionReason: string | null;
};

export async function getRecipientStatus(): Promise<RecipientStatusResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: "nao_cadastrado", rejectionReason: null };
  }

  const { data } = await supabase
    .from("professional_recipients")
    .select("status, rejection_reason")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!data) {
    return { status: "nao_cadastrado", rejectionReason: null };
  }

  return { status: data.status, rejectionReason: data.rejection_reason };
}
