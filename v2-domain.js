import { money, number, date, priceAt } from "./domain.js";
export const statuses = [
  "Aberto",
  "Em produção",
  "Pronto",
  "Entregue",
  "Cancelado",
];
export function text(v, name, max = 2000) {
  if (typeof v !== "string" || v.length > max)
    throw Error(`${name}: texto inválido (máximo ${max} caracteres).`);
  return v.trim();
}
export const cents = (v) => {
  const n = number(v, "Valor");
  if (n > 1e9 || Math.abs(n * 100 - Math.round(n * 100)) > 1e-5)
    throw Error(
      "Valores monetários devem ter até duas casas decimais e no máximo um bilhão.",
    );
  return Math.round(n * 100);
};
export function allocate(total, weights) {
  if (
    !Number.isSafeInteger(total) ||
    total < 0 ||
    weights.some((w) => !Number.isSafeInteger(w) || w < 0)
  )
    throw Error("Rateio inválido.");
  if (!weights.length) {
    if (total) throw Error("Não há itens para ratear.");
    return [];
  }
  const sum = weights.reduce((s, w) => s + w, 0);
  if (!sum && total)
    throw Error("Informe valores de venda nos itens para ratear.");
  const denominator = BigInt(sum || weights.length),
    T = BigInt(total);
  const W = weights.map((w) => BigInt(sum ? w : 1));
  const parts = W.map((w) => Number((T * w) / denominator));
  let rest = total - parts.reduce((s, n) => s + n, 0);
  const order = W.map((w, i) => ({ i, remainder: (T * w) % denominator })).sort(
    (a, b) =>
      a.remainder === b.remainder
        ? a.i - b.i
        : a.remainder > b.remainder
          ? -1
          : 1,
  );
  for (let j = 0; j < rest; j++) parts[order[j].i]++;
  return parts;
}
export function computeV2(input, catalog, old = null) {
  date(input.date, "Data do pedido");
  if (input.delivery) date(input.delivery, "Entrega");
  if (input.delivery && input.delivery < input.date)
    throw Error("Entrega anterior ao pedido.");
  if (!statuses.includes(input.status)) throw Error("Status inválido.");
  const unit = input.unit || "Peças";
  if (!["Peças", "Kits"].includes(unit)) throw Error("Unidade inválida.");
  const amount = number(input.amount ?? input.quantity, "Quantidade", true),
    piecesPerKit =
      unit === "Kits" ? number(input.piecesPerKit, "Peças por kit", true) : 1;
  if (amount < 1 || piecesPerKit < 1 || amount * piecesPerKit > 1000000)
    throw Error("Quantidade inválida.");
  if (
    !Array.isArray(input.lines) ||
    input.lines.length > 100 ||
    !input.lines.length
  )
    throw Error("Informe os itens (máximo 100).");
  const keys = new Set();
  const lines = input.lines.map((l, i) => {
    const key = text(l.key ?? String(i), "Identificador do item", 100);
    if (keys.has(key)) throw Error("Identificador de item repetido.");
    keys.add(key);
    const previous = old?.lines.find(
      (p, j) => (p.key ?? String(j)) === key && p.id === l.id,
    );
    const item = catalog.find((c) => c.id === l.id) || previous;
    if (!item) throw Error("Item não encontrado no catálogo.");
    if (item.archived && !previous)
      throw Error("Item arquivado não pode compor novos pedidos.");
    const quantity = number(l.quantity, "Quantidade do item", true);
    if (quantity < 1 || quantity > 1000000)
      throw Error("Quantidade do item inválida.");
    let unitCost;
    if (l.reviseCost === true) {
      if (input.confirmCosts !== true)
        throw Error("Confirme a revisão dos custos unitários.");
      unitCost = cents(l.unit) / 100;
    } else if (previous) {
      if (previous.unit === null || previous.unit === undefined)
        throw Error(
          "Custo unitário histórico desconhecido: revisão explícita necessária.",
        );
      unitCost = previous.unit;
    } else unitCost = priceAt(item, input.date);
    const sale = item.type === "Modelo" ? cents(l.sale) : 0;
    return {
      key,
      id: l.id,
      name: item.name,
      type: item.type,
      quantity,
      unit: unitCost,
      total: money(quantity * unitCost),
      collection:
        item.type === "Modelo" ? text(l.collection || "", "Coleção", 150) : "",
      sale: sale / 100,
    };
  });
  const models = lines.filter((l) => l.type === "Modelo");
  if (
    !models.length ||
    models.reduce((s, l) => s + l.quantity, 0) !== amount * piecesPerKit
  )
    throw Error("A soma dos modelos deve corresponder ao total de peças.");
  if (
    new Set(lines.filter((l) => l.type === "Complemento").map((l) => l.id))
      .size > 8
  )
    throw Error("Máximo de oito complementos.");
  const printing = cents(input.printing),
    fees = cents(input.fees ?? 0),
    shipping = cents(input.shipping ?? 0);
  if (!Array.isArray(input.expenses) || input.expenses.length > 50)
    throw Error("Lista de despesas inválida.");
  const expenses = input.expenses.map((e) => ({
    description: text(e.description, "Descrição", 200),
    value: cents(e.value) / 100,
  }));
  if (expenses.some((e) => !e.description))
    throw Error("Descreva cada outra despesa.");
  const discount = cents(input.discount ?? 0),
    gross = models.reduce((s, l) => s + cents(l.sale), 0);
  if (discount > gross) throw Error("Desconto superior ao valor dos itens.");
  const total = money((gross - discount) / 100);
  if (cents(input.total) !== cents(total))
    throw Error(
      "Venda total deve ser igual à soma das vendas atribuídas aos modelos menos o desconto.",
    );
  const common =
    lines
      .filter((l) => l.type !== "Modelo")
      .reduce((s, l) => s + cents(l.total), 0) +
    printing +
    fees +
    shipping +
    expenses.reduce((s, e) => s + cents(e.value), 0);
  const weights = models.map((l) => cents(l.sale));
  const revenue = allocate(cents(total), weights);
  const shared = allocate(
    common,
    weights.some(Boolean) ? weights : models.map((l) => l.quantity),
  );
  models.forEach((l, i) => {
    l.revenue = revenue[i] / 100;
    l.allocatedCommon = shared[i] / 100;
    l.allocatedCost = money(l.total + shared[i] / 100);
  });
  const cost = money(
    lines.reduce((s, l) => s + l.total, 0) +
      printing / 100 +
      fees / 100 +
      shipping / 100 +
      expenses.reduce((s, e) => s + e.value, 0),
  );
  return {
    schemaVersion: 2,
    date: input.date,
    delivery: input.delivery || "",
    status: input.status,
    unit,
    amount,
    piecesPerKit,
    quantity: amount * piecesPerKit,
    lines,
    printing: printing / 100,
    fees: fees / 100,
    shipping: shipping / 100,
    expenses,
    extra: money(expenses.reduce((s, e) => s + e.value, 0)),
    discount: discount / 100,
    total,
    cost,
    profit: money(total - cost),
    margin: total ? money(((total - cost) / total) * 100) : null,
    clientId: text(input.clientId || "", "Cliente", 100),
    theme: text(input.theme || "", "Tema", 1000),
    description: text(input.description || "", "Personalização", 4000),
    notes: text(input.notes || "", "Observações", 4000),
    collection: "",
  };
}
export function paymentSummary(order, entries) {
  const rows = entries.filter((p) => p.orderId === order.id);
  const received = money(
    rows.reduce((s, p) => s + (p.type === "receipt" ? p.value : -p.value), 0),
  );
  const legacyPayment =
    order.legacyPayment ?? (order.schemaVersion !== 2 ? order.payment : null);
  const needsReconciliation =
    !!legacyPayment && legacyPayment !== "Pendente" && !rows.length;
  return {
    received,
    balance:
      order.status === "Cancelado"
        ? 0
        : needsReconciliation
          ? null
          : money(order.total - received),
    refundDue: order.status === "Cancelado" ? received : 0,
    payment: needsReconciliation
      ? "A conferir"
      : received <= 0
        ? "Pendente"
        : received >= order.total
          ? "Pago"
          : "Parcial",
    legacyPayment,
    needsReconciliation,
  };
}
export function collectionRows(order) {
  if (order.schemaVersion === 2)
    return order.lines
      .filter((l) => l.type === "Modelo")
      .map((l) => ({
        name: l.collection || "Não classificado",
        total: l.revenue,
        cost: l.allocatedCost,
        quantity: l.quantity,
      }));
  return [
    {
      name:
        order.collection ||
        (order.imported ? "Não classificado / conferir" : "Não classificado"),
      total: order.total,
      cost: order.cost,
      quantity: order.quantity,
    },
  ];
}
export function collectionReport(orders) {
  const map = new Map();
  for (const o of orders.filter(
    (o) => o.status !== "Cancelado" && o.demo !== true,
  ))
    for (const r of collectionRows(o)) {
      const v = map.get(r.name) || {
        name: r.name,
        total: 0,
        cost: 0,
        quantity: 0,
        months: {},
      };
      v.total = money(v.total + r.total);
      v.cost = money(v.cost + r.cost);
      v.quantity += r.quantity;
      const month = o.date.slice(0, 7),
        m = v.months[month] || { total: 0, cost: 0, quantity: 0 };
      m.total = money(m.total + r.total);
      m.cost = money(m.cost + r.cost);
      m.quantity += r.quantity;
      v.months[month] = m;
      map.set(r.name, v);
    }
  const total = [...map.values()].reduce((s, r) => s + r.total, 0);
  return [...map.values()].map((v) => ({
    ...v,
    profit: money(v.total - v.cost),
    margin: v.total ? money(((v.total - v.cost) / v.total) * 100) : null,
    share: total ? money((v.total / total) * 100) : 0,
  }));
}
export function suggestedPrice(cost, margin) {
  const c = cents(cost);
  const m = number(margin, "Margem desejada");
  if (m >= 100) throw Error("A margem deve ser menor que 100%.");
  const total = Math.ceil(c / (1 - m / 100) - 1e-8) / 100;
  return {
    total,
    cost: c / 100,
    profit: money(total - c / 100),
    margin: total ? money(((total - c / 100) / total) * 100) : null,
  };
}
