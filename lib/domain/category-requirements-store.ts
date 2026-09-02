import type { createClient } from "@/lib/supabase/server";
import type { ServiceCategory } from "@/types/database";
import { CATEGORY_REQUIRED_SECTIONS, type ProntuarioSection } from "@/lib/domain/category-requirements";

/**
 * Versão "lê o banco" de `CATEGORY_REQUIRED_SECTIONS` — separada do arquivo
 * puro porque este aqui recebe um client do Supabase (só faz sentido em
 * Server Component/Server Action, nunca importado por um componente
 * client-side). Categoria sem nenhuma linha configurada em
 * `platform_parameters` cai no default de fábrica — nunca fica "sem
 * exigência nenhuma" só porque o Admin nunca mexeu naquela categoria.
 */
export async function getCategoryRequiredSections(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<Record<ServiceCategory, ProntuarioSection[]>> {
  const { data } = await supabase
    .from("platform_parameters")
    .select("chave2, chave3")
    .eq("chave1", "requisitos_prontuario")
    .eq("status", "ativo");

  const byCategory = new Map<string, ProntuarioSection[]>();
  (data ?? []).forEach((row) => {
    const list = byCategory.get(row.chave2) ?? [];
    list.push(row.chave3 as ProntuarioSection);
    byCategory.set(row.chave2, list);
  });

  const result = {} as Record<ServiceCategory, ProntuarioSection[]>;
  (Object.keys(CATEGORY_REQUIRED_SECTIONS) as ServiceCategory[]).forEach((category) => {
    result[category] = byCategory.get(category) ?? CATEGORY_REQUIRED_SECTIONS[category];
  });
  return result;
}
