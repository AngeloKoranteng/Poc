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
const tekenmodus = ref(false);
const kwastKleur = ref("#ff0000");
const kwastGrootte = ref(12);

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
const tekenModus = ref(false);
function wisselKwast(){
  stopSlepen();
  tekenModus.value = !tekenModus.value;
}

// Laatste wijziging terugdraaien
function ongedaanMaken() {
  if (!canvasKlaar.value || geschiedenis.value.length === 0) return;

  stopSlepen();

  const vorige = geschiedenis.value.pop();
  if (!vorige) return;

  bezigMetHerstellen = true;

  try {
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
  if (!fotoSprite) return;

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

  const canvas = app.renderer.extract.canvas({
    target: app.stage,
    frame: app.screen.clone(),
    resolution: 1,
    clearColor: achtergrondKleur(),
  });
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
          accept="image/jpeg,image/png,image/webpsvg+xml,.svg"
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


    <div ref="canvasHost" class="canvas-host" :class="{ 'kwast-actief' : tekenModus }"></div>
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
      <button type="button" class="kwast-knop" :class="{ actief: tekenModus }" :aria-pressed="tekenModus" :aria-label="tekenModus ? 'Kwast uitzetten' : 'Kwast inschakelen'" disabled="!canvasKlaar" @click="wisselKwast"/>
      <img src="/kwast.svg"  alt="Kwast"  width="28" height="28"/>
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
  padding: 0.5rem;
  border: 2px solid #ccc;
  border-radius: 0.5rem;
  background: white;
  cursor: pointer;
}

.kwast-knop.actief{
  border-color: #1f3a2c;
  background: #dcefe2;
}

.canvas-host.kwast-actief :deep(canvas){
  cursor: url("/kwast.svg") 3 29, crosshair !important;
}

</style>
