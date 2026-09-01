import { createClient } from "@/lib/supabase/server";
import { ProfessionalProfileForm } from "@/components/professional/professional-profile-form";
import { CertificationsSection } from "@/components/professional/certifications-section";
import {
  computeProfessionalLevel,
  averageRating,
  PROFESSIONAL_LEVEL_LABEL,
} from "@/lib/domain/professional-reputation";
import Link from "next/link";
import { Eye, Award } from "lucide-react";

export default async function PerfilProfissionalPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [
    { data: profile },
    { count: activeServicesCount },
    { data: certifications },
    { count: completedCount },
    { data: reviews },
  ] = await Promise.all([
    supabase.from("professional_profiles").select("*").eq("profile_id", user.id).maybeSingle(),
    supabase
      .from("professional_services")
      .select("id", { count: "exact", head: true })
      .eq("professional_id", user.id)
      .eq("active", true),
    supabase
      .from("professional_certifications")
      .select("id, category, status, review_notes")
      .eq("professional_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("requests")
      .select("id", { count: "exact", head: true })
      .eq("professional_id", user.id)
      .in("status", ["avaliacao", "concluido"]),
    supabase.from("reviews").select("rating").eq("reviewee_id", user.id).is("hidden_at", null),
  ]);

  const level = computeProfessionalLevel(completedCount ?? 0, averageRating(reviews ?? []));

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
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal bg-teal/10 rounded-full px-2 py-1 w-fit">
            <Award size={14} /> {PROFESSIONAL_LEVEL_LABEL[level]}
          </span>
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

        <CertificationsSection professionalId={user.id} certifications={certifications ?? []} />
      </div>
    </main>
  );
}
