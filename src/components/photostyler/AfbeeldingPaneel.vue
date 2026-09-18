<script setup>
import KleurSliders from "./KleurSliders.vue";
import { usePhotoStylerContext } from "../../composables/photostyler/context.js";
const {
  actiefPaneel,
  fileName,
  veranderSchaal,
  draaiFoto,
  tintKanalen,
  startKleurWijziging,
  stopKleurWijziging,
  verwijderFoto,
} = usePhotoStylerContext();
</script>

<template>
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
      <KleurSliders
          :kanalen="tintKanalen"
          label="Fototint"
          @start="startKleurWijziging"
          @stop="stopKleurWijziging"
        />
      <button
        class="verwijderen"
        type="button"
        @click="verwijderFoto"
      >
        Afbeelding verwijderen
      </button>
    </fieldset>
  </section>
</template>
