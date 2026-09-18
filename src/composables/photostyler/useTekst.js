import { ref } from "vue";
import { Text } from "pixi.js";

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
    x: 400,
    y: 250,
  };

  // Houdt invoer apart van de tekst die daadwerkelijk is toegepast.
  const tekstFormulier = ref({ ...standaardTekst });
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

    tekstObject.text = toestand.inhoud;
    tekstObject.style = {
      fontFamily: "Arial",
      fontSize: toestand.grootte,
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
    const inhoud = formulier.inhoud.trim();

    if (!inhoud) return;

    voorBewerking();

    const volgende = {
      inhoud,
      kleur: formulier.kleur,
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
    tekstFormulier,
    pasTekstToe,
    verwijderTekst,
    herstelTekst,
    huidigeTekst,
    synchroniseerTekst,
    getTekstObject: () => tekstObject,
  };
}
