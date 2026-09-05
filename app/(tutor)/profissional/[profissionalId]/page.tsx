import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { MessageCircle, CalendarPlus, ShieldCheck, UserRound, Award, BadgeCheck, Star } from "lucide-react";
import {
  computeProfessionalLevel,
  averageRating,
  PROFESSIONAL_LEVEL_LABEL,
} from "@/lib/domain/professional-reputation";
import { FavoriteButton } from "@/components/search/favorite-button";
import { trackEventServer } from "@/lib/analytics/track-server";
import { buildCertificationStatusMap } from "@/lib/domain/certification-status";
import { categoryRequiresCertification } from "@/lib/domain/regulated-categories";
import type { ServiceCategory } from "@/types/database";

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Não lê profiles direto: profiles_select só libera o próprio perfil ou
  // admin/supervisor (0009) — a linha inteira de um profissional (com
  // endereço/CPF/telefone) nunca deveria ficar exposta pra qualquer
  // visitante só porque ele tem serviço ativo (ver 0073). O RPC devolve
  // só id/full_name, e só quando há professional_services ativo — mesma
  // regra que valia antes na policy pública, agora sem vazar a linha inteira.
  //
  // Exceção: o próprio profissional vendo o botão "Ver como o Tutor vê"
  // (app/(profissional)/perfil/page.tsx) — antes de publicar o primeiro
  // serviço, o RPC não devolve nada (não tem professional_services ativo
  // ainda) e a página dava 404 pra ele mesmo, sem nenhum aviso de por quê.
  // Nesse caso lê `profiles` direto — profiles_select já libera o próprio
  // id normalmente, sem precisar do RPC.
  const isSelfView = user?.id === profissionalId;
  const profile = isSelfView
    ? await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("id", profissionalId)
        .single()
        .then((r) => r.data)
    : await supabase
        .rpc("get_public_professional_names", { p_professional_ids: [profissionalId] })
        .then((r) => r.data?.[0] ?? null);

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

  // Perfil confirmado que existe — dispara aqui, não antes do notFound()
  // acima, pra não contar visita a um profissional inexistente.
  void trackEventServer("professional_profile_view", {
    professional_id: profissionalId,
    profile_id: user?.id,
    category: services?.[0]?.category,
  });

  const { data: reviews } = await supabase
    .from("reviews")
    .select("rating, comment")
    .eq("reviewee_id", profissionalId)
    .is("hidden_at", null)
    .limit(10);

  const { data: professionalProfile } = await supabase
    .from("professional_profiles")
    .select(
      "bio, experience_years, specializations, languages, policies, avatar_url, visita_inicial_enabled, visita_inicial_price, visita_inicial_duration_minutes, visita_inicial_modality"
    )
    .eq("profile_id", profissionalId)
    .maybeSingle();

  const [{ count: completedCount }, { data: certRows }, { data: favoriteRow }] = await Promise.all([
    supabase
      .from("requests")
      .select("id", { count: "exact", head: true })
      .eq("professional_id", profissionalId)
      .in("status", ["avaliacao", "concluido"]),
    supabase
      .from("professional_certifications")
      .select("category, status, document_url, created_at")
      .eq("professional_id", profissionalId),
    user
      ? supabase
          .from("tutor_favorites")
          .select("professional_id")
          .eq("tutor_profile_id", user.id)
          .eq("professional_id", profissionalId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // Habilitação por categoria (2026-09-06: sem gate de aprovação pra
  // publicar — o documento fica visível pro Tutor conferir por conta
  // própria, ver lib/domain/certification-status.ts) — documentUrl já
  // resolvido pra URL pública (bucket virou público na migration 0085).
  const statusByCategory = buildCertificationStatusMap(certRows ?? []);
  const certificationsByCategory = Object.fromEntries(
    Object.entries(statusByCategory).map(([category, info]) => [
      category,
      {
        status: info.status,
        documentUrl: info.documentPath
          ? supabase.storage.from("professional-certifications").getPublicUrl(info.documentPath).data.publicUrl
          : null,
      },
    ])
  );
  const hasApprovedCertification = Object.values(certificationsByCategory).some((c) => c.status === "aprovado");

  const avgRating = averageRating(reviews ?? []);
  const level = computeProfessionalLevel(completedCount ?? 0, avgRating);

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
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-teal font-semibold mb-1">
              <span className="flex items-center gap-1">
                <ShieldCheck size={14} /> Conta verificada
              </span>
              <span className="flex items-center gap-1 bg-teal/10 rounded-full px-2 py-0.5">
                <Award size={12} /> {PROFESSIONAL_LEVEL_LABEL[level]}
              </span>
              {hasApprovedCertification && (
                <span className="flex items-center gap-1 bg-teal/10 rounded-full px-2 py-0.5">
                  <BadgeCheck size={12} /> Documentação verificada
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-black">{profile.full_name}</h1>
          </div>
          {user && (
            <FavoriteButton
              professionalId={profissionalId}
              initialFavorited={!!favoriteRow}
              size={22}
            />
          )}
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

        <div className="flex items-center gap-1 text-sm text-gray-500 mb-6">
          {avgRating !== null ? (
            <>
              <Star size={14} className="text-teal fill-teal" />
              <span className="font-semibold text-teal">{avgRating.toFixed(1)}</span>
              <span>
                · {reviews?.length ?? 0} avaliação{(reviews?.length ?? 0) === 1 ? "" : "ões"} de
                atendimentos concluídos
              </span>
            </>
          ) : (
            "Ainda sem avaliações públicas"
          )}
        </div>

        <div className="flex gap-2 mb-3">
          <Link
            href={`/solicitacoes/nova?profissional=${profissionalId}`}
            className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-teal px-3 py-3 text-sm font-semibold text-white hover:opacity-90"
          >
            <CalendarPlus size={16} /> Solicitar atendimento
          </Link>
          <Link
            href={`/solicitacoes/conversar?profissional=${profissionalId}`}
            className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-teal px-3 py-3 text-sm font-semibold text-teal hover:bg-teal/5"
          >
            <MessageCircle size={16} /> Conversar
          </Link>
        </div>

        {professionalProfile?.visita_inicial_enabled && (
          <Link
            href={`/solicitacoes/nova?profissional=${profissionalId}&visitaInicial=1`}
            className="block mb-6 rounded-lg border border-gray-200 bg-white p-3 hover:border-teal transition-colors"
          >
            <p className="text-sm font-semibold text-black">Solicitar visita inicial</p>
            <p className="text-xs text-gray-500">
              {professionalProfile.visita_inicial_price
                ? `R$ ${professionalProfile.visita_inicial_price}`
                : "Gratuita"}
              {professionalProfile.visita_inicial_duration_minutes
                ? ` · ${professionalProfile.visita_inicial_duration_minutes} min`
                : ""}
              {professionalProfile.visita_inicial_modality
                ? ` · ${professionalProfile.visita_inicial_modality === "online" ? "Online" : "Presencial"}`
                : ""}
            </p>
          </Link>
        )}

        <h2 className="text-sm font-semibold text-black mb-3">Serviços oferecidos</h2>
        <ul className="flex flex-col gap-3 mb-6">
          {(services ?? []).map((service) => (
            <li key={service.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="font-semibold text-black text-sm">
                  {CATEGORY_LABEL[service.category]}
                  {service.subcategory ? ` · ${service.subcategory}` : ""}
                </p>
                <p className="text-sm font-semibold text-teal text-right">
                  {service.base_price ? (
                    <>
                      <span className="block text-[10px] font-normal text-gray-400 leading-none">
                        a partir de
                      </span>
                      R$ {service.base_price}
                    </>
                  ) : (
                    "Sob consulta"
                  )}
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
              {categoryRequiresCertification(service.category as ServiceCategory) && (
                <ServiceCertificationNote
                  info={certificationsByCategory[service.category] ?? { status: "nenhum", documentUrl: null }}
                />
              )}
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

const CERT_STATUS_LABEL: Record<string, string> = {
  aprovado: "✅ Documentação verificada",
  pendente: "Documento enviado — em análise",
  rejeitado: "Documentação não verificada",
  nenhum: "Nenhum documento de habilitação enviado",
};

/**
 * Selo de habilitação por serviço (2026-09-06) — categoria regulamentada
 * (hoje só veterinário domiciliar) sempre mostra o status, mesmo "nenhum",
 * pra transparência total: sem aprovador bloqueando publicar, o Tutor
 * decide por conta própria com a informação completa na mão.
 */
function ServiceCertificationNote({
  info,
}: {
  info: { status: string; documentUrl: string | null };
}) {
  return (
    <p className="text-xs mt-1">
      <span className={info.status === "aprovado" ? "text-teal font-semibold" : "text-gray-500"}>
        {CERT_STATUS_LABEL[info.status] ?? info.status}
      </span>
      {info.documentUrl && (
        <>
          {" · "}
          <a href={info.documentUrl} target="_blank" rel="noopener noreferrer" className="text-teal font-semibold hover:underline">
            Ver documento
          </a>
        </>
      )}
    </p>
  );
}
