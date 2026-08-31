import { OAuthButtons } from "@/components/auth/oauth-buttons";

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-offwhite px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="text-xs font-semibold tracking-widest uppercase text-teal mb-2">
            Plataforma Pet
          </p>
          <h1 className="text-2xl font-bold text-teal mb-2">Entrar</h1>
          <p className="text-sm text-gray-600">
            Cadastro rápido — sem formulário longo. Depois só pedimos telefone
            para confirmar sua conta.
          </p>
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
