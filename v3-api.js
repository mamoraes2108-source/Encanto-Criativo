import { randomUUID, createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createBackup } from "./backup.js";
import { text } from "./v2-domain.js";
import {
  validateExpense,
  financialSummary,
  settingsDefaults,
  orderResult,
  validateIncludedRevision,
} from "./v3-domain.js";
import { purchasePdf } from "./purchase-pdf.js";
import { privateAccess } from "./v2-api.js";
export function registerV3(app, { db, list, put, transaction, directory }) {
  const getSettings = () => ({
    ...settingsDefaults,
    ...list("settings").find((s) => s.id === "v3-settings"),
  });
  const snapshot = () =>
    createHash("sha256")
      .update(
        JSON.stringify(
          db.prepare("SELECT * FROM records ORDER BY kind,id").all(),
        ),
      )
      .digest("hex");
  const backup = async () => {
    await fs.mkdir(path.join(directory, "backups"), { recursive: true });
    const filename = `v3-${Date.now()}-${randomUUID()}.zip`;
    await createBackup(directory, path.join(directory, "backups", filename));
    return filename;
  };
  const history = (before, after, reason, kind) =>
    put("expenseHistory", {
      id: randomUUID(),
      entityId: after.id,
      kind,
      at: new Date().toISOString(),
      reason,
      before,
      after,
    });
  app.get("/api/v3/data", (req, res) =>
    res.json({
      expenses: list("expenses"),
      expenseHistory: list("expenseHistory"),
      settings: getSettings(),
    }),
  );
  app.get("/api/v3/finance", (req, res) =>
    res.json(
      financialSummary(
        list("orders"),
        list("expenses"),
        list("payments"),
        req.query,
      ),
    ),
  );
  app.post("/api/v3/settings", (req, res) => {
    const b = req.body,
      lowMargin = Number(b.lowMargin);
    if (!Number.isFinite(lowMargin) || lowMargin < 0 || lowMargin > 100)
      throw Error("Margem deve estar entre 0 e 100%.");
    const next = { id: "v3-settings", lowMargin };
    for (const key of [
      "company",
      "pix",
      "instagram",
      "phone",
      "businessDetails",
      "thanks",
    ])
      next[key] = text(b[key] || "", key, key === "thanks" ? 2000 : 500);
    if (!next.company || !next.thanks)
      throw Error("Nome comercial e agradecimento são obrigatórios.");
    const old = getSettings();
    if ((b.revision || 0) !== (old.revision || 0))
      throw Error("Configurações alteradas em outra janela. Reabra.");
    next.revision = (old.revision || 0) + 1;
    transaction(() => {
      history(old, next, "Configuração comercial", "settings");
      put("settings", next);
    });
    res.json(next);
  });
  app.post("/api/v3/expenses", (req, res) => {
    const next = {
      ...validateExpense(req.body, list("orders"), list("expenses")),
      id: randomUUID(),
      revision: 0,
      cancelled: false,
    };
    transaction(() => {
      put("expenses", next);
      history(null, next, "Cadastro", "expense");
    });
    res.json(next);
  });
  app.put("/api/v3/expenses/:id", (req, res) => {
    const old = list("expenses").find((e) => e.id === req.params.id);
    if (!old || old.cancelled)
      throw Error("Lançamento inexistente ou cancelado.");
    if (req.body.revision !== old.revision)
      throw Error("Lançamento alterado em outra janela. Reabra.");
    const reason = text(req.body.reason || "", "Motivo", 1000);
    if (!reason) throw Error("Informe o motivo da alteração.");
    let next;
    if (req.body.cancel === true) {
      if (req.body.confirmation !== "CANCELAR LANÇAMENTO")
        throw Error("Confirme o cancelamento.");
      next = { ...old, cancelled: true, revision: old.revision + 1 };
    } else
      next = {
        ...old,
        ...validateExpense(req.body, list("orders"), list("expenses"), old),
        revision: old.revision + 1,
      };
    transaction(() => {
      put("expenses", next);
      history(old, next, reason, "expense");
    });
    res.json(next);
  });
  app.use("/api/v2/orders/:id", (req, res, next) => {
    if (req.method === "PUT" && req.body.financial)
      validateIncludedRevision(req.params.id, req.body.draft, list("expenses"));
    next();
  });
  app.get("/api/v3/orders/:id/result", (req, res) => {
    const o = list("orders").find((o) => o.id === req.params.id);
    if (!o) throw Error("Pedido não encontrado.");
    res.json(orderResult(o, list("expenses")));
  });
  app.get("/api/v3/orders/:id/pdf", privateAccess, async (req, res) => {
    const o = list("orders").find((o) => o.id === req.params.id);
    if (!o) throw Error("Pedido não encontrado.");
    const client = list("clients").find((c) => c.id === o.clientId);
    if (!client) throw Error("Cliente não encontrado.");
    const custom = list("documents").find((d) => d.orderId === o.id) || {};
    const pdf = await purchasePdf(
      o,
      client,
      list("payments"),
      getSettings(),
      custom,
    );
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="Pedido-Encanto.pdf"',
    );
    res.send(pdf);
  });
  app.get("/api/v3/orders/:id/document", privateAccess, (req, res) =>
    res.json(
      list("documents").find((d) => d.orderId === req.params.id) || {
        orderId: req.params.id,
      },
    ),
  );
  app.post("/api/v3/orders/:id/document", privateAccess, (req, res) => {
    if (!list("orders").some((o) => o.id === req.params.id))
      throw Error("Pedido não encontrado.");
    const next = { id: "document-" + req.params.id, orderId: req.params.id };
    for (const k of ["thanks", "art", "packaging"])
      next[k] = text(req.body[k] || "", k, 2000);
    res.json(put("documents", next));
  });
  const names = [
    "Caneca cerâmica 325 ml",
    "Xícara com pires",
    "Caixa presente",
    "Laço de cetim",
    "Chocolate",
  ];
  const plan = () => ({
    snapshot: snapshot(),
    items: list("catalog")
      .filter((c) => c.demo === true && names.includes(c.name) && !c.archived)
      .map((c) => ({
        id: c.id,
        name: c.name,
        referencedOrders: list("orders").filter((o) =>
          o.lines.some((l) => l.id === c.id),
        ).length,
        action: "Arquivar; preservar registro, preços e referências históricas",
      })),
  });
  app.post("/api/v3/catalog/preview", (req, res) => res.json(plan()));
  app.post("/api/v3/catalog/retire", async (req, res) => {
    if (req.body.confirmation !== "ARQUIVAR SOMENTE ITENS FICTÍCIOS")
      throw Error("Confirmação explícita obrigatória.");
    const p = plan();
    if (req.body.snapshot !== p.snapshot)
      throw Error("Dados mudaram. Gere nova prévia.");
    if (
      !Array.isArray(req.body.ids) ||
      !req.body.ids.length ||
      new Set(req.body.ids).size !== req.body.ids.length ||
      req.body.ids.some((id) => !p.items.some((c) => c.id === id))
    )
      throw Error("Confira os itens selecionados.");
    const filename = await backup();
    transaction(() => {
      if (snapshot() !== p.snapshot)
        throw Error("Dados mudaram durante o backup. Gere nova prévia.");
      for (const id of req.body.ids) {
        const old = list("catalog").find((c) => c.id === id);
        const next = { ...old, archived: true };
        put("catalog", next);
        history(old, next, "Retirada conferida de demonstração", "catalog");
      }
    });
    res.json({ count: req.body.ids.length, backup: filename });
  });
}
