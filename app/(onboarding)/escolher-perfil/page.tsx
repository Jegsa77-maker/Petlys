import { ChooseProfileForm } from "@/components/auth/choose-profile-form";
import { createClient } from "@/lib/supabase/server";

export default async function EscolherPerfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: roles }, { data: profile }] = user
    ? await Promise.all([
        supabase.from("account_roles").select("role").eq("profile_id", user.id).eq("active", true),
        supabase.from("profiles").select("birth_date, cpf_cnpj").eq("id", user.id).single(),
      ])
    : [{ data: null }, { data: null }];

  const existingRoles = (roles ?? [])
    .map((r) => r.role)
    .filter((r): r is "tutor" | "profissional" => r === "tutor" || r === "profissional");
  const isAddingRole = existingRoles.length > 0;

  return (
    <main className="min-h-screen flex items-center justify-center bg-offwhite px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-teal mb-2">
            {isAddingRole ? "Adicionar outro perfil" : "Quase lá"}
          </h1>
          <p className="text-sm text-gray-600">
            {isAddingRole
              ? "Você continua com acesso ao que já tinha — isso só adiciona um novo jeito de usar a plataforma."
              : "Só mais um passo antes de começar."}
          </p>
        </div>
        <ChooseProfileForm
          existingRoles={existingRoles}
          existingBirthDate={profile?.birth_date ?? ""}
          existingCpfCnpj={profile?.cpf_cnpj ?? ""}
        />
      </div>
    </main>
  );
}
