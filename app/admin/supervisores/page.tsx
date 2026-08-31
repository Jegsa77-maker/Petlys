import { createClient } from "@/lib/supabase/server";
import { CreateSupervisorForm, SupervisorList } from "@/components/admin/supervisor-manager";

export default async function SupervisoresPage() {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("account_roles")
    .select("profile_id, profiles(full_name, internal_username)")
    .eq("role", "supervisor")
    .eq("active", true);

  const supervisors = (rows ?? [])
    .filter((r) => r.profiles)
    .map((r) => ({
      profile_id: r.profile_id,
      full_name: r.profiles!.full_name,
      internal_username: r.profiles!.internal_username,
    }));

  return (
    <main className="min-h-screen bg-offwhite px-4 py-8">
      <div className="max-w-md mx-auto flex flex-col gap-6">
        <h1 className="text-2xl font-bold text-teal">Supervisores</h1>
        <SupervisorList supervisors={supervisors} />
        <CreateSupervisorForm />
      </div>
    </main>
  );
}
