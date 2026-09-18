<script setup>
import { usePhotoStylerContext } from "../../composables/photostyler/context.js";

const {
  tekenModus,
  foutmelding,
  canvasHost,
  verfCanvas,
  startTekenen,
  tijdensTekenen,
  stopTekenen,
  fileName,
  canvasKlaar,
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
              : "Sleep je afbeelding om te verplaatsen · Sleep aan een hoekblokje of scroll om te schalen"
          }}
        </p>
      </div>
    </div>
    <footer class="werkruimtevoet">
      <span>Gemaakt voor jouw club</span><span>Download je ontwerp om het te bewaren</span>
    </footer>
  </main>
</template>
