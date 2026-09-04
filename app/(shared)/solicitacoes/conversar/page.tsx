import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { StartConversationForm } from "@/components/requests/start-conversation-form";

export default async function ConversarPage({
  searchParams,
}: {
  searchParams: Promise<{ profissional?: string }>;
}) {
  const { profissional: professionalId } = await searchParams;
  if (!professionalId) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Já existe uma conversa aberta com esse profissional? Vai direto pra
  // ela em vez de deixar o Tutor escolher categoria de novo.
  const { data: existing } = await supabase
    .from("requests")
    .select("id")
    .eq("tutor_id", user.id)
    .eq("professional_id", professionalId)
    .eq("status", "rascunho")
    .eq("is_conversa_previa", true)
    .maybeSingle();

  if (existing) {
    redirect(`/solicitacoes/${existing.id}`);
  }

  return (
    <main className="min-h-screen bg-offwhite px-4 py-8">
      <div className="max-w-md mx-auto flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-bold text-black mb-1">Conversar antes de solicitar</h1>
        </div>
        <StartConversationForm professionalId={professionalId} />
      </div>
    </main>
  );
}
