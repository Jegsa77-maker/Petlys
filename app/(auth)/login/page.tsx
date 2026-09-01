import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { EmailPasswordForm } from "@/components/auth/email-password-form";

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-offwhite px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="text-xs font-semibold tracking-widest uppercase text-teal mb-2">
            Plataforma Pet
          </p>
          <h1 className="text-2xl font-bold text-teal mb-2">Entrar</h1>
          <p className="text-sm text-gray-600">
            Entre com e-mail e senha, ou continue com Google/Facebook.
          </p>
        </div>

        <EmailPasswordForm />

        <div className="flex items-center gap-3 my-6">
          <div className="h-px bg-gray-200 flex-1" />
          <span className="text-xs text-gray-400">ou</span>
          <div className="h-px bg-gray-200 flex-1" />
        </div>

        <OAuthButtons />

        <p className="mt-6 text-xs text-center text-gray-500">
          Ao continuar, você concorda com os Termos de Uso e a Política de
          Privacidade da plataforma.
        </p>
      </div>
    </main>
  );
}
