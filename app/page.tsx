import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("full_name").eq("id", user.id).single()
    : { data: null };

  const { data: roles } = user
    ? await supabase
        .from("account_roles")
        .select("role")
        .eq("profile_id", user.id)
        .eq("active", true)
    : { data: null };

  return (
    <main className="min-h-screen flex items-center justify-center bg-offwhite px-4">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-2xl font-bold text-teal mb-2">
          Olá, {profile?.full_name ?? "tutor/profissional"}!
        </h1>
        <p className="text-sm text-gray-600 mb-1">
          Conta verificada. Perfis ativos: {roles?.map((r) => r.role).join(", ") || "nenhum"}.
        </p>
        <p className="text-xs text-gray-400 mb-6">
          As telas de Início (Tutor), Dashboard (Profissional) e Admin/Supervisor
          entram na próxima etapa da Fase 3.
        </p>
        <form action={signOut}>
          <button
            type="submit"
            className="text-sm text-gray-500 hover:text-black underline underline-offset-2"
          >
            Sair
          </button>
        </form>
      </div>
    </main>
  );
}
