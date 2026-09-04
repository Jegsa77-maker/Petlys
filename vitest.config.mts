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
    // .claude/worktrees/** são checkouts paralelos de tarefas em background
    // (spawn_task) dentro do próprio repo — sem isso, rodar a suíte aqui
    // também executa (e demora por) os testes desses worktrees, misturando
    // resultado de um trabalho em andamento em outra sessão com o daqui.
    exclude: ["node_modules", ".next", "e2e/**", ".claude/worktrees/**"],
    setupFiles: ["./vitest.setup.ts"],
    // Testes de RLS (tests/rls/**) batem no Supabase remoto de verdade,
    // criando/apagando fixture própria — rodar em série evita duas
    // suítes disputando o mesmo e-mail de teste ao mesmo tempo.
    fileParallelism: false,
  },
});
