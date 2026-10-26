import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtemp, rm, readFile, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ExcelJS from "exceljs";
import {
  expected,
  buildPlan,
  previewMaintenance,
  applyMaintenance,
  readReference,
} from "../maintenance.js";
import { restoreBackup } from "../backup.js";
import { collectionReport } from "../v2-domain.js";
const confirmation = "EXCLUIR SOMENTE DEMONSTRACAO E CORRIGIR COLECOES";
function fixtures() {
  const reference = Array.from({ length: 43 }, (_, i) => ({
    originalId: `FICTICIO-${i + 1}`,
    theme: i % 2 ? "Coleção B" : "Coleção A",
    total: (i === 42 ? 8630 : 8000) / 100,
    cost: (i === 42 ? 7401 : 4000) / 100,
  }));
  const orders = reference.map((r, i) => ({
    id: `real-${i}`,
    originalId: r.originalId,
    theme: "Tema original preservado",
    collection: "Não classificado",
    imported: true,
    demo: false,
    status: "Entregue",
    date: "2026-05-01",
    total: r.total,
    cost: r.cost,
    profit: Math.round((r.total - r.cost) * 100) / 100,
    quantity: 1,
    lines: [{ type: "Modelo", name: "Modelo real fictício", quantity: 1 }],
  }));
  const records = [
    ...orders.map((o) => ({
      kind: "orders",
      id: o.id,
      body: JSON.stringify(o),
    })),
    {
      kind: "orders",
      id: "demo",
      body: JSON.stringify({
        id: "demo",
        demo: true,
        total: 99999,
        cost: 100,
        profit: 99899,
        theme: "Demonstração",
        quantity: 9999,
        status: "Aberto",
        lines: [
          { name: "Modelo demonstração", type: "Modelo", quantity: 9999 },
        ],
      }),
    },
    ...["receipt", "refund"].map((type) => ({
      kind: "payments",
      id: `demo-${type}`,
      body: JSON.stringify({
        id: `demo-${type}`,
        orderId: "demo",
        type,
        value: 20,
      }),
    })),
    {
      kind: "payments",
      id: "real-payment",
      body: JSON.stringify({
        id: "real-payment",
        orderId: "real-0",
        value: 10,
        type: "receipt",
      }),
    },
    {
      kind: "clients",
      id: "shared-client",
      body: '{"id":"shared-client","name":"Cliente fictício compartilhado"}',
    },
    {
      kind: "history",
      id: "history-demo",
      body: '{"id":"history-demo","orderId":"demo","before":{"total":1},"after":{"total":2}}',
    },
    {
      kind: "artworks",
      id: "art-real",
      body: '{"id":"art-real","orderId":"real-0"}',
    },
  ];
  return { reference, records };
}
async function setup() {
  const directory = await mkdtemp(path.join(tmpdir(), "encanto-cleanup-test-"));
  const fixture = fixtures();
  const db = new DatabaseSync(path.join(directory, "encanto.sqlite"));
  db.exec(
    "CREATE TABLE records (kind TEXT,id TEXT PRIMARY KEY,body TEXT NOT NULL)",
  );
  for (const r of fixture.records)
    db.prepare("INSERT INTO records VALUES (?,?,?)").run(r.kind, r.id, r.body);
  db.close();
  return { directory, ...fixture };
}
test("limpeza controlada: prévia sem mutação, backup restaurável, exclui só demos e movimentos, preserva 43 e valores", async () => {
  const { directory, reference } = await setup();
  try {
    const before = await readFile(path.join(directory, "encanto.sqlite"));
    const plan = await previewMaintenance(directory, reference);
    assert.deepEqual(plan.totals, expected);
    assert.equal(plan.deleteOrders.length, 1);
    assert.equal(plan.deletePayments.length, 2);
    assert.equal(plan.collections.length, 43);
    assert.deepEqual(
      await readFile(path.join(directory, "encanto.sqlite")),
      before,
    );
    await assert.rejects(
      applyMaintenance(directory, reference, plan, ""),
      /Confirmação/,
    );
    assert.deepEqual(
      await readFile(path.join(directory, "encanto.sqlite")),
      before,
    );
    await assert.rejects(
      applyMaintenance(
        directory,
        reference,
        { ...plan, deleteOrders: [] },
        confirmation,
      ),
      /prévia alterados/,
    );
    const result = await applyMaintenance(
      directory,
      reference,
      plan,
      confirmation,
    );
    const after = await previewMaintenance(directory, reference);
    assert.equal(after.collections.length, 0);
    assert.equal(after.deleteOrders.length, 0);
    assert.deepEqual(after.totals, expected);
    const db = new DatabaseSync(path.join(directory, "encanto.sqlite"), {
      readOnly: true,
    });
    const all = db.prepare("SELECT kind,id,body FROM records").all();
    db.close();
    assert.equal(all.filter((r) => r.kind === "orders").length, 43);
    assert.equal(all.filter((r) => r.kind === "payments").length, 1);
    assert.ok(all.some((r) => r.id === "shared-client"));
    assert.ok(all.some((r) => r.id === "history-demo"));
    assert.ok(all.some((r) => r.id === "art-real"));
    const real = all
      .filter((r) => r.kind === "orders")
      .map((r) => JSON.parse(r.body));
    assert.ok(real.every((r) => r.theme === "Tema original preservado"));
    assert.ok(
      real.every(
        (r) =>
          r.collection ===
          reference.find((ref) => ref.originalId === r.originalId).theme,
      ),
    );
    const report = collectionReport(real);
    assert.equal(report.length, 2);
    assert.equal(
      Math.round(report.reduce((s, r) => s + r.total, 0) * 100),
      expected.total,
    );
    const restored = path.join(directory, "restored");
    await restoreBackup(await readFile(result.backup), restored);
    const restoredPlan = await previewMaintenance(restored, reference);
    assert.equal(restoredPlan.deleteOrders.length, 1);
    assert.equal(restoredPlan.deletePayments.length, 2);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
test("bloqueia IDs ausentes, duplicados, marcados demo, valores divergentes e pedidos desconhecidos", () => {
  const variants = [
    (f) => f.records.shift(),
    (f) => {
      const o = JSON.parse(f.records[0].body);
      o.originalId = "FICTICIO-2";
      f.records[0].body = JSON.stringify(o);
    },
    (f) => {
      const o = JSON.parse(f.records[0].body);
      o.demo = true;
      f.records[0].body = JSON.stringify(o);
    },
    (f) => {
      const o = JSON.parse(f.records[0].body);
      o.total += 1;
      f.records[0].body = JSON.stringify(o);
    },
    (f) =>
      f.records.push({
        kind: "orders",
        id: "unknown",
        body: '{"id":"unknown","demo":false}',
      }),
    (f) => {
      const o = JSON.parse(f.records[43].body);
      o.originalId = "UNKNOWN";
      f.records[43].body = JSON.stringify(o);
    },
  ];
  for (const change of variants) {
    const f = fixtures();
    change(f);
    assert.throws(() => buildPlan(f.records, f.reference));
  }
});
test("backup obrigatório: falha de backup impede alteração; banco alterado invalida prévia", async () => {
  const { directory, reference } = await setup();
  try {
    const plan = await previewMaintenance(directory, reference);
    await mkdir(path.join(directory, "artworks"));
    await writeFile(
      path.join(directory, "artworks", "unexpected.txt"),
      "fixture",
    );
    const before = await readFile(path.join(directory, "encanto.sqlite"));
    await assert.rejects(
      applyMaintenance(directory, reference, plan, confirmation),
      /anexo inesperado/,
    );
    assert.deepEqual(
      await readFile(path.join(directory, "encanto.sqlite")),
      before,
    );
    const db = new DatabaseSync(path.join(directory, "encanto.sqlite"));
    db.prepare("INSERT INTO records VALUES (?,?,?)").run(
      "meta",
      "changed",
      '{"id":"changed"}',
    );
    db.close();
    await assert.rejects(
      applyMaintenance(directory, reference, plan, confirmation),
      /prévia alterados/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
test("lê referência fictícia por cabeçalhos e fórmulas sem importar e rejeita IDs duplicados", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "encanto-sheet-test-"));
  try {
    const { reference } = fixtures();
    const w = new ExcelJS.Workbook(),
      s = w.addWorksheet("Pedidos");
    s.addRow(["ID original", "Tema / arte", "Venda total", "Custo total"]);
    for (const r of reference)
      s.addRow([
        r.originalId,
        r.theme,
        r.total,
        { formula: "1+1", result: r.cost },
      ]);
    const filename = path.join(directory, "ficticio.xlsx");
    await w.xlsx.writeFile(filename);
    assert.deepEqual(await readReference(filename), reference);
    s.getCell("A2").value = "FICTICIO-2";
    await w.xlsx.writeFile(filename);
    await assert.rejects(readReference(filename), /IDs repetidos/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
test("relatório de coleções usa coleção corrigida de importados e exclui demonstração", () => {
  const { records } = fixtures();
  const orders = records
    .filter((r) => r.kind === "orders")
    .map((r) => JSON.parse(r.body));
  const report = collectionReport(orders);
  assert.equal(report.length, 1);
  assert.equal(report[0].name, "Não classificado");
  assert.equal(Math.round(report[0].total * 100), expected.total);
  assert.equal(Math.round(report[0].cost * 100), expected.cost);
});
test("falha durante atualização desfaz exclusões e conserva o backup", async () => {
  const { directory, reference } = await setup();
  try {
    const db = new DatabaseSync(path.join(directory, "encanto.sqlite"));
    db.exec(
      "CREATE TRIGGER fail_update BEFORE UPDATE ON records WHEN OLD.id='real-0' BEGIN SELECT RAISE(ABORT,'falha simulada'); END",
    );
    db.close();
    const plan = await previewMaintenance(directory, reference);
    await assert.rejects(
      applyMaintenance(directory, reference, plan, confirmation),
      /falha simulada/,
    );
    assert.deepEqual(await previewMaintenance(directory, reference), plan);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
