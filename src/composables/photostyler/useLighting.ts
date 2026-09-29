import { Texture, Sprite } from "pixi.js";

// Interface voor de opgeslagen bronnen in de Map
interface BelichtingsBron {
  sprite: Sprite;
  afbeelding: HTMLImageElement | HTMLCanvasElement;
  origineel: Texture;
  waarde: number;
  bewerking: {
    canvas: HTMLCanvasElement;
    context: CanvasRenderingContext2D;
    pixels: ImageData;
    uitvoer: ImageData;
    texture: Texture;
  } | null;
}

// Reken altijd vanaf het origineel; transparantie blijft ongewijzigd.
export function illuminatePixels(
    origineel: Uint8ClampedArray,
    uitvoer: Uint8ClampedArray,
    waarde: number
): void {
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

export function useLighting() {
  const bronnen = new Map<string, BelichtingsBron>();

  function register(id: string, sprite: Sprite, afbeelding: HTMLImageElement | HTMLCanvasElement): void {
    remove(id);
    bronnen.set(id, {
      sprite,
      afbeelding,
      origineel: sprite.texture,
      waarde: 0,
      bewerking: null,
    });
  }

  function apply(id: string, waarde: number): void {
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
    illuminatePixels(pixels.data, uitvoer.data, waarde);
    context.putImageData(uitvoer, 0, 0);
    // Vernieuw ook de Canvas-renderercache voor een verduisterde achtergrond.
    texture.source.unload();
    texture.source.update();
    bron.sprite.texture = texture;
    bron.waarde = waarde;
  }

  function remove(id: string): void {
    const bron = bronnen.get(id);
    if (!bron) return;
    // De bestaande upload-/verwijdercode ruimt de originele texture op.
    bron.sprite.texture = bron.origineel;
    bron.bewerking?.texture.destroy(true);
    bronnen.delete(id);
  }

  function dispose(): void {
    for (const id of bronnen.keys()) remove(id);
  }

  return { register, apply, remove, dispose };
}
