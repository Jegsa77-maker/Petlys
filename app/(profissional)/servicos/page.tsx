import { createClient } from "@/lib/supabase/server";
import { ServicesManager } from "@/components/services/services-manager";
import { buildCertificationStatusMap } from "@/lib/domain/certification-status";

export default async function ServicosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: services }, { data: skillRows }, { data: certRows }] = user
    ? await Promise.all([
        supabase
          .from("professional_services")
          .select(
            "id, category, subcategory, pricing_model, base_price, active, multi_pet_discount_percent, description, duration_minutes, species_accepted, min_size, max_size, restrictions, category_details, professional_service_addons(id, name, price)"
          )
          .eq("professional_id", user.id)
          .order("category"),
        supabase.from("professional_skills").select("category").eq("professional_id", user.id),
        supabase
          .from("professional_certifications")
          .select("category, status, document_url, created_at")
          .eq("professional_id", user.id),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const skillCategories = (skillRows ?? []).map((s) => s.category);

  // Status efetivo por categoria (2026-09-06: habilitação saiu de "Meu
  // perfil" e virou parte do formulário de Serviço) — documentUrl já vem
  // como URL pública (bucket professional-certifications virou público na
  // migration 0085), pronta pro Tutor abrir direto.
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

  return (
    <main className="min-h-screen bg-offwhite px-4 py-8">
      <div className="max-w-md mx-auto flex flex-col gap-6">
        <h1 className="text-2xl font-bold text-teal">Serviços e preços</h1>

        <ServicesManager
          professionalId={user?.id ?? ""}
          services={services ?? []}
          skillCategories={skillCategories}
          certificationsByCategory={certificationsByCategory}
        />
      </div>
    </main>
  );
}
