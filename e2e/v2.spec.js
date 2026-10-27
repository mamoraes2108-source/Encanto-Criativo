import { test, expect } from "@playwright/test";
import sharp from "sharp";
test("pedido V2: edição, custo histórico, coleções, sinal, arte, cancelamento e estorno", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) =>
    d.accept(d.type() === "prompt" ? "Motivo fictício navegador" : undefined),
  );
  await page.goto("/#pedidos");
  await page.getByRole("button", { name: "Novo pedido" }).click();
  const initial = await (await page.request.get("/api/data")).json();
  const client = initial.clients[0],
    model = initial.catalog[0];
  await page
    .getByRole("combobox", { name: "Cliente", exact: true })
    .selectOption(client.id);
  await page.getByLabel("Data do pedido", { exact: true }).fill("2026-03-01");
  await page.getByLabel("Tema / arte personalizada").fill("Teste V2 navegador");
  await page.getByLabel("Valor total da venda").fill("80");
  await page.getByLabel("Item 1", { exact: true }).selectOption(model.id);
  await page.getByLabel("Venda atribuída ao item 1").fill("80");
  await page.getByLabel("Coleção do item 1").fill("Coleção navegador");
  await page.getByRole("button", { name: "Conferir custos e rateio" }).click();
  await expect(page.locator("#calculation")).toContainText("80,00");
  await page
    .getByRole("button", { name: "Salvar pedido", exact: true })
    .click();
  await expect(page.locator("#notice")).toContainText("Pedido salvo");
  let o = (await (await page.request.get("/api/data")).json()).orders.find(
    (o) => o.theme === "Teste V2 navegador",
  );
  expect(o.cost).toBe(14);
  const open = async () => {
    await page.goto("/#pedidos");
    await page.getByLabel("Pesquisar pedidos").fill("Teste V2 navegador");
    await page.getByRole("button", { name: "Ver", exact: true }).click();
  };
  await open();
  await page.getByRole("button", { name: "Editar pedido" }).click();
  await page.getByLabel("Data do pedido", { exact: true }).fill("2026-07-01");
  await page.getByLabel("Motivo da alteração").fill("Corrige data fictícia");
  await page.getByRole("button", { name: "Conferir e salvar revisão" }).click();
  await expect(page.locator("#notice")).toContainText("Pedido salvo");
  await page.request.post("/api/catalog", {
    data: {
      id: model.id,
      name: model.name,
      type: model.type,
      date: "2026-06-01",
      value: 999,
    },
  });
  await open();
  await page.getByRole("button", { name: "Editar pedido" }).click();
  await page.locator("#financial-edit").check();
  await page.getByLabel("Taxas — total").fill("2");
  await page.getByLabel("Motivo da alteração").fill("Inclui taxa fictícia");
  await page.getByRole("button", { name: "Conferir e salvar revisão" }).click();
  await expect(page.locator("#notice")).toContainText("Pedido salvo");
  o = (await (await page.request.get("/api/data")).json()).orders.find(
    (v) => v.id === o.id,
  );
  expect(o.cost).toBe(16);
  expect(o.lines[0].unit).toBe(14);
  await open();
  await page.getByRole("button", { name: "Recebimentos / estornos" }).click();
  await page.getByLabel("Valor (R$)", { exact: true }).fill("20");
  await page.getByLabel("Data efetiva").fill("2026-07-02");
  await page.getByLabel("Motivo / identificação").fill("Sinal fictício");
  await page
    .getByRole("button", { name: "Conferir e registrar movimento" })
    .click();
  await expect(page.locator("dialog")).toContainText("Parcial");
  const png = await sharp({
    create: { width: 4, height: 4, channels: 3, background: "#b8c3a9" },
  })
    .png()
    .toBuffer();
  await page.locator("#art-upload input[type=file]").setInputFiles({
    name: "arte-ficticia.png",
    mimeType: "image/png",
    buffer: png,
  });
  await page.getByRole("button", { name: "Anexar arte" }).click();
  await expect(page.locator(".art-thumb")).toBeVisible();
  await page.getByRole("button", { name: "Versões e aprovação" }).click();
  await page
    .getByRole("combobox", { name: "Situação" })
    .selectOption("Aprovada");
  await page.getByLabel("Data de aprovação").fill("2026-07-03");
  await page
    .getByRole("textbox", { name: "Motivo", exact: true })
    .fill("Aprovação fictícia");
  await page.getByRole("button", { name: "Salvar situação da arte" }).click();
  await expect(page.locator("dialog")).toContainText("Aprovada em 03/07/2026");
  await page.getByRole("button", { name: "Cancelar pedido" }).click();
  await expect(page.locator("#notice")).toContainText(
    "Cancelamento registrado",
  );
  await page.getByLabel("Filtrar status").selectOption("Cancelado");
  await page.getByLabel("Pesquisar pedidos").fill("Teste V2 navegador");
  await page.getByRole("button", { name: "Ver", exact: true }).click();
  await expect(page.locator("dialog")).toContainText("a devolver");
  await page.getByRole("button", { name: "Recebimentos / estornos" }).click();
  await page
    .getByRole("combobox", { name: "Movimento", exact: true })
    .selectOption("refund");
  await page.getByLabel("Valor (R$)", { exact: true }).fill("20");
  await page.getByLabel("Data efetiva").fill("2026-07-04");
  await page.getByLabel("Motivo / identificação").fill("Estorno fictício");
  const payments = (await (await page.request.get("/api/v2/data")).json())
    .payments;
  await page
    .getByRole("combobox", { name: "Recebimento original", exact: false })
    .selectOption(
      payments.find((p) => p.orderId === o.id && p.type === "receipt").id,
    );
  await page
    .getByRole("button", { name: "Conferir e registrar movimento" })
    .click();
  await expect(page.locator("dialog")).not.toContainText("a devolver");
  expect(errors).toEqual([]);
});
test("backup pelo navegador, restauração em nova pasta e simulador por margem", async ({
  page,
}) => {
  page.on("dialog", (d) =>
    d.accept(d.type() === "prompt" ? "Motivo fictício navegador" : undefined),
  );
  await page.goto("/#backups");
  await page.getByRole("button", { name: "Criar e baixar backup" }).click();
  const link = page.getByRole("link", {
    name: "Clique aqui para baixar o arquivo privado.",
  });
  await expect(link).toBeVisible();
  const response = await page.request.get(await link.getAttribute("href"));
  expect(response.ok()).toBeTruthy();
  await page.locator("#restore-file").setInputFiles({
    name: "backup.zip",
    mimeType: "application/zip",
    buffer: await response.body(),
  });
  await page.getByRole("button", { name: "Conferir backup" }).click();
  await expect(page.locator("#restore-result")).toContainText(
    "integridade verificada",
  );
  await page
    .getByRole("button", { name: "Restaurar cópia em pasta nova" })
    .click();
  await expect(page.locator("#restore-result")).toContainText(
    "O banco ativo não foi alterado",
  );
  await page.goto("/#orcamento");
  await page.getByLabel("Custo unitário dos materiais").fill("30");
  await page.locator("#margin-form [name=quantity]").fill("2");
  await page.getByLabel("Margem bruta desejada").fill("40");
  await page.getByRole("button", { name: "Sugerir preço" }).click();
  await expect(page.locator("#margin-result")).toContainText("100,00");
  await expect(page.locator("#margin-result")).toContainText("40%");
  await page.goto("/#painel");
  await page
    .getByRole("combobox", { name: "Métrica das coleções" })
    .selectOption("profit");
  await expect(
    page.getByRole("columnheader", { name: "Edições anuais" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Evolução mensal por coleção" }),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#pedidos");
  await expect(
    page.getByRole("combobox", { name: "Alertas de entrega" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});

test("alertas respeitam calendário local e não atrasam concluídos ou cancelados", async ({
  browser,
}) => {
  const context = await browser.newContext({
    timezoneId: "America/Sao_Paulo",
    locale: "pt-BR",
  });
  const page = await context.newPage();
  try {
    await page.clock.install({ time: new Date("2026-07-01T01:00:00Z") });
    await page.goto("/#pedidos");
    await expect(
      page.getByRole("button", { name: "Novo pedido" }),
    ).toBeVisible();
    const d = await (await page.request.get("/api/data")).json();
    const make = async (theme, delivery, status = "Aberto") => {
      const r = await page.request.post("/api/v2/orders", {
        data: {
          clientId: d.clients[0].id,
          date: "2026-01-02",
          delivery,
          status,
          unit: "Peças",
          amount: 1,
          printing: 0,
          fees: 0,
          shipping: 0,
          expenses: [],
          discount: 0,
          total: 50,
          theme,
          lines: [
            {
              key: "m",
              id: d.catalog.find((c) => c.type === "Modelo").id,
              quantity: 1,
              sale: 50,
              collection: "Alertas",
            },
          ],
          demo: true,
        },
      });
      expect(r.ok()).toBeTruthy();
      return r.json();
    };
    await make("Alerta fictício atrasado", "2026-06-29");
    await make("Alerta fictício próximo", "2026-07-02");
    await make("Alerta fictício sem data", "");
    await make("Alerta fictício concluído", "2026-01-03", "Entregue");
    const cancelled = await make("Alerta fictício cancelado", "2026-01-03");
    await page.request.post(`/api/v2/orders/${cancelled.id}/cancel`, {
      data: {
        revision: 0,
        reason: "Teste alerta",
        confirmation: "CONFIRMAR CANCELAMENTO",
      },
    });
    await page.reload();
    await page.getByLabel("Pesquisar pedidos").fill("Alerta fictício");
    await page
      .getByRole("combobox", { name: "Alertas de entrega" })
      .selectOption("Atrasado");
    await expect(page.locator("#order-list")).toContainText(
      "Alerta fictício atrasado",
    );
    await expect(page.locator("#order-list")).not.toContainText("concluído");
    await expect(page.locator("#order-list")).not.toContainText("cancelado");
    await expect(page.locator("#order-list")).not.toContainText("próximo");
    await page
      .getByRole("combobox", { name: "Alertas de entrega" })
      .selectOption("Entrega próxima");
    await expect(page.locator("#order-list")).toContainText(
      "Alerta fictício próximo",
    );
    await page
      .getByRole("combobox", { name: "Alertas de entrega" })
      .selectOption("Sem data");
    await expect(page.locator("#order-list")).toContainText(
      "Alerta fictício sem data",
    );
    await page
      .getByRole("combobox", { name: "Alertas de entrega" })
      .selectOption("Concluído");
    await expect(page.locator("#order-list")).toContainText(
      "Alerta fictício concluído",
    );
    await page.getByRole("button", { name: "Novo pedido" }).click();
    await expect(
      page.getByLabel("Data do pedido", { exact: true }),
    ).toHaveValue("2026-06-30");
  } finally {
    await context.close();
  }
});
