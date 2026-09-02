import { defineConfig } from "vitest/config";

/**
 * Config mínima pra testes unitários de lógica pura (lib/domain,
 * lib/validations) — sem ambiente de browser (jsdom) por enquanto,
 * porque nada aqui ainda testa componente React. Se/quando entrar
 * teste de componente, adicionar `environment: "jsdom"` e a dep
 * correspondente.
 */
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".next", "e2e/**"],
    setupFiles: ["./vitest.setup.ts"],
    // Testes de RLS (tests/rls/**) batem no Supabase remoto de verdade,
    // criando/apagando fixture própria — rodar em série evita duas
    // suítes disputando o mesmo e-mail de teste ao mesmo tempo.
    fileParallelism: false,
  },
});
