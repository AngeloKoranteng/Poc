<script setup lang="ts">
import CanvaTextInput from "./canvaTextInput.vue";
import { usePhotoStylerContext } from "../../composables/photostyler/context.ts";

const {
  centerGuides,
  canvasTextActive,
  startCanvasText,
  drawingMode,
  errorMessage,
  canvasHost,
  layers,
    draftBusy,
  selectedLayer,
  paintCanvas,
  startDrawing,
  continueDrawing,
  stopDrawing,
  fileName,
  canvasReady,
  backgroundFileName,
  backgroundPreview,
  backgroundConfigured,
  selectPanel,
  fileInput,
} = usePhotoStylerContext();

function bindCanvasHost(element: unknown) {
  canvasHost.value = element instanceof HTMLElement ? element : null;
}

function bindPaintCanvas(element: unknown) {
  paintCanvas.value = element instanceof HTMLCanvasElement ? element : null;
}
</script>

<template>
<!-- Canvas with the image and a separate layer of paint. -->
  <main
    class="werkruimte"
    aria-label="Ontwerpcanvas"
  >

    <p
      v-if="errorMessage"
      class="foutmelding"
      role="alert"
    >
      {{ errorMessage }}
    </p>
    <div class="canvasgebied" :inert="draftBusy">
      <div class="papier">
        <div class="papierkop">
          <span>01 <strong>Jouw clubontwerp</strong></span
          ><span>PNG</span>
        </div>
        <div
          class="canvas-host"
          :class="{ 'kwast-actief': drawingMode }"
          @dblclick="selectedLayer === 'tekst' && !drawingMode && startCanvasText()"
        >
          <div :ref="bindCanvasHost"></div>
          <canvas
            :ref="bindPaintCanvas"
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
              v-if="!backgroundConfigured && !fileName && !backgroundFileName && !canvasTextActive && !layers.some(layer => layer.id === 'tekst' && layer.present)"
            class="leeg-canvas"
            :style="{ background: backgroundPreview }"
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
              :disabled="!canvasReady"
              @click="
                selectPanel('uploads');
                fileInput?.click();
              "
            >
              Afbeelding toevoegen
            </button>
          </div>
          <CanvaTextInput />
          <div v-if="centerGuides.vertical" class="middenlijn middenlijn-verticaal" aria-hidden="true"></div>
          <div v-if="centerGuides.horizontal" class="middenlijn middenlijn-horizontaal" aria-hidden="true"></div>
        </div>
        <p v-if="canvasTextActive" class="canvashint">
          Enter: nieuwe regel · Klik buiten de tekst of druk Cmd/Ctrl + Enter om op te slaan · Escape: annuleren
        </p>
        <p v-else class="canvashint">
          {{
            drawingMode
            ? "Sleep om te tekenen · Kies links je kleur en kwastgrootte"
            : "Dubbelklik op tekst om te typen · Sleep om te verplaatsen"

          }}
        </p>

        <p
            v-if="backgroundFileName && !drawingMode"
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
