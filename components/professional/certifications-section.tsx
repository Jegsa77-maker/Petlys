"use client";

import { useState } from "react";
import { FileUploadField } from "@/components/shared/file-upload-field";
import { submitCertification, withdrawCertification } from "@/lib/actions/professional-certifications";
import { REGULATED_CATEGORIES } from "@/lib/domain/regulated-categories";

const CATEGORY_LABEL: Record<string, string> = {
  pet_sitter: "Pet sitter / cuidador",
  passeador: "Passeador de cães",
  hospedagem_creche: "Hospedagem / creche",
  adestrador: "Adestrador / comportamentalista",
  banho_tosa: "Banho e tosa",
  veterinario_domiciliar: "Veterinário domiciliar",
};

const STATUS_LABEL: Record<string, string> = {
  pendente: "Em análise",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
};

const STATUS_COLOR: Record<string, string> = {
  pendente: "text-amber-700 bg-amber-50",
  aprovado: "text-teal bg-teal/10",
  rejeitado: "text-red-700 bg-red-50",
};

type Certification = {
  id: string;
  category: string;
  status: string;
  review_notes: string | null;
};

/**
 * Envio e acompanhamento de habilitações por categoria regulamentada
 * (seção 6.3). Só aparece pra categorias em REGULATED_CATEGORIES — as
 * demais nunca exigem documento pra publicar serviço.
 */
export function CertificationsSection({
  professionalId,
  certifications,
}: {
  professionalId: string;
  certifications: Certification[];
}) {
  const [category, setCategory] = useState<string>(REGULATED_CATEGORIES[0] ?? "");
  const [documentPath, setDocumentPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categoriesWithoutSubmission = REGULATED_CATEGORIES.filter(
    (cat) => !certifications.some((c) => c.category === cat && c.status !== "rejeitado")
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!documentPath) {
      setError("Envie o arquivo do documento antes de continuar.");
      return;
    }

    setIsSubmitting(true);
    const result = await submitCertification({ category, documentPath });
    setIsSubmitting(false);

    if (result?.error) {
      setError(result.error);
      return;
    }
    setDocumentPath(null);
  }

  async function handleWithdraw(id: string) {
    await withdrawCertification(id);
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-black mb-1">Habilitações</h2>
      <p className="text-xs text-gray-500 mb-3">
        Algumas categorias exigem documento verificado antes de você publicar
        um serviço nelas (ex.: veterinário domiciliar exige CRMV).
      </p>

      {certifications.length > 0 && (
        <ul className="flex flex-col gap-2 mb-4">
          {certifications.map((cert) => (
            <li
              key={cert.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium text-black">{CATEGORY_LABEL[cert.category] ?? cert.category}</p>
                {cert.status === "rejeitado" && cert.review_notes && (
                  <p className="text-xs text-red-600">{cert.review_notes}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold rounded-full px-2 py-1 ${STATUS_COLOR[cert.status]}`}>
                  {STATUS_LABEL[cert.status] ?? cert.status}
                </span>
                {cert.status === "pendente" && (
                  <button
                    type="button"
                    onClick={() => handleWithdraw(cert.id)}
                    className="text-xs text-gray-400 hover:text-red-600"
                  >
                    Remover
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {categoriesWithoutSubmission.length === 0 ? (
        <p className="text-xs text-gray-400">Nenhuma categoria pendente de habilitação no momento.</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="block text-xs font-medium text-black mb-1">Categoria</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="input">
              {categoriesWithoutSubmission.map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_LABEL[cat] ?? cat}
                </option>
              ))}
            </select>
          </div>

          <FileUploadField
            bucket="professional-certifications"
            pathPrefix={professionalId}
            accept="image/*,.pdf"
            isPrivateBucket
            currentUrl={documentPath}
            currentLabel="Documento pronto para enviar"
            buttonLabel={documentPath ? "Trocar documento" : "Anexar documento"}
            onUploaded={(path) => setDocumentPath(path)}
          />

          {error && <p className="text-xs text-red-600" role="alert">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg border border-teal px-4 py-2 text-sm font-semibold text-teal hover:bg-teal/5 disabled:opacity-60"
          >
            {isSubmitting ? "Enviando..." : "Enviar para análise"}
          </button>
        </form>
      )}
    </div>
  );
}
