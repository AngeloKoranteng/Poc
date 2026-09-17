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
    <p>Upload je foto, sleep hem over het canvas en zoom in of uit.</p>

    <label class="upload">
      Kies een foto
      <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/svg+xml,.svg"
          :disabled="!canvasKlaar"
          @change="uploadFoto"
      />
    </label>

    <p v-if="fileName">{{ fileName }}</p>
    <p v-if="foutmelding" role="alert">{{ foutmelding }}</p>
    <div class="achtergrondkleur">
      <label>
        Rood
        <input class="slider-rood" type="range" min="0" max="255" v-model.number="rood" @pointerdown="startKleurWijziging" @keydown="startKleurWijziging" @change="stopKleurWijziging" @blur="stopKleurWijziging" />
        <output>{{ rood }}</output>
      </label>

      <label>
        Groen
        <input class="slider-groen" type="range" min="0" max="255" v-model.number="groen" @pointerdown="startKleurWijziging" @keydown="startKleurWijziging" @change="stopKleurWijziging" @blur="stopKleurWijziging" />
        <output>{{ groen }}</output>
      </label>

      <label>
        Blauw
        <input class="slider-blauw" type="range" min="0" max="255" v-model.number="blauw" @pointerdown="startKleurWijziging" @keydown="startKleurWijziging" @change="stopKleurWijziging" @blur="stopKleurWijziging" />
        <output>{{ blauw }}</output>
      </label>
    </div>


    <div class="knoppen tekengereedschap">
      <button type="button" class="kwast-knop" :class="{ actief: tekenModus }"
              :aria-pressed="tekenModus" :aria-label="tekenModus ? 'Kwast uitzetten' : 'Kwast inschakelen'"
              :disabled="!canvasKlaar || !fileName" @click="wisselKwast">
        <img src="/kwast.svg" alt="" width="28" height="28" />
        {{ tekenModus ? "Kwast aan" : "Kwast uit" }}
      </button>
      <label>
        Kwastkleur
        <input type="color" v-model="kwastKleur" />
      </label>
      <label>
        Kwastgrootte
        <input type="range" min="1" max="80" v-model.number="kwastGrootte" />
        <output>{{ kwastGrootte }} px</output>
      </label>
    </div>
    <p v-if="tekenModus">Sleep met je muis, pen of vinger om te verven. De verf blijft op het canvas staan wanneer je de foto verplaatst.</p>
    <div class="canvas-host" :class="{ 'kwast-actief': tekenModus }">
      <div ref="canvasHost"></div>
      <canvas ref="verfCanvas" class="verflaag" width="800" height="500"
              aria-label="Verflaag: teken met de kwast op de afbeelding"
              @pointerdown="startTekenen" @pointermove="tijdensTekenen"
              @pointerup="stopTekenen" @pointercancel="stopTekenen"
              @lostpointercapture="stopTekenen" />
    </div>
    <div v-if="fotoGeselecteerd">
      <h2>Fototint</h2>

      <div class="achtergrondkleur">
        <label>
          Rood
          <input
              type="range"
              min="0"
              max="255"
              v-model.number="fotoRood"
              @pointerdown="startKleurWijziging"
              @keydown="startKleurWijziging"
              @change="stopKleurWijziging"
              @blur="stopKleurWijziging"/>
          <output>{{ fotoRood }}</output>
        </label>
        <label>
          Groen
          <input
              type="range"
              min="0"
              max="255"
              v-model.number="fotoGroen"
              @pointerdown="startKleurWijziging"
              @keydown="startKleurWijziging"
              @change="stopKleurWijziging"
              @blur="stopKleurWijziging"/>
          <output>{{ fotoGroen }}</output>
        </label>

        <label>
          Blauw
          <input
              type="range"
              min="0"
              max="255"
              v-model.number="fotoBlauw"
              @pointerdown="startKleurWijziging"
              @keydown="startKleurWijziging"
              @change="stopKleurWijziging"
              @blur="stopKleurWijziging"
          />
          <output>{{ fotoBlauw }}</output>
        </label>
      </div>

      <button @click="fotoGeselecteerd = false">
        Selectie sluiten
      </button>
    </div>
    <div class="knoppen">
      <button @click="veranderSchaal(0.9)">− Kleiner</button>
      <button @click="veranderSchaal(1.1)">+ Groter</button>
      <button @click="draaiFoto(-15)">Link draaien</button>
      <button @click="draaiFoto(15)">Rechts draaien</button>
      <button @click="ongedaanMaken" :disabled="geschiedenis.length === 0">Ongedaan Maken</button>
      <button @click="verwijderFoto" :disabled="!fileName" aria-label="Foto verwijderen" title="Foto verwijderen">🗑️️</button>
      <button class="download" :disabled="!fileName" @click="downloadFoto">Download</button>
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

.upload,
.knoppen button {
  padding: 0.75rem 1rem;
  border: 0;
  border-radius: 0.5rem;
  cursor: pointer;
  font: inherit;
}

.upload {
  display: inline-block;
  color: white;
  background: #1f3a2c;
}

.upload input {
  display: none;
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

.achtergrondkleur {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-top: 1rem;
}
.achtergrondkleur label{
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.achtergrondkleur input{
  width: 10rem;
  padding: 0.5rem;
}
.knoppen {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1rem;
}

.slider-rood {
  accent-color: v-bind(roodAccent);
}
.slider-groen {
  accent-color: v-bind(groenAccent);
}
.slider-blauw {
  accent-color: v-bind(blauwAccent);
}

.knoppen button {
  background: #ece7df;
}

.knoppen .download {
  color: white;
  background: #1f3a2c;
}

.knoppen button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.kwast-knop{
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border: 2px solid #ccc;
  border-radius: 0.5rem;
  background: white;
  cursor: pointer;
}

.knoppen .kwast-knop.actief{
  border-color: #1f3a2c;
  background: #dcefe2;
}

.canvas-host.kwast-actief :deep(canvas){
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

.tekengereedschap {
  align-items: center;
}

.tekengereedschap label {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

</style>
