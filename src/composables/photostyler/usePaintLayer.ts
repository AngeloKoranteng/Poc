import type { Ref } from "vue";
import type { PaintStroke, Point } from "./types.ts";
interface PaintOptions {
  verfCanvas: Ref<HTMLCanvasElement | null>;
  tekenModus: Ref<boolean>;
  canvasKlaar: Ref<boolean>;
  kwastKleur: Ref<string>;
  kwastGrootte: Ref<number>;
  hasPhoto: () => boolean;
  stopDrag: () => void;
  stopColorChange: () => void;
  saveState: () => void;
}
export function usePaintLayer({
  verfCanvas, tekenModus, canvasKlaar, kwastKleur, kwastGrootte,
  hasPhoto, stopDrag, stopColorChange, saveState,
}: PaintOptions) {
  // Verfstreken, de huidige streek en de actieve aanwijzer.
  let verfstreken: PaintStroke[] = [];
  let actieveStreek: PaintStroke | null = null;
  let tekenPointer: number | null = null;

  // Rekent de aanwijzerpositie om naar canvascoordinaten.
  function getDrawingPoint(event: PointerEvent) {
    const rechthoek = verfCanvas.value!.getBoundingClientRect();
    return {
      x: ((event.clientX - rechthoek.left) * verfCanvas.value!.width) / rechthoek.width,
      y: ((event.clientY - rechthoek.top) * verfCanvas.value!.height) / rechthoek.height,
    };
  }

  // Tekent een ronde stip of een lijnstuk op de verflaag.
  function paintSegment(streek: PaintStroke, van: Point, naar = van) {
    const context = verfCanvas.value?.getContext("2d");
    if (!context) return;
    context.fillStyle = streek.kleur;
    context.strokeStyle = streek.kleur;
    context.lineWidth = streek.grootte;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    if (van.x === naar.x && van.y === naar.y) {
      context.arc(van.x, van.y, streek.grootte / 2, 0, Math.PI * 2);
      context.fill();
    } else {
      context.moveTo(van.x, van.y);
      context.lineTo(naar.x, naar.y);
      context.stroke();
    }
  }

  // Begint een kwaststreek met de gekozen kleur en dikte.
  function startDrawing(event: PointerEvent) {
    if (
      !verfCanvas.value ||
      !tekenModus.value ||
      !canvasKlaar.value ||
      !hasPhoto() ||
      tekenPointer !== null ||
      !event.isPrimary ||
      event.button !== 0
    )
      return;

    event.preventDefault();
    stopDrag();
    stopColorChange();
    saveState();
    tekenPointer = event.pointerId;
    verfCanvas.value.setPointerCapture(tekenPointer);
    actieveStreek = {
      kleur: kwastKleur.value,
      grootte: Math.max(1, Math.min(80, Number(kwastGrootte.value) || 1)),
      punten: [getDrawingPoint(event)],
    };
    verfstreken.push(actieveStreek);
    paintSegment(actieveStreek, actieveStreek.punten[0]);
  }

  // Voegt tijdens het bewegen punten toe aan de kwaststreek.
  function continueDrawing(event: PointerEvent) {
    if (!actieveStreek || event.pointerId !== tekenPointer) return;
    event.preventDefault();
    const punt = getDrawingPoint(event);
    const vorigPunt = actieveStreek.punten[actieveStreek.punten.length - 1];
    if (punt.x === vorigPunt.x && punt.y === vorigPunt.y) return;
    actieveStreek.punten.push(punt);
    paintSegment(actieveStreek, vorigPunt, punt);
  }

  // Rondt de kwaststreek af en laat de aanwijzer los.
  function stopDrawing(event?: PointerEvent) {
    if (tekenPointer === null || (event && event.pointerId !== tekenPointer)) return;
    if (event?.type === "pointerup") continueDrawing(event);
    const pointer = tekenPointer;
    tekenPointer = null;
    actieveStreek = null;
    if (verfCanvas.value?.hasPointerCapture(pointer)) {
      verfCanvas.value.releasePointerCapture(pointer);
    }
  }

  // Bouwt de verflaag opnieuw op uit de overgebleven streken.
  function restorePaintLayer(aantal = 0) {
    stopDrawing();
    verfstreken.length = aantal;
    const canvas = verfCanvas.value;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    for (const streek of verfstreken) {
      paintSegment(streek, streek.punten[0]);
      for (let index = 1; index < streek.punten.length; index++) {
        paintSegment(streek, streek.punten[index - 1], streek.punten[index]);
      }
    }
  }

  function readPaintStrokes(): PaintStroke[] {
    return JSON.parse(JSON.stringify(verfstreken));
  }

  function loadPaintStrokes(streken: PaintStroke[]) {
    stopDrawing();
    verfstreken = JSON.parse(JSON.stringify(streken));
    restorePaintLayer(verfstreken.length);
  }

  return { readPaintStrokes, loadPaintStrokes, startDrawing, continueDrawing, stopDrawing, restorePaintLayer,
    getPaintStrokeCount: () => verfstreken.length,
  };
}
