<script setup>
import { onBeforeUnmount, onMounted, ref, watch, computed } from "vue";
import { Application, Sprite, Texture } from "pixi.js";

// Verwijzingen naar het canvas, de verflaag en het uploadveld.
const canvasHost = ref(null);
const verfCanvas = ref(null);
const bestandInput = ref(null);

// Bestandsnaam, meldingen en het geopende instellingenpaneel.
const fileName = ref("");
const foutmelding = ref("");
const canvasKlaar = ref(false);
const actiefPaneel = ref("uploads");

// RGB-waarden van de achtergrond.
const rood = ref(0);
const groen = ref(0);
const blauw = ref(0);

// RGB-waarden van de fototint; 255 behoudt de oorspronkelijke kleur.
const fotoRood = ref(255);
const fotoGroen = ref(255);
const fotoBlauw = ref(255);

// Aan/uit-status, kleur en dikte van de kwast.
const tekenModus = ref(false);
const kwastKleur = ref("#ff0000");
const kwastGrootte = ref(12);

// Menuknoppen met hun naam en SVG-icoon.
const panelen = [
  { id: "uploads", naam: "Uploads", icoon: "M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6" },
  { id: "afbeelding", naam: "Afbeelding", icoon: "M3 3h18v18H3ZM3 16l5-5 4 4 3-3 6 6M8 7h.01" },
  {
    id: "tekenen",
    naam: "Tekenen",
    icoon: "m14 6 4-4a2.8 2.8 0 0 1 4 4l-9 9-4-4 5-5Zm-5 7c-6 0-2 7-7 8 7 2 11-1 10-5",
  },
  {
    id: "achtergrond",
    naam: "Achtergrond",
    icoon:
      "M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1-4 2 2 0 0 1 1-4h3a3 3 0 0 0 3-3c0-4-4-7-9-7ZM7 9h.01M11 6h.01M16 8h.01M6 14h.01",
  },
];

// Koppelt de achtergrondsliders aan hun kleurwaarden.
const achtergrondKanalen = [
  { naam: "Rood", waarde: rood },
  { naam: "Groen", waarde: groen },
  { naam: "Blauw", waarde: blauw },
];

// Koppelt de fototintsliders aan hun kleurwaarden.
const tintKanalen = [
  { naam: "Rood", waarde: fotoRood },
  { naam: "Groen", waarde: fotoGroen },
  { naam: "Blauw", waarde: fotoBlauw },
];

// Werkt het kleurvoorbeeld bij wanneer de achtergrond verandert.
const achtergrondVoorbeeld = computed(() => achtergrondKleur());

// Voorgestelde kleuren voor de kwast.
const kwastPalet = [
  "#172e2b",
  "#ffffff",
  "#ff0000",
  "#f3c55e",
  "#479775",
  "#527bdb",
  "#a76fcb",
  "#ed94a5",
];

// Bewaart eerdere toestanden en het begin van een bewerking.
const geschiedenis = ref([]);
let bezigMetHerstellen = false;
let sleepBegin = null;
let kleurBegin = null;

// Pixi-editor en de afbeelding op het canvas.
let app;
let fotoSprite;

// Voorkomt dat een verouderde upload na het laden wordt getoond.
let uploadId = 0;
let unmounted = false;

// Sleepstatus en afstand tussen de aanwijzer en de afbeelding.
let slepen = false;
let verschil = { x: 0, y: 0 };

// Verfstreken, de huidige streek en de actieve aanwijzer.
let verfstreken = [];
let actieveStreek = null;
let tekenPointer = null;

// Opent een paneel en stopt de actieve bewerking.
function kiesPaneel(paneel) {
  stopSlepen();
  stopTekenen();
  stopKleurWijziging();
  if (paneel !== "tekenen") tekenModus.value = false;
  actiefPaneel.value = paneel;
}

// Schakelt de kwast in of uit.
function wisselKwast() {
  stopSlepen();
  stopTekenen();
  stopKleurWijziging();
  tekenModus.value = !tekenModus.value;
  if (tekenModus.value) actiefPaneel.value = "tekenen";
}

// Begrenst een kleurwaarde tot een geheel getal van 0 tot 255.
function kleurGetal(waarde) {
  return Math.max(0, Math.min(255, Math.round(Number(waarde) || 0)));
}

// Maakt de RGB-kleur voor de canvasachtergrond.
function achtergrondKleur() {
  return `rgb(${kleurGetal(rood.value)}, ${kleurGetal(groen.value)}, ${kleurGetal(blauw.value)})`;
}

// Zet de fotokleuren om naar een Pixi-kleurgetal.
function fotoTint() {
  return (
    kleurGetal(fotoRood.value) * 65536 +
    kleurGetal(fotoGroen.value) * 256 +
    kleurGetal(fotoBlauw.value)
  );
}

// Leest positie, schaal, kleuren en het aantal verfstreken.
function huidigeToestand() {
  return {
    x: fotoSprite?.x ?? null,
    y: fotoSprite?.y ?? null,
    schaal: fotoSprite?.scale.x ?? null,
    hoek: fotoSprite?.angle ?? 0,
    rood: rood.value,
    groen: groen.value,
    blauw: blauw.value,
    fotoRood: fotoRood.value,
    fotoGroen: fotoGroen.value,
    fotoBlauw: fotoBlauw.value,
    aantalVerfstreken: verfstreken.length,
  };
}

// Bewaart een toestand voor Ongedaan maken.
function bewaarToestand(toestand = huidigeToestand()) {
  if (bezigMetHerstellen || !canvasKlaar.value) return;

  geschiedenis.value.push(toestand);
}

// Onthoudt de toestand voordat een kleurslider verandert.
function startKleurWijziging() {
  if (!canvasKlaar.value || kleurBegin) return;

  kleurBegin = huidigeToestand();
}

// Bewaart een kleurwijziging als een enkele bewerking.
function stopKleurWijziging() {
  if (!kleurBegin) return;

  const einde = huidigeToestand();
  const veranderd = Object.keys(kleurBegin).some(
    (sleutel) => kleurBegin[sleutel] !== einde[sleutel],
  );
  if (veranderd) {
    bewaarToestand(kleurBegin);
  }
  kleurBegin = null;
}

// Herstelt de vorige afbeelding, kleuren en verflaag.
function ongedaanMaken() {
  if (!canvasKlaar.value || geschiedenis.value.length === 0) return;

  stopSlepen();
  stopTekenen();
  stopKleurWijziging();

  const vorige = geschiedenis.value.pop();
  if (!vorige) return;

  bezigMetHerstellen = true;

  try {
    herstelVerflaag(vorige.aantalVerfstreken);
    if (fotoSprite && vorige.schaal !== null) {
      fotoSprite.position.set(vorige.x, vorige.y);
      fotoSprite.scale.set(vorige.schaal);
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
    app.render();
  } finally {
    bezigMetHerstellen = false;
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

  app.canvas.addEventListener("wheel", zoomMetMuis, { passive: false });
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

    stopSlepen();
    herstelVerflaag();
    kleurBegin = null;
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
    fotoSprite.on("globalpointermove", tijdensSlepen);
    fotoSprite.on("pointerup", stopSlepen);
    fotoSprite.on("pointerupoutside", stopSlepen);

    app.stage.addChild(fotoSprite);
    kiesPaneel("afbeelding");
    geschiedenis.value = [];
    sleepBegin = null;
    app.render();
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
  if (!fotoSprite || !canvasKlaar.value) return;

  stopSlepen();
  herstelVerflaag();
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

  app.render();
}

// Start het verplaatsen van de afbeelding.
function startSlepen(event) {
  if (!fotoSprite || tekenModus.value) return;
  actiefPaneel.value = "afbeelding";

  sleepBegin = huidigeToestand();
  slepen = true;
  fotoSprite.cursor = "grabbing";

  verschil = {
    x: event.global.x - fotoSprite.x,
    y: event.global.y - fotoSprite.y,
  };
}

// Laat de afbeelding de aanwijzer volgen.
function tijdensSlepen(event) {
  if (!slepen || !fotoSprite) return;

  fotoSprite.position.set(event.global.x - verschil.x, event.global.y - verschil.y);
  app.render();
}

// Stopt het slepen en bewaart de vorige positie.
function stopSlepen() {
  if (
    slepen &&
    fotoSprite &&
    sleepBegin &&
    (fotoSprite.x !== sleepBegin.x || fotoSprite.y !== sleepBegin.y)
  ) {
    bewaarToestand(sleepBegin);
  }
  sleepBegin = null;
  slepen = false;

  if (fotoSprite) {
    fotoSprite.cursor = "grab";
  }
}

// Draait de afbeelding met het opgegeven aantal graden.
function draaiFoto(graden) {
  if (!fotoSprite || !canvasKlaar.value) return;

  stopSlepen();
  bewaarToestand();

  fotoSprite.angle += graden;
  app.render();
}

// Vergroot of verkleint de afbeelding.
function veranderSchaal(factor) {
  if (!fotoSprite) return;

  bewaarToestand();

  fotoSprite.scale.set(fotoSprite.scale.x * factor, fotoSprite.scale.y * factor);
  app.render();
}

// Past de afbeeldingsgrootte aan met het muiswiel.
function zoomMetMuis(event) {
  if (!fotoSprite || tekenModus.value) return;

  event.preventDefault();
  veranderSchaal(event.deltaY < 0 ? 1.1 : 0.9);
}

// Rekent de aanwijzerpositie om naar canvascoordinaten.
function tekenPunt(event) {
  const rechthoek = verfCanvas.value.getBoundingClientRect();
  return {
    x: ((event.clientX - rechthoek.left) * verfCanvas.value.width) / rechthoek.width,
    y: ((event.clientY - rechthoek.top) * verfCanvas.value.height) / rechthoek.height,
  };
}

// Tekent een ronde stip of een lijnstuk op de verflaag.
function verfSegment(streek, van, naar = van) {
  const context = verfCanvas.value.getContext("2d");
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
function startTekenen(event) {
  if (
    !tekenModus.value ||
    !canvasKlaar.value ||
    !fotoSprite ||
    tekenPointer !== null ||
    !event.isPrimary ||
    event.button !== 0
  )
    return;

  event.preventDefault();
  stopSlepen();
  stopKleurWijziging();
  bewaarToestand();
  tekenPointer = event.pointerId;
  verfCanvas.value.setPointerCapture(tekenPointer);
  actieveStreek = {
    kleur: kwastKleur.value,
    grootte: Math.max(1, Math.min(80, Number(kwastGrootte.value) || 1)),
    punten: [tekenPunt(event)],
  };
  verfstreken.push(actieveStreek);
  verfSegment(actieveStreek, actieveStreek.punten[0]);
}

// Voegt tijdens het bewegen punten toe aan de kwaststreek.
function tijdensTekenen(event) {
  if (!actieveStreek || event.pointerId !== tekenPointer) return;
  event.preventDefault();
  const punt = tekenPunt(event);
  const vorigPunt = actieveStreek.punten[actieveStreek.punten.length - 1];
  if (punt.x === vorigPunt.x && punt.y === vorigPunt.y) return;
  actieveStreek.punten.push(punt);
  verfSegment(actieveStreek, vorigPunt, punt);
}

// Rondt de kwaststreek af en laat de aanwijzer los.
function stopTekenen(event) {
  if (tekenPointer === null || (event && event.pointerId !== tekenPointer)) return;
  if (event?.type === "pointerup") tijdensTekenen(event);
  const pointer = tekenPointer;
  tekenPointer = null;
  actieveStreek = null;
  if (verfCanvas.value?.hasPointerCapture(pointer)) {
    verfCanvas.value.releasePointerCapture(pointer);
  }
}

// Bouwt de verflaag opnieuw op uit de overgebleven streken.
function herstelVerflaag(aantal = 0) {
  stopTekenen();
  verfstreken.length = aantal;
  const canvas = verfCanvas.value;
  canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
  for (const streek of verfstreken) {
    verfSegment(streek, streek.punten[0]);
    for (let index = 1; index < streek.punten.length; index++) {
      verfSegment(streek, streek.punten[index - 1], streek.punten[index]);
    }
  }
}

// Combineert achtergrond, afbeelding en verf tot een PNG-download.
function downloadFoto() {
  if (!canvasKlaar.value || !fotoSprite) return;

  stopTekenen();
  const canvas = app.renderer.extract.canvas({
    target: app.stage,
    frame: app.screen.clone(),
    resolution: 1,
    clearColor: achtergrondKleur(),
  });
  canvas.getContext("2d").drawImage(verfCanvas.value, 0, 0, canvas.width, canvas.height);
  const link = document.createElement("a");

  link.download = "mijn-bewerkte-foto.png";
  link.href = canvas.toDataURL("image/png");

  link.click();
}

// Past de fototint direct toe wanneer de kleurwaarden veranderen.
watch(
  [fotoRood, fotoGroen, fotoBlauw],
  () => {
    if (!fotoSprite || bezigMetHerstellen) return;

    fotoSprite.tint = fotoTint();
    app.render();
  },
  { flush: "sync" },
);

// Past een gewijzigde achtergrondkleur direct toe op het canvas.
watch(
  [rood, groen, blauw],
  () => {
    if (!canvasKlaar.value || bezigMetHerstellen) return;

    app.renderer.background.color = achtergrondKleur();
    app.render();
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
  unmounted = true;
  uploadId++;
  stopTekenen();

  if (canvasKlaar.value) {
    app.canvas.removeEventListener("wheel", zoomMetMuis);
    app.destroy(true, { children: true, texture: true, textureSource: true });
  }
});
</script>

<template>
  <section class="editor">
    <!-- Titel en vaste acties. -->
    <header class="bovenbalk">
      <div class="merk">
        <span
          class="merk-icoon"
          aria-hidden="true"
          >d.</span
        ><span>Dappre <strong>toolkit</strong></span>
      </div>
      <div class="ontwerpnaam">
        <span class="bovenlabel">CLUBSTUDIO</span>
        <h1>{{ fileName || "Nieuw clubontwerp" }}</h1>
      </div>
      <div class="hoofdacties">
        <button
          class="undo"
          type="button"
          @click="ongedaanMaken"
          :disabled="geschiedenis.length === 0"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="m8 4-5 5 5 5M3 9h11a6 6 0 0 1 0 12h-3" />
          </svg>
          <span>Ongedaan maken</span>
        </button>
        <button
          class="download"
          type="button"
          @click="downloadFoto"
          :disabled="!fileName"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
          </svg>
          Download <span class="formaat">PNG</span>
        </button>
      </div>
    </header>

    <div class="editorindeling">
      <!-- Gereedschappen in de linker menubalk. -->
      <nav
        class="gereedschappen"
        aria-label="Editorgereedschappen"
      >
        <button
          v-for="paneel in panelen"
          :key="paneel.id"
          type="button"
          :class="{ actief: actiefPaneel === paneel.id }"
          :aria-pressed="actiefPaneel === paneel.id"
          @click="kiesPaneel(paneel.id)"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path :d="paneel.icoon" />
          </svg>
          {{ paneel.naam }}
        </button>
        <span
          class="railvoet"
          aria-hidden="true"
          >MAAK HET<br />VAN JOU.</span
        >
      </nav>

      <aside
        class="instellingen"
        aria-label="Gereedschapsinstellingen"
      >
        <!-- Uploaden of vervangen van de afbeelding. -->
        <section
          v-show="actiefPaneel === 'uploads'"
          class="paneel"
        >
          <span class="bovenlabel">JOUW CLUB, JOUW STIJL</span>
          <h2>Begin met je logo</h2>
          <p>Geef je club een eigen gezicht. Voeg een logo of foto toe om te beginnen.</p>
          <label
            class="uploadveld"
            :class="{ geblokkeerd: !canvasKlaar }"
          >
            <span
              class="upload-icoon"
              aria-hidden="true"
              >+</span
            >
            <strong>{{ fileName ? "Afbeelding vervangen" : "Afbeelding kiezen" }}</strong>
            <span>JPG, PNG, WebP of SVG</span>
            <input
              ref="bestandInput"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/svg+xml,.svg"
              :disabled="!canvasKlaar"
              @change="uploadFoto"
            />
          </label>
          <div
            v-if="fileName"
            class="bestandkaart"
          >
            <span class="statusstip"></span><span>{{ fileName }}</span>
          </div>
          <p class="tip">
            Tip: een PNG of SVG met een transparante achtergrond past mooi op je clubkleur.
          </p>
          <p
            v-if="fileName"
            class="kleine-tekst"
          >
            Een nieuwe afbeelding vervangt je huidige afbeelding en verfstreken.
          </p>
        </section>

        <!-- Formaat, rotatie en fototint. -->
        <section
          v-show="actiefPaneel === 'afbeelding'"
          class="paneel"
        >
          <span class="bovenlabel">MAAK HET PASSEND</span>
          <h2>Afbeelding</h2>
          <p>Sleep je afbeelding op het canvas naar de juiste plek.</p>
          <p
            v-if="!fileName"
            class="tip"
          >
            Upload eerst een logo of foto om te bewerken.
          </p>
          <fieldset :disabled="!fileName">
            <legend>Formaat</legend>
            <div class="knoppenrij">
              <button
                type="button"
                @click="veranderSchaal(0.9)"
              >
                − Kleiner
              </button>
              <button
                type="button"
                @click="veranderSchaal(1.1)"
              >
                + Groter
              </button>
            </div>
            <h3>Draaien</h3>
            <div class="knoppenrij">
              <button
                type="button"
                @click="draaiFoto(-15)"
              >
                ↶ Links 15°
              </button>
              <button
                type="button"
                @click="draaiFoto(15)"
              >
                ↷ Rechts 15°
              </button>
            </div>
            <div class="scheiding"></div>
            <h3>Fototint</h3>
            <p class="kleine-tekst">Pas de kleurtint van de hele afbeelding aan.</p>
            <label
              v-for="kanaal in tintKanalen"
              :key="kanaal.naam"
              class="schuifregelaar"
            >
              <span
                >{{ kanaal.naam }} <output>{{ kanaal.waarde.value }}</output></span
              >
              <input
                type="range"
                min="0"
                max="255"
                :aria-label="'Fototint ' + kanaal.naam"
                :value="kanaal.waarde.value"
                @input="kanaal.waarde.value = Number($event.target.value)"
                @pointerdown="startKleurWijziging"
                @keydown="startKleurWijziging"
                @change="stopKleurWijziging"
                @blur="stopKleurWijziging"
              />
            </label>
            <button
              class="verwijderen"
              type="button"
              @click="verwijderFoto"
            >
              Afbeelding verwijderen
            </button>
          </fieldset>
        </section>

        <!-- Kwast, kleur en dikte. -->
        <section
          v-show="actiefPaneel === 'tekenen'"
          class="paneel"
        >
          <span class="bovenlabel">EEN PERSOONLIJK ACCENT</span>
          <h2>Tekenen</h2>
          <p>Voeg met de kwast kleur en details toe aan je ontwerp.</p>
          <p
            v-if="!fileName"
            class="tip"
          >
            Upload eerst een afbeelding om erop te tekenen.
          </p>
          <fieldset :disabled="!fileName">
            <legend class="sr-only">Kwastinstellingen</legend>
            <button
              class="kwast-knop"
              :class="{ actief: tekenModus }"
              type="button"
              :aria-pressed="tekenModus"
              :aria-label="tekenModus ? 'Kwast uitzetten' : 'Kwast inschakelen'"
              @click="wisselKwast"
            >
              <img
                src="/kwast.svg"
                alt=""
                width="28"
                height="28"
              />
              <span>Kwast</span><span class="schakelaar">{{ tekenModus ? "Aan" : "Uit" }}</span>
            </button>
            <h3>Kleur</h3>
            <div class="kleurkeuze">
              <label for="kwastkleur">Kwastkleur</label>
              <input
                id="kwastkleur"
                type="color"
                v-model="kwastKleur"
              />
              <span>{{ kwastKleur.toUpperCase() }}</span>
            </div>
            <div
              class="kleurpalet"
              aria-label="Snelle kwastkleuren"
            >
              <button
                v-for="kleur in kwastPalet"
                :key="kleur"
                type="button"
                :style="{ background: kleur }"
                :aria-label="'Kwastkleur ' + kleur"
                :aria-pressed="kwastKleur === kleur"
                :class="{ gekozen: kwastKleur === kleur }"
                @click="kwastKleur = kleur"
              />
            </div>
            <label class="schuifregelaar">
              <span
                >Kwastgrootte <output>{{ kwastGrootte }} px</output></span
              >
              <input
                type="range"
                min="1"
                max="80"
                aria-label="Kwastgrootte"
                v-model.number="kwastGrootte"
              />
            </label>
            <div
              class="kwastvoorbeeld"
              aria-hidden="true"
            >
              <span
                :style="{
                  width: kwastGrootte + 'px',
                  height: kwastGrootte + 'px',
                  background: kwastKleur,
                }"
              ></span>
            </div>
          </fieldset>
          <p class="tip">
            De verf ligt op een aparte laag en blijft staan als je de afbeelding verplaatst. Met
            Ongedaan maken haal je een streek weg.
          </p>
        </section>

        <!-- Kleur van de canvasachtergrond. -->
        <section
          v-show="actiefPaneel === 'achtergrond'"
          class="paneel"
        >
          <span class="bovenlabel">LAAT JE CLUBKLEUR ZIEN</span>
          <h2>Achtergrond</h2>
          <p>Kies een achtergrond die bij je club past.</p>
          <div
            class="kleurvoorbeeld"
            :style="{ background: achtergrondVoorbeeld }"
            aria-label="Huidige achtergrondkleur"
          ></div>
          <fieldset :disabled="!canvasKlaar">
            <legend>Achtergrondkleur</legend>
            <label
              v-for="kanaal in achtergrondKanalen"
              :key="kanaal.naam"
              class="schuifregelaar"
            >
              <span
                >{{ kanaal.naam }} <output>{{ kanaal.waarde.value }}</output></span
              >
              <input
                type="range"
                min="0"
                max="255"
                :aria-label="'Achtergrond ' + kanaal.naam"
                :value="kanaal.waarde.value"
                @input="kanaal.waarde.value = Number($event.target.value)"
                @pointerdown="startKleurWijziging"
                @keydown="startKleurWijziging"
                @change="stopKleurWijziging"
                @blur="stopKleurWijziging"
              />
            </label>
          </fieldset>
          <p class="tip">De achtergrondkleur wordt meegenomen in je PNG-download.</p>
        </section>
      </aside>

      <!-- Canvas met de afbeelding en een aparte verflaag. -->
      <main
        class="werkruimte"
        aria-label="Ontwerpcanvas"
      >
        <div class="werkbalk">
          <span
            ><span class="statusstip"></span
            >{{ tekenModus ? "Kwast actief" : "Ontwerpcanvas" }}</span
          ><span>800 × 500 px</span>
        </div>
        <p
          v-if="foutmelding"
          class="foutmelding"
          role="alert"
        >
          {{ foutmelding }}
        </p>
        <div class="canvasgebied">
          <div class="papier">
            <div class="papierkop">
              <span>01 <strong>Jouw clubontwerp</strong></span
              ><span>PNG</span>
            </div>
            <div
              class="canvas-host"
              :class="{ 'kwast-actief': tekenModus }"
            >
              <div ref="canvasHost"></div>
              <canvas
                ref="verfCanvas"
                class="verflaag"
                width="800"
                height="500"
                aria-label="Verflaag: teken met de kwast op de afbeelding"
                @pointerdown="startTekenen"
                @pointermove="tijdensTekenen"
                @pointerup="stopTekenen"
                @pointercancel="stopTekenen"
                @lostpointercapture="stopTekenen"
              />
              <div
                v-if="!fileName"
                class="leeg-canvas"
              >
                <div
                  class="leeg-icoon"
                  aria-hidden="true"
                >
                  ✳
                </div>
                <h2>Jouw club. Jouw ontwerp.</h2>
                <p>Alles begint met een logo of foto.</p>
                <button
                  class="primaire-knop"
                  type="button"
                  :disabled="!canvasKlaar"
                  @click="
                    kiesPaneel('uploads');
                    bestandInput?.click();
                  "
                >
                  Afbeelding toevoegen
                </button>
              </div>
            </div>
            <p class="canvashint">
              {{
                tekenModus
                  ? "Sleep om te tekenen · Kies links je kleur en kwastgrootte"
                  : "Sleep je afbeelding om te verplaatsen · Scroll om de afbeelding te schalen"
              }}
            </p>
          </div>
        </div>
        <footer class="werkruimtevoet">
          <span>Gemaakt voor jouw club</span><span>Download je ontwerp om het te bewaren</span>
        </footer>
      </main>
    </div>
  </section>
</template>


<style scoped>
/* Basisopmaak en gedeelde bediening. */
:global(body) {
  margin: 0;
  background: #f2f4f3;
}
.editor {
  color: #253b35;
  font-family: "Segoe UI", Arial, sans-serif;
  font-size: 14px;
}
.editor *,
.editor *::before,
.editor *::after {
  box-sizing: border-box;
}
button,
input {
  font: inherit;
}
button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid #dfe5e2;
  border-radius: 9px;
  padding: 11px 14px;
  background: white;
  color: inherit;
  cursor: pointer;
  transition:
    background 0.15s,
    border-color 0.15s;
}
button:hover:not(:disabled) {
  background: #edf4ef;
  border-color: #a5bbae;
}
button:disabled,
fieldset:disabled {
  opacity: 0.45;
}
button:disabled {
  cursor: not-allowed;
}
button:focus-visible,
input:focus-visible,
.uploadveld:focus-within {
  outline: 3px solid #63a17d;
  outline-offset: 3px;
}
svg {
  width: 21px;
  height: 21px;
  flex-shrink: 0;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}
/* Titelbalk, merk en downloadknop. */
.bovenbalk {
  display: flex;
  align-items: center;
  gap: 30px;
  min-height: 84px;
  padding: 16px 28px;
  background: #183d32;
  color: white;
}
.merk {
  display: flex;
  align-items: center;
  gap: 11px;
  font-size: 20px;
  white-space: nowrap;
}
.merk strong {
  font-weight: 400;
  color: #bdd5c7;
}
.merk-icoon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: #d4edb9;
  color: #183d32;
  font-size: 30px;
  font-weight: 800;
}
.ontwerpnaam {
  min-width: 0;
  border-left: 1px solid #ffffff30;
  padding-left: 28px;
}
.bovenlabel {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1.5px;
  color: #778b80;
}
.bovenbalk .bovenlabel {
  color: #b9d1c4;
}
h1 {
  font-size: 15px;
  font-weight: 500;
  margin: 5px 0 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 330px;
}
.hoofdacties {
  display: flex;
  gap: 12px;
  margin-left: auto;
  flex-shrink: 0;
}
.bovenbalk .undo {
  background: transparent;
  color: white;
  border-color: #ffffff35;
}
.bovenbalk .undo:hover:not(:disabled) {
  background: #ffffff15;
}
.download {
  background: #d4edb9;
  color: #183d32;
  border-color: #d4edb9;
  font-weight: 650;
}
.formaat {
  font-size: 10px;
  border-left: 1px solid #183d3233;
  padding-left: 8px;
}
/* Indeling met menubalk, instellingen en canvas. */
.editorindeling {
  display: grid;
  grid-template-columns: 92px 292px minmax(0, 1fr);
  min-height: calc(100dvh - 84px);
}
.gereedschappen {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 22px 7px;
  background: #fff;
  border-right: 1px solid #e5ebe7;
}
.gereedschappen button {
  flex-direction: column;
  gap: 9px;
  border: 0;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 600;
  padding: 14px 2px;
  min-height: 75px;
  color: #63756c;
}
.gereedschappen button.actief {
  color: #234d39;
  background: #eaf2e4;
}
.railvoet {
  margin-top: auto;
  padding: 25px 3px 5px;
  font-size: 9px;
  letter-spacing: 1.4px;
  line-height: 1.8;
  color: #9aaba2;
  text-align: center;
}
/* Instellingenpanelen en uploadveld. */
.instellingen {
  background: #fff;
  border-right: 1px solid #e2e8e4;
  min-width: 0;
}
.paneel {
  padding: 30px 23px;
}
h2 {
  font-size: 22px;
  letter-spacing: -0.6px;
  margin: 10px 0;
}
p {
  line-height: 1.65;
  color: #718178;
  margin: 0 0 24px;
}
.uploadveld {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 27px 10px;
  border: 1px dashed #a1b9a7;
  border-radius: 12px;
  background: #f6f9f2;
  cursor: pointer;
  text-align: center;
}
.uploadveld:hover {
  background: #edf4e5;
}
.uploadveld > span:last-of-type {
  font-size: 11px;
  color: #7c8b81;
}
.upload-icoon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #e2edda;
  color: #43634d;
  font-size: 28px;
  font-weight: 300;
}
.uploadveld input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}
.uploadveld.geblokkeerd {
  opacity: 0.45;
}
.bestandkaart {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 15px 0;
  font-size: 12px;
  overflow-wrap: anywhere;
}
.tip {
  margin-top: 25px;
  padding: 14px;
  background: #f5f7f5;
  border-radius: 8px;
  font-size: 12px;
}
.kleine-tekst {
  font-size: 12px;
  margin: 0 0 14px;
}
/* Afbeeldingsknoppen en kleursliders. */
fieldset {
  min-width: 0;
  padding: 0;
  margin: 22px 0 0;
  border: 0;
}
legend,
h3 {
  font-size: 13px;
  font-weight: 650;
  padding: 0;
  margin: 0 0 13px;
}
h3 {
  margin-top: 22px;
}
.knoppenrij {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.knoppenrij button {
  font-size: 12px;
  padding: 11px 8px;
}
.scheiding {
  border-top: 1px solid #e9edea;
  margin: 26px 0 0;
}
.schuifregelaar {
  display: block;
  margin: 17px 0;
  font-size: 12px;
}
.schuifregelaar > span {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 9px;
}
output {
  min-width: 35px;
  padding: 3px 6px;
  border-radius: 5px;
  background: #f0f3f0;
  text-align: center;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
input[type="range"] {
  width: 100%;
  margin: 0;
  accent-color: #417459;
  cursor: pointer;
}
.verwijderen {
  width: 100%;
  margin-top: 25px;
  color: #a25046;
  background: #fff8f6;
  border-color: #f0dcd7;
  font-size: 12px;
}
/* Kwastbediening, kleurpalet en voorbeeld. */
.kwast-knop {
  width: 100%;
  justify-content: flex-start;
  padding: 13px;
}
.kwast-knop.actief {
  background: #edf5e7;
  border-color: #8fb580;
}
.schakelaar {
  margin-left: auto;
  border-radius: 20px;
  padding: 3px 10px;
  font-size: 11px;
  background: #edf0ed;
}
.actief .schakelaar {
  background: #315c40;
  color: #fff;
}
.kleurkeuze {
  display: flex;
  align-items: center;
  gap: 10px;
}
.kleurkeuze label {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}
.kleurkeuze input {
  width: 35px;
  height: 35px;
  padding: 2px;
  border: 1px solid #dce4de;
  border-radius: 6px;
  background: white;
  cursor: pointer;
}
.kleurkeuze > span {
  font-size: 12px;
  font-family: monospace;
}
.kleurpalet {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 16px 0 24px;
}
.kleurpalet button {
  width: 22px;
  height: 22px;
  padding: 0;
  border: 1px solid #00000020;
  border-radius: 50%;
}
.kleurpalet button.gekozen {
  outline: 2px solid #52755b;
  outline-offset: 3px;
}
.kwastvoorbeeld {
  display: grid;
  place-items: center;
  height: 100px;
  border-radius: 9px;
  background: #f0f2ef;
}
.kwastvoorbeeld span {
  display: block;
  border-radius: 50%;
  border: 1px solid #00000010;
}
.kleurvoorbeeld {
  height: 105px;
  border-radius: 10px;
  border: 1px solid #e2e7e3;
}
/* Werkruimte en de twee canvaslagen. */
.werkruimte {
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: #f1f3f1;
}
.werkbalk,
.werkruimtevoet {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 18px 30px;
  font-size: 11px;
  color: #78867c;
}
.werkbalk {
  background: #ffffff80;
  border-bottom: 1px solid #e4e9e4;
}
.werkbalk > span:first-child {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #3c5948;
}
.statusstip {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #77a679;
  flex-shrink: 0;
}
.canvasgebied {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 45px;
  flex: 1;
  min-width: 0;
}
.papier {
  width: 100%;
  max-width: 900px;
  min-width: 0;
}
.papierkop {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
  color: #8c998f;
  font-size: 10px;
  letter-spacing: 0.4px;
}
.papierkop strong {
  color: #53665b;
  margin-left: 10px;
  font-weight: 500;
  font-size: 12px;
}
.canvas-host {
  position: relative;
  width: 100%;
  aspect-ratio: 8 / 5;
  background: white;
  box-shadow:
    0 12px 42px #253b3512,
    0 2px 5px #253b350a;
  overflow: hidden;
}
.canvas-host :deep(canvas) {
  display: block;
  width: 100% !important;
  height: auto !important;
  touch-action: none;
}
.verflaag {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.kwast-actief .verflaag {
  pointer-events: auto;
}
.canvas-host.kwast-actief :deep(canvas) {
  cursor:
    url("/kwast.svg") 3 29,
    crosshair !important;
}
/* Startscherm voordat een afbeelding is gekozen. */
.leeg-canvas {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #fffefa;
  text-align: center;
  padding: 18px;
}
.leeg-icoon {
  color: #b1c298;
  font-size: 57px;
  margin-bottom: 8px;
}
.leeg-canvas h2 {
  font-size: clamp(16px, 2vw, 28px);
  margin: 0 0 10px;
}
.leeg-canvas p {
  font-size: 12px;
  margin-bottom: 20px;
}
.primaire-knop {
  background: #254d3b;
  color: white;
  border-color: #254d3b;
  font-size: 12px;
}
.primaire-knop:hover:not(:disabled) {
  background: #35644d;
  color: white;
}
.canvashint {
  text-align: center;
  margin: 20px 0 0;
  font-size: 11px;
}
.werkruimtevoet {
  border-top: 1px solid #e1e7e1;
  font-size: 10px;
}
.foutmelding {
  margin: 16px 25px 0;
  background: #fff1ec;
  color: #923a2b;
  padding: 12px;
  border-radius: 8px;
}
/* Verbergt tekst visueel, maar houdt deze leesbaar voor schermlezers. */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}
/* Paneel scrollbaar houden op grote schermen. */
@media (min-width: 1000px) {
  .instellingen {
    max-height: calc(100dvh - 84px);
    overflow-y: auto;
  }
}
/* Compactere indeling voor kleinere laptops. */
@media (max-width: 1100px) {
  .bovenbalk {
    padding: 16px;
    gap: 20px;
  }
  .ontwerpnaam {
    padding-left: 20px;
  }
  h1 {
    max-width: 180px;
  }
  .canvasgebied {
    padding: 26px;
  }
  .editorindeling {
    grid-template-columns: 80px 265px minmax(0, 1fr);
  }
  .undo span {
    display: none;
  }
}
/* Panelen boven het canvas op mobiele schermen. */
@media (max-width: 760px) {
  .bovenbalk {
    flex-wrap: wrap;
    gap: 12px;
  }
  .merk {
    font-size: 17px;
  }
  .ontwerpnaam {
    order: 3;
    width: 100%;
    border: 0;
    padding: 0;
  }
  h1 {
    max-width: 100%;
  }
  .bovenbalk .bovenlabel {
    display: none;
  }
  .hoofdacties {
    gap: 7px;
  }
  .hoofdacties button {
    padding: 9px;
  }
  .formaat {
    display: none;
  }
  .editorindeling {
    grid-template-columns: minmax(0, 1fr);
  }
  .gereedschappen {
    flex-direction: row;
    gap: 6px;
    padding: 8px 12px;
    border-bottom: 1px solid #e5ebe7;
  }
  .gereedschappen button {
    flex: 1;
    min-height: 62px;
    padding: 8px 2px;
  }
  .railvoet {
    display: none;
  }
  .paneel {
    padding: 22px;
  }
  .instellingen {
    border-right: 0;
  }
  .paneel h2 {
    font-size: 20px;
  }
  .paneel > p {
    margin-bottom: 16px;
  }
  .uploadveld {
    padding: 17px 10px;
  }
  .tip {
    margin-top: 16px;
  }
  .werkruimte {
    min-height: 420px;
  }
  .canvasgebied {
    padding: 25px 18px;
  }
  .werkbalk,
  .werkruimtevoet {
    padding: 14px 18px;
  }
  .werkruimtevoet {
    flex-wrap: wrap;
  }
  .leeg-icoon {
    font-size: 28px;
    margin-bottom: 4px;
  }
  .leeg-canvas p {
    margin-bottom: 12px;
  }
}
</style>
