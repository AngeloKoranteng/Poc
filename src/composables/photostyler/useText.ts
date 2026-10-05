import type { Application, Graphics, FederatedPointerEvent } from "pixi.js";
import type { EditableObject, TextState, TextForm } from "./types.ts";
interface TextOptions {
  getApp: () => Application;
  getPhotoFrame: () => Graphics;
  canEdit: () => boolean;
  beforeEdit: () => void;
  saveState: () => void;
  renderCanvas: () => void;
  startDrag: (event: FederatedPointerEvent, object: EditableObject) => void;
  afterApply: () => void;
}
import { ref } from "vue";
import { Text } from "pixi.js";
import { readFormatting, createCanvasText } from "./textLayout.ts";

export function useText({
  getApp,
  getPhotoFrame,
  canEdit,
  beforeEdit,
  saveState,
  renderCanvas,
  startDrag,
  afterApply,
}: TextOptions) {
  // Default values for one text block on the cnavas
  const standaardTekst: TextState = {
    content: "",
    color: "#172e2b",
    size: 36,
    fontFamily: "Arial",
    bold: false,
    italics: false,
    formatting: [],
    x: 400,
    y: 250,
  };

  // Keep input separate from the text that was actually apllied
  const tekstFormulier = ref<TextForm>({ ...standaardTekst });
  const canvasTekstActief = ref(false);
  const canvasTekstInvoer = ref("");
  const canvasTekstOpmaak = ref<Omit<TextForm, "size"> & { size: number }>({ ...standaardTekst });
  let formulierVoorCanvas: TextForm | null = null;

  function startCanvasText() {
    if (!canEdit() || canvasTekstActief.value) return;
    beforeEdit();
    formulierVoorCanvas = { ...tekstFormulier.value };
    const text = getCurrentText() ?? {
      ...tekstFormulier.value,
      size: clamp(tekstFormulier.value.size, 8, 160, 36),
    };
    canvasTekstOpmaak.value = { ...text };
    canvasTekstInvoer.value = text.content;
    canvasTekstActief.value = true;
    renderCanvas();
  }

  function stopCanvasText(opslaan = true) {
    if (!canvasTekstActief.value) return;
    canvasTekstActief.value = false;
    if (opslaan) {
      tekstFormulier.value = {
        ...canvasTekstOpmaak.value,
        content: canvasTekstInvoer.value,
      };
      if (canvasTekstInvoer.value.trim()) applyText();
      else removeText();
    } else {
      tekstFormulier.value = { ...(formulierVoorCanvas ?? standaardTekst) };
    }
    formulierVoorCanvas = null;
    renderCanvas();
  }

  let toegepasteTekst: TextState | null = null;
  let tekstObject: Text | null = null;

  // Limits numerical input nd catches empty fields
  function clamp(value: unknown, minimum: number, maximum: number, standaard: number) {
    if (value === "" || value === null) return standaard;

    const getal = Number(value);

    return Number.isFinite(getal)
      ? Math.max(minimum, Math.min(maximum, getal))
      : standaard;
  }

  // Restores text without taking a new historical step
  function restoreText(condition: TextState | null) {
    toegepasteTekst = condition;
    tekstFormulier.value = { ...(condition ?? standaardTekst) };

    if (!condition) {
      if (tekstObject) {
        tekstObject.parent?.removeChild(tekstObject);
        tekstObject.destroy();
        tekstObject = null;
      }
      return;
    }

    if (!tekstObject) {
      tekstObject = new Text({ text: "" });
      tekstObject.anchor.set(0.5);

      // Makes the text selectable and draggable
      tekstObject.eventMode = "static";
      tekstObject.cursor = "grab";
      tekstObject.on("pointerdown", (event) => {
        if (tekstObject) startDrag(event, tekstObject);
      });

      const app = getApp();
      app.stage.addChild(tekstObject);

      // Keeps the fotogrip above the text
      app.stage.addChild(getPhotoFrame());
    }

   const canvasTekst = createCanvasText(condition);
    tekstObject.text = canvasTekst.text;
    tekstObject.style = {
      fontFamily: condition.fontFamily ?? "Arial",
      fontWeight: condition.bold ? "bold" : "normal",
      fontStyle: condition.italics ? "italic" : "normal",
      fontSize: condition.size,
      tagStyles: canvasTekst.tagStyles,
      fill: condition.color,
      align: "center",
      wordWrap: true,
      wordWrapWidth: 720,
      breakWords: true,
    };
    tekstObject.position.set(condition.x, condition.y);
    tekstObject.scale.set(condition.scaleX ?? 1, condition.scaleY ?? 1);
    tekstObject.angle = condition.corner ?? 0;
  }

  // Applies the input as a single Undo operation
  function applyText() {
    if (!canEdit()) return;

    const formulier = tekstFormulier.value;
    const content = formulier.content;

    if (!content.trim()) return;

    beforeEdit();

    const volgende = {
      content,
      formatting: readFormatting(formulier),
      color: formulier.color,
      fontFamily: formulier.fontFamily ?? "Arial",
      bold: !!formulier.bold,
      italics: !!formulier.italics,
      size: clamp(formulier.size, 8, 160, 36),
      // Dragging may also place the text partially outside the canvas
      x:
        Number.isFinite(Number(formulier.x)) && formulier.x !== ""
          ? Number(formulier.x)
          : 400,
      y:
        Number.isFinite(Number(formulier.y)) && formulier.y !== ""
          ? Number(formulier.y)
          : 250,
      scaleX: tekstObject?.scale.x ?? 1,
      scaleY: tekstObject?.scale.y ?? 1,
      corner: tekstObject?.angle ?? 0,
    };

    if (JSON.stringify(volgende) === JSON.stringify(getCurrentText())) {
      return;
    }

    saveState();
    restoreText(volgende);
    afterApply();
    renderCanvas();
  }

  // Deletes the text and makes it undoable
  function removeText() {
    if (!canEdit()) return;

    beforeEdit();

    if (toegepasteTekst) {
      saveState();
    }

    restoreText(null);
    renderCanvas();
  }

  // Also read the current transformation for the edit history
  function getCurrentText() {
    if (!toegepasteTekst || !tekstObject) return null;
    return {
      ...toegepasteTekst,
      x: tekstObject.x,
      y: tekstObject.y,
      scaleX: tekstObject.scale.x,
      scaleY: tekstObject.scale.y,
      corner: tekstObject.angle,
    };
  }

  // Keep the input fields the same as the position after dragging
  function syncText() {
    if (!tekstObject) return;
    tekstFormulier.value.x = tekstObject.x;
    tekstFormulier.value.y = tekstObject.y;
  }

  return {
    canvasTekstActief,
    canvasTekstInvoer,
    canvasTekstOpmaak,
    startCanvasText,
    stopCanvasText,
    tekstFormulier,
    applyText,
    removeText,
    restoreText,
    getCurrentText,
    syncText,
    getTextObject: () => tekstObject,
  };
}
