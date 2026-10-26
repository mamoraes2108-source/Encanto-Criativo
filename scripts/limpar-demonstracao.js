import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  readReference,
  previewMaintenance,
  applyMaintenance,
} from "../maintenance.js";
const input = createInterface({ input: stdin, output: stdout });
try {
  console.log(
    "Pare o sistema com Ctrl+C antes de continuar. Esta rotina não importa pedidos.",
  );
  const directory = path.resolve(process.env.DATA_DIR || "data");
  console.log("Banco selecionado:", path.join(directory, "encanto.sqlite"));
  const filename = (
    await input.question(
      "Caminho completo da planilha Vendas_Encanto.xlsx (pode colar entre aspas): ",
    )
  )
    .trim()
    .replace(/^"|"$/g, "");
  const reference = await readReference(filename);
  const plan = await previewMaintenance(directory, reference);
  const folder = path.join(directory, "previas-limpeza");
  await fs.mkdir(folder, { recursive: true });
  const preview = path.join(
    folder,
    `previa-${Date.now()}-${randomUUID()}.json`,
  );
  await fs.writeFile(preview, JSON.stringify(plan, null, 2), {
    flag: "wx",
    mode: 0o600,
  });
  console.log("Prévia completa salva apenas no computador:", preview);
  console.table(plan.deleteOrders);
  console.table(
    plan.deletePayments.map((p) => ({
      id: p.id,
      orderId: p.orderId,
      type: p.type,
      value: p.value,
      date: p.date,
    })),
  );
  console.table(plan.collections);
  console.log(
    "Preservar: 43 pedidos. Faturamento R$ 3.446,30; custos R$ 1.754,01; lucro R$ 1.692,29.",
  );
  console.log(
    "Excluir somente os pedidos de demonstração listados e seus movimentos financeiros. Clientes, catálogo, anexos e histórico de auditoria permanecem. Temas e valores reais permanecem.",
  );
  if (!plan.deleteOrders.length && !plan.collections.length)
    console.log("Nada a corrigir. Nenhuma alteração realizada.");
  else {
    console.log(
      "Será criado e verificado um backup obrigatório antes de qualquer alteração.",
    );
    const confirmation = await input.question(
      "Para aplicar exatamente a prévia, digite EXCLUIR SOMENTE DEMONSTRACAO E CORRIGIR COLECOES (Enter cancela): ",
    );
    const result = await applyMaintenance(
      directory,
      reference,
      plan,
      confirmation,
    );
    console.log("Concluído. Backup:", result.backup);
    console.log(JSON.stringify(result, null, 2));
  }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  input.close();
}
