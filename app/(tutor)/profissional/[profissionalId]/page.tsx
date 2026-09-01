import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { MessageCircle, CalendarPlus, ShieldCheck, UserRound, Award, BadgeCheck } from "lucide-react";
import {
  computeProfessionalLevel,
  averageRating,
  PROFESSIONAL_LEVEL_LABEL,
} from "@/lib/domain/professional-reputation";

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
    .select(
      "id, category, subcategory, base_price, pricing_model, description, multi_pet_discount_percent, duration_minutes, species_accepted, restrictions, professional_service_addons(id, name, price)"
    )
    .eq("professional_id", profissionalId)
    .eq("active", true);

  const { data: reviews } = await supabase
    .from("reviews")
    .select("rating, comment")
    .eq("reviewee_id", profissionalId)
    .limit(10);

  const { data: professionalProfile } = await supabase
    .from("professional_profiles")
    .select("bio, experience_years, specializations, languages, policies, avatar_url")
    .eq("profile_id", profissionalId)
    .maybeSingle();

  const [{ count: completedCount }, { count: approvedCertCount }] = await Promise.all([
    supabase
      .from("requests")
      .select("id", { count: "exact", head: true })
      .eq("professional_id", profissionalId)
      .in("status", ["avaliacao", "concluido"]),
    supabase
      .from("professional_certifications")
      .select("id", { count: "exact", head: true })
      .eq("professional_id", profissionalId)
      .eq("status", "aprovado"),
  ]);

  const level = computeProfessionalLevel(completedCount ?? 0, averageRating(reviews ?? []));

  const specializations = professionalProfile?.specializations ?? [];
  const languages = professionalProfile?.languages ?? [];

  return (
    <main className="min-h-screen bg-offwhite px-4 py-8">
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-4 mb-4">
          <div className="h-16 w-16 rounded-full bg-gray flex items-center justify-center overflow-hidden shrink-0">
            {professionalProfile?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={professionalProfile.avatar_url}
                alt={profile.full_name}
                className="h-full w-full object-cover"
              />
            ) : (
              <UserRound size={28} className="text-gray-400" />
            )}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-teal font-semibold mb-1">
              <span className="flex items-center gap-1">
                <ShieldCheck size={14} /> Conta verificada
              </span>
              <span className="flex items-center gap-1 bg-teal/10 rounded-full px-2 py-0.5">
                <Award size={12} /> {PROFESSIONAL_LEVEL_LABEL[level]}
              </span>
              {(approvedCertCount ?? 0) > 0 && (
                <span className="flex items-center gap-1 bg-teal/10 rounded-full px-2 py-0.5">
                  <BadgeCheck size={12} /> Documentação verificada
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-black">{profile.full_name}</h1>
          </div>
        </div>

        {professionalProfile?.bio && (
          <p className="text-sm text-gray-700 mb-4">{professionalProfile.bio}</p>
        )}

        {(professionalProfile?.experience_years != null ||
          specializations.length > 0 ||
          languages.length > 0) && (
          <div className="flex flex-col gap-1 mb-4 text-xs text-gray-600">
            {professionalProfile?.experience_years != null && (
              <p>
                <span className="font-semibold text-black">Experiência:</span>{" "}
                {professionalProfile.experience_years}{" "}
                {professionalProfile.experience_years === 1 ? "ano" : "anos"}
              </p>
            )}
            {specializations.length > 0 && (
              <p>
                <span className="font-semibold text-black">Especializações:</span>{" "}
                {specializations.join(", ")}
              </p>
            )}
            {languages.length > 0 && (
              <p>
                <span className="font-semibold text-black">Idiomas:</span> {languages.join(", ")}
              </p>
            )}
          </div>
        )}

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
                <p className="font-semibold text-black text-sm">
                  {CATEGORY_LABEL[service.category]}
                  {service.subcategory ? ` · ${service.subcategory}` : ""}
                </p>
                <p className="text-sm font-semibold text-teal">
                  {service.base_price ? `R$ ${service.base_price}` : "Sob consulta"}
                </p>
              </div>
              {service.description && (
                <p className="text-xs text-gray-500">{service.description}</p>
              )}
              {service.duration_minutes && (
                <p className="text-xs text-gray-400">Duração média: {service.duration_minutes} min</p>
              )}
              {service.species_accepted.length > 0 && (
                <p className="text-xs text-gray-400">Atende: {service.species_accepted.join(", ")}</p>
              )}
              {service.restrictions && (
                <p className="text-xs text-gray-400">Restrições: {service.restrictions}</p>
              )}
              {service.professional_service_addons.length > 0 && (
                <p className="text-xs text-gray-400">
                  Adicionais: {service.professional_service_addons.map((a) => `${a.name} (R$ ${a.price})`).join(", ")}
                </p>
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

        {professionalProfile?.policies && (
          <>
            <h2 className="text-sm font-semibold text-black mb-3">Políticas</h2>
            <p className="text-sm text-gray-700 mb-6 whitespace-pre-line">
              {professionalProfile.policies}
            </p>
          </>
        )}

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
