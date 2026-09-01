"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { reviewCertification } from "@/lib/actions/professional-certifications";

const CATEGORY_LABEL: Record<string, string> = {
  pet_sitter: "Pet sitter / cuidador",
  passeador: "Passeador de cães",
  hospedagem_creche: "Hospedagem / creche",
  adestrador: "Adestrador / comportamentalista",
  banho_tosa: "Banho e tosa",
  veterinario_domiciliar: "Veterinário domiciliar",
};

type Certification = {
  id: string;
  category: string;
  status: string;
  document_url: string;
  professional_name: string;
};

/**
 * Revisão manual de habilitações (seção 6.3/13.3) — Admin/Supervisor
 * aprova ou rejeita o documento enviado pelo profissional.
 * `document_url` guarda o caminho no bucket privado, não uma URL pública
 * — a visualização gera um link assinado sob demanda.
 */
export function CertificationsManager({ certifications }: { certifications: Certification[] }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());

  async function handleViewDocument(path: string) {
    const supabase = createClient();
    const { data, error: signError } = await supabase.storage
      .from("professional-certifications")
      .createSignedUrl(path, 60);

    if (signError || !data?.signedUrl) {
      setError("Não foi possível gerar o link do documento.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function handleApprove(id: string) {
    setBusyId(id);
    setError(null);
    const result = await reviewCertification({ certificationId: id, status: "aprovado" });
    setBusyId(null);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setResolvedIds((prev) => new Set(prev).add(id));
  }

  async function handleReject(id: string) {
    setBusyId(id);
    setError(null);
    const result = await reviewCertification({
      certificationId: id,
      status: "rejeitado",
      reviewNotes: reviewNotes || undefined,
    });
    setBusyId(null);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setResolvedIds((prev) => new Set(prev).add(id));
    setRejectingId(null);
    setReviewNotes("");
  }

  const pending = certifications.filter((c) => c.status === "pendente" && !resolvedIds.has(c.id));

  if (pending.length === 0) {
    return <p className="text-sm text-gray-400">Nenhuma habilitação pendente de revisão.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      {pending.map((cert) => (
        <div key={cert.id} className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm font-semibold text-black">{cert.professional_name}</p>
          <p className="text-xs text-gray-500 mb-2">{CATEGORY_LABEL[cert.category] ?? cert.category}</p>

          <button
            type="button"
            onClick={() => handleViewDocument(cert.document_url)}
            className="text-xs text-teal font-semibold hover:underline mb-3"
          >
            Ver documento
          </button>

          {rejectingId === cert.id ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Motivo da rejeição (opcional, mas ajuda o profissional a corrigir)"
                rows={2}
                className="input text-sm"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleReject(cert.id)}
                  disabled={busyId === cert.id}
                  className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
                >
                  Confirmar rejeição
                </button>
                <button
                  type="button"
                  onClick={() => setRejectingId(null)}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleApprove(cert.id)}
                disabled={busyId === cert.id}
                className="flex-1 rounded-lg bg-teal px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                Aprovar
              </button>
              <button
                type="button"
                onClick={() => setRejectingId(cert.id)}
                disabled={busyId === cert.id}
                className="flex-1 rounded-lg border border-red-300 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
              >
                Rejeitar
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
