"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Provider = "google" | "facebook";

const PROVIDER_LABEL: Record<Provider, string> = {
  google: "Continuar com Google",
  facebook: "Continuar com Facebook",
};

export function OAuthButtons() {
  const [loadingProvider, setLoadingProvider] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn(provider: Provider) {
    setError(null);
    setLoadingProvider(provider);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/callback`,
      },
    });

    if (signInError) {
      setError("Não foi possível iniciar o login. Tente novamente.");
      setLoadingProvider(null);
    }
    // Em caso de sucesso o navegador é redirecionado para o provedor —
    // nenhuma outra ação é necessária aqui.
  }

  return (
    <div className="flex flex-col gap-3 w-full">
      {(["google", "facebook"] as const).map((provider) => (
        <button
          key={provider}
          type="button"
          onClick={() => handleSignIn(provider)}
          disabled={loadingProvider !== null}
          className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-black
                     hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed
                     transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal"
        >
          {loadingProvider === provider ? "Redirecionando..." : PROVIDER_LABEL[provider]}
        </button>
      ))}
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
    </div>
  );
}
