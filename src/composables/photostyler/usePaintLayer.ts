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
  // Paint strokes, the current stroke and the pointer.
  let brushstrokes: PaintStroke[] = [];
  let actieveStreek: PaintStroke | null = null;
  let tekenPointer: number | null = null;

  //converts the pointer position to canvas coordinates
  function getDrawingPoint(event: PointerEvent) {
    const rechthoek = verfCanvas.value!.getBoundingClientRect();
    return {
      x: ((event.clientX - rechthoek.left) * verfCanvas.value!.width) / rechthoek.width,
      y: ((event.clientY - rechthoek.top) * verfCanvas.value!.height) / rechthoek.height,
    };
  }

  // Draws a round dot or line segment on the paint layer
  function paintSegment(streek: PaintStroke, van: Point, naar = van) {
    const context = verfCanvas.value?.getContext("2d");
    if (!context) return;
    context.fillStyle = streek.color;
    context.strokeStyle = streek.color;
    context.lineWidth = streek.size;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    if (van.x === naar.x && van.y === naar.y) {
      context.arc(van.x, van.y, streek.size / 2, 0, Math.PI * 2);
      context.fill();
    } else {
      context.moveTo(van.x, van.y);
      context.lineTo(naar.x, naar.y);
      context.stroke();
    }
  }

  // Start a brushstroke with the chosen color and thickness.
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
      color: kwastKleur.value,
      size: Math.max(1, Math.min(80, Number(kwastGrootte.value) || 1)),
      points: [getDrawingPoint(event)],
    };
    brushstrokes.push(actieveStreek);
    paintSegment(actieveStreek, actieveStreek.points[0]);
  }

  // Adds points to the brushstroke as it moves
  function continueDrawing(event: PointerEvent) {
    if (!actieveStreek || event.pointerId !== tekenPointer) return;
    event.preventDefault();
    const punt = getDrawingPoint(event);
    const vorigPunt = actieveStreek.points[actieveStreek.points.length - 1];
    if (punt.x === vorigPunt.x && punt.y === vorigPunt.y) return;
    actieveStreek.points.push(punt);
    paintSegment(actieveStreek, vorigPunt, punt);
  }

  // Finish the brushstroke and release pointer
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

  // Rebuild the paint layer from the remaining strokes
  function restorePaintLayer(aantal = 0) {
    stopDrawing();
    brushstrokes.length = aantal;
    const canvas = verfCanvas.value;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    for (const streek of brushstrokes) {
      paintSegment(streek, streek.points[0]);
      for (let index = 1; index < streek.points.length; index++) {
        paintSegment(streek, streek.points[index - 1], streek.points[index]);
      }
    }
  }

  function readPaintStrokes(): PaintStroke[] {
    return JSON.parse(JSON.stringify(brushstrokes));
  }

  function loadPaintStrokes(streken: PaintStroke[]) {
    stopDrawing();
    brushstrokes = JSON.parse(JSON.stringify(streken));
    restorePaintLayer(brushstrokes.length);
  }

  return { readPaintStrokes, loadPaintStrokes, startDrawing, continueDrawing, stopDrawing, restorePaintLayer,
    getPaintStrokeCount: () => brushstrokes.length,
  };
}
