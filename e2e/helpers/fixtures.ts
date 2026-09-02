import { CURRENT_TERMS_VERSION } from "@/lib/domain/terms";
import { provisionTestUser, serviceClient, type TestUserRole, type TestUser } from "../../tests/rls/helpers";

export type { TestUser };

/**
 * Versão "pronta pro app" de `provisionTestUser` — além do usuário e do
 * papel, também passa pelas gates que só o middleware do Next.js checa
 * (telefone/e-mail verificado, termos aceitos). Os testes de RLS
 * (tests/rls/**) não precisam disso porque batem direto na API e nunca
 * passam pelo middleware; os specs e2e navegam o app de verdade, então
 * precisam.
 */
export async function provisionAppReadyUser(roles: TestUserRole[], label: string): Promise<TestUser> {
  const user = await provisionTestUser(roles, label);
  const admin = serviceClient();

  const { error: verifyError } = await admin.rpc("test_verify_profile", { p_profile_id: user.id });
  if (verifyError) throw new Error(`test_verify_profile falhou: ${verifyError.message}`);

  const { error: termsError } = await admin
    .from("terms_acceptances")
    .insert({ profile_id: user.id, version: CURRENT_TERMS_VERSION });
  if (termsError) throw new Error(`insert terms_acceptances falhou: ${termsError.message}`);

  return user;
}
