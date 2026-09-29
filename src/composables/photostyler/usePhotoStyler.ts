import type { FederatedPointerEvent, Renderer } from "pixi.js";
import type { EditableObject, ImageSource, EditorState, DragAction, ResizeAction, Point, UploadEvent } from "./types.ts";
import { markRaw, computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { Application, Graphics, Sprite, Texture, Rectangle } from "pixi.js";
import { panelen, kwastPalet } from "./config.ts";
import { useColors } from "./useColors.ts";
import { usePaintLayer } from "./usePaintLayer.ts";
import { useText } from "./useText.ts";
import { draftTransaction } from "./conceptStorage.ts";
import { useLighting } from "./useLighting.ts";

export function usePhotoStyler() {
  // Verwijzingen naar het canvas, de verflaag en het uploadveld.
  const middenlijnen = ref({ verticaal: false, horizontaal: false });
  const canvasHost = ref<HTMLElement | null>(null);
  const verfCanvas = ref<HTMLCanvasElement | null>(null);
  const bestandInput = ref<HTMLInputElement | null>(null);
  const conceptBezig = ref(false);
  const conceptMelding = ref("");
  const conceptStatus = ref("info");

  function markNotSaved(){
    // Tijdens opslaan of het laden van een concept
    if (conceptBezig.value) return;
    conceptStatus.value = "gewijzigd";
    conceptMelding.value = "Je laatste wijzigingen zijn nog niet bewaard. Klik op Concept opslaan."
  }

  let fotoBron: ImageSource | null = null;
  let achtergrondBron: ImageSource | null = null;
  let fotoBestand: File | null = null;
  let achtergrondBestand: File | null = null;

  // Houd de preview-URL geldig zolang het bijbehorende bestand gebruikt wordt.
  function createUploadPreview() {
    const url = ref("");
    let huidigBestand: File | null = null;

    function edit(bestand: File | null) {
      if (bestand === huidigBestand) return;
      const volgendeUrl = bestand ? URL.createObjectURL(bestand) : "";
      if (url.value) URL.revokeObjectURL(url.value);
      huidigBestand = bestand;
      url.value = volgendeUrl;
    }

    return { url, update: edit };
  }

  const logoVoorbeeld = createUploadPreview();
  const achtergrondUploadVoorbeeld = createUploadPreview();


  const achtergrondBestandsnaam = ref("");
  const achtergrondDonkerte = ref(0);
  const achtergrondIngesteld = ref(false);
  let achtergrondSprite: Sprite | null = null;
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
  const geschiedenis = ref<EditorState[]>([]);
  let bezigMetHerstellen = false;
  let sleepBegin: DragAction | null = null;
  let kleurBegin: EditorState | null = null;

  // Pixi-editor en de afbeelding op het canvas.
  let app: Application<Renderer<HTMLCanvasElement>>;
  let fotoSprite: Sprite | null = null;

  let fotoKader: Graphics;
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
  const belichtingen = ref<Record<string, number>>({
    afbeelding: 0,
    achtergrond: 0,
  });

  const belichtingsBewerking = useLighting();

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

  function changeLighting(waarde: number | string) {
    if (!belichtingBeschikbaar.value) return;

    const getal = Number(waarde);
    if (!Number.isFinite(getal)) return;

    startColorChange();

    belichtingen.value[geselecteerdeLaag.value] =
        Math.max(-2, Math.min(2, getal));

    renderCanvas();
  }

  function finishProcessing() {
    stopResize();
    stopDrag();
    stopDrawing();
    stopColorChange();
    stopCanvasText();
  }


  function resetLighting() {
    changeLighting(0);
    stopColorChange();
  }

  function applyLighting(id: string) {
    belichtingsBewerking.apply(id, belichtingen.value[id]);
  }

  function getLayerObject(id: string) {
    if (id === "tekst") return getTextObject();
    if (id === "afbeelding") return fotoSprite;
    if (id === "achtergrond") return achtergrondSprite;
    return null;
  }

  // Een nieuwe upload moet direct zichtbaar en bewerkbaar zijn.
  function resetUploadLayer(id: string) {
    const laag = lagen.value.find((laag) => laag.id === id);
    if (!laag) return;
    laag.zichtbaar = true;
    laag.vergrendeld = false;
  }

  function canMoveLayer(id: string) {
    const laag = lagen.value.find((laag) => laag.id === id);

    return Boolean(
        laag &&
        laag.zichtbaar &&
        !laag.vergrendeld
    );
  }

// Werkt de lijst en de zichtbaarheid op het canvas bij.
  function syncLayers() {
    geselecteerdeLaag.value = geselecteerdType;

    for (const laag of lagen.value) {
      const object = getLayerObject(laag.id);

      laag.aanwezig = Boolean(object);

      if (!object) continue;

      object.visible = laag.zichtbaar && !(laag.id === "tekst" && canvasTekstActief.value);
      object.eventMode =
          object.visible && !laag.vergrendeld ? "static" : "none";
    }
  }

  function selectLayer(id: string) {
    if (!getLayerObject(id)) return;

    stopResize();
    stopDrag();
    stopDrawing();
    stopColorChange();

    tekenModus.value = false;
    geselecteerdType = id;
    actiefPaneel.value = id === "tekst" ? "tekst" : "afbeelding";

    renderCanvas();
  }

  function removeLayer(id: string) {
    if (!canvasKlaar.value || !getLayerObject(id)) return;

    selectLayer(id);

    if (id === "tekst") {
      removeText();
    } else {
      deletePhoto();
    }
  }


  function toggleLayerVisibility(id: string) {
    const laag = lagen.value.find((laag) => laag.id === id);
    if (!laag || !getLayerObject(id)) return;

    stopResize();
    stopDrag();
    stopDrawing();
    stopColorChange();

    saveState();
    laag.zichtbaar = !laag.zichtbaar;

    renderCanvas();
  }

  function toggleLayerLock(id: string) {
    const laag = lagen.value.find((laag) => laag.id === id);
    if (!laag || !getLayerObject(id)) return;

    stopResize();
    stopDrag();
    stopDrawing();
    stopColorChange();

    saveState();
    laag.vergrendeld = !laag.vergrendeld;

    renderCanvas();
  }

  function getActiveObject() {
    if (canvasTekstActief.value || !canMoveLayer(geselecteerdType)) return null;

    if (geselecteerdType === "tekst") return getTextObject();

    // De achtergrond gebruikt slepen, maar geen schaal- of draaigrepen.
    if (geselecteerdType === "achtergrond") return null;

    return fotoSprite;
  }

  // Leest de transformatie van de geselecteerde foto of tekst.
  function readObjectState(object: EditableObject) {
    return {
      x: object.x,
      y: object.y,
      schaalX: object.scale.x,
      schaalY: object.scale.y,
      hoek: object.angle,
    };
  }

  // Hoekblokjes, zijgrepen en de actieve schaal- of draaibewerking.
  let hoekBlokjes: Graphics[] = [];
  let draaiGreep: Graphics;
  let resizeActie: ResizeAction | null = null;

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
  function selectPanel(paneel: string) {
    stopResize();
    stopDrag();
    stopDrawing();
    stopColorChange();
    if (paneel !== "tekenen") tekenModus.value = false;
    actiefPaneel.value = paneel;
    // Laat de grepen aansluiten bij het gekozen instellingenpaneel.
    if (paneel === "tekst" || paneel === "afbeelding") {
      geselecteerdType = paneel;
    }
    renderCanvas();
  }

  // Schakelt de kwast in of uit.
  function toggleBrush() {
    stopResize();
    stopDrag();
    stopDrawing();
    stopColorChange();
    tekenModus.value = !tekenModus.value;
    if (tekenModus.value) actiefPaneel.value = "tekenen";
  }

  // Leest positie, schaal, kleuren en het aantal verfstreken.
  function getCurrentState(): EditorState {
    return {
      bronnen: { foto: fotoBron, achtergrond: achtergrondBron },
      selectie: geselecteerdType,
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
            schaalX: achtergrondSprite.scale.x,
            schaalY: achtergrondSprite.scale.y,
            x: achtergrondSprite.x,
            y: achtergrondSprite.y,
            uploadId: achtergrondUploadId,
          }
          : null,


      aantalVerfstreken: getPaintStrokeCount(),
      tekst: getCurrentText(),
    };
  }

  // Bewaart een toestand voor Ongedaan maken.
  function saveState(toestand = getCurrentState()) {
    if (bezigMetHerstellen || !canvasKlaar.value) return;


    geschiedenis.value.push(toestand);
    markNotSaved();
  }

  // Onthoudt de toestand voordat een kleurslider verandert.
  function startColorChange() {
    stopResize();
    if (!canvasKlaar.value || kleurBegin) return;

    kleurBegin = getCurrentState();
  }

  // Bewaart een kleurwijziging als een enkele bewerking.
  function stopColorChange() {
    if (!kleurBegin) return;

    const einde = getCurrentState();
    const veranderd = JSON.stringify(kleurBegin) !== JSON.stringify(einde);
    if (veranderd) {
      saveState(kleurBegin);
    }
    kleurBegin = null;
  }

  // Een kleurkeuze schakelt de canvasachtergrond van foto naar effen kleur.
  // De foto blijft als verborgen laag bewaard, ook voor Ongedaan maken.
  function selectBackgroundColor(kleur: string, doorlopend = false) {
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

    const zichtbareAchtergrond = achtergrondSprite && lagen.value.find(
      (laag) => laag.id === "achtergrond",
    )?.zichtbaar;
    if (!kleurVeranderd && achtergrondIngesteld.value && !zichtbareAchtergrond) {
      if (!doorlopend) stopColorChange();
      return;
    }

    if (!doorlopend) {
      stopColorChange();
    }

    startColorChange();

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

    renderCanvas();

    // De watch([rood, groen, blauw]) zorgt vervolgens
    // automatisch voor het opnieuw tekenen van de canvas.

    if (!doorlopend) {
      stopColorChange();
    }
  }


  // Herstelt de vorige afbeelding, kleuren en verflaag.
  function undo() {
    if (!canvasKlaar.value || conceptBezig.value) return;
    finishProcessing();
    const vorige = geschiedenis.value.pop();
    if (!vorige) return;
    uploadId++;
    achtergrondUploadId++;
    recoveryCondition(vorige);
    markNotSaved();
  }

  // Bewaar gedecodeerde bronnen in de historie, zodat herstel direct werkt.
  function recoverySources(bronnen: NonNullable<EditorState["bronnen"]>) {
    for (const id of ["achtergrond", "afbeelding"]) {
      const achtergrond = id === "achtergrond";
      const bron = achtergrond ? bronnen.achtergrond : bronnen.foto;
      if (bron === (achtergrond ? achtergrondBron : fotoBron)) continue;
      const oud = achtergrond ? achtergrondSprite : fotoSprite;
      belichtingsBewerking.remove(id);
      if (oud) {
        app.stage.removeChild(oud);
        oud.destroy({ texture: true, textureSource: true });
      }
      let sprite: Sprite | null = null;
      if (bron) {
        sprite = new Sprite(Texture.from(bron.afbeelding));
        sprite.anchor.set(0.5);
        sprite.eventMode = "static";
        sprite.cursor = "grab";
        sprite.on("pointerdown", (event) => startDrag(event, sprite));
        belichtingsBewerking.register(id, sprite, bron.afbeelding);
        if (achtergrond) app.stage.addChildAt(sprite, 0);
        else app.stage.addChild(sprite);
      }
      if (achtergrond) {
        achtergrondSprite = sprite;
        achtergrondBron = bron;
        achtergrondBestand = bron?.bestand ?? null;
        achtergrondBestandsnaam.value = bron?.bestand.name ?? "";
      } else {
        fotoSprite = sprite;
        fotoBron = bron;
        fotoBestand = bron?.bestand ?? null;
        fileName.value = bron?.bestand.name ?? "";
      }
    }
    const textObject = getTextObject();
    if (textObject) app.stage.addChild(textObject);
    app.stage.addChild(fotoKader);
  }

  function recoveryCondition(vorige: EditorState) {
    bezigMetHerstellen = true;

    try {
      if (vorige.bronnen) recoverySources(vorige.bronnen);
      geselecteerdType = vorige.selectie ?? geselecteerdType;
      if (vorige.verfstreken) {
        loadPaintStrokes(vorige.verfstreken);
      } else {
        restorePaintLayer(vorige.aantalVerfstreken);
      }
      restoreText(vorige.tekst ?? null);


      for (const laag of lagen.value) {
        const vorigeLaag = vorige.lagen?.find(
            (item) => item.id === laag.id
        );

        laag.zichtbaar = vorigeLaag?.zichtbaar ?? true;
        laag.vergrendeld = vorigeLaag?.vergrendeld ?? false;
      }

      // Herstelt de positie, beide schalen en de draaihoek.
      if (fotoSprite && vorige.schaalX !== null && vorige.schaalY !== null) {
        fotoSprite.position.set(vorige.x ?? 400, vorige.y ?? 250);
        fotoSprite.scale.set(vorige.schaalX, vorige.schaalY);
        fotoSprite.angle = vorige.hoek;
      }

      const achtergrondPositie = vorige.achtergrondPositie;

// Herstel alleen de positie van dezelfde achtergrondafbeelding.
      if (
          achtergrondSprite &&
          achtergrondPositie &&
          (vorige.bronnen || achtergrondPositie.uploadId === achtergrondUploadId)
      ) {
        if (achtergrondPositie.schaalX != null) achtergrondSprite.scale.set(achtergrondPositie.schaalX, achtergrondPositie.schaalY);
        achtergrondSprite.position.set(
            achtergrondPositie.x,
            achtergrondPositie.y,
        );
      }
      belichtingen.value = {
        afbeelding: vorige.belichtingen?.afbeelding ?? 0,
        achtergrond:
            (vorige.bronnen || vorige.belichtingAchtergrondUploadId === achtergrondUploadId)
                ? vorige.belichtingen?.achtergrond ?? 0
                : belichtingen.value.achtergrond,
      };
      achtergrondDonkerte.value = vorige.achtergrondDonkerte ?? 0;
      achtergrondIngesteld.value = vorige.achtergrondIngesteld ?? false;
      rood.value = vorige.rood;
      groen.value = vorige.groen;
      blauw.value = vorige.blauw;

      applyBackground();
      app.renderer.background.color = getBackgroundColor();
      renderCanvas();
    } finally {
      bezigMetHerstellen = false;
    }
  }


async function newDesign(){
    if (!canvasKlaar.value || conceptBezig.value) return;

    const bevestigd = window.confirm(
        "Een nieuw ontwerp starten ?\n\n" +
        "Je huidige ontwerp en het opgeslagen concept worden verwijderd." +
        "Dit kun je niet ongedaan maken",
    );

    if (!bevestigd) return;

    conceptBezig.value = true;
    conceptStatus.value = "bezig";
    conceptMelding.value = "Je lege canvas wordt voorbereid...";

    try{
      await draftTransaction("verwijderen");

      //Herlaad pas nadat het conceptecht verwijderd is.
      window.location.reload();
    } catch {
      conceptStatus.value = "fout";
      conceptMelding.value =
          "Een nieuwe ontwerp strten is niet gelukt" +
          "Je canvas is niet leeggemaakt. Probeer opnieuw";

      conceptBezig.value = false;
    }
}



  // Bewaart bronbestanden, bewerkingen en verf; geen afgeplatte PNG.
  async function saveConcept() {
    if (!canvasKlaar.value || conceptBezig.value) return;
    stopResize();
    stopDrag();
    stopDrawing();
    stopColorChange();
    stopCanvasText();
    conceptBezig.value = true;
    conceptStatus.value = "bezig";
    conceptMelding.value = "Je ontwerp wordt opgeslagen. Even geduld…";
    try {
      console.info("[Concept · editor] Verzamel de originele uploadbestanden en de huidige bewerkingen.");
      const {bronnen, ...toestand} = getCurrentState();
      const concept = {
        versie: 1,
        toestand: JSON.parse(JSON.stringify(toestand)),
        foto: fotoBestand,
        achtergrond: achtergrondBestand,
        verfstreken: readPaintStrokes(),
      };
      await draftTransaction("schrijven", concept);

      const tijdstip = new Intl.DateTimeFormat("nl-NL", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date());

      conceptStatus.value = "opgeslagen";
      conceptMelding.value = `Concept opgeslagen om ${tijdstip}. Je kunt later in deze browser verder werken.`;
    } catch {
      conceptStatus.value = "fout";
      conceptMelding.value = "Opslaan mislukt. Controleer de beschikbare browseropslag en probeer opnieuw.";
    } finally {
      conceptBezig.value = false;
    }
  }

  async function loadConcept() {
    conceptBezig.value = true;
    conceptStatus.value = "bezig";
    conceptMelding.value = "Je opgeslagen ontwerp wordt geladen. Even geduld…";
    try {
      const concept = await draftTransaction("lezen");
      if (unmounted) return;
      if (!concept) {
        conceptStatus.value = "info";
        conceptMelding.value = "";
        return;
      }
      if (concept.versie !== 1 || !concept.toestand || !Array.isArray(concept.verfstreken)) {
        throw new Error("Onbekend conceptformaat");
      }
      const uploadEvent = (bestand: File) => ({ target: { files: [bestand], value: "" } });
      if (concept.achtergrond) {
        console.info("[Concept · herstel] Achtergrondbestand uit IndexedDB opnieuw laden:", concept.achtergrond.name);
        await uploadBackground(uploadEvent(concept.achtergrond));
        if (unmounted) return;
        if (!achtergrondSprite) throw new Error("Achtergrond herstellen mislukt");
      }
      if (concept.foto) {
        console.info("[Concept · herstel] Fotobestand uit IndexedDB opnieuw laden:", concept.foto.name);
        await uploadPhoto(uploadEvent(concept.foto));
        if (unmounted) return;
        if (!fotoSprite) throw new Error("Foto herstellen mislukt");
      }
      const toestand = concept.toestand;
      toestand.belichtingAchtergrondUploadId = achtergrondUploadId;
      if (toestand.achtergrondPositie) toestand.achtergrondPositie.uploadId = achtergrondUploadId;
      console.info("[Concept · herstel] Pas verfstreken, tekst, kleuren, belichting en posities toe.");
      loadPaintStrokes(concept.verfstreken);
      recoveryCondition(toestand);
      geschiedenis.value = [];
      console.info("[Concept · herstel] Klaar: het concept is weer bewerkbaar op het canvas.");
      conceptStatus.value = "opgeslagen";
      conceptMelding.value = "Opgeslagen concept hersteld. Nieuwe wijzigingen bewaren met Concept opslaan.";
    } catch {
      conceptStatus.value = "fout";
      conceptMelding.value = "Het concept kon niet worden geladen. Uw opgeslagen concept is niet overschreven.";
    } finally {
      conceptBezig.value = false;
    }
  }


  // Maakt afzonderlijke hoekblokjes met een ruimer klikgebied.
  // Voegt ook zijgrepen en een ronde draaigreep toe.
  function makeCornerBlocks() {
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

 //witte knop met ronde pijl
    draaiGreep= new Graphics()
        .circle(0, 0, 14)
        .fill({ color: 0xffffff })
        .stroke({ width: 2, color: 0x3b82f6});


    //Gebogen lijn van het draaien
    draaiGreep
        .arc(0, 0, 7, 0, Math.PI * 1.5)
        .stroke({
          width: 2,
          color: 0x172e2b,
          cap: "round",
        });

    //Pijlpunt
    draaiGreep
        .moveTo(-4, -11,)
        .lineTo(0, -7)
        .lineTo(-4, -3)
        .stroke({
          width: 2,
          color: 0x172e2b,
          cap: "round",
          join: "round",

        });

    draaiGreep.eventMode = "static";
    draaiGreep.cursor = "grab";
    draaiGreep.hitArea = new Rectangle(-22, -22, 44, 44);
    draaiGreep.on("pointerdown", startTurn);

    fotoKader.addChild(draaiGreep);
  }

  // Laat het kader en de hoekblokjes de geselecteerde foto of tekst volgen.
  // Plaatst ook de zijgrepen en de draaigreep.
  function adjustPhotoFrame() {
    const object = getActiveObject();
    if (!fotoKader) return;

    fotoKader.clear();
    fotoKader.visible = Boolean(object) && !tekenModus.value;

    if (!fotoKader.visible || !object) return;

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

    logoVoorbeeld.update(fotoBestand);
    achtergrondUploadVoorbeeld.update(achtergrondBestand);

    applyLighting("afbeelding");
    applyLighting("achtergrond");

    syncLayers();
    adjustPhotoFrame();
    app.render();
  }

  function resizePoint(event: PointerEvent | FederatedPointerEvent) {
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
  function startResize(event: FederatedPointerEvent, richting: Point) {
    const object = getActiveObject();
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

    stopDrag();
    stopColorChange();

    const breedte = object.width;
    const hoogte = object.height;

    if (breedte <= 0 || hoogte <= 0) return;

    actiefPaneel.value = geselecteerdType;

    resizeActie = {
      type: "schalen",
      pointerId: event.pointerId,
      object,
      begin: readObjectState(object),
      geschiedenisBegin: getCurrentState(),
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
  function startTurn(event: FederatedPointerEvent) {
    const object = getActiveObject();
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

    stopDrag();
    stopColorChange();
    actiefPaneel.value = geselecteerdType;

    resizeActie = {
      type: "draaien",
      pointerId: event.pointerId,
      object,
      begin: readObjectState(object),
      geschiedenisBegin: getCurrentState(),
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
  function duringResize(event: PointerEvent) {
    if (sleepBegin) {
      duringDrag(event);
      return;
    }
    const actie = resizeActie;
    const object = actie?.object;

    if (!actie || !object || event.pointerId !== actie.pointerId) return;

    event.preventDefault();
    const punt = resizePoint(event);

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
  function stopResize(event?: Event) {
    if (sleepBegin) {
      stopDrag(event);
      return;
    }
    const actie = resizeActie;
    const object = actie?.object;

    if (!actie) return;

    if (event && "pointerId" in event && event.pointerId !== actie.pointerId) {
      return;
    }

    // Neemt ook de laatste aanwijzerpositie mee.
    if (event?.type === "pointerup") {
      duringResize(event as PointerEvent);
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
      saveState(actie.geschiedenisBegin);
    }

    if (object === getTextObject()) syncText();

    if (draaiGreep) {
      draaiGreep.cursor = "grab";
    }

    if (app.canvas.hasPointerCapture(actie.pointerId)) {
      app.canvas.releasePointerCapture(actie.pointerId);
    }
  }

  // Start Pixi en voegt het canvas toe aan de pagina.
  async function makeCanvas() {
    app = new Application<Renderer<HTMLCanvasElement>>();

    await app.init({
      preference: "canvas",
      width: 800,
      height: 500,
      background: getBackgroundColor(),
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    if (unmounted) {
      app.destroy(true, { children: true });
      return;
    }

    canvasHost.value?.appendChild(app.canvas);

    fotoKader = new Graphics();
    fotoKader.eventMode = "passive";
    app.stage.addChild(fotoKader);
    app.canvas.addEventListener("wheel", zoomWithMouse, { passive: false });
    makeCornerBlocks();
    window.addEventListener("pointermove", duringResize, { passive: false });
    window.addEventListener("pointerup", stopResize);
    window.addEventListener("pointercancel", stopResize);
    window.addEventListener("blur", stopResize);
    app.canvas.addEventListener("lostpointercapture", stopResize);
    canvasKlaar.value = true;
  }

  // Laadt de achtergrond onafhankelijk van het logo.
  async function uploadBackground(event: Event | UploadEvent) {
    const input = event.target as UploadEvent["target"] | null;
    if (!input) return;
    const bestand = input.files?.[0];

    if (!bestand || !canvasKlaar.value) return;

    const huidigeUpload = ++achtergrondUploadId;
    const objectUrl = URL.createObjectURL(bestand);

    input.value = "";
    foutmelding.value = "";

    try {
      const afbeelding = new Image();
      afbeelding.src = objectUrl;
      await afbeelding.decode();

      if (unmounted || huidigeUpload !== achtergrondUploadId) return;

      finishProcessing();
      saveState();
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
        startDrag(event, nieuweSprite);
      });


      if (achtergrondSprite) {
        belichtingsBewerking.remove("achtergrond");
        app.stage.removeChild(achtergrondSprite);
        achtergrondSprite.destroy({
          texture: true,
          textureSource: true,
        });
      }

      achtergrondBron = markRaw({ bestand, afbeelding });
      achtergrondBestand = bestand;
      achtergrondSprite = nieuweSprite;
      belichtingsBewerking.register("achtergrond", achtergrondSprite, afbeelding);
      belichtingen.value.achtergrond = 0;
      resetUploadLayer("achtergrond");
      applyBackground();

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

  // Laat tekstvelden hun eigen undo houden; sliders gebruiken de editorhistorie.
  function historyTouch(event: KeyboardEvent) {
    if (!canvasKlaar.value || conceptBezig.value || event.defaultPrevented ||
        event.isComposing || event.altKey || event.shiftKey ||
        !(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return;

    const doel = event.target as HTMLElement | null;
    const invoer = doel?.closest?.("input");
    const tekstInvoer = invoer && !["range", "color", "checkbox", "radio", "button", "submit", "file"].includes(invoer.type);
    if (canvasTekstActief.value || doel?.isContentEditable || tekstInvoer ||
        doel?.closest?.('textarea, [role="textbox"]')) return;

    event.preventDefault();
    undo();
  }


  // Laadt het logo en zet het passend in het midden.
  async function uploadPhoto(event: Event | UploadEvent) {
    const input = event.target as UploadEvent["target"] | null;
    if (!input) return;
    const file = input.files?.[0];

    if (!file || !canvasKlaar.value) return;

    const huidigeUpload = ++uploadId;
    const objectUrl = URL.createObjectURL(file);
    foutmelding.value = "";
    input.value = "";

    try {
      const afbeelding = new Image();
      afbeelding.src = objectUrl;
      await afbeelding.decode();

      if (unmounted || huidigeUpload !== uploadId) return;

      const texture = Texture.from(afbeelding);

      stopResize();

      stopDrag();
      stopDrawing();
      stopColorChange();
      stopCanvasText();
      saveState();
      geselecteerdType = "afbeelding";

      if (fotoSprite) {
        belichtingsBewerking.remove("afbeelding");
        app.stage.removeChild(fotoSprite);
        fotoSprite.destroy({ texture: true, textureSource: true });
      }
      fotoBron = markRaw({ bestand: file, afbeelding });
      fotoBestand = file;
      fileName.value = file.name;

      fotoSprite = new Sprite(texture);
      belichtingsBewerking.register("afbeelding", fotoSprite, afbeelding);
      belichtingen.value.afbeelding = 0;
      resetUploadLayer("afbeelding");
      fotoSprite.anchor.set(0.5);
      fotoSprite.position.set(app.screen.width / 2, app.screen.height / 2);

      const schaal = Math.min(
        (app.screen.width * 0.8) / fotoSprite.width,
        (app.screen.height * 0.8) / fotoSprite.height,
      );

      fotoSprite.scale.set(schaal);
      fotoSprite.eventMode = "static";
      fotoSprite.cursor = "grab";

      fotoSprite.on("pointerdown", startDrag);

      app.stage.addChild(fotoSprite);
      const textObject = getTextObject();
    if (textObject) app.stage.addChild(textObject);
      app.stage.addChild(fotoKader);
      selectPanel("uploads");
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

  // Verwijdert de afbeelding als herstelbare bewerking.
  function deletePhoto() {
    if (!canvasKlaar.value) return;

    // Deze actie verwijdert alleen afbeeldingen.
    if (geselecteerdType === "tekst") return;

    const isAchtergrond = geselecteerdType === "achtergrond";
    const object = isAchtergrond ? achtergrondSprite : fotoSprite;

    if (!object) return;

    stopResize();
    stopDrag();
    stopDrawing();
    stopColorChange();

    saveState();
    if (isAchtergrond) {
      achtergrondBron = null;
      achtergrondUploadId++;
      achtergrondBestand = null;
      achtergrondSprite = null;
      achtergrondBestandsnaam.value = "";
    } else {
      fotoBron = null;
      uploadId++;
      fotoBestand = null;
      fotoSprite = null;
      fileName.value = "";
    }

    belichtingsBewerking.remove(isAchtergrond ? "achtergrond" : "afbeelding");
    belichtingen.value[isAchtergrond ? "achtergrond" : "afbeelding"] = 0;
    app.stage.removeChild(object);
    object.destroy({
      texture: true,
      textureSource: true,
    });

    // De bron blijft via de geschiedenis beschikbaar voor herstel.
    sleepBegin = null;
    kleurBegin = null;
    tekenModus.value = false;

    geselecteerdType = fotoSprite ? "afbeelding" : "achtergrond";
    actiefPaneel.value = "uploads";
    foutmelding.value = "";

    renderCanvas();
  }

  // Start het verplaatsen van de afbeelding of tekst.
  function startDrag(event: FederatedPointerEvent, object: EditableObject | null = fotoSprite) {

    const laagId =
        object === achtergrondSprite
            ? "achtergrond"
            : object === getTextObject()
                ? "tekst"
                : "afbeelding";

    if (!canMoveLayer(laagId)) return;

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
    stopColorChange();
    if (object === achtergrondSprite) {
      geselecteerdType = "achtergrond";
    } else if (object === getTextObject()) {
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
      geschiedenis: getCurrentState(),
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

  function duringDrag(event: PointerEvent) {
    const actie = sleepBegin;

    if (!slepen || !actie || event.pointerId !== actie.pointerId) {
      return;
    }

    event.preventDefault();

    const punt = resizePoint(event);
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

    // Een tolerantie van zes schermpixels blijft gelijk bij een kleiner canvas.
    const rect = app.canvas.getBoundingClientRect();
    const verticaal = Math.abs(x - app.screen.width / 2) <= 6 * app.screen.width / rect.width;
    const horizontaal = Math.abs(y - app.screen.height / 2) <= 6 * app.screen.height / rect.height;
    if (verticaal) x = app.screen.width / 2;
    if (horizontaal) y = app.screen.height / 2;
    middenlijnen.value = { verticaal, horizontaal };
    object.position.set(x, y);
    renderCanvas();
  }

  // Stopt het slepen en bewaart de vorige positie.
  function stopDrag(event?: Event) {
    const actie = sleepBegin;
    if (!actie) return;
    if (event && "pointerId" in event && event.pointerId !== actie.pointerId)
      return;
    if (event?.type === "pointerup") duringDrag(event as PointerEvent);

    // Eerst wissen: releasePointerCapture kan opnieuw een stop-event geven.
    sleepBegin = null;
    slepen = false;
    middenlijnen.value = { verticaal: false, horizontaal: false };
    inspectorsVergrendeld.value = false;
    const object = actie.object;
    if (object.x !== actie.x || object.y !== actie.y) {
      saveState(actie.geschiedenis);
    }
    object.cursor = "grab";
    if (object === getTextObject()) syncText();
    if (app.canvas.hasPointerCapture(actie.pointerId)) {
      app.canvas.releasePointerCapture(actie.pointerId);
    }
  }

  // Plaatst het volledige logo, inclusief rotatie, binnen een marge van 32 px.
  function placeLogo(positie: string) {
    if (!canMoveLayer("afbeelding")) return;

    const posities: Record<string, [number, number]> = {
      midden: [0.5, 0.5],
      linksboven: [0, 0],
      rechtsboven: [1, 0],
      linksonder: [0, 1],
      rechtsonder: [1, 1],
    };
    if (!fotoSprite || !canvasKlaar.value || !posities[positie]) return;
    selectPanel("afbeelding");
    const vorige = getCurrentState();
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
    if (JSON.stringify(vorige) !== JSON.stringify(getCurrentState())) {
      saveState(vorige);
    }
    renderCanvas();
  }

  // Een grijze tint verduistert uitsluitend de achtergrondfoto.
  function applyBackground() {
    if (!achtergrondSprite) return;
    const kanaal = Math.round(255 * (1 - achtergrondDonkerte.value / 100));
    achtergrondSprite.tint = (kanaal << 16) | (kanaal << 8) | kanaal;
  }

  watch(achtergrondDonkerte, () => {
    applyBackground();
    renderCanvas();
  }, { flush: "sync" });

  // Draait de afbeelding met het opgegeven aantal graden.
  function rotatePhoto(graden: number) {
    const object = getActiveObject();
    stopResize();
    if (!object || !canvasKlaar.value) return;

    stopDrag();
    saveState();

    object.angle += graden;
    renderCanvas();
  }

  // Vergroot of verkleint de afbeelding.
  function changeScale(factor: number) {
    const object = getActiveObject();
    stopResize();
    if (!object) return;

    stopDrag();
    saveState();

    object.scale.set(object.scale.x * factor, object.scale.y * factor);
    renderCanvas();
  }

  // Past de afbeeldingsgrootte aan met het muiswiel.
  function zoomWithMouse(event: WheelEvent) {
    const object = getActiveObject();
    if (!object || tekenModus.value) return;

    event.preventDefault();
    if (resizeActie) return;
    changeScale(event.deltaY < 0 ? 1.1 : 0.9);
  }

  // Combineert achtergrond, afbeelding en verf tot een PNG-download.
  function downloadPhoto() {
    stopDrag();
    stopResize();
    stopCanvasText();
    if (!canvasKlaar.value || (!achtergrondIngesteld.value && !fotoSprite && !achtergrondSprite && !getTextObject())) return;

    stopDrawing();
    const kaderWasZichtbaar = fotoKader.visible;

    try {
      fotoKader.visible = false;

      const formaat = { breedte: 1350, hoogte: 852 };
      const bron = app.renderer.extract.canvas({
        target: app.stage,
        frame: app.screen.clone(),
        resolution: formaat.breedte / app.screen.width,
        clearColor: getBackgroundColor(),
      });
      const canvas = document.createElement("canvas");
      canvas.width = formaat.breedte;
      canvas.height = formaat.hoogte;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Geen 2D-context beschikbaar voor export.");
      context.drawImage(bron as HTMLCanvasElement, 0, 0, canvas.width, canvas.height);
      if (verfCanvas.value) context.drawImage(verfCanvas.value, 0, 0, canvas.width, canvas.height);
      const link = document.createElement("a");

      // De afzender geeft de bedrijfs- of logonaam mee; de ontvanger hoeft niets in te vullen.
      const parameters = new URLSearchParams(window.location.search);
      const naam = (parameters.get("naam") ?? "")
        .normalize("NFC")
        .replace(/\.png$/i, "")
        .replace(/[^\p{L}\p{N} _-]/gu, "")
        .trim()
        .slice(0, 128)
        .trim();
      const uuid = (parameters.get("uuid") ?? "").trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 128);
      const bestandsnaam = naam || uuid;
      link.download = `${bestandsnaam || "mijn-bewerkte-foto-1350x852"}.png`;
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
    getBackgroundColor,
  } = useColors();

  const {
    startDrawing,
    continueDrawing,
    stopDrawing,
    restorePaintLayer,
    getPaintStrokeCount,
    readPaintStrokes,
    loadPaintStrokes,
  } = usePaintLayer({
    verfCanvas,
    tekenModus,
    canvasKlaar,
    kwastKleur,
    kwastGrootte,
    hasPhoto: () => Boolean(fotoSprite),
    stopDrag,
    stopColorChange,
    saveState,
  });

  // Verbindt de tekstbediening met het canvas en de geschiedenis.
  const {
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
    getTextObject,
    syncText,
  } = useText({
    getApp: () => app,
    getPhotoFrame: () => fotoKader,
    canEdit: () =>
        canvasKlaar.value &&
        !inspectorsVergrendeld.value,
    beforeEdit: () => selectPanel("tekst"),
    startDrag,
    afterApply: () => {
      geselecteerdType = "tekst";
    },
    saveState,
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
      app.renderer.background.color = getBackgroundColor();
      renderCanvas();
    },
    { flush: "sync" },
  );

  // Vue kan de canvascomponent opnieuw opbouwen terwijl de editor blijft bestaan.
  // Koppel het bestaande Pixi-canvas dan aan de nieuwe host en herstel de verflaag.
  watch([canvasHost, verfCanvas], ([host, verf], [vorigeHost, vorigeVerf]) => {
    if (unmounted || !canvasKlaar.value || !host || !verf) return;
    if (host !== vorigeHost) host.appendChild(app.canvas);
    if (verf !== vorigeVerf) restorePaintLayer(getPaintStrokeCount());
    renderCanvas();
  }, { flush: "post" });

  // Start de editor zodra de pagina gereed is.
  onMounted(async () => {
    try {
      await makeCanvas();
      if (!unmounted) window.addEventListener('keydown', historyTouch);
      if (!unmounted) await loadConcept();
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
    window.removeEventListener("pointermove", duringResize);
    window.removeEventListener("pointerup", stopResize);
    window.removeEventListener('keydown', historyTouch);
    window.removeEventListener("pointercancel", stopResize);
    window.removeEventListener("blur", stopResize);
    uploadId++;
    stopDrawing();

    belichtingsBewerking.dispose();
    logoVoorbeeld.update(null);
    achtergrondUploadVoorbeeld.update(null);
    if (canvasKlaar.value) {
      app.canvas.removeEventListener("wheel", zoomWithMouse);
      app.canvas.removeEventListener("lostpointercapture", stopResize);
      app.destroy(true, { children: true, texture: true, textureSource: true });
    }

  });

  return {
    conceptBezig,
    logoVoorbeeldUrl: logoVoorbeeld.url,
    achtergrondUploadVoorbeeldUrl: achtergrondUploadVoorbeeld.url,
    conceptMelding,
    conceptStatus,
    canvasTekstActief,
    canvasTekstInvoer,
    canvasTekstOpmaak,
    startCanvasText,
    stopCanvasText,
    lagen,
    geselecteerdeLaag,
    selectLayer,
    removeLayer,
    toggleLayerVisibility,
    toggleLayerLock,
    placeLogo,
    achtergrondDonkerte,
    achtergrondIngesteld,
    achtergrondBestandsnaam,
    uploadBackground,
    fileName,
    geschiedenis,
    undo,
    downloadPhoto,
    panelen,
    actiefPaneel,
    selectPanel,
    canvasKlaar,
    bestandInput,
    uploadPhoto,
    changeScale,
    rotatePhoto,
    startColorChange,
    stopColorChange,
    deletePhoto,
    tekenModus,
    toggleBrush,
    kwastKleur,
    kwastPalet,
    kwastGrootte,
    belichtingWaarde,
    belichtingBeschikbaar,
    changeLighting,
    resetLighting,
    achtergrondVoorbeeld,
    achtergrondKanalen,
    selectBackgroundColor,
    foutmelding,
    middenlijnen,
    canvasHost,
    newDesign,
    saveConcept,
    verfCanvas,
    startDrawing,
    continueDrawing,
    stopDrawing,
    tekstFormulier,
    applyText,
    removeText,
    inspectorsVergrendeld,
  };
}
