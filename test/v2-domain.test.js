import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeV2,
  allocate,
  collectionReport,
  paymentSummary,
  suggestedPrice,
} from "../v2-domain.js";
const catalog = [
  {
    id: "m",
    name: "Caneca",
    type: "Modelo",
    prices: [
      { date: "2026-01-01", value: 10 },
      { date: "2026-06-01", value: 20 },
    ],
  },
  {
    id: "b",
    name: "Caixa",
    type: "Embalagem",
    prices: [{ date: "2026-01-01", value: 3 }],
  },
];
const input = {
  clientId: "c",
  date: "2026-02-01",
  delivery: "",
  status: "Aberto",
  amount: 3,
  unit: "Peças",
  total: 110,
  discount: 10,
  printing: 3,
  fees: 1,
  shipping: 2,
  expenses: [{ description: "Etiqueta", value: 1 }],
  lines: [
    { key: "a", id: "m", quantity: 2, sale: 80, collection: "Natal" },
    { key: "b", id: "m", quantity: 1, sale: 40, collection: "Afeto" },
    { key: "c", id: "b", quantity: 1 },
  ],
};
test("rateio monetário fecha exatamente centavos, inclusive empates", () => {
  assert.deepEqual(allocate(100, [1, 1, 1]), [34, 33, 33]);
  for (let n = 1; n < 60; n++)
    assert.equal(
      allocate(n, [17, 23, 31]).reduce((s, v) => s + v, 0),
      n,
    );
});
test("múltiplas coleções fecham venda, custo, peças e lucro com desconto e custos comuns", () => {
  const o = computeV2(input, catalog);
  assert.equal(o.cost, 40);
  assert.equal(o.total, 110);
  assert.equal(o.profit, 70);
  const rows = collectionReport([o]);
  assert.equal(
    rows.reduce((s, r) => s + Math.round(r.total * 100), 0),
    11000,
  );
  assert.equal(
    rows.reduce((s, r) => s + Math.round(r.cost * 100), 0),
    4000,
  );
  assert.equal(
    rows.reduce((s, r) => s + r.quantity, 0),
    3,
  );
  assert.equal(rows.length, 2);
  assert.equal(collectionReport([{ ...o, status: "Cancelado" }]).length, 0);
});
test("revisão mantém custo original apesar de nova data e preço", () => {
  const o = computeV2(input, catalog);
  const revised = computeV2({ ...input, date: "2026-07-01" }, catalog, o);
  assert.equal(revised.cost, 40);
  assert.equal(revised.lines[0].unit, 10);
  const explicit = computeV2(
    {
      ...input,
      date: "2026-07-01",
      confirmCosts: true,
      lines: input.lines.map((l) => ({
        ...l,
        reviseCost: true,
        unit: l.id === "b" ? 3 : 20,
      })),
    },
    catalog,
    o,
  );
  assert.equal(explicit.cost, 70);
  assert.throws(
    () =>
      computeV2(
        {
          ...input,
          lines: [
            { ...input.lines[0], reviseCost: true, unit: 99 },
            ...input.lines.slice(1),
          ],
        },
        catalog,
        o,
      ),
    /Confirme/,
  );
});
test("rateio sem vendas usa peças para custos, não cria receita e mantém margem indefinida", () => {
  const o = computeV2(
    {
      ...input,
      total: 0,
      discount: 0,
      lines: input.lines.map((l) => ({ ...l, sale: 0 })),
    },
    catalog,
  );
  assert.equal(o.margin, null);
  assert.equal(
    o.lines
      .filter((l) => l.type === "Modelo")
      .reduce((s, l) => s + l.allocatedCommon, 0),
    10,
  );
});
test("falhas financeiras: quantidades, total divergente, descontos, casas decimais", () => {
  for (const d of [
    { amount: 2 },
    { total: 100 },
    { discount: 121 },
    { fees: -1 },
    { shipping: 1.001 },
  ])
    assert.throws(() => computeV2({ ...input, ...d }, catalog));
});
test("legado não inventa distribuição ou recebimento e preserva status antigo após edição", () => {
  const old = {
    id: "o",
    total: 100,
    cost: 20,
    quantity: 2,
    collection: "Floral",
    date: "2026-02-01",
    payment: "Pago",
  };
  assert.equal(collectionReport([old])[0].name, "Floral");
  assert.equal(
    collectionReport([{ ...old, imported: true }])[0].name,
    "Floral",
  );
  const summary = paymentSummary(old, []);
  assert.equal(summary.needsReconciliation, true);
  assert.equal(summary.received, 0);
  assert.equal(summary.balance, null);
  assert.equal(
    paymentSummary(
      {
        ...old,
        schemaVersion: 2,
        legacyPayment: "Pago",
        payment: "A conferir",
      },
      [],
    ).needsReconciliation,
    true,
  );
});
test("pagamentos líquidos, estornos e cancelamento diferenciam saldo e devolução", () => {
  const o = { id: "o", total: 100, schemaVersion: 2, status: "Aberto" },
    p = [
      { orderId: "o", type: "receipt", value: 60 },
      { orderId: "o", type: "refund", value: 10 },
    ];
  assert.equal(paymentSummary(o, p).balance, 50);
  assert.equal(paymentSummary(o, p).payment, "Parcial");
  assert.equal(paymentSummary({ ...o, status: "Cancelado" }, p).refundDue, 50);
});
test("margem é sobre venda, preço arredonda para cima e zero não inventa margem", () => {
  assert.equal(suggestedPrice(60, 40).total, 100);
  assert.equal(suggestedPrice(10, 33).total, 14.93);
  assert.equal(suggestedPrice(0, 40).margin, null);
  for (const margin of [100, 101, -1, ""])
    assert.throws(() => suggestedPrice(10, margin));
});

test("validação rejeita valores booleanos, objetos e espaços em branco", () => {
  for (const total of [true, {}, [], "   "])
    assert.throws(() => computeV2({ ...input, total }, catalog));
});
