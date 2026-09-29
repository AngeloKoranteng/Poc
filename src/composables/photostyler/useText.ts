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
  // Beginwaarden voor één tekstblok op het canvas.
  const standaardTekst: TextState = {
    inhoud: "",
    kleur: "#172e2b",
    grootte: 36,
    lettertype: "Arial",
    vet: false,
    cursief: false,
    opmaak: [],
    x: 400,
    y: 250,
  };

  // Houdt invoer apart van de tekst die daadwerkelijk is toegepast.
  const tekstFormulier = ref<TextForm>({ ...standaardTekst });
  const canvasTekstActief = ref(false);
  const canvasTekstInvoer = ref("");
  const canvasTekstOpmaak = ref<Omit<TextForm, "grootte"> & { grootte: number }>({ ...standaardTekst });
  let formulierVoorCanvas: TextForm | null = null;

  function startCanvasText() {
    if (!canEdit() || canvasTekstActief.value) return;
    beforeEdit();
    formulierVoorCanvas = { ...tekstFormulier.value };
    const tekst = getCurrentText() ?? {
      ...tekstFormulier.value,
      grootte: clamp(tekstFormulier.value.grootte, 8, 160, 36),
    };
    canvasTekstOpmaak.value = { ...tekst };
    canvasTekstInvoer.value = tekst.inhoud;
    canvasTekstActief.value = true;
    renderCanvas();
  }

  function stopCanvasText(opslaan = true) {
    if (!canvasTekstActief.value) return;
    canvasTekstActief.value = false;
    if (opslaan) {
      tekstFormulier.value = {
        ...canvasTekstOpmaak.value,
        inhoud: canvasTekstInvoer.value,
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

  // Begrenst numerieke invoer en vangt lege velden op.
  function clamp(waarde: unknown, minimum: number, maximum: number, standaard: number) {
    if (waarde === "" || waarde === null) return standaard;

    const getal = Number(waarde);

    return Number.isFinite(getal)
      ? Math.max(minimum, Math.min(maximum, getal))
      : standaard;
  }

  // Herstelt tekst zonder een nieuwe geschiedenisstap te maken.
  function restoreText(toestand: TextState | null) {
    toegepasteTekst = toestand;
    tekstFormulier.value = { ...(toestand ?? standaardTekst) };

    if (!toestand) {
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

      // Maakt de tekst selecteerbaar en versleepbaar.
      tekstObject.eventMode = "static";
      tekstObject.cursor = "grab";
      tekstObject.on("pointerdown", (event) => {
        if (tekstObject) startDrag(event, tekstObject);
      });

      const app = getApp();
      app.stage.addChild(tekstObject);

      // Houdt de fotogrepen boven de tekst.
      app.stage.addChild(getPhotoFrame());
    }

   const canvasTekst = createCanvasText(toestand);
    tekstObject.text = canvasTekst.text;
    tekstObject.style = {
      fontFamily: toestand.lettertype ?? "Arial",
      fontWeight: toestand.vet ? "bold" : "normal",
      fontStyle: toestand.cursief ? "italic" : "normal",
      fontSize: toestand.grootte,
      tagStyles: canvasTekst.tagStyles,
      fill: toestand.kleur,
      align: "center",
      wordWrap: true,
      wordWrapWidth: 720,
      breakWords: true,
    };
    tekstObject.position.set(toestand.x, toestand.y);
    tekstObject.scale.set(toestand.schaalX ?? 1, toestand.schaalY ?? 1);
    tekstObject.angle = toestand.hoek ?? 0;
  }

  // Past de invoer toe als één bewerking voor Ongedaan maken.
  function applyText() {
    if (!canEdit()) return;

    const formulier = tekstFormulier.value;
    const inhoud = formulier.inhoud;

    if (!inhoud.trim()) return;

    beforeEdit();

    const volgende = {
      inhoud,
      opmaak: readFormatting(formulier),
      kleur: formulier.kleur,
      lettertype: formulier.lettertype ?? "Arial",
      vet: !!formulier.vet,
      cursief: !!formulier.cursief,
      grootte: clamp(formulier.grootte, 8, 160, 36),
      // Slepen mag de tekst ook gedeeltelijk buiten het canvas plaatsen.
      x:
        Number.isFinite(Number(formulier.x)) && formulier.x !== ""
          ? Number(formulier.x)
          : 400,
      y:
        Number.isFinite(Number(formulier.y)) && formulier.y !== ""
          ? Number(formulier.y)
          : 250,
      schaalX: tekstObject?.scale.x ?? 1,
      schaalY: tekstObject?.scale.y ?? 1,
      hoek: tekstObject?.angle ?? 0,
    };

    if (JSON.stringify(volgende) === JSON.stringify(getCurrentText())) {
      return;
    }

    saveState();
    restoreText(volgende);
    afterApply();
    renderCanvas();
  }

  // Verwijdert de tekst en maakt dit ongedaan te maken.
  function removeText() {
    if (!canEdit()) return;

    beforeEdit();

    if (toegepasteTekst) {
      saveState();
    }

    restoreText(null);
    renderCanvas();
  }

  // Leest ook de actuele transformatie voor de bewerkingsgeschiedenis.
  function getCurrentText() {
    if (!toegepasteTekst || !tekstObject) return null;
    return {
      ...toegepasteTekst,
      x: tekstObject.x,
      y: tekstObject.y,
      schaalX: tekstObject.scale.x,
      schaalY: tekstObject.scale.y,
      hoek: tekstObject.angle,
    };
  }

  // Houdt de invoervelden gelijk aan de positie na het verslepen.
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
