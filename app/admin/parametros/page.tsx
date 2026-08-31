import { createClient } from "@/lib/supabase/server";
import { ParametersManager } from "@/components/admin/parameters-manager";

export default async function ParametrosPage() {
  const supabase = await createClient();
  const { data: parameters } = await supabase
    .from("platform_parameters")
    .select("id, chave1, chave2, chave3, valor1, valor2, valor3, explicacao, vigencia_inicio")
    .eq("status", "ativo")
    .order("chave1");

  return (
    <main className="min-h-screen bg-offwhite px-4 py-8">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-teal mb-1">Parâmetros comerciais</h1>
        <p className="text-sm text-gray-600 mb-6">
          Toda alteração ou exclusão pede confirmação e fica registrada no log de auditoria.
        </p>
        <ParametersManager parameters={parameters ?? []} />
      </div>
    </main>
  );
}
