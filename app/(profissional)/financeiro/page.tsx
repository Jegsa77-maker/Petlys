import { createClient } from "@/lib/supabase/server";
import { RecipientOnboardingForm } from "@/components/professional/recipient-onboarding-form";
import { CheckCircle2, Clock, XCircle } from "lucide-react";

/**
 * Financeiro do Profissional (Onda 3). Etapa 1: só o onboarding do
 * recebedor. O extrato de 3 status (agendado/retido/disponível) e o botão
 * de saque chegam na Etapa 5 — aqui é só o estado "ainda não cadastrado" ou
 * um placeholder simples pra quem já tem recebedor ativo.
 */
export default async function FinanceiroPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: recipient } = await supabase
    .from("professional_recipients")
    .select("status, rejection_reason")
    .eq("profile_id", user.id)
    .maybeSingle();

  return (
    <main className="min-h-screen bg-offwhite px-4 py-8">
      <div className="max-w-md mx-auto flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-teal mb-1">Financeiro</h1>
          <p className="text-sm text-gray-600">
            Cadastre seus dados de recebimento pra poder receber os pagamentos dos seus atendimentos.
          </p>
        </div>

        {!recipient && (
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <RecipientOnboardingForm />
          </div>
        )}

        {recipient?.status === "pendente" && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
            <Clock size={20} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-900">Cadastro em análise</p>
              <p className="text-sm text-amber-800">
                Seus dados foram enviados e estão sendo verificados pelo gateway de pagamento.
              </p>
            </div>
          </div>
        )}

        {recipient?.status === "rejeitado" && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-start gap-3">
            <XCircle size={20} className="text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-900">Cadastro não aprovado</p>
              {recipient.rejection_reason && (
                <p className="text-sm text-red-800">{recipient.rejection_reason}</p>
              )}
            </div>
          </div>
        )}

        {recipient?.status === "ativo" && (
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 size={20} className="text-teal" />
              <p className="text-sm font-semibold text-black">Dados de recebimento ativos</p>
            </div>
            <p className="text-sm text-gray-600">
              Seu extrato completo (agendado, retido e disponível para saque) chega assim que os
              pagamentos de verdade entrarem em operação.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
