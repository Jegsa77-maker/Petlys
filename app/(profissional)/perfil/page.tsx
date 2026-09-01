import { createClient } from "@/lib/supabase/server";
import { ProfessionalProfileForm } from "@/components/professional/professional-profile-form";
import Link from "next/link";
import { Eye } from "lucide-react";

export default async function PerfilProfissionalPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [{ data: profile }, { count: activeServicesCount }] = await Promise.all([
    supabase.from("professional_profiles").select("*").eq("profile_id", user.id).maybeSingle(),
    supabase
      .from("professional_services")
      .select("id", { count: "exact", head: true })
      .eq("professional_id", user.id)
      .eq("active", true),
  ]);

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
          <p className="text-sm text-gray-600">
            É o que o Tutor vê antes de decidir contratar você.
          </p>
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
          initial={{
            bio: profile?.bio ?? "",
            experienceYears: profile?.experience_years != null ? String(profile.experience_years) : "",
            specializations: specializations.join(", "),
            languages: languages.join(", "),
            policies: profile?.policies ?? "",
            avatarUrl: profile?.avatar_url ?? "",
          }}
        />
      </div>
    </main>
  );
}
