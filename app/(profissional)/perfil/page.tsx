import { createClient } from "@/lib/supabase/server";
import { ProfessionalProfileForm } from "@/components/professional/professional-profile-form";
import { ServiceAreaForm } from "@/components/professional/service-area-form";
import { ProfessionalGallerySection } from "@/components/professional/professional-gallery-section";
import { ProfessionalSkillsSection } from "@/components/professional/professional-skills-section";
import { getGalleryLimits } from "@/lib/actions/pet-media";
import {
  computeProfessionalLevel,
  averageRating,
  PROFESSIONAL_LEVEL_LABEL,
} from "@/lib/domain/professional-reputation";
import Link from "next/link";
import { Eye, Award, Star } from "lucide-react";

export default async function PerfilProfissionalPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [
    { data: profile },
    { count: activeServicesCount },
    { count: completedCount },
    { data: reviews },
    { data: serviceArea },
    { data: mediaRows },
    { data: skillRows },
    galleryLimits,
  ] = await Promise.all([
    supabase.from("professional_profiles").select("*").eq("profile_id", user.id).maybeSingle(),
    supabase
      .from("professional_services")
      .select("id", { count: "exact", head: true })
      .eq("professional_id", user.id)
      .eq("active", true),
    supabase
      .from("requests")
      .select("id", { count: "exact", head: true })
      .eq("professional_id", user.id)
      .in("status", ["avaliacao", "concluido"]),
    supabase.from("reviews").select("rating").eq("reviewee_id", user.id).is("hidden_at", null),
    supabase
      .from("professional_service_areas")
      .select("center_zip, radius_km")
      .eq("professional_id", user.id)
      .maybeSingle(),
    supabase
      .from("professional_media")
      .select("id, media_type, url")
      .eq("professional_id", user.id)
      .order("created_at", { ascending: true }),
    supabase.from("professional_skills").select("id, category").eq("professional_id", user.id),
    getGalleryLimits(),
  ]);

  const galleryItems = (mediaRows ?? []).map((row) => ({
    id: row.id,
    mediaType: row.media_type as "foto" | "video",
    path: row.url,
    publicUrl: supabase.storage.from("professional-gallery").getPublicUrl(row.url).data.publicUrl,
  }));

  const avgRating = averageRating(reviews ?? []);
  const level = computeProfessionalLevel(completedCount ?? 0, avgRating);

  const specializations = profile?.specializations ?? [];
  const languages = profile?.languages ?? [];

  // Indicador de completude (seção 6.3) — 6 sinais de perfil pronto pra
  // converter na busca; nenhum deles é obrigatório pra publicar serviço.
  const checks = [
    Boolean(profile?.avatar_url),
    Boolean(profile?.bio && profile.bio.trim().length > 0),
    profile?.experience_years != null,
    specializations.length > 0,
    languages.length > 0,
    (activeServicesCount ?? 0) > 0,
  ];
  const completude = Math.round((checks.filter(Boolean).length / checks.length) * 100);

  return (
    <main className="min-h-screen bg-offwhite px-4 py-8">
      <div className="max-w-md mx-auto flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-teal mb-1">Meu perfil</h1>
          <p className="text-sm text-gray-600 mb-2">
            É o que o Tutor vê antes de decidir contratar você.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal bg-teal/10 rounded-full px-2 py-1 w-fit">
              <Award size={14} /> {PROFESSIONAL_LEVEL_LABEL[level]}
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-black bg-gray rounded-full px-2 py-1 w-fit">
              <Star size={14} className={avgRating !== null ? "text-teal fill-teal" : "text-gray-400"} />
              {avgRating !== null
                ? `${avgRating.toFixed(1)} (${reviews?.length ?? 0})`
                : "Sem avaliações ainda"}
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-black">Completude do perfil</p>
            <p className="text-sm font-bold text-teal">{completude}%</p>
          </div>
          <div className="h-2 rounded-full bg-gray overflow-hidden">
            <div className="h-full bg-teal rounded-full" style={{ width: `${completude}%` }} />
          </div>
          <Link
            href={`/profissional/${user.id}`}
            className="flex items-center gap-1 text-xs text-teal font-semibold hover:underline mt-3 w-fit"
          >
            <Eye size={14} /> Ver como o Tutor vê
          </Link>
        </div>

        <ProfessionalProfileForm
          profileId={user.id}
          initial={{
            bio: profile?.bio ?? "",
            experienceYears: profile?.experience_years != null ? String(profile.experience_years) : "",
            specializations: specializations.join(", "),
            languages: languages.join(", "),
            policies: profile?.policies ?? "",
            avatarUrl: profile?.avatar_url ?? "",
            formation: profile?.formation ?? "",
            socialUrl: profile?.social_url ?? "",
            professionalName: profile?.professional_name ?? "",
            visitaInicialEnabled: profile?.visita_inicial_enabled ?? false,
            visitaInicialPrice:
              profile?.visita_inicial_price != null ? String(profile.visita_inicial_price) : "",
            visitaInicialDurationMinutes:
              profile?.visita_inicial_duration_minutes != null
                ? String(profile.visita_inicial_duration_minutes)
                : "",
            visitaInicialModality: profile?.visita_inicial_modality ?? "",
            visitaInicialDeductible: profile?.visita_inicial_deductible ?? false,
          }}
        />

        <ProfessionalGallerySection
          professionalId={user.id}
          initialItems={galleryItems}
          maxPhotoBytes={galleryLimits.maxPhotoBytes}
          maxVideoBytes={galleryLimits.maxVideoBytes}
          maxItems={galleryLimits.maxItems}
        />

        <ProfessionalSkillsSection initialSkills={skillRows ?? []} />

        <ServiceAreaForm
          currentZip={serviceArea?.center_zip ?? null}
          currentRadiusKm={serviceArea?.radius_km ?? null}
        />
      </div>
    </main>
  );
}
