import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AcceptTermsForm } from "@/components/auth/accept-terms-form";
import { CURRENT_TERMS_VERSION, TERMS_OF_USE_TEXT, PRIVACY_POLICY_TEXT } from "@/lib/domain/terms";

/**
 * Gate obrigatório antes de escolher papel (seção 6.1) — força aceite
 * explícito e versionado dos Termos/Privacidade. Ver
 * lib/supabase/middleware.ts para a checagem que redireciona pra cá.
 */
export default async function AceitarTermosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: acceptance } = await supabase
    .from("terms_acceptances")
    .select("profile_id")
    .eq("profile_id", user.id)
    .eq("version", CURRENT_TERMS_VERSION)
    .maybeSingle();

  if (acceptance) {
    redirect("/");
  }

  return (
    <main className="min-h-screen bg-offwhite px-4 py-8">
      <div className="max-w-md mx-auto flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-teal mb-1">Termos e privacidade</h1>
          <p className="text-sm text-gray-600">
            Antes de continuar, leia e confirme que concorda com os termos abaixo.
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 max-h-64 overflow-y-auto text-xs text-gray-700 whitespace-pre-line">
          <h2 className="text-sm font-semibold text-black mb-2">Termos de Uso</h2>
          {TERMS_OF_USE_TEXT}
          <h2 className="text-sm font-semibold text-black mt-4 mb-2">Política de Privacidade</h2>
          {PRIVACY_POLICY_TEXT}
        </div>

        <AcceptTermsForm />
      </div>
    </main>
  );
}
