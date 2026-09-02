import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import { cleanupTestUser } from "../tests/rls/helpers";
import { provisionAppReadyUser, type TestUser } from "./helpers/fixtures";

/**
 * Smoke test do shell responsivo (M-001/M-002, iniciativa de CX) pros
 * 3 papéis principais — confirma que cada um chega na própria home sem
 * erro, com a navegação certa. Não é teste de conteúdo de negócio, é
 * "a casca da aplicação carrega certo pra esse papel".
 */
test.describe("Shell — smoke por papel", () => {
  let tutor: TestUser;
  let profissional: TestUser;
  let admin: TestUser;

  test.beforeAll(async () => {
    tutor = await provisionAppReadyUser(["tutor"], "e2e-shell-tutor");
    profissional = await provisionAppReadyUser(["profissional"], "e2e-shell-prof");
    admin = await provisionAppReadyUser(["administrador"], "e2e-shell-admin");
  });

  test.afterAll(async () => {
    await cleanupTestUser(tutor.id);
    await cleanupTestUser(profissional.id);
    await cleanupTestUser(admin.id);
  });

  test("tutor entra e vê a navegação de Tutor", async ({ page }) => {
    await loginAs(page, tutor.email);
    await page.getByRole("button", { name: "Entrar como Tutor" }).click();
    await expect(page).toHaveURL(/\/inicio/);
    // Vários links da própria tela de conteúdo apontam pro mesmo destino
    // do menu (ex.: atalho "Buscar profissional" além do item de menu
    // "Buscar") — checar por href em vez de texto evita ambiguidade de
    // accessible name sem depender de qual apareceu primeiro no DOM.
    await expect(page.locator('a[href="/buscar"]').first()).toBeVisible();
    await expect(page.locator('a[href="/pets"]').first()).toBeVisible();
  });

  test("profissional entra e vê a navegação de Profissional", async ({ page }) => {
    await loginAs(page, profissional.email);
    await page.getByRole("button", { name: "Entrar como Profissional" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('a[href="/agenda"]').first()).toBeVisible();
    await expect(page.locator('a[href="/kanban"]').first()).toBeVisible();
  });

  test("admin entra e vê o painel", async ({ page }) => {
    await loginAs(page, admin.email);
    await page.getByRole("link", { name: "Painel (Admin)" }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard/);
    await expect(page.getByRole("heading", { name: "Painel do Administrador" })).toBeVisible();
  });
});
