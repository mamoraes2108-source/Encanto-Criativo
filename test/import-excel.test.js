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
  base = "http://127.0.0.1:3196";
async function start() {
  child = spawn(process.execPath, ["server.js"], {
    env: { ...process.env, DATA_DIR: directory, PORT: "3196" },
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
test("Excel: 43 IDs, vazios, fórmulas e reimportação sem alterar finanças", async () => {
  try {
    await start();
    const before = (await request("data")).body;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Pedidos");
    sheet.addRow([
      "ID",
      "Cliente",
      "Data",
      "Entrega",
      "Quantidade",
      "Venda",
      "Custo",
      "Status",
      "Pagamento",
      "Modelo",
    ]);
    for (let i = 1; i <= 43; i++)
      sheet.addRow([
        `PED-${i}`,
        "Cliente fictício",
        "2026-05-01",
        "2026-05-02",
        2,
        90.17,
        32.09,
        "Aberto",
        "Pendente",
        "Xícara",
      ]);
    sheet.getCell("B45").value = "   ";
    sheet.getCell("F46").value = { formula: 'IF(A46="", "", 100)' };
    sheet.getCell("F47").value = { formula: 'IF(A47="", "", 100)', result: "" };
    sheet.getCell("F48").value = { formula: "SUM(A48:E48)", result: 0 };
    sheet.getCell("A49").font = { bold: true };
    const mapping = Object.fromEntries(
      [
        "originalId",
        "client",
        "date",
        "delivery",
        "quantity",
        "total",
        "cost",
        "status",
        "payment",
        "model",
      ].map((k, i) => [k, String(i)]),
    );
    async function preview() {
      const f = new FormData();
      f.append(
        "file",
        new Blob([await workbook.xlsx.writeBuffer()]),
        "ficticio.xlsx",
      );
      const p = await request("import/preview", f);
      assert.equal(p.status, 200);
      return { token: p.body.token, sheet: "Pedidos", header: 1, mapping };
    }
    sheet.getCell("C2").value = "16//09/2026";
    sheet.getCell("D2").value = "2026-10-06";
    sheet.getCell("H2").value = "Agendado";
    const body = await preview();
    const checked = (await request("import/check", body)).body.rows;
    assert.equal(checked.length, 43);
    assert.equal(checked[0].date, "2026-09-16");
    assert.equal(checked[0].originalDate, "16//09/2026");
    assert.equal(checked[0].status, "Aberto");
    assert.equal(checked[0].originalStatus, "Agendado");
    assert.equal(checked[0].warnings.length, 2);
    assert.ok(
      checked.every(
        (r) =>
          r.valid &&
          r.total === 90.17 &&
          r.cost === 32.09 &&
          r.profit === 58.08,
      ),
    );
    assert.deepEqual((await request("data")).body.orders, before.orders);
    const missing = (
      await request("import/check", {
        ...body,
        mapping: { ...mapping, originalId: "" },
      })
    ).body.rows;
    assert.ok(
      missing.every((r) => !r.valid && /ID original ausente/.test(r.error)),
    );
    const confirmed = await request("import/confirm", {
      ...body,
      confirmation: "CONFIRMAR IMPORTAÇÃO",
      acceptCachedFormulas: true,
    });
    assert.equal(confirmed.status, 200);
    assert.equal(confirmed.body.count, 43);
    const stored = (await request("data")).body.orders;
    assert.equal(stored.length, before.orders.length + 43);
    assert.deepEqual(
      stored.filter((r) => !r.imported),
      before.orders,
    );
    const imported = stored.filter((r) => r.imported);
    assert.equal(new Set(imported.map((r) => r.originalId)).size, 43);
    assert.equal(
      imported.reduce((n, r) => n + Math.round(r.total * 100), 0),
      43 * 9017,
    );
    assert.equal(
      imported.reduce((n, r) => n + Math.round(r.cost * 100), 0),
      43 * 3209,
    );
    const again = await preview();
    assert.ok(
      (await request("import/check", again)).body.rows.every(
        (r) => !r.valid && /já cadastrado/.test(r.error),
      ),
    );
    assert.equal(
      (
        await request("import/confirm", {
          ...again,
          confirmation: "CONFIRMAR IMPORTAÇÃO",
          acceptCachedFormulas: true,
        })
      ).status,
      400,
    );
    sheet.getCell("A2").value = "NOVO";
    sheet.getCell("A3").value = "NOVO";
    const repeated = (await request("import/check", await preview())).body.rows;
    assert.ok(
      repeated.slice(0, 2).every((r) => !r.valid && /repetido/.test(r.error)),
    );
    sheet.getCell("B3").value = "";
    const invalidRepeated = (await request("import/check", await preview()))
      .body.rows;
    assert.ok(
      invalidRepeated
        .slice(0, 2)
        .every((r) => !r.valid && /repetido/.test(r.error)),
    );
    assert.deepEqual((await request("data")).body.orders, stored);
    await stop();
    await start();
    assert.ok(
      (await request("import/check", await preview())).body.rows
        .slice(2)
        .every((r) => /já cadastrado/.test(r.error)),
    );
  } finally {
    if (child?.exitCode === null) await stop();
    await rm(directory, { recursive: true, force: true });
  }
});
