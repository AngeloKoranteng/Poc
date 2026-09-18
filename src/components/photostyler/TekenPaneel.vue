<script setup>
import { usePhotoStylerContext } from "../../composables/photostyler/context.js";

const {
  actiefPaneel,
  fileName,
  tekenModus,
  wisselKwast,
  kwastKleur,
  kwastPalet,
  kwastGrootte,
} = usePhotoStylerContext();
</script>

<template>
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
</template>
