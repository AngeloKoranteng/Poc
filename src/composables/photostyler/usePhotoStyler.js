import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { Application, Graphics, Sprite, Texture, Rectangle } from "pixi.js";

import { panelen, kwastPalet } from "./config.js";
import { useKleuren } from "./useKleuren.js";
import { useVerflaag } from "./useVerflaag.js";
import { useTekst } from "./useTekst.js";

export function usePhotoStyler() {
  // Verwijzingen naar het canvas, de verflaag en het uploadveld.
  const canvasHost = ref(null);
  const verfCanvas = ref(null);
  const bestandInput = ref(null);

  // Bestandsnaam, meldingen en het geopende instellingenpaneel.
  const fileName = ref("");
  const foutmelding = ref("");
  const canvasKlaar = ref(false);
  const actiefPaneel = ref("uploads");
  // Vergrendelt de instellingen zolang een object wordt versleept of vervormd.
  const inspectorsVergrendeld = ref(false);

  // Aan/uit-status, kleur en dikte van de kwast.
  const tekenModus = ref(false);
  const kwastKleur = ref("#ff0000");
  const kwastGrootte = ref(12);

  // Bewaart eerdere toestanden en het begin van een bewerking.
  const geschiedenis = ref([]);
  let bezigMetHerstellen = false;
  let sleepBegin = null;
  let kleurBegin = null;

  // Pixi-editor en de afbeelding op het canvas.
  let app;
  let fotoSprite;
  let fotoKader;
  // Bepaalt welk object met de grepen wordt bewerkt.
  let geselecteerdType = "afbeelding";

  function getActiefObject() {
    return geselecteerdType === "tekst" ? getTekstObject() : fotoSprite;
  }

  // Leest de transformatie van de geselecteerde foto of tekst.
  function leesObjectToestand(object) {
    return {
      x: object.x,
      y: object.y,
      schaalX: object.scale.x,
      schaalY: object.scale.y,
      hoek: object.angle,
    };
  }

  // Hoekblokjes, zijgrepen en de actieve schaal- of draaibewerking.
  let hoekBlokjes = [];
  let draaiGreep;
  let resizeActie = null;

  const hoekRichtingen = [
    // Hoeken veranderen beide afmetingen met dezelfde factor.
    { x: -1, y: -1 },
    { x: 1, y: -1 },
    { x: 1, y: 1 },
    { x: -1, y: 1 },

    // Zijgrepen veranderen alleen de breedte of hoogte.
    { x: -1, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: -1 },
    { x: 0, y: 1 },
  ];
  // Voorkomt dat een verouderde upload na het laden wordt getoond.
  let uploadId = 0;
  let unmounted = false;

  // Sleepstatus en afstand tussen de aanwijzer en de afbeelding.
  let slepen = false;
  let verschil = { x: 0, y: 0 };

  // Opent een paneel en stopt de actieve bewerking.
  function kiesPaneel(paneel) {
    stopResize();
    stopSlepen();
    stopTekenen();
    stopKleurWijziging();
    if (paneel !== "tekenen") tekenModus.value = false;
    actiefPaneel.value = paneel;
    // Laat de grepen aansluiten bij het gekozen instellingenpaneel.
    if (paneel === "tekst" || paneel === "afbeelding") {
      geselecteerdType = paneel;
    }
    renderCanvas();
  }

  // Schakelt de kwast in of uit.
  function wisselKwast() {
    stopResize();
    stopSlepen();
    stopTekenen();
    stopKleurWijziging();
    tekenModus.value = !tekenModus.value;
    if (tekenModus.value) actiefPaneel.value = "tekenen";
  }

  // Leest positie, schaal, kleuren en het aantal verfstreken.
  function huidigeToestand() {
    return {
      x: fotoSprite?.x ?? null,
      y: fotoSprite?.y ?? null,
      // Bewaart breedte en hoogte afzonderlijk voor Ongedaan maken.
      schaalX: fotoSprite?.scale.x ?? null,
      schaalY: fotoSprite?.scale.y ?? null,
      hoek: fotoSprite?.angle ?? 0,
      rood: rood.value,
      groen: groen.value,
      blauw: blauw.value,
      fotoRood: fotoRood.value,
      fotoGroen: fotoGroen.value,
      fotoBlauw: fotoBlauw.value,
      aantalVerfstreken: aantalVerfstreken(),
      tekst: huidigeTekst(),
    };
  }

  // Bewaart een toestand voor Ongedaan maken.
  function bewaarToestand(toestand = huidigeToestand()) {
    if (bezigMetHerstellen || !canvasKlaar.value) return;

    geschiedenis.value.push(toestand);
  }

  // Onthoudt de toestand voordat een kleurslider verandert.
  function startKleurWijziging() {
    stopResize();
    if (!canvasKlaar.value || kleurBegin) return;

    kleurBegin = huidigeToestand();
  }

  // Bewaart een kleurwijziging als een enkele bewerking.
  function stopKleurWijziging() {
    if (!kleurBegin) return;

    const einde = huidigeToestand();
    const veranderd = JSON.stringify(kleurBegin) !== JSON.stringify(einde);
    if (veranderd) {
      bewaarToestand(kleurBegin);
    }
    kleurBegin = null;
  }

  // Herstelt de vorige afbeelding, kleuren en verflaag.
  function ongedaanMaken() {
    stopResize();
    if (!canvasKlaar.value || geschiedenis.value.length === 0) return;

    stopSlepen();
    stopTekenen();
    stopKleurWijziging();

    const vorige = geschiedenis.value.pop();
    if (!vorige) return;

    bezigMetHerstellen = true;

    try {
      herstelVerflaag(vorige.aantalVerfstreken);
      herstelTekst(vorige.tekst ?? null);
      // Herstelt de positie, beide schalen en de draaihoek.
      if (fotoSprite && vorige.schaalX !== null && vorige.schaalY !== null) {
        fotoSprite.position.set(vorige.x, vorige.y);
        fotoSprite.scale.set(vorige.schaalX, vorige.schaalY);
        fotoSprite.angle = vorige.hoek;
      }

      rood.value = vorige.rood;
      groen.value = vorige.groen;
      blauw.value = vorige.blauw;

      fotoRood.value = vorige.fotoRood;
      fotoGroen.value = vorige.fotoGroen;
      fotoBlauw.value = vorige.fotoBlauw;

      if (fotoSprite) {
        fotoSprite.tint = fotoTint();
      }

      app.renderer.background.color = achtergrondKleur();
      renderCanvas();
    } finally {
      bezigMetHerstellen = false;
    }
  }

  // Maakt afzonderlijke hoekblokjes met een ruimer klikgebied.
  // Voegt ook zijgrepen en een ronde draaigreep toe.
  function maakHoekBlokjes() {
    hoekBlokjes = hoekRichtingen.map((richting) => {
      const blokje = new Graphics()
        .rect(-5, -5, 10, 10)
        .fill({ color: 0xffffff })
        .stroke({ width: 2, color: 0x3b82f6 });

      blokje.eventMode = "static";
      blokje.hitArea = new Rectangle(-12, -12, 24, 24);
      blokje.on("pointerdown", (event) => startResize(event, richting));

      fotoKader.addChild(blokje);
      return blokje;
    });

    draaiGreep = new Graphics()
      .circle(0, 0, 7)
      .fill({ color: 0xffffff })
      .stroke({ width: 2, color: 0x3b82f6 });

    draaiGreep.eventMode = "static";
    draaiGreep.cursor = "grab";
    draaiGreep.hitArea = new Rectangle(-14, -14, 28, 28);
    draaiGreep.on("pointerdown", startDraaien);

    fotoKader.addChild(draaiGreep);
  }

  // Laat het kader en de hoekblokjes de geselecteerde foto of tekst volgen.
  // Plaatst ook de zijgrepen en de draaigreep.
  function werkFotoKaderBij() {
    const object = getActiefObject();
    if (!fotoKader) return;

    fotoKader.clear();
    fotoKader.visible = Boolean(object) && !tekenModus.value;

    if (!fotoKader.visible) return;

    fotoKader.position.copyFrom(object.position);
    fotoKader.rotation = object.rotation;

    const breedte = object.width;
    const hoogte = object.height;

    fotoKader
      .rect(-breedte / 2, -hoogte / 2, breedte, hoogte)
      .stroke({ width: 2, color: 0x3b82f6 });

    const cursors = ["ew-resize", "nwse-resize", "ns-resize", "nesw-resize"];

    hoekBlokjes.forEach((blokje, index) => {
      const richting = hoekRichtingen[index];

      blokje.position.set(
        (richting.x * breedte) / 2,
        (richting.y * hoogte) / 2,
      );

      // Laat de cursor aansluiten bij de gedraaide sleeprichting.
      const hoek =
        Math.atan2(richting.y * hoogte, richting.x * breedte) + object.rotation;

      const cursorIndex = ((Math.round(hoek / (Math.PI / 4)) % 4) + 4) % 4;
      blokje.cursor = cursors[cursorIndex];
    });

    // Verbindt de bovenrand met de draaigreep.
    const draaiY = -hoogte / 2 - 32;

    fotoKader
      .moveTo(0, -hoogte / 2)
      .lineTo(0, draaiY)
      .stroke({ width: 2, color: 0x3b82f6 });

    draaiGreep.position.set(0, draaiY);
  }

  // Werkt het kader bij voordat het canvas opnieuw wordt getekend.
  function renderCanvas() {
    if (!app || !canvasKlaar.value) return;
    werkFotoKaderBij();
    app.render();
  }

  // Zet browserco?rdinaten om naar het formaat van het Pixi-canvas.
  function resizePunt(event) {
    const rechthoek = app.canvas.getBoundingClientRect();
    return {
      x:
        ((event.clientX - rechthoek.left) / rechthoek.width) * app.screen.width,
      y:
        ((event.clientY - rechthoek.top) / rechthoek.height) *
        app.screen.height,
    };
  }

  // Bewaart de beginpositie en de tegenoverliggende, vaste hoek.
  // Bij een zijgreep blijft de tegenoverliggende rand op zijn plaats.
  function startResize(event, richting) {
    const object = getActiefObject();
    if (
      !canvasKlaar.value ||
      !object ||
      tekenModus.value ||
      resizeActie ||
      event.button !== 0
    ) {
      return;
    }

    event.stopPropagation();
    event.preventDefault();

    stopSlepen();
    stopKleurWijziging();

    const breedte = object.width;
    const hoogte = object.height;

    if (breedte <= 0 || hoogte <= 0) return;

    actiefPaneel.value = geselecteerdType;

    resizeActie = {
      type: "schalen",
      pointerId: event.pointerId,
      object,
      begin: leesObjectToestand(object),
      geschiedenisBegin: huidigeToestand(),
      richting,
      breedte,
      hoogte,
      muisX: event.global.x,
      muisY: event.global.y,
      cos: Math.cos(object.rotation),
      sin: Math.sin(object.rotation),
    };

    inspectorsVergrendeld.value = true;
    app.canvas.setPointerCapture(event.pointerId);
  }

  // Begint het draaien rond het middelpunt van de afbeelding.
  function startDraaien(event) {
    const object = getActiefObject();
    if (
      !canvasKlaar.value ||
      !object ||
      tekenModus.value ||
      resizeActie ||
      event.button !== 0
    ) {
      return;
    }

    event.stopPropagation();
    event.preventDefault();

    stopSlepen();
    stopKleurWijziging();
    actiefPaneel.value = geselecteerdType;

    resizeActie = {
      type: "draaien",
      pointerId: event.pointerId,
      object,
      begin: leesObjectToestand(object),
      geschiedenisBegin: huidigeToestand(),
      laatsteMuisHoek: Math.atan2(
        event.global.y - object.y,
        event.global.x - object.x,
      ),
    };

    draaiGreep.cursor = "grabbing";
    inspectorsVergrendeld.value = true;
    app.canvas.setPointerCapture(event.pointerId);
  }

  // Verwerkt draaien, afzonderlijk uitrekken en gelijkmatig schalen.
  // Hoekgrepen schalen beide assen gelijk en houden de overstaande hoek vast.
  function tijdensResize(event) {
    if (sleepBegin) {
      tijdensSlepen(event);
      return;
    }
    const actie = resizeActie;
    const object = actie?.object;

    if (!actie || !object || event.pointerId !== actie.pointerId) return;

    event.preventDefault();
    const punt = resizePunt(event);

    // Draait de foto met de hoekverandering van de aanwijzer.
    if (actie.type === "draaien") {
      const dx = punt.x - actie.begin.x;
      const dy = punt.y - actie.begin.y;

      // Vlak bij het middelpunt is de aanwijzerhoek onbetrouwbaar.
      if (Math.hypot(dx, dy) < 5) return;

      const muisHoek = Math.atan2(dy, dx);
      const verschil = muisHoek - actie.laatsteMuisHoek;

      // Voorkomt een sprong bij de overgang tussen -180 en 180 graden.
      const hoekVerschil = Math.atan2(Math.sin(verschil), Math.cos(verschil));

      object.rotation += hoekVerschil;
      actie.laatsteMuisHoek = muisHoek;

      renderCanvas();
      return;
    }

    const verplaatsingX = punt.x - actie.muisX;
    const verplaatsingY = punt.y - actie.muisY;

    // Rekent de beweging om naar de lokale assen van de afbeelding.
    const lokaalX = verplaatsingX * actie.cos + verplaatsingY * actie.sin;

    const lokaalY = -verplaatsingX * actie.sin + verplaatsingY * actie.cos;

    const { richting, breedte, hoogte } = actie;

    // Voorkomt omklappen. Een al kleinere foto springt niet ineens groter.
    const minimumX = Math.min(1, 20 / breedte);
    const minimumY = Math.min(1, 20 / hoogte);

    let factorX = 1;
    let factorY = 1;

    if (richting.x !== 0 && richting.y !== 0) {
      // Hoekgreep: projecteert de beweging op de diagonaal.
      const diagonaalX = richting.x * breedte;
      const diagonaalY = richting.y * hoogte;

      const factor = Math.max(
        minimumX,
        minimumY,
        1 +
          (lokaalX * diagonaalX + lokaalY * diagonaalY) /
            (diagonaalX ** 2 + diagonaalY ** 2),
      );

      factorX = factor;
      factorY = factor;
    } else if (richting.x !== 0) {
      // Linker- of rechtergreep: verandert alleen de breedte.
      factorX = Math.max(minimumX, 1 + (lokaalX * richting.x) / breedte);
    } else {
      // Boven- of ondergreep: verandert alleen de hoogte.
      factorY = Math.max(minimumY, 1 + (lokaalY * richting.y) / hoogte);
    }

    object.scale.set(
      actie.begin.schaalX * factorX,
      actie.begin.schaalY * factorY,
    );

    // Verplaatst het middelpunt zodat de overstaande rand of hoek vastblijft.
    const verschuivingX = (richting.x * breedte * (factorX - 1)) / 2;

    const verschuivingY = (richting.y * hoogte * (factorY - 1)) / 2;

    object.position.set(
      actie.begin.x + verschuivingX * actie.cos - verschuivingY * actie.sin,
      actie.begin.y + verschuivingX * actie.sin + verschuivingY * actie.cos,
    );

    renderCanvas();
  }

  // Bewaart een volledige sleepbeweging als één stap voor Ongedaan maken.
  // Dit geldt voor schalen, uitrekken en draaien.
  function stopResize(event) {
    if (sleepBegin) {
      stopSlepen(event);
      return;
    }
    const actie = resizeActie;
    const object = actie?.object;

    if (!actie) return;

    if (event?.pointerId !== undefined && event.pointerId !== actie.pointerId) {
      return;
    }

    // Neemt ook de laatste aanwijzerpositie mee.
    if (event?.type === "pointerup") {
      tijdensResize(event);
    }

    // Eerst wissen: het loslaten van capture kan opnieuw een event geven.
    resizeActie = null;
    inspectorsVergrendeld.value = false;

    if (
      object &&
      (object.scale.x !== actie.begin.schaalX ||
        object.scale.y !== actie.begin.schaalY ||
        object.x !== actie.begin.x ||
        object.y !== actie.begin.y ||
        object.angle !== actie.begin.hoek)
    ) {
      bewaarToestand(actie.geschiedenisBegin);
    }

    if (object === getTekstObject()) synchroniseerTekst();

    if (draaiGreep) {
      draaiGreep.cursor = "grab";
    }

    if (app.canvas.hasPointerCapture(actie.pointerId)) {
      app.canvas.releasePointerCapture(actie.pointerId);
    }
  }

  // Start Pixi en voegt het canvas toe aan de pagina.
  async function maakCanvas() {
    app = new Application();

    await app.init({
      preference: "canvas",
      width: 800,
      height: 500,
      background: achtergrondKleur(),
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    if (unmounted) {
      app.destroy(true, { children: true });
      return;
    }

    canvasHost.value.appendChild(app.canvas);

    fotoKader = new Graphics();
    fotoKader.eventMode = "passive";
    app.stage.addChild(fotoKader);
    app.canvas.addEventListener("wheel", zoomMetMuis, { passive: false });
    maakHoekBlokjes();
    window.addEventListener("pointermove", tijdensResize, { passive: false });
    window.addEventListener("pointerup", stopResize);
    window.addEventListener("pointercancel", stopResize);
    window.addEventListener("blur", stopResize);
    app.canvas.addEventListener("lostpointercapture", stopResize);
    canvasKlaar.value = true;
  }

  // Laadt een afbeelding en zet deze passend in het midden.
  async function uploadFoto(event) {
    const file = event.target.files?.[0];

    if (!file || !canvasKlaar.value) return;

    const huidigeUpload = ++uploadId;
    const objectUrl = URL.createObjectURL(file);
    foutmelding.value = "";
    event.target.value = "";

    try {
      const afbeelding = new Image();
      afbeelding.src = objectUrl;
      await afbeelding.decode();

      if (unmounted || huidigeUpload !== uploadId) return;

      const texture = Texture.from(afbeelding);

      stopResize();

      stopSlepen();
      herstelVerflaag();
      kleurBegin = null;
      herstelTekst(null);
      geselecteerdType = "afbeelding";
      fotoRood.value = 255;
      fotoGroen.value = 255;
      fotoBlauw.value = 255;
      if (fotoSprite) {
        app.stage.removeChild(fotoSprite);
        fotoSprite.destroy({ texture: true, textureSource: true });
      }
      fileName.value = file.name;

      fotoSprite = new Sprite(texture);
      fotoSprite.anchor.set(0.5);
      fotoSprite.position.set(app.screen.width / 2, app.screen.height / 2);

      const schaal = Math.min(
        (app.screen.width * 0.8) / fotoSprite.width,
        (app.screen.height * 0.8) / fotoSprite.height,
      );

      fotoSprite.scale.set(schaal);
      fotoSprite.eventMode = "static";
      fotoSprite.cursor = "grab";

      fotoSprite.on("pointerdown", startSlepen);

      app.stage.addChild(fotoSprite);
      app.stage.addChild(fotoKader);
      kiesPaneel("afbeelding");
      geschiedenis.value = [];
      sleepBegin = null;
      renderCanvas();
    } catch {
      if (!unmounted && huidigeUpload === uploadId) {
        foutmelding.value =
          "Deze foto kan niet worden geopend. Probeer een JPG-, PNG-, WebP- of SVG-bestand.";
      }
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  // Verwijdert de afbeelding, verfstreken en bewerkingsgeschiedenis.
  function verwijderFoto() {
    stopResize();
    if (!fotoSprite || !canvasKlaar.value) return;

    stopSlepen();
    herstelVerflaag();
    herstelTekst(null);
    geselecteerdType = "afbeelding";
    tekenModus.value = false;
    kleurBegin = null;
    uploadId++;

    app.stage.removeChild(fotoSprite);
    fotoSprite.destroy({ texture: true, textureSource: true });
    fotoSprite = null;

    fileName.value = "";
    actiefPaneel.value = "uploads";
    foutmelding.value = "";
    geschiedenis.value = [];
    sleepBegin = null;

    renderCanvas();
  }

  // Start het verplaatsen van de afbeelding of tekst.
  function startSlepen(event, object = fotoSprite) {
    if (
      !canvasKlaar.value ||
      !object ||
      tekenModus.value ||
      resizeActie ||
      sleepBegin ||
      event.button !== 0
    )
      return;
    event.stopPropagation();
    event.preventDefault();
    stopKleurWijziging();
    geselecteerdType = object === getTekstObject() ? "tekst" : "afbeelding";
    actiefPaneel.value = geselecteerdType;

    sleepBegin = {
      object,
      pointerId: event.pointerId,
      x: object.x,
      y: object.y,
      geschiedenis: huidigeToestand(),
    };
    slepen = true;
    object.cursor = "grabbing";
    verschil = {
      x: event.global.x - object.x,
      y: event.global.y - object.y,
    };
    inspectorsVergrendeld.value = true;
    app.canvas.setPointerCapture(event.pointerId);
    renderCanvas();
  }

  // Laat de afbeelding of tekst de aanwijzer volgen.
  function tijdensSlepen(event) {
    const actie = sleepBegin;
    if (!slepen || !actie || event.pointerId !== actie.pointerId) return;
    event.preventDefault();
    const punt = resizePunt(event);
    actie.object.position.set(punt.x - verschil.x, punt.y - verschil.y);
    renderCanvas();
  }

  // Stopt het slepen en bewaart de vorige positie.
  function stopSlepen(event) {
    const actie = sleepBegin;
    if (!actie) return;
    if (event?.pointerId !== undefined && event.pointerId !== actie.pointerId)
      return;
    if (event?.type === "pointerup") tijdensSlepen(event);

    // Eerst wissen: releasePointerCapture kan opnieuw een stop-event geven.
    sleepBegin = null;
    slepen = false;
    inspectorsVergrendeld.value = false;
    const object = actie.object;
    if (object.x !== actie.x || object.y !== actie.y) {
      bewaarToestand(actie.geschiedenis);
    }
    object.cursor = "grab";
    if (object === getTekstObject()) synchroniseerTekst();
    if (app.canvas.hasPointerCapture(actie.pointerId)) {
      app.canvas.releasePointerCapture(actie.pointerId);
    }
  }

  // Draait de afbeelding met het opgegeven aantal graden.
  function draaiFoto(graden) {
    const object = getActiefObject();
    stopResize();
    if (!object || !canvasKlaar.value) return;

    stopSlepen();
    bewaarToestand();

    object.angle += graden;
    renderCanvas();
  }

  // Vergroot of verkleint de afbeelding.
  function veranderSchaal(factor) {
    const object = getActiefObject();
    stopResize();
    if (!object) return;

    stopSlepen();
    bewaarToestand();

    object.scale.set(object.scale.x * factor, object.scale.y * factor);
    renderCanvas();
  }

  // Past de afbeeldingsgrootte aan met het muiswiel.
  function zoomMetMuis(event) {
    const object = getActiefObject();
    if (!object || tekenModus.value) return;

    event.preventDefault();
    if (resizeActie) return;
    veranderSchaal(event.deltaY < 0 ? 1.1 : 0.9);
  }

  // Combineert achtergrond, afbeelding en verf tot een PNG-download.
  function downloadFoto() {
    stopResize();
    if (!canvasKlaar.value || !fotoSprite) return;

    stopTekenen();
    const kaderWasZichtbaar = fotoKader.visible;

    try {
      fotoKader.visible = false;

      const canvas = app.renderer.extract.canvas({
        target: app.stage,
        frame: app.screen.clone(),
        resolution: 1,
        clearColor: achtergrondKleur(),
      });
      canvas
        .getContext("2d")
        .drawImage(verfCanvas.value, 0, 0, canvas.width, canvas.height);
      const link = document.createElement("a");

      link.download = "mijn-bewerkte-foto.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    } finally {
      fotoKader.visible = kaderWasZichtbaar;
      renderCanvas();
    }
  }

  const {
    rood,
    groen,
    blauw,
    fotoRood,
    fotoGroen,
    fotoBlauw,
    achtergrondKanalen,
    tintKanalen,
    achtergrondVoorbeeld,
    achtergrondKleur,
    fotoTint,
  } = useKleuren();

  const {
    startTekenen,
    tijdensTekenen,
    stopTekenen,
    herstelVerflaag,
    aantalVerfstreken,
  } = useVerflaag({
    verfCanvas,
    tekenModus,
    canvasKlaar,
    kwastKleur,
    kwastGrootte,
    heeftFoto: () => Boolean(fotoSprite),
    stopSlepen,
    stopKleurWijziging,
    bewaarToestand,
  });

  // Verbindt de tekstbediening met het canvas en de geschiedenis.
  const {
    tekstFormulier,
    pasTekstToe,
    verwijderTekst,
    herstelTekst,
    huidigeTekst,
    getTekstObject,
    synchroniseerTekst,
  } = useTekst({
    getApp: () => app,
    getFotoKader: () => fotoKader,
    kanBewerken: () =>
      canvasKlaar.value && Boolean(fotoSprite) && !inspectorsVergrendeld.value,
    voorBewerking: () => kiesPaneel("tekst"),
    startSlepen,
    naToepassen: () => {
      geselecteerdType = "tekst";
    },
    bewaarToestand,
    renderCanvas,
  });

  // Verbergt het kader tijdens tekenen en toont het daarna opnieuw.
  watch(tekenModus, () => {
    stopResize();
    renderCanvas();
  });

  // Past de fototint direct toe wanneer de kleurwaarden veranderen.
  watch(
    [fotoRood, fotoGroen, fotoBlauw],
    () => {
      if (!fotoSprite || bezigMetHerstellen) return;

      fotoSprite.tint = fotoTint();
      renderCanvas();
    },
    { flush: "sync" },
  );

  // Past een gewijzigde achtergrondkleur direct toe op het canvas.
  watch(
    [rood, groen, blauw],
    () => {
      if (!canvasKlaar.value || bezigMetHerstellen) return;

      app.renderer.background.color = achtergrondKleur();
      renderCanvas();
    },
    { flush: "sync" },
  );

  // Start de editor zodra de pagina gereed is.
  onMounted(async () => {
    try {
      await maakCanvas();
    } catch (error) {
      console.error("Foto-editor starten mislukt:", error);
      foutmelding.value = "De foto-editor kon niet starten. Ververs de pagina.";
    }
  });

  // Ruimt het canvas, de afbeelding en de muiswielkoppeling op.
  onBeforeUnmount(() => {
    stopResize();
    unmounted = true;
    window.removeEventListener("pointermove", tijdensResize);
    window.removeEventListener("pointerup", stopResize);
    window.removeEventListener("pointercancel", stopResize);
    window.removeEventListener("blur", stopResize);
    uploadId++;
    stopTekenen();

    if (canvasKlaar.value) {
      app.canvas.removeEventListener("wheel", zoomMetMuis);
      app.canvas.removeEventListener("lostpointercapture", stopResize);
      app.destroy(true, { children: true, texture: true, textureSource: true });
    }
  });

  return {
    fileName,
    geschiedenis,
    ongedaanMaken,
    downloadFoto,
    panelen,
    actiefPaneel,
    kiesPaneel,
    canvasKlaar,
    bestandInput,
    uploadFoto,
    veranderSchaal,
    draaiFoto,
    tintKanalen,
    startKleurWijziging,
    stopKleurWijziging,
    verwijderFoto,
    tekenModus,
    wisselKwast,
    kwastKleur,
    kwastPalet,
    kwastGrootte,
    achtergrondVoorbeeld,
    achtergrondKanalen,
    foutmelding,
    canvasHost,
    verfCanvas,
    startTekenen,
    tijdensTekenen,
    stopTekenen,
    tekstFormulier,
    pasTekstToe,
    verwijderTekst,
    inspectorsVergrendeld,
  };
}
