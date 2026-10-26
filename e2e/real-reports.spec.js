import { test, expect } from "@playwright/test";
test("relatórios e Criações favoritas contam 43 reais e ignoram demonstrações e seu caixa", async ({
  page,
}) => {
  const orders = Array.from({ length: 43 }, (_, i) => ({
    id: `ficticio-real-${i}`,
    originalId: `TEST-${i}`,
    demo: false,
    imported: true,
    date: "2026-05-01",
    delivery: "2026-05-02",
    status: "Entregue",
    quantity: 1,
    total: (i === 42 ? 8630 : 8000) / 100,
    cost: (i === 42 ? 7401 : 4000) / 100,
    profit: (i === 42 ? 1229 : 4000) / 100,
    theme: "Tema original",
    collection: "Coleção fictícia conferida",
    clientId: "test-client",
    lines: [{ name: "Criação real fictícia", type: "Modelo", quantity: 1 }],
  }));
  orders.push({
    id: "demo",
    demo: true,
    date: "2026-05-01",
    status: "Aberto",
    quantity: 9999,
    total: 999999,
    cost: 1,
    profit: 999998,
    theme: "Demonstração",
    collection: "Coleção demonstração",
    lines: [{ name: "Criação demonstração", type: "Modelo", quantity: 9999 }],
  });
  await page.route("**/api/data", (route) =>
    route.fulfill({
      json: {
        orders,
        clients: [{ id: "test-client", name: "Cliente fictício" }],
        catalog: [],
      },
    }),
  );
  await page.route("**/api/v2/data", (route) =>
    route.fulfill({
      json: {
        orders: orders.map((o) => ({
          id: o.id,
          received: 0,
          balance: 0,
          refundDue: 0,
          payment: "Pendente",
        })),
        payments: [
          {
            id: "demo-receipt",
            orderId: "demo",
            date: "2026-05-01",
            type: "receipt",
            value: 999999,
            reason: "Recebimento demonstração",
          },
          {
            id: "real-receipt",
            orderId: orders[0].id,
            date: "2026-05-01",
            type: "receipt",
            value: 10,
            reason: "Recebimento fictício real",
            method: "Pix",
          },
        ],
        history: [],
        artworks: [],
      },
    }),
  );
  await page.goto("/#painel");
  const rank = page
    .locator(".panel")
    .filter({ has: page.getByRole("heading", { name: "Criações favoritas" }) });
  await expect(rank).toContainText("Criação real fictícia");
  await expect(rank).toContainText("43 peças");
  await expect(rank).not.toContainText("Criação demonstração");
  await expect(page.locator(".cards").first()).toContainText("3.446,30");
  await expect(page.locator(".cards").first()).toContainText("1.692,29");
  await expect(page.locator(".collection-panel")).toContainText(
    "Coleção fictícia conferida",
  );
  await expect(page.locator(".collection-panel")).not.toContainText(
    "Coleção demonstração",
  );
  await expect(page.locator(".cash-cards")).toContainText("10,00");
  await expect(page.locator(".cash-cards")).not.toContainText("999.999");
  await page.goto("/#relatorios");
  await expect(page.locator("#content")).toContainText("1.754,01");
  await expect(page.locator("#content")).toContainText(
    "Recebimento fictício real",
  );
  await expect(page.locator("#content")).not.toContainText(
    "Recebimento demonstração",
  );
});
