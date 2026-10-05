<script setup lang="ts">
import { usePhotoStylerContext } from "../../composables/photostyler/context.ts";

const {
  activePanel,
  fileName,
  drawingMode,
  toggleBrush,
  brushColor,
  brushPalette,
  brushSize,
} = usePhotoStylerContext();
</script>

<template>
  <!-- Brush, color, and thickness. -->
  <section
    v-show="activePanel === 'tekenen'"
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
        :class="{ actief: drawingMode }"
        type="button"
        :aria-pressed="drawingMode"
        :aria-label="drawingMode ? 'Kwast uitzetten' : 'Kwast inschakelen'"
        @click="toggleBrush"
      >
        <img
          src="/kwast.svg"
          alt=""
          width="28"
          height="28"
        />
        <span>Kwast</span><span class="schakelaar">{{ drawingMode ? "Aan" : "Uit" }}</span>
      </button>
      <h3>Kleur</h3>

      <div class="kleurkeuze">
        <label for="kwastkleur">Kwastkleur</label>
        <input
          id="kwastkleur"
          type="color"
          v-model="brushColor"
        />
        <span>{{ brushColor.toUpperCase() }}</span>
      </div>
      <div
        class="kleurpalet"
        aria-label="Snelle kwastkleuren"
      >
        <button
          v-for="color in brushPalette"
          :key="color"
          type="button"
          :style="{ background: color }"
          :aria-label="'Kwastkleur ' + color"
          :aria-pressed="brushColor === color"
          :class="{ chosen: brushColor === color }"
          @click="brushColor = color"
        />
      </div>
      <label class="schuifregelaar">
        <span
          >Kwastgrootte <output>{{ brushSize }} px</output></span
        >
        <input
          type="range"
          min="1"
          max="80"
          aria-label="Kwastgrootte"
          v-model.number="brushSize"
        />
      </label>
      <div
        class="kwastvoorbeeld"
        aria-hidden="true"
      >
        <span
          :style="{
            width: brushSize + 'px',
            height: brushSize + 'px',
            background: brushColor,
          }"
        ></span>
      </div>
    </fieldset>
    <p class="tip">
      De verf ligt op een aparte laag en blijft staan als je de afbeelding verplaatst. Met
      Ongedaan maken haal je een streek weg.
    </p>
  </section>
</template>
