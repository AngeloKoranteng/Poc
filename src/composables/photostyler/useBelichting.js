import { Texture } from "pixi.js";

// Reken altijd vanaf het origineel; transparantie blijft ongewijzigd.
export function belichtPixels(origineel, uitvoer, waarde) {
  const factor = 2 ** waarde;
  const tabel = new Uint8ClampedArray(256);
  for (let kanaal = 0; kanaal < 256; kanaal++) {
    tabel[kanaal] = Math.round(kanaal * factor);
  }
  for (let index = 0; index < origineel.length; index += 4) {
    uitvoer[index] = tabel[origineel[index]];
    uitvoer[index + 1] = tabel[origineel[index + 1]];
    uitvoer[index + 2] = tabel[origineel[index + 2]];
    uitvoer[index + 3] = origineel[index + 3];
  }
}

export function useBelichting() {
  const bronnen = new Map();

  function registreer(id, sprite, afbeelding) {
    verwijder(id);
    bronnen.set(id, {
      sprite,
      afbeelding,
      origineel: sprite.texture,
      waarde: 0,
      bewerking: null,
    });
  }

  function pasToe(id, waarde) {
    const bron = bronnen.get(id);
    if (!bron || bron.waarde === waarde) return;

    if (waarde === 0) {
      bron.sprite.texture = bron.origineel;
      bron.waarde = 0;
      return;
    }

    // Lees pixels pas zodra de gebruiker belichting aanpast, niet bij upload.
    if (!bron.bewerking) {
      const canvas = document.createElement("canvas");
      canvas.width = bron.origineel.width;
      canvas.height = bron.origineel.height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Geen 2D-context voor belichting beschikbaar.");
      context.drawImage(bron.afbeelding, 0, 0, canvas.width, canvas.height);
      bron.bewerking = {
        canvas,
        context,
        pixels: context.getImageData(0, 0, canvas.width, canvas.height),
        uitvoer: context.createImageData(canvas.width, canvas.height),
        texture: Texture.from(canvas),
      };
    }

    const { context, pixels, uitvoer, texture } = bron.bewerking;
    belichtPixels(pixels.data, uitvoer.data, waarde);
    context.putImageData(uitvoer, 0, 0);
    // Vernieuw ook de Canvas-renderercache voor een verduisterde achtergrond.
    texture.source.unload();
    texture.source.update();
    bron.sprite.texture = texture;
    bron.waarde = waarde;
  }

  function verwijder(id) {
    const bron = bronnen.get(id);
    if (!bron) return;
    // De bestaande upload-/verwijdercode ruimt de originele texture op.
    bron.sprite.texture = bron.origineel;
    bron.bewerking?.texture.destroy(true);
    bronnen.delete(id);
  }

  function ruimOp() {
    for (const id of bronnen.keys()) verwijder(id);
  }

  return { registreer, pasToe, verwijder, ruimOp };
}
