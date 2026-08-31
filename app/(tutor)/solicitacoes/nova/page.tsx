import { createClient } from "@/lib/supabase/server";
import { NewRequestForm } from "@/components/requests/new-request-form";
import { redirect } from "next/navigation";

export default async function NovaSolicitacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ profissional?: string }>;
}) {
  const { profissional } = await searchParams;

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
        .select("pets(id, name)")
        .eq("tutor_profile_id", user.id)
    : { data: null };

  const pets = (petLinks ?? [])
    .map((link) => link.pets)
    .filter((p): p is NonNullable<typeof p> => p !== null);

  return (
    <main className="min-h-screen bg-offwhite px-4 py-8">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-teal mb-1">Nova solicitação</h1>
        <p className="text-sm text-gray-600 mb-6">
          Revise antes de enviar — dá pra editar até o envio.
        </p>
        <NewRequestForm professionalId={profissional} pets={pets} />
      </div>
    </main>
  );
}
