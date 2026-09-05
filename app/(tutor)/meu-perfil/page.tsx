import { createClient } from "@/lib/supabase/server";
import { AddressForm } from "@/components/tutor/address-form";
import { AvatarForm } from "@/components/tutor/avatar-form";

/**
 * Primeira tela de "meu perfil" pro Tutor — não existia nenhuma até agora
 * (só o Profissional tem /perfil). Começa só com endereço (mapa de
 * cobertura do Admin); nome/e-mail aparecem de leitura, sem edição ainda
 * (fora de escopo desta entrega).
 */
export default async function MeuPerfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, address_zip, avatar_url")
    .eq("id", user.id)
    .single();

  return (
    <main className="min-h-screen bg-offwhite px-4 py-8">
      <div className="max-w-md mx-auto flex flex-col gap-6">
        <h1 className="text-2xl font-bold text-teal">Meu perfil</h1>

        <AvatarForm profileId={user.id} currentUrl={profile?.avatar_url ?? null} />

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Nome</p>
          <p className="text-sm font-semibold text-black">{profile?.full_name}</p>
          <p className="text-xs text-gray-500 mt-3">E-mail</p>
          <p className="text-sm font-semibold text-black">{profile?.email}</p>
        </div>

        <AddressForm currentZip={profile?.address_zip ?? null} />
      </div>
    </main>
  );
}
