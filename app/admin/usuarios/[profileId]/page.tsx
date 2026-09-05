import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { UserDetailPanel } from "@/components/admin/user-detail-panel";

export default async function AdminUsuarioDetailPage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const { profileId } = await params;
  const supabase = await createClient();

  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, internal_username")
    .eq("id", profileId)
    .single();

  if (!profile) {
    notFound();
  }

  const { data: roles } = await supabase
    .from("account_roles")
    .select("role, active")
    .eq("profile_id", profileId);

  const { data: suspensions } = await supabase
    .from("account_suspensions")
    .select("id, status, reason, created_at, decided_at")
    .eq("target_profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(5);

  // Chat de suporte (0075) — visível a qualquer staff, não é DM privado.
  const { data: chatRows } = await supabase
    .from("staff_conversation_messages")
    .select("id, sender_id, content, created_at, profiles!sender_id(full_name)")
    .eq("target_profile_id", profileId)
    .order("created_at", { ascending: true })
    .limit(100);

  const chatMessages = (chatRows ?? []).map((m) => ({
    id: m.id,
    senderId: m.sender_id,
    senderName: m.profiles?.full_name ?? "—",
    content: m.content,
    createdAt: m.created_at,
  }));

  return (
    <main className="min-h-screen bg-offwhite px-4 py-8">
      <div className="max-w-md mx-auto flex flex-col gap-6">
        <Link href="/admin/usuarios" className="flex items-center gap-1 text-sm text-gray-500 hover:text-black">
          <ArrowLeft size={16} /> Usuários
        </Link>

        <UserDetailPanel
          profile={profile}
          roles={roles ?? []}
          suspensions={suspensions ?? []}
          isSelf={profile.id === currentUser?.id}
          variant="admin"
          currentUserId={currentUser?.id ?? ""}
          chatMessages={chatMessages}
        />
      </div>
    </main>
  );
}
