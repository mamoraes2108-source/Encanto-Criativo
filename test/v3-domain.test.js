import { test } from "node:test";
import assert from "node:assert/strict";
import {
  financialSummary,
  validateExpense,
  orderResult,
  validateIncludedRevision,
} from "../v3-domain.js";
const order = {
  id: "real",
  clientId: "client",
  date: "2026-10-01",
  total: 30,
  cost: 8,
  profit: 22,
  demo: false,
  status: "Entregue",
  schemaVersion: 2,
  expenses: [],
};
const paid = (kind, value, more = {}) => ({
  id: kind,
  kind,
  value,
  date: "2026-10-01",
  paidDate: "2026-10-02",
  category: "Teste",
  status: "Pago",
  treatment: "additional",
  ...more,
});
test("compra de dez canecas: custo de uma venda e desembolso integral, sem custo duplicado", () => {
  const r = financialSummary(
    [order],
    [paid("Materiais", 80)],
    [{ orderId: "real", type: "receipt", date: "2026-10-03", value: 30 }],
  );
  assert.equal(r.gross, 22);
  assert.equal(r.net, 22);
  assert.equal(r.paid, 80);
  assert.equal(r.cash, -50);
  assert.equal(financialSummary([order], [], []).paid, 0);
});
test("Uber adicional vinculado reduz resultado uma vez; caixa somente quando pago", () => {
  const expense = paid("Operacional", 5, {
    orderId: "real",
    date: "2026-09-30",
    paidDate: "2026-11-01",
  });
  const r = financialSummary([order], [expense], [], {
    from: "2026-10-01",
    to: "2026-10-31",
  });
  assert.equal(r.additional, 5);
  assert.equal(r.net, 17);
  assert.equal(r.paid, 0);
  assert.equal(orderResult(order, [expense]).profit, 17);
  assert.equal(
    financialSummary([order], [expense], [], { from: "2026-11-01" }).paid,
    5,
  );
});
test("despesa já incluída no pedido afeta apenas caixa; equipamentos não reduzem lucro", () => {
  const saved = {
    ...order,
    cost: 13,
    profit: 17,
    expenses: [{ description: "Uber", value: 5 }],
  };
  const e = paid("Operacional", 5, {
    description: "Uber",
    orderId: "real",
    treatment: "included",
    includedIndex: 0,
  });
  const r = financialSummary([saved], [e, paid("Equipamentos", 300)], []);
  assert.equal(r.gross, 17);
  assert.equal(r.net, 17);
  assert.equal(r.paid, 305);
  assert.equal(orderResult(saved, [e]).additional, 0);
});
test("pendências, cancelamentos e estornos não inventam pagamentos", () => {
  const expenses = [
    paid("Operacional", 10, { status: "Pendente", paidDate: "" }),
    paid("Operacional", 7, { cancelled: true }),
  ];
  const r = financialSummary(
    [order, { ...order, id: "demo", demo: true }],
    expenses,
    [
      { orderId: "demo", type: "receipt", date: "2026-10-02", value: 999 },
      { orderId: "real", type: "refund", date: "2026-10-03", value: 2 },
    ],
  );
  assert.equal(r.additional, 10);
  assert.equal(r.paid, 7);
  assert.equal(r.cash, -9);
  assert.equal(r.receipts, 0);
});
test("pagamentos legados a conferir e filtro por categoria preservam significado", () => {
  const legacy = { ...order, schemaVersion: undefined, payment: "Pago" };
  const r = financialSummary(
    [legacy],
    [
      paid("Operacional", 5, { category: "Uber" }),
      paid("Operacional", 8, { category: "Anúncio" }),
    ],
    [],
    { category: "Uber" },
  );
  assert.equal(r.unchecked, 1);
  assert.equal(r.receipts, 0);
  assert.equal(r.additional, 5);
  assert.equal(r.revenue, 30);
});
test("vínculo a despesa incorporada exige linha exata, impede duplicidade e protege revisões", () => {
  const o = { ...order, expenses: [{ description: "Uber", value: 5 }] };
  const input = {
    ...paid("Operacional", 5),
    description: "Uber",
    orderId: "real",
    treatment: "included",
    includedIndex: 0,
    method: "Pix",
  };
  const e = validateExpense(input, [o], []);
  assert.equal(e.includedIndex, 0);
  assert.throws(
    () => validateExpense({ ...input, value: 6 }, [o], []),
    /coincidir/,
  );
  assert.throws(
    () => validateExpense(input, [o], [{ ...e, id: "existing" }]),
    /já tem/,
  );
  assert.throws(
    () => validateExpense({ ...input, treatment: "additional" }, [o], []),
    /já incluída/,
  );
  assert.throws(
    () =>
      validateIncludedRevision("real", { expenses: [] }, [
        { ...e, id: "existing" },
      ]),
    /vinculado/,
  );
  assert.doesNotThrow(() => validateIncludedRevision("real", o, [e]));
});
test("validação rejeita datas, valores, situação e pedidos inválidos", () => {
  const b = { ...paid("Operacional", 5), description: "Teste", method: "Pix" };
  for (const change of [
    { value: -1 },
    { value: 0 },
    { value: 0.001 },
    { date: "2026-02-30" },
    { status: "Outra" },
    { orderId: "missing" },
    { paidDate: "" },
    { method: "" },
  ])
    assert.throws(() => validateExpense({ ...b, ...change }, [order], []));
});
test("centavos e prejuízos permanecem exatos no resumo", () => {
  const rows = Array.from({ length: 43 }, (_, i) => ({
    ...order,
    id: String(i),
    total: 0.1,
    cost: 0.2,
    profit: -0.1,
  }));
  const r = financialSummary(rows, [], []);
  assert.equal(r.revenue, 4.3);
  assert.equal(r.costs, 8.6);
  assert.equal(r.gross, -4.3);
});
