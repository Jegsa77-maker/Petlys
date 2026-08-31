"use client";

import { useState } from "react";
import { upsertParameter, deleteParameter } from "@/lib/actions/admin";
import { upsertParameterSchema } from "@/lib/validations/admin";
import { Plus, Pencil, Trash2, X } from "lucide-react";

type Parameter = {
  id: string;
  chave1: string;
  chave2: string;
  chave3: string;
  valor1: string | null;
  valor2: string | null;
  valor3: string | null;
  explicacao: string | null;
  vigencia_inicio: string;
};

export function ParametersManager({ parameters }: { parameters: Parameter[] }) {
  const [editing, setEditing] = useState<Parameter | "new" | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => setEditing("new")}
        className="flex items-center justify-center gap-1 rounded-lg border border-teal px-4 py-3 text-sm font-semibold text-teal hover:bg-teal/5"
      >
        <Plus size={16} /> Novo parâmetro
      </button>

      <ul className="flex flex-col gap-2">
        {parameters.map((param) => (
          <li
            key={param.id}
            className="rounded-lg border border-gray-200 bg-white p-4 flex items-start justify-between gap-3"
          >
            <div>
              <p className="text-sm font-semibold text-black">
                {[param.chave1, param.chave2, param.chave3].filter(Boolean).join(" / ")}
              </p>
              <p className="text-xs text-gray-500">
                {[param.valor1, param.valor2, param.valor3].filter(Boolean).join(" · ")}
              </p>
              {param.explicacao && <p className="text-xs text-gray-400 mt-1">{param.explicacao}</p>}
              <p className="text-xs text-gray-400">
                Vigência: {new Date(param.vigencia_inicio).toLocaleString("pt-BR")}
              </p>
            </div>
            <button onClick={() => setEditing(param)} className="text-gray-400 hover:text-teal shrink-0">
              <Pencil size={16} />
            </button>
          </li>
        ))}
      </ul>

      {editing && (
        <ParameterFormOverlay
          parameter={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function ParameterFormOverlay({
  parameter,
  onClose,
}: {
  parameter: Parameter | null;
  onClose: () => void;
}) {
  const [chave1, setChave1] = useState(parameter?.chave1 ?? "");
  const [chave2, setChave2] = useState(parameter?.chave2 ?? "");
  const [chave3, setChave3] = useState(parameter?.chave3 ?? "");
  const [valor1, setValor1] = useState(parameter?.valor1 ?? "");
  const [valor2, setValor2] = useState(parameter?.valor2 ?? "");
  const [valor3, setValor3] = useState(parameter?.valor3 ?? "");
  const [explicacao, setExplicacao] = useState(parameter?.explicacao ?? "");
  const [vigenciaInicio, setVigenciaInicio] = useState(
    parameter?.vigencia_inicio
      ? new Date(parameter.vigencia_inicio).toISOString().slice(0, 16)
      : new Date().toISOString().slice(0, 16)
  );
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSave() {
    setError(null);

    const parsed = upsertParameterSchema.safeParse({
      id: parameter?.id,
      chave1,
      chave2: chave2 || undefined,
      chave3: chave3 || undefined,
      valor1,
      valor2: valor2 || undefined,
      valor3: valor3 || undefined,
      explicacao,
      vigenciaInicio,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Verifique os dados informados");
      setConfirming(false);
      return;
    }

    setIsSubmitting(true);
    const result = await upsertParameter(parsed.data);
    setIsSubmitting(false);

    if (result?.error) {
      setError(result.error);
      setConfirming(false);
      return;
    }
    onClose();
  }

  async function handleDelete() {
    if (!parameter) return;
    setIsSubmitting(true);
    await deleteParameter(parameter.id);
    setIsSubmitting(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="w-full max-w-sm bg-white rounded-lg p-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-black">
            {parameter ? "Editar parâmetro" : "Novo parâmetro"}
          </p>
          <button onClick={onClose} className="text-gray-400 hover:text-black">
            <X size={18} />
          </button>
        </div>

        {!confirming ? (
          <div className="flex flex-col gap-2">
            <input value={chave1} onChange={(e) => setChave1(e.target.value)} placeholder="Chave 1 (ex: comissao_percentual)" className="input" />
            <input value={chave2} onChange={(e) => setChave2(e.target.value)} placeholder="Chave 2 (ex: categoria) — opcional" className="input" />
            <input value={chave3} onChange={(e) => setChave3(e.target.value)} placeholder="Chave 3 — opcional" className="input" />
            <input value={valor1} onChange={(e) => setValor1(e.target.value)} placeholder="Valor 1" className="input" />
            <input value={valor2} onChange={(e) => setValor2(e.target.value)} placeholder="Valor 2 — opcional" className="input" />
            <input value={valor3} onChange={(e) => setValor3(e.target.value)} placeholder="Valor 3 — opcional" className="input" />
            <textarea value={explicacao} onChange={(e) => setExplicacao(e.target.value)} placeholder="Explicação — para que serve este parâmetro" rows={2} className="input" />
            <label className="text-xs text-gray-500">Vigência a partir de</label>
            <input
              type="datetime-local"
              value={vigenciaInicio}
              onChange={(e) => setVigenciaInicio(e.target.value)}
              className="input"
            />

            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="flex-1 rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                {parameter ? "Salvar alteração" : "Criar parâmetro"}
              </button>
              {parameter && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isSubmitting}
                  className="rounded-lg border border-red-300 px-3 py-2 text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-black">
              Tem certeza que quer {parameter ? "salvar essa alteração" : "criar este parâmetro"}?
              {parameter && " Isso fica registrado no log de auditoria."}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={isSubmitting}
                className="flex-1 rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                {isSubmitting ? "Salvando..." : "Confirmar"}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm text-black"
              >
                Voltar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
