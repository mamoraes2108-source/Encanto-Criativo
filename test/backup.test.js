import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import JSZip from "jszip";
import { createBackup, restoreBackup } from "../backup.js";
test("backup SQLite WAL e anexos: restaura em pasta nova, bloqueia sobrescrita e corrupção", async () => {
  const base = await mkdtemp(path.join(tmpdir(), "encanto-backup-test-"));
  const src = path.join(base, "source");
  await mkdir(src);
  const db = new DatabaseSync(path.join(src, "encanto.sqlite"));
  db.exec(
    "PRAGMA journal_mode=WAL;CREATE TABLE records(kind TEXT,id TEXT,body TEXT);INSERT INTO records VALUES('test','1','{\"valor\":42}')",
  );
  try {
    await mkdir(path.join(src, "artworks"));
    await writeFile(
      path.join(src, "artworks", "abc.png"),
      Buffer.from("anexo-teste"),
    );
    const out = path.join(base, "backup.zip");
    await createBackup(src, out);
    const bytes = await readFile(out);
    const dest = path.join(base, "restore");
    await restoreBackup(bytes, dest);
    assert.equal(
      (await readFile(path.join(dest, "artworks", "abc.png"))).toString(),
      "anexo-teste",
    );
    const copy = new DatabaseSync(path.join(dest, "encanto.sqlite"));
    assert.equal(
      JSON.parse(copy.prepare("SELECT body FROM records").get().body).valor,
      42,
    );
    copy.close();
    await assert.rejects(() => restoreBackup(bytes, dest), /EEXIST/);
    const zip = await JSZip.loadAsync(bytes);
    zip.file("artworks/abc.png", "alterado");
    const corrupted = await zip.generateAsync({ type: "nodebuffer" });
    await assert.rejects(
      () => restoreBackup(corrupted, path.join(base, "bad")),
      /Checksum|Tamanho/,
    );
    await assert.rejects(() => createBackup(src, out), /EEXIST/);
  } finally {
    db.close();
    await rm(base, { recursive: true, force: true });
  }
});
