"use client";

import { useState } from "react";
import {
  signInWithPassword,
  signUpWithPassword,
  requestPasswordReset,
} from "@/lib/actions/auth";
import {
  signInSchema,
  signUpSchema,
  requestPasswordResetSchema,
} from "@/lib/validations/auth";
import { trackEvent } from "@/lib/analytics/track";
import { PasswordInput } from "@/components/shared/password-input";

type Mode = "entrar" | "criar" | "esqueci";

export function EmailPasswordForm() {
  const [mode, setMode] = useState<Mode>("entrar");
  const [fullName, setFullName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setNotice(null);

    // Atribuição de canal (UTM) capturada aqui, no clique em "Criar
    // conta" — não numa página de "landing" anônima separada, mais
    // simples e suficiente já que ainda não existe indicação/convite
    // (itens 21-22 do backlog, fora de escopo).
    if (next === "criar") {
      const params = new URLSearchParams(window.location.search);
      trackEvent("signup_started", {
        source: params.get("utm_source") ?? undefined,
        medium: params.get("utm_medium") ?? undefined,
        campaign: params.get("utm_campaign") ?? undefined,
        metadata: { referrer: document.referrer || null },
      });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (mode === "entrar") {
      const parsed = signInSchema.safeParse({ identifier, password });
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "Verifique os dados informados");
        return;
      }
      setIsSubmitting(true);
      try {
        const result = await signInWithPassword(parsed.data);
        if (result?.error) setError(result.error);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (mode === "criar") {
      const parsed = signUpSchema.safeParse({ fullName, email: identifier, password });
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "Verifique os dados informados");
        return;
      }
      setIsSubmitting(true);
      try {
        const result = await signUpWithPassword(parsed.data);
        if (result?.error) {
          setError(result.error);
          return;
        }
        if (result?.needsEmailConfirmation) {
          setNotice("Conta criada! Confira seu e-mail para confirmar antes de entrar.");
        }
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // esqueci a senha
    const parsed = requestPasswordResetSchema.safeParse({ email: identifier });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "E-mail inválido");
      return;
    }
    setIsSubmitting(true);
    try {
      await requestPasswordReset(parsed.data);
      setNotice("Se esse e-mail estiver cadastrado, você vai receber um link pra redefinir a senha.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-4 text-sm font-medium border-b border-gray-200">
        <button
          type="button"
          onClick={() => switchMode("entrar")}
          className={`pb-2 -mb-px border-b-2 ${mode === "entrar" ? "border-teal text-teal" : "border-transparent text-gray-400"}`}
        >
          Entrar
        </button>
        <button
          type="button"
          onClick={() => switchMode("criar")}
          className={`pb-2 -mb-px border-b-2 ${mode === "criar" ? "border-teal text-teal" : "border-transparent text-gray-400"}`}
        >
          Criar conta
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {mode === "criar" && (
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Nome completo"
            className="input"
          />
        )}

        <input
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder={mode === "entrar" ? "E-mail ou usuário" : "E-mail"}
          className="input"
          autoCapitalize="none"
        />

        {mode !== "esqueci" && (
          <PasswordInput value={password} onChange={setPassword} placeholder="Senha" />
        )}

        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        {notice && <p className="text-sm text-teal">{notice}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-teal px-4 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          {isSubmitting
            ? "Enviando..."
            : mode === "entrar"
              ? "Entrar"
              : mode === "criar"
                ? "Criar conta"
                : "Enviar link de redefinição"}
        </button>

        {mode === "entrar" && (
          <button
            type="button"
            onClick={() => switchMode("esqueci")}
            className="text-xs text-gray-500 hover:text-teal text-center"
          >
            Esqueci minha senha
          </button>
        )}
        {mode === "esqueci" && (
          <button
            type="button"
            onClick={() => switchMode("entrar")}
            className="text-xs text-gray-500 hover:text-teal text-center"
          >
            Voltar pro login
          </button>
        )}
      </form>
    </div>
  );
}
