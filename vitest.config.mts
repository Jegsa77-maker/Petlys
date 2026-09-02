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
  },
});
