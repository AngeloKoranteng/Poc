import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { Application, Graphics, Sprite, Texture, Rectangle } from "pixi.js";
import { panelen, kwastPalet } from "./config.js";
import { useKleuren } from "./useKleuren.js";
import { useVerflaag } from "./useVerflaag.js";
import { useTekst } from "./useTekst.js";
import { useBelichting } from "./useBelichting.js";

export function usePhotoStyler() {
  // Verwijzingen naar het canvas, de verflaag en het uploadveld.
  const canvasHost = ref(null);
  const verfCanvas = ref(null);
  const bestandInput = ref(null);


  const achtergrondBestandsnaam = ref("");
  const achtergrondDonkerte = ref(0);
  const achtergrondIngesteld = ref(false);
  let achtergrondSprite = null;
  let achtergrondUploadId = 0;


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
  const lagen = ref([
    {
      id: "tekst",
      naam: "Tekst",
      aanwezig: false,
      zichtbaar: true,
      vergrendeld: false,
    },
    {
      id: "afbeelding",
      naam: "Logo",
      aanwezig: false,
      zichtbaar: true,
      vergrendeld: false,
    },
    {
      id: "achtergrond",
      naam: "Achtergrond",
      aanwezig: false,
      zichtbaar: true,
      vergrendeld: false,
    },
  ]);

  const geselecteerdeLaag = ref(geselecteerdType);
  // Elke afbeelding bewaart haar eigen belichting.
  const belichtingen = ref({
    afbeelding: 0,
    achtergrond: 0,
  });

  const belichtingsBewerking = useBelichting();

  const belichtingWaarde = computed(
      () => belichtingen.value[geselecteerdeLaag.value] ?? 0,
  );

  const belichtingBeschikbaar = computed(() =>
      canvasKlaar.value &&
      !inspectorsVergrendeld.value &&
      lagen.value.some(
          (laag) =>
              laag.id === geselecteerdeLaag.value &&
              laag.id !== "tekst" &&
              laag.aanwezig &&
              laag.zichtbaar &&
              !laag.vergrendeld,
      ),
  );

  function veranderBelichting(waarde) {
    if (!belichtingBeschikbaar.value) return;

    const getal = Number(waarde);
    if (!Number.isFinite(getal)) return;

    startKleurWijziging();

    belichtingen.value[geselecteerdeLaag.value] =
        Math.max(-2, Math.min(2, getal));

    renderCanvas();
  }

  function resetBelichting() {
    veranderBelichting(0);
    stopKleurWijziging();
  }

  function pasBelichtingToe(id) {
    belichtingsBewerking.pasToe(id, belichtingen.value[id]);
  }

  function getLaagObject(id) {
    if (id === "tekst") return getTekstObject();
    if (id === "afbeelding") return fotoSprite;
    if (id === "achtergrond") return achtergrondSprite;
    return null;
  }

  // Een nieuwe upload moet direct zichtbaar en bewerkbaar zijn.
  function resetUploadLaag(id) {
    const laag = lagen.value.find((laag) => laag.id === id);
    if (!laag) return;
    laag.zichtbaar = true;
    laag.vergrendeld = false;
  }

  function magLaagVerplaatsen(id) {
    const laag = lagen.value.find((laag) => laag.id === id);

    return Boolean(
        laag &&
        laag.zichtbaar &&
        !laag.vergrendeld
    );
  }

// Werkt de lijst en de zichtbaarheid op het canvas bij.
  function synchroniseerLagen() {
    geselecteerdeLaag.value = geselecteerdType;

    for (const laag of lagen.value) {
      const object = getLaagObject(laag.id);

      laag.aanwezig = Boolean(object);

      if (!object) continue;

      object.visible = laag.zichtbaar && !(laag.id === "tekst" && canvasTekstActief.value);
      object.eventMode =
          object.visible && !laag.vergrendeld ? "static" : "none";
    }
  }

  function selecteerLaag(id) {
    if (!getLaagObject(id)) return;

    stopResize();
    stopSlepen();
    stopTekenen();
    stopKleurWijziging();

    tekenModus.value = false;
    geselecteerdType = id;
    actiefPaneel.value = id === "tekst" ? "tekst" : "afbeelding";

    renderCanvas();
  }

  function verwijderLaag(id) {
    if (!canvasKlaar.value || !getLaagObject(id)) return;

    selecteerLaag(id);

    if (id === "tekst") {
      verwijderTekst();
    } else {
      verwijderFoto();
    }
  }


  function wisselLaagZichtbaarheid(id) {
    const laag = lagen.value.find((laag) => laag.id === id);
    if (!laag || !getLaagObject(id)) return;

    stopResize();
    stopSlepen();
    stopTekenen();
    stopKleurWijziging();

    bewaarToestand();
    laag.zichtbaar = !laag.zichtbaar;

    renderCanvas();
  }

  function wisselLaagVergrendeling(id) {
    const laag = lagen.value.find((laag) => laag.id === id);
    if (!laag || !getLaagObject(id)) return;

    stopResize();
    stopSlepen();
    stopTekenen();
    stopKleurWijziging();

    bewaarToestand();
    laag.vergrendeld = !laag.vergrendeld;

    renderCanvas();
  }

  function getActiefObject() {
    if (canvasTekstActief.value || !magLaagVerplaatsen(geselecteerdType)) return null;

    if (geselecteerdType === "tekst") return getTekstObject();

    // De achtergrond gebruikt slepen, maar geen schaal- of draaigrepen.
    if (geselecteerdType === "achtergrond") return null;

    return fotoSprite;
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
      achtergrondDonkerte: achtergrondDonkerte.value,
      achtergrondIngesteld: achtergrondIngesteld.value,
      belichtingen: { ...belichtingen.value },
      belichtingAchtergrondUploadId: achtergrondUploadId,
      rood: rood.value,
      groen: groen.value,
      blauw: blauw.value,

      lagen: lagen.value.map((laag) => ({
        id: laag.id,
        zichtbaar: laag.zichtbaar,
        vergrendeld: laag.vergrendeld,
      })),


      achtergrondPositie: achtergrondSprite
          ? {
            x: achtergrondSprite.x,
            y: achtergrondSprite.y,
            uploadId: achtergrondUploadId,
          }
          : null,


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

  // Een kleurkeuze schakelt de canvasachtergrond van foto naar effen kleur.
  // De foto blijft als verborgen laag bewaard, ook voor Ongedaan maken.
  function kiesAchtergrondKleur(kleur, doorlopend = false) {
    if (!canvasKlaar.value || inspectorsVergrendeld.value) return;

    const hex = String(kleur).trim().toLowerCase();

    if (!/^#[0-9a-f]{6}$/.test(hex)) return;

    const kanalen = [1, 3, 5].map((begin) =>
        parseInt(hex.slice(begin, begin + 2), 16)
    );

    const kleurVeranderd = kanalen.some(
        (waarde, index) =>
            waarde !== achtergrondKanalen[index].waarde.value
    );

    if (!kleurVeranderd && achtergrondIngesteld.value) return;

    if (!doorlopend) {
      stopKleurWijziging();
    }

    startKleurWijziging();

    achtergrondIngesteld.value = true;

    // Als er een achtergrondfoto is, verberg die.
    const achtergrondLaag = lagen.value.find(
        (laag) => laag.id === "achtergrond"
    );

    if (achtergrondSprite && achtergrondLaag) {
      achtergrondLaag.zichtbaar = false;
    }

    // RGB aanpassen.
    rood.value = kanalen[0];
    groen.value = kanalen[1];
    blauw.value = kanalen[2];

    // De watch([rood, groen, blauw]) zorgt vervolgens
    // automatisch voor het opnieuw tekenen van de canvas.

    if (!doorlopend) {
      stopKleurWijziging();
    }
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

      for (const laag of lagen.value) {
        const vorigeLaag = vorige.lagen?.find(
            (item) => item.id === laag.id
        );

        laag.zichtbaar = vorigeLaag?.zichtbaar ?? true;
        laag.vergrendeld = vorigeLaag?.vergrendeld ?? false;
      }

      // Herstelt de positie, beide schalen en de draaihoek.
      if (fotoSprite && vorige.schaalX !== null && vorige.schaalY !== null) {
        fotoSprite.position.set(vorige.x, vorige.y);
        fotoSprite.scale.set(vorige.schaalX, vorige.schaalY);
        fotoSprite.angle = vorige.hoek;
      }

      const achtergrondPositie = vorige.achtergrondPositie;

// Herstel alleen de positie van dezelfde achtergrondafbeelding.
      if (
          achtergrondSprite &&
          achtergrondPositie &&
          achtergrondPositie.uploadId === achtergrondUploadId
      ) {
        achtergrondSprite.position.set(
            achtergrondPositie.x,
            achtergrondPositie.y,
        );
      }
      belichtingen.value = {
        afbeelding: vorige.belichtingen?.afbeelding ?? 0,
        achtergrond:
            vorige.belichtingAchtergrondUploadId === achtergrondUploadId
                ? vorige.belichtingen?.achtergrond ?? 0
                : belichtingen.value.achtergrond,
      };
      achtergrondDonkerte.value = vorige.achtergrondDonkerte ?? 0;
      achtergrondIngesteld.value = vorige.achtergrondIngesteld ?? false;
      rood.value = vorige.rood;
      groen.value = vorige.groen;
      blauw.value = vorige.blauw;

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

    pasBelichtingToe("afbeelding");
    pasBelichtingToe("achtergrond");

    synchroniseerLagen();
    werkFotoKaderBij();
    app.render();
  }

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

  // Laadt de achtergrond onafhankelijk van het logo.
  async function uploadAchtergrond(event) {
    const bestand = event.target.files?.[0];

    if (!bestand || !canvasKlaar.value) return;

    const huidigeUpload = ++achtergrondUploadId;
    const objectUrl = URL.createObjectURL(bestand);

    event.target.value = "";
    foutmelding.value = "";

    try {
      const afbeelding = new Image();
      afbeelding.src = objectUrl;
      await afbeelding.decode();

      if (unmounted || huidigeUpload !== achtergrondUploadId) return;

      const nieuweSprite = new Sprite(Texture.from(afbeelding));

      // Vult het canvas met behoud van de verhoudingen.
      // Wat buiten het canvas valt, wordt bij export afgesneden.
      const schaal = Math.max(
          app.screen.width / nieuweSprite.width,
          app.screen.height / nieuweSprite.height,
      );

      nieuweSprite.anchor.set(0.5);
      nieuweSprite.scale.set(schaal);
      nieuweSprite.position.set(
          app.screen.width / 2,
          app.screen.height / 2,
      );

      nieuweSprite.eventMode = "static";
      nieuweSprite.cursor = "grab";

      nieuweSprite.on("pointerdown", (event) => {
        startSlepen(event, nieuweSprite);
      });


      if (achtergrondSprite) {
        belichtingsBewerking.verwijder("achtergrond");
        app.stage.removeChild(achtergrondSprite);
        achtergrondSprite.destroy({
          texture: true,
          textureSource: true,
        });
      }

      achtergrondSprite = nieuweSprite;
      belichtingsBewerking.registreer("achtergrond", achtergrondSprite, afbeelding);
      belichtingen.value.achtergrond = 0;
      resetUploadLaag("achtergrond");
      pasAchtergrondDonkerteToe();

      // Index 0 plaatst de achtergrond onder het logo en de tekst.
      app.stage.addChildAt(achtergrondSprite, 0);
      achtergrondBestandsnaam.value = bestand.name;

      renderCanvas();
    } catch {
      if (!unmounted && huidigeUpload === achtergrondUploadId) {
        foutmelding.value =
            "Deze achtergrond kan niet worden geopend. Probeer een andere afbeelding.";
      }
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  // Laadt het logo en zet het passend in het midden.
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
      stopTekenen();
      stopKleurWijziging();
      geselecteerdType = "afbeelding";

      if (fotoSprite) {
        belichtingsBewerking.verwijder("afbeelding");
        app.stage.removeChild(fotoSprite);
        fotoSprite.destroy({ texture: true, textureSource: true });
      }
      fileName.value = file.name;

      fotoSprite = new Sprite(texture);
      belichtingsBewerking.registreer("afbeelding", fotoSprite, afbeelding);
      belichtingen.value.afbeelding = 0;
      resetUploadLaag("afbeelding");
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
      if (getTekstObject()) app.stage.addChild(getTekstObject());
      app.stage.addChild(fotoKader);
      kiesPaneel("uploads");
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
    if (!canvasKlaar.value) return;

    // Deze actie verwijdert alleen afbeeldingen.
    if (geselecteerdType === "tekst") return;

    const isAchtergrond = geselecteerdType === "achtergrond";
    const object = isAchtergrond ? achtergrondSprite : fotoSprite;

    if (!object) return;

    stopResize();
    stopSlepen();
    stopTekenen();
    stopKleurWijziging();

    if (isAchtergrond) {
      achtergrondUploadId++;
      achtergrondSprite = null;
      achtergrondBestandsnaam.value = "";
    } else {
      uploadId++;
      fotoSprite = null;
      fileName.value = "";
    }

    belichtingsBewerking.verwijder(isAchtergrond ? "achtergrond" : "afbeelding");
    belichtingen.value[isAchtergrond ? "achtergrond" : "afbeelding"] = 0;
    app.stage.removeChild(object);
    object.destroy({
      texture: true,
      textureSource: true,
    });

    // Oude geschiedenis verwijst mogelijk naar de verwijderde afbeelding.
    geschiedenis.value = [];
    sleepBegin = null;
    kleurBegin = null;
    tekenModus.value = false;

    geselecteerdType = fotoSprite ? "afbeelding" : "achtergrond";
    actiefPaneel.value = "uploads";
    foutmelding.value = "";

    renderCanvas();
  }

  // Start het verplaatsen van de afbeelding of tekst.
  function startSlepen(event, object = fotoSprite) {

    const laagId =
        object === achtergrondSprite
            ? "achtergrond"
            : object === getTekstObject()
                ? "tekst"
                : "afbeelding";

    if (!magLaagVerplaatsen(laagId)) return;

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
    if (object === achtergrondSprite) {
      geselecteerdType = "achtergrond";
    } else if (object === getTekstObject()) {
      geselecteerdType = "tekst";
    } else {
      geselecteerdType = "afbeelding";
    }

    actiefPaneel.value =
        geselecteerdType === "tekst" ? "tekst" : "afbeelding";

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

  function tijdensSlepen(event) {
    const actie = sleepBegin;

    if (!slepen || !actie || event.pointerId !== actie.pointerId) {
      return;
    }

    event.preventDefault();

    const punt = resizePunt(event);
    const object = actie.object;

    let x = punt.x - verschil.x;
    let y = punt.y - verschil.y;

    if (object === achtergrondSprite) {
      const halveBreedte = object.width / 2;
      const halveHoogte = object.height / 2;

      // De achtergrond heeft een middelpunt als anker.
      // Begrens de positie zodat iedere canvasrand bedekt blijft.
      x = Math.max(
          app.screen.width - halveBreedte,
          Math.min(halveBreedte, x),
      );

      y = Math.max(
          app.screen.height - halveHoogte,
          Math.min(halveHoogte, y),
      );
    }

    object.position.set(x, y);
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

  // Plaatst het volledige logo, inclusief rotatie, binnen een marge van 32 px.
  function plaatsLogo(positie) {
    if (!magLaagVerplaatsen("afbeelding")) return;

    const posities = {
      midden: [0.5, 0.5],
      linksboven: [0, 0],
      rechtsboven: [1, 0],
      linksonder: [0, 1],
      rechtsonder: [1, 1],
    };
    if (!fotoSprite || !canvasKlaar.value || !posities[positie]) return;
    kiesPaneel("afbeelding");
    const vorige = huidigeToestand();
    const marge = 32;
    const cos = Math.abs(Math.cos(fotoSprite.rotation));
    const sin = Math.abs(Math.sin(fotoSprite.rotation));
    let breedte = fotoSprite.width * cos + fotoSprite.height * sin;
    let hoogte = fotoSprite.width * sin + fotoSprite.height * cos;
    const factor = Math.min(1,
      (app.screen.width - 2 * marge) / breedte,
      (app.screen.height - 2 * marge) / hoogte);
    fotoSprite.scale.set(fotoSprite.scale.x * factor, fotoSprite.scale.y * factor);
    breedte *= factor;
    hoogte *= factor;
    const [x, y] = posities[positie];
    fotoSprite.position.set(
      marge + breedte / 2 + x * (app.screen.width - 2 * marge - breedte),
      marge + hoogte / 2 + y * (app.screen.height - 2 * marge - hoogte),
    );
    if (JSON.stringify(vorige) !== JSON.stringify(huidigeToestand())) {
      bewaarToestand(vorige);
    }
    renderCanvas();
  }

  // Een grijze tint verduistert uitsluitend de achtergrondfoto.
  function pasAchtergrondDonkerteToe() {
    if (!achtergrondSprite) return;
    const kanaal = Math.round(255 * (1 - achtergrondDonkerte.value / 100));
    achtergrondSprite.tint = (kanaal << 16) | (kanaal << 8) | kanaal;
  }

  watch(achtergrondDonkerte, () => {
    pasAchtergrondDonkerteToe();
    renderCanvas();
  }, { flush: "sync" });

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
    stopCanvasTekst();
    if (!canvasKlaar.value || (!achtergrondIngesteld.value && !fotoSprite && !achtergrondSprite && !getTekstObject())) return;

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

    achtergrondKanalen,

    achtergrondVoorbeeld,
    achtergrondKleur,
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
    getTekstObject,
    synchroniseerTekst,
  } = useTekst({
    getApp: () => app,
    getFotoKader: () => fotoKader,
    kanBewerken: () =>
        canvasKlaar.value &&
        !inspectorsVergrendeld.value,
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

  // Past een gewijzigde achtergrondkleur direct toe op het canvas.
  watch(
    [rood, groen, blauw],
    () => {
      if (!canvasKlaar.value || bezigMetHerstellen) return;

      achtergrondIngesteld.value = true;
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
    achtergrondUploadId++;
    window.removeEventListener("pointermove", tijdensResize);
    window.removeEventListener("pointerup", stopResize);
    window.removeEventListener("pointercancel", stopResize);
    window.removeEventListener("blur", stopResize);
    uploadId++;
    stopTekenen();

    belichtingsBewerking.ruimOp();
    if (canvasKlaar.value) {
      app.canvas.removeEventListener("wheel", zoomMetMuis);
      app.canvas.removeEventListener("lostpointercapture", stopResize);
      app.destroy(true, { children: true, texture: true, textureSource: true });
    }

  });

  return {
    canvasTekstActief,
    canvasTekstInvoer,
    canvasTekstOpmaak,
    startCanvasTekst,
    stopCanvasTekst,
    lagen,
    geselecteerdeLaag,
    selecteerLaag,
    verwijderLaag,
    wisselLaagZichtbaarheid,
    wisselLaagVergrendeling,
    plaatsLogo,
    achtergrondDonkerte,
    achtergrondIngesteld,
    achtergrondBestandsnaam,
    uploadAchtergrond,
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

    startKleurWijziging,
    stopKleurWijziging,
    verwijderFoto,
    tekenModus,
    wisselKwast,
    kwastKleur,
    kwastPalet,
    kwastGrootte,
    belichtingWaarde,
    belichtingBeschikbaar,
    veranderBelichting,
    resetBelichting,
    achtergrondVoorbeeld,
    achtergrondKanalen,
    kiesAchtergrondKleur,
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
