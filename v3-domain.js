import { date, money } from "./domain.js";
import { cents, text, paymentSummary } from "./v2-domain.js";
export const expenseKinds = ["Materiais", "Operacional", "Equipamentos"];
export const settingsDefaults = {
  id: "v3-settings",
  lowMargin: 25,
  company: "Encanto Criativo",
  pix: "",
  instagram: "",
  phone: "",
  businessDetails: "",
  thanks:
    "Espero que esta encomenda ilumine o seu dia tanto quanto iluminou o meu.",
};
export function validateExpense(b, orders, expenses, old = null) {
  date(b.date, "Data");
  if (!expenseKinds.includes(b.kind))
    throw Error("Selecione materiais, operacional ou equipamentos.");
  const description = text(b.description, "Descrição", 500);
  const category = text(b.category, "Categoria", 100);
  const value = cents(b.value) / 100;
  if (!description || !category || value <= 0)
    throw Error("Descrição, categoria e valor positivo são obrigatórios.");
  if (!["Pago", "Pendente"].includes(b.status))
    throw Error("Situação inválida.");
  const paidDate =
    b.status === "Pago" ? date(b.paidDate, "Data do pagamento") : "";
  const method = text(b.method || "", "Forma de pagamento", 100);
  if (paidDate && !method) throw Error("Informe a forma de pagamento.");
  const orderId = text(b.orderId || "", "Pedido", 100);
  const order = orderId
    ? orders.find((o) => o.id === orderId && !o.demo)
    : null;
  if (orderId && !order) throw Error("Pedido real não encontrado.");
  const treatment = b.treatment || "additional";
  if (!["additional", "included"].includes(treatment))
    throw Error("Tratamento inválido.");
  let includedIndex = null;
  if (treatment === "included") {
    includedIndex = Number(b.includedIndex);
    if (
      b.kind !== "Operacional" ||
      !order ||
      b.includedIndex === "" ||
      !Number.isInteger(includedIndex)
    )
      throw Error("Escolha uma despesa já incluída no pedido.");
    const entry = order.expenses?.[includedIndex];
    if (
      !entry ||
      cents(entry.value) !== cents(value) ||
      entry.description !== description
    )
      throw Error(
        "A descrição e o valor devem coincidir com a despesa já incluída no pedido.",
      );
    if (
      expenses.some(
        (e) =>
          e.id !== old?.id &&
          !e.cancelled &&
          e.orderId === orderId &&
          e.treatment === "included" &&
          e.includedIndex === includedIndex,
      )
    )
      throw Error(
        "Esta despesa do pedido já tem lançamento de caixa vinculado.",
      );
  }
  if (
    order &&
    b.kind === "Operacional" &&
    treatment === "additional" &&
    order.expenses?.some(
      (e) =>
        cents(e.value) === cents(value) &&
        e.description.trim().toLowerCase() === description.toLowerCase(),
    )
  )
    throw Error(
      "Despesa semelhante já incluída no custo. Selecione “Já incluída no pedido”.",
    );
  return {
    date: b.date,
    description,
    category,
    kind: b.kind,
    value,
    status: b.status,
    paidDate,
    method,
    orderId,
    treatment,
    includedIndex,
    notes: text(b.notes || "", "Observações", 4000),
  };
}
export function orderResult(order, expenses) {
  const linked = expenses.filter(
    (e) =>
      !e.cancelled &&
      e.kind === "Operacional" &&
      e.orderId === order.id &&
      e.treatment !== "included",
  );
  const additional = money(linked.reduce((s, e) => s + e.value, 0));
  const cost = money(order.cost + additional),
    profit = money(order.total - cost);
  return {
    additional,
    cost,
    profit,
    margin: order.total ? money((profit / order.total) * 100) : null,
    linked,
  };
}
export function financialSummary(orders, expenses, payments, filter = {}) {
  const within = (d) =>
    !!d && (!filter.from || d >= filter.from) && (!filter.to || d <= filter.to);
  const real = orders.filter((o) => !o.demo),
    ids = new Set(real.map((o) => o.id));
  const sold = real.filter((o) => o.status !== "Cancelado" && within(o.date));
  const centsSum = (rows, key) =>
    rows.reduce((s, r) => s + Math.round(Number(r[key] || 0) * 100), 0);
  const relevant = expenses.filter(
    (e) => !filter.category || e.category === filter.category,
  );
  const operating = relevant.filter(
    (e) =>
      !e.cancelled &&
      e.kind === "Operacional" &&
      e.treatment !== "included" &&
      within(
        real.find((o) => o.id === e.orderId && o.status !== "Cancelado")
          ?.date || e.date,
      ),
  );
  // Purchasing material is cash only; consumed material is already in the saved order cost.
  const out = relevant.filter((e) => e.status === "Pago" && within(e.paidDate));
  const movements = payments.filter(
    (p) => ids.has(p.orderId) && within(p.date),
  );
  const receipts = centsSum(
    movements.filter((p) => p.type === "receipt"),
    "value",
  );
  const refunds = centsSum(
    movements.filter((p) => p.type === "refund"),
    "value",
  );
  const revenue = centsSum(sold, "total"),
    costs = centsSum(sold, "cost");
  const additional = centsSum(operating, "value"),
    paid = centsSum(out, "value");
  return {
    revenue: revenue / 100,
    costs: costs / 100,
    gross: (revenue - costs) / 100,
    additional: additional / 100,
    net: (revenue - costs - additional) / 100,
    receipts: receipts / 100,
    paid: paid / 100,
    refunds: refunds / 100,
    cash: (receipts - refunds - paid) / 100,
    unchecked: sold.filter(
      (o) => paymentSummary(o, payments).needsReconciliation,
    ).length,
  };
}
export function validateIncludedRevision(orderId, draft, expenses) {
  for (const e of expenses.filter(
    (e) => !e.cancelled && e.orderId === orderId && e.treatment === "included",
  )) {
    const entry = draft.expenses?.[e.includedIndex];
    if (
      !entry ||
      entry.description !== e.description ||
      cents(entry.value) !== cents(e.value)
    )
      throw Error(
        "Há lançamento de caixa vinculado a esta despesa. Preserve a descrição, posição e valor ou corrija o vínculo antes da revisão.",
      );
  }
}
