<script setup>
import CanvaTextInput from "./canvaTextInput.vue";
import { usePhotoStylerContext } from "../../composables/photostyler/context.ts";

const {
  middenlijnen,
  canvasTekstActief,
  startCanvasText,
  tekenModus,
  foutmelding,
  canvasHost,
  lagen,
    conceptBezig,
  geselecteerdeLaag,
  inspectorsVergrendeld,
  verfCanvas,
  startDrawing,
  continueDrawing,
  stopDrawing,
  fileName,
  canvasKlaar,
  achtergrondBestandsnaam,
  achtergrondVoorbeeld,
  achtergrondIngesteld,
  selectPanel,
  bestandInput,
} = usePhotoStylerContext();
</script>

<template>
  <!-- Canvas met de afbeelding en een aparte verflaag. -->
  <main
    class="werkruimte"
    aria-label="Ontwerpcanvas"
  >

    <p
      v-if="foutmelding"
      class="foutmelding"
      role="alert"
    >
      {{ foutmelding }}
    </p>
    <div class="canvasgebied" :inert="conceptBezig">
      <div class="papier">
        <div class="papierkop">
          <span>01 <strong>Jouw clubontwerp</strong></span
          ><span>PNG</span>
        </div>
        <div
          class="canvas-host"
          :class="{ 'kwast-actief': tekenModus }"
          @dblclick="geselecteerdeLaag === 'tekst' && !tekenModus && startCanvasText()"
        >
          <div ref="canvasHost"></div>
          <canvas
            ref="verfCanvas"
            class="verflaag"
            width="800"
            height="500"
            aria-label="Verflaag: teken met de kwast op de afbeelding"
            @pointerdown="startDrawing"
            @pointermove="continueDrawing"
            @pointerup="stopDrawing"
            @pointercancel="stopDrawing"
            @lostpointercapture="stopDrawing"
          />
          <div
              v-if="!achtergrondIngesteld && !fileName && !achtergrondBestandsnaam && !canvasTekstActief && !lagen.some(laag => laag.id === 'tekst' && laag.aanwezig)"
            class="leeg-canvas"
            :style="{ background: achtergrondVoorbeeld }"
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
                selectPanel('uploads');
                bestandInput?.click();
              "
            >
              Afbeelding toevoegen
            </button>
          </div>
          <CanvaTextInput />
          <div v-if="middenlijnen.verticaal" class="middenlijn middenlijn-verticaal" aria-hidden="true"></div>
          <div v-if="middenlijnen.horizontaal" class="middenlijn middenlijn-horizontaal" aria-hidden="true"></div>
        </div>
        <p v-if="canvasTekstActief" class="canvashint">
          Enter: nieuwe regel · Klik buiten de tekst of druk Cmd/Ctrl + Enter om op te slaan · Escape: annuleren
        </p>
        <p v-else class="canvashint">
          {{
            tekenModus
            ? "Sleep om te tekenen · Kies links je kleur en kwastgrootte"
            : "Dubbelklik op tekst om te typen · Sleep om te verplaatsen"

          }}
        </p>

        <p
            v-if="achtergrondBestandsnaam && !tekenModus"
            class="canvashint"
           >
          Sleep de achtergrond op het canvas om de uitsnede te verschuiven.
          De achtergrond blijft het hele canvas vullen.
        </p>



      </div>
    </div>
    <footer class="werkruimtevoet">
      <span>Gemaakt voor jouw club</span><span>Download je ontwerp om het te bewaren</span>
    </footer>
  </main>
</template>
