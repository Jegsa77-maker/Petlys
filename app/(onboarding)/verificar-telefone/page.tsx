import { VerifyPhoneForm } from "@/components/auth/verify-phone-form";

export default function VerificarTelefonePage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-offwhite px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-teal mb-2">Confirme seu telefone</h1>
          <p className="text-sm text-gray-600">
            Isso protege sua conta e é como tutores e profissionais vão poder
            confirmar quem é quem na plataforma.
          </p>
        </div>
        <VerifyPhoneForm />
      </div>
    </main>
  );
}
