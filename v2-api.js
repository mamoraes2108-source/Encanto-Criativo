import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import multer from "multer";
import sharp from "sharp";
import {
  computeV2,
  paymentSummary,
  collectionReport,
  suggestedPrice,
  text,
  cents,
  statuses,
} from "./v2-domain.js";
import { money, date, number } from "./domain.js";
import { createBackup, restoreBackup, inspectBackup } from "./backup.js";
export function registerV2(app, { db, list, put, transaction, directory }) {
  const sessions = new Map();
  const restorePreviews = new Map();
  const getOrder = (id) => {
    const o = list("orders").find((o) => o.id === id);
    if (!o) throw Error("Pedido não encontrado.");
    return o;
  };
  const revision = (o) => o.revision || 0;
  const guard = (o, body) => {
    if (body.revision !== revision(o))
      throw Error(
        "Pedido atualizado em outra janela. Reabra e confira antes de salvar.",
      );
  };
  const history = (old, next, reason, action) =>
    put("history", {
      id: randomUUID(),
      orderId: old.id,
      at: new Date().toISOString(),
      reason: text(reason, "Motivo", 1000),
      action,
      before: old,
      after: next,
    });
  const record = (old, next, reason, action) =>
    transaction(() => {
      if (!text(reason || "", "Motivo", 1000)) throw Error("Informe o motivo.");
      history(old, next, reason, action);
      return put("orders", next);
    });
  const privateAccess = (req, res, next) => {
    const token = req.headers.cookie
      ?.split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("encanto_session="))
      ?.split("=")[1];
    if (!token || !sessions.has(token) || sessions.get(token) < Date.now())
      return res.status(403).json({
        error: "Abra o sistema neste navegador para acessar arquivos privados.",
      });
    next();
  };
  app.get("/api/session", (req, res) => {
    for (const [k, v] of sessions) if (v < Date.now()) sessions.delete(k);
    const token = randomUUID();
    sessions.set(token, Date.now() + 8 * 60 * 60 * 1000);
    res.setHeader(
      "Set-Cookie",
      `encanto_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`,
    );
    res.json({ ok: true });
  });
  app.get("/api/v2/data", (req, res) =>
    res.json({
      payments: list("payments"),
      history: list("history"),
      artworks: list("artworks"),
      orders: list("orders").map((o) => ({
        id: o.id,
        ...paymentSummary(o, list("payments")),
      })),
    }),
  );
  app.post("/api/v2/quote", (req, res) => {
    const old = req.body.orderId ? getOrder(req.body.orderId) : null;
    res.json(computeV2(req.body, list("catalog"), old));
  });
  app.post("/api/v2/suggest", (req, res) => {
    let cost = req.body.cost;
    if (cost === undefined) {
      const quantity = number(req.body.quantity, "Quantidade", true);
      if (quantity < 1 || quantity > 1000000)
        throw Error("Quantidade deve estar entre 1 e 1 milhão.");
      cost =
        (cents(req.body.unitCost) / 100) * quantity +
        cents(req.body.additional) / 100;
    }
    res.json(suggestedPrice(cost, req.body.margin));
  });
  app.post("/api/v2/orders", (req, res) => {
    const next = computeV2(req.body, list("catalog"));
    if (!list("clients").some((c) => c.id === next.clientId))
      throw Error("Cliente não encontrado.");
    if (next.status === "Cancelado")
      throw Error("Crie um pedido ativo antes de cancelar.");
    res.json(
      put("orders", {
        ...next,
        id: randomUUID(),
        revision: 0,
        payment: "Pendente",
        demo: req.body.demo === true,
      }),
    );
  });
  app.put("/api/v2/orders/:id", (req, res) => {
    const old = getOrder(req.params.id);
    guard(old, req.body);
    if (old.status === "Cancelado")
      throw Error(
        "Pedido cancelado é imutável; registre novo pedido se necessário.",
      );
    let next;
    if (req.body.financial === true) {
      if (req.body.confirmation !== "CONFIRMAR REVISÃO FINANCEIRA")
        throw Error("Confirmação financeira obrigatória.");
      next = { ...old, ...computeV2(req.body.draft, list("catalog"), old) };
    } else {
      const d = req.body.draft;
      date(d.date, "Data do pedido");
      if (d.delivery) {
        date(d.delivery, "Entrega");
        if (d.delivery < d.date) throw Error("Entrega anterior ao pedido.");
      }
      next = {
        ...old,
        clientId: text(d.clientId, "Cliente", 100),
        date: d.date,
        delivery: d.delivery || "",
        theme: text(d.theme || "", "Tema", 1000),
        description: text(d.description || "", "Personalização", 4000),
        notes: text(d.notes || "", "Observações", 4000),
        status: d.status,
      };
    }
    if (!statuses.includes(next.status) || next.status === "Cancelado")
      throw Error("Use a operação de cancelamento controlado.");
    if (!list("clients").some((c) => c.id === next.clientId))
      throw Error("Cliente inválido.");
    const payments = paymentSummary(old, list("payments"));
    if (next.total < payments.received)
      throw Error(
        "Venda menor que os recebimentos. Estorne a diferença antes de revisar o pedido.",
      );
    next.legacyPayment =
      old.legacyPayment ?? (old.schemaVersion !== 2 ? old.payment : null);
    next.revision = revision(old) + 1;
    next.payment = paymentSummary(next, list("payments")).payment;
    res.json(
      record(
        old,
        next,
        req.body.reason,
        req.body.financial ? "Revisão financeira" : "Edição cadastral",
      ),
    );
  });
  app.post("/api/v2/orders/:id/cancel", (req, res) => {
    const old = getOrder(req.params.id);
    guard(old, req.body);
    if (old.status === "Cancelado") throw Error("Pedido já cancelado.");
    if (req.body.confirmation !== "CONFIRMAR CANCELAMENTO")
      throw Error("Confirme o cancelamento.");
    const summary = paymentSummary(old, list("payments"));
    res.json(
      record(
        old,
        { ...old, status: "Cancelado", revision: revision(old) + 1 },
        req.body.reason,
        `Cancelamento: ${summary.received} a devolver. Estorno precisa ser registrado quando efetivamente ocorrer.`,
      ),
    );
  });
  app.post("/api/v2/orders/:id/payments", (req, res) => {
    const old = getOrder(req.params.id);
    guard(old, req.body);
    const b = req.body;
    date(b.date, "Data do recebimento/estorno");
    const value = cents(b.value) / 100;
    if (!value) throw Error("O valor deve ser positivo.");
    if (!["receipt", "refund"].includes(b.type))
      throw Error("Tipo de movimento inválido.");
    const method = text(b.method || "", "Forma de pagamento", 100);
    if (!method) throw Error("Informe a forma de pagamento.");
    const reason = text(b.reason || "", "Motivo", 1000);
    if (!reason) throw Error("Informe a identificação/motivo do movimento.");
    const summary = paymentSummary(old, list("payments"));
    if (
      b.type === "receipt" &&
      (old.status === "Cancelado" ||
        value > money(old.total - summary.received))
    )
      throw Error(
        "Recebimento superior ao saldo ou pedido cancelado. Revise o pedido antes de receber excedentes.",
      );
    if (
      b.type === "receipt" &&
      summary.needsReconciliation &&
      b.confirmLegacy !== "CONFIRMAR RECEBIMENTO HISTÓRICO"
    )
      throw Error(
        "Confirme a conferência dos comprovantes históricos antes de registrar.",
      );
    let original = null;
    if (b.type === "refund") {
      original = list("payments").find(
        (p) =>
          p.id === b.receiptId && p.orderId === old.id && p.type === "receipt",
      );
      if (!original)
        throw Error("Selecione o recebimento original para estorno.");
      const refunded = list("payments")
        .filter((p) => p.type === "refund" && p.receiptId === original.id)
        .reduce((s, p) => s + p.value, 0);
      if (value > money(original.value - refunded) || value > summary.received)
        throw Error("Estorno excede o recebimento disponível.");
      if (b.date < original.date)
        throw Error("Estorno anterior ao recebimento.");
      if (b.confirmation !== "CONFIRMAR ESTORNO")
        throw Error("Confirmação do estorno obrigatória.");
    }
    const entry = {
      id: randomUUID(),
      orderId: old.id,
      type: b.type,
      value,
      date: b.date,
      method,
      reason,
      receiptId: original?.id || null,
      at: new Date().toISOString(),
      label: b.label === "Sinal" ? "Sinal" : "Complementar",
    };
    res.json(
      transaction(() => {
        put("payments", entry);
        const next = {
          ...old,
          legacyPayment:
            old.legacyPayment ?? (old.schemaVersion !== 2 ? old.payment : null),
          revision: revision(old) + 1,
          payment: paymentSummary(old, list("payments")).payment,
        };
        history(
          old,
          next,
          reason,
          b.type === "receipt" ? "Recebimento" : "Estorno",
        );
        put("orders", next);
        return entry;
      }),
    );
  });
  app.get("/api/v2/collections", (req, res) =>
    res.json(
      collectionReport(
        list("orders").filter(
          (o) =>
            (!req.query.from || o.date >= req.query.from) &&
            (!req.query.to || o.date <= req.query.to),
        ),
      ),
    ),
  );
  app.post("/api/v2/clients/check", (req, res) => {
    const phone = text(req.body.phone || "", "Telefone", 50).replace(/\D/g, ""),
      email = text(req.body.email || "", "E-mail", 200).toLowerCase();
    res.json({
      matches: list("clients").filter(
        (c) =>
          (phone && c.phone?.replace(/\D/g, "") === phone) ||
          (email && c.email?.toLowerCase() === email),
      ),
    });
  });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 5 },
  });
  app.post(
    "/api/v2/orders/:id/artworks",
    privateAccess,
    upload.single("file"),
    async (req, res) => {
      const old = getOrder(req.params.id);
      if (old.status === "Cancelado") throw Error("Pedido cancelado.");
      if (!req.file) throw Error("Selecione uma imagem.");
      const ext = path.extname(req.file.originalname).toLowerCase();
      if (![".png", ".jpg", ".jpeg", ".webp"].includes(ext))
        throw Error("Use PNG, JPG ou WebP.");
      const image = sharp(req.file.buffer, {
        limitInputPixels: 16000000,
        failOn: "warning",
      });
      const meta = await image.metadata();
      if (!["png", "jpeg", "webp"].includes(meta.format) || meta.pages > 1)
        throw Error("Imagem estática inválida.");
      if (
        !(
          { ".png": "png", ".jpg": "jpeg", ".jpeg": "jpeg", ".webp": "webp" }[
            ext
          ] === meta.format
        )
      )
        throw Error("Extensão não corresponde ao conteúdo.");
      const bytes = await image.rotate().toFormat(meta.format).toBuffer();
      const id = randomUUID(),
        filename = id + (meta.format === "jpeg" ? ".jpg" : "." + meta.format);
      await fs.mkdir(path.join(directory, "artworks"), {
        recursive: true,
        mode: 0o700,
      });
      await fs.writeFile(path.join(directory, "artworks", filename), bytes, {
        flag: "wx",
        mode: 0o600,
      });
      try {
        res.json(
          put("artworks", {
            id,
            orderId: old.id,
            filename,
            name: path.basename(req.file.originalname).slice(0, 200),
            status: "Em elaboração",
            at: new Date().toISOString(),
            approvedOn: null,
            history: [],
          }),
        );
      } catch (e) {
        await fs.unlink(path.join(directory, "artworks", filename));
        throw e;
      }
    },
  );
  app.get(
    "/api/v2/orders/:id/artworks/:artId/file",
    privateAccess,
    (req, res) => {
      getOrder(req.params.id);
      const art = list("artworks").find(
        (a) => a.id === req.params.artId && a.orderId === req.params.id,
      );
      if (!art) throw Error("Anexo não encontrado.");
      if (!/^[-a-f0-9]+\.(png|jpg|webp)$/.test(art.filename))
        throw Error("Caminho inválido.");
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.sendFile(path.resolve(directory, "artworks", art.filename));
    },
  );
  app.patch("/api/v2/orders/:id/artworks/:artId", (req, res) => {
    const art = list("artworks").find(
      (a) => a.id === req.params.artId && a.orderId === req.params.id,
    );
    if (!art) throw Error("Anexo não encontrado.");
    if (req.body.version !== art.history.length)
      throw Error("Arte mudou em outra janela. Reabra o pedido.");
    const status = req.body.status;
    if (
      ![
        "Em elaboração",
        "Enviada",
        "Aprovada",
        "Substituída",
        "Removida",
      ].includes(status)
    )
      throw Error("Status da arte inválido.");
    const reason = text(req.body.reason || "", "Motivo", 1000);
    if (!reason) throw Error("Informe o motivo.");
    let approvedOn = null;
    if (status === "Aprovada")
      approvedOn = date(req.body.approvedOn, "Data de aprovação");
    if (status === "Removida" && req.body.confirmation !== "CONFIRMAR REMOÇÃO")
      throw Error("Confirme a remoção lógica.");
    res.json(
      put("artworks", {
        ...art,
        status,
        approvedOn,
        history: [
          ...art.history,
          {
            at: new Date().toISOString(),
            before: { status: art.status, approvedOn: art.approvedOn },
            after: { status, approvedOn },
            reason,
          },
        ],
      }),
    );
  });
  app.post("/api/v2/backups", privateAccess, async (req, res) => {
    const id = randomUUID();
    await fs.mkdir(path.join(directory, "backups"), {
      recursive: true,
      mode: 0o700,
    });
    await createBackup(directory, path.join(directory, "backups", id + ".zip"));
    res.json({ id });
  });
  app.get("/api/v2/backups/:id", privateAccess, (req, res) => {
    if (!/^[-a-f0-9]{36}$/.test(req.params.id)) throw Error("Backup inválido.");
    res.download(
      path.resolve(directory, "backups", req.params.id + ".zip"),
      "Encanto-backup.zip",
    );
  });
  app.post(
    "/api/v2/restore/preview",
    privateAccess,
    multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: 100 * 1024 * 1024, files: 1 },
    }).single("file"),
    async (req, res) => {
      if (!req.file) throw Error("Selecione um backup.");
      const { manifest } = await inspectBackup(req.file.buffer);
      const token = randomUUID();
      for (const [k, v] of restorePreviews)
        if (v.expires < Date.now()) restorePreviews.delete(k);
      if (restorePreviews.size >= 3)
        throw Error("Limite de backups em prévia. Aguarde ou reinicie.");
      restorePreviews.set(token, {
        buffer: req.file.buffer,
        expires: Date.now() + 10 * 60 * 1000,
      });
      res.json({ token, manifest });
    },
  );
  app.post("/api/v2/restore/confirm", privateAccess, async (req, res) => {
    if (req.body.confirmation !== "RESTAURAR EM NOVA PASTA")
      throw Error("Confirmação necessária.");
    const p = restorePreviews.get(req.body.token);
    if (!p || p.expires < Date.now()) throw Error("Prévia expirada.");
    const dest = path.resolve(directory, "restored-" + randomUUID());
    await restoreBackup(p.buffer, dest);
    restorePreviews.delete(req.body.token);
    res.json({
      directory: dest,
      message:
        "Cópia validada em pasta nova. O banco ativo não foi alterado. Pare o sistema antes de escolher outra pasta de dados.",
    });
  });
}
