export type CertificationStatusValue = "aprovado" | "pendente" | "rejeitado";
export type EffectiveCertificationStatus = CertificationStatusValue | "nenhum";

export type CertificationRow = {
  category: string;
  // `string`, não CertificationStatusValue — o valor vem direto da coluna
  // (Supabase infere `string` genérico), a checagem real é o `check`
  // constraint no banco (0018_terms_consent_documents_certifications.sql).
  status: string;
  document_url: string;
  created_at: string;
};

export type CertificationStatusInfo = {
  status: EffectiveCertificationStatus;
  documentPath: string | null;
};

/**
 * Status "efetivo" de uma habilitação, não simplesmente o envio mais
 * recente. Uma vez aprovado, continua "aprovado" mesmo que um novo
 * documento tenha sido enviado depois (ex.: CRMV venceu, profissional
 * reenviou) — só troca quando o Admin decidir sobre esse novo envio.
 * Decisão explícita do usuário (2026-09-06): "mantém validado até novo
 * aprovar/rejeitar", pra não abrir uma lacuna de confiança pro Tutor
 * enquanto a revisão do reenvio não acontece.
 */
function effectiveStatusForCategory(rows: CertificationRow[]): CertificationStatusInfo {
  if (rows.length === 0) return { status: "nenhum", documentPath: null };

  const sorted = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const latest = sorted[0];
  if (latest.status !== "pendente") {
    return { status: latest.status as CertificationStatusValue, documentPath: latest.document_url };
  }

  const lastResolved = sorted.find((r) => r.status !== "pendente");
  return lastResolved
    ? { status: lastResolved.status as CertificationStatusValue, documentPath: lastResolved.document_url }
    : { status: "pendente", documentPath: latest.document_url };
}

/** Agrupa linhas de professional_certifications por categoria e aplica o status efetivo em cada uma. */
export function buildCertificationStatusMap(
  rows: CertificationRow[]
): Record<string, CertificationStatusInfo> {
  const byCategory = new Map<string, CertificationRow[]>();
  for (const row of rows) {
    const list = byCategory.get(row.category) ?? [];
    list.push(row);
    byCategory.set(row.category, list);
  }

  const result: Record<string, CertificationStatusInfo> = {};
  for (const [category, categoryRows] of byCategory) {
    result[category] = effectiveStatusForCategory(categoryRows);
  }
  return result;
}
