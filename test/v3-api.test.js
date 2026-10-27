import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { once } from "node:events";
import {
  mkdtemp,
  rm,
  readFile,
  writeFile,
  readdir,
  mkdir,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import ExcelJS from "exceljs";
import { inspectBackup } from "../backup.js";
test("falha de backup bloqueia a abertura para escrita e preserva banco existente sem meta", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "encanto-v3-backup-fail-"));
  const database = path.join(dir, "encanto.sqlite");
  try {
    const db = new DatabaseSync(database);
    db.exec(
      "CREATE TABLE records (kind TEXT,id TEXT PRIMARY KEY,body TEXT NOT NULL)",
    );
    db.prepare("INSERT INTO records VALUES (?,?,?)").run(
      "orders",
      "real",
      '{"id":"real","originalId":"FICTICIO-1"}',
    );
    db.close();
    await mkdir(path.join(dir, "artworks"));
    await writeFile(
      path.join(dir, "artworks", "inesperado.txt"),
      "Conteúdo fictício para testar recusa do backup",
    );
    const before = await readFile(database);
    const child = spawn(process.execPath, ["server.js"], {
      env: { ...process.env, DATA_DIR: dir, PORT: "3206" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (b) => (stderr += b));
    const [code] = await once(child, "exit");
    assert.notEqual(code, 0);
    assert.match(stderr, /anexo inesperado/);
    assert.deepEqual(await readFile(database), before);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("V3 integra 43 históricos intactos, importação só de catálogo, backup, despesas auditadas, configurações e PDF", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "encanto-v3-")),
    base = "http://127.0.0.1:3205";
  let child, cookie;
  const db = new DatabaseSync(path.join(dir, "encanto.sqlite"));
  db.exec(
    "CREATE TABLE records (kind TEXT,id TEXT PRIMARY KEY,body TEXT NOT NULL)",
  );
  const put = (kind, o) =>
    db
      .prepare("INSERT INTO records VALUES(?,?,?)")
      .run(kind, o.id, JSON.stringify(o));
  put("meta", { id: "initialized", version: 2 });
  put("clients", {
    id: "client",
    name: "Cliente Fictícia",
    phone: "",
    email: "",
  });
  put("catalog", {
    id: "demo",
    name: "Chocolate",
    type: "Complemento",
    demo: true,
    prices: [{ date: "2026-01-01", value: 3 }],
  });
  put("catalog", {
    id: "model",
    name: "Modelo real fictício",
    type: "Modelo",
    prices: [{ date: "2026-01-01", value: 8 }],
  });
  for (let i = 0; i < 43; i++)
    put("orders", {
      id: "real-" + i,
      originalId: "TEST-" + i,
      imported: true,
      demo: false,
      clientId: "client",
      date: "2026-10-01",
      delivery: "2026-10-20",
      status: "Entregue",
      payment: "Pago",
      theme: "Arte fictícia",
      collection: "Natal fictício",
      quantity: 1,
      total: i === 42 ? 86.3 : 80,
      cost: i === 42 ? 74.01 : 40,
      profit: i === 42 ? 12.29 : 40,
      lines: [
        { id: "model", type: "Modelo", name: "Caneca fictícia", quantity: 1 },
      ],
    });
  put("payments", {
    id: "receipt",
    orderId: "real-0",
    date: "2026-10-03",
    type: "receipt",
    value: 10,
  });
  put("artworks", {
    id: "art",
    orderId: "real-0",
    name: "Arte fictícia",
    history: [],
  });
  const original = db
    .prepare(
      "SELECT * FROM records WHERE kind IN ('orders','clients','payments','artworks') ORDER BY id",
    )
    .all();
  db.close();
  const req = async (p, b, method = "POST") => {
    const r = await fetch(base + "/api/" + p, {
      method: b === undefined ? "GET" : method,
      headers: {
        ...(b instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body:
        b === undefined
          ? undefined
          : b instanceof FormData
            ? b
            : JSON.stringify(b),
    });
    return { status: r.status, body: await r.json() };
  };
  try {
    child = spawn(process.execPath, ["server.js"], {
      env: { ...process.env, DATA_DIR: dir, PORT: "3205" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let log = "";
    child.stderr.on("data", (b) => (log += b));
    await new Promise((resolve, reject) => {
      child.stdout.once("data", resolve);
      child.once("exit", () => reject(Error(log)));
    });
    cookie = (await fetch(base + "/api/session")).headers
      .get("set-cookie")
      .split(";")[0];
    const before = (await readdir(path.join(dir, "backups"))).find((n) =>
      n.startsWith("antes-v3-"),
    );
    assert.ok(before);
    await inspectBackup(await readFile(path.join(dir, "backups", before)));
    const plan = (await req("v3/catalog/preview", {})).body;
    assert.equal(plan.items.length, 1);
    assert.equal(
      (
        await req("v3/catalog/retire", {
          snapshot: plan.snapshot,
          ids: ["model"],
          confirmation: "ARQUIVAR SOMENTE ITENS FICTÍCIOS",
        })
      ).status,
      400,
    );
    const retired = await req("v3/catalog/retire", {
      snapshot: plan.snapshot,
      ids: ["demo"],
      confirmation: "ARQUIVAR SOMENTE ITENS FICTÍCIOS",
    });
    assert.equal(retired.status, 200);
    await inspectBackup(
      await readFile(path.join(dir, "backups", retired.body.backup)),
    );
    const wb = new ExcelJS.Workbook(),
      sheet = wb.addWorksheet("Custos");
    sheet.addRow(["Nome", "Categoria", "Custo", "Vigência"]);
    sheet.addRow(["Caneca Natal fictícia", "Canecas", 8, "2026-01-01"]);
    sheet.addRow(["Caneca Natal fictícia", "Canecas", 9, "2026-11-01"]);
    sheet.addRow(["Chocolate", "Chocolates", 2, "2026-01-01"]);
    const form = new FormData();
    form.append(
      "file",
      new Blob([await wb.xlsx.writeBuffer()]),
      "custos-ficticios.xlsx",
    );
    const preview = (await req("import/preview", form)).body;
    const mapping = {
      token: preview.token,
      sheet: "Custos",
      header: 1,
      mapping: { name: 0, type: 1, value: 2, date: 3 },
    };
    const check = (await req("import/materials/check", mapping)).body;
    assert.ok(check.rows.every((r) => r.valid));
    assert.equal(
      (
        await req("import/materials/confirm", {
          ...mapping,
          confirmation: "CONFIRMAR IMPORTAÇÃO DE MATERIAIS",
        })
      ).status,
      200,
    );
    const current = (await req("data")).body;
    const model = current.catalog.find(
      (c) => c.name === "Caneca Natal fictícia",
    );
    assert.equal(model.prices.length, 2);
    assert.equal(
      current.catalog.filter((c) => c.name === "Chocolate").length,
      2,
    );
    assert.equal(current.orders.length, 43);
    const expense = {
      date: "2026-10-02",
      kind: "Materiais",
      category: "Canecas",
      description: "Dez canecas fictícias",
      value: 80,
      status: "Pago",
      paidDate: "2026-10-02",
      method: "Pix",
      notes: "Teste",
    };
    const created = await req("v3/expenses", expense);
    assert.equal(created.status, 200);
    const e = created.body;
    assert.equal(
      (
        await req(
          "v3/expenses/" + e.id,
          { ...expense, revision: 99, reason: "Conferência" },
          "PUT",
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await req(
          "v3/expenses/" + e.id,
          { ...expense, revision: 0, value: 81, reason: "Correção fictícia" },
          "PUT",
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await req(
          "v3/expenses/" + e.id,
          {
            revision: 1,
            cancel: true,
            reason: "Cancelamento fictício",
            confirmation: "CANCELAR LANÇAMENTO",
          },
          "PUT",
        )
      ).status,
      200,
    );
    const finance = (await req("v3/finance")).body;
    assert.equal(finance.revenue, 3446.3);
    assert.equal(finance.costs, 1754.01);
    assert.equal(finance.gross, 1692.29);
    assert.equal(finance.net, 1692.29);
    assert.equal(finance.paid, 81);
    assert.equal(finance.receipts, 10);
    const data = (await req("v3/data")).body;
    assert.equal(
      data.expenseHistory.filter((h) => h.kind === "expense").length,
      3,
    );
    const settings = {
      ...data.settings,
      pix: "PIX-FICTICIO",
      phone: "CONTATO-FICTICIO",
      instagram: "@ficticio",
      thanks: "Agradecimento fictício",
    };
    assert.equal((await req("v3/settings", settings)).status, 200);
    assert.equal(
      (
        await req("v3/orders/real-1/document", {
          thanks: "Mensagem fictícia personalizada",
          art: "Arte fictícia revisada",
          packaging: "Embalagem fictícia",
        })
      ).status,
      200,
    );
    assert.equal((await fetch(base + "/api/v3/orders/real-1/pdf")).status, 403);
    const pdfResponse = await fetch(base + "/api/v3/orders/real-1/pdf", {
      headers: { Cookie: cookie },
    });
    assert.equal(pdfResponse.status, 200);
    assert.equal(pdfResponse.headers.get("content-type"), "application/pdf");
    const pdfPath = path.join(dir, "pedido-ficticio.pdf");
    await writeFile(pdfPath, Buffer.from(await pdfResponse.arrayBuffer()));
    const parsed = await getDocument({
      data: new Uint8Array(await readFile(pdfPath)),
      useSystemFonts: true,
    }).promise;
    let content = "";
    for (let i = 1; i <= parsed.numPages; i++) {
      content +=
        (await (await parsed.getPage(i)).getTextContent()).items
          .map((t) => t.str)
          .join(" ") + " ";
    }
    await parsed.destroy();
    assert.match(content, /PEDIDO DE COMPRA/);
    assert.match(content, /Cliente Fictícia/);
    assert.match(content, /Natal fictício/);
    assert.match(content, /PIX-FICTICIO/);
    assert.match(content, /a conferir/);
    assert.match(content, /Tem carinho que vira encanto/);
    assert.doesNotMatch(content, /lucro|margem|custo interno/i);
    const read = new DatabaseSync(path.join(dir, "encanto.sqlite"), {
      readOnly: true,
    });
    assert.deepEqual(
      read
        .prepare(
          "SELECT * FROM records WHERE kind IN ('orders','clients','payments','artworks') ORDER BY id",
        )
        .all(),
      original,
    );
    read.close();
  } finally {
    if (child && child.exitCode === null) {
      const stopped = once(child, "exit");
      child.kill();
      await stopped;
    }
    await rm(dir, { recursive: true, force: true });
  }
});
