"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertParameter, deleteParameter } from "@/lib/actions/admin";
import { SERVICE_CATEGORY_LABEL } from "@/lib/domain/service-catalog";
import { PRONTUARIO_SECTION_LABEL, type ProntuarioSection } from "@/lib/domain/category-requirements";
import type { ServiceCategory } from "@/types/database";

const CATEGORIES = Object.keys(SERVICE_CATEGORY_LABEL) as ServiceCategory[];
const SECTIONS = Object.keys(PRONTUARIO_SECTION_LABEL) as ProntuarioSection[];

export type RequirementRow = { id: string; category: string; section: string };

/**
 * Matriz categoria × seção do prontuário (pendência da Onda 1 — "catálogo
 * administrável de requisitos por categoria", seção 6.3/6.5). Reaproveita
 * 100% a infraestrutura de `platform_parameters` já existente (RLS,
 * `upsertParameter`/`deleteParameter`, log de auditoria automático via
 * trigger) em vez de criar tabela/action nova: cada célula marcada é uma
 * linha com `chave1='requisitos_prontuario', chave2=categoria,
 * chave3=seção`. Desmarcar = soft-delete (`status='substituido'`, mesmo
 * padrão de qualquer outro parâmetro); nunca some do histórico.
 */
export function ProntuarioRequirementsManager({ requirements }: { requirements: RequirementRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(requirements);
  // `rows` começa como cópia local (pra dar feedback otimista sem esperar
  // round-trip), mas depois de qualquer mutação real (insert/soft-delete)
  // pedimos `router.refresh()` — quando o Server Component re-renderiza
  // com a lista atualizada (agora com o `id` de verdade gerado pelo
  // banco), o padrão abaixo ("ajustar estado durante a renderização",
  // recomendado pelo React em vez de useEffect+setState) resincroniza o
  // estado local. Sem isso, uma linha recém-criada ficava presa com um id
  // otimista falso (`pending-...`), e desmarcá-la em seguida chamava
  // `deleteParameter` com um id inválido — parecia funcionar na hora, mas
  // nunca gravava no banco.
  const [prevRequirements, setPrevRequirements] = useState(requirements);
  if (prevRequirements !== requirements) {
    setPrevRequirements(requirements);
    setRows(requirements);
  }

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function isRequired(category: ServiceCategory, section: ProntuarioSection) {
    return rows.some((r) => r.category === category && r.section === section);
  }

  function rowFor(category: ServiceCategory, section: ProntuarioSection) {
    return rows.find((r) => r.category === category && r.section === section);
  }

  function toggle(category: ServiceCategory, section: ProntuarioSection) {
    setError(null);
    const existing = rowFor(category, section);

    if (existing) {
      setRows((prev) => prev.filter((r) => r.id !== existing.id));
      startTransition(async () => {
        const result = await deleteParameter(existing.id);
        if (result?.error) {
          setError(result.error);
          setRows((prev) => [...prev, existing]);
        } else {
          router.refresh();
        }
      });
    } else {
      const optimisticId = `pending-${category}-${section}`;
      setRows((prev) => [...prev, { id: optimisticId, category, section }]);
      startTransition(async () => {
        const result = await upsertParameter({
          chave1: "requisitos_prontuario",
          chave2: category,
          chave3: section,
          valor1: "obrigatorio",
          explicacao: `Exige a seção "${PRONTUARIO_SECTION_LABEL[section]}" do prontuário do pet antes de solicitar ${SERVICE_CATEGORY_LABEL[category]}.`,
          vigenciaInicio: new Date().toISOString().slice(0, 16),
        });
        if (result?.error) {
          setError(result.error);
          setRows((prev) => prev.filter((r) => r.id !== optimisticId));
        } else {
          router.refresh();
        }
      });
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-black mb-1">Requisitos do prontuário por categoria</h2>
      <p className="text-xs text-gray-500 mb-3">
        Marque quais seções do prontuário do pet são obrigatórias antes do Tutor conseguir
        solicitar cada categoria de serviço. Mudanças valem imediatamente para novas solicitações.
      </p>

      {error && <p className="text-xs text-red-600 mb-2" role="alert">{error}</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse min-w-[480px]">
          <thead>
            <tr>
              <th className="text-left text-gray-500 font-medium pb-2 pr-2">Categoria</th>
              {SECTIONS.map((section) => (
                <th key={section} className="text-center text-gray-500 font-medium pb-2 px-1">
                  {PRONTUARIO_SECTION_LABEL[section]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CATEGORIES.map((category) => (
              <tr key={category} className="border-t border-gray-100">
                <td className="py-2 pr-2 text-black font-medium whitespace-nowrap">
                  {SERVICE_CATEGORY_LABEL[category]}
                </td>
                {SECTIONS.map((section) => (
                  <td key={section} className="text-center py-2 px-1">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-teal"
                      checked={isRequired(category, section)}
                      disabled={isPending}
                      onChange={() => toggle(category, section)}
                      aria-label={`${SERVICE_CATEGORY_LABEL[category]} exige ${PRONTUARIO_SECTION_LABEL[section]}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
