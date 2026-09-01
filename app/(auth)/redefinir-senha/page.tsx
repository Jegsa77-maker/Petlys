"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { resetPasswordSchema } from "@/lib/validations/auth";

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [ready, setReady] = useState(false);

  // O link de "Esqueci minha senha" do Supabase entrega o token de
  // recuperação no fragmento da URL (#access_token=...), não como
  // ?code= — isso nunca chega ao servidor, só o navegador vê. Precisa
  // ser lido e trocado por sessão aqui, no client.
  useEffect(() => {
    // Todo o corpo roda depois de um microtask — setState direto e síncrono
    // no corpo do efeito dispara re-render em cascata (react-hooks/set-state-in-effect).
    Promise.resolve().then(async () => {
      const supabase = createClient();
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const access_token = hash.get("access_token");
      const refresh_token = hash.get("refresh_token");

      if (access_token && refresh_token) {
        await supabase.auth.setSession({ access_token, refresh_token });
        window.history.replaceState(null, "", window.location.pathname);
      }
      setReady(true);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = resetPasswordSchema.safeParse({ password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Verifique a senha informada");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não coincidem");
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password: parsed.data.password });
    setIsSubmitting(false);

    if (updateError) {
      setError("Não foi possível redefinir a senha. O link pode ter expirado — peça um novo.");
      return;
    }

    setDone(true);
    setTimeout(() => router.push("/"), 2000);
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-offwhite px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-teal mb-2">Nova senha</h1>
        <p className="text-sm text-gray-600 mb-6">Escolha uma nova senha pra sua conta.</p>

        {done ? (
          <p className="text-sm text-teal">Senha redefinida! Redirecionando...</p>
        ) : !ready ? (
          <p className="text-sm text-gray-500">Verificando link...</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nova senha"
              className="input"
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirmar nova senha"
              className="input"
            />
            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-teal px-4 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {isSubmitting ? "Salvando..." : "Redefinir senha"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
