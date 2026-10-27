import { test, expect } from "@playwright/test";
import ExcelJS from "exceljs";
test("V3: coleções comparam campanhas anuais e respeitam filtros e margem", async ({
  page,
}) => {
  await page.goto("/");
  const create = async (p, data) => {
    const r = await page.request.post("/api/" + p, { data });
    expect(r.ok()).toBeTruthy();
    return r.json();
  };
  const initial = await (await page.request.get("/api/data")).json();
  const model = await create("catalog", {
    name: "Modelo campanha anual fictícia",
    type: "Modelo",
    value: 8,
    date: "2025-01-01",
  });
  for (const [date, total] of [
    ["2025-10-01", 100],
    ["2026-10-01", 150],
  ])
    await create("v2/orders", {
      clientId: initial.clients[0].id,
      date,
      delivery: date,
      theme: "Campanha anual fictícia",
      status: "Entregue",
      amount: 1,
      unit: "Peças",
      total,
      discount: 0,
      printing: 0,
      fees: 0,
      shipping: 0,
      expenses: [],
      lines: [
        {
          key: "annual",
          id: model.id,
          quantity: 1,
          sale: total,
          collection: "Campanha anual comparável fictícia",
        },
      ],
    });
  await page.reload();
  await page.getByLabel("Início do período").fill("2025-10-01");
  await page.getByLabel("Fim do período").fill("2026-10-31");
  await page
    .locator("#collection-choice")
    .selectOption("Campanha anual comparável fictícia");
  await page.locator("#collection-metric").selectOption("margin");
  await expect(page.locator("#collection-table")).toContainText(
    "2025: R$ 100,00",
  );
  await expect(page.locator("#collection-table")).toContainText(
    "2026: R$ 150,00",
  );
  await expect(page.locator("#collection-table")).toContainText(
    "50.0% ante 2025",
  );
  await expect(page.locator("#collection-table tbody tr")).toHaveCount(1);
  await page.getByLabel("Início do período").fill("2026-01-01");
  await expect(page.locator("#collection-table")).not.toContainText("2025:");
  await expect(page.locator("#collection-table")).toContainText(
    "Sem outra edição anual",
  );
});
test("V3: despesas, lucro e caixa, calendário, ranking, margem e PDF comercial", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept());
  await page.goto("/");
  const create = async (p, data) => {
    const r = await page.request.post("/api/" + p, { data });
    expect(r.ok()).toBeTruthy();
    return r.json();
  };
  const client = await create("clients", {
    name: "Cliente V3 fictícia",
    phone: "",
    email: "",
  });
  const model = await create("catalog", {
    name: "Caneca V3 fictícia",
    type: "Modelo",
    value: 8,
    date: "2026-01-01",
  });
  const order = await create("v2/orders", {
    clientId: client.id,
    date: "2026-10-01",
    delivery: "2026-10-20",
    theme: "Arte V3 fictícia",
    status: "Aberto",
    unit: "Peças",
    amount: 1,
    piecesPerKit: 1,
    total: 30,
    discount: 0,
    printing: 0,
    fees: 0,
    shipping: 0,
    expenses: [{ description: "Uber incluído fictício", value: 2 }],
    lines: [
      {
        key: "v3",
        id: model.id,
        quantity: 1,
        sale: 30,
        collection: "Natal V3 fictício",
      },
    ],
  });
  await create("v2/orders/" + order.id + "/payments", {
    revision: 0,
    type: "receipt",
    value: 30,
    date: "2026-10-03",
    method: "Pix",
    reason: "Recebimento fictício",
  });
  await page.goto("/#despesas");
  await page.reload();
  await page.getByRole("button", { name: "Novo lançamento" }).click();
  await page.getByLabel("Data", { exact: true }).fill("2026-10-01");
  await page.getByLabel("Descrição", { exact: true }).fill("Dez canecas V3");
  await page.getByLabel("Categoria", { exact: true }).last().fill("Compra V3");
  await page.getByLabel("Valor total (R$)", { exact: true }).fill("80");
  await page.locator("#expense-form [name=status]").selectOption("Pago");
  await page.getByLabel("Data do pagamento (se pago)").fill("2026-10-02");
  await page.getByLabel("Forma de pagamento (se pago)").fill("Pix");
  await page.getByRole("button", { name: "Salvar lançamento" }).click();
  await expect(page.locator("#notice")).toContainText("Lançamento salvo");
  await page.getByRole("link", { name: "Painel inicial" }).click();
  await page.getByLabel("Início do período").fill("2026-10-01");
  await page.getByLabel("Fim do período").fill("2026-10-31");
  await page.locator("#finance-category").selectOption("Compra V3");
  await expect(page.locator("#finance-cards")).toContainText("80,00");
  await page.getByLabel("Ordenar coleções favoritas").selectOption("profit");
  await expect(page.locator("#favorite-bars")).toContainText(
    "Natal V3 fictício",
  );
  await page.getByRole("link", { name: "Agenda", exact: false }).click();
  await page.locator("#agenda-month").fill("2026-10");
  await expect(
    page.locator(".calendar-event").filter({ hasText: client.name }),
  ).toBeVisible();
  await page
    .locator(".calendar-event")
    .filter({ hasText: client.name })
    .click();
  await expect(page.locator("dialog")).toContainText(
    "Conferência do resultado gerencial",
  );
  await page
    .getByRole("button", { name: "Gerar Pedido de Compra (PDF)", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Gerar Pedido de Compra (PDF)", exact: true })
    .click();
  const download = page.waitForEvent("download");
  await page
    .getByRole("link", { name: "Baixar Pedido de Compra (PDF)" })
    .click();
  expect((await download).suggestedFilename()).toBe("Pedido-Encanto.pdf");
  await page
    .getByRole("button", { name: "Preparar mensagem de WhatsApp" })
    .click();
  await expect(page.locator("#document-ready textarea")).toHaveValue(
    /Cliente V3 fictícia/,
  );
  await page.getByRole("button", { name: "Fechar janela" }).click();
  await page.getByRole("link", { name: "Agenda", exact: false }).click();
  await page
    .locator(".calendar-event")
    .filter({ hasText: client.name })
    .click();
  await page.getByRole("button", { name: "Editar pedido" }).click();
  await page.getByLabel("Data de entrega (opcional)").fill("2026-10-22");
  await page.locator("#v2-order-form [name=status]").selectOption("Pronto");
  await page
    .getByLabel("Motivo da alteração")
    .fill("Reagenda entrega fictícia");
  await page.getByRole("button", { name: "Conferir e salvar revisão" }).click();
  const event = page
    .locator(".calendar-event")
    .filter({ hasText: client.name });
  await expect(event).toContainText("Pronto");
  await expect(event.locator("..").locator("strong").first()).toHaveText("22");
  await page.getByRole("link", { name: "Clientes", exact: false }).click();
  await page.getByLabel("Pesquisar clientes").fill(client.name);
  await expect(page.locator("#client-list")).toContainText("30,00");
  await expect(page.locator("#client-list")).toContainText("01/10/2026");
  await page.getByRole("link", { name: "Configurações", exact: false }).click();
  await page.getByLabel("Limite de margem baixa (%)").fill("99");
  await page.getByRole("button", { name: "Salvar configurações" }).click();
  await expect(page.locator("#notice")).toContainText("Configurações salvas");
  await page
    .getByRole("link", { name: "Pedidos", exact: false })
    .first()
    .click();
  await page.getByRole("button", { name: "Novo pedido" }).click();
  await page
    .getByRole("combobox", { name: "Cliente", exact: true })
    .selectOption(client.id);
  await page.getByLabel("Data do pedido", { exact: true }).fill("2026-10-02");
  await page.getByLabel("Valor total da venda").fill("10");
  await page.getByLabel("Item 1", { exact: true }).selectOption(model.id);
  await page.getByLabel("Venda atribuída ao item 1").fill("10");
  await page.getByRole("button", { name: "Conferir custos e rateio" }).click();
  await expect(page.locator("#calculation")).toContainText(
    "abaixo do limite de 99%",
  );
  expect(errors).toEqual([]);
});
test("V3: importa somente Custos com vigências, prévia e backup; retira fictícios com confirmação", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#importar");
  const initial = await (await page.request.get("/api/data")).json();
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Custos");
  sheet.addRow(["Nome", "Categoria", "Custo", "Vigência"]);
  sheet.addRow(["Embalagem V3 fictícia", "Embalagem", 2, "2026-01-01"]);
  sheet.addRow(["Embalagem V3 fictícia", "Embalagem", 3, "2026-12-01"]);
  await page.getByLabel("Arquivo Excel").setInputFiles({
    name: "custos-ficticios.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(await wb.xlsx.writeBuffer()),
  });
  await page.getByRole("button", { name: "Ler e pré-visualizar" }).click();
  await page.locator("#sheet").selectOption("Custos");
  for (const [k, v] of Object.entries({
    name: "0",
    type: "1",
    value: "2",
    date: "3",
  }))
    await page.locator(`[data-material="${k}"]`).selectOption(v);
  await page.getByRole("button", { name: "Conferir materiais" }).click();
  await expect(page.locator("#material-result")).toContainText(
    "Embalagem V3 fictícia",
  );
  await page.locator("#materials-consent").check();
  await page
    .getByRole("button", { name: "Confirmar importação de materiais" })
    .click();
  await expect(page.locator("#notice")).toContainText("Materiais importados");
  const after = await (await page.request.get("/api/data")).json();
  expect(after.orders).toEqual(initial.orders);
  expect(
    after.catalog.find((c) => c.name === "Embalagem V3 fictícia").prices,
  ).toHaveLength(2);
  await page.getByRole("link", { name: "Custos e preços" }).click();
  await page.getByRole("button", { name: "Conferir itens fictícios" }).click();
  await expect(page.locator("#retire-form")).toContainText("preservar");
  await page.locator("#retire-form [name=ids]").first().check();
  await page
    .locator("#retire-form [name=confirmation]")
    .fill("ARQUIVAR SOMENTE ITENS FICTÍCIOS");
  await page
    .getByRole("button", { name: "Criar backup e arquivar selecionados" })
    .click();
  await expect(page.locator("#notice")).toContainText("Backup verificado");
  expect((await (await page.request.get("/api/data")).json()).orders).toEqual(
    initial.orders,
  );
  expect(errors).toEqual([]);
});
