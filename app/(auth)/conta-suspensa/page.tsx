import { signOut } from "@/lib/actions/auth";
import { ShieldAlert } from "lucide-react";

export default function ContaSuspensaPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-offwhite px-4">
      <div className="w-full max-w-sm text-center">
        <ShieldAlert size={40} className="mx-auto mb-4 text-red-600" />
        <h1 className="text-2xl font-bold text-black mb-2">Conta suspensa</h1>
        <p className="text-sm text-gray-600 mb-6">
          Sua conta foi suspensa pela equipe da Plataforma Pet e não tem
          acesso liberado no momento. Se você acredita que isso é um
          engano, entre em contato com o suporte.
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
