"use client";

import { useState } from "react";
import { FileUploadField } from "@/components/shared/file-upload-field";
import { submitCertification } from "@/lib/actions/professional-certifications";
import type { EffectiveCertificationStatus } from "@/lib/domain/certification-status";
import type { ServiceCategory } from "@/types/database";

const STATUS_LABEL: Record<EffectiveCertificationStatus, string> = {
  aprovado: "✅ Documentação verificada",
  pendente: "Documento enviado — aguardando análise",
  rejeitado: "Documento rejeitado — envie um novo",
  nenhum: "Nenhum documento enviado ainda",
};

const STATUS_COLOR: Record<EffectiveCertificationStatus, string> = {
  aprovado: "text-teal bg-teal/10",
  pendente: "text-amber-700 bg-amber-50",
  rejeitado: "text-red-700 bg-red-50",
  nenhum: "text-gray-500 bg-gray-100",
};

/**
 * Documentação de categoria regulamentada (ex.: CRMV pro veterinário
 * domiciliar) — movida de "Meu perfil" pro formulário de Serviço em
 * 2026-09-06: o Tutor vê o documento/selo no card do serviço, e enviar não
 * bloqueia publicar (ver createService) — só define o selo. Sem opção de
 * "remover" aqui: uma vez aprovado, reenviar sempre soma um novo registro
 * (nunca substitui o aprovado até o Admin decidir sobre o reenvio).
 */
export function ServiceCategoryCertification({
  professionalId,
  category,
  status,
  documentUrl,
}: {
  professionalId: string;
  category: ServiceCategory;
  status: EffectiveCertificationStatus;
  documentUrl: string | null;
}) {
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (!pendingPath) return;
    setIsSubmitting(true);
    setError(null);
    const result = await submitCertification({ category, documentPath: pendingPath });
    setIsSubmitting(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setSent(true);
    setPendingPath(null);
  }

  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 flex flex-col gap-2">
      <p className="text-xs font-semibold text-gray-600">Documentação exigida pra essa categoria</p>

      <span className={`w-fit text-xs font-semibold rounded-full px-2 py-1 ${STATUS_COLOR[status]}`}>
        {STATUS_LABEL[status]}
      </span>

      {documentUrl && (
        <a
          href={documentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-teal font-semibold hover:underline w-fit"
        >
          Ver documento enviado
        </a>
      )}

      {sent ? (
        <p className="text-xs text-teal">Documento enviado! Você será avisado quando for revisado.</p>
      ) : (
        <>
          <FileUploadField
            bucket="professional-certifications"
            pathPrefix={professionalId}
            accept="image/*,.pdf"
            isPrivateBucket
            currentUrl={pendingPath}
            currentLabel="Documento pronto para enviar"
            buttonLabel={status === "nenhum" ? "Anexar documento" : "Enviar novo documento"}
            onUploaded={(path) => setPendingPath(path)}
          />

          {pendingPath && (
            <button
              type="button"
              onClick={handleSend}
              disabled={isSubmitting}
              className="w-fit rounded-lg border border-teal px-3 py-1.5 text-xs font-semibold text-teal hover:bg-teal/5 disabled:opacity-60"
            >
              {isSubmitting ? "Enviando..." : "Enviar para análise"}
            </button>
          )}

          {error && (
            <p className="text-xs text-red-600" role="alert">
              {error}
            </p>
          )}
        </>
      )}
    </div>
  );
}
