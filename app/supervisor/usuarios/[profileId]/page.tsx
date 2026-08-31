import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { UserActionsPanel } from "@/components/admin/user-actions-panel";

export default async function SupervisorUsuarioPage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const { profileId } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, internal_username")
    .eq("id", profileId)
    .single();

  if (!profile) {
    notFound();
  }

  const { data: roles } = await supabase
    .from("account_roles")
    .select("role, active")
    .eq("profile_id", profileId);

  return (
    <main className="min-h-screen bg-offwhite px-4 py-8">
      <div className="max-w-md mx-auto flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-black">{profile.full_name}</h1>
          <p className="text-sm text-gray-500">{profile.email}</p>
          <div className="flex gap-1 mt-2">
            {(roles ?? []).map((r) => (
              <span
                key={r.role}
                className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${
                  r.active ? "bg-teal/10 text-teal" : "bg-gray text-gray-400"
                }`}
              >
                {r.role}
              </span>
            ))}
          </div>
        </div>

        <UserActionsPanel profileId={profile.id} hasInternalUsername={!!profile.internal_username} />
      </div>
    </main>
  );
}
