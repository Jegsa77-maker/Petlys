"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ConfirmarEmailPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  // Igual ao /redefinir-senha: o link de confirmação de cadastro entrega
  // o token no fragmento da URL (#access_token=...), não como ?code= —
  // por isso precisa ser tratado aqui no client, não em app/(auth)/callback
  // (que só trata o fluxo ?code= do OAuth Google/Facebook).
  useEffect(() => {
    // Todo o corpo roda depois de um microtask — setState direto e síncrono
    // no corpo do efeito dispara re-render em cascata (react-hooks/set-state-in-effect).
    Promise.resolve().then(async () => {
      const supabase = createClient();
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const access_token = hash.get("access_token");
      const refresh_token = hash.get("refresh_token");

      if (!access_token || !refresh_token) {
        setError("Link inválido ou expirado.");
        return;
      }

      const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token });
      if (sessionError) {
        setError("Não foi possível confirmar seu e-mail. Peça um novo link.");
        return;
      }
      router.push("/");
    });
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-offwhite px-4">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-2xl font-bold text-teal mb-2">Confirmando e-mail</h1>
        <p className="text-sm text-gray-600">
          {error ?? "Só um instante..."}
        </p>
      </div>
    </main>
  );
}
