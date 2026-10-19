import { createBackup, restoreBackup } from "../backup.js";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
const [mode, arg, target] = process.argv.slice(2);
try {
  if (mode === "create") {
    const dir = arg || "data";
    const out =
      target || path.join(dir, "backups", `encanto-${Date.now()}.zip`);
    await mkdir(path.dirname(out), { recursive: true, mode: 0o700 });
    await createBackup(dir, out);
    console.log("Backup criado e verificado:", out);
  } else if (mode === "restore" && arg && target) {
    await restoreBackup(await readFile(arg), target);
    console.log("Cópia restaurada e verificada em:", target);
    console.log("O banco original não foi substituído.");
  } else
    throw Error(
      "Uso: node scripts/backup.js create [pasta-dados] [arquivo.zip] OU restore arquivo.zip NOVA-pasta",
    );
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
