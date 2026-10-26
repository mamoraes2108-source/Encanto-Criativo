import express from "express";
import { registerV2 } from "./v2-api.js";
import { text, cents, collectionReport, paymentSummary } from "./v2-domain.js";
import multer from "multer";
import ExcelJS from "exceljs";
import JSZip from "jszip";
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
app.use((req, res, next) => {
  const host = req.hostname;
  if (!["127.0.0.1", "localhost", "[::1]", "::1"].includes(host))
    return res
      .status(403)
      .json({ error: "Acesso permitido somente pelo endereço local." });
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self' blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  );
  next();
});
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
registerV2(app, { db, list, put, transaction, directory });
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
  text(name, "Nome", 150);
  text(phone, "Telefone", 50);
  text(email, "E-mail", 200);
  text(notes, "Observações", 4000);
  if (!name.trim()) throw Error("Nome obrigatório.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw Error("E-mail inválido.");
  const normalizedPhone = phone.replace(/\D/g, ""),
    normalizedEmail = email.trim().toLowerCase();
  const duplicates = list("clients").filter(
    (c) =>
      (normalizedPhone && c.phone?.replace(/\D/g, "") === normalizedPhone) ||
      (normalizedEmail && c.email?.trim().toLowerCase() === normalizedEmail),
  );
  if (
    duplicates.length &&
    req.body.duplicateConfirmation !== "CADASTRAR SEM MESCLAR"
  )
    throw Error(
      "Telefone ou e-mail já cadastrado. Confira a duplicidade e confirme para cadastrar sem mesclar.",
    );
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
  const cost = cents(value) / 100;
  text(name, "Nome do material", 150);
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
app.post("/api/orders", (req, res) => {
  if (req.body.payment !== "Pendente")
    throw Error(
      "Novos pedidos começam pendentes; registre os recebimentos com data e valor.",
    );
  const keys = [
    "clientId",
    "date",
    "delivery",
    "theme",
    "collection",
    "unit",
    "amount",
    "piecesPerKit",
    "quantity",
    "lines",
    "printing",
    "extra",
    "total",
    "status",
    "payment",
    "notes",
  ];
  const input = Object.fromEntries(
    keys.filter((k) => req.body[k] !== undefined).map((k) => [k, req.body[k]]),
  );
  for (const key of ["theme", "collection", "notes"])
    if (input[key] !== undefined) text(input[key], key, 4000);
  if (input.status === "Cancelado")
    throw Error("Crie um pedido ativo antes de cancelar.");
  return res.json(
    put("orders", {
      ...validateOrder(input, list("clients"), list("catalog")),
      id: randomUUID(),
      demo: false,
    }),
  );
});
app.patch("/api/orders/:id", (req, res) => {
  const old = list("orders").find((o) => o.id === req.params.id);
  if (!old) throw Error("Pedido não encontrado.");
  const { status, payment } = req.body;
  if (
    !["Aberto", "Em produção", "Pronto", "Entregue"].includes(status) ||
    old.status === "Cancelado"
  )
    throw Error("Use o cancelamento controlado.");
  const auto = paymentSummary(old, list("payments")).payment;
  if (payment !== undefined && payment !== auto)
    throw Error("Pagamento é automático. Registre um recebimento ou estorno.");
  res.json(
    transaction(() => {
      const next = { ...old, status, revision: (old.revision || 0) + 1 };
      put("history", {
        id: randomUUID(),
        orderId: old.id,
        at: new Date().toISOString(),
        reason: "Alteração de produção",
        action: "Status",
        before: old,
        after: next,
      });
      return put("orders", next);
    }),
  );
});
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});
const previews = new Map();
app.post("/api/import/preview", upload.single("file"), async (req, res) => {
  if (!req.file || !req.file.originalname.toLowerCase().endsWith(".xlsx"))
    throw Error("Selecione um arquivo .xlsx de até 8 MB.");
  const archive = await JSZip.loadAsync(req.file.buffer);
  let expanded = 0;
  const entries = Object.values(archive.files);
  if (entries.length > 2000)
    throw Error("Planilha possui arquivos internos demais.");
  for (const f of entries) {
    expanded += f._data?.uncompressedSize || 0;
    if (expanded > 64 * 1024 * 1024)
      throw Error("Planilha excede 64 MB de conteúdo descompactado.");
  }
  if (previews.size >= 10) {
    for (const [k, v] of previews)
      if (v.expires < Date.now()) previews.delete(k);
    if (previews.size >= 10)
      throw Error(
        "Há muitas prévias abertas; reinicie o sistema ou aguarde expirar.",
      );
  }
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(req.file.buffer);
  const sheets = workbook.worksheets.map((s) => {
    if (s.rowCount > 10000 || s.columnCount > 80)
      throw Error("Limite de importação: 10.000 linhas e 80 colunas por aba.");
    return {
      name: s.name,
      formulaCount: s
        .getSheetValues()
        .reduce(
          (sum, row) =>
            sum +
            (row || []).filter(
              (v) =>
                v && typeof v === "object" && (v.formula || v.sharedFormula),
            ).length,
          0,
        ),
      emptyRows: Array.from({ length: s.rowCount }, (_, i) => {
        const row = s.getRow(i + 1);
        return !Array.from({ length: s.columnCount }, (_, j) => {
          const cell = row.getCell(j + 1);
          const v =
            cell.type === ExcelJS.ValueType.Formula ? cell.result : cell.text;
          return cell.type === ExcelJS.ValueType.Formula
            ? v != null && String(v).trim() !== "" && v !== 0 && v !== false
            : String(v ?? "").trim() !== "";
        }).some(Boolean);
      }),
      rows: Array.from({ length: s.rowCount }, (_, i) =>
        Array.from({ length: s.columnCount }, (_, j) => {
          const cell = s.getRow(i + 1).getCell(j + 1);
          if (cell.type === ExcelJS.ValueType.Formula)
            return cell.result !== undefined && cell.result !== null
              ? cell.result instanceof Date
                ? cell.result.toISOString().slice(0, 10)
                : String(cell.result)
              : "[FÓRMULA SEM RESULTADO: conferir no Excel]";
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
function numberSigned(value) {
  const s = value.replace(/R\$|\s/g, "");
  const n = Number(
    s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s,
  );
  if (!Number.isFinite(n)) throw Error("Lucro da planilha inválido.");
  return n;
}
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
      if (sheet.emptyRows[start + i]) return null;
      try {
        const name = field(r, "client");
        if (!name) throw Error("Cliente ausente.");
        const warnings = [];
        const importDate = (value, label) => {
          const match = /^(\d{1,2})\/+(\d{1,2})\/+(\d{4})$/.exec(value);
          if (!match) return date(value, label);
          const normalized = `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
          date(normalized, label);
          warnings.push(`${label}: ${value} → ${normalized}.`);
          return normalized;
        };
        const day = importDate(field(r, "date"), "Data do pedido");
        const delivery = importDate(field(r, "delivery"), "Entrega");
        if (delivery < day) throw Error("Entrega anterior ao pedido.");
        const quantity = number(
          decimal(field(r, "quantity")),
          "Quantidade",
          true,
        );
        if (!quantity) throw Error("Quantidade deve ser positiva.");
        const total = number(decimal(field(r, "total")), "Venda");
        const cost = number(decimal(field(r, "cost")), "Custo histórico");
        const originalStatus = field(r, "status");
        const status =
            originalStatus === "Agendado" ? "Aberto" : originalStatus,
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
        if (originalStatus === "Agendado")
          warnings.push(
            "Status Agendado → Aberto; status original preservado.",
          );
        const model = field(r, "model");
        if (!model) throw Error("Modelo ausente.");
        return {
          line: start + i + 1,
          valid: true,
          originalId: field(r, "originalId"),
          originalDate: field(r, "date"),
          originalDelivery: field(r, "delivery"),
          originalStatus,
          warnings,
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
          spreadsheetProfit: field(r, "profit")
            ? numberSigned(field(r, "profit"))
            : null,
          difference: field(r, "profit")
            ? money(numberSigned(field(r, "profit")) - money(total - cost))
            : null,
        };
      } catch (e) {
        return { line: start + i + 1, valid: false, error: e.message };
      }
    })
    .filter(Boolean);
  const existing = new Set(
    list("orders")
      .map((o) => String(o.originalId ?? "").trim())
      .filter(Boolean),
  );
  const counts = new Map();
  // Count IDs even on invalid rows, so no occurrence is silently selected.
  for (let i = start; i < sheet.rows.length; i++) {
    if (sheet.emptyRows[i]) continue;
    const id = field(sheet.rows[i], "originalId");
    if (id) counts.set(id, (counts.get(id) || 0) + 1);
  }
  for (const r of rows) {
    const id = field(sheet.rows[r.line - 1], "originalId");
    r.originalId = id;
    const issue = !id
      ? "ID original ausente: selecione a coluna e confira a planilha."
      : counts.get(id) > 1
        ? `ID original repetido no arquivo: ${id}. Confira todas as ocorrências.`
        : existing.has(id)
          ? `ID original já cadastrado: ${id}. Reimportação bloqueada.`
          : "";
    if (issue) {
      r.valid = false;
      r.error = [r.error, issue].filter(Boolean).join(" ");
    }
  }
  return rows;
}
app.post("/api/import/check", (req, res) =>
  res.json({ rows: importedRows(req.body) }),
);
app.post("/api/import/confirm", (req, res) => {
  if (req.body.confirmation !== "CONFIRMAR IMPORTAÇÃO")
    throw Error("Confirmação explícita necessária.");
  const sheet = previews
    .get(req.body.token)
    ?.sheets.find((s) => s.name === req.body.sheet);
  if (sheet?.formulaCount && req.body.acceptCachedFormulas !== true)
    throw Error(
      "Confirme a conferência dos resultados de fórmulas armazenados pelo Excel.",
    );
  const rows = importedRows(req.body);
  if (rows.some((r) => r.difference) && req.body.acceptDifferences !== true)
    throw Error("Confirme a conferência das divergências de lucro.");
  if (!rows.length || rows.some((r) => !r.valid))
    throw Error("Corrija todos os erros antes de importar.");
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
function materialRows(body) {
  const p = previews.get(body.token);
  if (!p || p.expires < Date.now()) throw Error("Prévia expirada.");
  const sheet = p.sheets.find((s) => s.name === body.sheet);
  if (!sheet) throw Error("Aba inválida.");
  const header = number(body.header, "Cabeçalho", true);
  if (header < 1 || header >= sheet.rows.length)
    throw Error("Cabeçalho inválido.");
  const field = (r, k) => {
    const v = body.mapping?.[k];
    return v !== "" && v !== undefined && /^\d+$/.test(String(v))
      ? String(r[Number(v)] ?? "").trim()
      : "";
  };
  return sheet.rows
    .slice(header)
    .map((r, i) => {
      if (sheet.emptyRows[header + i]) return null;
      try {
        const name = text(field(r, "name"), "Nome", 150),
          type = field(r, "type"),
          day = date(field(r, "date"), "Vigência"),
          raw = field(r, "value");
        if (
          !name ||
          !["Modelo", "Embalagem", "Complemento"].includes(type) ||
          !raw
        )
          throw Error("Nome, categoria, custo e vigência são obrigatórios.");
        const value = number(
          raw.includes(",")
            ? raw.replace(/R\$|\s|\./g, "").replace(",", ".")
            : raw,
          "Custo",
        );
        if (
          list("catalog").some(
            (c) =>
              c.name.toLowerCase() === name.toLowerCase() &&
              (c.type !== type || c.prices.some((p) => p.date === day)),
          )
        )
          throw Error(
            "Item com categoria incompatível ou vigência já cadastrada.",
          );
        cents(value);
        return {
          valid: true,
          line: header + i + 1,
          name,
          type,
          date: day,
          value,
        };
      } catch (e) {
        return { valid: false, line: header + i + 1, error: e.message };
      }
    })
    .filter(Boolean);
}
app.post("/api/import/materials/check", (req, res) => {
  const rows = materialRows(req.body),
    seen = new Set();
  for (const r of rows.filter((r) => r.valid)) {
    const key = r.name.toLowerCase() + "|" + r.date;
    if (seen.has(key)) {
      r.valid = false;
      r.error = "Vigência duplicada no arquivo.";
    }
    seen.add(key);
  }
  res.json({ rows });
});
app.post("/api/import/materials/confirm", (req, res) => {
  if (req.body.confirmation !== "CONFIRMAR IMPORTAÇÃO DE MATERIAIS")
    throw Error("Confirmação expressa necessária.");
  const rows = materialRows(req.body);
  if (!rows.length || rows.some((r) => !r.valid))
    throw Error("Corrija as pendências.");
  transaction(() => {
    for (const r of rows) {
      const existing = list("catalog").find(
        (c) => c.name.toLowerCase() === r.name.toLowerCase(),
      );
      if (
        existing &&
        (existing.type !== r.type ||
          existing.prices.some((p) => p.date === r.date))
      )
        throw Error("Vigência duplicada ou categoria incompatível.");
      put(
        "catalog",
        existing
          ? {
              ...existing,
              prices: [...existing.prices, { date: r.date, value: r.value }],
            }
          : {
              id: randomUUID(),
              name: r.name,
              type: r.type,
              prices: [{ date: r.date, value: r.value }],
            },
      );
    }
  });
  previews.delete(req.body.token);
  res.json({ count: rows.length });
});
app.get("/api/export", async (req, res) => {
  const realOrders = list("orders").filter((o) => o.demo !== true);
  const realIds = new Set(realOrders.map((o) => o.id));
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
        "ID original",
      ]);
      for (const o of realOrders)
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
          o.originalId || "",
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
  const collections = w.addWorksheet("Coleções");
  collections.addRow([
    "Coleção",
    "Faturamento",
    "Custo",
    "Lucro bruto",
    "Margem %",
    "Peças",
    "Participação %",
  ]);
  for (const c of collectionReport(realOrders))
    collections.addRow([
      c.name,
      c.total,
      c.cost,
      c.profit,
      c.margin,
      c.quantity,
      c.share,
    ]);
  const items = w.addWorksheet("Itens dos pedidos");
  items.addRow([
    "Pedido",
    "Item",
    "Categoria",
    "Coleção",
    "Quantidade",
    "Custo unitário",
    "Subtotal próprio",
    "Venda atribuída antes de desconto",
    "Receita líquida",
    "Custo comum rateado",
    "Custo atribuído",
  ]);
  for (const o of realOrders)
    for (const l of o.lines)
      items.addRow([
        o.id,
        l.name,
        l.type,
        l.collection ?? o.collection,
        l.quantity,
        l.unit,
        l.total,
        l.sale ?? null,
        l.revenue ?? null,
        l.allocatedCommon ?? null,
        l.allocatedCost ?? null,
      ]);
  const expenses = w.addWorksheet("Despesas");
  expenses.addRow(["Pedido", "Descrição", "Valor"]);
  for (const o of realOrders)
    for (const [name, value] of [
      ["Impressão", o.printing],
      ["Taxas", o.fees],
      ["Frete", o.shipping],
      ...(o.expenses || []).map((e) => [e.description, e.value]),
      ...(!o.expenses && o.extra
        ? [["Outras despesas históricas", o.extra]]
        : []),
    ])
      if (value !== undefined) expenses.addRow([o.id, name, value]);
  const cash = w.addWorksheet("Recebimentos");
  cash.addRow([
    "Pedido",
    "Movimento",
    "Data",
    "Valor",
    "Forma",
    "Motivo",
    "Recebimento original",
  ]);
  for (const p of list("payments").filter((p) => realIds.has(p.orderId)))
    cash.addRow([
      p.orderId,
      p.type === "receipt" ? "Recebimento" : "Estorno",
      p.date,
      p.value,
      p.method,
      p.reason,
      p.receiptId,
    ]);
  const audit = w.addWorksheet("Alterações");
  audit.addRow([
    "Pedido",
    "Data/hora",
    "Ação",
    "Motivo",
    "Venda anterior",
    "Venda nova",
    "Custo anterior",
    "Custo novo",
  ]);
  for (const h of list("history").filter((h) => realIds.has(h.orderId)))
    audit.addRow([
      h.orderId,
      h.at,
      h.action,
      h.reason,
      h.before.total,
      h.after.total,
      h.before.cost,
      h.after.cost,
    ]);
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
if (
  process.env.HOST &&
  !["127.0.0.1", "localhost", "::1"].includes(process.env.HOST)
)
  throw Error("HOST deve ser local; esta versão não permite exposição à rede.");
app.listen(
  Number(process.env.PORT || 3000),
  process.env.HOST || "127.0.0.1",
  () =>
    console.log(
      `Encanto Criativo iniciada na porta ${process.env.PORT || 3000}. Armazenamento: ${directory}`,
    ),
);
