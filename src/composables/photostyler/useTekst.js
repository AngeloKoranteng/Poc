import { ref } from "vue";
import { Text } from "pixi.js";
import { leesOpmaak, maakCanvasTekst } from "./tekstOpmaak.js";

export function useTekst({
  getApp,
  getFotoKader,
  kanBewerken,
  voorBewerking,
  bewaarToestand,
  renderCanvas,
  startSlepen,
  naToepassen,
}) {
  // Beginwaarden voor één tekstblok op het canvas.
  const standaardTekst = {
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
  const tekstFormulier = ref({ ...standaardTekst });
  const canvasTekstActief = ref(false);
  const canvasTekstInvoer = ref("");
  const canvasTekstOpmaak = ref({ ...standaardTekst });
  let formulierVoorCanvas = null;

  function startCanvasTekst() {
    if (!kanBewerken() || canvasTekstActief.value) return;
    voorBewerking();
    formulierVoorCanvas = { ...tekstFormulier.value };
    const tekst = huidigeTekst() ?? {
      ...tekstFormulier.value,
      grootte: begrens(tekstFormulier.value.grootte, 8, 160, 36),
    };
    canvasTekstOpmaak.value = { ...tekst };
    canvasTekstInvoer.value = tekst.inhoud;
    canvasTekstActief.value = true;
    renderCanvas();
  }

  function stopCanvasTekst(opslaan = true) {
    if (!canvasTekstActief.value) return;
    canvasTekstActief.value = false;
    if (opslaan) {
      tekstFormulier.value = {
        ...canvasTekstOpmaak.value,
        inhoud: canvasTekstInvoer.value,
      };
      if (canvasTekstInvoer.value.trim()) pasTekstToe();
      else verwijderTekst();
    } else {
      tekstFormulier.value = { ...formulierVoorCanvas };
    }
    formulierVoorCanvas = null;
    renderCanvas();
  }

  let toegepasteTekst = null;
  let tekstObject = null;

  // Begrenst numerieke invoer en vangt lege velden op.
  function begrens(waarde, minimum, maximum, standaard) {
    if (waarde === "" || waarde === null) return standaard;

    const getal = Number(waarde);

    return Number.isFinite(getal)
      ? Math.max(minimum, Math.min(maximum, getal))
      : standaard;
  }

  // Herstelt tekst zonder een nieuwe geschiedenisstap te maken.
  function herstelTekst(toestand) {
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
        startSlepen(event, tekstObject);
      });

      const app = getApp();
      app.stage.addChild(tekstObject);

      // Houdt de fotogrepen boven de tekst.
      app.stage.addChild(getFotoKader());
    }

   const canvasTekst = maakCanvasTekst(toestand);
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
  function pasTekstToe() {
    if (!kanBewerken()) return;

    const formulier = tekstFormulier.value;
    const inhoud = formulier.inhoud;

    if (!inhoud.trim()) return;

    voorBewerking();

    const volgende = {
      inhoud,
      opmaak: leesOpmaak(formulier),
      kleur: formulier.kleur,
      lettertype: formulier.lettertype ?? "Arial",
      vet: !!formulier.vet,
      cursief: !!formulier.cursief,
      grootte: begrens(formulier.grootte, 8, 160, 36),
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

    if (JSON.stringify(volgende) === JSON.stringify(huidigeTekst())) {
      return;
    }

    bewaarToestand();
    herstelTekst(volgende);
    naToepassen();
    renderCanvas();
  }

  // Verwijdert de tekst en maakt dit ongedaan te maken.
  function verwijderTekst() {
    if (!kanBewerken()) return;

    voorBewerking();

    if (toegepasteTekst) {
      bewaarToestand();
    }

    herstelTekst(null);
    renderCanvas();
  }

  // Leest ook de actuele transformatie voor de bewerkingsgeschiedenis.
  function huidigeTekst() {
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
  function synchroniseerTekst() {
    if (!tekstObject) return;
    tekstFormulier.value.x = tekstObject.x;
    tekstFormulier.value.y = tekstObject.y;
  }

  return {
    canvasTekstActief,
    canvasTekstInvoer,
    canvasTekstOpmaak,
    startCanvasTekst,
    stopCanvasTekst,
    tekstFormulier,
    pasTekstToe,
    verwijderTekst,
    herstelTekst,
    huidigeTekst,
    synchroniseerTekst,
    getTekstObject: () => tekstObject,
  };
}
