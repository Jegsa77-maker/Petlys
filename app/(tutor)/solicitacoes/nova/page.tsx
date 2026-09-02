import { createClient } from "@/lib/supabase/server";
import { NewRequestForm } from "@/components/requests/new-request-form";
import { getCategoryRequiredSections } from "@/lib/domain/category-requirements-store";
import { redirect } from "next/navigation";

export default async function NovaSolicitacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ profissional?: string; visitaInicial?: string; repetir?: string }>;
}) {
  const { profissional, visitaInicial, repetir } = await searchParams;

  if (!profissional) {
    redirect("/buscar");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: petLinks } = user
    ? await supabase
        .from("pet_tutors")
        .select("pets(id, name, health_info, behavior_info, routine_info, emergency_info)")
        .eq("tutor_profile_id", user.id)
    : { data: null };

  const pets = (petLinks ?? [])
    .map((link) => link.pets)
    .filter((p): p is NonNullable<typeof p> => p !== null);

  // Requisitos do prontuário por categoria — configurável pelo Admin desde
  // 2026-09-01 (ver components/admin/prontuario-requirements-manager.tsx).
  const requiredSections = await getCategoryRequiredSections(supabase);

  // "Contratar novamente" (seção 12.3, item 6 da Onda 4) — reaproveita
  // categoria, pets, endereço e respostas de um atendimento concluído
  // anterior. Só reaproveita de uma solicitação que é mesmo do Tutor
  // logado e desse mesmo profissional — nunca confia só no que vem
  // pela URL.
  let initialCategory: string | undefined;
  let initialPetIds: string[] | undefined;
  let initialAddress: string | undefined;
  let initialCategoryAnswers: Record<string, string> | undefined;

  if (repetir && user) {
    const { data: original } = await supabase
      .from("requests")
      .select("category, address, category_answers, tutor_id, professional_id, request_pets(pet_id)")
      .eq("id", repetir)
      .single();

    if (original && original.tutor_id === user.id && original.professional_id === profissional) {
      initialCategory = original.category;
      initialAddress = original.address ?? undefined;
      initialCategoryAnswers = (original.category_answers as Record<string, string>) ?? undefined;
      initialPetIds = original.request_pets.map((rp) => rp.pet_id);
    }
  }

  return (
    <main className="min-h-screen bg-offwhite px-4 py-8">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-teal mb-1">Nova solicitação</h1>
        <p className="text-sm text-gray-600 mb-6">
          {initialCategory
            ? "Trouxemos os dados do atendimento anterior — revise antes de enviar."
            : "Revise antes de enviar — dá pra editar até o envio."}
        </p>
        <NewRequestForm
          professionalId={profissional}
          pets={pets}
          requiredSections={requiredSections}
          initialIsVisitaInicial={visitaInicial === "1"}
          initialCategory={initialCategory}
          initialPetIds={initialPetIds}
          initialAddress={initialAddress}
          initialCategoryAnswers={initialCategoryAnswers}
        />
      </div>
    </main>
  );
}
