import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import { cleanupTestUser } from "../tests/rls/helpers";
import { provisionAppReadyUser, type TestUser } from "./helpers/fixtures";

/**
 * Loop completo de favoritar/desfavoritar (features entregues nesta
 * sessão: FavoriteButton + tela dedicada /favoritos). Usa um profissional
 * já existente no seed (precisa ter serviço publicado pra aparecer na
 * busca) — só o tutor é descartável, criado fresco pra não depender de
 * favorito pré-existente de ninguém.
 */
test.describe("Favoritos", () => {
  let tutor: TestUser;

  test.beforeAll(async () => {
    tutor = await provisionAppReadyUser(["tutor"], "e2e-favoritos");
  });

  test.afterAll(async () => {
    await cleanupTestUser(tutor.id);
  });

  test("favoritar na busca, ver em /favoritos, desfavoritar e ver vazio", async ({ page }) => {
    await loginAs(page, tutor.email);
    await page.getByRole("button", { name: "Entrar como Tutor" }).click();
    await page.goto("/buscar");

    const firstCard = page.locator("li").first();
    await expect(firstCard).toBeVisible();

    await page.getByRole("button", { name: "Favoritar" }).first().click();
    await expect(page.getByRole("button", { name: "Remover dos favoritos" }).first()).toBeVisible();
    // O clique atualiza a UI otimisticamente antes da Server Action
    // (startTransition) terminar de gravar — sem esperar, a navegação
    // abaixo pode chegar em /favoritos antes do favorito existir de
    // verdade no banco.
    await page.waitForTimeout(500);

    await page.goto("/favoritos");
    await expect(page.getByRole("heading", { name: "Favoritos" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Remover dos favoritos" })).toBeVisible();

    await page.getByRole("button", { name: "Remover dos favoritos" }).click();
    await page.waitForTimeout(500);
    await page.reload();
    await expect(page.getByText("Você ainda não favoritou nenhum profissional")).toBeVisible();
  });
});
