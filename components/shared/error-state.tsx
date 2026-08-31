"use client";

import { AlertCircle } from "lucide-react";

export function ErrorState({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-screen bg-offwhite px-4 py-8 flex items-center justify-center">
      <div className="max-w-sm text-center">
        <AlertCircle size={40} className="mx-auto mb-4 text-red-500" />
        <h1 className="text-lg font-bold text-black mb-2">Algo deu errado</h1>
        <p className="text-sm text-gray-600 mb-6">
          Não conseguimos carregar esta página. Verifique sua conexão e tente de novo.
        </p>
        <button
          onClick={reset}
          className="rounded-lg bg-teal px-4 py-3 text-sm font-semibold text-white hover:opacity-90"
        >
          Tentar novamente
        </button>
      </div>
    </main>
  );
}
