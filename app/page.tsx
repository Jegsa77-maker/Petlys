import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut, setActiveRole } from "@/lib/actions/auth";

// tutor/profissional passam por setActiveRole (grava o papel ativo — as
// telas de um nunca aparecem pro outro, ver lib/supabase/middleware.ts).
// administrador/supervisor não têm esse conceito: são só links diretos.
const SWITCHABLE_ROLE_LABEL: Record<"tutor" | "profissional", string> = {
  tutor: "Entrar como Tutor",
  profissional: "Entrar como Profissional",
};

const STAFF_ROLE_HOME: Record<string, { href: string; label: string }> = {
  administrador: { href: "/admin/dashboard", label: "Painel (Admin)" },
  supervisor: { href: "/supervisor/incidentes", label: "Incidentes (Supervisor)" },
};

const SWITCHABLE_ROLE_HOME: Record<"tutor" | "profissional", string> = {
  tutor: "/inicio",
  profissional: "/dashboard",
};

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

  const roleNames = roles?.map((r) => r.role) ?? [];
  const switchableRoles = (["tutor", "profissional"] as const).filter((r) => roleNames.includes(r));
  const staffRoles = roleNames.filter((r) => STAFF_ROLE_HOME[r]);

  // Só existe escolha de verdade quando há mais de um destino possível (os
  // dois papéis tutor/profissional, ou uma combinação incomum com papel de
  // staff). Com um só, pular a tela intermediária — ela existia mesmo sem
  // esse caso exigir clique nenhum. Não precisa gravar `active_role`: o
  // middleware (resolveActiveRole) já resolve sozinho quando a conta só
  // tem um dos dois papéis, cookie nenhum necessário.
  if (switchableRoles.length + staffRoles.length === 1) {
    if (switchableRoles.length === 1) {
      redirect(SWITCHABLE_ROLE_HOME[switchableRoles[0]]);
    } else {
      redirect(STAFF_ROLE_HOME[staffRoles[0]].href);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-offwhite px-4">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-2xl font-bold text-teal mb-2">
          Olá, {profile?.full_name ?? "tutor/profissional"}!
        </h1>
        <p className="text-sm text-gray-600 mb-6">
          Conta verificada. Perfis ativos: {roleNames.join(", ") || "nenhum"}.
        </p>

        {switchableRoles.length > 1 && (
          <p className="text-xs text-gray-500 mb-3">
            Sua conta tem os dois perfis — escolha em qual você está entrando.
          </p>
        )}

        <div className="flex flex-col gap-2 mb-6">
          {switchableRoles.map((role) => (
            <form key={role} action={setActiveRole.bind(null, role)}>
              <button
                type="submit"
                className="w-full rounded-lg bg-teal px-4 py-3 text-sm font-semibold text-white hover:opacity-90"
              >
                {SWITCHABLE_ROLE_LABEL[role]}
              </button>
            </form>
          ))}
          {staffRoles.map((role) => (
            <Link
              key={role}
              href={STAFF_ROLE_HOME[role].href}
              className="w-full rounded-lg border border-teal px-4 py-3 text-sm font-semibold text-teal hover:bg-teal/5"
            >
              {STAFF_ROLE_HOME[role].label}
            </Link>
          ))}
        </div>

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
