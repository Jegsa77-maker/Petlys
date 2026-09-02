import { createClient } from "@/lib/supabase/server";
import { ParametersManager } from "@/components/admin/parameters-manager";
import { ProntuarioRequirementsManager } from "@/components/admin/prontuario-requirements-manager";

export default async function ParametrosPage() {
  const supabase = await createClient();
  const { data: parameters } = await supabase
    .from("platform_parameters")
    .select("id, chave1, chave2, chave3, valor1, valor2, valor3, explicacao, vigencia_inicio")
    .eq("status", "ativo")
    .order("chave1");

  // Matriz de requisitos do prontuário (pendência da Onda 1) reaproveita a
  // mesma tabela, isolada por chave1='requisitos_prontuario' — não entra
  // na lista genérica acima pra não competir visualmente com um formato
  // que não é o dela (é checkbox, não texto livre).
  const requirementRows = (parameters ?? [])
    .filter((p) => p.chave1 === "requisitos_prontuario")
    .map((p) => ({ id: p.id, category: p.chave2, section: p.chave3 }));
  const genericParameters = (parameters ?? []).filter((p) => p.chave1 !== "requisitos_prontuario");

  return (
    <main className="min-h-screen bg-offwhite px-4 py-8">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-teal mb-1">Parâmetros comerciais</h1>
          <p className="text-sm text-gray-600">
            Toda alteração ou exclusão pede confirmação e fica registrada no log de auditoria.
          </p>
        </div>

        <ProntuarioRequirementsManager requirements={requirementRows} />

        <div>
          <h2 className="text-sm font-semibold text-black mb-3">Outros parâmetros</h2>
          <ParametersManager parameters={genericParameters} />
        </div>
      </div>
    </main>
  );
}
