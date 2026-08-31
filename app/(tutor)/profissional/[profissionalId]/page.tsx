import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { MessageCircle, CalendarPlus, ShieldCheck } from "lucide-react";

const CATEGORY_LABEL: Record<string, string> = {
  pet_sitter: "Pet sitter / cuidador",
  passeador: "Passeador de cães",
  hospedagem_creche: "Hospedagem / creche",
  adestrador: "Adestrador / comportamentalista",
  banho_tosa: "Banho e tosa",
  veterinario_domiciliar: "Veterinário domiciliar",
};

export default async function ProfissionalPage({
  params,
}: {
  params: Promise<{ profissionalId: string }>;
}) {
  const { profissionalId } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("id", profissionalId)
    .single();

  if (!profile) {
    notFound();
  }

  const { data: services } = await supabase
    .from("professional_services")
    .select("id, category, base_price, pricing_model, description, multi_pet_discount_percent")
    .eq("professional_id", profissionalId)
    .eq("active", true);

  const { data: reviews } = await supabase
    .from("reviews")
    .select("rating, comment")
    .eq("reviewee_id", profissionalId)
    .limit(10);

  return (
    <main className="min-h-screen bg-offwhite px-4 py-8">
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-2 text-xs text-teal font-semibold mb-2">
          <ShieldCheck size={14} /> Conta verificada
        </div>
        <h1 className="text-2xl font-bold text-black mb-1">{profile.full_name}</h1>
        <p className="text-sm text-gray-500 mb-6">
          {reviews && reviews.length > 0
            ? `${reviews.length} avaliação(ões) de atendimentos concluídos`
            : "Ainda sem avaliações públicas"}
        </p>

        <div className="flex gap-2 mb-6">
          <Link
            href={`/solicitacoes/nova?profissional=${profissionalId}`}
            className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-teal px-3 py-3 text-sm font-semibold text-white hover:opacity-90"
          >
            <CalendarPlus size={16} /> Solicitar atendimento
          </Link>
          <Link
            href={`/solicitacoes/nova?profissional=${profissionalId}&conversa=1`}
            className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-teal px-3 py-3 text-sm font-semibold text-teal hover:bg-teal/5"
          >
            <MessageCircle size={16} /> Conversar
          </Link>
        </div>

        <h2 className="text-sm font-semibold text-black mb-3">Serviços oferecidos</h2>
        <ul className="flex flex-col gap-3 mb-6">
          {(services ?? []).map((service) => (
            <li key={service.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="font-semibold text-black text-sm">{CATEGORY_LABEL[service.category]}</p>
                <p className="text-sm font-semibold text-teal">
                  {service.base_price ? `R$ ${service.base_price}` : "Sob consulta"}
                </p>
              </div>
              {service.description && (
                <p className="text-xs text-gray-500">{service.description}</p>
              )}
              {service.multi_pet_discount_percent ? (
                <p className="text-xs text-teal mt-1">
                  {service.multi_pet_discount_percent}% de desconto para múltiplos pets
                </p>
              ) : null}
            </li>
          ))}
          {(!services || services.length === 0) && (
            <p className="text-sm text-gray-400">Nenhum serviço publicado ainda.</p>
          )}
        </ul>

        {reviews && reviews.length > 0 && (
          <>
            <h2 className="text-sm font-semibold text-black mb-3">Avaliações</h2>
            <ul className="flex flex-col gap-3">
              {reviews.map((review, i) => (
                <li key={i} className="rounded-lg border border-gray-200 bg-white p-4">
                  <p className="text-sm text-black">{review.comment ?? "Sem comentário"}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </main>
  );
}
