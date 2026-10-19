import { test, expect } from "@playwright/test";
test("navegação, cadastro, pedido, custo histórico e experiência móvel", async ({
  page,
}) => {
  page.on("dialog", (dialog) => dialog.accept());
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Um olhar para o seu negócio" }),
  ).toBeVisible();
  await expect(page.getByText("Ambiente de testes")).toBeVisible();
  await page.getByRole("link", { name: "Clientes", exact: false }).click();
  await page.getByRole("button", { name: "Novo cliente" }).click();
  const client = "Cliente fictício navegador " + Date.now();
  await page.getByLabel("Nome", { exact: true }).fill(client);
  await page.getByRole("button", { name: "Salvar cliente" }).click();
  await expect(page.getByText(client, { exact: true })).toBeVisible();
  await page
    .getByRole("link", { name: "Pedidos", exact: false })
    .first()
    .click();
  await page.getByRole("button", { name: "Novo pedido" }).click();
  await page
    .getByRole("combobox", { name: "Cliente", exact: true })
    .selectOption({ label: client });
  await page.getByLabel("Data do pedido").fill("2026-06-01");
  await page.getByLabel("Data de entrega").fill("2026-06-10");
  await page.getByLabel("Valor total da venda").fill("59");
  await page
    .getByLabel("Item 1", { exact: true })
    .selectOption({ label: "Modelo · Caneca cerâmica 325 ml" });
  await page.getByLabel("Venda atribuída ao item 1").fill("59");
  await page.getByRole("button", { name: "Conferir custos e rateio" }).click();
  await expect(page.locator("#calculation")).toContainText("14,00");
  await expect(page.locator("#calculation")).toContainText("45,00");
  await page.getByRole("button", { name: "Salvar pedido" }).click();
  await expect(page.locator("#notice")).toContainText("Pedido salvo");
  await page.getByLabel("Pesquisar pedidos").fill(client);
  await page.getByRole("button", { name: "Ver", exact: true }).click();
  await expect(page.locator("dialog")).toContainText("Custo total");
  await page.getByRole("button", { name: "Fechar janela" }).click();
  await page.getByRole("link", { name: "Simulador" }).click();
  await expect(
    page.getByRole("heading", { name: "Simular orçamento" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Relatórios" }).click();
  await expect(
    page.getByRole("heading", { name: "Resultados por mês" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Importar Excel" }).click();
  await expect(
    page.getByRole("heading", { name: "Importação com conferência" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#painel");
  await expect(
    page.getByRole("heading", { name: "Um olhar para o seu negócio" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});

test("importação fictícia exige prévia, mapeamento, conferência e autorização", async ({
  page,
}) => {
  await page.goto("/#importar");
  const before = (await (await page.request.get("/api/data")).json()).orders
    .length;
  await page
    .locator("#excel-file")
    .setInputFiles("examples/Vendas_Encanto_DEMO.xlsx");
  await page.getByRole("button", { name: "Ler e pré-visualizar" }).click();
  await expect(
    page.getByRole("heading", { name: "1. Inspecione as abas" }),
  ).toBeVisible();
  await page.locator("#sheet").selectOption("Pedidos");
  const columns = {
    client: "0",
    date: "1",
    delivery: "2",
    model: "3",
    quantity: "4",
    total: "5",
    cost: "6",
    status: "7",
    payment: "8",
    theme: "9",
    collection: "10",
    notes: "11",
  };
  for (const [key, index] of Object.entries(columns))
    await page.locator(`[data-map="${key}"]`).selectOption(index);
  await page
    .getByRole("button", { name: "Conferir todos os registros" })
    .click();
  await expect(page.locator("#checked")).toContainText(
    "2 válidos · 0 com pendências",
  );
  await expect(
    page.getByRole("button", { name: "Confirmar importação local" }),
  ).toBeDisabled();
  expect(
    (await (await page.request.get("/api/data")).json()).orders.length,
  ).toBe(before);
  await page.locator("#consent").check();
  await page
    .getByRole("button", { name: "Confirmar importação local" })
    .click();
  await expect(page.locator("#notice")).toContainText("2 pedidos importados");
  expect(
    (await (await page.request.get("/api/data")).json()).orders.length,
  ).toBe(before + 2);
});
