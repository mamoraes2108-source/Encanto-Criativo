import { test } from "node:test";
import assert from "node:assert/strict";
import { calculate, priceAt, validateOrder } from "../domain.js";
const catalog = [
  {
    id: "m",
    name: "Caneca",
    type: "Modelo",
    prices: [
      { date: "2026-01-01", value: 14 },
      { date: "2026-07-01", value: 18 },
    ],
  },
  {
    id: "b",
    name: "Caixa",
    type: "Embalagem",
    prices: [{ date: "2026-01-01", value: 5.5 }],
  },
];
const input = {
  date: "2026-05-12",
  delivery: "2026-05-20",
  clientId: "c",
  quantity: 2,
  total: 118,
  printing: 8,
  extra: 2,
  lines: [
    { id: "m", quantity: 2 },
    { id: "b", quantity: 2 },
  ],
  status: "Aberto",
  payment: "Pendente",
};
test("calcula materiais, impressão, lucro e margem", () => {
  const r = calculate(input, catalog);
  assert.equal(r.cost, 49);
  assert.equal(r.profit, 69);
  assert.equal(r.margin, 58.47);
});
test("escolhe o custo pela vigência e preserva a fotografia", () => {
  const old = calculate(input, catalog);
  assert.equal(priceAt(catalog[0], "2026-07-01"), 18);
  catalog[0].prices.push({ date: "2026-10-01", value: 30 });
  assert.equal(old.cost, 49);
  assert.equal(old.lines[0].unit, 14);
});
test("não inventa custo sem vigência", () =>
  assert.throws(
    () => calculate({ ...input, date: "2025-01-01" }, catalog),
    /Sem custo vigente/,
  ));
test("venda zero tem margem indefinida e prejuízo calculado", () => {
  const r = calculate({ ...input, total: 0 }, catalog);
  assert.equal(r.margin, null);
  assert.equal(r.profit, -49);
});
test("rejeita quantidade fracionária, custo ausente e preço negativo", () => {
  for (const change of [{ quantity: 1.5 }, { printing: "" }, { total: -1 }])
    assert.throws(() => calculate({ ...input, ...change }, catalog));
});
test("rejeita entrega anterior, datas inexistentes e cliente ausente", () => {
  for (const change of [
    { delivery: "2026-01-01" },
    { date: "2026-02-30" },
    { clientId: "missing" },
  ])
    assert.throws(() =>
      validateOrder({ ...input, ...change }, [{ id: "c" }], catalog),
    );
});
test("permite oito complementos e bloqueia o nono", () => {
  const extras = Array.from({ length: 9 }, (_, i) => ({
    id: "x" + i,
    name: "Extra " + i,
    type: "Complemento",
    prices: [{ date: "2026-01-01", value: 0.1 }],
  }));
  assert.equal(
    calculate(
      {
        ...input,
        lines: [
          input.lines[0],
          ...extras.slice(0, 8).map((c) => ({ id: c.id, quantity: 1 })),
        ],
      },
      [...catalog, ...extras],
    ).cost,
    38.8,
  );
  assert.throws(
    () =>
      calculate(
        {
          ...input,
          lines: [
            input.lines[0],
            ...extras.map((c) => ({ id: c.id, quantity: 1 })),
          ],
        },
        [...catalog, ...extras],
      ),
    /oito/,
  );
});
test("bloqueia repetição de materiais", () =>
  assert.throws(
    () =>
      calculate({ ...input, lines: [input.lines[0], input.lines[0]] }, catalog),
    /repetido/,
  ));
test("kits são convertidos em peças e exigem composição consistente", () => {
  const r = calculate(
    { ...input, unit: "Kits", quantity: 1, piecesPerKit: 2 },
    catalog,
  );
  assert.equal(r.amount, 1);
  assert.equal(r.quantity, 2);
  assert.equal(r.cost, 49);
  assert.throws(
    () =>
      calculate(
        { ...input, unit: "Kits", quantity: 2, piecesPerKit: 2 },
        catalog,
      ),
    /soma/,
  );
});
test("modelo com quantidade zero é bloqueado", () =>
  assert.throws(
    () => calculate({ ...input, lines: [{ id: "m", quantity: 0 }] }, catalog),
    /maior/,
  ));
