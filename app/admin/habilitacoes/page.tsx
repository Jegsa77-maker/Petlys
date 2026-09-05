import { createClient } from "@/lib/supabase/server";
import { CertificationsManager } from "@/components/admin/certifications-manager";

export default async function HabilitacoesPage() {
  const supabase = await createClient();

  const { data: certifications } = await supabase
    .from("professional_certifications")
    .select(
      "id, category, status, document_url, profiles!professional_certifications_professional_id_fkey(full_name)"
    )
    .eq("status", "pendente")
    .order("created_at", { ascending: true });

  const rows = (certifications ?? []).map((c) => ({
    id: c.id,
    category: c.category,
    status: c.status,
    // Bucket virou público na migration 0085 — resolve pra URL pública
    // aqui em vez de gerar link assinado no client.
    document_url: supabase.storage.from("professional-certifications").getPublicUrl(c.document_url).data
      .publicUrl,
    professional_name: c.profiles?.full_name ?? "Profissional",
  }));

  return (
    <main className="min-h-screen bg-offwhite px-4 py-8">
      <div className="max-w-md mx-auto flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-teal mb-1">Habilitações</h1>
          <p className="text-sm text-gray-600">
            Documentos de categorias regulamentadas aguardando revisão.
          </p>
        </div>

        <CertificationsManager certifications={rows} />
      </div>
    </main>
  );
}
