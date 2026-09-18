<script setup>
import TekstInstellingen from "./TekstInstellingen.vue";
import { usePhotoStylerContext } from "../../composables/photostyler/context.js";

const { actiefPaneel, fileName } = usePhotoStylerContext();
</script>

<template>
  <!-- Een eigen paneel voor tekst, opmaak en positie. -->
  <section v-show="actiefPaneel === 'tekst'" class="paneel">
    <span class="bovenlabel">GEEF JE ONTWERP EEN BOODSCHAP</span>
    <h2>Tekst</h2>
    <p>Voeg tekst toe en kies de kleur, grootte en positie.</p>
    <p v-if="!fileName" class="tip">
      Upload eerst een afbeelding om tekst aan je ontwerp toe te voegen.
    </p>
    <fieldset :disabled="!fileName">
      <legend class="sr-only">Tekstinstellingen</legend>
      <TekstInstellingen />
    </fieldset>
  </section>
</template>
