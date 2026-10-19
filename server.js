import express from "express";
import multer from "multer";
import ExcelJS from "exceljs";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, chmodSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { calculate, validateOrder, date, number, money } from "./domain.js";
const directory = process.env.DATA_DIR || "./data";
mkdirSync(directory, { recursive: true, mode: 0o700 });
const db = new DatabaseSync(`${directory}/encanto.sqlite`);
chmodSync(`${directory}/encanto.sqlite`, 0o600);
db.exec(
  "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS records (kind TEXT, id TEXT PRIMARY KEY, body TEXT NOT NULL)",
);
const list = (kind) =>
  db
    .prepare("SELECT body FROM records WHERE kind=?")
    .all(kind)
    .map((r) => JSON.parse(r.body));
const put = (kind, body) => {
  db.prepare("INSERT OR REPLACE INTO records VALUES (?,?,?)").run(
    kind,
    body.id,
    JSON.stringify(body),
  );
  return body;
};
const transaction = (fn) => {
  db.exec("BEGIN");
  try {
    const r = fn();
    db.exec("COMMIT");
    return r;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
};
if (!list("meta").length)
  transaction(() => {
    put("meta", { id: "initialized", version: 1 });
    const clients = [
      {
        id: randomUUID(),
        name: "Mariana • demonstração",
        phone: "",
        email: "",
        notes: "Cliente fictícia",
      },
      {
        id: randomUUID(),
        name: "Ateliê Aurora • demonstração",
        phone: "",
        email: "",
        notes: "Cliente fictício",
      },
    ];
    clients.forEach((c) => put("clients", c));
    const catalog = [
      ["Caneca cerâmica 325 ml", "Modelo", 14],
      ["Xícara com pires", "Modelo", 22],
      ["Caixa presente", "Embalagem", 5.5],
      ["Laço de cetim", "Complemento", 1.2],
      ["Chocolate", "Complemento", 3],
    ].map(([name, type, value]) => ({
      id: randomUUID(),
      name,
      type,
      prices: [{ date: "2026-01-01", value }],
      demo: true,
    }));
    catalog.forEach((c) => put("catalog", c));
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
    }).format(new Date());
    [0, 1, 2].forEach((i) => {
      const input = {
        clientId: clients[i % 2].id,
        date: today,
        delivery: today,
        theme: ["Flores delicadas", "Gratidão", "Jardim de afetos"][i],
        collection: ["Floral", "Essenciais", "Floral"][i],
        quantity: i + 1,
        lines: [
          { id: catalog[0].id, quantity: i + 1 },
          { id: catalog[2].id, quantity: i + 1 },
        ],
        printing: 4 * (i + 1),
        extra: 0,
        total: 59 * (i + 1),
        status: ["Aberto", "Em produção", "Entregue"][i],
        payment: i === 2 ? "Pago" : "Pendente",
        notes: "Dado fictício para demonstração",
        demo: true,
      };
      put("orders", {
        id: randomUUID(),
        ...validateOrder(input, clients, catalog),
      });
    });
  });
const app = express();
app.use(express.json({ limit: "2mb" }));
app.use((req, res, next) => {
  if (
    req.method !== "GET" &&
    req.headers.origin &&
    req.headers.origin !== `${req.protocol}://${req.get("host")}`
  )
    return res.status(403).json({ error: "Origem não permitida." });
  next();
});
app.use(express.static("public"));
app.get("/api/data", (req, res) =>
  res.json({
    clients: list("clients"),
    catalog: list("catalog"),
    orders: list("orders"),
  }),
);
app.post("/api/clients", (req, res) => {
  const { name, phone = "", email = "", notes = "" } = req.body;
  if (!name?.trim()) throw Error("Nome obrigatório.");
  res.json(
    put("clients", {
      id: randomUUID(),
      name: name.trim(),
      phone,
      email,
      notes,
    }),
  );
});
app.post("/api/catalog", (req, res) => {
  const { id, name, type, value, date: day } = req.body;
  date(day, "Vigência");
  const cost = number(value, "Custo");
  if (!name?.trim() || !["Modelo", "Embalagem", "Complemento"].includes(type))
    throw Error("Nome e categoria obrigatórios.");
  const existing = id ? list("catalog").find((c) => c.id === id) : null;
  if (id && !existing) throw Error("Item não encontrado.");
  if (existing?.prices.some((p) => p.date === day))
    throw Error(
      "Já existe um custo nessa data. Use outra vigência; o histórico é preservado.",
    );
  res.json(
    put(
      "catalog",
      existing
        ? {
            ...existing,
            prices: [...existing.prices, { date: day, value: cost }],
          }
        : {
            id: randomUUID(),
            name: name.trim(),
            type,
            prices: [{ date: day, value: cost }],
          },
    ),
  );
});
app.post("/api/quote", (req, res) =>
  res.json(calculate(req.body, list("catalog"))),
);
app.post("/api/orders", (req, res) =>
  res.json(
    put("orders", {
      ...validateOrder(req.body, list("clients"), list("catalog")),
      id: randomUUID(),
      demo: false,
    }),
  ),
);
app.patch("/api/orders/:id", (req, res) => {
  const o = list("orders").find((o) => o.id === req.params.id);
  if (!o) throw Error("Pedido não encontrado.");
  const { status, payment } = req.body;
  if (
    !["Aberto", "Em produção", "Pronto", "Entregue", "Cancelado"].includes(
      status,
    ) ||
    !["Pendente", "Parcial", "Pago"].includes(payment)
  )
    throw Error("Status inválido.");
  res.json(put("orders", { ...o, status, payment }));
});
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});
const previews = new Map();
app.post("/api/import/preview", upload.single("file"), async (req, res) => {
  if (!req.file || !req.file.originalname.toLowerCase().endsWith(".xlsx"))
    throw Error("Selecione um arquivo .xlsx de até 8 MB.");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(req.file.buffer);
  const sheets = workbook.worksheets.map((s) => {
    if (s.rowCount > 10000 || s.columnCount > 80)
      throw Error("Limite de importação: 10.000 linhas e 80 colunas por aba.");
    return {
      name: s.name,
      rows: Array.from({ length: s.rowCount }, (_, i) =>
        Array.from({ length: s.columnCount }, (_, j) => {
          const cell = s.getRow(i + 1).getCell(j + 1);
          if (cell.type === ExcelJS.ValueType.Formula)
            return "[FÓRMULA: conferir valor no Excel]";
          if (cell.value instanceof Date)
            return cell.value.toISOString().slice(0, 10);
          return cell.text;
        }),
      ),
    };
  });
  const token = randomUUID();
  previews.set(token, { sheets, expires: Date.now() + 30 * 60 * 1000 });
  for (const [k, v] of previews) if (v.expires < Date.now()) previews.delete(k);
  res.json({ token, sheets });
});
function importedRows(body) {
  const preview = previews.get(body.token);
  if (!preview || preview.expires < Date.now())
    throw Error("Pré-visualização expirada. Envie novamente.");
  const sheet = preview.sheets.find((s) => s.name === body.sheet);
  if (!sheet) throw Error("Aba inválida.");
  const start = number(body.header, "Linha do cabeçalho", true);
  if (start < 1 || start >= sheet.rows.length)
    throw Error("Linha do cabeçalho inválida.");
  const field = (row, key) => {
    const i = Number(body.mapping?.[key]);
    return body.mapping?.[key] !== "" && Number.isInteger(i) && i >= 0
      ? String(row[i] ?? "").trim()
      : "";
  };
  const decimal = (v) => {
    if (!v) return undefined;
    const s = v.replace(/R\$|\s/g, "");
    return s.includes(",")
      ? Number(s.replace(/\./g, "").replace(",", "."))
      : Number(s);
  };
  const rows = sheet.rows
    .slice(start)
    .map((r, i) => {
      if (!r.some(Boolean)) return null;
      try {
        const name = field(r, "client");
        if (!name) throw Error("Cliente ausente.");
        const day = date(field(r, "date"), "Data do pedido");
        const delivery = date(field(r, "delivery"), "Entrega");
        if (delivery < day) throw Error("Entrega anterior ao pedido.");
        const quantity = number(
          decimal(field(r, "quantity")),
          "Quantidade",
          true,
        );
        if (!quantity) throw Error("Quantidade deve ser positiva.");
        const total = number(decimal(field(r, "total")), "Venda");
        const cost = number(decimal(field(r, "cost")), "Custo histórico");
        const status = field(r, "status"),
          payment = field(r, "payment");
        if (
          ![
            "Aberto",
            "Em produção",
            "Pronto",
            "Entregue",
            "Cancelado",
          ].includes(status)
        )
          throw Error("Status ausente ou inválido.");
        if (!["Pendente", "Parcial", "Pago"].includes(payment))
          throw Error("Pagamento ausente ou inválido.");
        const model = field(r, "model");
        if (!model) throw Error("Modelo ausente.");
        return {
          line: start + i + 1,
          valid: true,
          name,
          date: day,
          delivery,
          quantity,
          total,
          cost,
          profit: money(total - cost),
          margin: total ? money(((total - cost) / total) * 100) : null,
          status,
          payment,
          theme: field(r, "theme"),
          collection: field(r, "collection"),
          notes: field(r, "notes"),
          model,
        };
      } catch (e) {
        return { line: start + i + 1, valid: false, error: e.message };
      }
    })
    .filter(Boolean);
  return rows;
}
app.post("/api/import/check", (req, res) =>
  res.json({ rows: importedRows(req.body) }),
);
app.post("/api/import/confirm", (req, res) => {
  if (req.body.confirmation !== "CONFIRMAR IMPORTAÇÃO")
    throw Error("Confirmação explícita necessária.");
  const rows = importedRows(req.body);
  if (!rows.length || rows.some((r) => !r.valid))
    throw Error("Corrija todos os erros antes de importar.");
  const existing = list("orders");
  const signature = (o) =>
    JSON.stringify([
      o.importName || list("clients").find((c) => c.id === o.clientId)?.name,
      o.date,
      o.delivery,
      o.quantity,
      o.total,
      o.cost,
      o.theme,
      o.collection,
      o.lines?.[0]?.name,
    ]);
  const signatures = new Set(existing.map(signature));
  const candidates = rows.map((r) => ({
    ...r,
    importName: r.name,
    lines: [
      {
        name: r.model,
        type: "Modelo",
        quantity: r.quantity,
        unit: null,
        total: null,
      },
    ],
    imported: true,
    demo: false,
  }));
  for (const r of candidates) {
    const key = signature(r);
    if (signatures.has(key))
      throw Error(
        `Linha ${r.line}: possível pedido duplicado. Confira antes de importar.`,
      );
    signatures.add(key);
  }
  transaction(() => {
    for (const r of candidates) {
      let client = list("clients").find(
        (c) => c.name.toLocaleLowerCase() === r.name.toLocaleLowerCase(),
      );
      if (!client)
        client = put("clients", {
          id: randomUUID(),
          name: r.name,
          phone: "",
          email: "",
          notes: "Importado do Excel",
        });
      put("orders", { ...r, id: randomUUID(), clientId: client.id });
    }
  });
  previews.delete(req.body.token);
  res.json({ count: rows.length });
});
app.get("/api/export", async (req, res) => {
  const w = new ExcelJS.Workbook();
  for (const [name, kind] of [
    ["Pedidos", "orders"],
    ["Clientes", "clients"],
    ["Custos", "catalog"],
  ]) {
    const s = w.addWorksheet(name);
    if (kind === "orders") {
      s.addRow([
        "Cliente",
        "Data",
        "Entrega",
        "Tema",
        "Coleção",
        "Peças",
        "Venda",
        "Custo",
        "Lucro bruto",
        "Margem %",
        "Produção",
        "Pagamento",
        "Demonstração",
      ]);
      for (const o of list(kind))
        s.addRow([
          list("clients").find((c) => c.id === o.clientId)?.name,
          o.date,
          o.delivery,
          o.theme,
          o.collection,
          o.quantity,
          o.total,
          o.cost,
          o.profit,
          o.margin,
          o.status,
          o.payment,
          o.demo ? "Sim" : "Não",
        ]);
    } else if (kind === "clients") {
      s.addRow(["Nome", "Telefone", "Email", "Observações"]);
      for (const c of list(kind)) s.addRow([c.name, c.phone, c.email, c.notes]);
    } else {
      s.addRow(["Item", "Categoria", "Vigência", "Custo"]);
      for (const c of list(kind))
        for (const p of c.prices) s.addRow([c.name, c.type, p.date, p.value]);
    }
    s.getRow(1).font = { bold: true };
    s.columns.forEach((c) => (c.width = 22));
  }
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="Encanto-exportacao.xlsx"',
  );
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  await w.xlsx.write(res);
  res.end();
});
app.use((err, req, res, next) =>
  res.status(400).json({ error: err.message || "Não foi possível concluir." }),
);
app.listen(
  Number(process.env.PORT || 3000),
  process.env.HOST || "127.0.0.1",
  () =>
    console.log(
      `Encanto Criativo iniciada na porta ${process.env.PORT || 3000}. Armazenamento: ${directory}`,
    ),
);
