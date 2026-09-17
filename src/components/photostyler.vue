<script setup>
// Imports
import { onBeforeUnmount, onMounted, ref, watch, computed } from "vue";
import { Application, Sprite, Texture } from "pixi.js";

// Reactieve editorstatus
const canvasHost = ref(null);
const fileName = ref("");
const foutmelding = ref("");
const canvasKlaar = ref(false);
// RGB-achtergrondkleur
const rood = ref(0);
const groen = ref(0);
const blauw = ref(0);
const actiefPaneel = ref("uploads");

const panelen = [
  { id: "uploads", naam: "Uploads" },
  { id: "afbeelding", naam: "Afbeelding" },
  { id: "tekenen", naam: "Tekenen" },
  { id: "achtergrond", naam: "Achtergrond" },
];


//Fotoselectie en kleurtint
const fotoGeselecteerd = ref(false);
const fotoRood = ref(255);
const fotoGroen = ref(255);
const fotoBlauw = ref(255);

//Tekengereedschap
const tekenModus = ref(false);
const kwastKleur = ref("#ff0000");
const kwastGrootte = ref(12);
const verfCanvas = ref(null);
let verfstreken = [];
let actieveStreek = null;
let tekenPointer = null;

// Kleuren van de sliders
const roodAccent = computed(() => `rgb(${rood.value}, 0, 0)`);
const groenAccent = computed(() => `rgb(0, ${groen.value}, 0)`);
const blauwAccent = computed(() => `rgb(0, 0, ${blauw.value})`);

// Geschiedenis
const geschiedenis = ref([]);
let bezigMetHerstellen = false;
let sleepBegin = null;
let kleurBegin = null;

// Pixi-objecten en interne status
let app;
let fotoSprite;
let uploadId = 0;
let unmounted = false;
let slepen = false;
let verschil = { x: 0, y: 0 };

// Huidige toestand ophalen
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

// Vorige toestand bewaren
function bewaarToestand(toestand = huidigeToestand()) {
  if (bezigMetHerstellen || !canvasKlaar.value) return;

  geschiedenis.value.push(toestand);
}

function startKleurWijziging(){
  if (!canvasKlaar.value || kleurBegin) return;

  kleurBegin = huidigeToestand();
}

function stopKleurWijziging(){
  if(!kleurBegin) return;

  const einde = huidigeToestand();
  const veranderd = Object.keys(kleurBegin).some(
      (sleutel) => kleurBegin[sleutel] !==einde [sleutel],
  );
  if (veranderd) {
    bewaarToestand(kleurBegin);
  }
  kleurBegin = null;
}
function wisselKwast(){
  stopSlepen();
  stopTekenen();
  stopKleurWijziging();
  tekenModus.value = !tekenModus.value;
}

// De verflaag gebruikt dezelfde 800 x 500 coördinaten als de PNG-export.
function tekenPunt(event) {
  const rechthoek = verfCanvas.value.getBoundingClientRect();
  return {
    x: (event.clientX - rechthoek.left) * verfCanvas.value.width / rechthoek.width,
    y: (event.clientY - rechthoek.top) * verfCanvas.value.height / rechthoek.height,
  };
}

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

function startTekenen(event) {
  if (!tekenModus.value || !canvasKlaar.value || !fotoSprite ||
      tekenPointer !== null || !event.isPrimary || event.button !== 0) return;

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

function tijdensTekenen(event) {
  if (!actieveStreek || event.pointerId !== tekenPointer) return;
  event.preventDefault();
  const punt = tekenPunt(event);
  const vorigPunt = actieveStreek.punten[actieveStreek.punten.length - 1];
  if (punt.x === vorigPunt.x && punt.y === vorigPunt.y) return;
  actieveStreek.punten.push(punt);
  verfSegment(actieveStreek, vorigPunt, punt);
}

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

// Laatste wijziging terugdraaien
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
// Fototint berekenen
function fotoTint() {
  return (
      kleurGetal(fotoRood.value) * 65536 +
      kleurGetal(fotoGroen.value) * 256 +
      kleurGetal(fotoBlauw.value)
  );
}

//Fototint wijzigen
watch(
    [fotoRood, fotoGroen, fotoBlauw],
    (nieuweWaarden, oudeWaarden) => {
      if (!fotoSprite || bezigMetHerstellen) return;

      fotoSprite.tint = fotoTint();
      app.render();
    },
    {flush: "sync"},
);

// Canvas aanmaken
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

// Foto uploaden en tonen
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
    fotoGeselecteerd.value = false;
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

// Slepen starten
function startSlepen(event) {
  if (!fotoSprite || tekenModus.value) return;
  fotoGeselecteerd.value = true;

  sleepBegin = huidigeToestand();
  slepen = true;
  fotoSprite.cursor = "grabbing";

  verschil = {
    x: event.global.x - fotoSprite.x,
    y: event.global.y - fotoSprite.y,
  };
}

// Foto verplaatsen
function tijdensSlepen(event) {
  if (!slepen || !fotoSprite) return;

  fotoSprite.position.set(
      event.global.x - verschil.x,
      event.global.y - verschil.y,
  );
  app.render();
}

// Slepen stoppen
function stopSlepen() {
  if(
      slepen &&
      fotoSprite &&
      sleepBegin &&
      (fotoSprite.x !== sleepBegin.x || fotoSprite.y !== sleepBegin.y)
  ){
    bewaarToestand(sleepBegin);
  }
  sleepBegin = null;
  slepen = false;

  if (fotoSprite) {
    fotoSprite.cursor = "grab";
  }
}

//foto draaien
function draaiFoto(graden) {
  if (!fotoSprite || !canvasKlaar.value) return;

  stopSlepen();
  bewaarToestand();

  fotoSprite.angle += graden;
  app.render();
}

// Foto vergroten of verkleinen
function veranderSchaal(factor) {
  if (!fotoSprite) return;

  bewaarToestand();

  fotoSprite.scale.set(
      fotoSprite.scale.x * factor,
      fotoSprite.scale.y * factor,
  );
  app.render();
}

// Foto verwijderen
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
  fotoGeselecteerd.value = false;
  foutmelding.value = "";
  geschiedenis.value = [];
  sleepBegin = null;

  app.render();
}


// Zoomen met het muiswiel
function zoomMetMuis(event) {
  if (!fotoSprite || tekenModus.value) return;

  event.preventDefault();
  veranderSchaal(event.deltaY < 0 ? 1.1 : 0.9);
}
// Zorg dat een kleurwaarde een geheel getal tussen 0 en 255 is.
// Een leeg veld wordt behandeld als 0.
function kleurGetal(waarde) {
  return Math.max(0, Math.min(255, Math.round(Number(waarde) || 0)));
}

// Maak van de drie waarden een RGB-kleur die Pixi begrijpt.
function achtergrondKleur() {
  return `rgb(${kleurGetal(rood.value)}, ${kleurGetal(groen.value)}, ${kleurGetal(blauw.value)})`;
}
// Achtergrondkleur wijzigen
watch(
    [rood, groen, blauw],
    (nieuweWaarden, oudeWaarden) => {
      if (!canvasKlaar.value || bezigMetHerstellen) return;

      app.renderer.background.color = achtergrondKleur();
      app.render();
    },
    { flush: "sync" },
);

// Canvas downloaden als PNG
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

// Editor starten
onMounted(async () => {
  try {
    await maakCanvas();
  } catch (error) {
    console.error("Foto-editor starten mislukt:", error);
    foutmelding.value = "De foto-editor kon niet starten. Ververs de pagina.";
  }
});

// Editor opruimen
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
  <section class="styler">
    <h1>Foto-editor</h1>

    <nav class="gereedschappen" aria-label="Editorgereedschappen">
      <button
        v-for="paneel in panelen"
        :key="paneel.id"
        type="button"
        :class="{ actief: actiefPaneel === paneel.id }"
        :aria-pressed="actiefPaneel === paneel.id"
        @click="actiefPaneel = paneel.id"
      >
        {{ paneel.naam }}
      </button>
    </nav>

    <div class="instellingen">
      <section v-show="actiefPaneel === 'uploads'" class="paneel">
        <h2>Uploads</h2>
        <p>Upload je clublogo of afbeelding.</p>
        <label class="uploadveld">
          Afbeelding kiezen
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/svg+xml,.svg"
            :disabled="!canvasKlaar"
            @change="uploadFoto"
          />
        </label>
      </section>
    </div>

    <p v-if="fileName">{{ fileName }}</p>
    <p v-if="foutmelding" role="alert">{{ foutmelding }}</p>

    <div class="canvas-host" :class="{ 'kwast-actief': tekenModus }">
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
    </div>

    <div class="knoppen">
      <button type="button" @click="ongedaanMaken" :disabled="geschiedenis.length === 0">
        Ongedaan maken
      </button>
      <button type="button" class="download" :disabled="!fileName" @click="downloadFoto">
        Download
      </button>
    </div>
  </section>
</template>

<style scoped>
.styler {
  max-width: 860px;
  margin: 3rem auto;
  padding: 2rem;
  font-family: Arial, sans-serif;
}

.instellingen{
  margin-bottom: 1.5rem;
}

.paneel{
  padding: 1.5rem;
  border: 1px solid #e2e8e5;
  border-radius: 0.75rem;
  background: #f7faf8;
}

.paneel h2{
  margin: 0 0 0.5rem;
  font-size: 1.1rem;
}

.paneel p{
  color: #526259;
}

.uploadveld{
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.uploadveld input{
  max-width: 100%;
  font: inherit;
}

.gereedschappen,
.knoppen {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.gereedschappen {
  margin-bottom: 1.5rem;
}

.knoppen {
  margin-top: 1rem;
}

.gereedschappen button,
.knoppen button {
  padding: 0.75rem 1rem;
  border: 1px solid #ddd;
  border-radius: 0.5rem;
  background: white;
  color: #333;
  font: inherit;
  cursor: pointer;
}

.gereedschappen button.actief,
.knoppen .download {
  border-color: #1f3a2c;
  background: #1f3a2c;
  color: white;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

button:focus-visible {
  outline: 3px solid #387c60;
  outline-offset: 3px;
}

.canvas-host {
  position: relative;
  width: 100%;
  margin-top: 1.5rem;
  overflow: hidden;
  border: 2px solid #1f3a2c;
  border-radius: 0.75rem;
}

.canvas-host :deep(canvas) {
  display: block;
  width: 100% !important;
  height: auto !important;
  touch-action: none;
}

.canvas-host.kwast-actief :deep(canvas) {
  cursor: url("/kwast.svg") 3 29, crosshair !important;
}

.verflaag {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
}

.kwast-actief .verflaag {
  pointer-events: auto;
}
</style>
