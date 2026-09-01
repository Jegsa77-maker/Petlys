import { createClient } from "@/lib/supabase/server";
import { ModerationQueue } from "@/components/admin/moderation-queue";

export default async function AdminModeracaoPage() {
  const supabase = await createClient();

  const [{ data: messages }, { data: reviews }] = await Promise.all([
    supabase
      .from("messages")
      .select("id, content, flagged_reason, created_at, request_id")
      .not("flagged_reason", "is", null)
      .is("hidden_at", null)
      .order("flagged_at", { ascending: false }),
    supabase
      .from("reviews")
      .select("id, comment, flagged_reason, request_id")
      .not("flagged_reason", "is", null)
      .is("hidden_at", null)
      .order("flagged_at", { ascending: false }),
  ]);

  return (
    <main className="min-h-screen bg-offwhite px-4 py-8">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-teal mb-1">Moderação</h1>
        <p className="text-sm text-gray-600 mb-6">
          Mensagens e avaliações sinalizadas por uma das partes.
        </p>
        <ModerationQueue messages={messages ?? []} reviews={reviews ?? []} />
      </div>
    </main>
  );
}
