import { defineConfig, devices } from "@playwright/test";

try {
  process.loadEnvFile(".env.local");
} catch {
  // sem .env.local (ex.: CI) — assume que as env vars já vieram de outro lugar.
}

/**
 * E2E ponta a ponta (fase 3 dos testes automatizados, depois de Vitest
 * unidade + RLS). Login nos specs usa a rota /dev-login (só existe fora
 * de produção, ver app/(auth)/dev-login/route.ts) — evita depender do
 * fluxo real de OTP por SMS/OAuth, que não dá pra automatizar sem
 * mandar SMS de verdade.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // specs autenticados compartilham o projeto Supabase remoto
  workers: 1, // idem — sem isolamento de ambiente por worker, roda tudo em série
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
