<script setup lang="ts">
import TextSettings from "./textSettings.vue";
import { usePhotoStylerContext } from "../../composables/photostyler/context.ts";

const { activePanel, canvasReady } = usePhotoStylerContext();
</script>

<template>
  <!-- A custom panel for text, formatting, and position. -->
  <section v-show="activePanel === 'tekst'" class="paneel">
    <span class="bovenlabel">GEEF JE ONTWERP EEN BOODSCHAP</span>
    <h2>Tekst</h2>
    <p>Voeg tekst toe en kies de kleur, grootte en positie.</p>
    <p v-if="!canvasReady" class="tip">
      Het canvas wordt geladen.
    </p>
    <fieldset :disabled="!canvasReady">
      <legend class="sr-only">Tekstinstellingen</legend>
      <TextSettings />
    </fieldset>
  </section>
</template>
