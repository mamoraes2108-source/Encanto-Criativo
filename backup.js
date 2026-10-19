import { DatabaseSync, backup } from "node:sqlite";
import JSZip from "jszip";
import { promises as fs } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
const digest = (b) => createHash("sha256").update(b).digest("hex");
export async function createBackup(directory, destination) {
  const temp = await fs.mkdtemp(path.join(tmpdir(), "encanto-backup-"));
  let db;
  try {
    db = new DatabaseSync(path.join(directory, "encanto.sqlite"), {
      readOnly: true,
    });
    if (db.prepare("PRAGMA integrity_check").get().integrity_check !== "ok")
      throw Error("Banco de origem inválido.");
    await backup(db, path.join(temp, "encanto.sqlite"));
    db.close();
    db = null;
    const files = {
      "encanto.sqlite": await fs.readFile(path.join(temp, "encanto.sqlite")),
    };
    try {
      for (const entry of await fs.readdir(path.join(directory, "artworks"), {
        withFileTypes: true,
      })) {
        if (!entry.isFile() || !/^[-a-f0-9]+\.(png|jpg|webp)$/.test(entry.name))
          throw Error("Arquivo de anexo inesperado; backup interrompido.");
        files["artworks/" + entry.name] = await fs.readFile(
          path.join(directory, "artworks", entry.name),
        );
      }
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    const manifest = {
      version: 2,
      createdAt: new Date().toISOString(),
      files: Object.fromEntries(
        Object.entries(files).map(([name, b]) => [
          name,
          { size: b.length, sha256: digest(b) },
        ]),
      ),
    };
    const zip = new JSZip();
    for (const [name, b] of Object.entries(files)) zip.file(name, b);
    zip.file("manifest.json", JSON.stringify(manifest, null, 2));
    await fs.writeFile(
      destination,
      await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }),
      { flag: "wx", mode: 0o600 },
    );
    await inspectBackup(await fs.readFile(destination));
    return manifest;
  } finally {
    db?.close();
    await fs.rm(temp, { recursive: true, force: true });
  }
}
export async function inspectBackup(buffer) {
  if (buffer.length > 100 * 1024 * 1024) throw Error("Backup excede 100 MB.");
  const zip = await JSZip.loadAsync(buffer, { createFolders: false });
  if (!zip.file("manifest.json")) throw Error("Manifesto ausente.");
  const manifest = JSON.parse(await zip.file("manifest.json").async("string"));
  if (manifest.version !== 2 || !manifest.files?.["encanto.sqlite"])
    throw Error("Formato de backup inválido.");
  const names = Object.keys(manifest.files);
  if (names.length > 5000) throw Error("Backup excede limite de arquivos.");
  const actual = Object.values(zip.files)
    .filter((f) => !f.dir)
    .map((f) => f.name)
    .sort();
  if (
    JSON.stringify(actual) !==
    JSON.stringify([...names, "manifest.json"].sort())
  )
    throw Error("Arquivos não declarados no backup.");
  const files = {};
  let total = 0;
  for (const name of names) {
    if (
      name !== "encanto.sqlite" &&
      !/^artworks\/[-a-f0-9]+\.(png|jpg|webp)$/.test(name)
    )
      throw Error("Caminho de backup inválido.");
    const spec = manifest.files[name];
    if (
      !Number.isSafeInteger(spec.size) ||
      spec.size < 0 ||
      (total += spec.size) > 250 * 1024 * 1024
    )
      throw Error("Tamanho do backup inválido.");
    const entry = zip.file(name);
    if (!entry || entry._data.uncompressedSize !== spec.size)
      throw Error("Tamanho divergente.");
    const b = await entry.async("nodebuffer");
    if (b.length !== spec.size || digest(b) !== spec.sha256)
      throw Error("Checksum divergente.");
    files[name] = b;
  }
  if (
    files["encanto.sqlite"].subarray(0, 16).toString() !== "SQLite format 3\0"
  )
    throw Error("Banco inválido.");
  return { manifest, files };
}
export async function restoreBackup(buffer, destination) {
  // Nunca restaura sobre diretório existente, nem sobre o banco em uso.
  const { manifest, files } = await inspectBackup(buffer);
  await fs.mkdir(destination, { mode: 0o700 });
  try {
    for (const [name, b] of Object.entries(files)) {
      await fs.mkdir(path.dirname(path.join(destination, name)), {
        recursive: true,
        mode: 0o700,
      });
      await fs.writeFile(path.join(destination, name), b, {
        flag: "wx",
        mode: 0o600,
      });
    }
    const restored = new DatabaseSync(
      path.join(destination, "encanto.sqlite"),
      { readOnly: true },
    );
    try {
      if (
        restored.prepare("PRAGMA integrity_check").get().integrity_check !==
        "ok"
      )
        throw Error("Banco restaurado inválido.");
      for (const row of restored.prepare("SELECT body FROM records").all())
        JSON.parse(row.body);
    } finally {
      restored.close();
    }
    return manifest;
  } catch (e) {
    await fs.rm(destination, { recursive: true, force: true });
    throw e;
  }
}
