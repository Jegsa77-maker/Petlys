import { createClient } from "@/lib/supabase/server";
import { UserList } from "@/components/admin/user-list";

export default async function UsuariosPage() {
  const supabase = await createClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email, internal_username, account_roles(role, active)")
    .order("created_at", { ascending: false })
    .limit(300);

  const users = (profiles ?? []).map((p) => ({
    id: p.id,
    fullName: p.full_name,
    email: p.email,
    internalUsername: p.internal_username,
    roles: (p.account_roles ?? []).map((r) => ({ role: r.role, active: r.active })),
  }));

  return (
    <main className="min-h-screen bg-offwhite px-4 py-8">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-teal">Usuários</h1>
          <p className="text-sm text-gray-500">
            Qualquer conta, qualquer papel — inclusive outro Administrador. Toda alteração fica registrada no log
            de auditoria.
          </p>
        </div>
        <UserList users={users} basePath="/admin/usuarios" canCreate />
      </div>
    </main>
  );
}
