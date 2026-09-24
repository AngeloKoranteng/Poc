import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { SourceTextModule, SyntheticModule, createContext } from "node:vm";
import { markRaw, ref, computed, watch, effectScope } from "vue";
import { getPlainText, parseTaggedText, TextStyle } from "pixi.js";

function zichtbareTekst(object) {
  return getPlainText(object.text, new TextStyle(object.style));
}

// Tests the real editor logic with a minimal renderer and browser event surface.
class EventTarget {
  handlers = new Map();
  addEventListener(name, handler) {
    const handlers = this.handlers.get(name) ?? new Set();
    handlers.add(handler);
    this.handlers.set(name, handlers);
  }
  removeEventListener(name, handler) {
    this.handlers.get(name)?.delete(handler);
  }
  emit(name, event = {}) {
    for (const handler of this.handlers.get(name) ?? [])
      handler({ type: name, ...event });
  }
}
class DisplayObject extends EventTarget {
  x = 0;
  y = 0;
  rotation = 0;
  children = [];
  visible = true;
  scale = {
    x: 1,
    y: 1,
    set: (x, y = x) => {
      this.scale.x = x;
      this.scale.y = y;
    },
  };
  position = {
    set: (x, y) => {
      this.x = x;
      this.y = y;
    },
    copyFrom: (p) => {
      this.x = p.x;
      this.y = p.y;
    },
    get x() {
      return this.owner.x;
    },
    get y() {
      return this.owner.y;
    },
    owner: this,
  };
  anchor = { set() {} };
  get angle() {
    return (this.rotation * 180) / Math.PI;
  }
  set angle(value) {
    this.rotation = (value * Math.PI) / 180;
  }
  get width() {
    return (this.baseWidth ?? 200) * this.scale.x;
  }
  get height() {
    return (this.baseHeight ?? 80) * this.scale.y;
  }
  on(name, handler) {
    this.addEventListener(name, handler);
    return this;
  }
  addChild(child) {
    child.parent?.removeChild(child);
    this.children.push(child);
    child.parent = this;
    return child;
  }
  addChildAt(child, index) {
    child.parent?.removeChild(child);
    this.children.splice(index, 0, child);
    child.parent = this;
    return child;
  }
  removeChild(child) {
    this.children = this.children.filter((item) => item !== child);
    child.parent = null;
  }
  destroy() {
    this.destroyed = true;
  }
}
class Graphics extends DisplayObject {
  rect() {
    return this;
  }
  fill() {
    return this;
  }
  stroke() {
    return this;
  }
  arc() {
    return this;
  }
  circle() {
    return this;
  }
  clear() {
    return this;
  }
  moveTo() {
    return this;
  }
  lineTo() {
    return this;
  }
}
class Sprite extends DisplayObject {
  constructor(texture) {
    super();
    this.texture = texture;
  }
  baseWidth = 400;
  baseHeight = 250;
}
class Text extends DisplayObject {
  constructor({ text }) {
    super();
    this.text = text;
  }
}

async function setup({ opslag = {}, leeg = false } = {}) {
  const mounted = [],
    unmounted = [];
  const window = new EventTarget();
  window.devicePixelRatio = 1;
  let app;
  class Application {
    constructor() {
      app = this;
      this.stage = new DisplayObject();
      this.canvas = new EventTarget();
      this.canvas.captured = new Set();
      this.canvas.setPointerCapture = (id) => this.canvas.captured.add(id);
      this.canvas.hasPointerCapture = (id) => this.canvas.captured.has(id);
      this.canvas.releasePointerCapture = (id) => {
        this.canvas.captured.delete(id);
        this.canvas.emit("lostpointercapture", { pointerId: id });
      };
      this.canvas.getBoundingClientRect = () => ({
        left: 0,
        top: 0,
        width: 800,
        height: 500,
      });
      this.screen = {
        width: 800,
        height: 500,
        clone() {
          return this;
        },
      };
      this.renderer = {
        background: {},
        extract: {
          canvas: () => {
            this.exported = this.stage.children.filter(
              (child) => child.visible,
            );
            return {
              width: 800,
              height: 500,
              getContext: () => ({ drawImage() {} }),
              toDataURL: () => "data:image/png;base64,",
            };
          },
        },
      };
    }
    async init() {}
    render() {}
    destroy() {
      this.destroyed = true;
    }
  }
  const context = createContext({
    console,
    window,
    Image: class {
      async decode() {}
    },
    URL: { createObjectURL: () => "blob:test", revokeObjectURL() {} },
    document: { createElement: (tag) => {
      if (tag !== "canvas") return { click() {} };
      const canvas = { width: 2, height: 1 };
      canvas.getContext = () => ({
        drawImage() {},
        getImageData: () => ({ data: new Uint8ClampedArray([40, 80, 120, 128, 200, 100, 0, 255]) }),
        createImageData: () => ({ data: new Uint8ClampedArray(8) }),
        putImageData: (image) => { canvas.pixels = Array.from(image.data); },
      });
      return canvas;
    } },
  });
  const sources = {
    [new URL("../src/composables/photostyler/conceptOpslag.js", import.meta.url).href]: {
      conceptTransactie: async (actie, concept) => {
        if (opslag.fout) throw new Error("Opslag niet beschikbaar");
        if (actie === "lezen") return opslag.concept ? structuredClone(opslag.concept) : undefined;
        opslag.concept = structuredClone(concept);
      },
    },
    vue: {
      markRaw,
      ref,
      computed,
      watch,
      onMounted: (fn) => mounted.push(fn),
      onBeforeUnmount: (fn) => unmounted.push(fn),
    },
    "pixi.js": {
      Application,
      Graphics,
      Sprite,
      Text,
      Rectangle: class {},
      Texture: { from: (resource) => ({
        width: 2,
        height: 1,
        source: { resource, update() {}, unload() {} },
        destroy() { this.destroyed = true; },
      }) },
    },
  };
  const cache = new Map();
  async function load(id) {
    if (cache.has(id)) return cache.get(id);
    let module;
    if (sources[id]) {
      const values = sources[id];
      module = new SyntheticModule(
        Object.keys(values),
        function () {
          for (const [key, value] of Object.entries(values))
            this.setExport(key, value);
        },
        { context, identifier: id },
      );
    } else {
      module = new SourceTextModule(await readFile(new URL(id), "utf8"), {
        context,
        identifier: id,
      });
    }
    cache.set(id, module);
    await module.link((specifier, parent) =>
      load(
        sources[specifier]
          ? specifier
          : new URL(specifier, parent.identifier).href,
      ),
    );
    return module;
  }
  const module = await load(
    new URL("../src/composables/photostyler/usePhotoStyler.js", import.meta.url)
      .href,
  );
  await module.evaluate();
  const scope = effectScope();
  const editor = scope.run(() => module.namespace.usePhotoStyler());
  editor.canvasHost.value = { appendChild() {} };
  editor.verfCanvas.value = {
    width: 800,
    height: 500,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 500 }),
    setPointerCapture() {},
    hasPointerCapture: () => false,
    getContext: () => ({ clearRect() {}, beginPath() {}, arc() {}, fill() {},
      moveTo() {}, lineTo() {}, stroke() {} }),
  };
  await mounted[0]();
  if (!leeg) await editor.uploadFoto({
    target: { files: [{ name: "foto.png" }], value: "" },
  });
  const photo = app.stage.children.find((child) => child instanceof Sprite);
  const frame = app.stage.children.find((child) => child instanceof Graphics);
  if (!leeg) {
    editor.tekstFormulier.value.inhoud = "Onze club";
    editor.pasTekstToe();
  }
  const text = app.stage.children.find((child) => child instanceof Text);
  const pointer = (x, y, pointerId = 1) => ({
    pointerId,
    button: 0,
    clientX: x,
    clientY: y,
    global: { x, y },
    preventDefault() {},
    stopPropagation() {},
  });
  return {
    editor,
    app,
    photo,
    text,
    frame,
    window,
    pointer,
    close() {
      unmounted.forEach((fn) => fn());
      scope.stop();
    },
  };
}

const near = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test("text drag locks inspectors, tracks the pointer outside the canvas and undoes once", async () => {
  const h = await setup();
  try {
    const before = h.editor.geschiedenis.value.length;
    h.text.emit("pointerdown", h.pointer(400, 250));
    assert.equal(h.editor.inspectorsVergrendeld.value, true);
    h.window.emit("pointermove", h.pointer(900, 280));
    h.window.emit("pointerup", h.pointer(920, 290));
    near(h.text.x, 920);
    near(h.editor.tekstFormulier.value.x, 920);
    assert.equal(h.photo.x, 400);
    assert.equal(h.editor.inspectorsVergrendeld.value, false);
    assert.equal(h.app.canvas.captured.size, 0);
    assert.equal(h.editor.geschiedenis.value.length, before + 1);
    h.editor.ongedaanMaken();
    assert.equal(h.text.x, 400);
    assert.equal(h.text.y, 250);
  } finally {
    h.close();
  }
});

test("side handles stretch selected text, preserve the opposite edge and support undo", async () => {
  const h = await setup();
  try {
    h.frame.children[5].emit("pointerdown", h.pointer(500, 250));
    assert.equal(h.editor.inspectorsVergrendeld.value, true);
    h.window.emit("pointerup", h.pointer(600, 250));
    near(h.text.scale.x, 1.5);
    near(h.text.scale.y, 1);
    near(h.text.x - h.text.width / 2, 300);
    assert.equal(h.photo.scale.x, 1.6);
    h.editor.ongedaanMaken();
    near(h.text.scale.x, 1);
    near(h.text.x, 400);
  } finally {
    h.close();
  }
});

test("rotating and stretching text survive content edits and successive undo operations", async () => {
  const h = await setup();
  try {
    h.frame.children[8].emit("pointerdown", h.pointer(400, 178));
    h.window.emit("pointerup", h.pointer(472, 250));
    near(h.text.angle, 90);
    // The right side of a 90-degree rotated text object points downwards.
    h.frame.children[5].emit("pointerdown", h.pointer(400, 350));
    h.window.emit("pointerup", h.pointer(400, 450));
    near(h.text.scale.x, 1.5);
    near(h.text.x, 400);
    near(h.text.y, 300);
    h.editor.tekstFormulier.value.inhoud = "Nieuwe tekst";
    h.editor.pasTekstToe();
    near(h.text.angle, 90);
    near(h.text.scale.x, 1.5);
    near(h.text.y, 300);
    h.editor.ongedaanMaken();
    assert.equal(zichtbareTekst(h.text), "Onze club");
    near(h.text.angle, 90);
    h.editor.ongedaanMaken();
    near(h.text.scale.x, 1);
    near(h.text.y, 250);
    h.editor.ongedaanMaken();
    near(h.text.angle, 0);
  } finally {
    h.close();
  }
});

test("selection switches back to the photo and unchanged colors do not create history", async () => {
  const h = await setup();
  try {
    h.photo.emit("pointerdown", h.pointer(400, 250));
    h.window.emit("pointerup", h.pointer(400, 250));
    h.frame.children[5].emit("pointerdown", h.pointer(720, 250));
    h.window.emit("pointerup", h.pointer(800, 250));
    near(h.photo.width, 720);
    near(h.text.scale.x, 1);
    const count = h.editor.geschiedenis.value.length;
    h.editor.startKleurWijziging();
    h.editor.stopKleurWijziging();
    assert.equal(h.editor.geschiedenis.value.length, count);
  } finally {
    h.close();
  }
});

test("cancel, blur, lost capture and panel changes all release inspector locks", async () => {
  const h = await setup();
  try {
    for (const finish of [
      () => h.window.emit("pointercancel", h.pointer(400, 250)),
      () => h.window.emit("blur"),
      () => h.app.canvas.releasePointerCapture(1),
      () => h.editor.kiesPaneel("achtergrond"),
    ]) {
      h.text.emit("pointerdown", h.pointer(400, 250));
      h.window.emit("pointerup", h.pointer(400, 250, 2));
      assert.equal(h.editor.inspectorsVergrendeld.value, true);
      finish();
      assert.equal(h.editor.inspectorsVergrendeld.value, false);
      assert.equal(h.app.canvas.captured.size, 0);
      h.frame.children[5].emit("pointerdown", h.pointer(500, 250));
      assert.equal(h.editor.inspectorsVergrendeld.value, true);
      finish();
      assert.equal(h.editor.inspectorsVergrendeld.value, false);
    }
  } finally {
    h.close();
  }
});

test("download includes text without handles, and replacing the photo preserves text", async () => {
  const h = await setup();
  try {
    h.editor.downloadFoto();
    assert.ok(h.app.exported.includes(h.text));
    assert.ok(!h.app.exported.includes(h.frame));
    await h.editor.uploadFoto({
      target: { files: [{ name: "nieuw.png" }], value: "" },
    });
    assert.ok(h.app.stage.children.includes(h.text));
    assert.equal(h.editor.tekstFormulier.value.inhoud, "Onze club");
    const logo = h.app.stage.children.find(child => child instanceof Sprite);
    assert.ok(h.app.stage.children.indexOf(h.text) > h.app.stage.children.indexOf(logo));
    assert.equal(h.editor.geschiedenis.value.length, 3);
    h.editor.tekstFormulier.value.inhoud = "Opnieuw";
    h.editor.pasTekstToe();
    assert.ok(h.app.stage.children.some((child) => child instanceof Text));
  } finally {
    h.close();
  }
});


test("logo presets fit rotated logos within margins and undo their transformation", async () => {
  const h = await setup();
  try {
    h.photo.angle = 45;
    h.photo.scale.set(3);
    const before = { x: h.photo.x, y: h.photo.y, scale: h.photo.scale.x };
    h.editor.plaatsLogo("rechtsonder");
    const extent = (h.photo.width + h.photo.height) / Math.sqrt(2);
    near(h.photo.x + extent / 2, 768);
    near(h.photo.y + extent / 2, 468);
    assert.ok(h.photo.y - extent / 2 >= 32 - 1e-6);
    near(h.photo.angle, 45);
    h.editor.ongedaanMaken();
    near(h.photo.x, before.x);
    near(h.photo.y, before.y);
    near(h.photo.scale.x, before.scale);
    h.editor.plaatsLogo("midden");
    near(h.photo.x, 400);
    near(h.photo.y, 250);
    const count = h.editor.geschiedenis.value.length;
    h.editor.plaatsLogo("midden");
    assert.equal(h.editor.geschiedenis.value.length, count);
  } finally { h.close(); }
});

test("background darkness affects only the background and supports undo and replacement", async () => {
  const h = await setup();
  try {
    await h.editor.uploadAchtergrond({ target: { files: [{ name: "bg.png" }], value: "" } });
    const bg = h.app.stage.children[0];
    const photoTint = h.photo.tint;
    h.editor.startKleurWijziging();
    h.editor.achtergrondDonkerte.value = 50;
    h.editor.stopKleurWijziging();
    assert.equal(bg.tint, 0x808080);
    assert.equal(h.photo.tint, photoTint);
    h.editor.ongedaanMaken();
    assert.equal(bg.tint, 0xffffff);
    assert.equal(h.editor.achtergrondDonkerte.value, 0);
    h.editor.achtergrondDonkerte.value = 100;
    await h.editor.uploadAchtergrond({ target: { files: [{ name: "next.png" }], value: "" } });
    assert.equal(h.app.stage.children[0].tint, 0);
    assert.ok(h.app.stage.children.includes(h.text));
  } finally { h.close(); }
});

test("layers select objects and hidden layers stay out of exports until undo", async () => {
  const h = await setup();
  try {
    assert.equal(h.editor.lagen.value.find(l => l.id === 'tekst').aanwezig, true);
    assert.equal(h.editor.lagen.value.find(l => l.id === 'achtergrond').aanwezig, false);
    h.editor.selecteerLaag('afbeelding');
    assert.equal(h.editor.geselecteerdeLaag.value, 'afbeelding');
    h.editor.wisselLaagZichtbaarheid('afbeelding');
    assert.equal(h.photo.visible, false);
    assert.equal(h.frame.visible, false);
    h.editor.downloadFoto();
    assert.ok(!h.app.exported.includes(h.photo));
    assert.ok(h.app.exported.includes(h.text));
    h.editor.ongedaanMaken();
    assert.equal(h.photo.visible, true);
    assert.equal(h.frame.visible, true);
    h.editor.selecteerLaag('tekst');
    assert.equal(h.editor.actiefPaneel.value, 'tekst');
    h.editor.verwijderTekst();
    assert.equal(h.editor.lagen.value.find(l => l.id === 'tekst').aanwezig, false);
    h.editor.ongedaanMaken();
    assert.equal(h.editor.lagen.value.find(l => l.id === 'tekst').aanwezig, true);
  } finally { h.close(); }
});

test("locked layers reject drag, resize, rotation and logo positioning and can be unlocked", async () => {
  const h = await setup();
  try {
    for (const [id, object] of [['afbeelding', h.photo], ['tekst', h.text]]) {
      h.editor.selecteerLaag(id);
      const before = { x: object.x, scale: object.scale.x, angle: object.angle };
      h.editor.wisselLaagVergrendeling(id);
      assert.equal(h.frame.visible, false);
      object.emit('pointerdown', h.pointer(object.x, object.y));
      h.window.emit('pointerup', h.pointer(700, 400));
      h.editor.veranderSchaal(2);
      h.editor.draaiFoto(45);
      if (id === 'afbeelding') h.editor.plaatsLogo('linksboven');
      near(object.x, before.x);
      near(object.scale.x, before.scale);
      near(object.angle, before.angle);
      assert.equal(h.editor.inspectorsVergrendeld.value, false);
      h.editor.ongedaanMaken();
      assert.equal(object.eventMode, 'static');
      assert.equal(h.frame.visible, true);
    }
    await h.editor.uploadAchtergrond({ target: { files: [{ name: 'bg.png' }], value: '' } });
    const bg = h.app.stage.children[0];
    h.editor.selecteerLaag('achtergrond');
    assert.equal(h.editor.actiefPaneel.value, 'afbeelding');
    assert.equal(h.editor.geselecteerdeLaag.value, 'achtergrond');
    h.editor.wisselLaagVergrendeling('achtergrond');
    bg.emit('pointerdown', h.pointer(400, 250));
    assert.equal(h.editor.inspectorsVergrendeld.value, false);
    assert.equal(bg.eventMode, 'none');
    h.editor.wisselLaagVergrendeling('achtergrond');
    bg.emit('pointerdown', h.pointer(400, 250));
    assert.equal(h.editor.inspectorsVergrendeld.value, true);
    h.window.emit('pointerup', h.pointer(450, 250));
    assert.equal(h.editor.inspectorsVergrendeld.value, false);
  } finally { h.close(); }
});

test("reuploading a deleted hidden and locked image creates a visible editable layer", async () => {
  const h = await setup();
  try {
    for (const id of ['afbeelding', 'achtergrond']) {
      const upload = id === 'afbeelding' ? h.editor.uploadFoto : h.editor.uploadAchtergrond;
      if (id === 'achtergrond') await upload({ target: { files: [{ name: 'old.png' }], value: '' } });
      const old = id === 'afbeelding' ? h.photo : h.app.stage.children[0];
      h.editor.wisselLaagZichtbaarheid(id);
      h.editor.wisselLaagVergrendeling(id);
      h.editor.verwijderLaag(id);
      assert.equal(old.destroyed, true);
      assert.ok(!h.app.stage.children.includes(old));
      assert.equal(h.editor.lagen.value.find(l => l.id === id).aanwezig, false);
      await upload({ target: { files: [{ name: 'new.png' }], value: '' } });
      const layer = h.editor.lagen.value.find(l => l.id === id);
      assert.equal(layer.aanwezig, true);
      assert.equal(layer.zichtbaar, true);
      assert.equal(layer.vergrendeld, false);
      const fresh = id === 'afbeelding'
        ? h.app.stage.children.find(o => o instanceof Sprite)
        : h.app.stage.children[0];
      assert.notEqual(fresh, old);
      assert.equal(fresh.visible, true);
      assert.equal(fresh.eventMode, 'static');
      assert.equal(id === 'afbeelding' ? h.editor.fileName.value : h.editor.achtergrondBestandsnaam.value, 'new.png');
    }
  } finally { h.close(); }
});

test("canvas typing saves multiple lines as one undo step and preserves transforms", async () => {
  const h = await setup();
  try {
    h.text.position.set(320, 210);
    h.text.scale.set(1.2, 0.8);
    h.text.angle = 15;
    const count = h.editor.geschiedenis.value.length;
    h.editor.startCanvasTekst();
    assert.equal(h.editor.canvasTekstActief.value, true);
    assert.equal(h.text.visible, false);
    h.editor.canvasTekstInvoer.value = 'Eerste regel\nTweede regel';
    h.editor.stopCanvasTekst();
    assert.equal(zichtbareTekst(h.text), 'Eerste regel\nTweede regel');
    assert.equal(h.text.visible, true);
    near(h.text.x, 320);
    near(h.text.scale.x, 1.2);
    near(h.text.angle, 15);
    assert.equal(h.editor.geschiedenis.value.length, count + 1);
    h.editor.ongedaanMaken();
    assert.equal(zichtbareTekst(h.text), 'Onze club');
  } finally { h.close(); }
});

test("cancel and unchanged canvas text do not create history; clearing text can be undone", async () => {
  const h = await setup();
  try {
    const count = h.editor.geschiedenis.value.length;
    h.editor.startCanvasTekst();
    h.editor.canvasTekstInvoer.value = 'Annuleren';
    h.editor.stopCanvasTekst(false);
    assert.equal(zichtbareTekst(h.text), 'Onze club');
    assert.equal(h.text.visible, true);
    assert.equal(h.editor.geschiedenis.value.length, count);
    h.editor.startCanvasTekst();
    h.editor.stopCanvasTekst();
    assert.equal(h.editor.geschiedenis.value.length, count);
    h.editor.startCanvasTekst();
    h.editor.canvasTekstInvoer.value = '';
    h.editor.stopCanvasTekst();
    assert.equal(h.editor.lagen.value.find(l => l.id === 'tekst').aanwezig, false);
    h.editor.ongedaanMaken();
    assert.ok(h.app.stage.children.some(o => o instanceof Text && zichtbareTekst(o) === 'Onze club'));
  } finally { h.close(); }
});

test("canvas typing creates text without an image and export commits the draft", async () => {
  const h = await setup();
  try {
    h.editor.verwijderLaag('tekst');
    h.editor.verwijderLaag('afbeelding');
    h.editor.startCanvasTekst();
    h.editor.canvasTekstInvoer.value = 'Alleen tekst\nOp het canvas';
    h.editor.downloadFoto();
    assert.equal(h.editor.canvasTekstActief.value, false);
    assert.ok(h.app.exported.some(o => o instanceof Text && zichtbareTekst(o) === 'Alleen tekst\nOp het canvas'));
  } finally { h.close(); }
});


test("partial bold and italic formatting survives apply, canvas editing and undo", async () => {
  const h = await setup();
  try {
    const opmaak = [0, 0, 0, 0, 0, 1, 1, 3, 3];
    h.editor.tekstFormulier.value.opmaak = opmaak;
    h.editor.pasTekstToe();
    const runs = parseTaggedText(h.text.text, new TextStyle(h.text.style));
    assert.deepEqual(runs.map(run => [run.text, run.style.fontWeight, run.style.fontStyle]), [
      ["Onze ", "normal", "normal"],
      ["cl", "bold", "normal"],
      ["ub", "bold", "italic"],
    ]);
    h.editor.startCanvasTekst();
    assert.deepEqual(Array.from(h.editor.canvasTekstOpmaak.value.opmaak), opmaak);
    h.editor.stopCanvasTekst();
    h.editor.ongedaanMaken();
    assert.equal(zichtbareTekst(h.text), "Onze club");
    assert.ok(parseTaggedText(h.text.text, new TextStyle(h.text.style))
      .every(run => run.style.fontWeight === "normal" && run.style.fontStyle === "normal"));
  } finally { h.close(); }
});

test("canvas exposure uses original pixels, preserves alpha and supports reset and undo", async () => {
  const h = await setup();
  try {
    h.editor.selecteerLaag('afbeelding');
    const origineel = h.photo.texture;
    const count = h.editor.geschiedenis.value.length;
    h.editor.veranderBelichting(1);
    const bewerkt = h.photo.texture;
    assert.deepEqual(bewerkt.source.resource.pixels.slice(0, 4), [80, 160, 240, 128]);
    h.editor.veranderBelichting(-1);
    assert.deepEqual(bewerkt.source.resource.pixels.slice(0, 4), [20, 40, 60, 128]);
    h.editor.stopKleurWijziging();
    assert.equal(h.editor.geschiedenis.value.length, count + 1);
    h.editor.ongedaanMaken();
    assert.equal(h.photo.texture, origineel);
    assert.equal(h.editor.belichtingWaarde.value, 0);
    h.editor.veranderBelichting(2);
    h.editor.stopKleurWijziging();
    assert.deepEqual(bewerkt.source.resource.pixels.slice(0, 4), [160, 255, 255, 128]);
    h.editor.downloadFoto();
    assert.equal(h.app.exported.find(o => o === h.photo).texture, bewerkt);
    h.editor.resetBelichting();
    assert.equal(h.photo.texture, origineel);
    h.editor.ongedaanMaken();
    assert.equal(h.photo.texture, bewerkt);
    assert.equal(h.editor.belichtingWaarde.value, 2);
    h.editor.wisselLaagVergrendeling('afbeelding');
    h.editor.veranderBelichting(-2);
    assert.equal(h.editor.belichtingWaarde.value, 2);
    assert.equal(h.text.texture, undefined);
  } finally { h.close(); }
});

test("exposure is separate per image and resets and releases resources on replacement", async () => {
  const h = await setup();
  try {
    h.editor.selecteerLaag('afbeelding');
    h.editor.veranderBelichting(1);
    h.editor.stopKleurWijziging();
    const oudeFotoTexture = h.photo.texture;
    await h.editor.uploadAchtergrond({ target: { files: [{ name: 'bg.png' }], value: '' } });
    h.editor.selecteerLaag('achtergrond');
    assert.equal(h.editor.belichtingWaarde.value, 0);
    h.editor.veranderBelichting(-1);
    h.editor.stopKleurWijziging();
    const oudeAchtergrond = h.app.stage.children[0];
    const oudeTexture = oudeAchtergrond.texture;
    assert.deepEqual(oudeTexture.source.resource.pixels.slice(0, 4), [20, 40, 60, 128]);
    assert.deepEqual(oudeFotoTexture.source.resource.pixels.slice(0, 4), [80, 160, 240, 128]);
    await h.editor.uploadAchtergrond({ target: { files: [{ name: 'new-bg.png' }], value: '' } });
    assert.equal(h.editor.belichtingWaarde.value, 0);
    assert.equal(oudeTexture.destroyed, true);
    h.editor.ongedaanMaken();
    assert.equal(h.editor.belichtingWaarde.value, -1);
    assert.equal(h.editor.achtergrondBestandsnaam.value, "bg.png");
    await h.editor.uploadFoto({ target: { files: [{ name: 'new.png' }], value: '' } });
    assert.equal(oudeFotoTexture.destroyed, true);
    assert.equal(h.editor.belichtingWaarde.value, 0);
    h.editor.veranderBelichting(1);
    h.editor.stopKleurWijziging();
    const texture = h.app.stage.children.find(o => o instanceof Sprite && o !== h.app.stage.children[0]).texture;
    h.editor.verwijderFoto();
    assert.equal(texture.destroyed, true);
  } finally { h.close(); }
});

test("choosing a background color replaces the visible background photo and undoes in one step", async () => {
  const h = await setup();
  try {
    await h.editor.uploadAchtergrond({ target: { files: [{ name: 'bg.png' }], value: '' } });
    const background = h.app.stage.children[0];
    const count = h.editor.geschiedenis.value.length;
    h.editor.kiesAchtergrondKleur('#FF0000');
    assert.equal(h.app.renderer.background.color, 'rgb(255, 0, 0)');
    assert.equal(background.visible, false);
    assert.equal(background.destroyed, undefined);
    assert.equal(h.photo.visible, true);
    assert.equal(h.text.visible, true);
    assert.equal(h.editor.achtergrondBestandsnaam.value, 'bg.png');
    assert.equal(h.editor.geschiedenis.value.length, count + 1);
    h.editor.downloadFoto();
    assert.ok(!h.app.exported.includes(background));
    assert.ok(h.app.exported.includes(h.photo));
    h.editor.ongedaanMaken();
    assert.equal(background.visible, true);
    assert.equal(h.app.renderer.background.color, 'rgb(230, 230, 230)');
    assert.equal(h.editor.geschiedenis.value.length, count);
    // Even an already selected color must hide a covering background photo.
    h.editor.kiesAchtergrondKleur('#e6e6e6');
    assert.equal(background.visible, false);
    assert.equal(h.editor.geschiedenis.value.length, count + 1);
    h.editor.kiesAchtergrondKleur('#e6e6e6');
    assert.equal(h.editor.geschiedenis.value.length, count + 1);
  } finally { h.close(); }
});

test("live background color picker updates immediately and groups its undo history", async () => {
  const h = await setup();
  try {
    const count = h.editor.geschiedenis.value.length;
    h.editor.kiesAchtergrondKleur('#ff0000', true);
    assert.equal(h.app.renderer.background.color, 'rgb(255, 0, 0)');
    h.editor.kiesAchtergrondKleur('#00abc1', true);
    assert.equal(h.app.renderer.background.color, 'rgb(0, 171, 193)');
    h.editor.kiesAchtergrondKleur('#00abc1');
    assert.equal(h.editor.geschiedenis.value.length, count + 1);
    h.editor.ongedaanMaken();
    assert.equal(h.app.renderer.background.color, 'rgb(230, 230, 230)');
    h.editor.kiesAchtergrondKleur('geen kleur');
    assert.equal(h.editor.geschiedenis.value.length, count);
  } finally { h.close(); }
});

test("a solid background is a downloadable design without an image and undo restores the empty state", async () => {
  const h = await setup();
  try {
    h.editor.verwijderLaag('tekst');
    h.editor.verwijderLaag('afbeelding');
    assert.equal(h.editor.achtergrondIngesteld.value, false);
    const count = h.editor.geschiedenis.value.length;
    // Choosing even the initial gray explicitly creates a background.
    h.editor.kiesAchtergrondKleur('#e6e6e6');
    assert.equal(h.editor.achtergrondIngesteld.value, true);
    assert.equal(h.editor.geschiedenis.value.length, count + 1);
    h.editor.downloadFoto();
    assert.ok(Array.isArray(h.app.exported));
    h.editor.ongedaanMaken();
    assert.equal(h.editor.achtergrondIngesteld.value, false);
    h.editor.startKleurWijziging();
    h.editor.achtergrondKanalen[0].waarde.value = 100;
    h.editor.stopKleurWijziging();
    assert.equal(h.editor.achtergrondIngesteld.value, true);
    h.editor.ongedaanMaken();
    assert.equal(h.editor.achtergrondIngesteld.value, false);
  } finally { h.close(); }
});


test("saved draft restores editable images, text, layer flags and colors after remount", async () => {
  const opslag = {};
  const first = await setup({ opslag });
  await first.editor.uploadAchtergrond({ target: { files: [{ name: "achtergrond.png" }], value: "" } });
  first.editor.selecteerLaag("afbeelding");
  first.editor.draaiFoto(30);
  first.editor.veranderBelichting(1);
  first.editor.kiesAchtergrondKleur("#123456");
  first.editor.wisselLaagVergrendeling("afbeelding");
  first.editor.tekenModus.value = true;
  first.editor.startTekenen({ ...first.pointer(20, 30), isPrimary: true });
  first.editor.tijdensTekenen(first.pointer(50, 60));
  first.editor.stopTekenen();
  await first.editor.slaConceptOp();
  assert.equal(opslag.concept.verfstreken[0].punten.length, 2);
  assert.match(first.editor.conceptMelding.value, /opgeslagen/);
  first.close();
  const second = await setup({ opslag, leeg: true });
  try {
    assert.equal(second.editor.fileName.value, "foto.png");
    assert.equal(second.editor.achtergrondBestandsnaam.value, "achtergrond.png");
    assert.equal(second.editor.tekstFormulier.value.inhoud, "Onze club");
    assert.equal(second.editor.achtergrondVoorbeeld.value, "rgb(18, 52, 86)");
    const photo = second.app.stage.children.find(child => child instanceof Sprite && child.angle > 0);
    near(photo.angle, 30);
    assert.equal(second.editor.lagen.value.find(laag => laag.id === "afbeelding").vergrendeld, true);
    assert.equal(second.editor.lagen.value.find(laag => laag.id === "achtergrond").zichtbaar, false);
    assert.equal(second.editor.geschiedenis.value.length, 0);
    second.editor.wisselLaagVergrendeling("afbeelding");
    second.editor.selecteerLaag("afbeelding");
    second.editor.draaiFoto(15);
    near(photo.angle, 45);
    await second.editor.slaConceptOp();
    assert.equal(opslag.concept.verfstreken[0].punten[1].x, 50);
  } finally { second.close(); }
});

test("failed save keeps the previous draft and reports failure", async () => {
  const opslag = {};
  const h = await setup({ opslag });
  try {
    await h.editor.slaConceptOp();
    const vorige = opslag.concept;
    opslag.fout = true;
    h.editor.kiesAchtergrondKleur("#abcdef");
    await h.editor.slaConceptOp();
    assert.equal(opslag.concept, vorige);
    assert.match(h.editor.conceptMelding.value, /Opslaan mislukt/);
    assert.equal(h.editor.conceptBezig.value, false);
  } finally { h.close(); }
});


test("saving an empty design replaces the prior draft", async () => {
  const opslag = {};
  const h = await setup({ opslag });
  await h.editor.slaConceptOp();
  h.editor.verwijderLaag("tekst");
  h.editor.verwijderLaag("afbeelding");
  await h.editor.slaConceptOp();
  h.close();
  const next = await setup({ opslag, leeg: true });
  try {
    assert.equal(next.editor.fileName.value, "");
    assert.equal(next.editor.lagen.value.some(laag => laag.aanwezig), false);
    assert.equal(next.editor.achtergrondIngesteld.value, false);
  } finally { next.close(); }
});

test("Ctrl+Z and Cmd+Z share button undo and clean up on unmount", async () => {
  const h = await setup();
  let prevented = 0;
  try {
    h.editor.selecteerLaag("afbeelding");
    h.editor.draaiFoto(30);
    h.window.emit("keydown", { key: "z", ctrlKey: true, preventDefault() { prevented++; } });
    near(h.photo.angle, 0);
    h.editor.draaiFoto(60);
    h.window.emit("keydown", { key: "z", metaKey: true, preventDefault() { prevented++; } });
    near(h.photo.angle, 0);
    h.editor.draaiFoto(90);
    h.editor.ongedaanMaken();
    near(h.photo.angle, 0);
    assert.equal(prevented, 2);
    assert.equal(h.editor.opnieuwToe, undefined);
  } finally { h.close(); }
  assert.equal(h.window.handlers.get("keydown").size, 0);
});

test("undo shortcut finishes a slider change but respects text input and other shortcuts", async () => {
  const h = await setup();
  try {
    h.editor.kiesAchtergrondKleur("#ff0000", true);
    const range = { type: "range", closest(selector) { return selector === "input" ? this : null; } };
    h.window.emit("keydown", { key: "z", ctrlKey: true, target: range, preventDefault() {} });
    assert.equal(h.editor.achtergrondVoorbeeld.value, "rgb(230, 230, 230)");
    h.editor.selecteerLaag("afbeelding");
    h.editor.draaiFoto(30);
    const tekst = { type: "text", closest(selector) { return selector === "input" ? this : null; } };
    const verboden = () => assert.fail("Text undo and unrelated keys must not be intercepted");
    for (const extra of [
      { target: tekst }, { target: { isContentEditable: true } },
      { shiftKey: true }, { altKey: true }, { isComposing: true },
      { defaultPrevented: true }, { key: "y" },
    ]) {
      h.window.emit("keydown", { key: "z", ctrlKey: true, preventDefault: verboden, ...extra });
      near(h.photo.angle, 30);
    }
  } finally { h.close(); }
});


test("first upload is removed by the button, Ctrl+Z or Cmd+Z, including file input focus", async () => {
  for (const actie of ["button", "ctrlKey", "metaKey"]) {
    const h = await setup({ leeg: true });
    try {
      await h.editor.uploadFoto({ target: { files: [{ name: "logo.png" }], value: "" } });
      assert.equal(h.editor.geschiedenis.value.length, 1);
      assert.equal(h.editor.fileName.value, "logo.png");
      if (actie === "button") h.editor.ongedaanMaken();
      else {
        const input = { type: "file", closest(selector) { return selector === "input" ? this : null; } };
        h.window.emit("keydown", { key: "z", [actie]: true, target: input, preventDefault() {} });
      }
      assert.equal(h.editor.fileName.value, "");
      assert.equal(h.editor.lagen.value.find(l => l.id === "afbeelding").aanwezig, false);
      assert.equal(h.app.stage.children.some(c => c instanceof Sprite), false);
      assert.equal(h.editor.geschiedenis.value.length, 0);
    } finally { h.close(); }
  }
});

test("undo replacement and deletion restores original image, transform, exposure and earlier history", async () => {
  const h = await setup({ leeg: true });
  try {
    await h.editor.uploadFoto({ target: { files: [{ name: "original.png" }], value: "" } });
    h.editor.selecteerLaag("afbeelding");
    h.editor.draaiFoto(45);
    h.editor.veranderBelichting(1);
    h.editor.stopKleurWijziging();
    await h.editor.uploadFoto({ target: { files: [{ name: "replacement.png" }], value: "" } });
    h.editor.ongedaanMaken();
    assert.equal(h.editor.fileName.value, "original.png");
    let restored = h.app.stage.children.find(c => c instanceof Sprite);
    near(restored.angle, 45);
    assert.equal(h.editor.belichtingWaarde.value, 1);
    h.editor.verwijderLaag("afbeelding");
    assert.equal(h.editor.fileName.value, "");
    h.editor.ongedaanMaken();
    restored = h.app.stage.children.find(c => c instanceof Sprite);
    near(restored.angle, 45);
    h.editor.selecteerLaag("afbeelding");
    assert.equal(h.editor.belichtingWaarde.value, 1);
    h.editor.ongedaanMaken();
    assert.equal(h.editor.belichtingWaarde.value, 0);
    h.editor.ongedaanMaken();
    near(restored.angle, 0);
    h.editor.ongedaanMaken();
    assert.equal(h.editor.fileName.value, "");
  } finally { h.close(); }
});

test("background upload and removal are undoable without affecting the logo", async () => {
  const h = await setup();
  try {
    await h.editor.uploadAchtergrond({ target: { files: [{ name: "background.png" }], value: "" } });
    const background = h.app.stage.children[0];
    background.position.set(380, 240);
    h.editor.verwijderLaag("achtergrond");
    h.editor.ongedaanMaken();
    assert.equal(h.editor.achtergrondBestandsnaam.value, "background.png");
    near(h.app.stage.children[0].x, 380);
    near(h.app.stage.children[0].y, 240);
    h.editor.ongedaanMaken();
    assert.equal(h.editor.achtergrondBestandsnaam.value, "");
    assert.ok(h.app.stage.children.includes(h.photo));
    assert.ok(h.app.stage.children.includes(h.text));
  } finally { h.close(); }
});
