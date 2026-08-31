import { ChooseProfileForm } from "@/components/auth/choose-profile-form";

export default function EscolherPerfilPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-offwhite px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-teal mb-2">Quase lá</h1>
          <p className="text-sm text-gray-600">
            Só mais um passo antes de começar.
          </p>
        </div>
        <ChooseProfileForm />
      </div>
    </main>
  );
}
