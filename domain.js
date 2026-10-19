export const money = (n) =>
  Math.round((Number(n) + Number.EPSILON) * 100) / 100;
export function number(value, name, integer = false) {
  const n = Number(value);
  if (
    !["string", "number"].includes(typeof value) ||
    (typeof value === "string" && !value.trim()) ||
    value === "" ||
    value === null ||
    value === undefined ||
    !Number.isFinite(n) ||
    n > (integer ? 1000000 : 1000000000) ||
    n < 0 ||
    (integer && !Number.isInteger(n))
  )
    throw Error(
      `${name}: informe um número ${integer ? "inteiro " : ""}válido, maior ou igual a zero.`,
    );
  return n;
}
export function date(value, name) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value || "") ||
    new Date(value + "T12:00:00Z").toISOString().slice(0, 10) !== value
  )
    throw Error(`${name}: data obrigatória e válida.`);
  return value;
}
export function priceAt(item, day) {
  const price = item.prices
    .filter((p) => p.date <= day)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!price)
    throw Error(
      `Sem custo vigente para ${item.name} em ${day}. Cadastre a vigência correta.`,
    );
  return price.value;
}
export function calculate(input, catalog) {
  const day = date(input.date, "Data do pedido");
  const unit = input.unit || "Peças";
  if (!["Peças", "Kits"].includes(unit)) throw Error("Unidade inválida.");
  const amount = number(input.amount ?? input.quantity, "Quantidade", true);
  const piecesPerKit =
    unit === "Kits" ? number(input.piecesPerKit, "Peças por kit", true) : 1;
  if (!amount || !piecesPerKit)
    throw Error("Quantidade e peças por kit devem ser maiores que zero.");
  const quantity = amount * piecesPerKit;
  if (
    !Array.isArray(input.lines) ||
    !input.lines.some(
      (l) => catalog.find((c) => c.id === l.id)?.type === "Modelo",
    )
  )
    throw Error("Selecione um modelo.");
  if (
    input.lines.filter(
      (l) => catalog.find((c) => c.id === l.id)?.type === "Complemento",
    ).length > 8
  )
    throw Error("Máximo de oito complementos.");
  if (new Set(input.lines.map((l) => l.id)).size !== input.lines.length)
    throw Error("Item repetido no pedido.");
  const lines = input.lines.map((l) => {
    const item = catalog.find((c) => c.id === l.id);
    if (!item) throw Error("Item não encontrado.");
    const count = number(l.quantity, "Quantidade do item", true);
    if (!count)
      throw Error("A quantidade de cada item deve ser maior que zero.");
    const unit = priceAt(item, day);
    return {
      id: item.id,
      name: item.name,
      type: item.type,
      quantity: count,
      unit,
      total: money(count * unit),
    };
  });
  if (
    lines
      .filter((l) => l.type === "Modelo")
      .reduce((sum, l) => sum + l.quantity, 0) !== quantity
  )
    throw Error(
      "A soma das quantidades dos modelos deve ser igual ao total de peças do pedido.",
    );
  const printing = number(input.printing, "Impressão total");
  const extra = number(input.extra, "Outros custos");
  const total = number(input.total, "Valor da venda");
  const cost = money(lines.reduce((s, l) => s + l.total, 0) + printing + extra);
  return {
    lines,
    unit,
    amount,
    piecesPerKit,
    quantity,
    printing,
    extra,
    total: money(total),
    cost,
    profit: money(total - cost),
    margin: total ? money(((total - cost) / total) * 100) : null,
  };
}
export function validateOrder(input, clients, catalog) {
  if (!clients.some((c) => c.id === input.clientId))
    throw Error("Selecione um cliente.");
  date(input.delivery, "Data de entrega");
  if (input.delivery < input.date)
    throw Error("A entrega não pode ser anterior ao pedido.");
  if (
    !["Aberto", "Em produção", "Pronto", "Entregue", "Cancelado"].includes(
      input.status,
    )
  )
    throw Error("Status inválido.");
  if (!["Pendente", "Parcial", "Pago"].includes(input.payment))
    throw Error("Pagamento inválido.");
  return { ...input, ...calculate(input, catalog) };
}
