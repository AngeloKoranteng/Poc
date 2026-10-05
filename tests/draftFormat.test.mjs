import ts from "typescript";
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/composables/photostyler/draftFormat.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
});
const { encodeDraft, decodeDraft } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

function legacyDraft() {
  return {
    versie: 1,
    foto: new File(["logo bytes"], "logo.png", { type: "image/png" }),
    achtergrond: new File(["background bytes"], "background.png", { type: "image/png" }),
    verfstreken: [{ kleur: "#ff0000", grootte: 12, punten: [{ x: 10, y: 20 }] }],
    toestand: {
      selectie: "tekst", x: 400, y: 250, schaalX: 1.5, schaalY: 0.8, hoek: 15,
      achtergrondDonkerte: 25, achtergrondIngesteld: true,
      belichtingen: { afbeelding: 1, achtergrond: -1 },
      belichtingAchtergrondUploadId: 3, rood: 255, groen: 0, blauw: 0,
      lagen: [{ id: "achtergrond", zichtbaar: false, vergrendeld: true }],
      achtergrondPositie: { x: 400, y: 250, schaalX: 2, schaalY: 2, uploadId: 3 },
      aantalVerfstreken: 1,
      tekst: {
        inhoud: "tekst kleur achtergrond", opmaak: [1, 2, 3], vet: true, cursief: false,
        kleur: "#172e2b", grootte: 36, lettertype: "Arial", x: 400, y: 250,
        schaalX: 1.2, schaalY: 0.7, hoek: -10,
      },
    },
  };
}

test("legacy drafts load with English fields while preserving files, text and layer IDs", () => {
  const stored = legacyDraft();
  const draft = decodeDraft(stored);
  assert.equal(draft.version, 1);
  assert.equal(draft.image, stored.foto);
  assert.equal(draft.background, stored.achtergrond);
  assert.equal(draft.condition.text.content, "tekst kleur achtergrond");
  assert.equal(draft.condition.text.fontFamily, "Arial");
  assert.equal(draft.condition.text.size, 36);
  assert.deepEqual(draft.condition.text.formatting, [1, 2, 3]);
  assert.deepEqual(draft.condition.exposures, { afbeelding: 1, achtergrond: -1 });
  assert.deepEqual(draft.condition.layers, [{ id: "achtergrond", visible: false, locked: true }]);
  assert.equal(draft.condition.backgroundPosition.scaleX, 2);
  assert.deepEqual(draft.brushstrokes, [{ color: "#ff0000", size: 12, points: [{ x: 10, y: 20 }] }]);
  assert.equal(stored.toestand.tekst.inhoud, "tekst kleur achtergrond");
  assert.equal(stored.version, undefined);
});

test("saving an English draft preserves the complete version-one storage format", () => {
  const stored = legacyDraft();
  const draft = decodeDraft(stored);
  assert.deepEqual(encodeDraft(draft), stored);
  assert.deepEqual(decodeDraft(encodeDraft(draft)), draft);
  assert.deepEqual(decodeDraft(draft), draft);
});

test("empty storage and drafts without images or text remain supported", () => {
  assert.equal(decodeDraft(undefined), undefined);
  const stored = legacyDraft();
  stored.foto = null;
  stored.achtergrond = null;
  stored.toestand.tekst = null;
  stored.toestand.achtergrondPositie = null;
  assert.deepEqual(encodeDraft(decodeDraft(stored)), stored);
});

test("draft transactions encode writes, decode legacy reads and delete the saved draft", async () => {
  const codecUrl = `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`;
  const storageSource = await readFile(new URL("../src/composables/photostyler/conceptStorage.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(storageSource.replace('"./draftFormat.ts"', JSON.stringify(codecUrl)), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const { draftTransaction } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
  const previousIndexedDB = globalThis.indexedDB;
  const stored = legacyDraft();
  const records = new Map([["huidig", stored]]);
  let closed = 0;
  globalThis.indexedDB = {
    open(name, version) {
      assert.equal(name, "photostyler");
      assert.equal(version, 1);
      const request = {
        result: {
          close() { closed++; },
          transaction(storeName) {
            assert.equal(storeName, "concepten");
            const transaction = {
              objectStore() {
                return {
                  get(key) { return { result: records.get(key) }; },
                  put(value, key) { records.set(key, value); return { result: key }; },
                  delete(key) { records.delete(key); return { result: undefined }; },
                };
              },
            };
            queueMicrotask(() => transaction.oncomplete());
            return transaction;
          },
        },
      };
      queueMicrotask(() => request.onsuccess());
      return request;
    },
  };
  try {
    const draft = await draftTransaction("read");
    assert.equal(draft.condition.text.content, stored.toestand.tekst.inhoud);
    draft.condition.text.content = "Updated text";
    await draftTransaction("write", draft);
    assert.equal(records.get("huidig").toestand.tekst.inhoud, "Updated text");
    assert.equal(records.get("huidig").versie, 1);
    assert.equal((await draftTransaction("read")).condition.text.content, "Updated text");
    await draftTransaction("delete");
    assert.equal(await draftTransaction("read"), undefined);
    assert.equal(closed, 5);
  } finally {
    if (previousIndexedDB === undefined) delete globalThis.indexedDB;
    else globalThis.indexedDB = previousIndexedDB;
  }
});
