import PDFDocument from "pdfkit";
import { fileURLToPath } from "node:url";
import { paymentSummary } from "./v2-domain.js";
const brl = (n) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    n || 0,
  );
const day = (d) => (d ? d.split("-").reverse().join("/") : "A combinar");
export function purchasePdf(order, client, payments, settings, custom = {}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 48,
      info: {
        Title: "Pedido de Compra — Encanto Criativo",
        Author: settings.company,
      },
    });
    doc.registerFont(
      "Encanto",
      fileURLToPath(
        new URL("./assets/fonts/LiberationSans-Regular.ttf", import.meta.url),
      ),
    );
    doc.registerFont(
      "EncantoBold",
      fileURLToPath(
        new URL("./assets/fonts/LiberationSans-Bold.ttf", import.meta.url),
      ),
    );
    const buffers = [];
    doc.on("data", (b) => buffers.push(b));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);
    const ink = "#342c26",
      rose = "#bd8077",
      line = "#e3d0c9";
    const collection =
      [
        ...new Set(
          order.lines
            .filter((l) => l.type === "Modelo")
            .map((l) => l.collection || order.collection || "A combinar"),
        ),
      ].join(" / ") ||
      order.collection ||
      "A combinar";
    const write = (s, size = 11, bold = false, options = {}) =>
      doc
        .fillColor(ink)
        .font(bold ? "EncantoBold" : "Encanto")
        .fontSize(size)
        .text(String(s || "—"), options);
    const section = (title) => {
      if (doc.y > 690) doc.addPage();
      doc.moveDown(1.3);
      doc.fillColor(rose).font("EncantoBold").fontSize(10).text(title);
      const y = doc.y + 3;
      doc
        .strokeColor(line)
        .lineWidth(0.5)
        .moveTo(48, y)
        .lineTo(547, y)
        .stroke();
      doc.y = y + 12;
    };
    const detail = (label, value) => {
      if (doc.y > 705) doc.addPage();
      doc.fillColor("#7d7068").font("EncantoBold").fontSize(9).text(label);
      doc.moveDown(0.3);
      write(value);
      doc.moveDown(0.8);
    };
    try {
      doc.image(
        fileURLToPath(new URL("./public/logo-encanto.jpg", import.meta.url)),
        54,
        42,
        { width: 78 },
      );
      // Match the three-column header and generous white space of the supplied reference.
      doc.x = 218;
      doc.y = 44;
      write(settings.company.toUpperCase(), 17, true, { width: 158 });
      doc.moveDown(0.5);
      write("Presentes feitos para encantar", 9, false, { width: 160 });
      doc.x = 383;
      doc.y = 44;
      write("PEDIDO DE COMPRA", 10, true, { width: 164 });
      doc.moveDown(0.7);
      write(collection, 9, false, { width: 164 });
      doc.moveDown(0.5);
      write("Cliente: " + client.name, 10, true, { width: 164 });
      const headerBottom = Math.max(142, doc.y + 18);
      doc.x = 48;
      doc.y = headerBottom;
      doc
        .strokeColor(line)
        .moveTo(48, headerBottom)
        .lineTo(547, headerBottom)
        .stroke();
      doc.y = headerBottom + 13;
      write("Obrigada pela compra!", 23, true);
      doc.moveDown(0.5);
      doc
        .fillColor(rose)
        .font("EncantoBold")
        .fontSize(13)
        .text("Uma escolha incrível.");
      doc.moveDown(0.6);
      write(custom.thanks || settings.thanks, 11, false, { width: 360 });
      doc.moveDown(1.6);
      section("DETALHES DO PEDIDO");
      detail(
        "PRODUTO",
        order.lines
          .filter((l) => l.type === "Modelo")
          .map((l) => l.name)
          .join(" / "),
      );
      detail("COLEÇÃO", collection);
      detail(
        "PERSONALIZAÇÃO",
        order.description || order.theme || "A combinar",
      );
      detail("ARTE", custom.art || order.theme || "A combinar");
      detail(
        "EMBALAGEM",
        custom.packaging ||
          order.lines
            .filter((l) => l.type === "Embalagem")
            .map((l) => `${l.quantity} × ${l.name}`)
            .join(" / ") ||
          "A combinar",
      );
      section("RESUMO DE VALORES");
      for (const l of order.lines.filter((l) => l.type === "Modelo")) {
        const sale = l.revenue ?? l.sale;
        write(
          `${l.quantity} un. ${l.name}${sale == null ? "" : ": " + brl(sale) + " (total da linha)"}`,
          11,
        );
        doc.moveDown(0.4);
      }
      if (order.discount)
        write("Desconto geral já aplicado: " + brl(order.discount), 10);
      if (
        order.lines.some(
          (l) => l.type === "Modelo" && l.revenue == null && l.sale == null,
        )
      )
        write(
          "Composição dos valores unitários não informada no histórico; total preservado.",
          9,
        );
      doc.moveDown(1);
      write(
        "TOTAL DO PEDIDO                       " + brl(order.total),
        17,
        true,
      );
      const f = paymentSummary(order, payments);
      doc.moveDown(0.7);
      if (f.needsReconciliation)
        write("Sinal recebido e saldo: a conferir no histórico.", 10);
      else
        write(
          `Recebido líquido: ${brl(f.received)} · Saldo a pagar: ${brl(f.balance)}`,
          10,
        );
      section("PAGAMENTO VIA PIX");
      write(settings.pix || "Dados de pagamento a combinar.", 11);
      if (settings.businessDetails) {
        doc.moveDown(0.4);
        write(settings.businessDetails, 10);
      }
      section("ENTREGA");
      write("Previsão de entrega: " + day(order.delivery), 11);
      doc.moveDown(1);
      write("Tem carinho que vira encanto.", 11, true);
      doc.moveDown(0.8);
      write(
        [settings.instagram, settings.phone].filter(Boolean).join(" · ") ||
          settings.company,
        9,
      );
      doc.moveDown(0.5);
      write("Confirmação comercial da encomenda. Não é nota fiscal.", 8);
      doc.end();
    } catch (e) {
      reject(e);
      doc.destroy();
    }
  });
}
