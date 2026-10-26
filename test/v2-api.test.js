import { request as httpRequest } from "node:http";
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import ExcelJS from "exceljs";
let child;
const root = await mkdtemp(path.join(tmpdir(), "encanto-v2-api-")),
  base = "http://127.0.0.1:3201";
let cookie;
async function req(p, body, method = "POST", useCookie = true) {
  const headers = {};
  if (useCookie && cookie) headers.Cookie = cookie;
  if (body !== undefined && !(body instanceof FormData))
    headers["Content-Type"] = "application/json";
  const r = await fetch(base + "/api/" + p, {
    method: body === undefined ? "GET" : method,
    headers,
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  });
  return { status: r.status, body: await r.json() };
}
test("V2 integra revisões auditáveis, caixa, cancelamento, clientes, anexos privados e backups", async () => {
  try {
    child = spawn(process.execPath, ["server.js"], {
      env: { ...process.env, DATA_DIR: root, PORT: "3201" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    await new Promise((resolve, reject) => {
      child.stdout.once("data", resolve);
      child.once("exit", (c) => reject(Error("Servidor encerrou " + c)));
    });
    const session = await fetch(base + "/api/session");
    cookie = session.headers.get("set-cookie").split(";")[0];
    const initial = (await req("data")).body;
    const historical = initial.orders.find((o) => o.payment === "Pago");
    const metadata = await req(
      "v2/orders/" + historical.id,
      {
        revision: 0,
        financial: false,
        reason: "Conferência fictícia sem recalcular",
        draft: { ...historical, notes: "Observação fictícia revisada" },
      },
      "PUT",
    );
    assert.equal(metadata.status, 200);
    assert.equal(metadata.body.cost, historical.cost);
    assert.equal(
      (await req("v2/data")).body.orders.find((o) => o.id === historical.id)
        .needsReconciliation,
      true,
    );
    const model = initial.catalog[0],
      client = initial.clients[0];
    const input = {
      clientId: client.id,
      date: "2026-02-01",
      delivery: "",
      theme: "Fictício",
      status: "Aberto",
      unit: "Peças",
      amount: 2,
      piecesPerKit: 1,
      total: 100,
      discount: 0,
      printing: 2,
      fees: 1,
      shipping: 1,
      expenses: [{ description: "Etiqueta", value: 1 }],
      lines: [
        { key: "a", id: model.id, quantity: 1, sale: 60, collection: "Natal" },
        { key: "b", id: model.id, quantity: 1, sale: 40, collection: "Afeto" },
      ],
      demo: false,
    };
    let r = await req("v2/orders", input);
    assert.equal(r.status, 200);
    let order = r.body;
    assert.equal(order.cost, 33);
    const id = order.id;
    assert.equal(
      (
        await req(
          "v2/orders/" + id,
          {
            revision: 0,
            financial: true,
            draft: input,
            reason: "sem confirmação",
          },
          "PUT",
        )
      ).status,
      400,
    );
    let pay = await req("v2/orders/" + id + "/payments", {
      revision: 0,
      type: "receipt",
      value: 30,
      date: "2026-02-02",
      method: "Pix",
      reason: "Sinal fictício",
      label: "Sinal",
    });
    assert.equal(pay.status, 200);
    const receipt = pay.body;
    assert.equal(
      (
        await req("v2/orders/" + id + "/payments", {
          revision: 0,
          type: "receipt",
          value: 1,
          date: "2026-02-02",
          method: "Pix",
          reason: "janela antiga",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await req("v2/orders/" + id + "/payments", {
          revision: 1,
          type: "receipt",
          value: 71,
          date: "2026-02-02",
          method: "Pix",
          reason: "excede saldo",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await req(
          "orders/" + id,
          { status: "Aberto", payment: "Pago" },
          "PATCH",
        )
      ).status,
      400,
    );
    let next = { ...input, date: "2026-08-01", lines: input.lines, total: 100 };
    r = await req(
      "v2/orders/" + id,
      {
        revision: 1,
        financial: true,
        confirmation: "CONFIRMAR REVISÃO FINANCEIRA",
        reason: "Correção fictícia",
        draft: next,
      },
      "PUT",
    );
    assert.equal(r.status, 200);
    order = r.body;
    assert.equal(order.cost, 33);
    assert.equal(order.revision, 2);
    const hist = (await req("v2/data")).body.history.filter(
      (h) => h.orderId === id,
    );
    assert.equal(hist.length, 2);
    assert.equal(hist.at(-1).before.date, "2026-02-01");
    assert.equal(hist.at(-1).after.date, "2026-08-01");
    assert.equal(
      (
        await req(
          "v2/orders/" + id,
          {
            revision: 2,
            financial: true,
            confirmation: "CONFIRMAR REVISÃO FINANCEIRA",
            reason: "Abaixo do recebido",
            draft: { ...next, total: 20, discount: 80 },
          },
          "PUT",
        )
      ).status,
      400,
    );
    const collections = (await req("v2/collections")).body;
    assert.equal(collections.find((c) => c.name === "Natal").total, 60);
    r = await req("clients", {
      name: "Teste A",
      phone: "(11) 99999-0000",
      email: "teste@example.invalid",
    });
    assert.equal(r.status, 200);
    assert.equal(
      (
        await req("clients", {
          name: "Teste B",
          phone: "11999990000",
          email: "",
        })
      ).status,
      400,
    );
    assert.equal(
      (await req("v2/clients/check", { phone: "11999990000" })).body.matches
        .length,
      1,
    );
    const png = await sharp({
      create: { width: 3, height: 3, channels: 3, background: "#b8c3a9" },
    })
      .png()
      .toBuffer();
    const f = new FormData();
    f.append("file", new Blob([png]), "arte.png");
    assert.equal((await req("v2/orders/" + id + "/artworks", f)).status, 200);
    const art = (await req("v2/data")).body.artworks[0];
    assert.equal(
      (await fetch(base + `/api/v2/orders/${id}/artworks/${art.id}/file`))
        .status,
      403,
    );
    const img = await fetch(
      base + `/api/v2/orders/${id}/artworks/${art.id}/file`,
      { headers: { Cookie: cookie } },
    );
    assert.equal(img.status, 200);
    assert.ok((await img.arrayBuffer()).byteLength > 0);
    assert.equal(
      (
        await fetch(
          base +
            `/api/v2/orders/${initial.orders[0].id}/artworks/${art.id}/file`,
          { headers: { Cookie: cookie } },
        )
      ).status,
      400,
    );
    const fake = new FormData();
    fake.append("file", new Blob(["<script>evil</script>"]), "fake.png");
    assert.equal(
      (await req("v2/orders/" + id + "/artworks", fake)).status,
      400,
    );
    assert.equal(
      (
        await req(
          `v2/orders/${id}/artworks/${art.id}`,
          { version: 0, status: "Aprovada", reason: "Conferência" },
          "PATCH",
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await req(
          `v2/orders/${id}/artworks/${art.id}`,
          {
            version: 0,
            status: "Aprovada",
            reason: "Aprovação fictícia",
            approvedOn: "2026-08-02",
          },
          "PATCH",
        )
      ).status,
      200,
    );
    r = await req("v2/backups", {});
    assert.equal(r.status, 200);
    const zipped = await (
      await fetch(base + "/api/v2/backups/" + r.body.id, {
        headers: { Cookie: cookie },
      })
    ).arrayBuffer();
    const backupForm = new FormData();
    backupForm.append("file", new Blob([zipped]), "backup.zip");
    r = await req("v2/restore/preview", backupForm);
    assert.equal(r.status, 200);
    r = await req("v2/restore/confirm", {
      token: r.body.token,
      confirmation: "RESTAURAR EM NOVA PASTA",
    });
    assert.equal(r.status, 200);
    assert.ok(r.body.directory.startsWith(root));
    assert.ok(
      (await readFile(path.join(r.body.directory, "artworks", art.filename)))
        .length > 0,
    );
    assert.equal(
      (
        await req("v2/orders/" + id + "/cancel", {
          revision: 2,
          reason: "Cancelamento fictício",
          confirmation: "CONFIRMAR CANCELAMENTO",
        })
      ).status,
      200,
    );
    let summary = (await req("v2/data")).body.orders.find((o) => o.id === id);
    assert.equal(summary.refundDue, 30);
    assert.equal(summary.balance, 0);
    assert.equal(
      (
        await req("v2/orders/" + id + "/payments", {
          revision: 3,
          type: "refund",
          value: 31,
          date: "2026-08-03",
          method: "Pix",
          reason: "excesso",
          receiptId: receipt.id,
          confirmation: "CONFIRMAR ESTORNO",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await req("v2/orders/" + id + "/payments", {
          revision: 3,
          type: "refund",
          value: 30,
          date: "2026-08-03",
          method: "Pix",
          reason: "Devolução fictícia",
          receiptId: receipt.id,
          confirmation: "CONFIRMAR ESTORNO",
        })
      ).status,
      200,
    );
    summary = (await req("v2/data")).body.orders.find((o) => o.id === id);
    assert.equal(summary.refundDue, 0);
    assert.equal(
      (await req("v2/collections")).body.some((c) => c.name === "Natal"),
      false,
    );
    const rebinding = await new Promise((resolve, reject) => {
      const r = httpRequest(
        base + "/api/data",
        { headers: { Host: "evil.example" } },
        (response) => {
          response.resume();
          resolve(response.statusCode);
        },
      );
      r.on("error", reject);
      r.end();
    });
    assert.equal(rebinding, 403);
    // Materiais: sem inferência de categoria ou vigência, preserva versões.
    const w = new ExcelJS.Workbook(),
      s = w.addWorksheet("Custos");
    s.addRow(["Item", "Categoria", "Custo", "Vigência"]);
    s.addRow(["Material fictício", "Complemento", 2.5, "2026-01-01"]);
    const file = new FormData();
    file.append(
      "file",
      new Blob([await w.xlsx.writeBuffer()]),
      "materiais.xlsx",
    );
    const token = (await req("import/preview", file)).body.token;
    const body = {
      token,
      sheet: "Custos",
      header: 1,
      mapping: { name: "0", type: "1", value: "2", date: "3" },
    };
    assert.equal(
      (await req("import/materials/check", body)).body.rows[0].valid,
      true,
    );
    assert.equal((await req("import/materials/confirm", body)).status, 400);
    assert.equal(
      (
        await req("import/materials/confirm", {
          ...body,
          confirmation: "CONFIRMAR IMPORTAÇÃO DE MATERIAIS",
        })
      ).body.count,
      1,
    );
  } finally {
    if (child?.exitCode === null) {
      const done = once(child, "exit");
      child.kill();
      await done;
    }
    await rm(root, { recursive: true, force: true });
  }
});
