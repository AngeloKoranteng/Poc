import { Texture, Sprite } from "pixi.js";

// Interfaces for the stored resources in the folder
interface ExposureSource {
  sprite: Sprite;
  image: HTMLImageElement | HTMLCanvasElement;
  original: Texture;
  value: number;
  processing: {
    canvas: HTMLCanvasElement;
    context: CanvasRenderingContext2D;
    pixels: ImageData;
    output: ImageData;
    texture: Texture;
  } | null;
}

// Always calculate from the original; transparency remains unchanged
export function illuminatePixels(
    original: Uint8ClampedArray,
    output: Uint8ClampedArray,
    value: number
): void {
  const factor = 2 ** value;
  const lookup = new Uint8ClampedArray(256);
  for (let channel = 0; channel < 256; channel++) {
    lookup[channel] = Math.round(channel * factor);
  }
  for (let index = 0; index < original.length; index += 4) {
    output[index] = lookup[original[index]];
    output[index + 1] = lookup[original[index + 1]];
    output[index + 2] = lookup[original[index + 2]];
    output[index + 3] = original[index + 3];
  }
}

export function useLighting() {
  const sources = new Map<string, ExposureSource>();

  function register(id: string, sprite: Sprite, image: HTMLImageElement | HTMLCanvasElement): void {
    remove(id);
    sources.set(id, {
      sprite,
      image,
      original: sprite.texture,
      value: 0,
      processing: null,
    });
  }

  function apply(id: string, value: number): void {
    const source = sources.get(id);
    if (!source || source.value === value) return;

    if (value === 0) {
      source.sprite.texture = source.original;
      source.value = 0;
      return;
    }

    // Read pixels only when the user adjust exposure, not upon upload
    if (!source.processing) {
      const canvas = document.createElement("canvas");
      canvas.width = source.original.width;
      canvas.height = source.original.height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Geen 2D-context voor belichting beschikbaar.");
      context.drawImage(source.image, 0, 0, canvas.width, canvas.height);
      source.processing = {
        canvas,
        context,
        pixels: context.getImageData(0, 0, canvas.width, canvas.height),
        output: context.createImageData(canvas.width, canvas.height),
        texture: Texture.from(canvas),
      };
    }

    const { context, pixels, output, texture } = source.processing;
    illuminatePixels(pixels.data, output.data, value);
    context.putImageData(output, 0, 0);
    // Also refresh the canvas render cache for a darkened background
    texture.source.unload();
    texture.source.update();
    source.sprite.texture = texture;
    source.value = value;
  }

  function remove(id: string): void {
    const source = sources.get(id);
    if (!source) return;
    // The existing upload/delete code cleans up the original texture
    source.sprite.texture = source.original;
    source.processing?.texture.destroy(true);
    sources.delete(id);
  }

  function dispose(): void {
    for (const id of sources.keys()) remove(id);
  }

  return { register, apply, remove, dispose };
}
