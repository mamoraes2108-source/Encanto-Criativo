import { DatabaseSync } from "node:sqlite";
import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { createBackup } from "./backup.js";

export const expected = {
  count: 43,
  total: 344630,
  cost: 175401,
  profit: 169229,
};
const idText = (v) => String(v ?? "").trim();
const cents = (v) => {
  if (
    typeof v !== "number" ||
    !Number.isFinite(v) ||
    Math.abs(v * 100 - Math.round(v * 100)) > 1e-5
  )
    throw Error("Valor financeiro inválido; nenhuma alteração permitida.");
  return Math.round(v * 100);
};
const totals = (orders) => ({
  count: orders.length,
  total: orders.reduce((s, o) => s + cents(o.total), 0),
  cost: orders.reduce((s, o) => s + cents(o.cost), 0),
  profit: orders.reduce((s, o) => s + cents(o.total) - cents(o.cost), 0),
});
const assertTotals = (orders) => {
  if (JSON.stringify(totals(orders)) !== JSON.stringify(expected))
    throw Error(
      "Os 43 pedidos e totais esperados não conferem. Operação bloqueada.",
    );
};
const snapshot = (records) =>
  createHash("sha256").update(JSON.stringify(records)).digest("hex");
function records(db) {
  return db.prepare("SELECT kind,id,body FROM records ORDER BY kind,id").all();
}
export async function readReference(filename) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filename);
  const sheet = workbook.getWorksheet("Pedidos");
  if (!sheet) throw Error("Aba Pedidos ausente.");
  let header;
  sheet.eachRow((row, n) => {
    if (
      row.values.some((v) => v === "ID original") &&
      row.values.some((v) => v === "Tema / arte")
    ) {
      if (header) throw Error("Cabeçalho ambíguo.");
      header = n;
    }
  });
  if (!header)
    throw Error("Cabeçalho ID original / Tema / arte não encontrado.");
  const headings = sheet.getRow(header).values;
  const column = (label) => {
    const n = headings.indexOf(label);
    if (n < 1) throw Error(`Coluna ausente: ${label}`);
    return n;
  };
  const cols = Object.fromEntries(
    ["ID original", "Tema / arte", "Venda total", "Custo total"].map((k) => [
      k,
      column(k),
    ]),
  );
  const result = [];
  for (let n = header + 1; n <= sheet.rowCount; n++) {
    const row = sheet.getRow(n),
      value = (key) => {
        const cell = row.getCell(cols[key]);
        return cell.type === ExcelJS.ValueType.Formula
          ? cell.result
          : cell.value;
      };
    const originalId = idText(value("ID original"));
    if (!originalId) {
      if (idText(value("Tema / arte")) || value("Venda total"))
        throw Error(`Linha ${n} com dados e sem ID original.`);
      continue;
    }
    result.push({
      originalId,
      theme: idText(value("Tema / arte")),
      total: value("Venda total"),
      cost: value("Custo total"),
    });
  }
  if (new Set(result.map((r) => r.originalId)).size !== result.length)
    throw Error("IDs repetidos na referência.");
  assertTotals(result);
  return result;
}
export function buildPlan(records, reference) {
  assertTotals(reference);
  const refs = new Map(reference.map((r) => [r.originalId, r]));
  if (refs.size !== 43 || refs.has(""))
    throw Error("IDs de referência inválidos.");
  const orders = records
    .filter((r) => r.kind === "orders")
    .map((r) => JSON.parse(r.body));
  const real = [],
    demo = [],
    changes = [],
    seen = new Set();
  for (const order of orders) {
    const id = idText(order.originalId),
      ref = refs.get(id);
    if (ref) {
      if (seen.has(id)) throw Error(`ID original repetido no banco: ${id}.`);
      seen.add(id);
      if (
        order.demo === true ||
        !order.imported ||
        order.schemaVersion === 2 ||
        order.status === "Cancelado"
      )
        throw Error(
          `Pedido ${id} com classificação incompatível. Confira sem apagar.`,
        );
      if (
        cents(order.total) !== cents(ref.total) ||
        cents(order.cost) !== cents(ref.cost) ||
        cents(order.profit) !== cents(ref.total) - cents(ref.cost)
      )
        throw Error(
          `Valores divergentes no pedido ${id}; não serão corrigidos automaticamente.`,
        );
      if (!ref.theme) throw Error(`Tema ausente na referência: ${id}.`);
      real.push(order);
      if (order.collection !== ref.theme)
        changes.push({
          id: order.id,
          originalId: id,
          previousCollection: order.collection ?? "",
          collection: ref.theme,
          preservedTheme: order.theme ?? "",
        });
    } else if (order.demo === true && !id && !order.imported) demo.push(order);
    else
      throw Error(
        `Pedido ${order.id} não reconhecido com segurança. Nenhum registro será apagado.`,
      );
  }
  assertTotals(real);
  if (seen.size !== refs.size)
    throw Error("Há IDs da planilha ausentes no banco.");
  const demoIds = new Set(demo.map((o) => o.id));
  const payments = records
    .filter(
      (r) => r.kind === "payments" && demoIds.has(JSON.parse(r.body).orderId),
    )
    .map((r) => JSON.parse(r.body));
  return {
    version: 1,
    snapshot: snapshot(records),
    totals: totals(real),
    preservedIds: real.map((o) => ({ id: o.id, originalId: o.originalId })),
    deleteOrders: demo.map((o) => ({
      id: o.id,
      theme: o.theme,
      total: o.total,
      cost: o.cost,
      demo: o.demo,
    })),
    deletePayments: payments,
    collections: changes,
  };
}
export async function previewMaintenance(directory, reference) {
  const db = new DatabaseSync(path.join(directory, "encanto.sqlite"), {
    readOnly: true,
  });
  try {
    return buildPlan(records(db), reference);
  } finally {
    db.close();
  }
}
export async function applyMaintenance(
  directory,
  reference,
  plan,
  confirmation,
) {
  if (confirmation !== "EXCLUIR SOMENTE DEMONSTRACAO E CORRIGIR COLECOES")
    throw Error("Confirmação não recebida. Nada alterado.");
  const fresh = await previewMaintenance(directory, reference);
  if (JSON.stringify(fresh) !== JSON.stringify(plan))
    throw Error("Banco ou prévia alterados. Gere nova prévia.");
  const backupDir = path.join(directory, "backups");
  await fs.mkdir(backupDir, { recursive: true });
  const backup = path.join(
    backupDir,
    `antes-limpeza-${Date.now()}-${randomUUID()}.zip`,
  );
  await createBackup(directory, backup); // criação exclusiva e verificação de checksums
  const db = new DatabaseSync(path.join(directory, "encanto.sqlite"));
  try {
    db.exec("BEGIN IMMEDIATE");
    if (snapshot(records(db)) !== plan.snapshot)
      throw Error("Banco mudou após o backup. Operação cancelada.");
    const before = records(db),
      remove = new Set(
        [...plan.deleteOrders, ...plan.deletePayments].map((r) => r.id),
      );
    for (const row of plan.deletePayments)
      db.prepare("DELETE FROM records WHERE kind=? AND id=?").run(
        "payments",
        row.id,
      );
    for (const row of plan.deleteOrders)
      db.prepare("DELETE FROM records WHERE kind=? AND id=?").run(
        "orders",
        row.id,
      );
    for (const change of plan.collections) {
      const row = db
        .prepare("SELECT body FROM records WHERE kind=? AND id=?")
        .get("orders", change.id);
      const order = JSON.parse(row.body);
      db.prepare("UPDATE records SET body=? WHERE kind=? AND id=?").run(
        JSON.stringify({ ...order, collection: change.collection }),
        "orders",
        order.id,
      );
    }
    const after = records(db),
      changes = new Map(plan.collections.map((r) => [r.id, r.collection]));
    // Todos os registros sobreviventes devem ser idênticos, exceto coleção autorizada.
    for (const old of before.filter((r) => !remove.has(r.id))) {
      const row = after.find((r) => r.kind === old.kind && r.id === old.id);
      const expectedBody = changes.has(old.id)
        ? JSON.stringify({
            ...JSON.parse(old.body),
            collection: changes.get(old.id),
          })
        : old.body;
      if (!row || row.body !== expectedBody)
        throw Error("Verificação de preservação falhou. Alterações desfeitas.");
    }
    if (after.length !== before.length - remove.size)
      throw Error("Quantidade de exclusões divergente.");
    buildPlan(after, reference); // valida novamente os 43 IDs e todos os totais
    db.exec("COMMIT");
    return {
      backup,
      totals: plan.totals,
      deletedOrders: plan.deleteOrders.length,
      deletedPayments: plan.deletePayments.length,
      collections: plan.collections.length,
    };
  } catch (e) {
    try {
      db.exec("ROLLBACK");
    } catch {}
    throw e;
  } finally {
    db.close();
  }
}
