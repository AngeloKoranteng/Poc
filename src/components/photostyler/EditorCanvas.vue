<script setup>
import CanvasTekstInvoer from "./CanvasTekstInvoer.vue";
import { usePhotoStylerContext } from "../../composables/photostyler/context.js";

const {
  canvasTekstActief,
  startCanvasTekst,
  tekenModus,
  foutmelding,
  canvasHost,
  lagen,
    conceptBezig,
  geselecteerdeLaag,
  inspectorsVergrendeld,
  verfCanvas,
  startTekenen,
  tijdensTekenen,
  stopTekenen,
  fileName,
  canvasKlaar,
  achtergrondBestandsnaam,
  achtergrondVoorbeeld,
  achtergrondIngesteld,
  kiesPaneel,
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
          @dblclick="geselecteerdeLaag === 'tekst' && !tekenModus && startCanvasTekst()"
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
                kiesPaneel('uploads');
                bestandInput?.click();
              "
            >
              Afbeelding toevoegen
            </button>
          </div>
          <CanvasTekstInvoer />
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
