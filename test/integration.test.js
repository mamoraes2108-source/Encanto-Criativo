import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import ExcelJS from "exceljs";
const directory = await mkdtemp(join(tmpdir(), "encanto-test-"));
let child,
  base = "http://127.0.0.1:3198";
async function start() {
  child = spawn(process.execPath, ["server.js"], {
    env: { ...process.env, DATA_DIR: directory, PORT: "3198" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise((resolve, reject) => {
    child.stdout.once("data", resolve);
    child.once("exit", (code) => reject(Error("Servidor encerrou: " + code)));
  });
}
async function stop() {
  const ended = once(child, "exit");
  child.kill();
  await ended;
}
async function request(path, body, method = "POST") {
  const r = await fetch(
    base + "/api/" + path,
    body === undefined
      ? {}
      : {
          method,
          headers:
            body instanceof FormData
              ? {}
              : { "Content-Type": "application/json" },
          body: body instanceof FormData ? body : JSON.stringify(body),
        },
  );
  return { status: r.status, body: await r.json() };
}
test("fluxo persistente de clientes, custos, pedidos, exportação e importação", async (t) => {
  try {
    await start();
    let state = (await request("data")).body;
    assert.equal(state.orders.length, 3);
    const client = (await request("clients", { name: "Cliente de teste" }))
      .body;
    const model = (
      await request("catalog", {
        name: "Caneca teste",
        type: "Modelo",
        date: "2026-01-01",
        value: 10,
      })
    ).body;
    const order = (
      await request("orders", {
        clientId: client.id,
        date: "2026-03-01",
        delivery: "2026-03-02",
        quantity: 2,
        lines: [{ id: model.id, quantity: 2 }],
        total: 80,
        printing: 4,
        extra: 1,
        status: "Aberto",
        payment: "Pendente",
        theme: "Teste",
        collection: "Testes",
      })
    ).body;
    assert.equal(order.cost, 25);
    assert.equal(order.profit, 55);
    assert.equal(
      (
        await request("catalog", {
          id: model.id,
          name: model.name,
          type: model.type,
          date: "2026-04-01",
          value: 30,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await request("catalog", {
          id: model.id,
          name: model.name,
          type: model.type,
          date: "2026-04-01",
          value: 99,
        })
      ).status,
      400,
    );
    const receipt = await request("v2/orders/" + order.id + "/payments", {
      revision: 0,
      type: "receipt",
      value: 80,
      date: "2026-03-01",
      method: "Pix",
      reason: "Pagamento fictício comprovado",
    });
    assert.equal(receipt.status, 200);
    await request(
      "orders/" + order.id,
      { status: "Em produção", payment: "Pago" },
      "PATCH",
    );
    await stop();
    await start();
    state = (await request("data")).body;
    const stored = state.orders.find((o) => o.id === order.id);
    assert.equal(stored.cost, 25);
    assert.equal(stored.status, "Em produção");
    assert.equal(stored.payment, "Pago");
    const exportResponse = await fetch(base + "/api/export");
    assert.equal(exportResponse.status, 200);
    const exported = new ExcelJS.Workbook();
    await exported.xlsx.load(await exportResponse.arrayBuffer());
    assert.equal(exported.getWorksheet("Pedidos").rowCount, 2);
    assert.equal(exported.getWorksheet("Custos").rowCount, 8);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Pedidos");
    sheet.addRow([
      "Cliente",
      "Pedido",
      "Entrega",
      "Peças",
      "Venda",
      "Custo",
      "Status",
      "Pagamento",
      "Modelo",
      "ID",
    ]);
    sheet.addRow([
      "Pessoa fictícia importada",
      new Date("2026-05-01T12:00:00Z"),
      "2026-05-02",
      2,
      90,
      32,
      "Aberto",
      "Pendente",
      "Xícara",
      "TEST-001",
    ]);
    workbook.addWorksheet("Resumo").addRow(["Resumo original"]);
    workbook.addWorksheet("Custos").addRow(["Custos originais"]);
    const f = new FormData();
    f.append(
      "file",
      new Blob([await workbook.xlsx.writeBuffer()]),
      "ficticio.xlsx",
    );
    const preview = (await request("import/preview", f)).body;
    assert.equal(preview.sheets.length, 3);
    assert.equal((await request("data")).body.orders.length, 4);
    const body = {
      token: preview.token,
      sheet: "Pedidos",
      header: 1,
      mapping: {
        client: "0",
        date: "1",
        delivery: "2",
        quantity: "3",
        total: "4",
        cost: "5",
        status: "6",
        payment: "7",
        model: "8",
        originalId: "9",
      },
    };
    assert.equal(
      (
        await request("import/check", {
          ...body,
          mapping: { ...body.mapping, cost: "" },
        })
      ).body.rows[0].valid,
      false,
    );
    assert.equal(
      (await request("import/check", body)).body.rows[0].valid,
      true,
    );
    assert.equal((await request("import/confirm", body)).status, 400);
    assert.equal(
      (
        await request("import/confirm", {
          ...body,
          confirmation: "CONFIRMAR IMPORTAÇÃO",
        })
      ).body.count,
      1,
    );
    assert.equal(
      (
        await request("import/confirm", {
          ...body,
          confirmation: "CONFIRMAR IMPORTAÇÃO",
        })
      ).status,
      400,
    );
    const f2 = new FormData();
    f2.append(
      "file",
      new Blob([await workbook.xlsx.writeBuffer()]),
      "ficticio.xlsx",
    );
    const p2 = (await request("import/preview", f2)).body;
    assert.equal(
      (
        await request("import/confirm", {
          ...body,
          token: p2.token,
          confirmation: "CONFIRMAR IMPORTAÇÃO",
        })
      ).status,
      400,
    );
    const attack = await fetch(base + "/api/clients", {
      method: "POST",
      headers: {
        Origin: "https://example.com",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Não salvar" }),
    });
    assert.equal(attack.status, 403);
    assert.equal((await request("data")).body.orders.length, 5);
  } finally {
    if (child?.exitCode === null) await stop();
    await rm(directory, { recursive: true, force: true });
  }
});
