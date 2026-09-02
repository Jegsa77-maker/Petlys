import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import { cleanupTestUser } from "../tests/rls/helpers";
import { provisionAppReadyUser, type TestUser } from "./helpers/fixtures";

/**
 * Mapa visual na busca (feature entregue nesta sessão). Confirma que o
 * toggle Lista/Mapa realmente troca a visualização e que o mapa (Leaflet)
 * monta de verdade no DOM — não testa o conteúdo dos tiles em si (rede
 * externa do OpenStreetMap), só que o componente client-only carrega.
 */
test.describe("Busca — alternar lista/mapa", () => {
  let tutor: TestUser;

  test.beforeAll(async () => {
    tutor = await provisionAppReadyUser(["tutor"], "e2e-mapa");
  });

  test.afterAll(async () => {
    await cleanupTestUser(tutor.id);
  });

  test("alterna pra visão de mapa e volta pra lista", async ({ page }) => {
    await loginAs(page, tutor.email);
    await page.getByRole("button", { name: "Entrar como Tutor" }).click();
    await page.goto("/buscar");

    await expect(page.locator("li").first()).toBeVisible();

    await page.getByRole("button", { name: "Mapa" }).click();
    await expect(page.locator(".leaflet-container")).toBeVisible();

    await page.getByRole("button", { name: "Lista" }).click();
    await expect(page.locator(".leaflet-container")).not.toBeVisible();
    await expect(page.locator("li").first()).toBeVisible();
  });
});
